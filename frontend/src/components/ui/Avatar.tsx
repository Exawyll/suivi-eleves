import { initialsFor } from '@/utils/names'
import styles from './Avatar.module.css'

interface AvatarProps {
  name: string
  size?: 'sm' | 'md'
}

export function Avatar({ name, size = 'md' }: AvatarProps) {
  return (
    <div className={`${styles.avatar} ${size === 'sm' ? styles.sm : styles.md}`} aria-hidden="true">
      {initialsFor(name)}
    </div>
  )
}
