import { create } from 'zustand'

interface UpdateState {
  /** A new release is installed and waiting; the open page still runs the old one. */
  isUpdateReady: boolean
  /** Switches to the waiting release and reloads. Set by `registerPwa` once the worker is registered. */
  applyUpdate: () => void
  markUpdateReady: (applyUpdate: () => void) => void
}

export const useUpdateStore = create<UpdateState>()((set) => ({
  isUpdateReady: false,
  applyUpdate: () => undefined,
  markUpdateReady: (applyUpdate) => set({ isUpdateReady: true, applyUpdate }),
}))
