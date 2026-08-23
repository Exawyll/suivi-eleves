import { useState, type FormEvent } from 'react'
import { validateLogin } from '@/components/auth/authValidation'
import styles from '@/pages/AuthPage.module.css'

interface LoginFormProps {
  onSubmit: (email: string, password: string) => void
  onSwitch: () => void
  busy: boolean
  serverError: string | null
  onClearServerError: () => void
  /**
   * Set when the account is already known and only locked. The address is not
   * asked again — it is already on screen — and the form becomes an unlock,
   * which needs no network at all.
   */
  lockedEmail?: string
  submitLabel?: string
  busyLabel?: string
  switchPrompt?: string
  switchLabel?: string
}

export const LoginForm = ({
  onSubmit,
  onSwitch,
  busy,
  serverError,
  onClearServerError,
  lockedEmail,
  submitLabel = 'Se connecter',
  busyLabel = 'Connexion…',
  switchPrompt = 'Pas encore de compte ?',
  switchLabel = 'Créer un compte',
}: LoginFormProps) => {
  const [email, setEmail] = useState(lockedEmail ?? '')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const isUnlock = lockedEmail !== undefined
  const error = localError ?? serverError

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const invalid = isUnlock
      ? password === ''
        ? 'Le mot de passe est requis.'
        : null
      : validateLogin(email, password)
    setLocalError(invalid)
    if (invalid !== null) return
    onSubmit(email.trim().toLowerCase(), password)
  }

  const change = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    setLocalError(null)
    onClearServerError()
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {!isUnlock && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className={styles.input}
            type="email"
            autoComplete="email"
            placeholder="prenom.nom@ecole.fr"
            value={email}
            onChange={(event) => change(setEmail)(event.target.value)}
          />
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="login-password">
          Mot de passe
        </label>
        <input
          id="login-password"
          className={styles.input}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => change(setPassword)(event.target.value)}
        />
      </div>

      {error !== null && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      <button type="submit" className={`${styles.submit} ${styles.submitLogin}`} disabled={busy}>
        {busy ? busyLabel : submitLabel}
      </button>

      <div className={styles.switch}>
        {switchPrompt}{' '}
        <button type="button" className={styles.switchAction} onClick={onSwitch}>
          {switchLabel}
        </button>
      </div>
    </form>
  )
}
