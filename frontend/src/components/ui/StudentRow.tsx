import { Avatar } from './Avatar'
import styles from './StudentRow.module.css'

interface StudentRowProps {
  name: string
  /** The student's classe, shown beside the name. */
  classeName?: string
  /** Avatar tint — the classe's divider colour in the feed, default blue in search. */
  color?: string
  /** Trailing timestamp. Omitted in search results, where time is meaningless. */
  time?: string
  onClick: () => void
}

/** One tappable student line, shared by the Accueil feed and its search results. */
export function StudentRow({ name, classeName, color, time, onClick }: StudentRowProps) {
  return (
    <button type="button" className={styles.row} onClick={onClick}>
      <Avatar name={name} color={color} />
      <span className={styles.main}>
        <span className={styles.name}>{name}</span>
        {classeName && <span className={styles.classeName}>{classeName}</span>}
      </span>
      {time && <span className={styles.time}>{time}</span>}
    </button>
  )
}
