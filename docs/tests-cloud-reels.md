# Tests avec de vrais comptes cloud : procédure

Date : 2026-11-24. Tout ce qui concerne le cloud n'a été testé jusqu'ici **qu'avec des réponses simulées**. Cette
procédure sert à le vérifier avec **tes propres comptes**.

**Règle absolue : jamais de dossier de client.** Utilise uniquement un projet d'essai, par exemple
« Essai conflit », créé pour l'occasion, avec des photos sans personne ni adresse.

## 1. Google Drive : analyse détaillée

Analyse complète (limites, quota, appareils simultanés, nettoyage) : [google-drive.md](google-drive.md).

### Ce que l'API permet

- L'API Drive v3 n'offre **pas d'écriture conditionnelle** (pas d'équivalent à `If-Match`) **[à vérifier sur la
  documentation actuelle]**.
- Une modification concurrente entre notre vérification et notre envoi ne peut donc pas être **empêchée**. On peut
  seulement la **rendre récupérable** et la **détecter**.
- Drive garde l'historique des révisions d'un fichier. Les révisions ordinaires peuvent être supprimées
  automatiquement : au-delà d'un nombre de révisions, ou après environ 30 jours **[à vérifier]**. Une révision
  marquée `keepForever` n'est **jamais** supprimée automatiquement, dans la limite d'un nombre maximal de révisions
  ainsi marquées par fichier (200 selon la documentation **[à vérifier]**).

### Stratégie conservatrice mise en place (`src/io/cloud.ts`)

1. **Avant l'envoi** : relire la version et la révision de tête.
   - Si elles ont changé depuis l'ouverture, c'est un **conflit** : rien n'est envoyé, et notre version est
     enregistrée en copie.
2. **Avant l'envoi**, toujours : marquer la révision actuelle (celle qu'on va remplacer) « à conserver
   indéfiniment ».
   - **Si ce marquage échoue, l'envoi n'a pas lieu.**
3. **Envoi** avec `keepRevisionForever=true` : notre propre révision est aussi conservée indéfiniment.
4. **Après l'envoi** : relire l'historique des révisions.
   - Si une révision d'un autre appareil s'est intercalée entre celle de l'ouverture et la nôtre, son contenu est
     **recopié dans un nouveau fichier** « … (conflit date) », et l'utilisateur est prévenu.
5. **Plafond** : au-delà de 150 révisions conservées indéfiniment, les plus anciennes sont libérées, en en gardant
   100. Les 20 dernières ne sont jamais libérées.

### Ce qui reste possible, et comment récupérer

| Situation | Conséquence | Récupération |
|---|---|---|
| Un autre appareil Voltaplan enregistre pendant notre envoi | sa révision était déjà marquée « à conserver » (étape 3 de son côté) ; elle est détectée (étape 4) et recopiée | automatique : fichier « (conflit …) » |
| Un **autre logiciel** (client Drive, application tierce) enregistre pendant notre envoi | sa révision n'est pas marquée ; elle est détectée et recopiée, sauf si Drive l'a déjà supprimée entre-temps (improbable en quelques secondes) | automatique, sinon dans « Gérer les versions » de Drive |
| L'étape 4 échoue (coupure juste après l'envoi) | la course éventuelle n'est pas détectée | les deux révisions sont dans l'historique Drive, la nôtre conservée indéfiniment. Sur drive.google.com : clic droit sur le fichier → **Informations sur le fichier → Gérer les versions** → télécharger la version voulue |
| Révisions purgées au-delà du plafond | seules d'anciennes révisions libérées par Voltaplan peuvent disparaître, jamais les 20 dernières | — |

**Ce que nous ne garantissons pas** : l'absence absolue d'écrasement sur Google Drive. Le comportement de
l'historique et des révisions « conservées indéfiniment » doit être **vérifié avec de vrais comptes** (scénarios
G1 à G3 ci-dessous).

**Alternative encore plus prudente, si les tests la rendent nécessaire.** Avec le futur format en dossier (F8),
les enregistrements vers Drive ne remplaceraient jamais un fichier : chaque modèle serait écrit dans un **nouveau
fichier** (`models/<date>-<appareil>.json`), et Voltaplan lirait le plus récent. C'est sans risque d'écrasement,
mais demande un ménage des anciens modèles. Ce n'est pas implémenté.

## 2. Préparation

