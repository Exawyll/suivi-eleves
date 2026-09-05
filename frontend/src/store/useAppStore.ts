import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type {
  Classe,
  Eleve,
  EventItem,
  EventTarget,
  Etablissement,
  Id,
  Tag,
  TagCategory,
} from '@/types/domain'
import {
  SEED_CLASSES,
  SEED_ELEVES,
  SEED_ETABLISSEMENTS,
  SEED_EVENTS,
  SEED_TAGS,
  SEED_TAG_CATEGORIES,
} from '@/seed/seedData'
import type { RosterGroup } from '@/utils/csv'
import { resolveDefaultStorage } from '@/store/memoryStorage'
import {
  nextStamp,
  PREFERENCE_ID,
  syncKey,
  type SyncEntityType,
  type SyncRecordMeta,
  type Tombstone,
} from '@/store/syncMeta'
import { generateId } from '@/utils/id'
import { toDateLabel, toTimeLabel } from '@/utils/dateLabels'

export interface CreateClasseInput {
  etablissementId: Id
  name: string
  niveau?: string
  eleveNames: string[]
}

export interface LogEventInput {
  targets: EventTarget[]
  tagIds: Id[]
  noteText: string
}

export interface AddElevesToExistingClassesResult {
  addedCount: number
  /** Roster groups whose classe code matched no existing classe in the établissement — not inserted. */
  unmatchedCodes: string[]
}

/**
 * What the synchronisation engine reads and writes, and nothing the screens
 * care about. Persisted alongside the carnet because a device that forgot
 * which records it still owes the server would push the whole carnet again.
 */
export interface SyncSlices {
  /** Keyed by `syncKey`. One entry per record the device has ever written. */
  syncMeta: Record<string, SyncRecordMeta>
  /** Keyed by `syncKey`. Deletions still travelling to the other devices. */
  tombstones: Record<string, Tombstone>
  /** The highest revision this device has pulled. Only a pull may move it. */
  cursor: number
}

export interface AppState extends SyncSlices {
  etablissements: Etablissement[]
  classes: Classe[]
  eleves: Eleve[]
  tagCategories: TagCategory[]
  tags: Tag[]
  events: EventItem[]
  hasSeeded: boolean
  /** Divider currently open on the Classes screen. May point at a deleted classe — resolve with `selectActiveClasse`. */
  activeClasseId: Id | null
  /** Classe pinned to the top of the divider stack. `null` when the teacher hasn't picked one. */
  principalClasseId: Id | null

  logEvent: (input: LogEventInput) => void
  createTagCategory: (name: string) => Id
  renameTagCategory: (id: Id, name: string) => void
  deleteTagCategory: (id: Id) => void
  createTag: (input: Omit<Tag, 'id'>) => Id
  updateTag: (id: Id, patch: Partial<Omit<Tag, 'id'>>) => void
  deleteTag: (id: Id) => void
  createEtablissement: (name: string) => Id
  createClasseWithEleves: (input: CreateClasseInput) => Id
  setActiveClasse: (id: Id) => void
  togglePrincipalClasse: (id: Id) => void
  renameClasse: (id: Id, name: string) => void
  addElevesToExistingClasses: (
    etablissementId: Id,
    groups: RosterGroup[],
  ) => AddElevesToExistingClassesResult
  addClassesFromRoster: (etablissementId: Id, groups: RosterGroup[]) => Id[]
  resetAndImportRoster: (etablissementName: string, groups: RosterGroup[]) => Id
}

type AppActions =
  | 'logEvent'
  | 'createTagCategory'
  | 'renameTagCategory'
  | 'deleteTagCategory'
  | 'createTag'
  | 'updateTag'
  | 'deleteTag'
  | 'createEtablissement'
  | 'createClasseWithEleves'
  | 'setActiveClasse'
  | 'togglePrincipalClasse'
  | 'renameClasse'
  | 'addElevesToExistingClasses'
  | 'addClassesFromRoster'
  | 'resetAndImportRoster'

export type DomainState = Omit<AppState, AppActions>

/** The carnet on its own, before any synchronisation bookkeeping is attached. */
export type CarnetContent = Omit<DomainState, keyof SyncSlices>

