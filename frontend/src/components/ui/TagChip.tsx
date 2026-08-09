import type { TagVariant } from '@/types/domain'
import styles from './TagChip.module.css'

interface TagChipProps {
  emoji: string
  name: string
  variant: TagVariant
  /**
   * `display` shows the tag in its own colour (history, roster, feed).
   * `stamp` is the Quick Entry rubber stamp: a bigger tap target that reads as
   * picked or not picked rather than by the tag's own colour.
   */
  mode?: 'display' | 'stamp'
  selected?: boolean
  /** Tighter type for the roster, where the chip shares a row with the student's name. */
  compact?: boolean
  onClick?: () => void
}

const VARIANT_CLASS: Record<TagVariant, string> = {
  accent: styles.accent ?? '',
  outline: styles.outline ?? '',
  neutral: styles.neutral ?? '',
}

export function TagChip({
  emoji,
  name,
  variant,
  mode = 'display',
  selected = false,
  compact = false,
  onClick,
}: TagChipProps) {
  const stateClass =
    mode === 'stamp'
      ? ((selected ? styles.selected : styles.unselected) ?? '')
      : VARIANT_CLASS[variant]
  const className = `${styles.chip} ${stateClass} ${compact ? styles.compact : ''}`

  const content = (
    <>
      <span aria-hidden="true">{emoji}</span>
      {name}
      {mode === 'stamp' && selected && <span aria-hidden="true"> ✓</span>}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className={className} aria-pressed={selected} onClick={onClick}>
        {content}
      </button>
    )
  }

  return <span className={className}>{content}</span>
}

/** Fallback chip for events referencing a tag that has since been deleted. */
export function GhostTagChip() {
  return <span className={`${styles.chip} ${styles.ghost}`}>Tag supprimé</span>
}
