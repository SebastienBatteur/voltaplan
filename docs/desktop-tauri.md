# Application de bureau (Tauri 2) : état réel

État établi le 24 novembre 2026, sans chaîne Rust locale : toutes les compilations ont eu lieu sur
GitHub Actions. Les faits observés dans les journaux de CI sont donnés tels quels ; ce qui est déduit
du code source de Tauri ou de la documentation est signalé, et ce qui n'a pas pu être confirmé est
marqué « [à vérifier] ».

## 1. Résumé

| Question | Réponse |
|---|---|
| Le code Rust compile-t-il ? | **Oui**, sur Windows, macOS (Apple Silicon et Intel) et Linux. |
| Les paquets se fabriquent-ils ? | **Oui** : `.msi` + `.exe` (NSIS), `.dmg` (arm64 et x64), `.deb` + `.rpm` + `.AppImage`. |
| `release.yml` fonctionnait-il ? | **Non** avant correction : échec sur les 4 plateformes avant toute compilation (script npm `tauri` manquant). Corrigé. |
| L'application a-t-elle été lancée et testée ? | **Non.** Aucun paquet n'a été installé ni ouvert. Rien ne prouve encore que l'enregistrement, l'ouverture ou l'impression fonctionnent dans la fenêtre de bureau. |
| Les paquets sont-ils signés ? | **Non** (ni signature Windows, ni notarisation Apple). Alertes SmartScreen et Gatekeeper attendues. |
| Tests automatiques propres au bureau ? | Depuis l'écriture atomique (section 13, branche `tauri-ecriture-atomique-v2`) : `test/desktopSave.test.ts` (commandes Rust simulées, jsdom) et **12 tests Rust** (`cargo test --locked --lib`) **passés sur Windows, macOS et Linux** en CI. L'application elle-même n'est toujours lancée par aucun test. |
| L'enregistrement atomique fonctionne-t-il dans l'application installée ? | **Non vérifié** : compilé et testé unitairement sur les 3 systèmes, mais aucun paquet installé ni ouvert. Lignes 11 à 15 de la liste de contrôle (section 11) à faire par le propriétaire. |

## 2. Runs de CI