1. Pour chaque service testé : créer l'identifiant d'application (voir l'en-tête de `src/io/cloud.ts` ou le
   guide), sur l'adresse de test.
2. Deux appareils (ou deux navigateurs différents, par exemple Chrome et Firefox), connectés au même compte.
3. Un projet d'essai « Essai conflit », enregistré dans le service depuis l'appareil A, puis ouvert sur
   l'appareil B.
4. Noter pour chaque scénario : service, appareils, heure, résultat, capture d'écran.

## 3. Scénarios (pour chaque service : OneDrive, Dropbox, Google Drive, GitHub)

| # | Scénario | Comment | Résultat attendu |
|---|---|---|---|
| C1 | **Deux appareils modifient le même projet** | A et B ouvrent le projet ; A modifie et enregistre ; puis B modifie et enregistre | B : message « modifié ailleurs », copie « (conflit …) » créée ; le fichier de A est intact ; les deux sont ouvrables |
| C2 | **Enregistrements presque simultanés** | A et B enregistrent à moins d'une seconde d'intervalle (compter « 3, 2, 1 ») | un seul gagne ; l'autre crée une copie. Drive : éventuellement une copie créée après coup (« Quelqu'un a enregistré pendant votre envoi ») |
| C3 | **Coupure réseau pendant l'enregistrement** | projet avec quelques photos ; lancer l'enregistrement puis couper le Wi-Fi immédiatement | « En attente d'envoi » ; au retour du réseau, envoi automatique ; le fichier distant est soit l'ancien, soit le nouveau, jamais un mélange |
| C4 | **Fermeture pendant un transfert** | lancer l'enregistrement puis fermer l'onglet ou l'application aussitôt | au lancement suivant : « Enregistrement en attente… Reprendre » et/ou « Travail non enregistré retrouvé » ; après reprise, fichier complet |
| C5 | **Expiration de l'autorisation** | révoquer l'accès de l'application dans les réglages du compte (Microsoft : compte → Confidentialité → Applications ; Google : Sécurité → Accès tiers ; Dropbox : Paramètres → Applications connectées ; GitHub : supprimer le jeton), puis enregistrer | message « Connexion à … à refaire » ; la version est gardée ; « Enregistrer » ouvre la connexion et envoie |
| C6 | **Quota dépassé** | compte presque plein (ou dossier d'application limité), enregistrer | erreur claire ; la version reste dans le navigateur ; rien n'est perdu |
| C7 | **Fichier distant supprimé** | supprimer le fichier depuis le site du service, puis enregistrer dans Voltaplan | pas de recréation silencieuse au même nom sans le dire ; message clair (à observer : comportement actuel non spécifié, **à corriger si nécessaire**) |
| C8 | **Fichier distant déplacé ou renommé** | le déplacer depuis le site du service, puis enregistrer | OneDrive et Drive suivent l'identifiant (enregistrement au nouvel emplacement attendu) ; Dropbox et GitHub travaillent par chemin (conflit ou recréation : **à observer**) |
| C9 | **Ajout simultané de documents** | (format v2, plus tard) A et B ajoutent chacun une photo différente puis enregistrent | les deux photos sont conservées (fichiers immuables) ; le modèle perdant devient une copie de conflit référençant sa photo |
| C10 | **Récupération des versions en conflit** | après C1 ou C2, ouvrir les deux fichiers et Fichier → Versions locales | les deux versions sont lisibles ; les versions locales contiennent la version « Conflit » |
| G1 | Drive : historique | après plusieurs enregistrements, drive.google.com → Gérer les versions | chaque version enregistrée par Voltaplan est présente et marquée « Conserver indéfiniment » |
| G2 | Drive : course avec un autre logiciel | modifier le fichier par le client Drive de l'ordinateur pendant un envoi Voltaplan (difficile à provoquer : plusieurs essais) | copie « (conflit …) » créée, ou la version présente dans Gérer les versions |
| G3 | Drive : plafond | non testable manuellement (plus de 150 enregistrements) : vérifié seulement par les tests automatiques | — |

## 4. Résultats

| Scénario | OneDrive | Dropbox | Google Drive | GitHub |
|---|---|---|---|---|
| C1 à C10, G1 et G2 | non testé | non testé | non testé | non testé |

À remplir au fur et à mesure. Chaque écart observé devient une demande de correction.
