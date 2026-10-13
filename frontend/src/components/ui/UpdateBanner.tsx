import { useUpdateStore } from '@/store/useUpdateStore'
import styles from './UpdateBanner.module.css'

/** Offers the waiting release. Reloading is left to the teacher's tap. */
export function UpdateBanner() {
  const isUpdateReady = useUpdateStore((s) => s.isUpdateReady)
  const applyUpdate = useUpdateStore((s) => s.applyUpdate)

  if (!isUpdateReady) return null

  return (
    <output className={styles.banner}>
      <span className={styles.text}>Nouvelle version disponible</span>
      <button type="button" className={styles.button} onClick={applyUpdate}>
        Mettre à jour
      </button>
    </output>
  )
}
