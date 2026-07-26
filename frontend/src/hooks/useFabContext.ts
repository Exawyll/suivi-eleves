import { useMatch } from 'react-router-dom'
import type { QuickEntryContext } from '@/types/ui'

/**
 * Resolves what the floating action button should pre-fill when tapped: the
 * current student if we're on a Dossier screen (reached either via Classes ->
 * Roster -> Dossier or directly via the Élèves tab), otherwise no context.
 */
export function useFabContext(): QuickEntryContext {
  const viaEleves = useMatch('/eleves/:eleveId')
  const viaClasses = useMatch('/classes/:classeId/eleves/:eleveId')
  const eleveId = viaEleves?.params.eleveId ?? viaClasses?.params.eleveId

  if (eleveId) {
    return { kind: 'eleve', eleveIds: [eleveId] }
  }
  return { kind: 'none' }
}
