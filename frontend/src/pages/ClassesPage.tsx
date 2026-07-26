import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { selectClassesByEtablissement } from '@/store/selectors'
import { ChevronRightIcon } from '@/components/icons/NavIcons'
import styles from './ClassesPage.module.css'

export function ClassesPage() {
  const navigate = useNavigate()
  const etablissements = useAppStore((s) => s.etablissements)
  const classes = useAppStore((s) => s.classes)
  const eleves = useAppStore((s) => s.eleves)

  const groups = selectClassesByEtablissement(etablissements, classes)

  return (
    <div className={styles.page}>
      <div className={styles.title}>Classes</div>
      {groups.map((group) => (
        <div key={group.etablissement.id} className={styles.group}>
          <div className={styles.groupLabel}>{group.etablissement.name}</div>
          <div className={styles.classList}>
            {group.classes.map((classe) => {
              const count = eleves.filter((e) => e.classeId === classe.id).length
              return (
                <button
                  key={classe.id}
                  type="button"
                  className={styles.classRow}
                  onClick={() => navigate(`/classes/${classe.id}`)}
                >
                  <div>
                    <div className={styles.className}>{classe.name}</div>
                    <div className={styles.classMeta}>
                      {classe.niveau} · {count} élèves
                    </div>
                  </div>
                  <ChevronRightIcon />
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
