---
name: design-handoff-audit
description: Checklist à suivre avant d'implémenter ou de committer du code dérivé du bundle de handoff Claude Design (suivi-d-l-ves-hors-ligne/). À utiliser quand on traduit un mockup .dc.html en composants React/FastAPI de production.
---

# Audit du bundle de handoff Claude Design

Le dossier `suivi-d-l-ves-hors-ligne/` est un mockup exporté depuis claude.ai/design — jamais commité (voir `.gitignore`), jamais exécuté en production. Avant d'implémenter une fonctionnalité à partir de ce bundle :

## À faire

- Lire le `.dc.html` et son README en entier avant de coder quoi que ce soit.
- Extraire uniquement les **tokens de design** (`_ds/*/styles.css` — couleurs, typo, spacing, radius) vers le vrai design system de l'appli, jamais le HTML/CSS brut.
- Réimplémenter chaque interaction du mockup avec les patterns sûrs de la stack cible (composants React contrôlés, gestion d'état propre, pas de manipulation DOM directe).
- Si le mockup illustre de la saisie utilisateur (formulaires, recherche élèves), vérifier que l'implémentation réelle valide/échappe les entrées côté backend (schémas Pydantic) — le mockup ne le fait jamais, il n'a pas de backend.
- Lancer `/security-review` avant d'ouvrir la PR.

## Interdit

- Importer `support.js`, `ios-frame.jsx` ou tout fichier de `_ds/` dans le code de production — ce sont des scaffolds de prototypage (`support.js` est explicitement marqué "GENERATED... do not edit", `ios-frame.jsx` marqué `@ds-adherence-ignore`).
- Copier des attributs `style=""` inline ou des `onclick=""` du HTML mockup directement dans du JSX — recréer proprement avec les conventions du projet.
- Committer, référencer ou déployer un quelconque fichier sous `suivi-d-l-ves-hors-ligne/`.
