import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '@/store/useUiStore'
import { useAppStore } from '@/store/useAppStore'
import { SEED_TAGS } from '@/seed/seedData'

const DEFAULT_QUICK_ENTRY = {
  isOpen: false,
  mode: 'idle' as const,
  context: { kind: 'none' as const },
  isPickerOpen: false,
  pickerSearch: '',
  selectedTagIds: [],
  noteText: '',
}

const DEFAULT_TAG_EDITOR = {
  isOpen: false,
  editingTagId: null,
  emoji: '',
  name: '',
  categoryId: null,
  variant: 'neutral' as const,
}

beforeEach(() => {
  useUiStore.setState({ quickEntry: DEFAULT_QUICK_ENTRY, tagEditor: DEFAULT_TAG_EDITOR })
})

describe('useUiStore: quick entry mode transitions', () => {
  it('opens with mode "single" when given an eleve context with existing ids (FAB from a Dossier)', () => {
    useUiStore.getState().openQuickEntry({ kind: 'eleve', eleveIds: ['s1'] })

    expect(useUiStore.getState().quickEntry).toMatchObject({
      isOpen: true,
      mode: 'single',
      context: { kind: 'eleve', eleveIds: ['s1'] },
    })
  })

  it('opens with mode "idle" when given a "none" context', () => {
    useUiStore.getState().openQuickEntry({ kind: 'none' })

    expect(useUiStore.getState().quickEntry).toMatchObject({ isOpen: true, mode: 'idle' })
  })

  it('opens with a classe context untouched (no student mode semantics)', () => {
    useUiStore.getState().openQuickEntry({ kind: 'classe', classeId: 'c1' })

    expect(useUiStore.getState().quickEntry.context).toEqual({ kind: 'classe', classeId: 'c1' })
  })

  it('toggling a student from idle transitions to single mode and closes the picker', () => {
    useUiStore.getState().openQuickEntry({ kind: 'none' })
    useUiStore.getState().toggleQuickEntryPicker()

    useUiStore.getState().toggleQuickEntryStudent('s3')

    expect(useUiStore.getState().quickEntry).toMatchObject({
      mode: 'single',
      context: { kind: 'eleve', eleveIds: ['s3'] },
      isPickerOpen: false,
    })
  })

  it('switchToMultiSelect preserves the existing single selection and reopens the picker', () => {
    useUiStore.getState().openQuickEntry({ kind: 'eleve', eleveIds: ['s1'] })

    useUiStore.getState().switchToMultiSelect()

    expect(useUiStore.getState().quickEntry).toMatchObject({
      mode: 'multi',
      context: { kind: 'eleve', eleveIds: ['s1'] },
      isPickerOpen: true,
    })
  })

  it('switchToMultiSelect is a no-op outside single mode', () => {
    useUiStore.getState().openQuickEntry({ kind: 'none' }) // mode: idle
    const before = useUiStore.getState().quickEntry

    useUiStore.getState().switchToMultiSelect()

    expect(useUiStore.getState().quickEntry).toBe(before)
  })

  it('toggling a student in multi mode adds and removes from the selection', () => {
    useUiStore.getState().openQuickEntry({ kind: 'eleve', eleveIds: ['s1'] })
    useUiStore.getState().switchToMultiSelect()

    useUiStore.getState().toggleQuickEntryStudent('s2')
    expect(useUiStore.getState().quickEntry.context).toEqual({
      kind: 'eleve',
      eleveIds: ['s1', 's2'],
    })

    useUiStore.getState().toggleQuickEntryStudent('s1')
    expect(useUiStore.getState().quickEntry.context).toEqual({ kind: 'eleve', eleveIds: ['s2'] })
  })

  it('replaceSingleStudent only mutates state while in single mode', () => {
    useUiStore.getState().openQuickEntry({ kind: 'eleve', eleveIds: ['s1'] })

    useUiStore.getState().replaceSingleStudent('s4')

    expect(useUiStore.getState().quickEntry.context).toEqual({ kind: 'eleve', eleveIds: ['s4'] })
  })

  it('replaceSingleStudent is a no-op in multi mode', () => {
    useUiStore.getState().openQuickEntry({ kind: 'eleve', eleveIds: ['s1'] })
    useUiStore.getState().switchToMultiSelect()
    const before = useUiStore.getState().quickEntry

    useUiStore.getState().replaceSingleStudent('s4')

    expect(useUiStore.getState().quickEntry).toBe(before)
  })

  it('toggleQuickEntryTag supports multiple simultaneous selections and toggles off', () => {
    useUiStore.getState().toggleQuickEntryTag('t1')
    useUiStore.getState().toggleQuickEntryTag('t4')
    expect(useUiStore.getState().quickEntry.selectedTagIds).toEqual(['t1', 't4'])

    useUiStore.getState().toggleQuickEntryTag('t1')
    expect(useUiStore.getState().quickEntry.selectedTagIds).toEqual(['t4'])
  })

  it('closeQuickEntry fully resets all ephemeral fields', () => {
    useUiStore.getState().openQuickEntry({ kind: 'eleve', eleveIds: ['s1'] })
    useUiStore.getState().toggleQuickEntryTag('t1')
    useUiStore.getState().setQuickEntryNote('un brouillon')
    useUiStore.getState().setQuickEntryPickerSearch('lin')

    useUiStore.getState().closeQuickEntry()

    expect(useUiStore.getState().quickEntry).toEqual(DEFAULT_QUICK_ENTRY)
  })
})

