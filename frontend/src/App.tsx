import { Navigate, Outlet, Route, BrowserRouter, Routes } from 'react-router-dom'
import { BottomTabBar } from '@/components/ui/BottomTabBar'
import { Fab } from '@/components/ui/Fab'
import { useFabContext } from '@/hooks/useFabContext'
import { useUiStore } from '@/store/useUiStore'
import { QuickEntrySheet } from '@/components/quickEntry/QuickEntrySheet'
import { TagEditorSheet } from '@/components/tagEditor/TagEditorSheet'
import { DashboardPage } from '@/pages/DashboardPage'
import { ClassesPage } from '@/pages/ClassesPage'
import { DossierPage } from '@/pages/DossierPage'
import { ElevesPage } from '@/pages/ElevesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TagsPage } from '@/pages/TagsPage'
import styles from './App.module.css'

function AppShell() {
  const openQuickEntry = useUiStore((state) => state.openQuickEntry)
  const fabContext = useFabContext()

  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <Outlet />
      </div>
      <Fab onClick={() => openQuickEntry(fabContext)} />
      <BottomTabBar />
      <QuickEntrySheet />
      <TagEditorSheet />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/eleves" element={<ElevesPage />} />
          <Route path="/eleves/:eleveId" element={<DossierPage />} />
          <Route path="/reglages" element={<SettingsPage />} />
          <Route path="/reglages/tags" element={<TagsPage />} />
          {/* Anything unmatched lands on the dashboard rather than a blank screen:
              installed shortcuts and bookmarks can still point at routes this
              version no longer serves, such as the old /classes/:classeId. */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
