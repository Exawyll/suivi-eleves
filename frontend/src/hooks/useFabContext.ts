import { useMatch } from 'react-router-dom'
import type { QuickEntryContext } from '@/types/ui'

/**
 * Resolves what the floating action button should pre-fill when tapped: the
 * current student if we're on a Dossier screen, otherwise no context.
 */
export function useFabContext(): QuickEntryContext {
  const dossier = useMatch('/eleves/:eleveId')
  const eleveId = dossier?.params.eleveId

  if (eleveId) {
    return { kind: 'eleve', eleveIds: [eleveId] }
  }
  return { kind: 'none' }
}
