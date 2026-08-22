import { describe, expect, it } from 'vitest'
import { createAppStore, owedInFull, seededDomainState } from '@/store/useAppStore'
import { PREFERENCE_ID, syncKey } from '@/store/syncMeta'
import { createMemoryStorage } from './testStorage'

/**
 * The bookkeeping is invisible on screen, which is exactly why it needs
 * covering: an action that changed the carnet without stamping it would look
 * perfectly correct and quietly never leave the device.
 */

function freshStore() {
  return createAppStore(createMemoryStorage())
}

/** Everything the device currently owes the server. */
function dirtyKeys(meta: Record<string, { dirty: boolean }>): string[] {
  return Object.entries(meta)
    .filter(([, entry]) => entry.dirty)
    .map(([key]) => key)
    .sort()
}

describe('estampillage des mutations', () => {
  it('marque chaque évènement créé comme dû au serveur', () => {
    const store = freshStore()
    // A carnet that starts owed in full would drown the assertion; only what
    // this action stamps should be looked at.
    store.setState({ syncMeta: {} })

    store.getState().logEvent({
      targets: [{ kind: 'eleve', eleveId: 's1' }],
      tagIds: ['t1', 't2'],
      noteText: 'Bon travail',
    })

    const created = store.getState().events.slice(0, 3)
    expect(created).toHaveLength(3)
    expect(dirtyKeys(store.getState().syncMeta)).toEqual(
      created.map(({ id }) => syncKey('event', id)).sort(),
    )
    for (const { id } of created) {
      expect(store.getState().syncMeta[syncKey('event', id)]?.revision).toBeNull()
    }
  })

  it('estampille la préférence quand la classe ouverte change', () => {
    const store = freshStore()
    const classeId = store.getState().classes[1]?.id ?? ''
    store.setState({ syncMeta: {} })

    store.getState().setActiveClasse(classeId)

    expect(dirtyKeys(store.getState().syncMeta)).toEqual([syncKey('preference', PREFERENCE_ID)])
  })

  it('conserve la révision connue, sans quoi chaque modification partirait en conflit', () => {
    const store = freshStore()
    const tagId = store.getState().tags[0]?.id ?? ''
    const key = syncKey('tag', tagId)
    // As it would be after a successful push.
    store.setState({
      syncMeta: { [key]: { updatedAt: '2026-01-01T00:00:00.000Z', revision: 41, dirty: false } },
    })

    store.getState().updateTag(tagId, { name: 'Participation' })

    expect(store.getState().syncMeta[key]).toMatchObject({ revision: 41, dirty: true })
    expect(store.getState().syncMeta[key]?.updatedAt).not.toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('mutations sans effet', () => {
  it('ne doit rien devoir au serveur quand le nom de classe est inchangé', () => {
    const store = freshStore()
    const classe = store.getState().classes[0]
    store.setState({ syncMeta: {} })

    store.getState().renameClasse(classe?.id ?? '', classe?.name ?? '')

    expect(dirtyKeys(store.getState().syncMeta)).toEqual([])
  })

  it('ne doit rien devoir au serveur quand le nom de catégorie est inchangé', () => {
    const store = freshStore()
    const category = store.getState().tagCategories[0]
    store.setState({ syncMeta: {} })

    store.getState().renameTagCategory(category?.id ?? '', category?.name ?? '')

    expect(dirtyKeys(store.getState().syncMeta)).toEqual([])
  })
})

describe('suppressions', () => {
  it('pose une pierre tombale sur le tag supprimé', () => {
    const store = freshStore()
    const tagId = store.getState().tags[0]?.id ?? ''
    store.setState({ syncMeta: {}, tombstones: {} })

    store.getState().deleteTag(tagId)

    const key = syncKey('tag', tagId)
    expect(store.getState().tombstones[key]).toMatchObject({ entityType: 'tag', entityId: tagId })
    expect(store.getState().syncMeta[key]?.dirty).toBe(true)
  })

  it('pose une pierre tombale sur chaque tag emporté par la catégorie supprimée', () => {
    // A device hearing only about the category would keep the tags for ever:
    // nothing would ever tell it they are gone.
    const store = freshStore()
    const categoryId = store.getState().tagCategories[0]?.id ?? ''
    const doomed = store.getState().tags.filter((tag) => tag.categoryId === categoryId)
    expect(doomed.length).toBeGreaterThan(0)
    store.setState({ syncMeta: {}, tombstones: {} })

    store.getState().deleteTagCategory(categoryId)

    expect(Object.keys(store.getState().tombstones).sort()).toEqual(
      [syncKey('tagCategory', categoryId), ...doomed.map(({ id }) => syncKey('tag', id))].sort(),
    )
  })

  it('ne pose pas de pierre tombale sur un tag qui n’existe pas', () => {
    const store = freshStore()
    store.setState({ syncMeta: {}, tombstones: {} })

    store.getState().deleteTag('jamais-existé')

    expect(store.getState().tombstones).toEqual({})
  })
})

describe('reprise d’un carnet que le serveur n’a jamais vu', () => {
  it('doit tout le carnet de démonstration', () => {
    const seeded = seededDomainState()
    const expected = [
      ...seeded.etablissements.map(({ id }) => syncKey('etablissement', id)),
      ...seeded.classes.map(({ id }) => syncKey('classe', id)),
      ...seeded.eleves.map(({ id }) => syncKey('eleve', id)),
      ...seeded.tagCategories.map(({ id }) => syncKey('tagCategory', id)),
      ...seeded.tags.map(({ id }) => syncKey('tag', id)),
      ...seeded.events.map(({ id }) => syncKey('event', id)),
      syncKey('preference', PREFERENCE_ID),
    ].sort()

    expect(dirtyKeys(seeded.syncMeta)).toEqual(expected)
    expect(seeded.cursor).toBe(0)
  })

  it('estampille un carnet écrit par la version 1, qui n’en savait rien', async () => {
    // The trap this guards against: a teacher who has been using the app since
    // before accounts, whose carnet would otherwise look synchronised on the
    // first launch and never go up at all.
    const storage = createMemoryStorage()
    const v1 = seededDomainState()
    storage.setItem(
      'carnet:migration',
      JSON.stringify({
        version: 1,
        state: {
          etablissements: v1.etablissements,
          classes: v1.classes,
          eleves: v1.eleves,
          tagCategories: v1.tagCategories,
          tags: v1.tags,
          events: v1.events,
          hasSeeded: true,
          activeClasseId: v1.activeClasseId,
          principalClasseId: null,
        },
      }),
    )

    const store = createAppStore(storage, {
      seeded: false,
      skipHydration: true,
      name: 'carnet:migration',
    })
    await store.persist.rehydrate()

    const state = store.getState()
    expect(state.classes).toHaveLength(v1.classes.length)
    expect(dirtyKeys(state.syncMeta)).toEqual(dirtyKeys(owedInFull(v1).syncMeta))
    expect(state.cursor).toBe(0)
  })
})
