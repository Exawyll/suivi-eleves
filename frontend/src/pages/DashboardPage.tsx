import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { selectRecentEvents } from '@/store/selectors'
import { EventRow, type EventRowContent } from '@/components/ui/EventRow'
import { TEACHER_DISPLAY_NAME } from '@/seed/seedData'
import styles from './DashboardPage.module.css'

function todayLabel(): string {
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function DashboardPage() {
  const navigate = useNavigate()
  const eleves = useAppStore((s) => s.eleves)
  const classes = useAppStore((s) => s.classes)
  const tags = useAppStore((s) => s.tags)
  const events = useAppStore((s) => s.events)

  const recentEvents = selectRecentEvents(events, 6)

  return (
    <div className={styles.page}>
      <div className={styles.greeting}>Bonjour, {TEACHER_DISPLAY_NAME}</div>
      <div className={styles.date}>{todayLabel()}</div>
      <div className={styles.sectionLabel}>Activité récente</div>

      {recentEvents.map((event) => {
        let title: string
        let subtitle: string | undefined
        let isClasse = false
        let onClick: (() => void) | undefined

        if (event.target.kind === 'eleve') {
          const eleveId = event.target.eleveId
          const eleve = eleves.find((e) => e.id === eleveId)
          title = eleve?.name ?? ''
          const classe = eleve ? classes.find((c) => c.id === eleve.classeId) : undefined
          subtitle = classe?.name
          onClick = () => navigate(`/eleves/${eleveId}`)
        } else {
          const classeId = event.target.classeId
          const classe = classes.find((c) => c.id === classeId)
          title = classe ? `${classe.name} (classe)` : ''
          isClasse = true
        }

        let content: EventRowContent
        if (event.content.type === 'note') {
          content = { kind: 'note', text: event.content.text }
        } else {
          const tagId = event.content.tagId
          const tag = tags.find((t) => t.id === tagId)
          content = tag ? { kind: 'tag', tag } : { kind: 'tag-ghost' }
        }

        return (
          <EventRow
            key={event.id}
            title={title}
            subtitle={subtitle}
            isClasse={isClasse}
            time={event.timeLabel}
            content={content}
            onClick={onClick}
          />
        )
      })}
    </div>
  )
}
