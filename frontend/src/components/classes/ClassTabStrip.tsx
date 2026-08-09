import type { Id } from '@/types/domain'
import styles from './ClassTabStrip.module.css'

export interface ClassTabItem {
  id: Id
  name: string
  /** CSS colour for the divider, from `selectClasseColor`. */
  color: string
  isActive: boolean
  isPrincipal: boolean
}

interface ClassTabStripProps {
  tabs: ClassTabItem[]
  onSelect: (id: Id) => void
  onTogglePrincipal: (id: Id) => void
}

/**
 * Vertical stack of binder dividers running down the right edge of the Classes
 * screen. Each divider carries its own star toggle, so the two actions are
 * separate buttons rather than a nested click target.
 */
export function ClassTabStrip({ tabs, onSelect, onTogglePrincipal }: ClassTabStripProps) {
  return (
    <ul className={styles.strip} aria-label="Classes">
      {tabs.map((tab) => (
        <li
          key={tab.id}
          className={`${styles.tab} ${tab.isActive ? styles.tabActive : ''}`}
          style={{ backgroundColor: tab.color }}
        >
          <button
            type="button"
            className={styles.star}
            aria-pressed={tab.isPrincipal}
            aria-label={
              tab.isPrincipal
                ? `Retirer ${tab.name} des classes principales`
                : `Définir ${tab.name} comme classe principale`
            }
            onClick={() => onTogglePrincipal(tab.id)}
          >
            <span aria-hidden="true">{tab.isPrincipal ? '★' : '☆'}</span>
          </button>
          <button
            type="button"
            className={styles.select}
            aria-current={tab.isActive ? 'true' : undefined}
            onClick={() => onSelect(tab.id)}
          >
            {tab.name}
          </button>
        </li>
      ))}
    </ul>
  )
}
