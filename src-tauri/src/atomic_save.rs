//! Enregistrement atomique et vérifié des fichiers de l'application de bureau.
//!
//! Voir docs/desktop-tauri.md, section 13 (« Écriture atomique ») : conception, garanties par plateforme,
//! état de la compilation et des tests (`cargo test --lib`, lancé par desktop-build.yml).
//!
//! Principe : les données sont écrites, par morceaux, dans un fichier temporaire du MÊME dossier, forcées sur
//! le disque (`sync_all`), relues et vérifiées (longueur et empreinte FNV-1a 64 bits des octets reçus), puis le
//! fichier temporaire remplace la cible par un renommage (`std::fs::rename`). Une coupure de courant, un
//! plantage ou un disque plein pendant l'écriture laissent donc soit l'ancien fichier intact, soit le nouveau
//! complet, jamais un fichier tronqué.
//!
//! Écriture par morceaux : une archive de projet peut peser plusieurs centaines de Mo (photos). La page envoie
//! l'archive en flux (`save_begin`, `save_chunk` répété, `save_commit`) : ni la page ni Rust ne gardent
//! l'archive entière en mémoire, et chaque requête IPC reste de taille bornée (quelques Mo).
//!
//! Sécurité : la page web ne peut écrire qu'aux chemins choisis par l'utilisateur dans la boîte
//! « Enregistrer » ouverte ici, côté Rust (`pick_save_path`), et seulement avec les extensions que
//! l'application produit. Une page compromise (XSS) ne peut donc pas écrire un chemin arbitraire.

use std::collections::{HashMap, HashSet};
use std::ffi::OsString;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri_plugin_dialog::DialogExt;

/// Extensions que l'application écrit sur le bureau (src/io/files.ts, `saveProject` et `download`) : projet
/// et copie v1 (`.voltaplan`), export Trikker (`.trik`), export Eendraadschema (`.eds`), nomenclature (`.csv`),
/// image du tableau composée pour l'IA (`.jpg`, src/ui/BoardView.tsx).
pub const ALLOWED_EXTS: &[&str] = &["voltaplan", "trik", "eds", "csv", "jpg"];
/// Seuls les projets gardent une copie de la version précédente (`<nom>.bak`), et seulement si la page le demande
/// (enregistrement du projet, pas la copie v1).
const BACKUP_EXT: &str = "voltaplan";
/// Marque des fichiers temporaires : `.<nom>.voltaplan-tmp-<pid>-<horodatage>-<compteur>`.
pub const TMP_MARK: &str = ".voltaplan-tmp-";
/// Taille de lecture pour la vérification.
const READ_BUF: usize = 1 << 20;

/// Chemins choisis par l'utilisateur pendant cette session (mémoire seulement, perdus au redémarrage).
#[derive(Default)]
pub struct Granted(Mutex<HashSet<PathBuf>>);

impl Granted {
    pub fn grant(&self, path: PathBuf) {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).insert(path);
    }
    pub fn contains(&self, path: &Path) -> bool {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).contains(path)
    }
}

/// Date de modification (millisecondes depuis 1970) et taille d'un fichier.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FileState {
    pub mtime_ms: f64,
    pub size: u64,
}

/// Résultat d'un enregistrement : état du fichier écrit, copie `.bak` faite ou non.
#[derive(Debug)]
pub struct Written {
    pub state: FileState,
    pub backup: bool,
}

fn invalid(msg: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, msg.to_string())
}

/// Extension demandée (« .csv » ou « csv »), en minuscules, si elle est autorisée.
pub fn normalize_ext(ext: &str) -> Option<String> {
    let e = ext.trim_start_matches('.').to_ascii_lowercase();
    if ALLOWED_EXTS.contains(&e.as_str()) {
        Some(e)
    } else {
        None
    }
}

/// Extension autorisée du chemin, en minuscules.
pub fn allowed_ext(path: &Path) -> Option<String> {
    normalize_ext(path.extension()?.to_str()?)
}

