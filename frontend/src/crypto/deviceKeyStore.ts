/**
 * Keeps the unwrapped data key on this device, between launches.
 *
 * IndexedDB can structured-clone a `CryptoKey`, which means the key can be put
 * away and taken back out without ever existing as bytes that a script could
 * read — it stays non-extractable and bound to this origin. That is what lets
 * a teacher open the app and start writing without retyping a password, while
 * a signed-out account's carnet stays unreadable on the same browser.
 *
 * Every call degrades to "no key" rather than throwing: private windows and
 * browsers with site data blocked make IndexedDB unavailable, and the app must
 * still be usable — it just asks for the password at each cold start.
 */

const DB_NAME = 'carnet-vault'
const DB_VERSION = 1
const STORE = 'dataKeys'

function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    // `onblocked` can fire and `onsuccess` arrive afterwards. Without this
    // flag the second connection would be handed to nobody and never closed,
    // and a leaked connection is what blocks the *next* open or upgrade.
    let settled = false
    const settle = (database: IDBDatabase | null) => {
      if (settled) {
        database?.close()
        return
      }
      settled = true
      resolve(database)
    }

    request.onsuccess = () => {
      // A database at the right version but without the store cannot be
      // upgraded into shape, and every operation on it would throw. Treating
      // it as absent costs a password prompt at each cold start, which is a
      // far better failure than silently never remembering the key.
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.close()
        settle(null)
        return
      }
      settle(request.result)
    }
    request.onerror = () => settle(null)
    request.onblocked = () => settle(null)
  })
}

/**
 * Runs one operation and waits for its **transaction** to commit, not merely
 * for the request to succeed.
 *
 * The difference matters for the writes. A request succeeding says the
 * operation was accepted; only `oncomplete` says it is durable. Resolving on
 * the request and closing the connection there let a caller act on a
 * sign-out — say, by showing the unlock screen — while the key deletion had
 * not yet landed, which is exactly the kind of "it did not take" that is
 * impossible to reproduce afterwards.
 */
function runTransaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDatabase().then(
    (database) =>
      new Promise<T | null>((resolve) => {
        if (database === null) {
          resolve(null)
          return
        }

        const settle = (value: T | null) => {
          database.close()
          resolve(value)
        }

        try {
          const transaction = database.transaction(STORE, mode)
          const request = action(transaction.objectStore(STORE))
          let result: T | null = null

          request.onsuccess = () => {
            result = request.result
          }
          transaction.oncomplete = () => settle(result)
          transaction.onabort = () => settle(null)
          transaction.onerror = () => settle(null)
        } catch {
          settle(null)
        }
      }),
  )
}

/** Keyed by account: two teachers sharing a browser keep separate keys. */
export async function rememberDataKey(userId: string, dek: CryptoKey): Promise<void> {
  await runTransaction('readwrite', (store) => store.put(dek, userId))
}

export async function recallDataKey(userId: string): Promise<CryptoKey | null> {
  const stored = await runTransaction<unknown>('readonly', (store) => store.get(userId))
  // A stored value that is not a CryptoKey means something else wrote here;
  // treating it as absent is the only safe reading.
  return stored instanceof CryptoKey ? stored : null
}

/**
 * Signing out. The encrypted carnet stays on disk but becomes unreadable,
 * which is what makes a shared browser safe between two accounts.
 */
export async function forgetDataKey(userId: string): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(userId))
}
