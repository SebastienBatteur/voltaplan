# Jetons OAuth : cycle de vie, renouvellement, reconnexion (analyse, 2026-11-25)

Analyse demandée avant toute modification de l'architecture. **Rien n'est encore changé dans le code.** Les faits
viennent de la documentation officielle des fournisseurs (liens en fin de section) ; ce qui n'y a pas été trouvé
est marqué **[à vérifier]** et sera mesuré pendant la séance commune.

## 1. Ce que fait Voltaplan aujourd'hui (`src/io/cloud.ts`)

| | Google Drive | OneDrive | Dropbox |
|---|---|---|---|
| Flux | implicite (`response_type=token`), fenêtre | code + PKCE, sans secret (plateforme SPA) | code + PKCE, sans secret |
| Portée | `drive.file` (+ `drive.install` sur demande) | `Files.ReadWrite.AppFolder` | `files.metadata.read files.content.read files.content.write`, `token_access_type=online` |
| Jeton de rafraîchissement | aucun | aucun (pas `offline_access`) | aucun (`online`) |

- Jeton d'accès **en mémoire seulement** (jamais enregistré : promesse de la politique de confidentialité).
- Considéré expiré à `expires_in − 60 s`. Oublié par « Se déconnecter » ou sur une réponse 401.
- Jeton expiré ou refusé : `withToken` rouvre la fenêtre de connexion **une fois**. Si le navigateur la bloque (pas
  de clic récent, par exemple reprise automatique au retour du réseau), l'enregistrement passe « en attente de
  connexion » (`saveFlow`, état `auth`) : rien n'est perdu, il repart au prochain clic sur « Enregistrer ».

## 2. Ce que permettent les fournisseurs, sans serveur ni secret

### Google
- **Durée du jeton** : `expires_in` donné à chaque connexion. Les exemples officiels montrent 3600 s ; une page de
  migration parle de « quelques minutes ». Valeur réelle **[à vérifier]** à la séance.
- **Pas de jeton de rafraîchissement** dans le modèle « jeton » (implicite / GIS token model). Le « code model »
  suppose un serveur qui échange le code. La référence OpenID marque `client_secret` comme **requis** à cet échange.
  Une autre page le dit facultatif. Aucune page n'autorise explicitement l'échange code + PKCE sans secret pour un
  client « Application Web » **[à vérifier]**.
- **Reconnexion silencieuse** : `prompt=none` (aucun écran), ou `prompt=` vide (consentement seulement la première
  fois). Google précise qu'en modèle « jeton », **chaque nouvelle demande exige un geste de l'utilisateur** et que le
  renouvellement automatique n'est pas pris en charge.
- Google qualifie le flux implicite de déconseillé pour les applications web ; il reste disponible.
- Sources : developers.google.com/identity/oauth2/web/guides/migration-to-gis,
  …/identity/protocols/oauth2/javascript-implicit-flow, …/identity/openid-connect/reference.

### Microsoft (OneDrive)
- **Durée du jeton** : 60 à 90 minutes, tirée au hasard (75 en moyenne). La page précise ne pas s'appliquer aux
  jetons des API Microsoft (Graph) **[à vérifier]**. Rien n'explique une perte après 7 minutes (O1) ; une révocation
  anticipée n'arrive que sur changement de mot de passe ou action d'un administrateur.
- **Jeton de rafraîchissement possible sans secret** pour une application SPA (PKCE). Il vaut **24 heures, non
  glissantes** : les suivants héritent de l'échéance du premier. Il change à chaque usage. Il faut probablement
  ajouter la portée `offline_access` **[à vérifier]**.
- **Reconnexion silencieuse** : la fenêtre cachée (`prompt=none` en iframe) ne marche plus quand les cookies tiers
  sont bloqués (Safari, Brave, bientôt Chrome). Il reste le jeton de rafraîchissement, puis une vraie fenêtre.
- Sources : learn.microsoft.com/entra/identity-platform/access-tokens, …/refresh-tokens,
  …/reference-third-party-cookies-spas, …/scenario-spa-acquire-token.

### Dropbox
- **Durée du jeton** : « courte », renvoyée par `/oauth2/token` (valeur **[à vérifier]**).
- **Jeton de rafraîchissement possible sans secret** : `token_access_type=offline` + PKCE (le `code_verifier`
  remplace le secret). Valable jusqu'à révocation. Dropbox **recommande pourtant** des jetons courts sans
  rafraîchissement pour une application purement JavaScript.
- Source : docs.dropboxapi.com/dropbox-api/docs/oauth.

### Bonnes pratiques (IETF, « OAuth 2.0 for Browser-Based Apps »)
- Préférer un serveur qui garde les jetons ; Voltaplan n'en a pas, par choix.
- Sans serveur : PKCE obligatoire ; jeton de rafraîchissement seulement s'il change à chaque usage et a une durée
  maximale.
- Un XSS peut de toute façon lancer une nouvelle connexion silencieuse : la vraie protection est la CSP stricte
  (déjà en place).

## 3. Conclusions

1. **Une reconnexion entièrement transparente est impossible avec Google** sans serveur : chaque nouveau jeton demande
   un clic. C'est la limite principale et elle ne dépend pas de Voltaplan.
