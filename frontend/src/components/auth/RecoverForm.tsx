import { useState, type FormEvent } from 'react'
import { validateNewPassword, validateRecoveryRequest } from '@/components/auth/authValidation'
import styles from '@/pages/AuthPage.module.css'

interface RecoverFormProps {
  busy: boolean
  serverError: string | null
  onClearServerError: () => void
  /** Set once `onStart` has verified the recovery key — moves the form to its
   * second step. Owned by the store, not local state: it is what the recovery
   * key was actually checked against, not just what was typed. */
  recoveryEmail: string | null
  /** Pre-fills the address when it is already known — coming from the locked
   * screen of a device that has a local account, say. Left blank otherwise. */
  initialEmail?: string
  onStart: (email: string, recoveryKey: string) => void
  onComplete: (newPassword: string) => void
  onCancel: () => void
  onBackToLogin: () => void
}

/**
 * "Mot de passe oublié", in its two steps. The account is not the same
 * screen twice: `recoveryEmail` moving from `null` to a value is what proves
 * the recovery key was right, and what makes it safe to ask for a new
 * password at all.
 */
export const RecoverForm = ({
  busy,
  serverError,
  onClearServerError,
  recoveryEmail,
  initialEmail = '',
  onStart,
  onComplete,
  onCancel,
  onBackToLogin,
}: RecoverFormProps) => {
  const [email, setEmail] = useState(initialEmail)
  const [recoveryKey, setRecoveryKey] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const error = localError ?? serverError

  const change = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    setLocalError(null)
    onClearServerError()
  }

  if (recoveryEmail !== null) {
    const submit = (event: FormEvent) => {
      event.preventDefault()
      const invalid = validateNewPassword(password, passwordConfirm)
      setLocalError(invalid)
      if (invalid !== null) return
      onComplete(password)
    }

    return (
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.locked}>
          Nouveau mot de passe pour <span className={styles.lockedEmail}>{recoveryEmail}</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="recover-password">
            Nouveau mot de passe
          </label>
          <input
            id="recover-password"
            className={styles.input}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => change(setPassword)(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="recover-password-confirm">
            Confirmer le mot de passe
          </label>
          <input
            id="recover-password-confirm"
            className={styles.input}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={passwordConfirm}
            onChange={(event) => change(setPasswordConfirm)(event.target.value)}
          />
        </div>

        {error !== null && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <div className={styles.warning}>
          <span className={styles.warningTitle}>
            Une nouvelle clé de récupération sera générée.
          </span>{' '}
          Celle utilisée à l’instant ne fonctionnera plus.
        </div>

        <button type="submit" className={`${styles.submit} ${styles.submitSignup}`} disabled={busy}>
          {busy ? 'Réinitialisation…' : 'Choisir ce mot de passe'}
        </button>

        <div className={styles.switch}>
          <button type="button" className={styles.switchAction} onClick={onCancel}>
            Recommencer
          </button>
        </div>
      </form>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const invalid = validateRecoveryRequest(email, recoveryKey)
    setLocalError(invalid)
    if (invalid !== null) return
    onStart(email, recoveryKey)
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="recover-email">
          Email
        </label>
        <input
          id="recover-email"
          className={styles.input}
          type="email"
          autoComplete="email"
          placeholder="prenom.nom@ecole.fr"
          value={email}
          onChange={(event) => change(setEmail)(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="recover-key">
          Clé de récupération
        </label>
        <input
          id="recover-key"
          className={styles.input}
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="XXXXX-XXXXX-XXXXX-…"
          value={recoveryKey}
          onChange={(event) => change(setRecoveryKey)(event.target.value)}
        />
      </div>

      {error !== null && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      <button type="submit" className={`${styles.submit} ${styles.submitLogin}`} disabled={busy}>
        {busy ? 'Vérification…' : 'Continuer'}
      </button>

      <div className={styles.switch}>
        Vous vous souvenez de votre mot de passe ?{' '}
        <button type="button" className={styles.switchAction} onClick={onBackToLogin}>
          Se connecter
        </button>
      </div>
    </form>
  )
}
