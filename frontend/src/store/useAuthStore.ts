import { create } from 'zustand'
import { ApiError, OfflineError, configureApiAuth } from '@/api/client'
import {
  completeRecoveryRequest,
  fetchKdfParams,
  loginRequest,
  logoutRequest,
  setupRecoveryRequest,
  signupRequest,
  startRecoveryRequest,
} from '@/api/auth'
import type { ApiSession } from '@/api/auth'
import {
  DEFAULT_KDF_ITERATIONS,
  assertUsableKdfParams,
  deriveCredentials,
  deriveRecoveryCredentials,
  randomKdfSalt,
} from '@/crypto/kdf'
import { base64ToBytes, bytesToBase64 } from '@/crypto/base64'
import { decodeRecoveryKey, encodeRecoveryKey, randomRecoveryKey } from '@/crypto/recoveryKey'
import { generateDataKey, unwrapDataKey, wrapDataKey } from '@/crypto/vault'
import { forgetDataKey, recallDataKey, rememberDataKey } from '@/crypto/deviceKeyStore'
import { discardLegacyCarnet, readLegacyCarnet } from '@/store/legacyCarnet'
import { attachVault, detachVault } from '@/store/vaultBinding'
import { seededDomainState } from '@/store/useAppStore'
import {
  clearRefreshToken,
  clearSession,
  readRefreshToken,
  readSession,
  writeRefreshToken,
  writeSession,
  type StoredSession,
} from '@/store/authPersistence'

/**
 * `loading`   — deciding, at startup, which of the three below applies.
 * `anonymous` — no account on this device; the sign-in screen is the whole app.
 * `locked`    — an account is known but its key is gone (signed out, or site
 *               data cleared). The password unlocks it, no network needed.
 * `unlocked`  — the data key is in memory and the carnet is readable.
 */
export type AuthStatus = 'loading' | 'anonymous' | 'locked' | 'unlocked'

export interface AuthState {
  status: AuthStatus
  session: StoredSession | null
  error: string | null
  busy: boolean
  /**
   * Unlocked and fully usable, but with no valid tokens — so nothing can be
   * synchronised until the teacher signs in again, with the network up.
   */
  needsReauth: boolean
  /**
   * A recovery key just generated (at signup, on regenerating, or as the
   * by-product of a successful account recovery) and not yet acknowledged.
   * Shown once, then gone — nothing keeps it around after `acknowledgePendingRecoveryKey`.
   */
  pendingRecoveryKey: string | null
  /** The email a "mot de passe oublié" flow is currently working on, or null
   * before it starts and after it finishes. */
  recoveryEmail: string | null
  restore: () => Promise<void>
  signup: (input: SignupInput) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  unlockOffline: (password: string) => Promise<void>
  restoreTokens: (password: string) => Promise<void>
  logout: () => Promise<void>
  forgetAccount: () => Promise<void>
  clearError: () => void
  /** Re-derives the current key from the password to (re)generate a recovery
   * key. Needs the password again: the device only ever keeps a
   * non-extractable copy of the data key, and wrapping it a second time needs
   * an extractable one. */
  setupRecovery: (password: string) => Promise<void>
  acknowledgePendingRecoveryKey: () => void
  startRecovery: (email: string, recoveryKeyText: string) => Promise<void>
  completeRecovery: (newPassword: string) => Promise<void>
  cancelRecovery: () => void
}

export interface SignupInput {
  email: string
  firstName: string
  lastName: string
  password: string
}

/**
 * Tokens live here rather than in the store's state: they change on every
 * rotation, no screen renders them, and keeping them out of the state removes
 * any chance of one being swept into a persisted snapshot.
 */
let accessToken: string | null = null
let refreshToken: string | null = null

/**
 * The state carried between `startRecovery` and `completeRecovery`.
 *
 * Kept here rather than in the store's state for the same reason as the
 * tokens above: it is a live `CryptoKey` plus a secret proving who is
 * recovering, neither of which belongs in anything that could be persisted or
 * inspected. `recoveryAuthSecret` is kept so `completeRecovery` can prove
 * possession of the key a second time without asking the teacher to retype
 * it — there is no session yet to carry that proof across the two calls.
 */
