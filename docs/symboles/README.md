# Symboles électriques — planche de contrôle

`planche-symboles.html` montre chaque élément de `src/unifilar/symbols.tsx` (22 éléments, 165 variantes) en forme
**unifilaire** et en forme **plan de position**, une variante par propriété qui change le dessin. Régénérer après
toute modification des symboles :

```
npm run symbols:sheet
```

Page autonome (styles de l'application inclus, aucun appel réseau, toujours en clair comme à l'impression).

## Homogénéité entre plateformes (vérifié le 2026-11-25)

- Les symboles sont **dessinés en SVG** (traits, cercles, arcs) : même forme partout (Windows, macOS, iOS, Android),
  à l'écran, dans la palette, dans l'arborescence et à l'impression.
- Les quelques textes intégrés (kWh, M, 3~, LED, h, ×2, abréviations des appareils) utilisent la **même police qu'à
  l'impression** : Arial, ou un équivalent métrique (Helvetica, Liberation Sans, Arimo). Sur Android, sans Arial,
  le système prend sa police sans empattement : textes très légèrement plus larges, symboles inchangés.
- L'arborescence utilise les **symboles en miniature** (auparavant des caractères Unicode ⚡ ▣ ⊘ ⏚ ◖ ⊸…, absents
  de certaines polices Android et affichés en emoji couleur sur téléphone).
- Pictogrammes d'interface (⚡ ⚙ ⚠ ⏸) forcés en version texte (`font-variant-emoji: text` et U+FE0E).

## Comparaison au RGIE (2026-11-25)

Source : *Annexe — Livre 1. Installations à basse tension et à très basse tension* (édition 2026), chapitre 2.13,
tableau 2.23 « Symboles graphiques » (pages imprimées 50 à 57) ; figure 3.1 « Exemple de schéma unifilaire » (p. 62)
et figure 3.2 « Exemple de plan de position » (p. 63) ; sous-section 3.1.2.1.

**Règle utile (3.1.2.1)** : un symbole absent du tableau 2.23 est permis s'il est « clairement identifiable et
défini dans la légende des schémas unifilaires et des plans de position ». Le dossier imprimé contient une légende
des symboles présents dans le projet (`src/print/PrintDocument.tsx`, section « Légende », cochée par défaut).

### Conformes au tableau 2.23

| Partie | Symboles |
| --- | --- |
| B. Appareillages | tableau de répartition, boîte de dérivation (cercle à point), coffret de branchement (origine) |
| C. Canalisations | trait + nombre de conducteurs (« / n »), encastré, apparent, souterrain, aérien, dans un conduit |
| D. Protections | disjoncteur (levier à carré noir), fusible (rectangle sur le fil), différentiel (tore + pointillés) ; prise de terre ⏚ |
| E. Interrupteurs | général, à lampe témoin, bipolaire, commutateur (double allumage), va-et-vient, intermédiaire, gradateur, à tirette, à lampe de signalisation ; bouton-poussoir ; minuterie (« t ») ; détecteur de mouvement |
| F. Socles de prise | général, multiple (arcs empilés), étanche (« h »), contact de terre, protection enfant |
| G. Appareils | point lumineux, applique, fluorescent, projecteur, éclairage de sécurité ; sonnerie ; appareil fixe, four, micro-ondes, lave-linge, sèche-linge, lave-vaisselle, frigo, congélateur, moteur, ventilateur, chauffage, chauffe-eau, compteur kWh |
| H. Sources | transformateur, panneau solaire, onduleur |

L'orientation d'un symbole (prise tournée vers la droite au lieu du bas, par exemple) suit le sens du dessin, comme
dans les figures 3.1 et 3.2 où les mêmes symboles sont tournés selon le circuit ou le mur.

### Écarts corrigés

1. **Barrette / sectionneur de terre** : barre pleine (unifilaire) et même dessin que la prise de terre (plan) →
   symbole « sectionneur de terre » ─┤├──┤├─ (tableau 2.23 B, et figure 3.1 entre la barre et la prise de terre).
2. **Cuisinière, taque de cuisson** : 4 points → **3 points** (deux en haut, un en bas à droite), tableau 2.23 G.
3. **Télérupteur** : équerres ┌ ┐ → **┘ └**, tableau 2.23 E.

### Points tranchés par le texte

- **Nombre de pôles d'une protection** : le tableau l'inscrit en texte (« M₂ + 0 », indice = pôles protégés) et la
  figure 3.1 ne le dessine pas ; Voltaplan l'écrit à côté du symbole (« 40 A · 2P ») : conforme à l'usage du RGIE.
