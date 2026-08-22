# Carnet — Suivi d'élèves hors-ligne (frontend)

React + TypeScript + Vite PWA implementing the Claude Design handoff mockup for "Carnet": an
offline-first app for teachers to log tags/notes about students, browse by class or flat student
search, and manage custom tags. See the repo-root `CLAUDE.md` for the project's git/workflow rules.

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build       # production build to dist/
npm run preview     # serve the production build locally
npm run test         # Vitest — store business logic only, see "Testing" below
npm run lint          # oxlint
npm run format:check  # prettier --check
npm run typecheck      # tsc -b
```

In production this app is not served standalone — it's built into `dist/` and copied into the
FastAPI backend's Docker image as static files (see the repo-root `Dockerfile` and
`backend/main.py`'s catch-all route), so the whole thing ships as a single Railway service.

## Architecture

- **No backend for data.** Per the design ("toutes les données restent sur le téléphone"), this
  app makes zero network calls for its domain data. Everything lives in a Zustand store
  (`src/store/useAppStore.ts`) persisted to `localStorage`. There's deliberately no `api/` folder —
  it would be empty ceremony with nothing to call.
- **Two stores.** `useAppStore` holds persisted domain data (students, classes, tags, events) and
  its CRUD/business-logic actions. `useUiStore` holds ephemeral overlay state (the Quick Entry and
  Tag Editor bottom sheets) — kept separate so sheet-open/search-text churn never triggers a
  `localStorage` write.
- **Seeding.** The store's creator function returns seed data as its initial state. Zustand's
  `persist` middleware then either leaves that seed data in place (nothing was in storage yet) or
  overwrites it wholesale with whatever was previously saved — including empty arrays, if a
  teacher deleted everything. There's no separate "first run" flag driving this: it falls out of
  `persist`'s default merge behavior for free.
- **Routing.** React Router, not the mockup's own hand-rolled navigation stack — this gives a
  working browser back button, which matters for a mobile PWA. The two bottom sheets are not
  routes; they're UI state layered over whatever route is active, matching the mockup's overlay
  behavior.
- **Design tokens.** `src/styles/tokens.css` ports the mockup's CSS custom properties (colors,
  type, spacing, radii, shadows) 1:1. Component styling is plain CSS Modules referencing those
  tokens — no Tailwind/shadcn, no copying the mockup's own classes or inline styles.
- **Fonts are self-hosted** (`public/fonts/`, referenced from `tokens.css`) rather than loaded from
  Google Fonts. A remote `@import` would silently degrade offline, which defeats the point of a
  PWA that's supposed to work with no network at all.

## Testing

Per this repo's testing-depth decision, automated coverage is scoped to the Zustand stores'
business logic (`src/store/__tests__/`): event logging fan-out, tag/category CRUD, seed-on-first-run,
and all selectors. Screens/components are verified manually in the browser rather than with
component tests.

## PWA / offline

`vite-plugin-pwa` generates the manifest and a precache-only service worker (there's no API
traffic to add runtime caching rules for). To verify offline behavior after a change: build and
preview (`npm run build && npm run preview`), load the app once, then throttle to offline in
devtools and reload on a non-root route (e.g. `/classes/xyz`) — the service worker's precached
`index.html` should still render the app shell.

## Known simplifications vs. the mockup

- The Quick Entry "Terminé" button is `disabled` when there's no valid target/tag/note, rather
  than the mockup's silent no-op-on-click. Slightly better UX for a negligible behavior change.
- Deleting a tag from the Tag Editor has no confirmation dialog, matching the mockup. Historical
  events referencing a deleted tag are never removed — they render a "Tag supprimé" ghost chip.

## Comptes et chiffrement

Depuis la v2, un compte est obligatoire : l'écran d'authentification est toute l'application tant
qu'un carnet n'est pas déverrouillé.

Le mot de passe ne quitte jamais le navigateur. `src/crypto/` en dérive (PBKDF2-SHA256, 600 000
itérations) une clé maîtresse, puis deux valeurs distinctes par HKDF : un `authSecret` envoyé au
serveur, et une **KEK** qui reste ici et déverrouille la clé de données. Le carnet est chiffré en
AES-GCM avec cette clé de données, **y compris dans `localStorage`** — sans quoi le chiffrement
bout-en-bout serait décoratif : le serveur ne verrait rien, mais l'appareil tout.

### Trois états, une seule clé

| État        | Ce que ça veut dire                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `anonymous` | Aucun compte sur cet appareil. Connexion ou inscription.                                                                        |
| `locked`    | Un compte est connu, sa clé a disparu (déconnexion, données de site effacées). Le mot de passe la reconstruit, **sans réseau**. |
| `unlocked`  | La clé de données est en main, le carnet est lisible.                                                                           |

Une fois déverrouillée, la clé est rangée **dans IndexedDB** sous forme de `CryptoKey` non
extractible : elle survit aux redémarrages sans jamais exister comme octets lisibles par un script,
donc pas de mot de passe à retaper au quotidien. La déconnexion la supprime, ce qui rend le carnet
resté sur l'appareil définitivement illisible pour le compte suivant.

### Deux pièges, et pourquoi le code est écrit ainsi

**Se déconnecter ne doit pas détruire le carnet.** Vider l'état pendant que la persistance vise
encore le coffre écrirait le carnet vide par-dessus le vrai. `src/store/vaultBinding.ts` débranche
donc la persistance **avant** de vider, et les tests le vérifient en inversant l'ordre.

**Perdre le serveur n'est pas perdre le carnet.** Un jeton de rafraîchissement révoqué ne
verrouille pas l'application : la clé est en main, les notes sont lisibles, seule la
synchronisation s'arrête (`needsReauth`). Verrouiller enfermerait dans une boucle, puisqu'un
déverrouillage hors-ligne ne restaure aucun jeton non plus.

### Ce que ce schéma ne protège pas

`authSecret` est dérivé du mot de passe, et le serveur en conserve un hash argon2id. Un serveur
compromis peut donc tenter une **attaque par dictionnaire hors-ligne** : pour chaque mot de passe
candidat, refaire PBKDF2 (600 000 itérations) puis argon2id, et comparer. S'il trouve, il dérive la
KEK et lit le carnet.

Ce n'est pas un contournement du chiffrement bout-en-bout, c'est son coût : tout schéma où un
secret dérivé d'un mot de passe sert à l'authentification a cette propriété. Ce qui la rend chère
est précisément ce qui est en place — 600 000 itérations PBKDF2 par essai, plus argon2id côté
serveur. Ce qui la rend praticable, c'est un mot de passe faible. Le vrai correctif serait un
protocole à mot de passe augmenté (OPAQUE, SRP), qui ne transmet aucun dérivé du mot de passe :
hors périmètre, et un changement d'architecture, pas un correctif.

Corollaire assumé : **le minimum de 6 caractères vient de la maquette et reste bas** pour une clé
sans récupération possible. C'est un arbitrage produit, pas un oubli.

Le nombre d'itérations renvoyé par le serveur est en revanche **refusé s'il est inférieur au
minimum** (`assertUsableKdfParams`) : sans ce garde-fou, un serveur répondant `1` obtiendrait un
`authSecret` dérivé en microsecondes, assez bon marché pour remonter au mot de passe.

### Reprise du carnet d'avant les comptes

À l'inscription, si `suivi-eleves:v1` contient un vrai carnet, il devient celui du compte ; sinon
le jeu de démo est chargé. La copie en clair n'est supprimée **qu'une fois l'écriture chiffrée
confirmée sur l'appareil** — l'effacer sur la foi d'une écriture encore en vol perdrait les notes
d'un enseignant si l'onglet se fermait entre les deux.
