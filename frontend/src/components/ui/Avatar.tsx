import { initialsFor } from '@/utils/names'
import styles from './Avatar.module.css'

interface AvatarProps {
  name: string
  size?: 'sm' | 'md'
  /**
   * CSS colour for the disc. Defaults to the app's blue; the roster passes its
   * classe's divider colour so a student reads as belonging to that classe.
   */
  color?: string
}

export function Avatar({ name, size = 'md', color }: AvatarProps) {
  return (
    <div
      className={`${styles.avatar} ${size === 'sm' ? styles.sm : styles.md}`}
      style={color ? { backgroundColor: color } : undefined}
      aria-hidden="true"
    >
      {initialsFor(name)}
    </div>
  )
}