2. **OneDrive et Dropbox** permettent de renouveler le jeton sans fenêtre, pendant la session, si l'on garde un jeton
   de rafraîchissement **en mémoire** (jamais sur le disque) :
   - OneDrive : jusqu'à 24 heures ;
   - Dropbox : tant que l'onglet reste ouvert.
3. **Aucune perte de travail aujourd'hui** : un jeton expiré met l'enregistrement en attente, il ne l'abandonne pas.
   Le scénario F10 le vérifie en réel (voir `checklist-tests-cloud.md`).
4. **O1 (perte OneDrive après 7 minutes) n'est pas expliquée par la durée documentée** (60 à 90 min). La mesure de
   `expires_in` à la prochaine connexion reste nécessaire avant tout changement.

## 4. Recommandations, par ordre

| # | Proposition | Effet | Coût, risques | Décision |
|---|---|---|---|---|
| R1 | **Ne rien changer à l'architecture** tant que O1 n'est pas mesuré | — | — | recommandé maintenant |
| R2 | **Reconnexion en un clic, avant qu'elle soit nécessaire** : quand le jeton a moins de 5 minutes, ou a expiré, un bandeau discret « Reconnecter Google Drive » (le clic autorise la fenêtre). Google : `prompt=` vide et `login_hint` du compte déjà utilisé, donc aucun écran de consentement en principe **[à vérifier]**. | supprime la surprise « en attente de connexion » au moment d'enregistrer | petit changement d'interface ; aucun changement de portée ni de console | à valider |
| R3 | **Jeton de rafraîchissement en mémoire** pour OneDrive (`offline_access`) et Dropbox (`token_access_type=offline`) | renouvellement sans fenêtre pendant la session | nouvelle autorisation affichée à l'utilisateur ; politique de confidentialité et console Microsoft (`offline_access`) à mettre à jour ; plus de code à sécuriser | à décider après R2 et O1 |
| R4 | Garder le jeton (ou le jeton de rafraîchissement) **sur le disque** pour survivre à un rechargement | reconnexion après fermeture | **déconseillé** : contraire à la politique de confidentialité, exposé à un XSS | non recommandé |
| R5 | Bibliothèque Google Identity Services (script chargé depuis accounts.google.com) | aucune capacité de plus en modèle « jeton » | script tiers à chaque visite, CSP élargie | non recommandé |

## 5. Décisions (2026-11-25)

- **R1 appliqué** : aucun changement d'architecture avant les mesures réelles.
- **R2 : principe validé pour la première bêta publique**, à développer **après** la séance de mesures. Exigences :
  1. bandeau discret et non bloquant ;
  2. affiché uniquement pour le service cloud du projet courant ;
  3. reconnexion en un clic ;
  4. aucune interruption du travail en cours (le bandeau ne prend pas le focus, n'ouvre aucune boîte de dialogue) ;
  5. conservation intégrale des modifications non enregistrées (la fenêtre de connexion ne recharge jamais la page) ;
  6. aucune notification répétitive ou intrusive (une seule apparition par échéance de jeton ; fermé, il ne revient
     qu'à la prochaine échéance).
- **R3 : gardé dans la feuille de route.** Décision après les essais réels et l'analyse des implications de sécurité
  (exposition d'un jeton de rafraîchissement en mémoire, durée maximale, rotation, texte des autorisations et de la
  politique de confidentialité).
- R4 et R5 : écartés.

Mesures à faire pendant la séance (sans jamais lire le jeton) :
- `expires_in`, `scope` et `token_type` pour les trois services ;
- l'heure réelle de la première réponse 401.

## 6. Mesures réelles (séance du 2026-11-25)

Détail : [tests-cloud-reels.md](tests-cloud-reels.md), séance commune.

| | Google Drive | OneDrive | Dropbox |
|---|---|---|---|
| `expires_in` | 3599 s | environ 3600 s (déduit : accepté à 57 min, vu expiré à 62 min) | 14 400 s (4 h) |
| `scope` | `drive.file` | — (réponse antérieure à l'enregistreur) | `files.content.read files.content.write files.metadata.read` |
| Jeton de rafraîchissement | — | — | aucun (`has_refresh` faux) |
| Reconnexion après expiration | au clic : fenêtre ouverte et refermée seule (accord déjà donné), aucun écran | non mesurée | après retrait de l'accès : 401, fenêtre, reconnexion ; Dropbox affiche « peu d'utilisateurs » (S7) |

Conséquences pour R2 :
- **O1 n'est pas reproduit** : OneDrive garde son jeton environ une heure, comme documenté.
- Le comportement actuel ne perd rien (F10 rapide et long), mais l'utilisateur ne découvre l'expiration qu'au
  moment d'enregistrer, et une reprise automatique (sans geste) ne peut pas reconnecter : c'est exactement le cas
  que R2 traite.
- Google se reconnecte sans aucun écran quand l'accord est déjà donné : le bandeau R2 peut donc tenir en un clic.
- **Préalable à R2 sur iOS : corriger S1** (fenêtre Dropbox et OneDrive bloquée par Safari, ouverture après un
  calcul asynchrone). Sinon le bouton « Reconnecter » de R2 ne marcherait pas sur iPhone et iPad.
