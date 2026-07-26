import type { Classe, Eleve, Id } from '@/types/domain'
import { selectStudentsMatchingSearch } from '@/store/selectors'
import { Avatar } from '@/components/ui/Avatar'
import { SearchInput } from '@/components/ui/SearchInput'
import styles from './StudentPicker.module.css'

interface StudentPickerProps {
  eleves: Eleve[]
  classes: Classe[]
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedIds: Id[]
  onToggle: (eleveId: Id) => void
}

export function StudentPicker({
  eleves,
  classes,
  searchQuery,
  onSearchChange,
  selectedIds,
  onToggle,
}: StudentPickerProps) {
  const matches = selectStudentsMatchingSearch(eleves, searchQuery)

  return (
    <div className={styles.wrapper}>
      <div className={styles.search}>
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Rechercher un élève…"
        />
      </div>
      <div className={styles.list}>
        {matches.map((student) => {
          const classe = classes.find((c) => c.id === student.classeId)
          const selected = selectedIds.includes(student.id)
          return (
            <button
              key={student.id}
              type="button"
              className={styles.row}
              onClick={() => onToggle(student.id)}
            >
              <Avatar name={student.name} size="sm" />
              <span className={styles.info}>
                {student.name} <span className={styles.className}>{classe?.name}</span>
              </span>
              {selected && (
                <span className={styles.check} aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
