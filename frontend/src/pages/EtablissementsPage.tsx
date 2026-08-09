import { useState } from 'react'
import type { Id } from '@/types/domain'
import { useAppStore } from '@/store/useAppStore'
import { selectClassesByEtablissement } from '@/store/selectors'
import { BackHeader } from '@/components/ui/BackHeader'
import { ClassImportSheet } from '@/components/classes/ClassImportSheet'
import styles from './EtablissementsPage.module.css'

export function EtablissementsPage() {
  const etablissements = useAppStore((s) => s.etablissements)
  const classes = useAppStore((s) => s.classes)
  const eleves = useAppStore((s) => s.eleves)
  const createEtablissement = useAppStore((s) => s.createEtablissement)

  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [importTarget, setImportTarget] = useState<Id | null>(null)

  const groups = selectClassesByEtablissement(etablissements, classes)
  const importTargetName = etablissements.find((e) => e.id === importTarget)?.name ?? ''

  const saveNewEtablissement = () => {
    if (newName.trim() === '') return
    createEtablissement(newName)
    setNewName('')
    setIsAdding(false)
  }

  return (
    <div className={styles.page}>
      <BackHeader title="Établissements & classes" />

      {groups.map(({ etablissement, classes: etablissementClasses }) => (
        <div key={etablissement.id} className={styles.card}>
          <h2 className={styles.etablissementName}>{etablissement.name}</h2>

          {etablissementClasses.length === 0 ? (
            <p className={styles.noClasses}>Aucune classe importée.</p>
          ) : (
            etablissementClasses.map((classe) => (
              <div key={classe.id} className={styles.classeRow}>
                <div>
                  <div className={styles.classeName}>{classe.name}</div>
                  <div className={styles.classeMeta}>
                    {eleves.filter((e) => e.classeId === classe.id).length} élève(s)
                  </div>
                </div>
              </div>
            ))
          )}

          <button
            type="button"
            className={styles.addClasseLink}
            onClick={() => setImportTarget(etablissement.id)}
          >
            + Ajouter une classe
          </button>
        </div>
      ))}

      {isAdding ? (
        <div className={styles.addForm}>
          <input
            type="text"
            className={styles.addInput}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom de l'établissement…"
            aria-label="Nom du nouvel établissement"
          />
          <button type="button" className={styles.addSubmit} onClick={saveNewEtablissement}>
            Ajouter
          </button>
          <button
            type="button"
            className={styles.addCancel}
            onClick={() => {
              setNewName('')
              setIsAdding(false)
            }}
            aria-label="Annuler"
          >
            ×
          </button>
        </div>
      ) : (
        <button type="button" className={styles.addLink} onClick={() => setIsAdding(true)}>
          + Nouvel établissement
        </button>
      )}

      <ClassImportSheet
        etablissementId={importTarget}
        etablissementName={importTargetName}
        onClose={() => setImportTarget(null)}
      />
    </div>
  )
}
