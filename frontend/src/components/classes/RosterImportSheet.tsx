import { useState } from 'react'
import type { Id } from '@/types/domain'
import { useAppStore } from '@/store/useAppStore'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { groupRosterByClasse, parseCsvRoster, type RosterGroup } from '@/utils/csv'
import styles from './RosterImportSheet.module.css'

type ImportMode = 'addClasses' | 'addEleves' | 'reset'

interface RosterImportSheetProps {
  isOpen: boolean
  onClose: () => void
}

const MODE_LABELS: Record<ImportMode, { title: string; hint: string }> = {
  addClasses: {
    title: 'Ajouter des classes',
    hint: 'Une classe est créée par valeur de la colonne « Classe » du fichier.',
  },
  addEleves: {
    title: "Ajouter des élèves",
    hint: 'Chaque élève rejoint la classe existante correspondant à sa colonne « Classe ».',
  },
  reset: {
    title: 'Repartir de zéro',
    hint: 'Supprime les établissements, classes, élèves et événements actuels, puis insère le fichier.',
  },
}

/**
 * Imports a full roster export (Pronote's "Élèves" download, several classes
 * at once) rather than the single-classe list `ClassImportSheet` handles.
 * Parsed entirely in the browser: the file never leaves the device.
 */
export function RosterImportSheet({ isOpen, onClose }: RosterImportSheetProps) {
  const etablissements = useAppStore((s) => s.etablissements)
  const classesCount = useAppStore((s) => s.classes.length)
  const elevesCount = useAppStore((s) => s.eleves.length)
  const addElevesToExistingClasses = useAppStore((s) => s.addElevesToExistingClasses)
  const addClassesFromRoster = useAppStore((s) => s.addClassesFromRoster)
  const resetAndImportRoster = useAppStore((s) => s.resetAndImportRoster)

  const [mode, setMode] = useState<ImportMode>('addClasses')
  const [etablissementId, setEtablissementId] = useState<Id | ''>('')
  const [newEtablissementName, setNewEtablissementName] = useState('')
  const [fileName, setFileName] = useState('')
  const [groups, setGroups] = useState<RosterGroup[]>([])
  const [confirmReset, setConfirmReset] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [done, setDone] = useState(false)

  const resetLocalState = () => {
    setMode('addClasses')
    setEtablissementId('')
    setNewEtablissementName('')
    setFileName('')
    setGroups([])
    setConfirmReset(false)
    setError('')
    setResult('')
    setDone(false)
  }

  const close = () => {
    resetLocalState()
    onClose()
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsedGroups = groupRosterByClasse(parseCsvRoster(String(reader.result ?? '')))
      setFileName(file.name)
      setGroups(parsedGroups)
      setResult('')
      setError(
        parsedGroups.length > 0
          ? ''
          : 'Aucun élève détecté. Le fichier doit contenir les colonnes « Élèves » et « Classe ».',
      )
    }
    reader.onerror = () => setError('Impossible de lire ce fichier.')
    reader.readAsText(file)
  }

  const totalEleves = groups.reduce((sum, g) => sum + g.eleveNames.length, 0)

  const save = () => {
    setError('')

    if (groups.length === 0) {
      setError('Importez un fichier CSV avec au moins un élève.')
      return
    }

    if (mode === 'reset') {
      const trimmedName = newEtablissementName.trim()
      if (trimmedName === '') {
        setError("Indiquez le nom de l'établissement.")
        return
      }
      if (!confirmReset) {
        setError('Cochez la case de confirmation pour supprimer les données actuelles.')
        return
      }
      resetAndImportRoster(trimmedName, groups)
      close()
      return
    }

    if (etablissementId === '') {
      setError('Choisissez un établissement.')
      return
    }

    if (mode === 'addClasses') {
      addClassesFromRoster(etablissementId, groups)
      close()
      return
    }

    const { addedCount, unmatchedCodes } = addElevesToExistingClasses(etablissementId, groups)
    if (unmatchedCodes.length > 0) {
      setResult(
        `${addedCount} élève${addedCount > 1 ? 's' : ''} ajouté${addedCount > 1 ? 's' : ''}. ` +
          `Classe${unmatchedCodes.length > 1 ? 's' : ''} introuvable${unmatchedCodes.length > 1 ? 's' : ''} dans cet établissement, ignorée${unmatchedCodes.length > 1 ? 's' : ''} : ${unmatchedCodes.join(', ')}.`,
      )
      setDone(true)
      return
    }
    close()
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={close}
      title="Importer un fichier CSV"
      accent="blue"
      footer={
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.saveButton}
            onClick={done ? close : save}
            disabled={mode === 'reset' && groups.length > 0 && !confirmReset}
          >
            {done
              ? 'Fermer'
              : mode === 'reset'
                ? 'Supprimer et importer'
                : mode === 'addClasses'
                  ? 'Importer les classes'
                  : 'Ajouter les élèves'}
          </button>
        </div>
      }
    >
      <span className={styles.label}>Que voulez-vous faire ?</span>
      <div className={styles.modeGroup} role="radiogroup" aria-label="Type d'import">
        {(Object.keys(MODE_LABELS) as ImportMode[]).map((key) => (
          <label key={key} className={styles.modeOption}>
            <input
              type="radio"
              name="import-mode"
              value={key}
              aria-label={MODE_LABELS[key].title}
              checked={mode === key}
              onChange={() => {
                setMode(key)
                setError('')
                setResult('')
                setDone(false)
              }}
            />
            <span className={styles.modeOptionText}>
              <span className={styles.modeOptionTitle}>{MODE_LABELS[key].title}</span>
              <span className={styles.modeOptionHint}>{MODE_LABELS[key].hint}</span>
            </span>
          </label>
        ))}
      </div>

      {mode === 'reset' ? (
        <>
          <label className={styles.label} htmlFor="roster-etablissement-name">
            Nom de l'établissement
          </label>
          <input
            id="roster-etablissement-name"
            type="text"
            className={styles.input}
            value={newEtablissementName}
            onChange={(e) => setNewEtablissementName(e.target.value)}
            placeholder="Collège Jean Moulin"
          />
        </>
      ) : (
        <>
          <label className={styles.label} htmlFor="roster-etablissement">
            Établissement
          </label>
          <select
            id="roster-etablissement"
            className={styles.select}
            value={etablissementId}
            onChange={(e) => setEtablissementId(e.target.value)}
          >
            <option value="">Choisir un établissement…</option>
            {etablissements.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </>
      )}

      <span className={styles.label}>Fichier CSV</span>
      <label className={styles.filePicker}>
        <input
          type="file"
          accept=".csv,text/csv"
          className={styles.fileInput}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {fileName || 'Choisir un fichier CSV…'}
      </label>

      {groups.length > 0 && (
        <div className={styles.groupsPreview}>
          {totalEleves} élève{totalEleves > 1 ? 's' : ''} dans {groups.length} classe
          {groups.length > 1 ? 's' : ''} détectée{groups.length > 1 ? 's' : ''}
          <ul className={styles.groupsList}>
            {groups.map((g) => (
              <li key={g.classeCode}>
                <span>{g.classeCode}</span>
                <span>
                  {g.eleveNames.length} élève{g.eleveNames.length > 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === 'reset' && groups.length > 0 && (
        <>
          <div className={styles.warning}>
            Cette action supprime définitivement {etablissements.length} établissement
            {etablissements.length > 1 ? 's' : ''}, {classesCount} classe
            {classesCount > 1 ? 's' : ''} et {elevesCount} élève{elevesCount > 1 ? 's' : ''} déjà
            enregistrés (données de démo incluses), ainsi que leur historique d'événements. Les
            tags de comportement sont conservés.
          </div>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={confirmReset}
              onChange={(e) => setConfirmReset(e.target.checked)}
            />
            Je confirme vouloir supprimer ces données et repartir de zéro.
          </label>
        </>
      )}

      {error !== '' && <div className={styles.error}>{error}</div>}
      {error === '' && result !== '' && <div className={styles.preview}>{result}</div>}
    </BottomSheet>
  )
}
