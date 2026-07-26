import type { TagVariant } from '@/types/domain'
import styles from './VariantSegmentedControl.module.css'

interface VariantSegmentedControlProps {
  value: TagVariant
  onChange: (variant: TagVariant) => void
}

const OPTIONS: { value: TagVariant; label: string }[] = [
  { value: 'accent', label: 'Plein' },
  { value: 'outline', label: 'Contour' },
  { value: 'neutral', label: 'Neutre' },
]

export function VariantSegmentedControl({ value, onChange }: VariantSegmentedControlProps) {
  return (
    <div className={styles.seg}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={`${styles.opt} ${value === option.value ? styles.active : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