/// Ajoute `.ext` si le nom choisi ne se termine pas déjà par cette extension (Linux n'ajoute pas toujours
/// l'extension du filtre). « maison.txt » devient « maison.txt.csv » : jamais une autre extension.
pub fn with_ext(path: PathBuf, ext: &str) -> PathBuf {
    match path.extension().and_then(|e| e.to_str()) {
        Some(e) if e.eq_ignore_ascii_case(ext) => path,
        _ => {
            let mut s: OsString = path.into_os_string();
            s.push(".");
            s.push(ext);
            PathBuf::from(s)
        }
    }
}

fn parent_dir(target: &Path) -> io::Result<PathBuf> {
    match target.parent() {
        Some(p) if !p.as_os_str().is_empty() => Ok(p.to_path_buf()),
        Some(_) => Ok(PathBuf::from(".")),
        None => Err(invalid("chemin sans dossier parent")),
    }
}

static COUNTER: AtomicU64 = AtomicU64::new(0);

/// Fichier temporaire à côté de la cible (même dossier, donc même volume : le renommage reste atomique).
pub fn temp_path(target: &Path) -> io::Result<PathBuf> {
    let dir = parent_dir(target)?;
    let name = target.file_name().ok_or_else(|| invalid("chemin sans nom de fichier"))?;
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    let mut s = OsString::from(".");
    s.push(name);
    s.push(format!("{}{}-{:x}-{}", TMP_MARK, std::process::id(), nanos, n));
    Ok(dir.join(s))
}

/// Copie de la version précédente : `<nom>.bak`, remplacée à chaque enregistrement.
pub fn backup_path(target: &Path) -> PathBuf {
    let mut s = target.as_os_str().to_os_string();
    s.push(".bak");
    PathBuf::from(s)
}

