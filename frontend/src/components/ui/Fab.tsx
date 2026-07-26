import { PlusIcon } from '@/components/icons/NavIcons'
import styles from './Fab.module.css'

interface FabProps {
  onClick: () => void
}

export function Fab({ onClick }: FabProps) {
  return (
    <button type="button" className={styles.fab} onClick={onClick} aria-label="Nouvel évènement">
      <PlusIcon />
    </button>
  )
}
