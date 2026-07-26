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

  useEffect(() => {
    if (!isOpen) return

    triggerElementRef.current = document.activeElement
    const container = containerRef.current
    const firstFocusable = container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    firstFocusable?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
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
  }, [isOpen, onClose])

  return { containerRef }
}
