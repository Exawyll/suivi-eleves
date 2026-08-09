import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { useUiStore } from '@/store/useUiStore'
import { selectTagsByCategory } from '@/store/selectors'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons/NavIcons'
import { CategoryHeader } from '@/components/tags/CategoryHeader'
import { VARIANT_LABEL } from '@/utils/tagVariants'
import styles from './TagsPage.module.css'

export function TagsPage() {
  const navigate = useNavigate()
  const categories = useAppStore((s) => s.tagCategories)
  const tags = useAppStore((s) => s.tags)
  const createTagCategory = useAppStore((s) => s.createTagCategory)
  const renameTagCategory = useAppStore((s) => s.renameTagCategory)
  const deleteTagCategory = useAppStore((s) => s.deleteTagCategory)
  const openTagEditor = useUiStore((s) => s.openTagEditor)

  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const groups = selectTagsByCategory(categories, tags)

  function saveNewCategory() {
    if (newCategoryName.trim() === '') return
    createTagCategory(newCategoryName)
    setNewCategoryName('')
    setAddCategoryOpen(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate(-1)}
            aria-label="Retour"
          >
            <ChevronLeftIcon />
          </button>
          <div className={styles.title}>Mes tags</div>
        </div>
        <button
          type="button"
          className={styles.addButton}
          onClick={() => openTagEditor()}
          aria-label="Nouveau tag"
        >
          +
        </button>
      </div>

      {groups.map((group) => (
        <div key={group.category.id} className={styles.categoryGroup}>
          <CategoryHeader
            name={group.category.name}
            tagCount={group.tags.length}
            onRename={(name) => renameTagCategory(group.category.id, name)}
            onDelete={() => deleteTagCategory(group.category.id)}
          />
          {group.tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={styles.tagRow}
              onClick={() => openTagEditor(tag)}
            >
              <span className={styles.tagEmoji} aria-hidden="true">
                {tag.emoji}
              </span>
              <span className={styles.tagName}>{tag.name}</span>
              <span className={styles.variantLabel}>{VARIANT_LABEL[tag.variant]}</span>
              <ChevronRightIcon />
            </button>
          ))}
        </div>
      ))}

      {addCategoryOpen ? (
        <div className={styles.addCategoryForm}>
          <input
            type="text"
            className={styles.addCategoryInput}
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nouvelle catégorie…"
          />
          <button type="button" className={styles.addCategorySubmit} onClick={saveNewCategory}>
            Ajouter
          </button>
          <button
            type="button"
            className={styles.addCategoryCancel}
            onClick={() => {
              setNewCategoryName('')
              setAddCategoryOpen(false)
            }}
            aria-label="Annuler"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.addCategoryLink}
          onClick={() => setAddCategoryOpen(true)}
        >
          + Nouvelle catégorie
        </button>
      )}
    </div>
  )
}
