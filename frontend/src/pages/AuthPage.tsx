import { useState } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'
import { RecoverForm } from '@/components/auth/RecoverForm'
import { SignupForm } from '@/components/auth/SignupForm'
import { readLegacyCarnet } from '@/store/legacyCarnet'
import { useAuthStore } from '@/store/useAuthStore'
import styles from './AuthPage.module.css'

type Mode = 'login' | 'signup' | 'recover'

/**
 * The whole app until an account is unlocked.
 *
 * Three situations share these two forms. A device with no account signs up or
 * signs in; a device whose key was dropped — signed out, or site data cleared —
 * only needs the password, and gets it back with no network at all, because
 * the carnet is already here and only encrypted.
 */
export const AuthPage = () => {
  const status = useAuthStore((state) => state.status)
  const session = useAuthStore((state) => state.session)
  const busy = useAuthStore((state) => state.busy)
  const error = useAuthStore((state) => state.error)
  const clearError = useAuthStore((state) => state.clearError)
  const signup = useAuthStore((state) => state.signup)
  const login = useAuthStore((state) => state.login)
  const unlockOffline = useAuthStore((state) => state.unlockOffline)
  const forgetAccount = useAuthStore((state) => state.forgetAccount)
  const recoveryEmail = useAuthStore((state) => state.recoveryEmail)
  const startRecovery = useAuthStore((state) => state.startRecovery)
  const completeRecovery = useAuthStore((state) => state.completeRecovery)
  const cancelRecovery = useAuthStore((state) => state.cancelRecovery)

  const [mode, setMode] = useState<Mode>('login')
  // Read once, on mount: adopting depends on what is on the device now, and
  // re-reading on every keystroke would be wasted work.
  const [hasCarnetToAdopt] = useState(() => readLegacyCarnet() !== null)

  const locked = status === 'locked' && session !== null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.wordmark}>Carnet</div>
        <div className={styles.tagline}>
          {locked
            ? 'Déverrouiller'
            : mode === 'login'
              ? 'Connexion'
              : mode === 'recover'
                ? 'Récupérer le compte'
                : 'Créer un compte enseignant'}
        </div>
      </div>

      {locked ? (
        <>
          <div className={styles.locked}>
            Carnet de <span className={styles.lockedEmail}>{session.email}</span>
          </div>
          <LoginForm
            key="unlock"
            busy={busy}
            serverError={error}
            onClearServerError={clearError}
            onSubmit={(_email, password) => void unlockOffline(password)}
            onSwitch={() => void forgetAccount()}
            lockedEmail={session.email}
            submitLabel="Déverrouiller"
            busyLabel="Déverrouillage…"
            switchPrompt="Ce n’est pas vous ?"
            switchLabel="Utiliser un autre compte"
          />
        </>
      ) : mode === 'login' ? (
        <LoginForm
          busy={busy}
          serverError={error}
          onClearServerError={clearError}
          onSubmit={(email, password) => void login(email, password)}
          onSwitch={() => {
            clearError()
            setMode('signup')
          }}
          onForgotPassword={() => {
            clearError()
            setMode('recover')
          }}
        />
      ) : mode === 'recover' ? (
        <RecoverForm
          busy={busy}
          serverError={error}
          onClearServerError={clearError}
          recoveryEmail={recoveryEmail}
          onStart={(email, recoveryKey) => void startRecovery(email, recoveryKey)}
          onComplete={(newPassword) => void completeRecovery(newPassword)}
          onCancel={cancelRecovery}
          onBackToLogin={() => {
            cancelRecovery()
            clearError()
            setMode('login')
          }}
        />
      ) : (
        <SignupForm
          busy={busy}
          serverError={error}
          onClearServerError={clearError}
          hasCarnetToAdopt={hasCarnetToAdopt}
          onSubmit={(fields) => void signup(fields)}
          onSwitchToLogin={() => {
            clearError()
            setMode('login')
          }}
        />
      )}
    </div>
  )
}
