import { beforeEach, describe, expect, it } from 'vitest'
import { createAppStore } from '@/store/useAppStore'
import { SEED_CLASSES, SEED_EVENTS, SEED_TAGS } from '@/seed/seedData'
import { createMemoryStorage } from './testStorage'

describe('useAppStore: logEvent', () => {
  it('creates exactly 1 event for 1 target + 1 tag, no note', () => {
    const store = createAppStore(createMemoryStorage())
    const before = store.getState().events.length

    store.getState().logEvent({
      targets: [{ kind: 'eleve', eleveId: 's1' }],
      tagIds: ['t1'],
      noteText: '',
    })

    const events = store.getState().events
    expect(events.length).toBe(before + 1)
    expect(events[0]).toMatchObject({
      target: { kind: 'eleve', eleveId: 's1' },
      content: { type: 'tag', tagId: 't1' },
    })
  })

  it('fans out 2 targets x 2 tags + a note into exactly 6 events, correctly attributed', () => {
    const store = createAppStore(createMemoryStorage())
    const before = store.getState().events.length

    store.getState().logEvent({
      targets: [
        { kind: 'eleve', eleveId: 's1' },
        { kind: 'eleve', eleveId: 's2' },
      ],
      tagIds: ['t1', 't2'],
      noteText: 'Bon travail en groupe',
    })

    const newEvents = store.getState().events.slice(0, 6)
    expect(store.getState().events.length).toBe(before + 6)

    const forS1 = newEvents.filter((e) => e.target.kind === 'eleve' && e.target.eleveId === 's1')
    const forS2 = newEvents.filter((e) => e.target.kind === 'eleve' && e.target.eleveId === 's2')
    expect(forS1).toHaveLength(3)
    expect(forS2).toHaveLength(3)

    const tagEventsForS1 = forS1.filter((e) => e.content.type === 'tag')
    const noteEventsForS1 = forS1.filter((e) => e.content.type === 'note')
    expect(tagEventsForS1).toHaveLength(2)
    expect(noteEventsForS1).toHaveLength(1)
    expect(noteEventsForS1[0]?.content).toMatchObject({ text: 'Bon travail en groupe' })

    // no cross-contamination: no event mixes s1/s2 targets
    for (const e of newEvents) {
      expect(e.target.kind).toBe('eleve')
    }
  })

  it('is a no-op when there are no targets (events array reference unchanged)', () => {
    const store = createAppStore(createMemoryStorage())
    const before = store.getState().events

    store.getState().logEvent({ targets: [], tagIds: ['t1'], noteText: 'peu importe' })

    expect(store.getState().events).toBe(before)
  })

  it('is a no-op when there are targets but no tags and an empty note', () => {
    const store = createAppStore(createMemoryStorage())
    const before = store.getState().events

    store.getState().logEvent({
      targets: [{ kind: 'eleve', eleveId: 's1' }],
      tagIds: [],
      noteText: '   ',
    })

    expect(store.getState().events).toBe(before)
  })

  it('does not log a whitespace-only note but trims a real note', () => {
    const store = createAppStore(createMemoryStorage())

    store.getState().logEvent({
      targets: [{ kind: 'eleve', eleveId: 's1' }],
      tagIds: [],
      noteText: '   texte utile   ',
    })

    const [latest] = store.getState().events
    expect(latest?.content).toMatchObject({ type: 'note', text: 'texte utile' })
  })

  it('logs a class-level event when targeting a classe', () => {
    const store = createAppStore(createMemoryStorage())

    store.getState().logEvent({
      targets: [{ kind: 'classe', classeId: 'c1' }],
      tagIds: [],
      noteText: 'Sortie annulée',
    })

    const [latest] = store.getState().events
    expect(latest?.target).toEqual({ kind: 'classe', classeId: 'c1' })
  })
})

