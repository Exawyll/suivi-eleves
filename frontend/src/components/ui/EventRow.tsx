import type { Tag } from '@/types/domain'
import { Avatar } from './Avatar'
import { GhostTagChip, TagChip } from './TagChip'
import styles from './EventRow.module.css'

export type EventRowContent =
  { kind: 'note'; text: string } | { kind: 'tag'; tag: Tag } | { kind: 'tag-ghost' }

interface EventRowProps {
  title: string
  subtitle?: string
  isClasse?: boolean
  time: string
  content: EventRowContent
  onClick?: () => void
}

export function EventRow({ title, subtitle, isClasse, time, content, onClick }: EventRowProps) {
  const RowElement = onClick ? 'button' : 'div'

  return (
    <RowElement type={onClick ? 'button' : undefined} className={styles.row} onClick={onClick}>
      {isClasse ? (
        <div className={styles.classeIcon} aria-hidden="true">
          🏫
        </div>
      ) : (
        <Avatar name={title} />
      )}
      <div className={styles.main}>
        <div className={styles.nameLine}>
          <span className={styles.name}>{title}</span>
          {subtitle && <span className={styles.className}>{subtitle}</span>}
        </div>
        {content.kind === 'note' && <div className={styles.note}>« {content.text} »</div>}
        {content.kind === 'tag' && (
          <div className={styles.chipRow}>
            <TagChip
              emoji={content.tag.emoji}
              name={content.tag.name}
              variant={content.tag.variant}
            />
          </div>
        )}
        {content.kind === 'tag-ghost' && (
          <div className={styles.chipRow}>
            <GhostTagChip />
          </div>
        )}
      </div>
      <div className={styles.time}>{time}</div>
    </RowElement>
  )
}
