import { useEffect, useRef, useState } from 'react'
import styles from './InlineRenameField.module.css'

interface InlineRenameFieldProps {
  initialValue: string
  ariaLabel: string
  /** Called with the edited text on blur or Enter. An empty value is the caller's to reject. */
  onCommit: (value: string) => void
  onCancel: () => void
}

/**
 * Single-line field that replaces a title while it is being renamed. Commits on
 * blur or Enter, abandons on Escape — the mockup's inline classe rename.
 */
export function InlineRenameField({
  initialValue,
  ariaLabel,
  onCommit,
  onCancel,
}: InlineRenameFieldProps) {
  const [draft, setDraft] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focused on mount rather than via `autoFocus`: the field only ever appears in
  // response to the teacher tapping the title, so moving focus here is expected.
  useEffect(() => {
    inputRef.current?.select()
  }, [])

  return (
    <input
      ref={inputRef}
      className={styles.field}
      value={draft}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          onCommit(draft)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
        }
      }}
    />
  )
}