describe('useAppStore: tag categories', () => {
  it('creates a new category and returns its id', () => {
    const store = createAppStore(createMemoryStorage())
    const before = store.getState().tagCategories.length

    const id = store.getState().createTagCategory('Ponctualité')

    expect(store.getState().tagCategories).toHaveLength(before + 1)
    expect(store.getState().tagCategories.find((c) => c.id === id)?.name).toBe('Ponctualité')
  })

  it('returns the existing id when a category with the same name (case-insensitive) exists', () => {
    const store = createAppStore(createMemoryStorage())
    const firstId = store.getState().createTagCategory('Comportement')
    const before = store.getState().tagCategories.length

    const secondId = store.getState().createTagCategory('COMPORTEMENT')

    expect(secondId).toBe(firstId)
    expect(store.getState().tagCategories).toHaveLength(before)
  })
})

describe('useAppStore: tags', () => {
  it('rejects creating a tag with an empty/whitespace name', () => {
    const store = createAppStore(createMemoryStorage())
    const before = store.getState().tags.length

    const id = store.getState().createTag({
      categoryId: 'cat1',
      emoji: '🏷️',
      name: '   ',
      variant: 'neutral',
    })

    expect(id).toBe('')
    expect(store.getState().tags).toHaveLength(before)
  })

  it('creates a tag with a generated unique id', () => {
    const store = createAppStore(createMemoryStorage())
    const before = store.getState().tags.length

    const id = store.getState().createTag({
      categoryId: 'cat1',
      emoji: '🎯',
      name: 'Objectif atteint',
      variant: 'accent',
    })

    expect(id).not.toBe('')
    expect(store.getState().tags).toHaveLength(before + 1)
    expect(store.getState().tags.find((t) => t.id === id)).toMatchObject({
      name: 'Objectif atteint',
      variant: 'accent',
    })
  })

  it('updateTag merges a partial patch without touching unrelated fields', () => {
    const store = createAppStore(createMemoryStorage())
    const target = store.getState().tags[0]
    if (!target) throw new Error('expected at least one seed tag')

    store.getState().updateTag(target.id, { name: 'Nouveau nom' })

    const updated = store.getState().tags.find((t) => t.id === target.id)
    expect(updated?.name).toBe('Nouveau nom')
    expect(updated?.emoji).toBe(target.emoji)
    expect(updated?.categoryId).toBe(target.categoryId)
  })

  it('updateTag is a no-op for an unknown id', () => {
    const store = createAppStore(createMemoryStorage())
    const before = store.getState().tags

    store.getState().updateTag('does-not-exist', { name: 'X' })

    expect(store.getState().tags).toBe(before)
  })

  it('deleteTag removes the tag but leaves historical events referencing it untouched', () => {
    const store = createAppStore(createMemoryStorage())
    const tagId = SEED_TAGS[0]?.id
    if (!tagId) throw new Error('expected seed tags')
    const eventsReferencingTag = store
      .getState()
      .events.filter((e) => e.content.type === 'tag' && e.content.tagId === tagId)
    expect(eventsReferencingTag.length).toBeGreaterThan(0)

    store.getState().deleteTag(tagId)

    expect(store.getState().tags.find((t) => t.id === tagId)).toBeUndefined()
    const stillThere = store
      .getState()
      .events.filter((e) => e.content.type === 'tag' && e.content.tagId === tagId)
    expect(stillThere.length).toBe(eventsReferencingTag.length)
  })
})

