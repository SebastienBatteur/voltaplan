// Enregistrement atomique (boîte « Enregistrer » côté Rust, écriture par morceaux dans un fichier temporaire,
// vérification, renommage) : voir src/atomic_save.rs et docs/desktop-tauri.md, section 13.
mod atomic_save;
// Avertissement à la fermeture quand le projet n'est pas enregistré (écart O10) : src/close_guard.rs.
mod close_guard;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(atomic_save::Granted::default())
        .manage(atomic_save::Uploads::default())
        .manage(atomic_save::Readable::default())
        .manage(close_guard::CloseGuard::default())
        .on_window_event(close_guard::on_window_event)
        .invoke_handler(tauri::generate_handler![
            atomic_save::pick_save_path,
            atomic_save::save_begin,
            atomic_save::save_chunk,
            atomic_save::save_commit,
            atomic_save::save_abort,
            atomic_save::file_state,
            atomic_save::pick_open_path,
            atomic_save::read_file,
            close_guard::set_close_warning
        ])
        .run(tauri::generate_context!())
        .expect("erreur au démarrage de Voltaplan");
}
