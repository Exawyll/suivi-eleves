import { useAppStore } from '@/store/useAppStore'
import { useUiStore } from '@/store/useUiStore'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { VariantSegmentedControl } from './VariantSegmentedControl'
import styles from './TagEditorSheet.module.css'

export function TagEditorSheet() {
  const isOpen = useUiStore((s) => s.tagEditor.isOpen)
  const editingTagId = useUiStore((s) => s.tagEditor.editingTagId)
  const emoji = useUiStore((s) => s.tagEditor.emoji)
  const name = useUiStore((s) => s.tagEditor.name)
  const categoryId = useUiStore((s) => s.tagEditor.categoryId)
  const variant = useUiStore((s) => s.tagEditor.variant)
  const closeTagEditor = useUiStore((s) => s.closeTagEditor)
  const setTagEditorEmoji = useUiStore((s) => s.setTagEditorEmoji)
  const setTagEditorName = useUiStore((s) => s.setTagEditorName)
  const setTagEditorCategory = useUiStore((s) => s.setTagEditorCategory)
  const setTagEditorVariant = useUiStore((s) => s.setTagEditorVariant)
  const saveTagEditor = useUiStore((s) => s.saveTagEditor)
  const deleteTagFromEditor = useUiStore((s) => s.deleteTagFromEditor)

  const categories = useAppStore((s) => s.tagCategories)

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={closeTagEditor}
      title={editingTagId ? 'Modifier le tag' : 'Nouveau tag'}
    >
      <div className={styles.fieldRow}>
        <input
          type="text"
          className={styles.emojiInput}
          value={emoji}
          onChange={(e) => setTagEditorEmoji(e.target.value)}
          aria-label="Emoji du tag"
        />
        <input
          type="text"
          className={styles.nameInput}
          value={name}
          onChange={(e) => setTagEditorName(e.target.value)}
          placeholder="Nom du tag"
        />
      </div>

      <div className={styles.label}>Catégorie</div>
      <select
        className={styles.select}
        value={categoryId ?? ''}
        onChange={(e) => setTagEditorCategory(e.target.value)}
        aria-label="Catégorie du tag"
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      <div className={styles.label}>Style</div>
      <VariantSegmentedControl value={variant} onChange={setTagEditorVariant} />

      <div className={styles.actions}>
        {editingTagId && (
          <button type="button" className={styles.deleteButton} onClick={deleteTagFromEditor}>
            Supprimer
          </button>
        )}
        <button
          type="button"
          className={styles.saveButton}
          disabled={name.trim() === ''}
          onClick={saveTagEditor}
        >
          Enregistrer
        </button>
      </div>
    </BottomSheet>
  )
}
