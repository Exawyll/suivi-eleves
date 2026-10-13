import { useState } from 'react'
import type { EventItem } from '@/types/domain'
import { EditableEvent } from '@/components/notes/EditableEvent'
import styles from './ClassEventsAccordion.module.css'

interface ClassEventsAccordionProps {
  /** Class-level notes, most recent first. */
  notes: EventItem[]
}

/**
 * Class-level notes: the latest one is always visible, older ones collapse
 * behind a "Voir N précédents" toggle.
 */
export function ClassEventsAccordion({ notes }: ClassEventsAccordionProps) {
  const [isOpen, setIsOpen] = useState(false)

  const [latest, ...older] = notes
  if (!latest) return null

  return (
    <section className={styles.section} aria-label="Évènements de classe">
      <h2 className={styles.heading}>Évènements de classe</h2>
      <ClassNote note={latest} />

      {older.length > 0 && (
        <>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen
              ? 'Masquer les précédents'
              : `Voir ${older.length} précédent${older.length > 1 ? 's' : ''}`}
          </button>
          {isOpen && older.map((note) => <ClassNote key={note.id} note={note} />)}
        </>
      )}
    </section>
  )
}

function ClassNote({ note }: { note: EventItem }) {
  if (note.content.type !== 'note') return null
  const { text } = note.content

  return (
    <EditableEvent event={note}>
      {(actions) => (
        <div className={styles.note}>
          <div className={styles.noteBody}>
            <div className={styles.noteText}>« {text} »</div>
            <div className={styles.noteMeta}>
              {note.dateLabel} · {note.timeLabel}
            </div>
          </div>
          {actions}
        </div>
      )}
    </EditableEvent>
  )
}
