import { useState, type FormEvent } from 'react'
import { MIN_PASSWORD_LENGTH, validateSignup } from '@/components/auth/authValidation'
import styles from '@/pages/AuthPage.module.css'

interface SignupFormProps {
  onSubmit: (fields: {
    email: string
    firstName: string
    lastName: string
    password: string
  }) => void
  onSwitchToLogin: () => void
  busy: boolean
  serverError: string | null
  onClearServerError: () => void
  /** True when a carnet written before accounts existed is about to be adopted. */
  hasCarnetToAdopt: boolean
}

export const SignupForm = ({
  onSubmit,
  onSwitchToLogin,
  busy,
  serverError,
  onClearServerError,
  hasCarnetToAdopt,
}: SignupFormProps) => {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const error = localError ?? serverError

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const fields = { firstName, lastName, email, password, passwordConfirm }
    const invalid = validateSignup(fields)
    setLocalError(invalid)
    if (invalid !== null) return
    onSubmit({
      email: email.trim().toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password,
    })
  }

  const change = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    setLocalError(null)
    onClearServerError()
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {hasCarnetToAdopt && (
        <div className={styles.adopting}>
          Le carnet déjà présent sur cet appareil sera repris dans ce compte, puis chiffré.
        </div>
      )}

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="signup-first-name">
            Prénom
          </label>
          <input
            id="signup-first-name"
            className={styles.input}
            placeholder="Claire"
            value={firstName}
            onChange={(event) => change(setFirstName)(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="signup-last-name">
            Nom
          </label>
          <input
            id="signup-last-name"
            className={styles.input}
            placeholder="Roy"
            value={lastName}
            onChange={(event) => change(setLastName)(event.target.value)}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="signup-email">
          Email
        </label>
        <input
          id="signup-email"
          className={styles.input}
          type="email"
          autoComplete="email"
          placeholder="prenom.nom@ecole.fr"
          value={email}
          onChange={(event) => change(setEmail)(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="signup-password">
          Mot de passe
        </label>
        <input
          id="signup-password"
          className={styles.input}
          type="password"
          autoComplete="new-password"
          placeholder={`${MIN_PASSWORD_LENGTH} caractères minimum`}
          value={password}
          onChange={(event) => change(setPassword)(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="signup-password-confirm">
          Confirmer le mot de passe
        </label>
        <input
          id="signup-password-confirm"
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

      <button type="submit" className={`${styles.submit} ${styles.submitSignup}`} disabled={busy}>
        {busy ? 'Création…' : 'Créer mon compte'}
      </button>

      <div className={styles.warning}>
        <span className={styles.warningTitle}>
          Ce mot de passe est la seule clé de votre carnet.
        </span>{' '}
        Vos notes sont chiffrées sur cet appareil : personne, pas même le serveur, ne peut les lire.
        En contrepartie, un mot de passe perdu signifie des données perdues — aucune
        réinitialisation n’est possible.
      </div>

      <div className={styles.switch}>
        Déjà un compte ?{' '}
        <button type="button" className={styles.switchAction} onClick={onSwitchToLogin}>
          Se connecter
        </button>
      </div>
    </form>
  )
}
