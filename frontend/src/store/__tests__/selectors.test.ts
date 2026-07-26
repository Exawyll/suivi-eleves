import { describe, expect, it } from 'vitest'
import type { Eleve, EventItem } from '@/types/domain'
import {
  resolveQuickEntryTargets,
  selectClassesByEtablissement,
  selectEventsGroupedByDateLabel,
  selectMostRecentTagForEleve,
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
