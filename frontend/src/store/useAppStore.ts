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
  createTag: (input: Omit<Tag, 'id'>) => Id
  updateTag: (id: Id, patch: Partial<Omit<Tag, 'id'>>) => void
  deleteTag: (id: Id) => void
  setActiveClasse: (id: Id) => void
  togglePrincipalClasse: (id: Id) => void
  renameClasse: (id: Id, name: string) => void
}

type AppActions =
  | 'logEvent'
  | 'createTagCategory'
  | 'createTag'
  | 'updateTag'
  | 'deleteTag'
  | 'setActiveClasse'
  | 'togglePrincipalClasse'
  | 'renameClasse'

/**
 * Seeded on first run only: this is the creator's initial state. Zustand's
 * persist middleware overwrites it wholesale with whatever was previously
 * saved to storage (even empty arrays), so a returning user's data is never
 * clobbered — only a truly empty storage leaves this seed data in place.
 */
function initialDomainState(): Omit<AppState, AppActions> {
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

export function createAppStore(storage: StateStorage = resolveDefaultStorage()) {
  return create<AppState>()(
    persist(
      (set, get) => ({
        ...initialDomainState(),

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
        name: 'suivi-eleves:v1',
        version: 1,
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

export const useAppStore = createAppStore()