describe('useAppStore: classes', () => {
  it('starts with the first classe open and none pinned', () => {
    const store = createAppStore(createMemoryStorage())

    expect(store.getState().activeClasseId).toBe(SEED_CLASSES[0]?.id)
    expect(store.getState().principalClasseId).toBeNull()
  })

  it('setActiveClasse switches the open divider', () => {
    const store = createAppStore(createMemoryStorage())
    const second = SEED_CLASSES[1]
    if (!second) throw new Error('expected at least two seed classes')

    store.getState().setActiveClasse(second.id)

    expect(store.getState().activeClasseId).toBe(second.id)
  })

  it('setActiveClasse ignores an unknown classe', () => {
    const store = createAppStore(createMemoryStorage())
    const before = store.getState().activeClasseId

    store.getState().setActiveClasse('does-not-exist')

    expect(store.getState().activeClasseId).toBe(before)
  })

  it('togglePrincipalClasse pins, then unpins the same classe', () => {
    const store = createAppStore(createMemoryStorage())
    const classeId = SEED_CLASSES[1]?.id
    if (!classeId) throw new Error('expected at least two seed classes')

    store.getState().togglePrincipalClasse(classeId)
    expect(store.getState().principalClasseId).toBe(classeId)

    store.getState().togglePrincipalClasse(classeId)
    expect(store.getState().principalClasseId).toBeNull()
  })

  it('togglePrincipalClasse moves the pin when a different classe is starred', () => {
    const store = createAppStore(createMemoryStorage())
    const [first, second] = SEED_CLASSES
    if (!first || !second) throw new Error('expected at least two seed classes')

    store.getState().togglePrincipalClasse(first.id)
    store.getState().togglePrincipalClasse(second.id)

    expect(store.getState().principalClasseId).toBe(second.id)
  })

  it('renameClasse trims the new name', () => {
    const store = createAppStore(createMemoryStorage())
    const classeId = SEED_CLASSES[0]?.id
    if (!classeId) throw new Error('expected seed classes')

    store.getState().renameClasse(classeId, '  6e A  ')

    expect(store.getState().classes.find((c) => c.id === classeId)?.name).toBe('6e A')
  })

  it('renameClasse is a no-op when the name is unchanged', () => {
    const store = createAppStore(createMemoryStorage())
    const classe = store.getState().classes[0]
    if (!classe) throw new Error('expected seed classes')
    const before = store.getState().classes

    // Committing the field without editing, and the same name re-padded.
    store.getState().renameClasse(classe.id, classe.name)
    store.getState().renameClasse(classe.id, `  ${classe.name}  `)

    expect(store.getState().classes).toBe(before)
  })

  it('renameClasse ignores an unknown classe', () => {
    const store = createAppStore(createMemoryStorage())
    const before = store.getState().classes

    store.getState().renameClasse('does-not-exist', 'Peu importe')

    expect(store.getState().classes).toBe(before)
  })

  it('renameClasse ignores an empty or whitespace-only name', () => {
    const store = createAppStore(createMemoryStorage())
    const before = store.getState().classes

    store.getState().renameClasse(before[0]?.id ?? '', '   ')

    expect(store.getState().classes).toBe(before)
  })

  it('persists the open and pinned classe across store instances', () => {
    const storage = createMemoryStorage()
    const second = SEED_CLASSES[1]
    if (!second) throw new Error('expected at least two seed classes')

    const first = createAppStore(storage)
    first.getState().setActiveClasse(second.id)
    first.getState().togglePrincipalClasse(second.id)

    const reloaded = createAppStore(storage)
    expect(reloaded.getState().activeClasseId).toBe(second.id)
    expect(reloaded.getState().principalClasseId).toBe(second.id)
  })
})

describe('useAppStore: seed-on-first-run', () => {
  it('seeds domain data when storage was empty (first run)', () => {
    const store = createAppStore(createMemoryStorage())

    expect(store.getState().hasSeeded).toBe(true)
    expect(store.getState().events.length).toBe(SEED_EVENTS.length)
    expect(store.getState().tags.length).toBe(SEED_TAGS.length)
  })

  it('does not re-seed over a previously persisted (even emptied) store', () => {
    const storage = createMemoryStorage()

    // First run: seeds, then the user deletes everything.
    const first = createAppStore(storage)
    first.setState({ tags: [], events: [], tagCategories: [] })

    // Simulate a fresh app load reading from the same storage.
    const second = createAppStore(storage)

    expect(second.getState().tags).toEqual([])
    expect(second.getState().events).toEqual([])
    expect(second.getState().tagCategories).toEqual([])
  })
})

describe('useAppStore: persistence smoke test', () => {
  beforeEach(() => {
    // nothing shared between tests — each test builds its own store/storage
  })

  it('persists logged events across store instances sharing the same storage', () => {
    const storage = createMemoryStorage()
    const first = createAppStore(storage)
    first.getState().logEvent({
      targets: [{ kind: 'eleve', eleveId: 's1' }],
      tagIds: ['t1'],
      noteText: '',
    })
    const countAfterFirst = first.getState().events.length

    const second = createAppStore(storage)
    expect(second.getState().events.length).toBe(countAfterFirst)
  })
})