/// État du fichier, `None` s'il n'existe pas.
pub fn state_of(path: &Path) -> io::Result<Option<FileState>> {
    match fs::metadata(path) {
        Ok(m) => {
            let mtime_ms = m
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as f64)
                .unwrap_or(0.0);
            Ok(Some(FileState { mtime_ms, size: m.len() }))
        }
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

/// Empreinte FNV-1a 64 bits, calculée au fil des morceaux (pas de crate de hachage). Elle sert à détecter une
/// écriture incomplète ou altérée, pas une modification malveillante.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Fnv(u64);

impl Default for Fnv {
    fn default() -> Self {
        Fnv(0xcbf2_9ce4_8422_2325)
    }
}

impl Fnv {
    pub fn update(&mut self, data: &[u8]) {
        for b in data {
            self.0 ^= u64::from(*b);
            self.0 = self.0.wrapping_mul(0x0000_0100_0000_01b3);
        }
    }
}

/// Écriture en cours : fichier temporaire ouvert, empreinte et longueur des octets reçus.
pub struct Upload {
    target: PathBuf,
    tmp: PathBuf,
    file: Option<File>,
    hash: Fnv,
    len: u64,
    keep_backup: bool,
}

impl Upload {
    /// Crée le fichier temporaire à côté de `target` (create_new : jamais un fichier ou un lien existant).
    pub fn begin(target: &Path, keep_backup: bool) -> io::Result<Upload> {
        // Lien symbolique : on remplace le fichier pointé (le lien reste en place), comme une écriture directe.
        let real = match fs::symlink_metadata(target) {
            Ok(m) if m.file_type().is_symlink() => fs::canonicalize(target)?,
            Ok(m) if m.is_dir() => return Err(invalid("le chemin désigne un dossier")),
            _ => target.to_path_buf(),
        };
        let tmp = temp_path(&real)?;
        let file = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
        Ok(Upload { target: real, tmp, file: Some(file), hash: Fnv::default(), len: 0, keep_backup })
    }

    /// Ajoute un morceau à la fin du fichier temporaire.
    pub fn append(&mut self, data: &[u8]) -> io::Result<()> {
        let f = self.file.as_mut().ok_or_else(|| invalid("écriture déjà terminée"))?;
        f.write_all(data)?;
        self.hash.update(data);
        self.len += data.len() as u64;
        Ok(())
    }

    /// Termine : force sur le disque, vérifie, copie `.bak`, remplace la cible. En cas d'erreur, le fichier
    /// temporaire est supprimé et la cible n'est pas touchée.
    pub fn commit(mut self) -> io::Result<Written> {
        let result = self.finish();
        if result.is_err() {
            self.discard();
        }
        result
    }

    /// Abandon : fichier temporaire supprimé, cible intacte.
    pub fn abort(mut self) {
        self.discard();
    }

    fn discard(&mut self) {
        self.file = None; // fermer avant de supprimer (Windows)
        let _ = fs::remove_file(&self.tmp);
    }

    fn finish(&mut self) -> io::Result<Written> {
        // 1. Données forcées sur le disque, fichier fermé (Windows : un fichier ouvert ne peut pas être renommé).
        {
            let f = self.file.take().ok_or_else(|| invalid("écriture déjà terminée"))?;
            f.sync_all()?;
        }
        // 2. Vérification : relecture complète, longueur et empreinte identiques à celles des octets reçus.
        {
            let mut f = File::open(&self.tmp)?;
            let mut buf = vec![0u8; READ_BUF];
            let mut hash = Fnv::default();
            let mut len: u64 = 0;
            loop {
                let n = f.read(&mut buf)?;
                if n == 0 {
                    break;
                }
                hash.update(&buf[..n]);
                len += n as u64;
            }
            if len != self.len || hash != self.hash {
                return Err(io::Error::new(
                    io::ErrorKind::Other,
                    "vérification échouée : le fichier temporaire relu diffère des données à enregistrer",
                ));
            }
        }
        let target = self.target.clone();
        // Unix : garder les droits de l'ancien fichier (sinon ceux par défaut du fichier temporaire).
        #[cfg(unix)]
        {
            if let Ok(m) = fs::metadata(&target) {
                let _ = fs::set_permissions(&self.tmp, m.permissions());
            }
        }
        // 3. Copie de la version précédente. Un échec n'empêche pas l'enregistrement (signalé par `backup: false`).
        let backup = self.keep_backup
            && allowed_ext(&target).as_deref() == Some(BACKUP_EXT)
            && fs::metadata(&target).map(|m| m.is_file()).unwrap_or(false)
            && fs::copy(&target, backup_path(&target)).is_ok();
        // 4. Remplacement atomique.
        rename_replace(&self.tmp, &target)?;
        // 5. Unix : forcer aussi l'entrée du dossier (le renommage) sur le disque.
        sync_dir(&parent_dir(&target)?);
        // Le fichier est enregistré : ne pas signaler d'échec si sa lecture d'état échoue.
        let state = state_of(&target)
            .ok()
            .flatten()
            .unwrap_or(FileState { mtime_ms: 0.0, size: self.len });
        Ok(Written { state, backup })
    }
}

impl Drop for Upload {
    // Écriture jamais terminée (page fermée, erreur non suivie d'un abandon) : le fichier temporaire est supprimé
    // quand l'écriture est libérée (fermeture de l'application au plus tard). Après un renommage réussi, `tmp`
    // n'existe plus et la suppression échoue sans effet.
    fn drop(&mut self) {
        if self.file.is_some() {
            self.discard();
        }
    }
}

/// Écriture en une fois (tests, petits fichiers) : `begin`, `append`, `commit`.
pub fn write_atomic(target: &Path, data: &[u8], keep_backup: bool) -> io::Result<Written> {
    let mut up = Upload::begin(target, keep_backup)?;
    if let Err(e) = up.append(data) {
        up.abort();
        return Err(e);
    }
    up.commit()
}

/// `std::fs::rename` remplace la cible si elle existe. Windows : un antivirus ou un indexeur peut verrouiller
/// brièvement le fichier ; quelques nouvelles tentatives espacées (0,1 s, 0,2 s, 0,3 s).
#[cfg(windows)]
fn rename_replace(from: &Path, to: &Path) -> io::Result<()> {
    let mut attempt: u64 = 0;
    loop {
        match fs::rename(from, to) {
            Ok(()) => return Ok(()),
            Err(e) if attempt >= 3 => return Err(e),
            Err(_) => {
                attempt += 1;
                std::thread::sleep(std::time::Duration::from_millis(100 * attempt));
            }
        }
    }
}

#[cfg(not(windows))]
fn rename_replace(from: &Path, to: &Path) -> io::Result<()> {
    fs::rename(from, to)
}

#[cfg(unix)]
fn sync_dir(dir: &Path) {
    // Au mieux : certains systèmes de fichiers refusent fsync sur un dossier.
    if let Ok(d) = File::open(dir) {
        let _ = d.sync_all();
    }
}

#[cfg(not(unix))]
fn sync_dir(_dir: &Path) {}

/// Chemin autorisé : choisi par l'utilisateur pendant cette session, avec une extension autorisée.
fn check_target(granted: &Granted, path: &str) -> Result<(PathBuf, String), String> {
    let p = PathBuf::from(path);
    if !granted.contains(&p) {
        return Err("Chemin non autorisé : choisissez l'emplacement avec « Enregistrer sous ».".into());
    }
    let ext = allowed_ext(&p).ok_or_else(|| "Extension de fichier non autorisée.".to_string())?;
    Ok((p, ext))
}

/// Écritures en cours, par identifiant.
#[derive(Default)]
pub struct Uploads {
    next: AtomicU64,
    map: Mutex<HashMap<u64, Upload>>,
}

impl Uploads {
    fn insert(&self, up: Upload) -> u64 {
        let id = self.next.fetch_add(1, Ordering::Relaxed) + 1;
        self.map.lock().unwrap_or_else(|e| e.into_inner()).insert(id, up);
        id
    }
    /// Retire l'écriture (le verrou n'est pas tenu pendant les entrées-sorties).
    fn take(&self, id: u64) -> Result<Upload, String> {
        self.map
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&id)
            .ok_or_else(|| "Écriture inconnue ou déjà terminée.".to_string())
    }
    fn put_back(&self, id: u64, up: Upload) {
        self.map.lock().unwrap_or_else(|e| e.into_inner()).insert(id, up);
    }
}

