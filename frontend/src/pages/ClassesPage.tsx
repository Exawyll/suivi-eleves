import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { useUiStore } from '@/store/useUiStore'
import {
  selectActiveClasse,
  selectClasseColor,
  selectClasseNotes,
  selectMostRecentTagForEleve,
  selectOrderedClasseTabs,
} from '@/store/selectors'
import { Avatar } from '@/components/ui/Avatar'
import { TagChip } from '@/components/ui/TagChip'
import { EmptyState } from '@/components/ui/EmptyState'
import { ClassTabStrip } from '@/components/classes/ClassTabStrip'
import { ClassEventsAccordion } from '@/components/classes/ClassEventsAccordion'
import { InlineRenameField } from '@/components/classes/InlineRenameField'
import styles from './ClassesPage.module.css'

/**
 * The binder: one roster panel whose colour and contents follow the divider
 * selected in the strip on the right.
 */
export function ClassesPage() {
  const navigate = useNavigate()
  const openQuickEntry = useUiStore((s) => s.openQuickEntry)
  const classes = useAppStore((s) => s.classes)
  const etablissements = useAppStore((s) => s.etablissements)
  const eleves = useAppStore((s) => s.eleves)
  const tags = useAppStore((s) => s.tags)
  const events = useAppStore((s) => s.events)
  const activeClasseId = useAppStore((s) => s.activeClasseId)
  const principalClasseId = useAppStore((s) => s.principalClasseId)
  const setActiveClasse = useAppStore((s) => s.setActiveClasse)
  const togglePrincipalClasse = useAppStore((s) => s.togglePrincipalClasse)
  const renameClasse = useAppStore((s) => s.renameClasse)

  const [isRenaming, setIsRenaming] = useState(false)

  const activeClasse = selectActiveClasse(classes, activeClasseId)

  if (!activeClasse) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Classes</h1>
        <EmptyState message="Aucune classe pour le moment." />
      </div>
    )
  }

  const activeColor = selectClasseColor(classes, activeClasse.id)
  const etablissement = etablissements.find((e) => e.id === activeClasse.etablissementId)
  const students = eleves.filter((e) => e.classeId === activeClasse.id)
  const classeNotes = selectClasseNotes(events, activeClasse.id)

  const tabs = selectOrderedClasseTabs(classes, principalClasseId).map((classe) => ({
    id: classe.id,
    name: classe.name,
    color: selectClasseColor(classes, classe.id),
    isActive: classe.id === activeClasse.id,
    isPrincipal: classe.id === principalClasseId,
  }))

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Classes</h1>

      <div className={styles.binder}>
        <div className={styles.panel} style={{ borderRightColor: activeColor }}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeading}>
              {isRenaming ? (
                <InlineRenameField
                  initialValue={activeClasse.name}
                  ariaLabel="Nom de la classe"
                  onCommit={(value) => {
                    renameClasse(activeClasse.id, value)
                    setIsRenaming(false)
                  }}
                  onCancel={() => setIsRenaming(false)}
                />
              ) : (
                <button
                  type="button"
                  className={styles.classeName}
                  onClick={() => setIsRenaming(true)}
                >
                  {activeClasse.name}
                </button>
              )}
              <div className={styles.classeMeta}>
                {activeClasse.niveau} · {etablissement?.name ?? ''}
              </div>
            </div>
            <button
              type="button"
              className={styles.eventButton}
              style={{ borderColor: activeColor, color: activeColor }}
              onClick={() => openQuickEntry({ kind: 'classe', classeId: activeClasse.id })}
            >
              Évènement classe
            </button>
          </div>

          <ClassEventsAccordion notes={classeNotes} />

          {students.length === 0 ? (
            <EmptyState message="Aucun élève dans cette classe." />
          ) : (
            students.map((student) => {
              const tag = selectMostRecentTagForEleve(events, tags, student.id)
              return (
                <button
                  key={student.id}
                  type="button"
                  className={styles.studentRow}
                  onClick={() => navigate(`/eleves/${student.id}`)}
                >
                  <Avatar name={student.name} />
                  <span className={styles.studentName}>{student.name}</span>
                  {tag ? (
                    <TagChip emoji={tag.emoji} name={tag.name} variant={tag.variant} />
                  ) : (
                    <span className={styles.noTag}>—</span>
                  )}
                </button>
              )
            })
          )}
        </div>

        <ClassTabStrip
          tabs={tabs}
          onSelect={(id) => {
            setIsRenaming(false)
            setActiveClasse(id)
          }}
          onTogglePrincipal={togglePrincipalClasse}
        />
      </div>
    </div>
  )
}
