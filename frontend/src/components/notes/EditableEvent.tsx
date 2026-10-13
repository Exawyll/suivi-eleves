import { useState, type ReactNode } from 'react'
import type { EventItem } from '@/types/domain'
import { useAppStore } from '@/store/useAppStore'
import { ConfirmRow } from '@/components/ui/ConfirmRow'
import { IconButton } from '@/components/ui/IconButton'
import { NoteEditForm } from './NoteEditForm'
import styles from './EditableEvent.module.css'

interface EditableEventProps {
  event: EventItem
  /**
   * Renders the entry as it normally looks. `actions` holds the edit and
   * delete buttons, for the caller to place where its layout wants them.
   */
  children: (actions: ReactNode) => ReactNode
}

type Mode = 'idle' | 'editing' | 'confirming'

/**
 * Wraps one history entry with its edit (notes only) and delete controls, and
 * swaps itself for the edit form or the delete confirmation when asked.
 */
export function EditableEvent({ event, children }: EditableEventProps) {
  const updateNote = useAppStore((s) => s.updateNote)
  const deleteEvent = useAppStore((s) => s.deleteEvent)
  const [mode, setMode] = useState<Mode>('idle')

  const isNote = event.content.type === 'note'
  const what = isNote ? 'cette note' : 'ce tag'
  const when = `${event.dateLabel} · ${event.timeLabel}`

  if (mode === 'editing' && event.content.type === 'note') {
    return (
      <NoteEditForm
        initialText={event.content.text}
        onSave={(text) => {
          updateNote(event.id, text)
          setMode('idle')
        }}
        onCancel={() => setMode('idle')}
      />
    )
  }

  if (mode === 'confirming') {
    return (
      <ConfirmRow
        message={`Supprimer définitivement ${what} (${when}) ?`}
        onConfirm={() => deleteEvent(event.id)}
        onCancel={() => setMode('idle')}
      />
    )
  }

  const actions = (
    <span className={styles.actions}>
      {isNote && (
        <IconButton icon="✏️" label="Modifier la note" onClick={() => setMode('editing')} />
      )}
      <IconButton
        icon="🗑️"
        label={isNote ? 'Supprimer la note' : 'Supprimer le tag'}
        onClick={() => setMode('confirming')}
      />
    </span>
  )

  return children(actions)
}
