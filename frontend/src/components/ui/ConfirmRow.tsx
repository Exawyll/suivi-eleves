import { useEffect, useRef } from 'react'
import styles from './ConfirmRow.module.css'

interface ConfirmRowProps {
  /** What is about to be lost, spelled out: this is the teacher's last chance. */
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Inline confirmation for a destructive action. It takes the place of the row
 * that triggered it rather than opening a modal, as the tag categories do.
 */
export function ConfirmRow({
  message,
  confirmLabel = 'Supprimer',
  onConfirm,
  onCancel,
}: ConfirmRowProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // The button that opened this row has just been replaced by it, so focus
  // would otherwise fall back to the page. The safe choice gets it.
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div className={styles.row} role="alertdialog" aria-label={message}>
      <p className={styles.text}>{message}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.cancelButton} onClick={onCancel} ref={cancelRef}>
          Annuler
        </button>
        <button type="button" className={styles.deleteButton} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