- **Type de différentiel** : le tableau l'écrit à côté du symbole (« 40/0.3A type A ») ; Voltaplan aussi
  (« 300 mA type A ») : conforme.
- **Protections sur le plan** : la figure 3.2 n'en montre aucune ; Voltaplan les signale par un cadre avec
  abréviation (aide à la lecture, défini dans la légende).

### Symboles hors tableau (permis avec la légende)

Relais (« R »), contacteur (« K »), commande de volet (interrupteur ▲▼), pompe à chaleur (« PAC »), chaudière
(« Chaud. »), mention « LED ». Ils figurent dans la légende imprimée quand le projet les utilise.

### Variantes ajoutées le 2026-11-26 (tableau 2.23, pages imprimées 52 à 55)

| Partie | Symboles |
| --- | --- |
| E. Interrupteurs | tripolaire (trois traits), va-et-vient bipolaire, à ouverture retardée (« t ») ; bouton-poussoir à accès protégé (glace à briser) ; en boîtier : interrupteur horaire (horloge et contact), thermostat (θ), contrôleur de ronde / verrouillage par serrure (trou de serrure) |
| F. Socles | avec interrupteur bipolaire, avec interrupteur bipolaire de verrouillage (point noir), avec transformateur de séparation (rasoir) ; prise data (crochet, élément « autre ») |
| G. Appareils | projecteur à faisceau peu divergent et divergent, luminaire avec interrupteur incorporé, bloc autonome de sécurité (carré), appareil auxiliaire (ballast) ; vibreur, trompe, sirène ; horloge, horloge mère, gâche électrique ; chauffage à accumulation (avec ou sans ventilateur), chauffe-eau électrique sans accumulation (le « boiler » reste le chauffe-eau à accumulation) |

Les imports Volter et PlanElec utilisent ces variantes au lieu d'un élément « autre ».

### Fin du tableau 2.23 (2026-11-26, pages imprimées 53 à 57)

- **Interrupteur / socle installé dans un tableau** (E, F) : propriété « Dans le tableau » ; le symbole est encadré,
  double trait en bas.
- **Domotique** (J) : unité de commande en deux parties ; en bas le symbole de base (interrupteur ou socle), en haut
  le ou les types de commande : bouton-poussoir local (◎), sans fil, programmée (horloge), par détection ; à droite
  l'extension par bouton-poussoir.
- **Sources** (H) : caractéristiques écrites sous le symbole, sur l'unifilaire seulement (Pmax de l'onduleur,
  Uprim/Usec et Pn du transformateur, quantité et puissance crête des panneaux).
- **Trois tubes fluorescents** : déjà dessinés (trois traits et le nombre).

Tout le tableau 2.23 est maintenant proposé. Les symboles hors tableau restent permis s'ils sont définis dans la
légende (3.1.2.1).

## Symboles hors tableau 2.23 (2026-11-26)

Permis par le RGIE 3.1.2.1 s'ils sont « clairement identifiables et définis dans la légende ». Dessin commun : un cadre
avec une abréviation courte ; la légende du dossier les regroupe sous « Symboles hors tableau 2.23 du RGIE (définis
ici) », avec l'abréviation et sa signification. Dessins propres à Voltaplan (pas repris des logiciels concurrents).

| Famille | Abréviations |
| --- | --- |
| Appareils | AC climatisation, HT hotte, SA sauna, PAC pompe à chaleur, CH chaudière |
| Détecteurs | DF fumée, DC chaleur, DG gaz, CM contact magnétique, VIB vibration ; présence : symbole du détecteur de mouvement avec « P » |
| Courant faible | TV prise télédistribution, TÉL prise téléphone, PH parlophone/vidéophone, HP haut-parleur, MIC microphone, ÉCR écran, TAC écran tactile |
| Sécurité | CA centrale d'alarme, CI centrale incendie, TRM transmetteur, CAM caméra, AU arrêt d'urgence |
| Énergie | G groupe électrogène (cercle, comme le moteur M), MO micro-onduleur, ASI alimentation sans interruption, EMS gestion de l'énergie, LP limiteur de pointe, SG commande SG-ready, MPPT régulateur de charge, PF parafoudre, kWh compteur divisionnaire |

Les imports Volter, Draadwijs, PlanElec et Trikker utilisent ces types quand le logiciel d'origine les distingue.