let recoveryContext: { email: string; recoveryAuthSecret: string; dek: CryptoKey } | null = null

function sessionFrom(response: ApiSession): StoredSession {
  return {
    userId: response.user.id,
    email: response.user.email,
    firstName: response.user.firstName,
    lastName: response.user.lastName,
    recoveryEnabled: response.user.recoveryEnabled,
    kdfSalt: response.crypto.kdfSalt,
    kdfIterations: response.crypto.kdfIterations,
    wrappedDek: response.crypto.wrappedDek,
    dekNonce: response.crypto.dekNonce,
  }
}

function wireApiAuth(userId: string, dek: CryptoKey): void {
  configureApiAuth({
    accessToken: () => accessToken,
    refreshToken: () => refreshToken,
    onRefreshed: (tokens) => {
      accessToken = tokens.accessToken
      refreshToken = tokens.refreshToken
      void writeRefreshToken(userId, dek, tokens.refreshToken)
    },
    onSessionLost: () => {
      // The refresh token was revoked or expired — after a sign-out, say, or
      // once it aged past its lifetime.
      //
      // This must NOT lock the app. The carnet is decrypted and the data key
      // is in hand; locking would throw the teacher out of notes they can
      // still read perfectly well, and straight back into a loop: unlocking
      // offline restores no tokens either, so the next request would lock
      // them again. Losing the server means losing synchronisation, nothing
      // more.
      accessToken = null
      refreshToken = null
      void clearRefreshToken(userId)
      useAuthStore.setState({ needsReauth: true })
    },
  })
}

