import type { TagVariant } from '@/types/domain'
import styles from './TagChip.module.css'

interface TagChipProps {
  emoji: string
  name: string
  variant: TagVariant
  /** Quick-Entry-only visual state: solid filled regardless of the tag's own variant. */
  selected?: boolean
  onClick?: () => void
}

const VARIANT_CLASS: Record<TagVariant, string> = {
  accent: styles.accent ?? '',
  outline: styles.outline ?? '',
  neutral: styles.neutral ?? '',
}

export function TagChip({ emoji, name, variant, selected = false, onClick }: TagChipProps) {
  const className = `${styles.chip} ${selected ? styles.selected : VARIANT_CLASS[variant]}`
  const content = (
    <>
      <span aria-hidden="true">{emoji}</span>
      {name}
      {selected && <span aria-hidden="true"> ✓</span>}
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