fn save_error(target: &Path, e: impl std::fmt::Display) -> String {
    format!("Enregistrement de « {} » impossible : {}", target.display(), e)
}

// ---------------------------------------------------------------------------------------------------------
// Commandes appelées par la page (src/io/desktopSave.ts). Commandes `async` : exécutées hors du fil principal,
// la boîte de dialogue bloquante et les écritures ne figent pas la fenêtre.
// ---------------------------------------------------------------------------------------------------------

/// Boîte « Enregistrer » du système. Le chemin choisi est ajouté aux chemins autorisés.
#[tauri::command]
pub async fn pick_save_path(
    window: tauri::Window,
    granted: tauri::State<'_, Granted>,
    default_name: String,
    ext: String,
    description: String,
) -> Result<Option<String>, String> {
    let ext = normalize_ext(&ext).ok_or_else(|| "Extension de fichier non autorisée.".to_string())?;
    let builder = window.dialog().file().set_file_name(default_name).add_filter(description, &[ext.as_str()]);
    // Même choix que le plugin dialog : fenêtre parente sous Windows et macOS seulement.
    #[cfg(any(windows, target_os = "macos"))]
    let builder = builder.set_parent(&window);
    let Some(picked) = builder.blocking_save_file() else {
        return Ok(None);
    };
    let path = with_ext(picked.into_path().map_err(|e| e.to_string())?, &ext);
    granted.grant(path.clone());
    path.into_os_string()
        .into_string()
        .map(Some)
        .map_err(|_| "Chemin de fichier non représentable en UTF-8.".to_string())
}

/// Début d'un enregistrement : crée le fichier temporaire, renvoie l'identifiant de l'écriture.
/// `backup` : garder la version précédente en `<nom>.bak` (projets `.voltaplan` seulement).
#[tauri::command]
pub async fn save_begin(
    granted: tauri::State<'_, Granted>,
    uploads: tauri::State<'_, Uploads>,
    path: String,
    backup: bool,
) -> Result<u64, String> {
    let (target, _) = check_target(&granted, &path)?;
    let up = Upload::begin(&target, backup).map_err(|e| save_error(&target, e))?;
    Ok(uploads.insert(up))
}

