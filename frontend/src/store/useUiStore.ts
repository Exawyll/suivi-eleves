import { create } from 'zustand'
import type { Id, Tag } from '@/types/domain'
import type { QuickEntryContext, QuickEntryState, TagEditorState } from '@/types/ui'
import { resolveQuickEntryTargets } from '@/store/selectors'
import { useAppStore } from '@/store/useAppStore'

const DEFAULT_QUICK_ENTRY: QuickEntryState = {
  isOpen: false,
  mode: 'idle',
  context: { kind: 'none' },
  isPickerOpen: false,
  pickerSearch: '',
  selectedTagIds: [],
  noteText: '',
}

const DEFAULT_TAG_EDITOR: TagEditorState = {
  isOpen: false,
  editingTagId: null,
  emoji: '',
  name: '',
  categoryId: null,
  variant: 'neutral',
}

export interface UiState {
  quickEntry: QuickEntryState
  tagEditor: TagEditorState

  openQuickEntry: (context: QuickEntryContext) => void
  closeQuickEntry: () => void
  toggleQuickEntryPicker: () => void
  setQuickEntryPickerSearch: (query: string) => void
  toggleQuickEntryStudent: (eleveId: Id) => void
  switchToMultiSelect: () => void
  replaceSingleStudent: (eleveId: Id) => void
  toggleQuickEntryTag: (tagId: Id) => void
  setQuickEntryNote: (text: string) => void
  submitQuickEntry: () => void

  openTagEditor: (tag?: Tag) => void
  closeTagEditor: () => void
  setTagEditorEmoji: (emoji: string) => void
  setTagEditorName: (name: string) => void
  setTagEditorCategory: (categoryId: Id) => void
  setTagEditorVariant: (variant: TagEditorState['variant']) => void
  saveTagEditor: () => void
  deleteTagFromEditor: () => void
}

export const useUiStore = create<UiState>()((set, get) => ({
  quickEntry: DEFAULT_QUICK_ENTRY,
  tagEditor: DEFAULT_TAG_EDITOR,

  openQuickEntry: (context) => {
    const mode = context.kind === 'eleve' && context.eleveIds.length > 0 ? 'single' : 'idle'
    set({
      quickEntry: {
        ...DEFAULT_QUICK_ENTRY,
        isOpen: true,
        context,
        mode,
      },
    })
  },

  closeQuickEntry: () => set({ quickEntry: DEFAULT_QUICK_ENTRY }),

  toggleQuickEntryPicker: () =>
    set((state) => ({
      quickEntry: { ...state.quickEntry, isPickerOpen: !state.quickEntry.isPickerOpen },
    })),

  setQuickEntryPickerSearch: (query) =>
    set((state) => ({ quickEntry: { ...state.quickEntry, pickerSearch: query } })),

  toggleQuickEntryStudent: (eleveId) =>
    set((state) => {
      const qe = state.quickEntry
      if (qe.mode === 'idle') {
        return {
          quickEntry: {
            ...qe,
            context: { kind: 'eleve', eleveIds: [eleveId] },
            mode: 'single',
            isPickerOpen: false,
          },
        }
      }
      if (qe.mode === 'multi' && qe.context.kind === 'eleve') {
        const ids = qe.context.eleveIds
        const nextIds = ids.includes(eleveId)
          ? ids.filter((id) => id !== eleveId)
          : [...ids, eleveId]
        return { quickEntry: { ...qe, context: { kind: 'eleve', eleveIds: nextIds } } }
      }
      return {}
    }),

  switchToMultiSelect: () =>
    set((state) => {
      if (state.quickEntry.mode !== 'single') return {}
      return { quickEntry: { ...state.quickEntry, mode: 'multi', isPickerOpen: true } }
    }),

  replaceSingleStudent: (eleveId) =>
    set((state) => {
      if (state.quickEntry.mode !== 'single') return {}
      return {
        quickEntry: {
          ...state.quickEntry,
          context: { kind: 'eleve', eleveIds: [eleveId] },
          isPickerOpen: false,
        },
      }
    }),

  toggleQuickEntryTag: (tagId) =>
    set((state) => {
      const ids = state.quickEntry.selectedTagIds
      const nextIds = ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId]
      return { quickEntry: { ...state.quickEntry, selectedTagIds: nextIds } }
    }),

  setQuickEntryNote: (text) =>
    set((state) => ({ quickEntry: { ...state.quickEntry, noteText: text } })),

  submitQuickEntry: () => {
    const { context, selectedTagIds, noteText } = get().quickEntry
    useAppStore.getState().logEvent({
      targets: resolveQuickEntryTargets(context),
      tagIds: selectedTagIds,
      noteText,
    })
    set({ quickEntry: DEFAULT_QUICK_ENTRY })
  },

  openTagEditor: (tag) => {
    if (tag) {
      set({
        tagEditor: {
          isOpen: true,
          editingTagId: tag.id,
          emoji: tag.emoji,
          name: tag.name,
          categoryId: tag.categoryId,
          variant: tag.variant,
        },
      })
      return
    }
    const firstCategoryId = useAppStore.getState().tagCategories[0]?.id ?? null
    set({
      tagEditor: {
        isOpen: true,
        editingTagId: null,
        emoji: '🏷️',
        name: '',
        categoryId: firstCategoryId,
        variant: 'neutral',
      },
    })
  },

  closeTagEditor: () => set({ tagEditor: DEFAULT_TAG_EDITOR }),

  setTagEditorEmoji: (emoji) => set((state) => ({ tagEditor: { ...state.tagEditor, emoji } })),

  setTagEditorName: (name) => set((state) => ({ tagEditor: { ...state.tagEditor, name } })),

  setTagEditorCategory: (categoryId) =>
    set((state) => ({ tagEditor: { ...state.tagEditor, categoryId } })),

  setTagEditorVariant: (variant) =>
    set((state) => ({ tagEditor: { ...state.tagEditor, variant } })),

  saveTagEditor: () => {
    const editor = get().tagEditor
    if (editor.name.trim() === '' || editor.categoryId === null) return

    if (editor.editingTagId) {
      useAppStore.getState().updateTag(editor.editingTagId, {
        emoji: editor.emoji,
        name: editor.name,
        categoryId: editor.categoryId,
        variant: editor.variant,
      })
    } else {
      useAppStore.getState().createTag({
        emoji: editor.emoji,
        name: editor.name,
        categoryId: editor.categoryId,
        variant: editor.variant,
      })
    }
    set({ tagEditor: DEFAULT_TAG_EDITOR })
  },

  deleteTagFromEditor: () => {
    const { editingTagId } = get().tagEditor
    if (!editingTagId) return
    useAppStore.getState().deleteTag(editingTagId)
    set({ tagEditor: DEFAULT_TAG_EDITOR })
  },
}))
