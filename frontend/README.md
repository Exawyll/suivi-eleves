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

## Import CSV (classes & élèves)

Réglages → Établissements & classes → « Importer un fichier CSV (Pronote…) » ouvre
`RosterImportSheet` (`src/components/classes/RosterImportSheet.tsx`), qui lit l'export standard
d'un professeur — plusieurs classes dans un seul fichier — entièrement dans le navigateur (le
fichier ne part jamais du poste). L'import « une seule classe » historique
(`ClassImportSheet`, un simple fichier de noms) reste disponible par établissement pour un ajout
ponctuel.

### Mapping

| Colonne du CSV                                                                                                     | Modèle                       | Traitement                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Élèves` (« NOM Prénom »)                                                                                          | `Eleve.name`                 | reformaté en « Prénom Nom » (convention des seeds), via `splitNomPrenom` — les tokens tout-majuscules de tête forment le nom de famille |
| `Classe` (ex. `11`, `12`…)                                                                                         | regroupement + `Classe.name` | chaque valeur distincte devient une classe ; le code brut sert de nom (renommable ensuite)                                              |
| tout le reste (Encouragement, Né(e) le, Sexe, E-mail, Entrée/Sortie, Tuteur, Cnx Ele./Resp., Options 1-3, Régime…) | —                            | ignoré, hors périmètre actuel du modèle                                                                                                 |

`parseCsvRoster` + `groupRosterByClasse` (`src/utils/csv.ts`) font l'extraction et le regroupement ;
`parseCsvStudentNames` reste dédié au format une-seule-classe.

### Trois modes d'import

- **Ajouter des élèves** (`addElevesToExistingClasses`) — chaque groupe est rattaché à la classe
  existante de même nom (accents/casse ignorés) dans l'établissement choisi ; un code sans
  correspondance est ignoré et signalé, jamais silencieusement perdu.
- **Ajouter des classes** (`addClassesFromRoster`) — une nouvelle classe par groupe, nommée d'après
  son code CSV ; si une classe de ce nom existe déjà dans l'établissement, ses élèves sont
  complétés au lieu de dupliquer la classe.
- **Repartir de zéro** (`resetAndImportRoster`) — supprime établissements, classes, élèves et
  événements existants (démo incluse) puis insère le fichier dans un nouvel établissement. Les tags
  et catégories de comportement sont conservés : ce n'est pas une donnée de roster. Geste
  destructif, protégé par une case à cocher de confirmation dans l'UI.

### Doublons

Un même import relancé deux fois (ou un fichier qui contient déjà un homonyme) ne doit jamais
produire deux classes de même nom dans un établissement, ni deux élèves du même nom dans une même
classe : les trois actions ci-dessus comparent nom de classe et nom d'élève (accents/casse
ignorés) contre ce qui existe déjà — et, pour un même import, contre ce que l'import est en train
d'ajouter — avant d'insérer quoi que ce soit. Ce qui est ignoré (classe déjà existante avec ses
élèves complétés, élève déjà présent) est résumé à l'utilisateur dans la feuille d'import après
l'exécution, jamais silencieusement perdu.

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

Corollaire assumé : **le minimum de 6 caractères vient de la maquette et reste bas.** La clé de
récupération (voir plus bas) protège contre l'oubli, pas contre un serveur compromis qui attaque le
mot de passe hors-ligne — les deux wrappings du DEK sont indépendants, donc un mot de passe faible
reste un mot de passe faible même une fois une clé de récupération configurée.

Le nombre d'itérations renvoyé par le serveur est en revanche **refusé s'il est inférieur au
minimum** (`assertUsableKdfParams`) : sans ce garde-fou, un serveur répondant `1` obtiendrait un
`authSecret` dérivé en microsecondes, assez bon marché pour remonter au mot de passe.

### Clé de récupération

Le mot de passe seul suffisait tant qu'on acceptait qu'un mot de passe perdu soit un carnet perdu.
La clé de récupération (`src/crypto/recoveryKey.ts`, `src/crypto/kdf.ts:deriveRecoveryCredentials`)
retire ce risque sans toucher au reste du schéma : 32 octets aléatoires, encodés en base32 groupé
(alphabet RFC 4648 sans `0`/`O`/`1`/`I`/`l`, pensé pour être noté à la main plutôt que retapé de
mémoire), qui wrappent le même DEK sous une seconde clé dérivée par HKDF — pas de PBKDF2, l'entropie
est déjà là.

Pourquoi pas un lien de réinitialisation par email comme la plupart des apps ? Parce qu'un tel lien
suppose que le serveur puisse redonner accès au carnet sans le mot de passe — donc qu'il puisse le
faire aussi de lui-même. C'est exactement ce que le chiffrement bout-en-bout interdit ; la clé de
récupération est l'équivalent qui ne demande cette confiance à personne (même mécanisme que la
phrase de récupération de Proton Mail ou l'export chiffré de Bitwarden).

- **À l'inscription**, la clé est générée pendant que le DEK fraîchement créé est encore
  extractible — le seul moment où ça ne coûte pas de redemander le mot de passe. `useAuthStore.signup`
  l'envoie au serveur en best-effort une fois le compte créé : un échec n'empêche pas de continuer,
  et se logue plutôt que de disparaître en silence (une vraie panne y est passée inaperçue une fois).
- **Depuis Réglages**, `setupRecovery` (re)génère une clé en redérivant la KEK à partir du mot de
  passe actuel — nécessaire puisque l'appareil ne garde jamais qu'une copie non extractible du DEK.
- **« Mot de passe oublié »** (`RecoverForm`) est un flux à deux appels : `startRecovery` échange la
  clé contre le DEK chiffré et le déballe localement ; `completeRecovery` choisit le nouveau mot de
  passe, re-chiffre le DEK sous ce mot de passe **et** sous une clé de récupération neuve — celle qui
  vient de servir ne fonctionne plus ensuite.
- **`RecoveryKeyReveal`** est monté une seule fois, dans `AppShell`, et regardé via
  `pendingRecoveryKey` : sign-up, régénération et récupération réussie y aboutissent tous une fois le
  carnet déjà déverrouillé, donc un seul composant suffit à l'afficher.
- Disponible aussi depuis l'écran **`locked`** (déverrouillage hors-ligne) : ce n'est pas parce que
  l'appareil a un carnet local qu'il est hors réseau, et c'est justement là qu'un mot de passe
  oublié se découvre.

### Reprise du carnet d'avant les comptes

À l'inscription, si `suivi-eleves:v1` contient un vrai carnet, il devient celui du compte ; sinon
le jeu de démo est chargé. La copie en clair n'est supprimée **qu'une fois l'écriture chiffrée
confirmée sur l'appareil** — l'effacer sur la foi d'une écriture encore en vol perdrait les notes
d'un enseignant si l'onglet se fermait entre les deux.

## Synchronisation

Par enregistrement, jamais par instantané : un instantané rendrait la fusion multi-appareil
impossible et re-téléverserait tout le carnet à chaque note. Le serveur ne range que des enveloppes
opaques et n'arbitre que sur des métadonnées en clair — révision, horodatage client, pierre
tombale. Détail du contrat côté serveur : `backend/README.md`.

Trois tranches persistées à côté du carnet (`syncMeta`, `tombstones`, `cursor`). Les entités ne
changent pas de forme ; ce qui s'ajoute, c'est **ce que l'appareil doit encore au serveur**.

### Les règles autour desquelles le moteur est construit

- **Toute action qui écrit passe par `touch` ou `bury`.** Une action qui modifierait le carnet sans
  estampiller serait parfaitement correcte à l'écran et ne quitterait jamais l'appareil : la panne
  serait silencieuse, d'où un seul helper plutôt que douze copies.
- **Un push ne fait jamais avancer le curseur.** Le serveur n'en renvoie volontairement aucun, et
  reprendre la révision qu'il vient d'attribuer ferait sauter tous les enregistrements qu'un autre
  appareil a poussés et que celui-ci n'a jamais vus.
- **Une modification locale au moins aussi récente survit au pull** et reste due — tout en prenant
  la révision du serveur, ce qui fait du prochain push un écrasement direct plutôt qu'un conflit
  qu'il gagnerait de toute façon. À égalité d'horodatage, c'est le local qui reste :
  `nextStamp()` ordonne les écritures d'un appareil, rien n'ordonne les horloges de deux, donc
  une égalité est un autre appareil qui a écrit dans la même milliseconde — pas une version déjà
  vue ici. Céder perdrait sans trace une saisie jamais envoyée ; garder coûte un push de plus, et
  la paire converge quand même.
- **Un enregistrement re-touché pendant que son push était en vol n'est jamais marqué
  synchronisé.** Le serveur détient la version d'avant cette modification.
- **Une enveloppe qui ne se déchiffre pas ne change rien** — ni le carnet, ni la comptabilité.
  C'est la mauvaise clé, ou une enveloppe déplacée d'un autre enregistrement.
- **Un genre d'enregistrement inconnu est inerte, jamais fatal.** Un client plus récent sur le même
  compte peut pousser un genre que cette version n'a nulle part où ranger. Refuser la page entière
  bloquerait aussi tous les enregistrements connus qui l'accompagnent, définitivement, puisque le
  même enregistrement revient à la page suivante. Trois couches : le transport (`api/sync.ts`)
  l'écarte de la réponse, le moteur le lit comme illisible — carnet intact, aucune révision
  enregistrée — et la table de correspondance (`sync/carnetRecords.ts`) n'a de toute façon rien à
  faire d'un genre absent de sa table, au lieu de lever sur une liste qui n'existe pas.

### Estampilles strictement croissantes

`nextStamp()` garantit qu'une estampille locale diffère toujours de la précédente. L'horloge murale
ne suffit pas : deux écritures sur le même enregistrement dans la même milliseconde porteraient le
même horodatage, et le moteur lit « même horodatage » comme « pas retouché depuis l'envoi ». Il
marquerait alors l'enregistrement synchronisé en détenant la plus ancienne des deux versions.

### Limite connue : plusieurs onglets

Le verrou de rafraîchissement des jetons (`src/api/client.ts`) est local au module, donc à
l'onglet. Deux onglets peuvent rejouer le même refresh token ; le perdant reçoit un 401 et efface
la copie de l'appareil, ce qui redemande le mot de passe au rechargement suivant. Aucune donnée
n'est perdue. Le correctif est une coordination inter-onglets (`BroadcastChannel`, ou relecture du
coffre avant de conclure à la perte) — **hors périmètre de ce lot**.
