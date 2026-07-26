import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { selectStudentsMatchingSearch } from '@/store/selectors'
import { SearchInput } from '@/components/ui/SearchInput'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import styles from './ElevesPage.module.css'

export function ElevesPage() {
  const navigate = useNavigate()
  const eleves = useAppStore((s) => s.eleves)
  const classes = useAppStore((s) => s.classes)
  const [search, setSearch] = useState('')

  const filtered = selectStudentsMatchingSearch(eleves, search)

  return (
    <div className={styles.page}>
      <div className={styles.title}>Élèves</div>
      <div className={styles.search}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un élève, toutes classes…"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="Aucun élève ne correspond à cette recherche." />
      ) : (
        filtered.map((eleve) => {
          const classe = classes.find((c) => c.id === eleve.classeId)
          return (
            <button
              key={eleve.id}
              type="button"
              className={styles.studentRow}
              onClick={() => navigate(`/eleves/${eleve.id}`)}
            >
              <Avatar name={eleve.name} />
              <div>
                <div className={styles.studentName}>{eleve.name}</div>
                <div className={styles.studentClass}>{classe?.name}</div>
              </div>
            </button>
          )
        })
      )}
    </div>
  )
}
