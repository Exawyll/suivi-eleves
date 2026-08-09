import { describe, expect, it } from 'vitest'
import type { Classe, Eleve, EventItem } from '@/types/domain'
import {
  CLASSE_COLOR_COUNT,
  resolveQuickEntryTargets,
  selectActiveClasse,
  selectClasseColor,
  selectClasseNotes,
  selectClassesByEtablissement,
  selectEventsGroupedByDateLabel,
  selectMostRecentTagForEleve,
  selectOrderedClasseTabs,
  selectRecentEvents,
  selectRecentNotesForEleve,
  selectStudentsMatchingSearch,
} from '@/store/selectors'
import { SEED_CLASSES, SEED_ETABLISSEMENTS, SEED_TAGS } from '@/seed/seedData'

function makeEvent(overrides: Partial<EventItem> & Pick<EventItem, 'id'>): EventItem {
  return {
    target: { kind: 'eleve', eleveId: 's1' },
    content: { type: 'note', text: 'note' },
    dateLabel: "Aujourd'hui",
    timeLabel: '10:00',
    createdAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('selectRecentEvents', () => {
  it('sorts descending by createdAt and limits to N', () => {
    const events = [
      makeEvent({ id: 'a', createdAt: '2026-01-01T10:00:00.000Z' }),
      makeEvent({ id: 'b', createdAt: '2026-01-03T10:00:00.000Z' }),
      makeEvent({ id: 'c', createdAt: '2026-01-02T10:00:00.000Z' }),
    ]

    expect(selectRecentEvents(events, 2).map((e) => e.id)).toEqual(['b', 'c'])
  })
})

describe('selectRecentNotesForEleve', () => {
  it('filters to note-type events for that student, limited to 2, most recent first', () => {
    const events = [
      makeEvent({
        id: 'note-old',
        target: { kind: 'eleve', eleveId: 's1' },
        content: { type: 'note', text: 'old' },
        createdAt: '2026-01-01T10:00:00.000Z',
      }),
      makeEvent({
        id: 'tag-1',
        target: { kind: 'eleve', eleveId: 's1' },
        content: { type: 'tag', tagId: 't1' },
        createdAt: '2026-01-02T10:00:00.000Z',
      }),
      makeEvent({
        id: 'note-recent',
        target: { kind: 'eleve', eleveId: 's1' },
        content: { type: 'note', text: 'recent' },
        createdAt: '2026-01-03T10:00:00.000Z',
      }),
      makeEvent({
        id: 'note-other-student',
        target: { kind: 'eleve', eleveId: 's2' },
        content: { type: 'note', text: 'other' },
        createdAt: '2026-01-04T10:00:00.000Z',
      }),
      makeEvent({
        id: 'note-third',
        target: { kind: 'eleve', eleveId: 's1' },
        content: { type: 'note', text: 'third' },
        createdAt: '2026-01-05T10:00:00.000Z',
      }),
    ]

    const notes = selectRecentNotesForEleve(events, 's1', 2)
    expect(notes.map((e) => e.id)).toEqual(['note-third', 'note-recent'])
  })
})

describe('selectEventsGroupedByDateLabel', () => {
  it('groups events by dateLabel, preserving chronological order within and across groups', () => {
    const events = [
      makeEvent({ id: 'today-1', dateLabel: "Aujourd'hui" }),
      makeEvent({ id: 'today-2', dateLabel: "Aujourd'hui" }),
      makeEvent({ id: 'yesterday-1', dateLabel: 'Hier' }),
    ]

    const groups = selectEventsGroupedByDateLabel(events)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ label: "Aujourd'hui" })
    expect(groups[0]?.items.map((e) => e.id)).toEqual(['today-1', 'today-2'])
    expect(groups[1]).toMatchObject({ label: 'Hier' })
  })
})

describe('selectClassesByEtablissement', () => {
  it('groups seed classes under their établissement', () => {
    const groups = selectClassesByEtablissement(SEED_ETABLISSEMENTS, SEED_CLASSES)
    const jeanMoulin = groups.find((g) => g.etablissement.name === 'Collège Jean Moulin')
    expect(jeanMoulin?.classes.map((c) => c.name).sort()).toEqual(['4e A', '5e B'])
  })
})

