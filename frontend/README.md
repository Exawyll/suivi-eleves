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
