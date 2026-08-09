import { useEffect, useRef, useState } from 'react'
import styles from './CategoryHeader.module.css'

interface CategoryHeaderProps {
  name: string
  /** Drives the confirmation copy — deleting takes these tags with it. */
  tagCount: number
  onRename: (name: string) => void
  onDelete: () => void
}

type Mode = 'idle' | 'renaming' | 'confirming'

export function CategoryHeader({ name, tagCount, onRename, onDelete }: CategoryHeaderProps) {
  const [mode, setMode] = useState<Mode>('idle')
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mode === 'renaming') inputRef.current?.select()
  }, [mode])

  const startRenaming = () => {
    setDraft(name)
    setMode('renaming')
  }

  const commitRename = () => {
    onRename(draft)
    setMode('idle')
  }

  if (mode === 'renaming') {
    return (
      <div className={styles.row}>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          value={draft}
          aria-label={`Nouveau nom pour ${name}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitRename()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setMode('idle')
            }
          }}
        />
        <button type="button" className={styles.confirmButton} onClick={commitRename}>
          OK
        </button>
      </div>
    )
  }

  if (mode === 'confirming') {
    return (
      <div className={styles.confirmRow}>
        <p className={styles.confirmText}>
          Supprimer « {name} » et ses {tagCount} tag{tagCount > 1 ? 's' : ''} ?
        </p>
        <div className={styles.confirmActions}>
          <button type="button" className={styles.cancelButton} onClick={() => setMode('idle')}>
            Annuler
          </button>
          <button type="button" className={styles.deleteButton} onClick={onDelete}>
            Supprimer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.row}>
      <h2 className={styles.name}>{name}</h2>
      <button
        type="button"
        className={styles.iconButton}
        onClick={startRenaming}
        aria-label={`Renommer ${name}`}
      >
        <span aria-hidden="true">✏️</span>
      </button>
      <button
        type="button"
        className={styles.iconButton}
        // An empty category has nothing to lose, so it goes straight away.
        onClick={() => (tagCount === 0 ? onDelete() : setMode('confirming'))}
        aria-label={`Supprimer ${name}`}
      >
        <span aria-hidden="true">🗑️</span>
      </button>
    </div>
  )
}
