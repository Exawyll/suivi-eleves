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
import { resolveDefaultStorage } from '@/store/memoryStorage'
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

export interface AppState {
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

export type DomainState = Omit<AppState, AppActions>

/** The demo carnet a brand-new account starts from. */
export function seededDomainState(): DomainState {
  return {
    etablissements: SEED_ETABLISSEMENTS,
    classes: SEED_CLASSES,
    eleves: SEED_ELEVES,
    tagCategories: SEED_TAG_CATEGORIES,
    tags: SEED_TAGS,
    events: SEED_EVENTS,
    hasSeeded: true,
    activeClasseId: SEED_CLASSES[0]?.id ?? null,
    principalClasseId: null,
  }
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

          set((state) => ({ events: [...newEvents, ...state.events] }))
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
            return {
              tagCategories: state.tagCategories.filter((c) => c.id !== id),
              tags: state.tags.filter((t) => t.categoryId !== id),
            }
          })
        },

        createTag: (input) => {
          const name = input.name.trim()
          if (name === '') return ''
          const id = generateId()
          set((state) => ({ tags: [...state.tags, { ...input, name, id }] }))
          return id
        },

        updateTag: (id, patch) => {
          set((state) => {
            if (!state.tags.some((t) => t.id === id)) return {}
            return { tags: state.tags.map((t) => (t.id === id ? { ...t, ...patch } : t)) }
          })
        },

        deleteTag: (id) => {
          set((state) => ({ tags: state.tags.filter((t) => t.id !== id) }))
        },

        createEtablissement: (name) => {
          const trimmed = name.trim()
          if (trimmed === '') return ''
          const existing = get().etablissements.find(
            (e) => e.name.toLowerCase() === trimmed.toLowerCase(),
          )
          if (existing) return existing.id
          const id = generateId()
          set((state) => ({ etablissements: [...state.etablissements, { id, name: trimmed }] }))
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
          }))
          return classeId
        },

        setActiveClasse: (id) => {
          set((state) => (state.classes.some((c) => c.id === id) ? { activeClasseId: id } : {}))
        },

        /** Pinning the classe that's already pinned unpins it, as in the mockup's star toggle. */
        togglePrincipalClasse: (id) => {
          set((state) => {
            if (!state.classes.some((c) => c.id === id)) return {}
            return { principalClasseId: state.principalClasseId === id ? null : id }
          })
        },

        renameClasse: (id, name) => {
          const trimmed = name.trim()
          if (trimmed === '') return
          set((state) => {
            const current = state.classes.find((c) => c.id === id)
            // Committing an unchanged name must not write: once the sync engine
            // lands it would mark the record dirty and push a pointless mutation.
            if (!current || current.name === trimmed) return {}
            return {
              classes: state.classes.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
            }
          })
        },
      }),
      {
        name,
        version: 1,
        skipHydration,
        storage: createJSONStorage(() => storage),
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
