import styles from './DisabledListRow.module.css'

interface DisabledListRowProps {
  title: string
  badge?: string
}

export function DisabledListRow({ title, badge }: DisabledListRowProps) {
  return (
    <div className={styles.row} aria-disabled="true">
      <div className={styles.title}>{title}</div>
      {badge && <span className={styles.badge}>{badge}</span>}
    </div>
  )
}
