import type { Id } from '@/types/domain'
import type { TagCategoryGroup } from '@/store/selectors'
import { TagChip } from '@/components/ui/TagChip'
import styles from './TagCategoryPicker.module.css'

interface TagCategoryPickerProps {
  groups: TagCategoryGroup[]
  selectedTagIds: Id[]
  onToggle: (tagId: Id) => void
}

export function TagCategoryPicker({ groups, selectedTagIds, onToggle }: TagCategoryPickerProps) {
  return (
    <>
      {groups
        .filter((group) => group.tags.length > 0)
        .map((group) => (
          <div key={group.category.id} className={styles.group}>
            <div className={styles.label}>{group.category.name}</div>
            <div className={styles.chips}>
              {group.tags.map((tag) => (
                <TagChip
                  key={tag.id}
                  emoji={tag.emoji}
                  name={tag.name}
                  variant={tag.variant}
                  selected={selectedTagIds.includes(tag.id)}
                  onClick={() => onToggle(tag.id)}
                />
              ))}
            </div>
          </div>
        ))}
    </>
  )
}
