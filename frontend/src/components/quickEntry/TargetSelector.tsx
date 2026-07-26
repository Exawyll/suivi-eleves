import type { Eleve } from '@/types/domain'
import { useAppStore } from '@/store/useAppStore'
import { useUiStore } from '@/store/useUiStore'
import { Avatar } from '@/components/ui/Avatar'
import { StudentPicker } from './StudentPicker'
import styles from './TargetSelector.module.css'

export function TargetSelector() {
  const context = useUiStore((s) => s.quickEntry.context)
  const mode = useUiStore((s) => s.quickEntry.mode)
  const isPickerOpen = useUiStore((s) => s.quickEntry.isPickerOpen)
  const pickerSearch = useUiStore((s) => s.quickEntry.pickerSearch)
  const toggleQuickEntryPicker = useUiStore((s) => s.toggleQuickEntryPicker)
  const setQuickEntryPickerSearch = useUiStore((s) => s.setQuickEntryPickerSearch)
  const toggleQuickEntryStudent = useUiStore((s) => s.toggleQuickEntryStudent)
  const replaceSingleStudent = useUiStore((s) => s.replaceSingleStudent)
  const switchToMultiSelect = useUiStore((s) => s.switchToMultiSelect)

  const classes = useAppStore((s) => s.classes)
  const eleves = useAppStore((s) => s.eleves)

  if (context.kind === 'classe') {
    const classe = classes.find((c) => c.id === context.classeId)
    return (
      <div className={styles.classChip}>
        <div className={styles.classIcon} aria-hidden="true">
          🏫
        </div>
        <div className={styles.classChipLabel}>Classe entière — {classe?.name}</div>
      </div>
    )
  }

  const selectedIds = context.kind === 'eleve' ? context.eleveIds : []
  const selectedStudents = selectedIds
    .map((id) => eleves.find((e) => e.id === id))
    .filter((e): e is Eleve => e !== undefined)

  const onPickerToggle = mode === 'single' ? replaceSingleStudent : toggleQuickEntryStudent

  return (
    <div>
      {mode === 'idle' && !isPickerOpen && (
        <button type="button" className={styles.choosePrompt} onClick={toggleQuickEntryPicker}>
          Choisir un élève…
        </button>
      )}

      {selectedStudents.length > 0 && (
        <div className={styles.chipsRow}>
          {selectedStudents.map((student) => (
            <span key={student.id} className={styles.studentChip}>
              <Avatar name={student.name} size="sm" />
              <span>{student.name}</span>
              {mode === 'multi' && (
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => toggleQuickEntryStudent(student.id)}
                  aria-label={`Retirer ${student.name}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {mode === 'multi' && (
            <button
              type="button"
              className={styles.addDashed}
              onClick={toggleQuickEntryPicker}
              aria-label="Ajouter un élève"
            >
              +
            </button>
          )}
        </div>
      )}

      {mode === 'single' && (
        <div className={styles.linksRow}>
          <button type="button" className={styles.linkButton} onClick={toggleQuickEntryPicker}>
            Changer
          </button>
          <button type="button" className={styles.linkButton} onClick={switchToMultiSelect}>
            + Ajouter d&apos;autres élèves
          </button>
        </div>
      )}

      {isPickerOpen && (
        <StudentPicker
          eleves={eleves}
          classes={classes}
          searchQuery={pickerSearch}
          onSearchChange={setQuickEntryPickerSearch}
          selectedIds={selectedIds}
          onToggle={onPickerToggle}
        />
      )}
    </div>
  )
}
