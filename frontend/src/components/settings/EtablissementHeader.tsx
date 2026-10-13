import { useState } from 'react'
import { InlineRenameField } from '@/components/classes/InlineRenameField'
import { IconButton } from '@/components/ui/IconButton'
import styles from './EtablissementHeader.module.css'

interface EtablissementHeaderProps {
  name: string
  onRename: (name: string) => void
}

/** Établissement card title, renamable in place. */
export function EtablissementHeader({ name, onRename }: EtablissementHeaderProps) {
  const [isRenaming, setIsRenaming] = useState(false)

  return (
    <div className={styles.row}>
      {isRenaming ? (
        <InlineRenameField
          initialValue={name}
          ariaLabel={`Nouveau nom pour ${name}`}
          onCommit={(value) => {
            onRename(value)
            setIsRenaming(false)
          }}
          onCancel={() => setIsRenaming(false)}
          className={styles.renameField}
        />
      ) : (
        <>
          <h2 className={styles.name}>{name}</h2>
          <IconButton icon="✏️" label={`Renommer ${name}`} onClick={() => setIsRenaming(true)} />
        </>
      )}
    </div>
  )
}