function recordsOf(content: CarnetContent): Array<[SyncEntityType, Id]> {
  return [
    ...content.etablissements.map(({ id }): [SyncEntityType, Id] => ['etablissement', id]),
    ...content.classes.map(({ id }): [SyncEntityType, Id] => ['classe', id]),
    ...content.eleves.map(({ id }): [SyncEntityType, Id] => ['eleve', id]),
    ...content.tagCategories.map(({ id }): [SyncEntityType, Id] => ['tagCategory', id]),
    ...content.tags.map(({ id }): [SyncEntityType, Id] => ['tag', id]),
    ...content.events.map(({ id }): [SyncEntityType, Id] => ['event', id]),
    ['preference', PREFERENCE_ID],
  ]
}

/**
 * Marks a whole carnet as owed to the server.
 *
 * Used wherever a carnet arrives from somewhere the server has never seen: the
 * demo one a new account starts from, the one adopted from before accounts
 * existed, and the one already on a device when this version shipped. All of
 * it has to go up, and none of it has a revision yet.
 */
export function owedInFull(content: CarnetContent, at: string = new Date().toISOString()) {
  const syncMeta: Record<string, SyncRecordMeta> = {}
  for (const [entityType, entityId] of recordsOf(content)) {
    syncMeta[syncKey(entityType, entityId)] = { updatedAt: at, revision: null, dirty: true }
  }
  return { ...content, syncMeta, tombstones: {}, cursor: 0 }
}

/** The demo carnet a brand-new account starts from. */
export function seededDomainState(): DomainState {
  // Owed in full: the demo is this account's carnet from the first second, and
  // it has to reach the teacher's other devices like anything else.
  return owedInFull({
    etablissements: SEED_ETABLISSEMENTS,
    classes: SEED_CLASSES,
    eleves: SEED_ELEVES,
    tagCategories: SEED_TAG_CATEGORIES,
    tags: SEED_TAGS,
    events: SEED_EVENTS,
    hasSeeded: true,
    activeClasseId: SEED_CLASSES[0]?.id ?? null,
    principalClasseId: null,
  })
}

/**
 * What a signed-in device holds before its vault has been read.
 *
 * Empty rather than seeded: signing in on a second device must show that
 * account's carnet, and a seed here would put a demo école in front of it for
 * as long as the vault takes to open — or permanently, on a device that has
 * nothing stored yet and is waiting for the first sync.
 */
export function emptyDomainState(): DomainState {
  return {
    etablissements: [],
    classes: [],
    eleves: [],
    tagCategories: [],
    tags: [],
    events: [],
    hasSeeded: false,
    activeClasseId: null,
    principalClasseId: null,
    // Nothing owed and nothing seen: this device is waiting for its first pull.
    syncMeta: {},
    tombstones: {},
    cursor: 0,
  }
}

/** The storage key holding one account's encrypted carnet. */
export function vaultKeyFor(userId: string): string {
  return `carnet:vault:${userId}`
}

export interface AppStoreOptions {
  /**
   * Start from the demo carnet. False for the running app, which decides at
   * sign-up whether to seed or to adopt an existing local carnet.
   */
  seeded?: boolean
  /** Wait for an explicit rehydrate — the vault key is unknown until unlock. */
  skipHydration?: boolean
  name?: string
}

