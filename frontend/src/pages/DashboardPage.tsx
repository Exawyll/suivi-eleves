import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import {
  selectClasseColor,
  selectRecentActivityByEleve,
  selectStudentsMatchingSearch,
} from '@/store/selectors'
import { SearchInput } from '@/components/ui/SearchInput'
import { StudentRow } from '@/components/ui/StudentRow'
import { EmptyState } from '@/components/ui/EmptyState'
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

/**
 * Accueil doubles as the way into any student: typing swaps the recent-activity
 * feed for a flat search across every classe, which is how a teacher finds a
 * student in a meeting without remembering their class.
 */
export function DashboardPage() {
  const navigate = useNavigate()
  const eleves = useAppStore((s) => s.eleves)
  const classes = useAppStore((s) => s.classes)
  const events = useAppStore((s) => s.events)

  const [search, setSearch] = useState('')
  const isSearching = search.trim() !== ''

  const classeNameFor = (classeId: string) => classes.find((c) => c.id === classeId)?.name

  const results = selectStudentsMatchingSearch(eleves, search)
  const activity = selectRecentActivityByEleve(events, eleves)

  return (
    <div className={styles.page}>
      <h1 className={styles.greeting}>Bonjour, {TEACHER_DISPLAY_NAME}</h1>
      <div className={styles.date}>{todayLabel()}</div>

      <div className={styles.search}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un élève, toutes classes…"
        />
      </div>

      {isSearching ? (
        <>
          <h2 className={styles.sectionLabel}>Résultats</h2>
          {results.length === 0 ? (
            <EmptyState message="Aucun élève ne correspond à cette recherche." />
          ) : (
            results.map((eleve) => (
              <StudentRow
                key={eleve.id}
                name={eleve.name}
                classeName={classeNameFor(eleve.classeId)}
                onClick={() => navigate(`/eleves/${eleve.id}`)}
              />
            ))
          )}
        </>
      ) : (
        <>
          <h2 className={styles.sectionLabel}>Activité récente</h2>
          {activity.length === 0 ? (
            <EmptyState message="Aucune activité pour le moment." />
          ) : (
            activity.map(({ eleve, timeLabel }) => (
              <StudentRow
                key={eleve.id}
                name={eleve.name}
                classeName={classeNameFor(eleve.classeId)}
                color={selectClasseColor(classes, eleve.classeId)}
                time={timeLabel}
                onClick={() => navigate(`/eleves/${eleve.id}`)}
              />
            ))
          )}
        </>
      )}
    </div>
  )
}
