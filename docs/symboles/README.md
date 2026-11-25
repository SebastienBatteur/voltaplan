# Symboles électriques — planche de contrôle

`planche-symboles.html` montre chaque élément de `src/unifilar/symbols.tsx` (20 éléments, 88 variantes) en forme
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
- L'arborescence utilise désormais les **symboles en miniature** (auparavant des caractères Unicode ⚡ ▣ ⊘ ⏚ ◖ ⊸…,
  absents de certaines polices Android et affichés en emoji couleur sur téléphone).
- Pictogrammes d'interface (⚡ ⚙ ⚠ ⏸) forcés en version texte (`font-variant-emoji: text` et U+FE0E).

## À vérifier contre le tableau 2.23 du RGIE (humain, avec le texte officiel)

L'outil ne juge pas la conformité. Points relevés sur la planche, à trancher avec le RGIE :

1. **Protection, nombre de pôles** (1P, 2P, 3P, 3P+N, 4P) : même symbole pour toutes les valeurs ; les pôles
   figurent seulement dans le texte à côté (« 40 A · 2P »).
2. **Protection sur le plan** : simple cadre avec abréviation (pas de symbole) — choix voulu (commentaire de
   `PlanView`), à confirmer.
3. **Prise de terre et barrette de terre sur le plan** : même dessin pour les deux.
4. **Différentiel, type (AC, A, F, B)** : pas de marque dans le symbole ; le type est écrit dans le texte
   (« 300 mA type A »).
