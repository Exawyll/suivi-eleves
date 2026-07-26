import styles from './NoteTextarea.module.css'

interface NoteTextareaProps {
  value: string
  onChange: (value: string) => void
}

export function NoteTextarea({ value, onChange }: NoteTextareaProps) {
  return (
    <textarea
      className={styles.textarea}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Écrire une note libre…"
      aria-label="Note libre"
    />
  )
}