describe('useUiStore: tag editor', () => {
  it('openTagEditor(existingTag) populates all fields from the tag', () => {
    const tag = SEED_TAGS[0]
    if (!tag) throw new Error('expected a seed tag')

    useUiStore.getState().openTagEditor(tag)

    expect(useUiStore.getState().tagEditor).toMatchObject({
      isOpen: true,
      editingTagId: tag.id,
      emoji: tag.emoji,
      name: tag.name,
      categoryId: tag.categoryId,
      variant: tag.variant,
    })
  })

  it('openTagEditor() with no tag resets to create-mode defaults', () => {
    useUiStore.getState().openTagEditor()

    const editor = useUiStore.getState().tagEditor
    expect(editor.isOpen).toBe(true)
    expect(editor.editingTagId).toBeNull()
    expect(editor.name).toBe('')
    expect(editor.variant).toBe('neutral')
  })

  it('closeTagEditor resets to defaults', () => {
    useUiStore.getState().openTagEditor(SEED_TAGS[0])

    useUiStore.getState().closeTagEditor()

    expect(useUiStore.getState().tagEditor).toEqual(DEFAULT_TAG_EDITOR)
  })
})

describe('useUiStore: dispatch to the app store', () => {
  // Resets the shared UI singleton between tests without touching an ambient
  // `localStorage`: Node 26 ships its own experimental Web Storage global that
  // shadows jsdom's and reads as undefined unless --localstorage-file is passed.
  // Assertions below are relative (`before + 1`, freshly-read `tags[0]`), so the
  // domain store needs no reset.
  beforeEach(() => {
    useUiStore.setState({
      quickEntry: DEFAULT_QUICK_ENTRY,
      tagEditor: DEFAULT_TAG_EDITOR,
    })
  })

  it('submitQuickEntry logs an event and closes the sheet', () => {
    const before = useAppStore.getState().events.length
    useUiStore.getState().openQuickEntry({ kind: 'eleve', eleveIds: ['s1'] })
    useUiStore.getState().toggleQuickEntryTag('t1')

    useUiStore.getState().submitQuickEntry()

    expect(useAppStore.getState().events.length).toBe(before + 1)
    expect(useUiStore.getState().quickEntry).toEqual(DEFAULT_QUICK_ENTRY)
  })

  it('saveTagEditor creates a new tag and closes the sheet', () => {
    const before = useAppStore.getState().tags.length
    useUiStore.getState().openTagEditor()
    useUiStore.getState().setTagEditorName('Excellent oral')

    useUiStore.getState().saveTagEditor()

    expect(useAppStore.getState().tags.length).toBe(before + 1)
    expect(useUiStore.getState().tagEditor).toEqual(DEFAULT_TAG_EDITOR)
  })

  it('deleteTagFromEditor removes the tag being edited and closes the sheet', () => {
    const tag = useAppStore.getState().tags[0]
    if (!tag) throw new Error('expected a seed tag')
    useUiStore.getState().openTagEditor(tag)

    useUiStore.getState().deleteTagFromEditor()

    expect(useAppStore.getState().tags.find((t) => t.id === tag.id)).toBeUndefined()
    expect(useUiStore.getState().tagEditor).toEqual(DEFAULT_TAG_EDITOR)
  })
})
