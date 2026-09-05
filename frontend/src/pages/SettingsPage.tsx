import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { useAuthStore } from '@/store/useAuthStore'
import { ChevronRightIcon } from '@/components/icons/NavIcons'
import { DisabledListRow } from '@/components/ui/DisabledListRow'
import { SyncRow } from '@/components/settings/SyncRow'
import { RecoverySetupSheet } from '@/components/settings/RecoverySetupSheet'
import styles from './SettingsPage.module.css'

export function SettingsPage() {
  const navigate = useNavigate()
  const tagsCount = useAppStore((s) => s.tags.length)
  const categoriesCount = useAppStore((s) => s.tagCategories.length)
  const etablissementsCount = useAppStore((s) => s.etablissements.length)
  const session = useAuthStore((s) => s.session)
  const logout = useAuthStore((s) => s.logout)
  const needsReauth = useAuthStore((s) => s.needsReauth)
  const recoveryEnabled = session?.recoveryEnabled ?? false
  const [recoverySheetOpen, setRecoverySheetOpen] = useState(false)

  return (
    <div className={styles.page}>
      <div className={styles.title}>Réglages</div>

      {session !== null && (
        <div className={styles.account}>
          <div className={styles.accountName}>
            {session.firstName} {session.lastName}
          </div>
          <div className={styles.accountEmail}>{session.email}</div>
          {needsReauth && (
            <div className={styles.accountNotice}>
              Session expirée — votre carnet reste accessible, mais rien ne sera synchronisé tant
              que vous ne vous serez pas reconnectée.
            </div>
          )}
          <button type="button" className={styles.logout} onClick={() => void logout()}>
            Se déconnecter
          </button>
        </div>
      )}

      <button type="button" className={styles.row} onClick={() => navigate('/reglages/tags')}>
        <div>
          <div className={styles.rowTitle}>Mes tags</div>
          <div className={styles.rowMeta}>
            {tagsCount} tags · {categoriesCount} catégories
          </div>
        </div>
        <ChevronRightIcon />
      </button>

      <button
        type="button"
        className={styles.row}
        onClick={() => navigate('/reglages/etablissements')}
      >
        <div>
          <div className={styles.rowTitle}>Établissements &amp; classes</div>
          <div className={styles.rowMeta}>
            {etablissementsCount} établissement{etablissementsCount > 1 ? 's' : ''}
          </div>
        </div>
        <ChevronRightIcon />
      </button>

      <SyncRow />

      <button
        type="button"
        className={styles.row}
        onClick={() => setRecoverySheetOpen(true)}
        disabled={session === null}
      >
        <div>
          <div className={styles.rowTitle}>Clé de récupération</div>
          <div className={styles.rowMeta}>
            {recoveryEnabled
              ? 'Configurée — appuyez pour la régénérer'
              : 'Non configurée — permet de retrouver le carnet en cas de mot de passe oublié'}
          </div>
        </div>
        <ChevronRightIcon />
      </button>

      <DisabledListRow title="À propos" />

      <RecoverySetupSheet
        isOpen={recoverySheetOpen}
        onClose={() => setRecoverySheetOpen(false)}
        hasExistingKey={recoveryEnabled}
      />
    </div>
  )
}
