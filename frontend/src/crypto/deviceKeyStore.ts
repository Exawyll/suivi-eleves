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
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

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
        try {
          const request = action(database.transaction(STORE, mode).objectStore(STORE))
          request.onsuccess = () => {
            resolve(request.result)
            database.close()
          }
          request.onerror = () => {
            resolve(null)
            database.close()
          }
        } catch {
          database.close()
          resolve(null)
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
