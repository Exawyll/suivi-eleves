import { useAppStore } from '@/store/useAppStore'
import { useUiStore } from '@/store/useUiStore'
import { selectTagsByCategory } from '@/store/selectors'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { TargetSelector } from './TargetSelector'
import { TagCategoryPicker } from './TagCategoryPicker'
import { NoteTextarea } from './NoteTextarea'
import styles from './QuickEntrySheet.module.css'

export function QuickEntrySheet() {
  const isOpen = useUiStore((s) => s.quickEntry.isOpen)
  const context = useUiStore((s) => s.quickEntry.context)
  const selectedTagIds = useUiStore((s) => s.quickEntry.selectedTagIds)
  const noteText = useUiStore((s) => s.quickEntry.noteText)
  const closeQuickEntry = useUiStore((s) => s.closeQuickEntry)
  const submitQuickEntry = useUiStore((s) => s.submitQuickEntry)
  const toggleQuickEntryTag = useUiStore((s) => s.toggleQuickEntryTag)
  const setQuickEntryNote = useUiStore((s) => s.setQuickEntryNote)

  const tagCategories = useAppStore((s) => s.tagCategories)
  const tags = useAppStore((s) => s.tags)

  const hasTarget =
    context.kind === 'classe' || (context.kind === 'eleve' && context.eleveIds.length > 0)
  const canSubmit = hasTarget && (selectedTagIds.length > 0 || noteText.trim() !== '')

  const tagGroups = selectTagsByCategory(tagCategories, tags)

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={closeQuickEntry}
      title="Nouvel évènement"
      footer={
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.doneButton}
            disabled={!canSubmit}
            onClick={submitQuickEntry}
          >
            Terminé
          </button>
        </div>
      }
    >
      <TargetSelector />
      <TagCategoryPicker
        groups={tagGroups}
        selectedTagIds={selectedTagIds}
        onToggle={toggleQuickEntryTag}
      />
      <NoteTextarea value={noteText} onChange={setQuickEntryNote} />
    </BottomSheet>
  )
}
