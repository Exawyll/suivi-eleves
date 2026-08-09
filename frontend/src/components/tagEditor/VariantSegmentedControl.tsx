import type { TagVariant } from '@/types/domain'
import { VARIANT_LABEL } from '@/utils/tagVariants'
import styles from './VariantSegmentedControl.module.css'

interface VariantSegmentedControlProps {
  value: TagVariant
  onChange: (variant: TagVariant) => void
}

/**
 * The mockup names each style after its colour and previews that colour on the
 * pill itself, which reads far better than abstract labels once a teacher has a
 * dozen tags.
 */
const OPTIONS: { value: TagVariant; label: string; activeClass: string }[] = [
  { value: 'accent', label: VARIANT_LABEL.accent, activeClass: styles.activeAccent ?? '' },
  { value: 'outline', label: VARIANT_LABEL.outline, activeClass: styles.activeOutline ?? '' },
  { value: 'neutral', label: VARIANT_LABEL.neutral, activeClass: styles.activeNeutral ?? '' },
]

export function VariantSegmentedControl({ value, onChange }: VariantSegmentedControlProps) {
  return (
    <div className={styles.seg}>
      {OPTIONS.map((option) => {
        const isActive = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            className={`${styles.opt} ${isActive ? option.activeClass : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
