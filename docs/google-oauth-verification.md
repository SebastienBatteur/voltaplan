# Google OAuth : éléments pour la validation de l'application

Date : 2026-11-24. C'est **le propriétaire** qui soumet la demande, dans la console Google Cloud. Les exigences de
Google évoluent : vérifiez-les sur la page officielle « OAuth App Verification » au moment de la soumission
**[à vérifier]**.

## 1. Ce que Voltaplan demande à Google

| Élément | Valeur |
|---|---|
| Portée | **`https://www.googleapis.com/auth/drive.file` seulement** : fichiers créés par Voltaplan ou ouverts avec lui |
| Portée facultative | `https://www.googleapis.com/auth/drive.install` : demandée seulement par le bouton « Ajouter à « Ouvrir avec » de Drive » ; aucun accès aux fichiers, elle inscrit Voltaplan dans « Ouvrir avec » et « Nouveau » |
| Classement de la portée | **non sensible** selon Google **[à vérifier]** : pas d'évaluation de sécurité (CASA), pas de vidéo de démonstration attendue |
| Serveur | aucun ; flux OAuth dans le navigateur, jeton en mémoire seulement, sans secret client |
| Autres données Google | aucune (ni profil, ni e-mail, ni contacts) |

Pour une application qui n'utilise que des portées non sensibles, Google demande surtout une **vérification de
la marque** (nom, logo, domaine, pages légales), nécessaire pour afficher le nom et le logo sur l'écran de
consentement et pour sortir du mode « test » **[à vérifier]**.

## 2. Champs de l'écran de consentement

| Champ | Valeur proposée |
|---|---|
| Nom de l'application | **Voltaplan** (identique au site et au dépôt) |
| Adresse d'assistance | une adresse dédiée au projet (à créer par le propriétaire ; pas d'adresse personnelle si possible) |
| Logo | [`docs/assets/logo-google-oauth-120.png`](assets/logo-google-oauth-120.png) (120 × 120 px, PNG, dérivé de l'icône de l'application) |
| Page d'accueil | `https://voltaplan.org/` : décrit l'application et renvoie vers la confidentialité et les conditions, en pied de page |
| Règles de confidentialité | `https://voltaplan.org/privacy.html` (français) ; anglais `https://voltaplan.org/en/privacy.html` (à privilégier pour les vérificateurs), néerlandais `https://voltaplan.org/nl/privacy.html` |
| Conditions d'utilisation | `https://voltaplan.org/terms.html` (français) ; anglais `https://voltaplan.org/en/terms.html`, néerlandais `https://voltaplan.org/nl/terms.html` |
| Domaines autorisés | `voltaplan.org` |
| Coordonnées du développeur | adresse du propriétaire (visible seulement de Google) |

Les pages sont publiques, sans authentification, sur le domaine vérifié, et liées en pied de page du site et de
l'application. La section « Google Drive » détaille la portée `drive.file`, chaque opération, le jeton en mémoire et
le retrait de l'accès. La page de confidentialité contient aussi la mention exigée sur l'**utilisation limitée** (« Limited Use ») des données
reçues des API Google, avec le lien vers la *Google API Services User Data Policy*.

## 3. Propriété du domaine

Google demande de prouver que `voltaplan.org` vous appartient, via **Google Search Console**.

- **Sans toucher au DNS** : méthode « fichier HTML ». Search Console fournit un fichier
  `google<identifiant>.html`. Il suffit de l'ajouter à la racine de `site/` : il sera publié à
  `https://voltaplan.org/google<identifiant>.html` au prochain déploiement. Transmettez-moi ce fichier, ou ajoutez-le
  vous-même.
- **Par le DNS** : enregistrement TXT. **C'est une modification DNS, à faire par vous seul.**

## 4. Justification de la portée (texte à coller)

> Voltaplan is a free, open-source, local-first web application for drawing Belgian residential electrical
> diagrams. Users can optionally save and open their own project files in their Google Drive. We request only the
> `drive.file` scope, so the app can access only the files and folders it created or that the user explicitly
> opens with it. There is no server: all requests go directly from the user's browser to Google Drive, the access
> token is kept in memory for the session only, and no data is shared with third parties or used for any other
> purpose. The optional `drive.install` scope is requested only when the user chooses to add Voltaplan to Google
> Drive's "Open with" and "New" menus; it grants no access to file content.

## 5. Avant de soumettre

1. Le site s'ouvre en HTTPS depuis un réseau sans filtrage : pages d'accueil, de confidentialité et de conditions.
2. L'écran de consentement est rempli comme ci-dessus ; portées déclarées : `drive.file` et, pour « Ouvrir avec »,
   `drive.install` (aucune autre).
3. Les identifiants OAuth sont de type **Application Web** :
   - origine `https://voltaplan.org` ;
   - redirection `https://voltaplan.org/app/oauth.html` ([oauth-configuration.md](oauth-configuration.md)).
4. Un essai complet est réussi en mode « test », avec votre compte ajouté comme utilisateur de test :
   enregistrer, rouvrir, conflit ([tests-cloud-reels.md](tests-cloud-reels.md)).
5. Pour « Ouvrir avec Voltaplan » depuis Drive : voir la configuration de l'intégration à l'interface de Drive dans
   [oauth-configuration.md](oauth-configuration.md) (elle peut exiger une fiche Google Workspace Marketplace
   **[à vérifier]**).

## 6. Ce que Voltaplan ne fera pas

Aucune portée plus large (`drive`, `drive.readonly`) : elle donnerait accès à tout le Drive, serait classée
« restreinte », et imposerait une évaluation de sécurité payante. C'est contraire aux principes du projet.