describe('selectStudentsMatchingSearch', () => {
  const eleves: Eleve[] = [
    { id: 's1', classeId: 'c1', name: 'Lina Haddad' },
    { id: 's2', classeId: 'c1', name: 'Noah Girard' },
  ]

  it('returns all students for an empty query', () => {
    expect(selectStudentsMatchingSearch(eleves, '')).toHaveLength(2)
  })

  it('returns all students for a whitespace-only query', () => {
    expect(selectStudentsMatchingSearch(eleves, '   ')).toHaveLength(2)
  })

  it('matches case-insensitively on a partial name', () => {
    expect(selectStudentsMatchingSearch(eleves, 'lina').map((s) => s.id)).toEqual(['s1'])
    expect(selectStudentsMatchingSearch(eleves, 'GIRA').map((s) => s.id)).toEqual(['s2'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(selectStudentsMatchingSearch(eleves, 'zzz')).toEqual([])
  })
})

describe('selectMostRecentTagForEleve', () => {
  it('returns the tag of the most recent tag-type event', () => {
    const events = [
      makeEvent({
        id: 'tag-old',
        target: { kind: 'eleve', eleveId: 's1' },
        content: { type: 'tag', tagId: 't1' },
        createdAt: '2026-01-01T10:00:00.000Z',
      }),
      makeEvent({
        id: 'tag-recent',
        target: { kind: 'eleve', eleveId: 's1' },
        content: { type: 'tag', tagId: 't2' },
        createdAt: '2026-01-05T10:00:00.000Z',
      }),
    ]

    const tag = selectMostRecentTagForEleve(events, SEED_TAGS, 's1')
    expect(tag?.id).toBe('t2')
  })

  it('returns undefined when the student has no tag events', () => {
    const events = [
      makeEvent({
        id: 'note-only',
        target: { kind: 'eleve', eleveId: 's1' },
        content: { type: 'note', text: 'x' },
      }),
    ]

    expect(selectMostRecentTagForEleve(events, SEED_TAGS, 's1')).toBeUndefined()
  })
})

describe('resolveQuickEntryTargets', () => {
  it('resolves a classe context to a single classe target', () => {
    expect(resolveQuickEntryTargets({ kind: 'classe', classeId: 'c1' })).toEqual([
      { kind: 'classe', classeId: 'c1' },
    ])
  })

  it('resolves an eleve context to one target per selected id', () => {
    expect(resolveQuickEntryTargets({ kind: 'eleve', eleveIds: ['s1', 's2'] })).toEqual([
      { kind: 'eleve', eleveId: 's1' },
      { kind: 'eleve', eleveId: 's2' },
    ])
  })

  it('resolves a none context to an empty target list', () => {
    expect(resolveQuickEntryTargets({ kind: 'none' })).toEqual([])
  })
})

describe('selectClasseColor', () => {
  it('gives each classe a distinct token and keeps it stable across calls', () => {
    const first = selectClasseColor(SEED_CLASSES, 'c1')
    const second = selectClasseColor(SEED_CLASSES, 'c2')

    expect(first).toBe('var(--color-classe-1)')
    expect(second).toBe('var(--color-classe-2)')
    expect(selectClasseColor(SEED_CLASSES, 'c1')).toBe(first)
  })

  it('wraps around once past the number of available colours', () => {
    const many: Classe[] = Array.from({ length: CLASSE_COLOR_COUNT + 1 }, (_, i) => ({
      id: `c${i}`,
      etablissementId: 'e1',
      name: `Classe ${i}`,
      niveau: '',
    }))

    expect(selectClasseColor(many, `c${CLASSE_COLOR_COUNT}`)).toBe(selectClasseColor(many, 'c0'))
  })

  it('falls back to the first colour for an unknown classe', () => {
    expect(selectClasseColor(SEED_CLASSES, 'nope')).toBe('var(--color-classe-1)')
  })
})

describe('selectActiveClasse', () => {
  it('returns the stored classe when it still exists', () => {
    expect(selectActiveClasse(SEED_CLASSES, 'c2')?.id).toBe('c2')
  })

  it('falls back to the first classe when the stored id is stale', () => {
    expect(selectActiveClasse(SEED_CLASSES, 'deleted-classe')?.id).toBe(SEED_CLASSES[0]?.id)
  })

  it('falls back to the first classe when nothing is stored', () => {
    expect(selectActiveClasse(SEED_CLASSES, null)?.id).toBe(SEED_CLASSES[0]?.id)
  })

  it('returns undefined when there is no classe at all', () => {
    expect(selectActiveClasse([], 'c1')).toBeUndefined()
  })
})

describe('selectOrderedClasseTabs', () => {
  it('moves the pinned classe to the front, keeping the others in order', () => {
    const ordered = selectOrderedClasseTabs(SEED_CLASSES, 'c3')

    expect(ordered.map((c) => c.id)).toEqual(['c3', 'c1', 'c2'])
  })

  it('keeps the natural order when nothing is pinned', () => {
    expect(selectOrderedClasseTabs(SEED_CLASSES, null)).toEqual(SEED_CLASSES)
  })

  it('keeps the natural order when the pinned classe no longer exists', () => {
    expect(selectOrderedClasseTabs(SEED_CLASSES, 'deleted-classe')).toEqual(SEED_CLASSES)
  })
})

describe('selectClasseNotes', () => {
  it('keeps only note-type events for that classe, most recent first', () => {
    const events = [
      makeEvent({
        id: 'old-note',
        target: { kind: 'classe', classeId: 'c1' },
        content: { type: 'note', text: 'ancienne' },
        createdAt: '2026-01-01T08:00:00.000Z',
      }),
      makeEvent({
        id: 'classe-tag',
        target: { kind: 'classe', classeId: 'c1' },
        content: { type: 'tag', tagId: 't1' },
        createdAt: '2026-01-02T08:00:00.000Z',
      }),
      makeEvent({
        id: 'new-note',
        target: { kind: 'classe', classeId: 'c1' },
        content: { type: 'note', text: 'récente' },
        createdAt: '2026-01-03T08:00:00.000Z',
      }),
      makeEvent({
        id: 'other-classe',
        target: { kind: 'classe', classeId: 'c2' },
        content: { type: 'note', text: 'autre classe' },
        createdAt: '2026-01-04T08:00:00.000Z',
      }),
      makeEvent({
        id: 'eleve-note',
        target: { kind: 'eleve', eleveId: 's1' },
        content: { type: 'note', text: 'élève' },
        createdAt: '2026-01-05T08:00:00.000Z',
      }),
    ]

    expect(selectClasseNotes(events, 'c1').map((e) => e.id)).toEqual(['new-note', 'old-note'])
  })
})