function messageFor(error: unknown): string {
  if (error instanceof OfflineError) return 'Pas de connexion. Réessayez une fois en ligne.'
  if (error instanceof ApiError) return error.detail
  return 'Une erreur est survenue.'
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'loading',
  session: null,
  error: null,
  busy: false,
  needsReauth: false,
  pendingRecoveryKey: null,
  recoveryEmail: null,

  restore: async () => {
    const session = readSession()
    if (session === null) {
      set({ status: 'anonymous', session: null })
      return
    }

    try {
      const dek = await recallDataKey(session.userId)
      if (dek === null) {
        set({ status: 'locked', session })
        return
      }

      refreshToken = await readRefreshToken(session.userId, dek)
      wireApiAuth(session.userId, dek)
      await attachVault(session.userId, dek)
      set({ status: 'unlocked', session, error: null, needsReauth: refreshToken === null })
    } catch {
      // Whatever went wrong — unusable storage, a corrupted vault — the app
      // must not sit on a blank loading screen for ever. Falling back to the
      // unlock screen is always answerable: the password rebuilds the key, and
      // nothing has been destroyed.
      set({ status: 'locked', session, error: null })
    }
  },

  signup: async ({ email, firstName, lastName, password }) => {
    set({ busy: true, error: null })
    try {
      const salt = randomKdfSalt()
      const { authSecret, kek } = await deriveCredentials(password, salt, DEFAULT_KDF_ITERATIONS)
      const dek = await generateDataKey()
      const wrapped = await wrapDataKey(dek, kek)

      // Generated here, while the freshly minted key is still extractable —
      // the one moment this does not cost asking for the password a second
      // time. `dek` wraps twice; wrapping does not consume the key.
      const recoveryKeyBytes = randomRecoveryKey()
      const { authSecret: recoveryAuthSecret, kek: recoveryKek } =
        await deriveRecoveryCredentials(recoveryKeyBytes)
      const wrappedForRecovery = await wrapDataKey(dek, recoveryKek)

      const response = await signupRequest({
        email,
        firstName,
        lastName,
        authSecret,
        kdfSalt: bytesToBase64(salt),
        kdfIterations: DEFAULT_KDF_ITERATIONS,
        ...wrapped,
      })

      // Re-imported non-extractable: the generated key had to be extractable
      // to be wrapped, and nothing needs its bytes again.
      const storedDek = await unwrapDataKey(wrapped, kek)
      accessToken = response.accessToken
      refreshToken = response.refreshToken

      await rememberDataKey(response.user.id, storedDek)
      wireApiAuth(response.user.id, storedDek)

      // Best-effort: a fresh account is fully usable without a recovery key,
      // and Settings offers the same setup again if this call is lost to a
      // flaky connection right after signing up.
      let recoveryKeyText: string | null = null
      try {
        await setupRecoveryRequest({
          recoveryAuthSecret,
          wrappedDekRecovery: wrappedForRecovery.wrappedDek,
          dekNonceRecovery: wrappedForRecovery.dekNonce,
        })
        recoveryKeyText = encodeRecoveryKey(recoveryKeyBytes)
      } catch (recoveryError) {
        // Nothing to undo: the account exists and is usable either way. Still
        // logged rather than fully silent — a swallowed failure here should
        // at least be diagnosable from the console.
        console.error('Recovery key setup failed during signup:', recoveryError)
      }

      const session: StoredSession = {
        ...sessionFrom(response),
        recoveryEnabled: recoveryKeyText !== null,
      }
      writeSession(session)
      await writeRefreshToken(session.userId, storedDek, response.refreshToken)

      // A teacher already using the app keeps their carnet; a new one gets the
      // demo. Either way the plain copy goes once the vault holds it.
      const adopted = readLegacyCarnet()
      const written = await attachVault(session.userId, storedDek, adopted ?? seededDomainState())
      // Only once the encrypted copy is provably on the device. Deleting on
      // the strength of a write still in flight would lose a real carnet.
      if (adopted !== null && written) discardLegacyCarnet()

      set({
        status: 'unlocked',
        session,
        busy: false,
        error: null,
        needsReauth: false,
        pendingRecoveryKey: recoveryKeyText,
      })
    } catch (error) {
      set({ busy: false, error: messageFor(error) })
      throw error
    }
  },

  login: async (email, password) => {
    set({ busy: true, error: null })
    try {
      const params = await fetchKdfParams(email)
      // Everything below is derived from a number the server chose. A server
      // answering `1` would get an authSecret cheap enough to brute-force back
      // to the password — and from the password, the real key to the carnet.
      const loginSalt = base64ToBytes(params.kdfSalt)
      assertUsableKdfParams(params.kdfIterations, loginSalt)
      const { authSecret, kek } = await deriveCredentials(password, loginSalt, params.kdfIterations)
      const response = await loginRequest(email, authSecret)
      const session = sessionFrom(response)
      const dek = await unwrapDataKey(
        { wrappedDek: session.wrappedDek, dekNonce: session.dekNonce },
        kek,
      )

      accessToken = response.accessToken
      refreshToken = response.refreshToken
      await rememberDataKey(session.userId, dek)
      wireApiAuth(session.userId, dek)
      writeSession(session)
      await writeRefreshToken(session.userId, dek, response.refreshToken)
      await attachVault(session.userId, dek)

      set({ status: 'unlocked', session, busy: false, error: null, needsReauth: false })
    } catch (error) {
      // Offline with a vault already on this device is not a failed sign-in —
      // it is exactly the case the local unlock exists for.
      const known = readSession()
      if (error instanceof OfflineError && known?.email === email.trim().toLowerCase()) {
        set({ session: known })
        await get().unlockOffline(password)
        return
      }
      set({ busy: false, error: messageFor(error) })
      throw error
    }
  },

  unlockOffline: async (password) => {
    const session = get().session ?? readSession()
    if (session === null) {
      set({ status: 'anonymous', error: null })
      return
    }

    set({ busy: true, error: null })
    try {
      // Stored locally, but it came from the server once. Checked again rather
      // than trusted because it was written down.
      const storedSalt = base64ToBytes(session.kdfSalt)
      assertUsableKdfParams(session.kdfIterations, storedSalt)
      const { kek } = await deriveCredentials(password, storedSalt, session.kdfIterations)
      // Fails loudly on a wrong password: AES-GCM authenticates.
      const dek = await unwrapDataKey(
        { wrappedDek: session.wrappedDek, dekNonce: session.dekNonce },
        kek,
      )

      refreshToken = await readRefreshToken(session.userId, dek)
      await rememberDataKey(session.userId, dek)
      wireApiAuth(session.userId, dek)
      await attachVault(session.userId, dek)

      // Open the carnet first — that part needs no network and must not wait
      // for one. Only then try to get a usable session back, which is what a
      // sign-out left this device without.
      set({
        status: 'unlocked',
        session,
        busy: false,
        error: null,
        needsReauth: refreshToken === null,
      })
      if (refreshToken === null) void get().restoreTokens(password)
    } catch {
      set({ busy: false, error: 'Mot de passe incorrect.' })
    }
  },

  /**
   * Quietly trades the password for fresh tokens, in the background.
   *
   * Failure is expected and harmless: offline, or the server down. The carnet
   * stays open either way; only synchronisation waits.
   */
  restoreTokens: async (password) => {
    const session = get().session
    if (session === null) return
    try {
      const salt = base64ToBytes(session.kdfSalt)
      assertUsableKdfParams(session.kdfIterations, salt)
      const { authSecret } = await deriveCredentials(password, salt, session.kdfIterations)
      const response = await loginRequest(session.email, authSecret)
      accessToken = response.accessToken
      refreshToken = response.refreshToken
      const dek = await recallDataKey(session.userId)
      if (dek !== null) await writeRefreshToken(session.userId, dek, response.refreshToken)
      set({ needsReauth: false })
    } catch {
      // Still usable, still unsynchronised.
    }
  },

  logout: async () => {
    const session = get().session
    let forgotten = true
    if (session !== null) {
      if (refreshToken !== null) {
        // Best effort: signing out must work with no network.
        await logoutRequest(refreshToken).catch(() => undefined)
      }
      forgotten = await forgetDataKey(session.userId)
      await clearRefreshToken(session.userId)
    }

    accessToken = null
    refreshToken = null
    configureApiAuth(null)
    detachVault()

    if (!forgotten) {
      // The data key could not be removed, so it is still on this device: the
      // next launch would reopen the carnet with no password, which is exactly
      // what locking is for. Dropping the session metadata instead makes the
      // lock real — `restore` finds no account and never asks for the key.
      // It costs the offline reopen until the next sign-in, and costs nothing
      // else: the encrypted carnet stays where it is.
      clearSession()
      set({ status: 'anonymous', session: null, error: null, needsReauth: false })
      return
    }

    // The session metadata stays: the encrypted carnet is still on this device
    // and the same password reopens it, with no network.
    set({ status: 'locked', error: null, needsReauth: false })
  },

  /**
   * Steps aside so someone else can sign in on this device.
   *
   * Deliberately keeps the encrypted vault. An earlier version deleted it,
   * which made "Utiliser un autre compte" a one-tap, unconfirmed erasure of
   * the entire carnet — and until synchronisation exists, the device is the
   * only place that carnet lives. The blob is unreadable without the
   * password, so leaving it costs a few kilobytes and buys the account its
   * notes back the next time it signs in here.
   */
  forgetAccount: async () => {
    await get().logout()
    clearSession()
    set({ status: 'anonymous', session: null, error: null, needsReauth: false })
  },

  clearError: () => set({ error: null }),

  setupRecovery: async (password) => {
    const session = get().session
    if (session === null) return

    set({ busy: true, error: null })
    let dek: CryptoKey
    try {
      const salt = base64ToBytes(session.kdfSalt)
      assertUsableKdfParams(session.kdfIterations, salt)
      const { kek } = await deriveCredentials(password, salt, session.kdfIterations)
      // Extractable: about to be wrapped again, under the recovery key this
      // time. Fails loudly on a wrong password, same as `unlockOffline`.
      dek = await unwrapDataKey(
        { wrappedDek: session.wrappedDek, dekNonce: session.dekNonce },
        kek,
        true,
      )
    } catch {
      set({ busy: false, error: 'Mot de passe incorrect.' })
      return
    }

    try {
      const recoveryKeyBytes = randomRecoveryKey()
      const { authSecret: recoveryAuthSecret, kek: recoveryKek } =
        await deriveRecoveryCredentials(recoveryKeyBytes)
      const wrapped = await wrapDataKey(dek, recoveryKek)

      await setupRecoveryRequest({
        recoveryAuthSecret,
        wrappedDekRecovery: wrapped.wrappedDek,
        dekNonceRecovery: wrapped.dekNonce,
      })

      const updated: StoredSession = { ...session, recoveryEnabled: true }
      writeSession(updated)
      set({
        session: updated,
        busy: false,
        error: null,
        pendingRecoveryKey: encodeRecoveryKey(recoveryKeyBytes),
      })
    } catch (error) {
      set({ busy: false, error: messageFor(error) })
    }
  },

  acknowledgePendingRecoveryKey: () => set({ pendingRecoveryKey: null }),

  startRecovery: async (email, recoveryKeyText) => {
    set({ busy: true, error: null })

    let recoveryBytes: Uint8Array
    try {
      recoveryBytes = decodeRecoveryKey(recoveryKeyText)
    } catch {
      const message = 'Clé de récupération invalide.'
      set({ busy: false, error: message })
      throw new Error(message)
    }

    try {
      const normalisedEmail = email.trim().toLowerCase()
      const { authSecret: recoveryAuthSecret, kek: recoveryKek } =
        await deriveRecoveryCredentials(recoveryBytes)
      const material = await startRecoveryRequest(normalisedEmail, recoveryAuthSecret)
      // Extractable: `completeRecovery` wraps it again under the next
      // password and the next recovery key.
      const dek = await unwrapDataKey(
        { wrappedDek: material.wrappedDekRecovery, dekNonce: material.dekNonceRecovery },
        recoveryKek,
        true,
      )
      recoveryContext = { email: normalisedEmail, recoveryAuthSecret, dek }
      set({ busy: false, error: null, recoveryEmail: normalisedEmail })
    } catch (error) {
      recoveryContext = null
      set({ busy: false, error: messageFor(error) })
      throw error
    }
  },

  completeRecovery: async (newPassword) => {
    if (recoveryContext === null) {
      set({ error: 'Aucune récupération en cours.' })
      return
    }
    const context = recoveryContext

    set({ busy: true, error: null })
    try {
      const newSalt = randomKdfSalt()
      const { authSecret: newAuthSecret, kek: newKek } = await deriveCredentials(
        newPassword,
        newSalt,
        DEFAULT_KDF_ITERATIONS,
      )
      const newRecoveryKeyBytes = randomRecoveryKey()
      const { authSecret: newRecoveryAuthSecret, kek: newRecoveryKek } =
        await deriveRecoveryCredentials(newRecoveryKeyBytes)

      const wrappedForPassword = await wrapDataKey(context.dek, newKek)
      const wrappedForRecovery = await wrapDataKey(context.dek, newRecoveryKek)

      const response = await completeRecoveryRequest({
        email: context.email,
        recoveryAuthSecret: context.recoveryAuthSecret,
        newAuthSecret,
        kdfSalt: bytesToBase64(newSalt),
        kdfIterations: DEFAULT_KDF_ITERATIONS,
        wrappedDek: wrappedForPassword.wrappedDek,
        dekNonce: wrappedForPassword.dekNonce,
        newRecoveryAuthSecret,
        newWrappedDekRecovery: wrappedForRecovery.wrappedDek,
        newDekNonceRecovery: wrappedForRecovery.dekNonce,
      })

      const session = sessionFrom(response)
      const storedDek = await unwrapDataKey(
        { wrappedDek: wrappedForPassword.wrappedDek, dekNonce: wrappedForPassword.dekNonce },
        newKek,
      )
      accessToken = response.accessToken
      refreshToken = response.refreshToken
      await rememberDataKey(session.userId, storedDek)
      wireApiAuth(session.userId, storedDek)
      writeSession(session)
      await writeRefreshToken(session.userId, storedDek, response.refreshToken)
      await attachVault(session.userId, storedDek)

      recoveryContext = null
      set({
        status: 'unlocked',
        session,
        busy: false,
        error: null,
        needsReauth: false,
        recoveryEmail: null,
        pendingRecoveryKey: encodeRecoveryKey(newRecoveryKeyBytes),
      })
    } catch (error) {
      set({ busy: false, error: messageFor(error) })
      throw error
    }
  },

  cancelRecovery: () => {
    recoveryContext = null
    set({ recoveryEmail: null, error: null })
  },
}))
