import { useParams } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import {
  selectEventsForEleve,
  selectEventsGroupedByDateLabel,
  selectRecentNotesForEleve,
} from '@/store/selectors'
import { BackHeader } from '@/components/ui/BackHeader'
import { TagChip, GhostTagChip } from '@/components/ui/TagChip'
import styles from './DossierPage.module.css'

export function DossierPage() {
  const { eleveId } = useParams<{ eleveId: string }>()
  const eleves = useAppStore((s) => s.eleves)
  const classes = useAppStore((s) => s.classes)
  const etablissements = useAppStore((s) => s.etablissements)
  const events = useAppStore((s) => s.events)

  const eleve = eleves.find((e) => e.id === eleveId)
  if (!eleve) return null

  const classe = classes.find((c) => c.id === eleve.classeId)
  const etablissement = classe
    ? etablissements.find((e) => e.id === classe.etablissementId)
    : undefined

  const eleveEvents = eleveId ? selectEventsForEleve(events, eleveId) : []
  const featuredNotes = eleveId ? selectRecentNotesForEleve(events, eleveId, 2) : []
  const groups = selectEventsGroupedByDateLabel(eleveEvents)

  return (
    <div className={styles.page}>
      <BackHeader
        title={eleve.name}
        subtitle={classe ? `${classe.name} · ${etablissement?.name ?? ''}` : undefined}
      />

      {featuredNotes.length > 0 && (
        <div className={styles.notesSection}>
          <div className={styles.sectionLabel}>Notes libres</div>
          {featuredNotes.map((note) =>
            note.content.type === 'note' ? (
              <div key={note.id} className={styles.featuredNote}>
                <div className={styles.featuredNoteText}>« {note.content.text} »</div>
                <div className={styles.featuredNoteMeta}>
                  {note.dateLabel} · {note.timeLabel}
                </div>
              </div>
            ) : null,
          )}
          <div className={styles.divider} />
        </div>
      )}

      <div className={styles.historyLabel}>Historique</div>
      {groups.map((group) => (
        <div key={group.label} className={styles.dateGroup}>
          <div className={styles.dateGroupLabel}>{group.label}</div>
          {group.items.map((item) => (
            <div key={item.id} className={styles.historyItem}>
              {item.content.type === 'tag' ? (
                <HistoryTagChip tagId={item.content.tagId} />
              ) : (
                <span className={styles.historyNote}>« {item.content.text} »</span>
              )}
              <span className={styles.historyTime}>{item.timeLabel}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function HistoryTagChip({ tagId }: { tagId: string }) {
  const tag = useAppStore((s) => s.tags.find((t) => t.id === tagId))
  return tag ? (
    <TagChip emoji={tag.emoji} name={tag.name} variant={tag.variant} />
  ) : (
    <GhostTagChip />
  )
}