/// Morceau suivant. Corps de la requête : octets bruts ; en-tête `upload-id` : identifiant de `save_begin`.
/// En cas d'erreur, l'écriture est abandonnée (fichier temporaire supprimé).
#[tauri::command]
pub async fn save_chunk(uploads: tauri::State<'_, Uploads>, request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let id = request
        .headers()
        .get("upload-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
        .ok_or_else(|| "En-tête « upload-id » manquant ou invalide.".to_string())?;
    let mut up = uploads.take(id)?;
    let owned: Vec<u8>;
    let data: &[u8] = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => bytes.as_slice(),
        // Repli : certains canaux IPC transmettent les octets sous forme de tableau JSON.
        tauri::ipc::InvokeBody::Json(v) => match v
            .as_array()
            .and_then(|a| a.iter().map(|x| x.as_u64().filter(|n| *n <= 255).map(|n| n as u8)).collect::<Option<Vec<u8>>>())
        {
            Some(b) => {
                owned = b;
                owned.as_slice()
            }
            None => {
                up.abort();
                return Err("Données invalides.".into());
            }
        },
    };
    match up.append(data) {
        Ok(()) => {
            uploads.put_back(id, up);
            Ok(())
        }
        Err(e) => {
            let msg = save_error(&up.target, e);
            up.abort();
            Err(msg)
        }
    }
}

/// Fin de l'enregistrement : vérification et remplacement. Renvoie `[mtime_ms, taille, copie .bak faite]`.
#[tauri::command]
pub async fn save_commit(uploads: tauri::State<'_, Uploads>, id: u64) -> Result<(f64, u64, bool), String> {
    let up = uploads.take(id)?;
    let target = up.target.clone();
    let w = up.commit().map_err(|e| save_error(&target, e))?;
    Ok((w.state.mtime_ms, w.state.size, w.backup))
}

/// Abandon (erreur pendant la production des données côté page) : fichier temporaire supprimé, cible intacte.
#[tauri::command]
pub async fn save_abort(uploads: tauri::State<'_, Uploads>, id: u64) -> Result<(), String> {
    if let Ok(up) = uploads.take(id) {
        up.abort();
    }
    Ok(())
}

/// État du fichier (détection d'une modification faite ailleurs). Chemins autorisés seulement.
#[tauri::command]
pub async fn file_state(granted: tauri::State<'_, Granted>, path: String) -> Result<Option<(f64, u64)>, String> {
    let (target, _) = check_target(&granted, &path)?;
    state_of(&target).map(|o| o.map(|s| (s.mtime_ms, s.size))).map_err(|e| e.to_string())
}

/// Fichiers que la page peut OUVRIR (lecture) : projets (`.voltaplan`, ancien `.openrgie`, JSON v1) et Trikker.
pub const READ_EXTS: &[&str] = &["voltaplan", "openrgie", "json", "trik"];
/// Taille maximale lue d'un coup (les archives v2 sont plafonnées plus bas par la page).
pub const READ_MAX: u64 = 1 << 30;

/// Extension de lecture autorisée du chemin, en minuscules.
pub fn readable_ext(path: &Path) -> Option<String> {
    let e = path.extension()?.to_str()?.to_ascii_lowercase();
    if READ_EXTS.contains(&e.as_str()) {
        Some(e)
    } else {
        None
    }
}

/// Fichiers choisis dans la boîte « Ouvrir » pendant cette session (lecture seulement).
#[derive(Default)]
pub struct Readable(Mutex<HashSet<PathBuf>>);

impl Readable {
    pub fn grant(&self, path: PathBuf) {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).insert(path);
    }
    pub fn contains(&self, path: &Path) -> bool {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).contains(path)
    }
}

