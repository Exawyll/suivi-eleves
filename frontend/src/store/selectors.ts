import type {
  Classe,
  Eleve,
  EventItem,
  EventTarget as DomainEventTarget,
  Etablissement,
  Id,
  Tag,
  TagCategory,
} from '@/types/domain'
import type { QuickEntryContext } from '@/types/ui'
import { groupBy } from '@/utils/grouping'

function byCreatedAtDesc(a: EventItem, b: EventItem): number {
  return b.createdAt.localeCompare(a.createdAt)
}

export function selectRecentEvents(events: EventItem[], limit: number): EventItem[] {
  return [...events].sort(byCreatedAtDesc).slice(0, limit)
}

export function selectEventsForEleve(events: EventItem[], eleveId: Id): EventItem[] {
  return events
    .filter((e) => e.target.kind === 'eleve' && e.target.eleveId === eleveId)
    .sort(byCreatedAtDesc)
}

export function selectEventsForClasse(events: EventItem[], classeId: Id): EventItem[] {
  return events
    .filter((e) => e.target.kind === 'classe' && e.target.classeId === classeId)
    .sort(byCreatedAtDesc)
}

export function selectRecentNotesForEleve(
  events: EventItem[],
  eleveId: Id,
  limit = 2,
): EventItem[] {
  return selectEventsForEleve(events, eleveId)
    .filter((e) => e.content.type === 'note')
    .slice(0, limit)
}

export interface DateGroup {
  label: string
  items: EventItem[]
}

/** Groups already-sorted (most-recent-first) events by their dateLabel, preserving order of first appearance. */
export function selectEventsGroupedByDateLabel(events: EventItem[]): DateGroup[] {
  const groups = groupBy(events, (e) => e.dateLabel)
  return [...groups.entries()].map(([label, items]) => ({ label, items }))
}

export function selectClasseForEleve(classes: Classe[], eleve: Eleve): Classe | undefined {
  return classes.find((c) => c.id === eleve.classeId)
}

/** Number of distinct divider colours available as `--color-classe-N` tokens. */
export const CLASSE_COLOR_COUNT = 5

/**
 * CSS colour for a classe's divider, assigned by its position in the list — the
 * mockup's own rule (`PALETTE[index % PALETTE.length]`).
 *
 * Position rather than a hash of the id: with five slots, position guarantees
 * the first five classes are all visually distinct, where a hash could collide
 * and put two dividers of the same colour side by side. The trade-off is that
 * deleting a classe shifts the colour of every classe after it. That is
 * acceptable while colours are decorative; if a colour ever becomes something a
 * teacher relies on, store it on the Classe instead of deriving it.
 */
export function selectClasseColor(classes: Classe[], classeId: Id): string {
  const index = classes.findIndex((c) => c.id === classeId)
  const slot = index < 0 ? 0 : index % CLASSE_COLOR_COUNT
  return `var(--color-classe-${slot + 1})`
}

/**
 * The classe whose divider is open. Falls back to the first classe when the
 * stored id is stale (classe deleted) or unset, so the screen is never blank.
 */
export function selectActiveClasse(
  classes: Classe[],
  activeClasseId: Id | null,
): Classe | undefined {
  return classes.find((c) => c.id === activeClasseId) ?? classes[0]
}

/** Divider stack order: the pinned classe first, everything else in its natural order. */
export function selectOrderedClasseTabs(classes: Classe[], principalClasseId: Id | null): Classe[] {
  const principal = classes.find((c) => c.id === principalClasseId)
  if (!principal) return classes
  return [principal, ...classes.filter((c) => c.id !== principal.id)]
}

/** Free-text notes logged against a whole classe, most recent first. */
export function selectClasseNotes(events: EventItem[], classeId: Id): EventItem[] {
  return selectEventsForClasse(events, classeId).filter((e) => e.content.type === 'note')
}

export function selectEtablissementForClasse(
  etablissements: Etablissement[],
  classe: Classe,
): Etablissement | undefined {
  return etablissements.find((e) => e.id === classe.etablissementId)
}

export function selectStudentsMatchingSearch(eleves: Eleve[], query: string): Eleve[] {
  const q = query.trim().toLowerCase()
  if (!q) return eleves
  return eleves.filter((s) => s.name.toLowerCase().includes(q))
}

export function selectMostRecentTagEventForEleve(
  events: EventItem[],
  eleveId: Id,
): EventItem | undefined {
  return selectEventsForEleve(events, eleveId).find((e) => e.content.type === 'tag')
}

export function selectMostRecentTagForEleve(
  events: EventItem[],
  tags: Tag[],
  eleveId: Id,
): Tag | undefined {
  const event = selectMostRecentTagEventForEleve(events, eleveId)
  if (!event || event.content.type !== 'tag') return undefined
  const tagId = event.content.tagId
  return tags.find((t) => t.id === tagId)
}

export interface TagCategoryGroup {
  category: TagCategory
  tags: Tag[]
}

export function selectTagsByCategory(categories: TagCategory[], tags: Tag[]): TagCategoryGroup[] {
  return categories.map((category) => ({
    category,
    tags: tags.filter((t) => t.categoryId === category.id),
  }))
}

/** Resolves the ephemeral quick-entry context into the concrete event targets to log against. */
export function resolveQuickEntryTargets(context: QuickEntryContext): DomainEventTarget[] {
  switch (context.kind) {
    case 'classe':
      return [{ kind: 'classe', classeId: context.classeId }]
    case 'eleve':
      return context.eleveIds.map((eleveId) => ({ kind: 'eleve', eleveId }))
    case 'none':
      return []
  }
}
