import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Shared focus-trap/restore-focus/Escape-to-close behavior for the app's two
 * bottom sheets (Quick Entry, Tag Editor).
 */
export function useBottomSheet(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerElementRef = useRef<Element | null>(null)

  /**
   * Held in a ref so the effect below can depend on `isOpen` alone.
   *
   * Depending on `onClose` directly breaks any sheet whose parent passes an
   * inline closure: every re-render gives a new identity, the effect tears down
   * and re-runs, and its cleanup hands focus back to the trigger *outside* the
   * sheet. Typing into a field would then lose focus after one character.
   */
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    triggerElementRef.current = document.activeElement
    const container = containerRef.current
    const firstFocusable = container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    firstFocusable?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !container) return

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (triggerElementRef.current instanceof HTMLElement) {
        triggerElementRef.current.focus()
      }
    }
  }, [isOpen])

  return { containerRef }
}
