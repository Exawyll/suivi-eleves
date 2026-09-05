import { useEffect, useState } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useAuthStore } from '@/store/useAuthStore'
import styles from './RecoveryKeyReveal.module.css'

/**
 * Shown exactly once, whenever a recovery key was just minted — at sign-up,
 * after regenerating one from Settings, or as the by-product of a completed
 * account recovery. Mounted once at the top of the app rather than on any one
 * screen: all three moments happen once the carnet is already unlocked (see
 * `useAuthStore`), so this only ever needs to watch `pendingRecoveryKey`.
 */
export function RecoveryKeyReveal() {
  const recoveryKey = useAuthStore((state) => state.pendingRecoveryKey)
  const acknowledge = useAuthStore((state) => state.acknowledgePendingRecoveryKey)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCopied(false)
  }, [recoveryKey])

  const copy = async () => {
    if (recoveryKey === null) return
    try {
      await navigator.clipboard.writeText(recoveryKey)
      setCopied(true)
    } catch {
      // Clipboard access can be refused outright — a non-secure context, a
      // permission denial. The key stays on screen to copy by hand either way.
    }
  }

  return (
    <BottomSheet
      isOpen={recoveryKey !== null}
      onClose={acknowledge}
      title="Votre clé de récupération"
      accent="purple"
      footer={
        <div className={styles.footer}>
          <button type="button" className={styles.acknowledge} onClick={acknowledge}>
            J’ai noté ma clé
          </button>
        </div>
      }
    >
      <p className={styles.intro}>
        Cette clé permet de retrouver votre carnet si vous oubliez votre mot de passe. Notez-la ou
        copiez-la dans un endroit sûr : elle ne sera plus jamais affichée.
      </p>
      <div className={styles.keyBox}>{recoveryKey}</div>
      <button type="button" className={styles.copy} onClick={() => void copy()}>
        {copied ? 'Copiée !' : 'Copier'}
      </button>
      <div className={styles.warning}>
        <strong>Sans elle et sans votre mot de passe, votre carnet est irrécupérable.</strong> Le
        serveur ne peut pas la retrouver à votre place : il ne voit jamais vos notes en clair.
      </div>
    </BottomSheet>
  )
}
