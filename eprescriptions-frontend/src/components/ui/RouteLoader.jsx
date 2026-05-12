import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import ShieldLogo from '../3d/ShieldLogo'

// Overlay con logo central que se muestra SOLO si la transición de ruta
// dura más que `delay` ms (por defecto 250). Si la siguiente página monta
// rápido (caso normal), no aparece — evita ruido visual.
//
// El overlay tiene backdrop blur fuerte para que se note que algo está
// pasando, y un anillo ECG-like girando alrededor del logo. Texto opcional
// "Cargando…" abajo.
//
// Patrón: pantallas profesionales muestran este loader si una transición
// puede tomar tiempo (lazy chunks, fetch inicial). Si todo está cacheado y
// rápido, el loader nunca aparece — no es invasivo.

const SHOW_DELAY_MS = 250
const HIDE_DELAY_MS = 220   // extra para no parpadear si la página llegó casi a tiempo

export default function RouteLoader() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let showTimer
    let hideTimer
    let cancelled = false

    // Esperamos `SHOW_DELAY_MS` antes de mostrar. Si el siguiente render
    // monta antes, el cleanup mata el timer y el loader nunca aparece.
    showTimer = setTimeout(() => {
      if (!cancelled) setVisible(true)
    }, SHOW_DELAY_MS)

    // Después de que la ruta cambió, damos un poco de tiempo para que la
    // página se monte y luego ocultamos.
    hideTimer = setTimeout(() => {
      if (!cancelled) setVisible(false)
    }, SHOW_DELAY_MS + HIDE_DELAY_MS + 350)

    return () => {
      cancelled = true
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [location.pathname])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="route-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.22 } }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[9998] flex flex-col items-center justify-center pointer-events-none"
          style={{
            background: 'radial-gradient(700px 500px at 50% 45%, rgba(10,132,255,0.10), transparent 65%), rgba(238,244,251,0.45)',
            backdropFilter: 'blur(6px) saturate(1.1)',
            WebkitBackdropFilter: 'blur(6px) saturate(1.1)',
          }}
        >
          <div className="relative">
            {/* Halo radial pulsante */}
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(10,132,255,0.35), transparent 65%)',
                filter: 'blur(22px)',
                transform: 'scale(1.8)',
              }}
              animate={{ opacity: [0.5, 0.95, 0.5] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Anillo girando alrededor del logo */}
            <motion.svg
              width="120"
              height="120"
              viewBox="0 0 120 120"
              className="absolute -inset-3"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
              aria-hidden
            >
              <defs>
                <linearGradient id="loader-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0A84FF" stopOpacity="0" />
                  <stop offset="60%" stopColor="#0A84FF" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#00B8D9" stopOpacity="0.95" />
                </linearGradient>
              </defs>
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="url(#loader-ring)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="120 220"
              />
            </motion.svg>

            {/* Logo con pulse suave */}
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="relative"
              style={{ width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ShieldLogo size={84} />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.3 }}
            className="mt-7 flex items-center gap-2 text-[11px] font-mono tracking-[0.18em] uppercase"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>Cargando</span>
            <Dots />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Dots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block w-1 h-1 rounded-full"
          style={{ background: 'var(--cyan)' }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}
