import { useEffect, useRef, useState } from 'react'
import styles from './NoteEditForm.module.css'

interface NoteEditFormProps {
  initialText: string
  onSave: (text: string) => void
  onCancel: () => void
}

/** Rewrites a free-text note in place. Escape abandons, the empty note can't be saved. */
export function NoteEditForm({ initialText, onSave, onCancel }: NoteEditFormProps) {
  const [draft, setDraft] = useState(initialText)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Opened by tapping "Modifier", so moving focus here is what the teacher expects.
  useEffect(() => {
    const field = textareaRef.current
    if (!field) return
    field.focus()
    field.setSelectionRange(field.value.length, field.value.length)
  }, [])

  const canSave = draft.trim() !== ''

  return (
    <div className={styles.form}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        aria-label="Modifier la note"
      />
      <div className={styles.actions}>
        <button type="button" className={styles.cancelButton} onClick={onCancel}>
          Annuler
        </button>
        <button
          type="button"
          className={styles.saveButton}
          disabled={!canSave}
          onClick={() => onSave(draft)}
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}
