import type { ReactNode } from 'react'
import { useBottomSheet } from '@/hooks/useBottomSheet'
import { CloseIcon } from '@/components/icons/NavIcons'
import styles from './BottomSheet.module.css'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export function BottomSheet({ isOpen, onClose, title, children, footer }: BottomSheetProps) {
  const { containerRef } = useBottomSheet(isOpen, onClose)

  if (!isOpen) return null

  const titleId = 'bottom-sheet-title'

  return (
    <div className={styles.overlay}>
      {/* Decorative dismiss layer — Escape and the close button already provide keyboard-accessible ways to close. */}
      <div className={styles.backdrop} aria-hidden="true" onClick={onClose} />
      {/* Custom slide-up sheet with a manual focus trap (useBottomSheet) rather than
          native <dialog>, which would fight the backdrop/animation styling here. */}
      <div
        ref={containerRef}
        className={styles.sheet}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.handleRow}>
          <div className={styles.handle} aria-hidden="true" />
        </div>
        <div className={styles.header}>
          <div id={titleId} className={styles.title}>
            {title}
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Fermer"
          >
            <CloseIcon />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer}
      </div>
    </div>
  )
}
