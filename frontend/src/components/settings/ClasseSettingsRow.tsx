import { useState } from 'react'
import type { Classe } from '@/types/domain'
import { InlineRenameField } from '@/components/classes/InlineRenameField'
import { ConfirmRow } from '@/components/ui/ConfirmRow'
import { IconButton } from '@/components/ui/IconButton'
import styles from './ClasseSettingsRow.module.css'

interface ClasseSettingsRowProps {
  classe: Classe
  eleveCount: number
  onRename: (name: string) => void
  onDelete: () => void
}

type Mode = 'idle' | 'renaming' | 'confirming'

/** One classe in the settings list: its name and size, with rename and delete. */
export function ClasseSettingsRow({
  classe,
  eleveCount,
  onRename,
  onDelete,
}: ClasseSettingsRowProps) {
  const [mode, setMode] = useState<Mode>('idle')
  const eleveLabel = `${eleveCount} élève${eleveCount > 1 ? 's' : ''}`

  if (mode === 'confirming') {
    return (
      <ConfirmRow
        message={`Attention : ceci supprime définitivement la classe « ${classe.name} », ses ${eleveLabel} et tout leur historique. Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement"
        onConfirm={() => {
          onDelete()
          setMode('idle')
        }}
        onCancel={() => setMode('idle')}
      />
    )
  }

  return (
    <div className={styles.row}>
      <div className={styles.text}>
        {mode === 'renaming' ? (
          <InlineRenameField
            initialValue={classe.name}
            ariaLabel={`Nouveau nom pour ${classe.name}`}
            onCommit={(value) => {
              onRename(value)
              setMode('idle')
            }}
            onCancel={() => setMode('idle')}
            className={styles.renameField}
          />
        ) : (
          <div className={styles.name}>{classe.name}</div>
        )}
        <div className={styles.meta}>{eleveLabel}</div>
      </div>
      {mode === 'idle' && (
        <div className={styles.actions}>
          <IconButton
            icon="✏️"
            label={`Renommer ${classe.name}`}
            onClick={() => setMode('renaming')}
          />
          <IconButton
            icon="🗑️"
            label={`Supprimer ${classe.name}`}
            onClick={() => setMode('confirming')}
          />
        </div>
      )}
    </div>
  )
}
