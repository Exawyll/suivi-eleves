import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeftIcon } from '@/components/icons/NavIcons'
import styles from './BackHeader.module.css'

interface BackHeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  action?: ReactNode
}

export function BackHeader({ title, subtitle, onBack, action }: BackHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className={styles.row} style={action ? { justifyContent: 'space-between' } : undefined}>
      <div className={styles.row} style={{ marginBottom: 0 }}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBack ?? (() => navigate(-1))}
          aria-label="Retour"
        >
          <ChevronLeftIcon />
        </button>
        <div>
          <div className={styles.title}>{title}</div>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  )
}
