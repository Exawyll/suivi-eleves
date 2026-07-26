import type { Id, TagVariant } from './domain'

export type TabRoute = 'dashboard' | 'classes' | 'eleves' | 'reglages'

export type QuickEntryContext =
  { kind: 'none' } | { kind: 'classe'; classeId: Id } | { kind: 'eleve'; eleveIds: Id[] }

export type QuickEntryMode = 'idle' | 'single' | 'multi'

export interface QuickEntryState {
  isOpen: boolean
  mode: QuickEntryMode
  context: QuickEntryContext
  isPickerOpen: boolean
  pickerSearch: string
  selectedTagIds: Id[]
  noteText: string
}

export interface TagEditorState {
  isOpen: boolean
  /** null = creating a new tag */
  editingTagId: Id | null
  emoji: string
  name: string
  categoryId: Id | null
  variant: TagVariant
}