| Run | Workflow, branche | Résultat | Durée par plateforme |
|---|---|---|---|
| [45432055533](https://github.com/SebastienBatteur/voltaplan/actions/runs/45432055533) | `release.yml` (manuel), `main` | **Échec ×4** : `npm error Missing script: "tauri"` (tauri-action exécute `npm run tauri build`) | Windows 1 min 26, Linux 1 min 17, macOS 24 s |
| [45432637161](https://github.com/SebastienBatteur/voltaplan/actions/runs/45432637161) | `desktop-build.yml`, branche de vérification, sans `Cargo.lock` ni cache | **Succès ×3** | macOS arm64 3 min 12 (cargo 2 min 09), Linux 8 min 33 (cargo 5 min 04), Windows 11 min 13 (cargo 8 min 42) |
| [45434976857](https://github.com/SebastienBatteur/voltaplan/actions/runs/45434976857) | `desktop-build.yml`, avec `Cargo.lock`, plugin-fs 2.7.1, droit d'impression, cache Rust | **Succès ×3** ; `cargo metadata --locked` et contrôle des versions Tauri passés | macOS arm64 2 min 28 (cargo 1 min 17), Linux 4 min 54 (cargo 1 min 17), Windows 5 min 30 (cargo 2 min 47) |
| [45435099189](https://github.com/SebastienBatteur/voltaplan/actions/runs/45435099189) | `release.yml` (manuel), branche de vérification | **Succès ×4**, aucune release créée (paquets en artifacts) | Windows 6 min 26, Linux 5 min 27, macOS arm64 3 min 08, macOS x64 3 min 08 |
| [45477165097](https://github.com/SebastienBatteur/voltaplan/actions/runs/45477165097) | `desktop-build.yml` (manuel), `tauri-ecriture-atomique-v2` (écriture atomique, section 13) | **Succès ×3** du premier coup : `tauri build` et `cargo test --locked --lib` (12 tests passés par système), aucun avertissement du compilateur | rustc 1.100.0 ; Windows x64, macOS arm64, Linux x64 |
| [45478957446](https://github.com/SebastienBatteur/voltaplan/actions/runs/45478957446) | `release.yml` (manuel), `tauri-ecriture-atomique-v2` | **Succès ×4** (dont `npm test`), aucune release créée ; paquets en artifacts jusqu'au 24/12/2026 | Windows, Linux, macOS arm64, macOS x64 |

Un lancement **manuel** de `release.yml` ne crée pas de release : `tagName` est vide hors tag, et
tauri-action ne fait alors que construire (vérifié : aucune release dans le dépôt après les deux runs).

### Tailles des paquets (run 45432637161, versions 0.1.0)

| Plateforme | Paquet | Taille |
|---|---|---|
| Windows x64 | `Voltaplan_0.1.0_x64_en-US.msi` | 3,28 Mio |
| Windows x64 | `Voltaplan_0.1.0_x64-setup.exe` (NSIS) | 2,45 Mio |
| macOS arm64 | `Voltaplan.app` / `Voltaplan_0.1.0_aarch64.dmg` | 5,54 Mio / 2,82 Mio |
| macOS x64 | `.dmg` (artifact zippé du run 45435099189) | ≈ 3,0 Mo |
| Linux x64 | `.deb` / `.rpm` | 2,73 Mio / 2,74 Mio |
| Linux x64 | `.AppImage` (embarque WebKitGTK) | 77,65 Mio |

Versions résolues : tauri 2.12.7, tauri-build 2.7.6, wry 0.57.3, tao 0.37.3, tauri-plugin-dialog 2.8.4,
tauri-plugin-fs 2.7.1 ; Rust stable 1.100.0 sur les runners ; Cargo.lock format 4, 437 paquets.

## 3. Compatibilité npm ↔ Rust

### Règle

- Documentation Tauri ([Updating Dependencies](https://v2.tauri.app/develop/updating-dependencies/)) :
  `@tauri-apps/api` et la crate `tauri` doivent avoir la même version mineure ; pour les plugins,
  npm et crate sont publiés ensemble et il faut garder **la même version exacte**.
- Ce que `tauri build` impose réellement (code source `crates/tauri-cli/src/info/plugins.rs`,
  fonction `check_mismatched_packages`) : **erreur** si majeure **ou** mineure diffèrent entre un paquet
  npm `@tauri-apps/plugin-X` (ou `@tauri-apps/api`) et la crate correspondante ; option de
  contournement `--ignore-version-mismatches`. Les correctifs (patch) peuvent différer.
- **Point important (déduit du code source, non observé en échec)** : la version de la crate est lue
  dans `Cargo.lock`, sinon dans `Cargo.toml`. Sans `Cargo.lock`, `Cargo.toml` ne donne que « 2 »,
  qui n'est pas une version semver complète : le paquet est ignoré et **le contrôle ne vérifie rien**.
  C'est pourquoi le premier build est passé malgré plugin-fs npm 2.0.2 face à la crate 2.7.1.

### Matrice

| Paquet npm | Version npm (avant → après) | Crate | Version crate (Cargo.lock) | État |
|---|---|---|---|---|
| `@tauri-apps/api` (transitif ; **direct** depuis l'écriture atomique, pour `invoke`) | 2.12.5 | `tauri` | 2.12.7 | OK (2.12) |
| `@tauri-apps/cli` | 2.12.6 | (outil, pas de crate liée) | — | OK |
| `@tauri-apps/plugin-dialog` | 2.8.4 | `tauri-plugin-dialog` | 2.8.4 | OK (exact) |
| `@tauri-apps/plugin-fs` | **2.0.2 → 2.7.1** | `tauri-plugin-fs` | 2.7.1 | **corrigé** (2.0 ≠ 2.7 : refusé par `tauri build` dès que `Cargo.lock` existe ; risque d'incompatibilité du protocole JS ↔ Rust à l'exécution) |
| — | — | `tauri-build` | 2.7.6 | (pas de paquet npm) |

La mise à jour de plugin-fs reprend la demande Dependabot #15 (même version 2.7.1) : celle-ci peut être
fermée une fois cette branche fusionnée.

## 4. Cargo.lock : décision

**Versionné** (`src-tauri/Cargo.lock`, généré par la CI au run 45432637161, Linux). Raisons :

- Cargo recommande de versionner `Cargo.lock` pour une application (et, depuis 2023, par défaut pour
  tout projet) : [FAQ Cargo](https://doc.rust-lang.org/cargo/faq.html#why-have-cargolock-in-version-control).
- Sans lui, chaque build résout les dernières versions 2.x : deux builds du même commit peuvent
  embarquer des versions différentes de Tauri, et le contrôle npm ↔ crate est muet (section 3).
- Le fichier est indépendant de la plateforme (toutes les cibles y figurent) : le générer sur Linux
  suffit ; Windows et macOS l'ont accepté tel quel avec `--locked`.

`desktop-build.yml` vérifie qu'il est à jour (`cargo metadata --locked`) : un `Cargo.toml` modifié sans
mettre à jour le verrou fait échouer la CI au lieu de le réécrire en silence.

Sans Rust local, la mise à jour du verrou se fait par Dependabot (demandes « cargo ») ou en relançant
`desktop-build.yml` et en reprenant l'artifact `cargo-lock`.

## 5. Reproductibilité

| Élément | Figé ? |
|---|---|
| Dépendances npm | Oui (`package-lock.json`, versions exactes, `npm ci`) |
| Crates Rust | **Oui depuis cette branche** (`Cargo.lock` + `--locked` vérifié en CI) |
| Compilateur Rust | Non : `dtolnay/rust-toolchain@stable` prend la dernière stable. Option : `rust-toolchain.toml` avec une version fixe (au prix d'une mise à jour manuelle) |
| Images des runners | Non (`windows-latest`, `macos-latest`) ; seul Linux est figé (`ubuntu-22.04`) |
| Outils de paquet | Non : l'AppImage télécharge `linuxdeploy` « continuous » au moment du build ; WiX et NSIS sont téléchargés par la CLI Tauri |
| Actions GitHub | Par étiquette majeure (`@v4`, `@v0`, `@v2`), pas par empreinte |

Les paquets ne sont donc **pas reproductibles bit à bit**, mais les versions de code (JS et Rust) le sont.
Avertissement CI à suivre : les actions en Node.js 20 sont désormais forcées en Node.js 24 par GitHub.

## 6. Tests disponibles par plateforme

Aucun test automatique ne lance l'application de bureau. Ce qui existe ou pourrait exister :

| Niveau | Windows | Linux | macOS |
|---|---|---|---|
| Compilation + paquets (`desktop-build.yml`) | oui | oui | oui (arm64 ; x64 seulement via `release.yml`) |
| Tests unitaires Vitest (jsdom, chemin web) | oui | oui | oui |
| Bout en bout WebDriver (`tauri-driver`) | possible | possible | **non** avec `tauri-driver` seul (pas de pilote WKWebView) ; la [documentation](https://v2.tauri.app/develop/tests/webdriver/) renvoie au service WebdriverIO [à vérifier] |
| Simulation des API Tauri en test unitaire | **fait** pour l'enregistrement (`test/desktopSave.test.ts`, `invoke` simulé) | idem | idem |
| Tests Rust (`cargo test --locked --lib`, `desktop-build.yml`) | oui | oui | oui (arm64) |

Recommandation : une **liste de contrôle manuelle** avant chaque release (section 9), plutôt qu'un
banc WebDriver dont le coût dépasse aujourd'hui le bénéfice.

## 7. Cohérence du code de bureau

`src/io/files.ts` (branche `isDesktop`, détectée par `__TAURI_INTERNALS__`) :

| Fonction | Appel Tauri | Droit nécessaire | Présent dans `capabilities/default.json` |
|---|---|---|---|
| `desktopSavePath` (`desktopPickPath`, `src/io/desktopSave.ts`) | commande de l'application `pick_save_path` (boîte du plugin dialog, ouverte côté Rust) | aucun (commandes de l'application, section 13) | — |
| `saveProject`, `download` (exports, copie v1, image du tableau) | commandes `save_begin`, `save_chunk`, `save_commit`, `save_abort` (écriture atomique, section 13) | idem | — |
| `pathState` (détection de conflit) | commande `file_state` | idem | — |
| Ouverture | `<input type="file">` (pas d'API Tauri) | aucun | — |
| Impression du dossier (`src/print/PrintDialog.tsx`) | `window.print()` → sur macOS, commande `plugin:webview\|print` | `core:webview:allow-print` | **ajouté** (absent de `core:default`) |

- Écriture (depuis l'écriture atomique, section 13) : la page n'a plus aucun droit `dialog` ni `fs` ;
  `dialog:allow-save`, `fs:allow-write-text-file`, `fs:allow-write-file` et `fs:allow-stat` ont été retirés de
  `capabilities/default.json`. Les commandes Rust n'écrivent qu'aux chemins choisis dans la boîte ouverte côté
  Rust pendant la session (liste en mémoire, perdue au redémarrage, cohérent avec `currentPath` remis à zéro).
  Le plugin fs reste enregistré (crate inchangée, `Cargo.lock` intact) mais n'est plus utilisé par la page.
- Droits minimaux : pas de lecture fs, pas de `dialog:allow-open`, pas de shell : bien.
- Le nom de droit `core:webview:allow-print` a été validé par la compilation (Tauri vérifie les noms
  de droits au build).

## 8. Risques ouverts

### Impression sur macOS (dossier PDF)

Faits établis :

- Tauri remplace `window.print` **uniquement sur macOS** par un appel à la commande native
  `plugin:webview|print` (code source `crates/tauri/src/webview/plugin.rs` et `scripts/print.js` :
  « window.print works on Linux/Windows; need to use the API on macOS »). Sur Windows (WebView2) et
  Linux (WebKitGTK), le `window.print()` du moteur est utilisé tel quel.
- Cette commande exige `core:webview:allow-print`, qui **n'est pas** dans `core:webview:default`.
  Sans ce droit, l'appel était refusé : sur macOS, « Imprimer » n'aurait rien fait (promesse rejetée,
  sans message). **Corrigé dans `capabilities/default.json`** (non testé sur une vraie machine).
- L'impression native WKWebView exige macOS 11 ou plus récent (tauri#3066).
- Historique de marges et d'options de dialogue différentes de Safari (wry#713, fermé ; wry#1259 met
  les marges par défaut à 0, fusionné en 2024) ; tauri#6202 (réglages manquants dans la boîte
  d'impression) reste ouvert.

Points incertains :

- `window.print()` devient asynchrone sur macOS (il renvoie la promesse de `invoke`) : l'événement
  `afterprint`, dont dépend `PrintDialog.tsx` pour sortir du mode impression, n'est peut-être pas émis
  [à vérifier]. Effet possible : l'aperçu reste affiché après l'impression.
- La règle `@page { size: A4 landscape; margin: 0 }` injectée par `PrintDialog.tsx` pourrait ne pas
  être reprise par `NSPrintOperation` (orientation, format) [à vérifier].
- Rapports récents non résolus de `window.print` inopérant sur macOS 15 (tauri#13929, sans
  reproduction) [à vérifier].

À tester en priorité sur un Mac réel. Solution de repli si l'impression reste défaillante : générer le
PDF côté application (bibliothèque PDF en JS) et l'enregistrer via `download()`, indépendamment du
moteur d'impression.

### Signature et notarisation (coûts à vérifier)

- **macOS** : sans compte Apple Developer et notarisation, Gatekeeper bloque l'ouverture d'un `.dmg`
  téléchargé (contournement manuel par « Ouvrir » dans Réglages > Confidentialité). Programme Apple
  Developer : environ 99 USD/an [à vérifier]. tauri-action sait signer et notariser avec les secrets
  `APPLE_CERTIFICATE`, `APPLE_ID`, etc.
- **Windows** : sans signature, SmartScreen affiche « Windows a protégé votre ordinateur ».
  - Azure Artifact Signing (ex-Trusted Signing) : environ 9,99 USD/mois [à vérifier], mais l'accès
    des **particuliers** semble limité aux États-Unis et au Canada ; en Europe, il faudrait une
    organisation [à vérifier].
  - Certificat OV classique (clé sur matériel ou HSM en nuage) : de l'ordre de 200 à 500 €/an [à vérifier] ;
    la réputation SmartScreen s'acquiert progressivement.
- **Linux** : pas de signature requise ; les `.deb`/`.rpm` ne sont pas signés (acceptable hors dépôt).

### Autres

- Aucune mise à jour automatique (plugin updater non installé) : chaque version se télécharge à la main.
- L'AppImage pèse 78 Mio (WebKitGTK embarqué) ; `.deb`/`.rpm` restent à ~2,7 Mio mais dépendent de
  `libwebkit2gtk-4.1` sur la machine.
- Paquet Linux construit sur Ubuntu 22.04 : glibc 2.35 minimale [à vérifier].
- Seul un build Windows x64 est produit (pas d'ARM64).

## 9. Charge de maintenance estimée

| Tâche | Fréquence | Effort |
|---|---|---|
| Fusionner les demandes Dependabot « tauri » npm **et** cargo ensemble (sinon `tauri build` échoue sur la différence de version) | ~1 à 2 fois par mois | 10 min |
| Lire le résultat de `desktop-build.yml` sur ces demandes | idem | 5 min |
| Liste de contrôle manuelle avant release, par OS : installer, créer, enregistrer, rouvrir, exporter, imprimer le dossier | par release | 20 à 30 min par OS (un Mac est nécessaire) |
| Mise à jour majeure Tauri (3.x) | rare, non annoncée [à vérifier] | une à plusieurs journées |
| Signature (si adoptée) : renouvellement des certificats et des secrets | annuel | 1 à 2 h |

Coût CI : ~13 minutes de runner par build complet avec cache (≈ 30 sans), dont macOS
compté ×10 par GitHub pour un dépôt privé [à vérifier] ; gratuit pour un dépôt public.

## 10. Recommandations

1. **Fusionner cette branche** (script `tauri`, `Cargo.lock`, plugin-fs 2.7.1, droit d'impression,
   `desktop-build.yml`, groupes Dependabot), puis fermer la demande Dependabot #15.
2. **Tester l'application installée sur un Mac et un PC Windows** avant d'annoncer la version de
   bureau : enregistrement, réenregistrement au même chemin, export, impression du dossier (format A4
   paysage, retour à l'éditeur après impression).
3. Ne publier les paquets qu'en **version préliminaire** tant qu'ils ne sont pas signés, avec
   l'explication des alertes SmartScreen/Gatekeeper dans le README.
4. Fusionner les demandes Dependabot Tauri npm et cargo **ensemble** (Dependabot ne regroupe pas
   deux écosystèmes dans une même demande [à vérifier]) ; `desktop-build.yml` signale tout écart.
5. Plus tard : figer la version de Rust (`rust-toolchain.toml`), ajouter des tests unitaires de la
   branche bureau de `src/io/files.ts` avec `@tauri-apps/api/mocks`, décider de la signature selon
   l'usage réel.

## 11. Procédure : télécharger, installer, tester (sans compétence technique)

### Les cinq niveaux de validation (à ne pas confondre)

| Niveau | Ce que cela prouve | Comment c'est établi | État au 2026-11-24 |
|---|---|---|---|
| 1. **Compilation réussie** | le code Rust et le site se construisent | CI `desktop-build.yml` | **atteint** : Windows x64, macOS arm64, Linux |
| 2. **Paquet créé** | un installateur existe | CI `release.yml` manuel (artifacts) | **atteint** : `.msi`, `.exe`, `.dmg` (arm64 et x64), `.deb`, `.rpm`, `.AppImage` |
| 3. **Installation réussie** | l'installateur s'exécute jusqu'au bout sur un vrai système | une personne, sur une vraie machine | **non testé** |
| 4. **Démarrage réussi** | la fenêtre s'ouvre et affiche l'éditeur | idem | **non testé** |
| 5. **Fonctions testées** | chaque fonction listée ci-dessous marche dans l'application installée | idem, liste de contrôle | **non testé** |

**Une compilation réussie ne valide aucune fonction.**

### Récupérer les paquets

1. Sur GitHub : onglet **Actions** → workflow **Release** → **Run workflow** (branche `main`). Le lancement manuel
   ne crée **pas** de release publique.
2. Attendre la fin (environ 5 à 10 min), ouvrir le run, puis la section **Artifacts** : télécharger le paquet de
   son système (`windows`, `macos-arm64` pour Apple Silicon, `macos-x64` pour Intel, `linux`).
3. Décompresser le `.zip` téléchargé.

### Installer (paquets non signés)

| Système | Fichier | Alerte attendue | Comment passer |
|---|---|---|---|
| Windows 10/11 | `Voltaplan_x.y.z_x64-setup.exe` (ou `.msi`) | « Windows a protégé votre ordinateur » (SmartScreen) | « Informations complémentaires » → « Exécuter quand même » |
| macOS 13 et 14 | `.dmg` → glisser Voltaplan dans Applications | « Voltaplan ne peut pas être ouvert car le développeur ne peut pas être vérifié » | clic droit sur l'app → Ouvrir → Ouvrir |
| macOS 15 et plus | idem | idem, et le clic droit ne suffit plus **[à vérifier]** | Réglages Système → Confidentialité et sécurité → « Ouvrir quand même » |
| macOS (Apple Silicon) | idem | possible « Voltaplan est endommagé » sur une app non signée téléchargée **[à vérifier]** | Terminal : `xattr -cr /Applications/Voltaplan.app` (à documenter seulement si le cas se produit) |
| Linux Debian/Ubuntu | `.deb` | aucune | `sudo apt install ./Voltaplan_x.y.z_amd64.deb` |
| Linux, autres | `.AppImage` | aucune | rendre exécutable (propriétés du fichier), puis double-clic |

### Liste de contrôle (niveau 5) — à cocher par système

| # | Test | Windows | macOS | Linux |
|---|---|---|---|---|
| 1 | L'application démarre ; l'éditeur s'affiche | ☐ | ☐ | ☐ |
| 2 | Nouveau projet, ajouter un circuit, Enregistrer : boîte « Enregistrer » du système, fichier créé | ☐ | ☐ | ☐ |
| 3 | Modifier, Ctrl+S : même fichier réécrit, sans boîte de dialogue | ☐ | ☐ | ☐ |
| 4 | Modifier le fichier ailleurs (copier un autre `.voltaplan` par-dessus), puis Ctrl+S dans l'app : message « modifié ailleurs », choix copie / remplacer | ☐ | ☐ | ☐ |
| 5 | Ouvrir un `.voltaplan` et un `.trik` | ☐ | ☐ | ☐ |
| 6 | Exporter Trikker et Eendraadschema : fichiers créés | ☐ | ☐ | ☐ |
| 7 | Imprimer le dossier : aperçu, A4 paysage, impression ou PDF, **retour à l'éditeur après impression** | ☐ | ☐ (risque connu) | ☐ |
| 8 | Fond de plan depuis un PDF | ☐ | ☐ | ☐ |
| 9 | IA (si clé disponible) : lecture d'une photo de tableau | ☐ | ☐ | ☐ |
| 10 | Fermer avec des modifications : avertissement ; rouvrir : brouillon proposé | ☐ | ☐ | ☐ |
| 11 | Enregistrer deux fois un projet : `<nom>.voltaplan.bak` contient la version précédente ; aucun fichier `.…voltaplan-tmp-…` ne reste dans le dossier | ☐ | ☐ | ☐ |
| 12 | Enregistrer sur une clé USB presque pleine : message d'erreur, l'ancien fichier reste lisible | ☐ | ☐ | ☐ |
| 13 | Windows : fichier verrouillé par un autre logiciel (ou dossier OneDrive en synchronisation) : message d'erreur clair, ancien fichier intact | ☐ | — | — |
| 14 | Gros projet (plusieurs photos, archive de plus de 100 Mo) : enregistrement sans blocage de la fenêtre ni saturation de la mémoire ; le fichier se rouvre | ☐ | ☐ | ☐ |
| 15 | Exports : nomenclature CSV, image du tableau pour l'IA (`.jpg`), copie v1 (`… (v1).voltaplan`, sans `.bak`) | ☐ | ☐ | ☐ |

Noter pour chaque échec : système et version, étape, message affiché, capture d'écran.

## 12. Distribution sans coût récurrent important

| Canal | Coût | Limite |
|---|---|---|
| **GitHub Releases** (paquets joints à une release) | gratuit | alertes SmartScreen et Gatekeeper sans signature |
| **SignPath Foundation** : certificat de signature Windows offert aux projets open source | gratuit **[à vérifier : conditions d'éligibilité, dépôt public exigé]** | signature Windows seulement ; procédure de validation du projet |
| Microsoft Store (développeur individuel) | inscription gratuite pour les particuliers depuis 2025 **[à vérifier]** | revue du Store ; paquet MSIX à produire |
| winget (`winget install Voltaplan`) | gratuit (manifest dans le dépôt communautaire) | n'enlève pas SmartScreen si l'installateur n'est pas signé |
| Homebrew Cask (macOS) | gratuit | les casks non signés sont de moins en moins acceptés **[à vérifier]** |
| Flathub (Linux) | gratuit | empaquetage Flatpak à maintenir |
| Apple Developer Program | environ 99 USD/an **[à vérifier]** | seule voie pour un macOS sans alerte ; aucune alternative gratuite connue |

**Recommandation** : GitHub Releases en **version préliminaire**, avec la procédure d'installation ci-dessus. Il
faut ensuite :

- **demander SignPath Foundation** dès que le dépôt est public (Windows signé gratuitement) ;
- **reporter la signature macOS** jusqu'à ce que la demande des utilisateurs de Mac la justifie. D'ici là, la PWA
  dans Safari ou Chrome reste l'alternative sans alerte.

## 13. Écriture atomique (enregistrement sur l'appareil)

### État

| | Windows x64 | macOS arm64 | Linux x64 |
|---|---|---|---|
| Compilation (`tauri build`, paquets) | **oui** | **oui** | **oui** |
| `cargo test --locked --lib` (12 tests de `atomic_save.rs`) | **12/12** | **12/12** | **12/12** |
| Run | [45477165097, job Windows](https://github.com/SebastienBatteur/voltaplan/actions/runs/45477165097/job/138740406329) | [job macOS](https://github.com/SebastienBatteur/voltaplan/actions/runs/45477165097/job/138740406211) | [job Linux](https://github.com/SebastienBatteur/voltaplan/actions/runs/45477165097/job/138740406403) |
| Installation et essai réels (niveaux 3 à 5, section 11) | **non testé** | **non testé** | **non testé** |

Branche `tauri-ecriture-atomique-v2` (portage sur le format v2 de la première version, branche
`tauri-ecriture-atomique`, commit af707d7, jamais compilée). rustc 1.100.0, tauri 2.12.7,
tauri-plugin-dialog 2.8.4 ; `Cargo.lock` inchangé (aucune nouvelle crate). Compilé du premier coup, sans
avertissement. macOS x64 : seulement construit par `release.yml` (pas de `cargo test` sur Intel).

**Paquets à essayer** : artifacts du run `release.yml`
[45478957446](https://github.com/SebastienBatteur/voltaplan/actions/runs/45478957446) (`voltaplan-windows`,
`voltaplan-macos-arm64`, `voltaplan-macos-x64`, `voltaplan-linux` ; conservés jusqu'au 24/12/2026 ; aucune
release créée).

### Essai réel sous Windows (propriétaire, 2026-11-25)

Paquet : artifact `voltaplan-desktop-windows` du run `desktop-build.yml`
[45614201351](https://github.com/SebastienBatteur/voltaplan/actions/runs/45614201351) (commit 7d4c9e6 ; 12 tests
Rust passés). Windows 11, dossier de test **synchronisé par OneDrive** (cas difficile sous Windows). Fichiers
vérifiés par Claude (lecture seule : tailles, heures, archives ZIP relues).

| # | Essai | Résultat |
|---|---|---|
| 3-4 (niveaux) | Installation, démarrage | ✅ (alerte SmartScreen attendue) |
| 1 | L'éditeur s'affiche | ✅ |
| 2 | Enregistrer : boîte de Windows, fichier créé | ✅ |
| 3 | Ctrl+S : même fichier, sans boîte | ✅ |
| 11 | `.bak` = version précédente ; aucun fichier `…voltaplan-tmp-…` (fichiers cachés compris) | ✅ deux archives ZIP valides |
| 4 | Fichier modifié ailleurs (simulé par Claude), Ctrl+S | ✅ message « modifié ailleurs » ; copie « … (conflit …).voltaplan » créée ; fichier modifié ailleurs intact |
| 13 | Fichier verrouillé en exclusivité 2 min (simulé par Claude), Ctrl+S | ✅ données : erreur, fichier intact (ZIP valide), temporaire supprimé. ❌ message (O7) |
| 15 | Copie v1 ; nomenclature CSV | ✅ « … (v1).voltaplan » (JSON v1, sans `.bak`) ; CSV créé |
| 5 | Ouvrir un `.voltaplan` | ✅ ouvert ; ⚠ O9 |
| 10 | Fermer avec des modifications, rouvrir | ✅ brouillon proposé à la réouverture ; ❌ aucun avertissement à la fermeture (O10) |
| 6, 7, 8, 9, 12, 14 | Exports Trikker/EDS, impression, PDF, IA, clé pleine, gros projet | non faits |

Écarts :
- **O7** : fichier verrouillé : message « **ZIP corrupt** (Enregistrement de « … » impossible : Access is denied.
  (os error 5)) ». « ZIP corrupt » est faux et inquiétant (rien n'est corrompu) ; cause système en anglais. À
  remplacer par un message clair (« fichier utilisé par un autre logiciel ou en synchronisation ; votre version est
  gardée ; réessayez »).
- **O9** : après **Ouvrir** (sélecteur de la page, sans chemin), le premier Ctrl+S ouvre « Enregistrer sous » au
  lieu de réécrire le fichier ouvert. Vaut aussi pour `main`. Correction : ouvrir par une boîte de Windows côté Rust
  (comme `pick_save_path`), pour connaître le chemin.
- **O10** : fermeture de la fenêtre avec des modifications non enregistrées : **aucun avertissement** (l'évènement
  `beforeunload` de la page n'est pas affiché par la fenêtre Tauri). Rien n'est perdu (brouillon), mais
  l'avertissement promis manque. Correction : intercepter la fermeture côté Tauri (`onCloseRequested`).
- **O6** (vaut aussi pour `main`) : le message « Import terminé » se superpose à la boîte de conflit et en cache un
  bouton.
- **O8** (amélioration) : aucune confirmation après « Exporter au format v1… ».

**Suite (même jour)** : branche rebasée sur `main` puis fusionnée (befba5e) avec les corrections de **O7**
(`DesktopSaveError` : message « fichier utilisé, verrouillé ou en cours de synchronisation ; original intact »,
disque plein traité comme dans le navigateur), **O9** (commandes `pick_open_path` et `read_file` : boîte « Ouvrir »
côté Rust, le chemin d'un `.voltaplan` ouvert devient la cible d'« Enregistrer », avec détection de conflit) et
**O10** (`onCloseRequested`, droit `core:window:allow-destroy`). Compilé et testé sur les 3 systèmes
([45627990727](https://github.com/SebastienBatteur/voltaplan/actions/runs/45627990727), 13 tests Rust).
**À revérifier dans l'application installée** (paquet de ce run). O6 et O8 restent à faire.

**Revérification dans l'application installée (2026-11-25, 17:45, paquet du run 45627990727)** :
- **O9 ✅** : Fichier → Ouvrir… ouvre la boîte de Windows ; après une modification, Ctrl+S réécrit
  `Nouveau projet.voltaplan` sans boîte « Enregistrer sous ».
- **O7 ✅** : fichier verrouillé 2 min (PowerShell, partage `None`) : « Enregistrement de « Nouveau projet.voltaplan »
  impossible : le fichier est utilisé par un autre logiciel, verrouillé ou en cours de synchronisation. Le fichier
  d'origine est intact et votre version est gardée… » ; état « Erreur d'enregistrement ». Remarque : ce message et le
  message bleu « appareil(s) en réserve » s'affichent côte à côte (même famille que O6).
- **O10 ❌** : la fenêtre s'est fermée sans rien demander, avec des modifications non enregistrées.
  L'interception côté page (`onCloseRequested` + `window.confirm`) ne suffit pas dans l'application installée.
  **Correction** (branche `bureau-fermeture-o10`) : fermeture interceptée **côté Rust**
  (`src-tauri/src/close_guard.rs`, `on_window_event`) ; la page transmet l'état du projet et le texte traduit
  (`set_close_warning`) ; boîte du système « Fermer sans enregistrer » / « Annuler », une seule à la fois. Le droit
  `core:window:allow-destroy` n'est plus donné à la page. À revérifier dans l'application installée.

**Conclusion** : l'écriture atomique tient ses promesses sous Windows, y compris dans un dossier OneDrive et avec un
fichier verrouillé ; aucune perte, aucun fichier temporaire laissé. Les écarts portent sur les messages et sur
l'ouverture / la fermeture, pas sur l'écriture.

**Reste à faire (propriétaire)** : installer ces paquets et dérouler la procédure de la section 11,
lignes 2 à 6 et 11 à 15 de la liste de contrôle, sur chaque système. Tant que ce n'est pas fait, rien ne prouve
que les commandes sont bien appelées depuis la page dans l'application installée.

### Problème

Avant : `writeFile(path, …)` (plugin fs) ouvrait le fichier choisi en le **tronquant**, puis écrivait. Un
plantage, une coupure de courant ou un disque plein pendant l'écriture laissait un projet vide ou tronqué,
illisible. De plus, l'archive v2 était d'abord assemblée entière en mémoire (`Blob`), puis copiée en
`Uint8Array` et transmise d'un bloc : pour un projet de plusieurs centaines de Mo (photos), plusieurs copies
complètes en mémoire. (Dans Chrome et Edge, `createWritable()` écrit déjà dans un fichier temporaire : le
chemin navigateur n'est pas concerné et reste inchangé.)

### Conception

Commandes Rust (`src-tauri/src/atomic_save.rs`), appelées par `src/io/desktopSave.ts`, lui-même utilisé par
les seules branches bureau de `saveProject`, `download` et `pathState` (`src/io/files.ts`) :

1. `save_begin(path, backup)` : fichier temporaire dans le **même dossier** :
   `.<nom>.voltaplan-tmp-<pid>-<horodatage>-<compteur>`, créé avec `create_new` (jamais un fichier ou un lien
   existant) ; renvoie un identifiant d'écriture ;
2. `save_chunk` (corps brut de la requête IPC, en-tête `upload-id`) : ajout d'un morceau à la fin du
   fichier temporaire ; empreinte FNV-1a 64 bits et longueur des octets reçus mises à jour au fil de l'eau ;
3. `save_commit(id)` : `sync_all()`, fermeture, puis **vérification** : relecture complète du fichier
   temporaire, longueur et empreinte comparées à celles des octets reçus ;
4. projets (`.voltaplan`, et seulement si la page le demande : enregistrement du projet, pas la copie v1) :
   **copie de la version précédente** en `<nom>.voltaplan.bak` (une seule copie, remplacée à chaque
   enregistrement ; copie et non renommage : la cible existe à tout instant ; un échec de la copie n'empêche
   pas l'enregistrement) ;
5. **remplacement** par `std::fs::rename(temporaire, cible)` (Windows : 3 nouvelles tentatives espacées) ;
6. Unix : `fsync` du dossier parent (au mieux) pour rendre le renommage durable ;
7. renvoie `[date de modification en ms, taille, copie faite]` : `lastWritten` est mis à jour sans second appel ;
8. en cas d'erreur à n'importe quelle étape (morceau, vérification, renommage) : suppression du fichier
   temporaire, cible intacte, message « Enregistrement de « … » impossible : <cause> » renvoyé à la page
   (`Error` en JS). `save_abort(id)` fait de même quand l'erreur vient de la page (document illisible pendant
   l'assemblage de l'archive). Une écriture jamais terminée est libérée (et son temporaire supprimé) au plus
   tard à la fermeture de l'application.

Côté page, `saveProject` passe à `serializeProject` un `WritableStream` (`desktopWritable`) : zip.js y écrit
l'archive en flux, regroupée en morceaux de **4 Mo** (`CHUNK_SIZE`). `download` lit le `Blob` par tranches de
4 Mo (`desktopWriteBlob`). Ni la page ni Rust ne gardent l'archive entière en mémoire ; chaque requête IPC est
bornée. Les morceaux sont envoyés l'un après l'autre (ordre garanti). Le canal IPC de Tauri 2 transmet un
`Uint8Array` en corps brut (`InvokeBody::Raw`) sur Windows, macOS et Linux ; un repli accepte un tableau JSON
d'octets (canal `postMessage`), raisonnable avec des morceaux de 4 Mo.

Pourquoi une empreinte plutôt qu'une comparaison octet par octet (première version) : les données ne sont plus
gardées en mémoire. FNV-1a 64 bits détecte une écriture incomplète ou altérée (probabilité d'erreur non détectée
de l'ordre de 2⁻⁶⁴), pas une modification malveillante, hors du modèle de menace.

Unix : les droits de l'ancien fichier sont recopiés sur le nouveau. Lien symbolique : le fichier pointé est
remplacé (le lien est gardé). La détection de conflit est inchangée (`changedSince(lastWritten, await
pathState(path))`, `ConflictError`) ; `pathState` passe par la commande `file_state`.

### Chemins d'écriture du bureau et extensions autorisées

| Appelant | Fichier | Extension | Copie `.bak` |
|---|---|---|---|
| `saveProject` (Enregistrer, Ctrl+S) | archive v2 | `.voltaplan` | oui |
| `exportProjectV1` → `download` | copie v1 « … (v1).voltaplan » | `.voltaplan` | non |
| `StorageDialog` → `download` | export Trikker | `.trik` | non |
| `StorageDialog` → `download` | export Eendraadschema | `.eds` | non |
| `BomPanel` → `download` | nomenclature | `.csv` | non |
| `BoardView` (image envoyée à l'IA) → `download` | image du tableau | `.jpg` | non |

`ALLOWED_EXTS` = `voltaplan`, `trik`, `eds`, `csv`, `jpg` (la première version oubliait `.jpg` : l'export de
l'image du tableau aurait été refusé). Toute nouvelle extension écrite par `download()` doit y être ajoutée.

Non concernés :

- **Impression / PDF** : `window.print()` (boîte du système), aucune écriture par l'application.
- **Dossier de projet** (`src/io/directoryBackend.ts`, `showDirectoryPicker`) : n'utilise pas ces commandes.
  L'option n'est proposée que si la vue web expose `showDirectoryPicker` : probablement sous Windows (WebView2,
  Chromium, où `createWritable()` écrit déjà via un fichier temporaire) [à vérifier dans l'application
  installée], pas sous macOS (WKWebView) ni Linux (WebKitGTK). Non pris en charge par l'écriture atomique.
- Brouillons, stockage de travail : IndexedDB de la vue web.

### Modèle de sécurité

Le plugin fs ne peut pas écrire de fichier temporaire à côté du fichier choisi (sa portée se limite au
chemin choisi) : l'écriture passe donc par des commandes de l'application. Pour qu'une page compromise (XSS)
ne puisse pas écrire n'importe où :

- la boîte « Enregistrer » est ouverte **côté Rust** (`pick_save_path`, API Rust du plugin dialog) ; le chemin
  choisi est ajouté à une liste en mémoire (`Mutex<HashSet<PathBuf>>`, état géré par Tauri) ;
- `save_begin` et `file_state` refusent tout chemin absent de cette liste (comparaison exacte) et toute
  extension hors de la liste ci-dessus ; `save_chunk`, `save_commit` et `save_abort` n'agissent que sur une
  écriture ouverte par `save_begin` ; `pick_save_path` ajoute l'extension attendue si le nom choisi ne l'a pas
  (« maison.txt » devient « maison.txt.csv ») ;
- la page n'a plus aucun droit `dialog` ni `fs` (`capabilities/default.json` : `core:default`,
  `core:webview:allow-print`).

Droits des commandes de l'application : **aucune entrée de capability n'est nécessaire**. Vérifié dans le code
de tauri 2.12.7 (`crates/tauri/src/webview/mod.rs`) : le contrôle des droits ne s'applique à une commande que
si c'est une commande de plugin, si l'application déclare un manifeste (`tauri_build::Attributes::app_manifest`
dans `build.rs`, absent ici) ou si l'origine n'est pas locale. L'application n'a qu'une fenêtre et ne charge
aucune page distante. Si un manifeste d'application est ajouté un jour, il faudra déclarer les commandes
(`AppManifest::commands`) et ajouter `allow-pick-save-path`, `allow-save-begin`, `allow-save-chunk`,
`allow-save-commit`, `allow-save-abort`, `allow-file-state` à la capability.

Alternative écartée : remplir la liste autorisée quand la boîte JS (`save()` du plugin) renvoie un chemin.
Une page compromise pourrait alors appeler elle-même la commande d'ajout avec un chemin arbitraire.

Limites : une page compromise peut toujours **ouvrir** la boîte, mais l'utilisateur doit y choisir le chemin ;
elle peut réécrire un fichier déjà choisi pendant la session (comme avant) ; elle peut ouvrir de nombreuses
écritures sans les terminer (fichiers temporaires dans les dossiers déjà choisis, supprimés à la fermeture).

### Garanties et limites par plateforme

| | Linux | macOS | Windows |
|---|---|---|---|
| `sync_all()` | `fsync` | `fcntl(F_FULLFSYNC)` | `FlushFileBuffers` |
| Renommage | `rename(2)` : atomique (POSIX) | `rename(2)` : atomique (APFS, HFS+) | `std::fs::rename` (`SetFileInformationByHandle`/`MoveFileExW`, remplacement) [d'après la bibliothèque standard] |
| Durabilité du renommage | `fsync` du dossier | `fsync` du dossier (au mieux) | journal NTFS ; pas d'équivalent à `fsync` d'un dossier |
| Atomicité | garantie par POSIX | garantie par POSIX | **pratique, non garantie par Microsoft** |

Limites communes :

- Windows : le remplacement **échoue** si un autre logiciel tient le fichier ouvert sans partage de
  suppression (antivirus, client de synchronisation, Excel) ou si la cible est en lecture seule ; les nouvelles
  tentatives (0,1 s, 0,2 s, 0,3 s) couvrent les verrous brefs, sinon erreur et ancien fichier intact.
- Lecteurs réseau, clés FAT32/exFAT, dossiers synchronisés (OneDrive, Dropbox) : atomicité et durabilité selon
  le système de fichiers [non vérifié].
- La relecture passe en général par le cache du système : elle détecte une écriture incomplète ou un disque
  plein, pas une panne du support.
- Le remplacement crée un nouveau fichier : liens physiques, ACL Windows propres au fichier et attributs
  étendus ne sont pas recopiés [à vérifier sur Windows].
- Disque plein : un enregistrement demande temporairement deux fois la taille du projet (plus la copie `.bak`).
- Les commandes sont `async` mais font des entrées-sorties bloquantes sur le fil d'exécution asynchrone de
  Tauri : la fenêtre ne se fige pas ; la relecture d'une archive de plusieurs centaines de Mo prend quelques
  secondes [durée non mesurée].

### Reprise après interruption

Un arrêt brutal pendant l'écriture laisse au pire un fichier `.<nom>.voltaplan-tmp-…` dans le dossier, à côté
de l'ancien fichier intact. **Ces restes ne sont pas supprimés au démarrage suivant** (choix prudent : aucune
suppression sur le disque de l'utilisateur hors des cas d'erreur traités immédiatement) ; on peut les effacer à
la main. Le brouillon du navigateur, écrit avant chaque enregistrement, et `<nom>.voltaplan.bak` restent des
protections complémentaires.

### Tests

- JS (`test/desktopSave.test.ts`, jsdom, commandes simulées) : boîte puis `save_begin`/`save_chunk`/
  `save_commit`, archive reçue relisible (format v2), conflit (`ConflictError`, rien n'est écrit), `force`,
  erreurs Rust (au début, sur un morceau, au remplacement) transformées en `Error`, `lastWritten` repris de la
  réponse, annulation, exports et copie v1 sans `.bak`, gros fichier découpé en morceaux de 4 Mo et
  reconstitué à l'identique, abandon d'un flux verrouillé (`save_abort`).
- Rust (`#[cfg(test)]` dans `atomic_save.rs`, 12 tests, CI sur les 3 systèmes) : extensions, nom du fichier
  temporaire, empreinte FNV (valeurs de référence, découpage indifférent), liste autorisée, création puis
  remplacement avec `.bak`, pas de `.bak` sans demande ni hors projet, écriture par morceaux (plus de 3 Mo, rien
  remplacé avant la fin), abandon et libération sans reste, temporaire altéré détecté, échecs sans reste,
  contenu binaire et vide, registre des écritures.
- Manuels : lignes 11 à 15 de la liste de contrôle (section 11).
