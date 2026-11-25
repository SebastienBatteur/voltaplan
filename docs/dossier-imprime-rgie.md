# Dossier imprimé : contrôle des mentions RGIE (2026-11-25)

Source : *Annexe — Livre 1. Installations à basse tension et à très basse tension* (édition 2026), section 3.1.2,
sous-sections 3.1.2.1 à 3.1.2.3, figures 3.1 et 3.2. Installations domestiques. Le dossier est produit par
`src/print/PrintDocument.tsx` ; le cartouche figure en bas de **chaque** page (schéma unifilaire, plans, tableau…).

| Exigence | Référence | Voltaplan |
| --- | --- | --- |
| Numéro, version et date de la version | 3.1.2 | **N° du dossier ajouté** (onglet Projet, « Versions du dossier ») ; version et date déjà présentes. Contrôle `R-DOC-NUMBER` s'il manque. |
| Nom, qualité, n° de TVA (si d'application) du responsable des travaux | 3.1.2.1 a | Présents. **Contrôle `R-DOC-QUALITY` ajouté** (la qualité n'était pas vérifiée) ; `R-DOC-INSTALLER` pour le nom. |
| Adresse du lieu de l'installation | 3.1.2.1 a | Présente ; contrôle `R-DOC-ADDRESS`. |
| Signature et date du responsable et de l'organisme agréé | 3.1.2.1 a, figures 3.1 et 3.2 | Cadres « Date et signature » (installateur, organisme agréé, propriétaire). |
| Symboles du tableau 2.23 ; autre symbole permis s'il est défini dans la légende | 3.1.2.1 a | Voir `docs/symboles/README.md` ; page « Légende des symboles » (cochée par défaut). |
| Unifilaire : lettre par circuit, numéro d'ordre depuis la protection | 3.1.2.1 a | `computeNumbering` ; test `test/numbering.test.ts`. |
| Unifilaire : tension et nature du courant | 3.1.2.1 a | Sur le symbole d'origine (« 2 x 230V ~ 50Hz ») et, **libellé désormais explicite**, dans le cartouche (« Tension et nature du courant : … ») ; contrôle `R-DOC-SUPPLY`. |
| Plan : lettre + numéro de chaque point ; interrupteur = numéro du point commandé | 3.1.2.1 a | Même repérage que l'unifilaire (test ci-dessus). |
| « partie ancienne » pour ce qui date d'avant le 1/10/1981 | 3.1.2.1 a | Propriété « partie ancienne » : mention dans l'étiquette du circuit sur l'unifilaire. |
| Unifilaire : type, section et nombre de conducteurs ; mode de pose ; protections (différentielle et surintensités) ; interrupteurs, boîtes, prises, points lumineux, appareils fixes, sources | 3.1.2.2 a | Étiquettes du schéma (ex. « XVB 3G2,5 », mode de pose, « C20 », « 40 A · 2P / 300 mA type A »). |
| Plan : position des tableaux, boîtes, prises, points lumineux, interrupteurs, appareils fixes, sources | 3.1.2.3 a | Symboles placés sur le plan de position. |

Vérifié sur l'aperçu d'impression avec un projet de test (cartouche : « N° 2026-014 », « Version 1 — 2026-11-25 »,
adresse, « Tension et nature du courant : 2 x 230V ~ 50Hz », installateur avec qualité et TVA, cadres de signature).

Non couvert : listes des voies d'évacuation et plan des installations de sécurité (« si d'application ») ; la
figure 3.2 numérote aussi les pièces avec une liste (pratique, non exigée par le texte).
