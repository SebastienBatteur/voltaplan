# ADR-0002 — Statut réglementaire, gravité électrique et caractère bloquant séparés

Date : 2026-11-24 · Statut : accepté

## Contexte

Une seule sévérité (`error` / `warning` / `info`) mélangeait trois notions : la conformité au texte, le danger réel
et l'effet sur le dossier. Une installation existante voyait toutes ses non-conformités devenir des avertissements,
y compris une terre absente.

## Décision

Chaque constat porte :

- `status` : nonCompliant, warning, recommendation, derogation, notApplicable, insufficientData, manualCheck ;
- `hazard` : high, medium, low, none (appréciation de Voltaplan, documentée par règle) ;
- `blocking` : empêche un dossier de réception « conforme ».

Règle de classement : partie neuve sous l'édition en vigueur → non-conformité bloquante ; partie existante →
une règle de sécurité (`hazard: high`) reste non conforme **et** bloquante, les autres prennent le statut prévu par
la règle (recommandation par défaut). Une dérogation exige un motif ; elle rend le constat non bloquant et reste
visible (panneau et dossier).

## Conséquences

- Une installation ancienne n'est jamais déclarée acceptable en silence.
- Le document de travail reste toujours imprimable ; seuls les constats bloquants ajoutent la mention
  « PROJET — NON CONFORME ».
