import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { useUiStore } from '@/store/useUiStore'
import { selectEventsForClasse, selectMostRecentTagForEleve } from '@/store/selectors'
import { BackHeader } from '@/components/ui/BackHeader'
import { Avatar } from '@/components/ui/Avatar'
import { TagChip } from '@/components/ui/TagChip'
import styles from './RosterPage.module.css'

export function RosterPage() {
  const { classeId } = useParams<{ classeId: string }>()
  const navigate = useNavigate()
  const openQuickEntry = useUiStore((s) => s.openQuickEntry)
  const classes = useAppStore((s) => s.classes)
  const etablissements = useAppStore((s) => s.etablissements)
  const eleves = useAppStore((s) => s.eleves)
  const tags = useAppStore((s) => s.tags)
  const events = useAppStore((s) => s.events)

  const classe = classes.find((c) => c.id === classeId)
  if (!classe) return null

  const etablissement = etablissements.find((e) => e.id === classe.etablissementId)
  const students = eleves.filter((e) => e.classeId === classe.id)
  const classEvents = classeId
    ? selectEventsForClasse(events, classeId).filter((e) => e.content.type === 'note')
    : []

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <BackHeader
          title={classe.name}
          subtitle={`${classe.niveau} · ${etablissement?.name ?? ''}`}
        />
        <button
          type="button"
          className={styles.eventButton}
          onClick={() => classeId && openQuickEntry({ kind: 'classe', classeId })}
        >
          Évènement classe
        </button>
      </div>

      {students.map((student) => {
        const tag = selectMostRecentTagForEleve(events, tags, student.id)
        return (
          <button
            key={student.id}
            type="button"
            className={styles.studentRow}
            onClick={() => navigate(`/classes/${classe.id}/eleves/${student.id}`)}
          >
            <Avatar name={student.name} />
            <div className={styles.studentName}>{student.name}</div>
            {tag ? (
              <TagChip emoji={tag.emoji} name={tag.name} variant={tag.variant} />
            ) : (
              <span className={styles.noTag}>—</span>
            )}
          </button>
        )
      })}

      {classEvents.length > 0 && (
        <div className={styles.classEventsSection}>
          <div className={styles.sectionLabel}>Évènements de classe</div>
          {classEvents.map((event) =>
            event.content.type === 'note' ? (
              <div key={event.id} className={styles.classEvent}>
                <div className={styles.classEventText}>« {event.content.text} »</div>
                <div className={styles.classEventMeta}>
                  {event.dateLabel} · {event.timeLabel}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  )
}
