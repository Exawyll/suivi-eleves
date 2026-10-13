import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { UpdateBanner } from '@/components/ui/UpdateBanner'
import { registerPwa } from '@/pwa/registerPwa'

registerPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdateBanner />
  </StrictMode>,
)
