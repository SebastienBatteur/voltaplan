# Passage du dépôt en public : liste de contrôle finale

Date : 2026-11-24. Audit complet : [PUBLICATION-AUDIT.md](PUBLICATION-AUDIT.md) (**GO**, aucun point bloquant :
pas de secret, pas de fichier client, pas d'adresse e-mail personnelle dans l'historique, licences compatibles).

**Rien de ce qui suit n'est fait sans l'autorisation explicite du propriétaire**, sauf ce qui est marqué « fait ».

## 1. Textes publics

| Élément | État |
|---|---|
| Description du dépôt (sans « conformes au RGIE ») | **fait** (2026-11-24) : « Application gratuite et open source de schémas électriques (unifilaire, plan de position, tableau) et d'assistance réglementaire RGIE — aide à la vérification, sans certification. AGPL-3.0 » |
| README : présentation « gratuite et open source… assistance réglementaire », avertissement « pas de certification », contribuer, soutenir | **fait** |
| Site (FR, NL, EN) : descriptions sans promesse de conformité, lien « soutenir » discret | **fait** |
| Slogan de l'application (`app.tagline` FR, NL, EN, DE) | **fait** |
| Conditions d'utilisation et limites de responsabilité ([docs/CONDITIONS.md](../CONDITIONS.md)) | **rédigé, à faire relire par un juriste** |
| Confidentialité ([PRIVACY.md](../../PRIVACY.md)) : fournisseurs d'IA au choix, modèles locaux, versions locales, envois en attente, dossier de l'assistant, tickets publics, dons | **fait** |
| Sécurité ([SECURITY.md](../../SECURITY.md)) | à jour ; activer le signalement privé (point 3) |
| Guides : [CONTRIBUTING.md](../../CONTRIBUTING.md) (DCO, règles RGIE, pas de données client), [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md), modèles de tickets (bogue, règle RGIE, traduction) et de demande de fusion | **fait** |
| Mentions « PROJET — NON CONFORME » du dossier | en cours de révision (moteur RGIE : inconnu ≠ absent, documentaire ≠ physique) |

## 2. Soutien financier

- `.github/FUNDING.yml` : `github: [SebastienBatteur]`, ajouté par le propriétaire.
- **À vérifier** : le bouton « Sponsor » n'apparaît que si le compte est **inscrit à GitHub Sponsors** (profil
  validé, compte de paiement, informations fiscales). Sinon, il faut retirer la ligne ou la remplacer par un autre
  lien (`custom: […]`, par exemple Ko-fi).
- Le lien « soutenir le projet » du site pointe vers `github.com/sponsors/SebastienBatteur`. **À vérifier** après
  l'inscription.
- Fiscalité belge des dons : à vérifier séparément (personne physique ou ASBL).

## 3. Réglages GitHub au moment de la bascule (propriétaire)

1. *Settings → General → Danger Zone → Change visibility → Public.*
2. *Settings → Code security* :
   - **Private vulnerability reporting** : activé ;
   - **Secret scanning** et **Push protection** : activés (gratuits pour un dépôt public) ;
   - **Dependabot alerts** : activé.
3. `.github/workflows/codeql.yml` : passer `upload: never` à `upload: always` (le « code scanning » devient
   disponible).
4. *Settings → Pages* : inchangé (déjà public).
5. Vérifier *Settings → Actions → General* : demandes de fusion venant de forks avec l'approbation obligatoire des
   workflows pour les nouveaux contributeurs (protection contre l'abus de minutes).
6. Facultatif : sujets du dépôt (`electricite`, `rgie`, `arei`, `belgique`, `pwa`, `open-source`).

## 4. Artefacts à supprimer (installateurs de test non signés) — **préparé, non exécuté**

Une fois le dépôt public, les artefacts de workflows encore valides sont téléchargeables par toute personne
connectée à GitHub. Les installateurs de bureau sont **non signés et non testés** : il faut les supprimer avant la
bascule. Les artefacts `voltaplan-web` (site construit, sans risque) peuvent rester. Ils expirent seuls, au plus
tard le 8/12.

Commande à lancer **seulement après accord** (suppression définitive) :

```powershell
gh api "repos/SebastienBatteur/voltaplan/actions/artifacts?per_page=100" --jq '.artifacts[] | select(.expired==false) | select(.name|test("^voltaplan-(desktop-|windows|linux|macos)")) | .id' | ForEach-Object { gh api -X DELETE "repos/SebastienBatteur/voltaplan/actions/artifacts/$_" }
```

Inventaire au 2026-11-24 :

- `voltaplan-desktop-*` (Windows, Linux, macOS arm64), expiration le 1/12 ;
- `voltaplan-windows`, `voltaplan-linux`, `voltaplan-macos-arm64`, `voltaplan-macos-x64` (`release.yml` manuel),
  expiration le 24/12.

Il n'y a **aucune release** GitHub à supprimer.

## 5. Branches

- `tauri-ecriture-atomique` : écriture atomique sous Tauri, **non compilée**. Elle reste en attente d'une
  compilation réussie (règle : jamais de code Rust non compilé touchant l'intégrité des fichiers dans `main`). Elle
  deviendra publique avec le dépôt, ce qui est sans risque.
- `worktree-agent-ab851763ebd9da010` (ancienne branche de travail Tauri, fusionnée) : à supprimer, **avec accord**.

## 6. Après la bascule

- Relancer la CI (gratuite pour un dépôt public) et vérifier les premiers runs des workflows optimisés
  ([docs/ci.md](../ci.md)) et de `desktop-build.yml` sur la branche `tauri-ecriture-atomique`.
- Annoncer en **version bêta d'aide au dessin et à la vérification**, sans promesse de conformité.
