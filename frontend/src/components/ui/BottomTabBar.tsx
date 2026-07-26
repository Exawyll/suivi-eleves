import { Link, useLocation } from 'react-router-dom'
import { ClassesIcon, DashboardIcon, ElevesIcon, ReglagesIcon } from '@/components/icons/NavIcons'
import styles from './BottomTabBar.module.css'

const TABS = [
  { to: '/dashboard', prefix: '/dashboard', label: 'Accueil', Icon: DashboardIcon },
  { to: '/classes', prefix: '/classes', label: 'Classes', Icon: ClassesIcon },
  { to: '/eleves', prefix: '/eleves', label: 'Élèves', Icon: ElevesIcon },
  { to: '/reglages', prefix: '/reglages', label: 'Réglages', Icon: ReglagesIcon },
]

export function BottomTabBar() {
  const location = useLocation()

  return (
    <nav className={styles.bar} aria-label="Navigation principale">
      {TABS.map(({ to, prefix, label, Icon }) => {
        const active = location.pathname.startsWith(prefix)
        return (
          <Link key={to} to={to} className={styles.tab} aria-current={active ? 'page' : undefined}>
            <Icon active={active} />
            <span className={`${styles.label} ${active ? styles.labelActive : ''}`}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
