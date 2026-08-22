import { useEffect } from 'react'
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
import { EtablissementsPage } from '@/pages/EtablissementsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TagsPage } from '@/pages/TagsPage'
import { AuthPage } from '@/pages/AuthPage'
import { useAuthStore } from '@/store/useAuthStore'
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
  const status = useAuthStore((state) => state.status)
  const restore = useAuthStore((state) => state.restore)

  useEffect(() => {
    void restore()
  }, [restore])

  // Nothing is rendered while the vault is being opened. The carnet store is
  // empty until then, so showing the shell first would flash an empty app —
  // or, worse, let a screen write to a store that is about to be replaced by
  // what the vault holds.
  if (status === 'loading') return null

  if (status !== 'unlocked') return <AuthPage />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/eleves/:eleveId" element={<DossierPage />} />
          <Route path="/reglages" element={<SettingsPage />} />
          <Route path="/reglages/tags" element={<TagsPage />} />
          <Route path="/reglages/etablissements" element={<EtablissementsPage />} />
          {/* Installed shortcuts and bookmarks can still point at routes this
              version no longer serves. Old per-classe URLs land back on the
              binder, which is where they meant to go; anything else falls
              through to the dashboard rather than a blank screen. */}
          <Route path="/classes/*" element={<Navigate to="/classes" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
