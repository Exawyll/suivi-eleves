import { useState, type FormEvent } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useAuthStore } from '@/store/useAuthStore'
import styles from './RecoverySetupSheet.module.css'

interface RecoverySetupSheetProps {
  isOpen: boolean
  onClose: () => void
  /** Distinguishes the copy between a first setup and a replacement — the
   * underlying call is the same either way. */
  hasExistingKey: boolean
}

/**
 * Asks for the current password before (re)generating a recovery key.
 *
 * Not a formality: the device only ever keeps a non-extractable copy of the
 * data key, so wrapping it a second time — for the recovery key — needs the
 * password again to unwrap an extractable one. See `setupRecovery`.
 */
export function RecoverySetupSheet({ isOpen, onClose, hasExistingKey }: RecoverySetupSheetProps) {
  const busy = useAuthStore((state) => state.busy)
  const error = useAuthStore((state) => state.error)
  const clearError = useAuthStore((state) => state.clearError)
  const setupRecovery = useAuthStore((state) => state.setupRecovery)
  const [password, setPassword] = useState('')

  const close = () => {
    setPassword('')
    clearError()
    onClose()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (password === '') return
    void setupRecovery(password).then(() => {
      // A wrong password leaves the sheet open, with the error in view; only
      // a real success closes it. `useAuthStore.getState()` rather than the
      // stale `error` this closure captured at submit time.
      if (useAuthStore.getState().error === null) close()
    })
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={close} title="Clé de récupération" accent="blue">
      <form onSubmit={submit}>
        <p className={styles.intro}>
          {hasExistingKey
            ? 'Générer une nouvelle clé remplace l’ancienne, qui cessera de fonctionner. Confirmez votre mot de passe pour continuer.'
            : 'Confirmez votre mot de passe pour générer une clé de récupération.'}
        </p>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="recovery-setup-password">
            Mot de passe
          </label>
          <input
            id="recovery-setup-password"
            className={styles.input}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              clearError()
            }}
          />
        </div>

        {error !== null && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <div className={styles.footer}>
          <button type="submit" className={styles.submit} disabled={busy || password === ''}>
            {busy ? 'Génération…' : hasExistingKey ? 'Régénérer la clé' : 'Générer la clé'}
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