describe('useAppStore: établissements & class import', () => {
  it('creates an établissement and returns its id', () => {
    const store = createAppStore(createMemoryStorage())
    const before = store.getState().etablissements.length

    const id = store.getState().createEtablissement('Lycée Victor Hugo')

    expect(store.getState().etablissements).toHaveLength(before + 1)
    expect(store.getState().etablissements.find((e) => e.id === id)?.name).toBe('Lycée Victor Hugo')
  })

  it('trims the name and rejects an empty one', () => {
    const store = createAppStore(createMemoryStorage())
    const before = store.getState().etablissements

    expect(store.getState().createEtablissement('   ')).toBe('')
    expect(store.getState().etablissements).toBe(before)

    const id = store.getState().createEtablissement('  Collège Jaurès  ')
    expect(store.getState().etablissements.find((e) => e.id === id)?.name).toBe('Collège Jaurès')
  })

  it('reuses an existing établissement with the same name, case-insensitively', () => {
    const store = createAppStore(createMemoryStorage())
    const firstId = store.getState().createEtablissement('Collège Jaurès')
    const before = store.getState().etablissements.length

    const secondId = store.getState().createEtablissement('COLLÈGE JAURÈS')

    expect(secondId).toBe(firstId)
    expect(store.getState().etablissements).toHaveLength(before)
  })

  it('creates a classe with its students and opens it', () => {
    const store = createAppStore(createMemoryStorage())
    const etablissementId = store.getState().etablissements[0]?.id
    if (!etablissementId) throw new Error('expected a seed établissement')

    const classeId = store.getState().createClasseWithEleves({
      etablissementId,
      name: '6e C',
      eleveNames: ['Lina Haddad', 'Noah Girard'],
    })

    const classe = store.getState().classes.find((c) => c.id === classeId)
    expect(classe).toMatchObject({ name: '6e C', etablissementId })
    expect(store.getState().eleves.filter((e) => e.classeId === classeId)).toHaveLength(2)
    // The teacher just imported it — show it.
    expect(store.getState().activeClasseId).toBe(classeId)
  })

  it('skips blank student names in the imported roster', () => {
    const store = createAppStore(createMemoryStorage())
    const etablissementId = store.getState().etablissements[0]?.id
    if (!etablissementId) throw new Error('expected a seed établissement')

    const classeId = store.getState().createClasseWithEleves({
      etablissementId,
      name: '6e D',
      eleveNames: ['Lina Haddad', '   ', '', 'Noah Girard'],
    })

    expect(store.getState().eleves.filter((e) => e.classeId === classeId)).toHaveLength(2)
  })

  it('gives every imported student a distinct id', () => {
    const store = createAppStore(createMemoryStorage())
    const etablissementId = store.getState().etablissements[0]?.id
    if (!etablissementId) throw new Error('expected a seed établissement')

    // Two students genuinely sharing a name must stay two records.
    const classeId = store.getState().createClasseWithEleves({
      etablissementId,
      name: '6e E',
      eleveNames: ['Marie Dupont', 'Marie Dupont'],
    })

    const ids = store
      .getState()
      .eleves.filter((e) => e.classeId === classeId)
      .map((e) => e.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('rejects a classe with an empty name or an unknown établissement', () => {
    const store = createAppStore(createMemoryStorage())
    const etablissementId = store.getState().etablissements[0]?.id
    if (!etablissementId) throw new Error('expected a seed établissement')
    const before = store.getState().classes

    expect(
      store.getState().createClasseWithEleves({ etablissementId, name: '  ', eleveNames: ['A'] }),
    ).toBe('')
    expect(
      store
        .getState()
        .createClasseWithEleves({ etablissementId: 'nope', name: '6e F', eleveNames: ['A'] }),
    ).toBe('')
    expect(store.getState().classes).toBe(before)
  })
})
