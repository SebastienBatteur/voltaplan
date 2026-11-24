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
| Tests automatiques propres au bureau ? | **Aucun.** Les 185 tests Vitest tournent dans jsdom (chemin « navigateur » de `src/io/files.ts`). |

## 2. Runs de CI

| Run | Workflow, branche | Résultat | Durée par plateforme |
|---|---|---|---|
| [45432055533](https://github.com/SebastienBatteur/voltaplan/actions/runs/45432055533) | `release.yml` (manuel), `main` | **Échec ×4** : `npm error Missing script: "tauri"` (tauri-action exécute `npm run tauri build`) | Windows 1 min 26, Linux 1 min 17, macOS 24 s |
| [45432637161](https://github.com/SebastienBatteur/voltaplan/actions/runs/45432637161) | `desktop-build.yml`, branche de vérification, sans `Cargo.lock` ni cache | **Succès ×3** | macOS arm64 3 min 12 (cargo 2 min 09), Linux 8 min 33 (cargo 5 min 04), Windows 11 min 13 (cargo 8 min 42) |
| [45434976857](https://github.com/SebastienBatteur/voltaplan/actions/runs/45434976857) | `desktop-build.yml`, avec `Cargo.lock`, plugin-fs 2.7.1, droit d'impression, cache Rust | **Succès ×3** ; `cargo metadata --locked` et contrôle des versions Tauri passés | macOS arm64 2 min 28 (cargo 1 min 17), Linux 4 min 54 (cargo 1 min 17), Windows 5 min 30 (cargo 2 min 47) |
| [45435099189](https://github.com/SebastienBatteur/voltaplan/actions/runs/45435099189) | `release.yml` (manuel), branche de vérification | **Succès ×4**, aucune release créée (paquets en artifacts) | Windows 6 min 26, Linux 5 min 27, macOS arm64 3 min 08, macOS x64 3 min 08 |

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
| `@tauri-apps/api` (transitif) | 2.12.5 | `tauri` | 2.12.7 | OK (2.12) |
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
| Simulation des API Tauri en test unitaire (`@tauri-apps/api/mocks`) | possible pour tester la branche `isDesktop` de `src/io/files.ts` sans fenêtre | idem | idem |

Recommandation : une **liste de contrôle manuelle** avant chaque release (section 9), plutôt qu'un
banc WebDriver dont le coût dépasse aujourd'hui le bénéfice.

## 7. Cohérence du code de bureau

`src/io/files.ts` (branche `isDesktop`, détectée par `__TAURI_INTERNALS__`) :

| Fonction | Appel Tauri | Droit nécessaire | Présent dans `capabilities/default.json` |
|---|---|---|---|
| `desktopSavePath` | `save()` (plugin-dialog) | `dialog:allow-save` | oui |
| `saveProject` | `writeTextFile()` (plugin-fs) | `fs:allow-write-text-file` | oui |
| `download` (exports, images…) | `writeFile()` (plugin-fs) | `fs:allow-write-file` | oui |
| Ouverture | `<input type="file">` (pas d'API Tauri) | aucun | — |
| Impression du dossier (`src/print/PrintDialog.tsx`) | `window.print()` → sur macOS, commande `plugin:webview\|print` | `core:webview:allow-print` | **ajouté** (absent de `core:default`) |

- Écriture : la documentation de `save()` indique que le chemin choisi est ajouté aux portées
  (« scopes ») du système de fichiers et du protocole d'assets ; aucune portée `fs:scope` n'est donc
  nécessaire, et l'application ne peut écrire qu'aux chemins choisis par l'utilisateur. Cet ajout ne
  survit pas à un redémarrage, ce qui est cohérent avec `currentPath` remis à zéro.
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
