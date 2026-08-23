import { summariseSync } from '@/sync/syncSummary'
import { useSyncStore } from '@/sync/useSyncStore'
import styles from './SyncRow.module.css'

/** The Settings row that replaced "Sauvegarde locale — Bientôt". */
export function SyncRow() {
  const phase = useSyncStore((state) => state.phase)
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
  const pendingCount = useSyncStore((state) => state.pendingCount)

  return (
    <div className={styles.row}>
      <div className={styles.title}>Synchronisation</div>
      <div className={styles.state} data-phase={phase}>
        {summariseSync(phase, lastSyncedAt, pendingCount)}
      </div>
    </div>
  )
}
