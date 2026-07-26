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

export interface EtablissementGroup {
  etablissement: Etablissement
  classes: Classe[]
}

export function selectClassesByEtablissement(
  etablissements: Etablissement[],
  classes: Classe[],
): EtablissementGroup[] {
  return etablissements.map((etablissement) => ({
    etablissement,
    classes: classes.filter((c) => c.etablissementId === etablissement.id),
  }))
}

export function selectClasseForEleve(classes: Classe[], eleve: Eleve): Classe | undefined {
  return classes.find((c) => c.id === eleve.classeId)
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
