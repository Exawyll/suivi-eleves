import styles from './IconButton.module.css'

interface IconButtonProps {
  icon: string
  label: string
  onClick: () => void
}

/** Small round emoji button for row-level actions (rename, delete). */
export function IconButton({ icon, label, onClick }: IconButtonProps) {
  return (
    <button type="button" className={styles.button} onClick={onClick} aria-label={label}>
      <span aria-hidden="true">{icon}</span>
    </button>
  )
}
