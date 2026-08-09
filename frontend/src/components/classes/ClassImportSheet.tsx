import { useState } from 'react'
import type { Id } from '@/types/domain'
import { useAppStore } from '@/store/useAppStore'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { parseCsvStudentNames } from '@/utils/csv'
import styles from './ClassImportSheet.module.css'

interface ClassImportSheetProps {
  /** The établissement the new classe belongs to; `null` keeps the sheet closed. */
  etablissementId: Id | null
  etablissementName: string
  onClose: () => void
}

/**
 * Creates a classe from a CSV roster. The file is read with FileReader and
 * parsed in the browser — no upload, nothing leaves the device.
 */
export function ClassImportSheet({
  etablissementId,
  etablissementName,
  onClose,
}: ClassImportSheetProps) {
  const createClasseWithEleves = useAppStore((s) => s.createClasseWithEleves)

  const [classeName, setClasseName] = useState('')
  const [fileName, setFileName] = useState('')
  const [eleveNames, setEleveNames] = useState<string[]>([])
  const [error, setError] = useState('')

  const close = () => {
    setClasseName('')
    setFileName('')
    setEleveNames([])
    setError('')
    onClose()
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const names = parseCsvStudentNames(String(reader.result ?? ''))
      setFileName(file.name)
      setEleveNames(names)
      setError(names.length > 0 ? '' : 'Aucun élève détecté dans ce fichier.')
    }
    reader.onerror = () => setError('Impossible de lire ce fichier.')
    reader.readAsText(file)
  }

  const save = () => {
    if (classeName.trim() === '') {
      setError('Indiquez un nom de classe.')
      return
    }
    if (eleveNames.length === 0) {
      setError('Importez un fichier CSV avec au moins un élève.')
      return
    }
    if (!etablissementId) return

    createClasseWithEleves({ etablissementId, name: classeName, eleveNames })
    close()
  }

  return (
    <BottomSheet
      isOpen={etablissementId !== null}
      onClose={close}
      title="Ajouter une classe"
      accent="blue"
      footer={
        <div className={styles.footer}>
          <button type="button" className={styles.saveButton} onClick={save}>
            Importer la classe
          </button>
        </div>
      }
    >
      <div className={styles.etablissement}>{etablissementName}</div>

      <label className={styles.label} htmlFor="classe-name">
        Nom de la classe
      </label>
      <input
        id="classe-name"
        type="text"
        className={styles.input}
        value={classeName}
        onChange={(e) => setClasseName(e.target.value)}
        placeholder="5e B"
      />

      <span className={styles.label}>Liste des élèves (fichier CSV)</span>
      <label className={styles.filePicker}>
        <input
          type="file"
          accept=".csv,text/csv"
          className={styles.fileInput}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {fileName || 'Choisir un fichier CSV…'}
      </label>

      {error !== '' && <div className={styles.error}>{error}</div>}
      {error === '' && eleveNames.length > 0 && (
        <div className={styles.preview}>
          {eleveNames.length} élève{eleveNames.length > 1 ? 's' : ''} détecté
          {eleveNames.length > 1 ? 's' : ''}
        </div>
      )}
    </BottomSheet>
  )
}
