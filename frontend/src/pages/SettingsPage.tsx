import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { ChevronRightIcon } from '@/components/icons/NavIcons'
import { DisabledListRow } from '@/components/ui/DisabledListRow'
import styles from './SettingsPage.module.css'

export function SettingsPage() {
  const navigate = useNavigate()
  const tagsCount = useAppStore((s) => s.tags.length)
  const categoriesCount = useAppStore((s) => s.tagCategories.length)

  return (
    <div className={styles.page}>
      <div className={styles.title}>Réglages</div>

      <button type="button" className={styles.row} onClick={() => navigate('/reglages/tags')}>
        <div>
          <div className={styles.rowTitle}>Mes tags</div>
          <div className={styles.rowMeta}>
            {tagsCount} tags · {categoriesCount} catégories
          </div>
        </div>
        <ChevronRightIcon />
      </button>

      <DisabledListRow title="Établissements & classes" badge="Bientôt" />
      <DisabledListRow title="Sauvegarde locale" badge="Bientôt" />
      <DisabledListRow title="À propos" />
    </div>
  )
}
