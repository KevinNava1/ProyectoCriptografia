import { useEffect, useState, lazy, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useParallax } from '../../hooks/useParallax'
// Las capas decorativas 3D pesan ~600KB de three.js. Lazy-load las hace
// asíncronas: el shell (sidebar + header + main) renderiza inmediatamente
// y los efectos llegan después sin bloquear interacción.
const AuroraBackground = lazy(() => import('../3d/AuroraBackground'))
const VideoBackdrop    = lazy(() => import('../3d/VideoBackdrop'))
const MedicalVortex3D  = lazy(() => import('../3d/MedicalVortex3D'))

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Parallax multicapa: el aurora se mueve un poco más que el video (que es
  // el fondo "lejano") y el vórtice 3D un poquito más todavía. Sensación de
  // profundidad sin marear (factores < 0.04).
  const auroraParallax = useParallax(0.018)
  const vortexParallax = useParallax(0.028)

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
      <Suspense fallback={null}>
        {/* Capa 1 — Video loop muteado (coherente con el login) */}
        <div className="fixed inset-0 pointer-events-none" aria-hidden>
          <VideoBackdrop intensity="soft" />
        </div>

        {/* Capa 2 — Aurora blobs con parallax sutil */}
        <div
          ref={auroraParallax}
          className="fixed inset-0 pointer-events-none will-change-transform"
          aria-hidden
        >
          <AuroraBackground variant="subtle" />
        </div>

        {/* Capa 3 — Vórtice médico 3D de acento (desplazado, sutil).
            Oculto en mobile: en pantallas chicas un vórtice 3D
            ocupando 760px no aporta y solo come batería. */}
        <div
          ref={vortexParallax}
          className="hidden md:block fixed pointer-events-none opacity-60 will-change-transform"
          style={{ top: '-15%', right: '-20%', width: '760px', height: '760px' }}
          aria-hidden
        >
          <MedicalVortex3D />
        </div>
      </Suspense>

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