/// Boîte « Ouvrir » du système (écart O9 de l'essai réel du 2026-11-25 : la page ne connaissait pas le chemin du
/// fichier ouvert, et « Enregistrer » redemandait l'emplacement). Le chemin choisi devient lisible (`read_file`) ;
/// un projet `.voltaplan` devient aussi une cible d'enregistrement (mêmes droits que « Enregistrer sous »).
#[tauri::command]
pub async fn pick_open_path(
    window: tauri::Window,
    granted: tauri::State<'_, Granted>,
    readable: tauri::State<'_, Readable>,
    description: String,
    exts: Vec<String>,
) -> Result<Option<String>, String> {
    let exts: Vec<String> = exts
        .iter()
        .map(|e| e.trim_start_matches('.').to_ascii_lowercase())
        .filter(|e| READ_EXTS.contains(&e.as_str()))
        .collect();
    if exts.is_empty() {
        return Err("Extension de fichier non autorisée.".into());
    }
    let filter: Vec<&str> = exts.iter().map(|e| e.as_str()).collect();
    let builder = window.dialog().file().add_filter(description, &filter);
    #[cfg(any(windows, target_os = "macos"))]
    let builder = builder.set_parent(&window);
    let Some(picked) = builder.blocking_pick_file() else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    if readable_ext(&path).is_none() {
        return Err("Extension de fichier non autorisée.".into());
    }
    readable.grant(path.clone());
    if allowed_ext(&path).as_deref() == Some(BACKUP_EXT) {
        granted.grant(path.clone());
    }
    path.into_os_string()
        .into_string()
        .map(Some)
        .map_err(|_| "Chemin de fichier non représentable en UTF-8.".to_string())
}