export function createAppStore(
  storage: StateStorage = resolveDefaultStorage(),
  { seeded = true, skipHydration = false, name = 'suivi-eleves:v1' }: AppStoreOptions = {},
) {
  /**
   * Stamps records as changed here and now, and owed to the server.
   *
   * Every action that writes goes through this or through `bury`. An action
   * that changed the carnet without stamping would leave the record looking
   * synchronised, and the change would never leave the device — the failure
   * mode being silent is exactly why there is one helper and not twelve
   * open-coded copies.
   *
   * The revision is carried over, not cleared: it is what the next push sends
   * as `baseRevision`, and losing it would turn every edit into a conflict.
   */
  const touch = (
    state: AppState,
    ...records: ReadonlyArray<readonly [SyncEntityType, Id]>
  ): Pick<AppState, 'syncMeta'> => {
    const updatedAt = nextStamp()
    const syncMeta = { ...state.syncMeta }
    for (const [entityType, entityId] of records) {
      const key = syncKey(entityType, entityId)
      syncMeta[key] = { updatedAt, revision: syncMeta[key]?.revision ?? null, dirty: true }
    }
    return { syncMeta }
  }

  /**
   * The same, for a record that is going away.
   *
   * The tombstone is what travels: a device still holding the record would
   * otherwise push it back and undo the deletion.
   */
  const bury = (
    state: AppState,
    ...records: ReadonlyArray<readonly [SyncEntityType, Id]>
  ): Pick<AppState, 'syncMeta' | 'tombstones'> => {
    const updatedAt = nextStamp()
    const syncMeta = { ...state.syncMeta }
    const tombstones = { ...state.tombstones }
    for (const [entityType, entityId] of records) {
      const key = syncKey(entityType, entityId)
      tombstones[key] = { entityType, entityId, updatedAt }
      syncMeta[key] = { updatedAt, revision: syncMeta[key]?.revision ?? null, dirty: true }
    }
    return { syncMeta, tombstones }
  }

  return create<AppState>()(
    persist(
      (set, get) => ({
        ...(seeded ? seededDomainState() : emptyDomainState()),

        logEvent: ({ targets, tagIds, noteText }) => {
          const trimmedNote = noteText.trim()
          if (targets.length === 0) return
          if (tagIds.length === 0 && trimmedNote === '') return

          const now = new Date()
          const dateLabel = toDateLabel(now)
          const timeLabel = toTimeLabel(now)
          const createdAt = now.toISOString()
          const newEvents: EventItem[] = []

          for (const target of targets) {
            for (const tagId of tagIds) {
              newEvents.push({
                id: generateId(),
                target,
                content: { type: 'tag', tagId },
                dateLabel,
                timeLabel,
                createdAt,
              })
            }
            if (trimmedNote !== '') {
              newEvents.push({
                id: generateId(),
                target,
                content: { type: 'note', text: trimmedNote },
                dateLabel,
                timeLabel,
                createdAt,
              })
            }
          }

          set((state) => ({
            events: [...newEvents, ...state.events],
            ...touch(state, ...newEvents.map(({ id }) => ['event', id] as const)),
          }))
        },

        createTagCategory: (name) => {
          const trimmed = name.trim()
          if (trimmed === '') return ''
          const existing = get().tagCategories.find(
            (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
          )
          if (existing) return existing.id
          const id = generateId()
          set((state) => ({
            tagCategories: [...state.tagCategories, { id, name: trimmed }],
            ...touch(state, ['tagCategory', id]),
          }))
          return id
        },

        renameTagCategory: (id, name) => {
          const trimmed = name.trim()
          if (trimmed === '') return
          set((state) => {
            const current = state.tagCategories.find((c) => c.id === id)
            if (!current || current.name === trimmed) return {}
            return {
              tagCategories: state.tagCategories.map((c) =>
                c.id === id ? { ...c, name: trimmed } : c,
              ),
              ...touch(state, ['tagCategory', id]),
            }
          })
        },

        /**
         * Deleting a category takes its tags with it — a tag without a category
         * has nowhere to appear in the Tags screen or the Quick Entry sheet.
         * Past events are deliberately left alone: history is a record of what
         * happened, and the UI already renders a ghost chip for a tag that no
         * longer exists.
         */
        deleteTagCategory: (id) => {
          set((state) => {
            if (!state.tagCategories.some((c) => c.id === id)) return {}
            const orphaned = state.tags.filter((t) => t.categoryId === id)
            return {
              tagCategories: state.tagCategories.filter((c) => c.id !== id),
              tags: state.tags.filter((t) => t.categoryId !== id),
              // The tags go with it, so each one needs its own tombstone: a
              // device that only hears about the category would keep them.
              ...bury(
                state,
                ['tagCategory', id],
                ...orphaned.map(({ id: tagId }) => ['tag', tagId] as const),
              ),
            }
          })
        },

        createTag: (input) => {
          const name = input.name.trim()
          if (name === '') return ''
          const id = generateId()
          set((state) => ({
            tags: [...state.tags, { ...input, name, id }],
            ...touch(state, ['tag', id]),
          }))
          return id
        },

        updateTag: (id, patch) => {
          set((state) => {
            if (!state.tags.some((t) => t.id === id)) return {}
            return {
              tags: state.tags.map((t) => (t.id === id ? { ...t, ...patch } : t)),
              ...touch(state, ['tag', id]),
            }
          })
        },

        deleteTag: (id) => {
          set((state) => {
            if (!state.tags.some((t) => t.id === id)) return {}
            return { tags: state.tags.filter((t) => t.id !== id), ...bury(state, ['tag', id]) }
          })
        },

        createEtablissement: (name) => {
          const trimmed = name.trim()
          if (trimmed === '') return ''
          const existing = get().etablissements.find(
            (e) => e.name.toLowerCase() === trimmed.toLowerCase(),
          )
          if (existing) return existing.id
          const id = generateId()
          set((state) => ({
            etablissements: [...state.etablissements, { id, name: trimmed }],
            ...touch(state, ['etablissement', id]),
          }))
          return id
        },

        /**
         * Creates the classe and its students in one write, then opens it: the
         * teacher has just imported a roster and wants to see it.
         */
        createClasseWithEleves: ({ etablissementId, name, niveau = '', eleveNames }) => {
          const trimmedName = name.trim()
          if (trimmedName === '') return ''
          if (!get().etablissements.some((e) => e.id === etablissementId)) return ''

          const classeId = generateId()
          const eleves: Eleve[] = eleveNames
            .map((eleveName) => eleveName.trim())
            .filter((eleveName) => eleveName !== '')
            .map((eleveName) => ({ id: generateId(), classeId, name: eleveName }))

          set((state) => ({
            classes: [
              ...state.classes,
              { id: classeId, etablissementId, name: trimmedName, niveau },
            ],
            eleves: [...state.eleves, ...eleves],
            activeClasseId: classeId,
            // The open classe lives in the preference record, so opening this
            // one changes that record too.
            ...touch(
              state,
              ['classe', classeId],
              ...eleves.map(({ id }) => ['eleve', id] as const),
              ['preference', PREFERENCE_ID],
            ),
          }))
          return classeId
        },

        setActiveClasse: (id) => {
          set((state) =>
            // Reopening the classe that is already open changes nothing, and
            // must not stamp the preference: it would owe the server a record
            // identical to the one it holds, and that push carries a newer
            // timestamp — enough to outrank a pin another device just made.
            state.activeClasseId !== id && state.classes.some((c) => c.id === id)
              ? { activeClasseId: id, ...touch(state, ['preference', PREFERENCE_ID]) }
              : {},
          )
        },

        /** Pinning the classe that's already pinned unpins it, as in the mockup's star toggle. */
        togglePrincipalClasse: (id) => {
          set((state) => {
            if (!state.classes.some((c) => c.id === id)) return {}
            return {
              principalClasseId: state.principalClasseId === id ? null : id,
              ...touch(state, ['preference', PREFERENCE_ID]),
            }
          })
        },

        renameClasse: (id, name) => {
          const trimmed = name.trim()
          if (trimmed === '') return
          set((state) => {
            const current = state.classes.find((c) => c.id === id)
            // Committing an unchanged name must not write: it would mark the
            // record dirty and push a mutation that changes nothing.
            if (!current || current.name === trimmed) return {}
            return {
              classes: state.classes.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
              ...touch(state, ['classe', id]),
            }
          })
        },

        /**
         * "Ajout d'élèves" import mode: each roster group is matched against an
         * existing classe in the établissement by exact name (the CSV's raw
         * classe code). A group with no match is skipped and reported, rather
         * than silently dropped or turned into a surprise new classe.
         */
        addElevesToExistingClasses: (etablissementId, groups) => {
          const classesInEtab = get().classes.filter((c) => c.etablissementId === etablissementId)
          const unmatchedCodes: string[] = []
          const newEleves: Eleve[] = []

          for (const group of groups) {
            const classe = classesInEtab.find((c) => c.name === group.classeCode)
            if (!classe) {
              unmatchedCodes.push(group.classeCode)
              continue
            }
            for (const rawName of group.eleveNames) {
              const name = rawName.trim()
              if (name === '') continue
              newEleves.push({ id: generateId(), classeId: classe.id, name })
            }
          }

          if (newEleves.length > 0) {
            set((state) => ({
              eleves: [...state.eleves, ...newEleves],
              ...touch(state, ...newEleves.map(({ id }) => ['eleve', id] as const)),
            }))
          }

          return { addedCount: newEleves.length, unmatchedCodes }
        },

        /**
         * "Ajout de classes" import mode: one new classe per roster group,
         * named after its raw CSV classe code, plus its students.
         */
        addClassesFromRoster: (etablissementId, groups) => {
          if (!get().etablissements.some((e) => e.id === etablissementId)) return []

          const newClasses: Classe[] = []
          const newEleves: Eleve[] = []

          for (const group of groups) {
            const code = group.classeCode.trim()
            if (code === '') continue
            const classeId = generateId()
            newClasses.push({ id: classeId, etablissementId, name: code, niveau: '' })
            for (const rawName of group.eleveNames) {
              const name = rawName.trim()
              if (name === '') continue
              newEleves.push({ id: generateId(), classeId, name })
            }
          }

          if (newClasses.length === 0) return []

          set((state) => ({
            classes: [...state.classes, ...newClasses],
            eleves: [...state.eleves, ...newEleves],
            activeClasseId: newClasses[0]?.id ?? state.activeClasseId,
            ...touch(
              state,
              ...newClasses.map(({ id }) => ['classe', id] as const),
              ...newEleves.map(({ id }) => ['eleve', id] as const),
              ['preference', PREFERENCE_ID],
            ),
          }))

          return newClasses.map((c) => c.id)
        },

        /**
         * "Repartir de zéro" import mode: wipes every établissement, classe,
         * élève and event — démo data or real, it's all going up as tombstones
         * so other devices drop it too — then inserts a fresh établissement
         * with the imported classes and students. Tags and their categories
         * are left alone: they're reusable behaviour configuration, not roster
         * data, and there's no reason a fresh roster should lose them.
         */
        resetAndImportRoster: (etablissementName, groups) => {
          const trimmedName = etablissementName.trim()
          if (trimmedName === '') return ''

          const etablissementId = generateId()
          const newClasses: Classe[] = []
          const newEleves: Eleve[] = []

          for (const group of groups) {
            const code = group.classeCode.trim()
            if (code === '') continue
            const classeId = generateId()
            newClasses.push({ id: classeId, etablissementId, name: code, niveau: '' })
            for (const rawName of group.eleveNames) {
              const name = rawName.trim()
              if (name === '') continue
              newEleves.push({ id: generateId(), classeId, name })
            }
          }

          set((state) => {
            const buried = bury(
              state,
              ...state.etablissements.map(({ id }) => ['etablissement', id] as const),
              ...state.classes.map(({ id }) => ['classe', id] as const),
              ...state.eleves.map(({ id }) => ['eleve', id] as const),
              ...state.events.map(({ id }) => ['event', id] as const),
            )
            const stateAfterBury: AppState = {
              ...state,
              syncMeta: buried.syncMeta,
              tombstones: buried.tombstones,
            }
            const touched = touch(
              stateAfterBury,
              ['etablissement', etablissementId],
              ...newClasses.map(({ id }) => ['classe', id] as const),
              ...newEleves.map(({ id }) => ['eleve', id] as const),
              ['preference', PREFERENCE_ID],
            )

            return {
              etablissements: [{ id: etablissementId, name: trimmedName }],
              classes: newClasses,
              eleves: newEleves,
              events: [],
              activeClasseId: newClasses[0]?.id ?? null,
              principalClasseId: null,
              syncMeta: touched.syncMeta,
              tombstones: buried.tombstones,
            }
          })

          return etablissementId
        },
      }),
      {
        name,
        version: 2,
        skipHydration,
        storage: createJSONStorage(() => storage),
        /**
         * Version 1 knew nothing about synchronisation, so a carnet written by
         * it has no bookkeeping at all — and the server has never seen a line
         * of it. Every record is stamped as owed, which is what sends the
         * whole carnet up on the first sync instead of quietly stranding it on
         * this device.
         */
        migrate: (persisted, version) => {
          const state = persisted as DomainState
          if (version >= 2) return state
          return owedInFull(state)
        },
        partialize: (state) => ({
          etablissements: state.etablissements,
          classes: state.classes,
          eleves: state.eleves,
          tagCategories: state.tagCategories,
          tags: state.tags,
          events: state.events,
          hasSeeded: state.hasSeeded,
          activeClasseId: state.activeClasseId,
          principalClasseId: state.principalClasseId,
          syncMeta: state.syncMeta,
          tombstones: state.tombstones,
          cursor: state.cursor,
        }),
      },
    ),
  )
}

/**
 * The application's store. It starts empty and unhydrated: which vault to open
 * depends on who signs in, and with which key, so `useAuthStore` points it at
 * one and rehydrates it once the data key is available.
 */
export const useAppStore = createAppStore(resolveDefaultStorage(), {
  seeded: false,
  skipHydration: true,
})
