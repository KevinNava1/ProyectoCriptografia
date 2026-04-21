import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import AuroraBackground from '../3d/AuroraBackground'
import VideoBackdrop from '../3d/VideoBackdrop'
import MedicalVortex3D from '../3d/MedicalVortex3D'

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Cerrar drawer al cambiar de ruta
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Evitar scroll del body cuando el drawer está abierto
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div
      className="relative min-h-screen w-full flex"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Capa 1 — Video loop muteado (coherente con el login) */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <VideoBackdrop intensity="soft" />
      </div>

      {/* Capa 2 — Aurora blobs */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <AuroraBackground variant="subtle" />
      </div>

      {/* Capa 3 — Vórtice médico 3D de acento (desplazado, sutil) */}
      <div
        className="fixed pointer-events-none opacity-60"
        style={{ top: '-15%', right: '-20%', width: '760px', height: '760px' }}
        aria-hidden
      >
        <MedicalVortex3D />
      </div>

      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col relative z-10 min-w-0">
        <Header onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8">
          <div className="page-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