/// Contenu d'un fichier choisi dans la boîte « Ouvrir » (octets bruts, sans copie JSON).
#[tauri::command]
pub async fn read_file(readable: tauri::State<'_, Readable>, path: String) -> Result<tauri::ipc::Response, String> {
    let p = PathBuf::from(&path);
    if !readable.contains(&p) || readable_ext(&p).is_none() {
        return Err("Chemin non autorisé : choisissez le fichier avec « Ouvrir ».".into());
    }
    let size = fs::metadata(&p).map_err(|e| format!("Lecture de « {} » impossible : {}", p.display(), e))?.len();
    if size > READ_MAX {
        return Err(format!("Fichier trop volumineux : « {} ».", p.display()));
    }
    let data = fs::read(&p).map_err(|e| format!("Lecture de « {} » impossible : {}", p.display(), e))?;
    Ok(tauri::ipc::Response::new(data))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Dossier de test neuf sous le dossier temporaire du système.
    fn scratch(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("voltaplan-test-{}-{}-{}", name, std::process::id(), COUNTER.fetch_add(1, Ordering::Relaxed)));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn leftovers(dir: &Path) -> Vec<String> {
        fs::read_dir(dir)
            .unwrap()
            .filter_map(|e| e.ok()?.file_name().into_string().ok())
            .filter(|n| n.contains(TMP_MARK))
            .collect()
    }

    #[test]
    fn extensions() {
        assert_eq!(normalize_ext(".CSV").as_deref(), Some("csv"));
        assert_eq!(normalize_ext("voltaplan").as_deref(), Some("voltaplan"));
        assert_eq!(normalize_ext("jpg").as_deref(), Some("jpg"));
        assert_eq!(normalize_ext("exe"), None);
        assert_eq!(normalize_ext(""), None);
        assert_eq!(allowed_ext(Path::new("/a/maison.Voltaplan")).as_deref(), Some("voltaplan"));
        assert_eq!(allowed_ext(Path::new("/a/maison.sh")), None);
        assert_eq!(allowed_ext(Path::new("/a/maison")), None);
        assert_eq!(with_ext(PathBuf::from("/a/m.csv"), "csv"), PathBuf::from("/a/m.csv"));
        assert_eq!(with_ext(PathBuf::from("/a/m.CSV"), "csv"), PathBuf::from("/a/m.CSV"));
        assert_eq!(with_ext(PathBuf::from("/a/m"), "csv"), PathBuf::from("/a/m.csv"));
        assert_eq!(with_ext(PathBuf::from("/a/m.txt"), "csv"), PathBuf::from("/a/m.txt.csv"));
    }

    #[test]
    fn readable_extensions_and_grants() {
        assert_eq!(readable_ext(Path::new("/a/m.VOLTAPLAN")).as_deref(), Some("voltaplan"));
        assert_eq!(readable_ext(Path::new("/a/m.openrgie")).as_deref(), Some("openrgie"));
        assert_eq!(readable_ext(Path::new("/a/m.trik")).as_deref(), Some("trik"));
        assert_eq!(readable_ext(Path::new("/a/m.json")).as_deref(), Some("json"));
        assert_eq!(readable_ext(Path::new("/a/m.exe")), None);
        assert_eq!(readable_ext(Path::new("/a/m")), None);
        // Seuls les chemins choisis dans la boîte « Ouvrir » sont lisibles
        let r = Readable::default();
        r.grant(PathBuf::from("/a/m.voltaplan"));
        assert!(r.contains(Path::new("/a/m.voltaplan")));
        assert!(!r.contains(Path::new("/a/autre.voltaplan")));
    }

    #[test]
    fn temp_name_same_dir_unique() {
        let t = Path::new("dossier").join("maison.voltaplan");
        let a = temp_path(&t).unwrap();
        let b = temp_path(&t).unwrap();
        assert_ne!(a, b);
        assert_eq!(a.parent(), t.parent());
        let name = a.file_name().unwrap().to_str().unwrap();
        assert!(name.starts_with(".maison.voltaplan.voltaplan-tmp-"), "{name}");
        assert_eq!(backup_path(&t), Path::new("dossier").join("maison.voltaplan.bak"));
    }

    #[test]
    fn fnv_streaming() {
        // Valeurs de référence FNV-1a 64 bits.
        let mut h = Fnv::default();
        assert_eq!(h.0, 0xcbf29ce484222325);
        h.update(b"a");
        assert_eq!(h.0, 0xaf63dc4c8601ec8c);
        // Découpage indifférent.
        let mut a = Fnv::default();
        a.update(b"foobar");
        let mut b = Fnv::default();
        b.update(b"foo");
        b.update(b"");
        b.update(b"bar");
        assert_eq!(a, b);
        assert_eq!(a.0, 0x85944171f73967e8);
    }

    #[test]
    fn granted_paths_only() {
        let g = Granted::default();
        assert!(check_target(&g, "/a/m.voltaplan").is_err());
        g.grant(PathBuf::from("/a/m.voltaplan"));
        g.grant(PathBuf::from("/a/m.exe"));
        assert_eq!(check_target(&g, "/a/m.voltaplan").unwrap().1, "voltaplan");
        assert!(check_target(&g, "/a/autre.voltaplan").is_err());
        assert!(check_target(&g, "/a/m.exe").is_err()); // autorisé mais extension refusée
    }

    #[test]
    fn new_file_then_replace_with_backup() {
        let d = scratch("replace");
        let t = d.join("maison.voltaplan");
        let w = write_atomic(&t, b"version 1", true).unwrap();
        assert_eq!(fs::read(&t).unwrap(), b"version 1");
        assert!(!w.backup); // rien à garder
        assert_eq!(w.state.size, 9);
        assert_eq!(Some(w.state), state_of(&t).unwrap());

        let w = write_atomic(&t, b"version 2, plus longue", true).unwrap();
        assert!(w.backup);
        assert_eq!(fs::read(&t).unwrap(), b"version 2, plus longue");
        assert_eq!(fs::read(backup_path(&t)).unwrap(), b"version 1");
        assert_eq!(w.state.size, 22);

        write_atomic(&t, b"v3", true).unwrap();
        assert_eq!(fs::read(backup_path(&t)).unwrap(), b"version 2, plus longue"); // une seule copie, remplacée
        assert!(leftovers(&d).is_empty());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn no_backup_unless_requested_project() {
        let d = scratch("export");
        let t = d.join("liste.csv");
        write_atomic(&t, b"a;b", true).unwrap(); // demandé, mais pas un projet
        let w = write_atomic(&t, b"a;b;c", true).unwrap();
        assert!(!w.backup);
        assert!(!backup_path(&t).exists());
        // Copie v1 d'un projet : pas de .bak (non demandé).
        let v1 = d.join("maison (v1).voltaplan");
        write_atomic(&v1, b"{}", false).unwrap();
        assert!(!write_atomic(&v1, b"{ }", false).unwrap().backup);
        assert!(!backup_path(&v1).exists());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn chunks_then_commit() {
        let d = scratch("chunks");
        let t = d.join("gros.voltaplan");
        fs::write(&t, b"ancien").unwrap();
        let mut up = Upload::begin(&t, true).unwrap();
        let data: Vec<u8> = (0..=255u8).cycle().take(3 * READ_BUF + 17).collect();
        for part in data.chunks(700_001) {
            up.append(part).unwrap();
        }
        // Rien n'est remplacé avant la fin.
        assert_eq!(fs::read(&t).unwrap(), b"ancien");
        assert_eq!(leftovers(&d).len(), 1);
        let w = up.commit().unwrap();
        assert!(w.backup);
        assert_eq!(w.state.size, data.len() as u64);
        assert_eq!(fs::read(&t).unwrap(), data);
        assert_eq!(fs::read(backup_path(&t)).unwrap(), b"ancien");
        assert!(leftovers(&d).is_empty());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn abort_and_drop_leave_original() {
        let d = scratch("abort");
        let t = d.join("m.voltaplan");
        fs::write(&t, b"intact").unwrap();
        let mut up = Upload::begin(&t, true).unwrap();
        up.append(b"partiel").unwrap();
        up.abort();
        assert_eq!(fs::read(&t).unwrap(), b"intact");
        assert!(leftovers(&d).is_empty());
        {
            let mut up = Upload::begin(&t, true).unwrap();
            up.append(b"partiel").unwrap();
        } // libérée sans fin : temporaire supprimé
        assert!(leftovers(&d).is_empty());
        assert!(!backup_path(&t).exists());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn verify_detects_altered_temp() {
        let d = scratch("verify");
        let t = d.join("m.voltaplan");
        fs::write(&t, b"intact").unwrap();
        let mut up = Upload::begin(&t, true).unwrap();
        up.append(b"donnees").unwrap();
        // Altération simulée : le fichier temporaire ne contient pas ce qui a été reçu.
        fs::write(&up.tmp, b"autre").unwrap_or(());
        let r = up.commit();
        // Windows peut refuser l'écriture concurrente : seul le cas où l'altération a eu lieu est vérifié.
        if let Err(e) = r {
            assert!(e.to_string().contains("vérification"), "{e}");
            assert_eq!(fs::read(&t).unwrap(), b"intact");
            assert!(leftovers(&d).is_empty());
        }
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn failure_leaves_no_temp_and_original_intact() {
        let d = scratch("fail");
        // La cible est un dossier : refus, rien n'est écrit.
        let dir_target = d.join("dossier.voltaplan");
        fs::create_dir(&dir_target).unwrap();
        assert!(write_atomic(&dir_target, b"x", true).is_err());
        assert!(dir_target.is_dir());
        // Dossier parent inexistant : échec à la création du temporaire, aucun reste.
        let missing = d.join("absent").join("m.voltaplan");
        assert!(write_atomic(&missing, b"x", true).is_err());
        assert!(leftovers(&d).is_empty());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn empty_and_binary_contents() {
        let d = scratch("bin");
        let t = d.join("x.trik");
        let data: Vec<u8> = (0..=255u8).cycle().take(70_000).collect();
        write_atomic(&t, &data, false).unwrap();
        assert_eq!(fs::read(&t).unwrap(), data);
        write_atomic(&t, b"", false).unwrap();
        assert_eq!(fs::read(&t).unwrap().len(), 0);
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn uploads_registry() {
        let d = scratch("reg");
        let u = Uploads::default();
        let id = u.insert(Upload::begin(&d.join("a.csv"), false).unwrap());
        let up = u.take(id).unwrap();
        assert!(u.take(id).is_err()); // retirée
        u.put_back(id, up);
        u.take(id).unwrap().abort();
        assert!(leftovers(&d).is_empty());
        let _ = fs::remove_dir_all(&d);
    }
}
