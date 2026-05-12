import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Plus, FileSignature, ClipboardList, Pill, KeyRound, Stamp, Command, Bell, X, Sparkles,
} from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'

// Botón flotante con menú radial de acciones rápidas. Aparece en pantallas
// internas (NO en login/registro). Las acciones se filtran por rol.
//
// UX:
//   - Click en FAB → menú aparece arriba con stagger
//   - Click en una acción → navega
//   - Click fuera o ESC → cierra
//   - Tap del FAB con menú abierto → cierra
//
// El FAB es self-contained: se monta en App una vez y maneja su visibilidad
// según la ruta actual.

const HIDE_ON_ROUTES = ['/login', '/registro', '/verificar-email', '/recuperar-password']

function actionsFor(rol) {
  const open = (label, hint, icon, to) => ({ label, hint, icon, to })
  if (rol === 'medico') return [
    open('Emitir nueva receta', 'Firmar con ECDSA', FileSignature, '/nueva-receta'),
    open('Mis emitidas',        'Revisar histórico', ClipboardList, '/mis-emitidas'),
    open('Buscar (⌘K)',         'Comandos rápidos',  Command, '__cmd'),
  ]
  if (rol === 'paciente') return [
    open('Mis recetas',         'Ver activas y dispensadas', Pill, '/mis-recetas'),
    open('Verificar firmas',    'ECDSA + AES-GCM',   KeyRound, '/verificar'),
    open('Acuses',              'Firmar entregas',   Stamp, '/dispensaciones'),
    open('Buscar (⌘K)',         'Comandos rápidos',  Command, '__cmd'),
  ]
  if (rol === 'farmaceutico') return [
    open('Dispensar',           'Recetas pendientes', ClipboardList, '/pendientes'),
    open('Dispensaciones',      'Histórico read-only', Stamp, '/dispensaciones'),
    open('Buscar (⌘K)',         'Comandos rápidos',  Command, '__cmd'),
  ]
  if (rol === 'admin') return [
    open('Solicitudes',         'Aprobar / rechazar', Bell, '/admin/solicitudes'),
    open('Buscar (⌘K)',         'Comandos rápidos',  Command, '__cmd'),
  ]
  return []
}

export default function FloatingActions() {
  const [open, setOpen] = useState(false)
  const user = useAuthStore(s => s.user)
  const nav = useNavigate()
  const location = useLocation()

  useEffect(() => { setOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!user) return null
  if (HIDE_ON_ROUTES.some(r => location.pathname.startsWith(r))) return null

  const actions = actionsFor(user.rol)
  if (actions.length === 0) return null

  const exec = (a) => {
    setOpen(false)
    if (a.to === '__cmd') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    } else if (a.to) {
      nav(a.to)
    }
  }

  return (
    <div
      className="fixed z-[9990] flex flex-col items-end gap-3"
      style={{ right: 'max(20px, env(safe-area-inset-right))', bottom: 'max(20px, env(safe-area-inset-bottom))' }}
    >
      <AnimatePresence>
        {open && (
          <motion.ul
            key="fab-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-end gap-2 mb-1"
          >
            {actions.map((a, i) => {
              const Icon = a.icon
              return (
                <motion.li
                  key={a.label}
                  initial={{ opacity: 0, y: 12, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.94 }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 320, damping: 24 }}
                >
                  <button
                    type="button"
                    onClick={() => exec(a)}
                    className="group flex items-center gap-3 pr-1.5 pl-3 py-1.5 rounded-full shadow-lg transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid rgba(10,132,255,0.32)',
                      backdropFilter: 'blur(14px)',
                      boxShadow: '0 12px 28px rgba(10,36,67,0.18)',
                    }}
                  >
                    <span className="text-right">
                      <div className="text-[12px] font-semibold leading-tight text-[color:var(--text-primary)]">{a.label}</div>
                      <div className="text-[9.5px] text-[color:var(--text-secondary)] leading-tight">{a.hint}</div>
                    </span>
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                      style={{
                        background: 'linear-gradient(135deg, #0A84FF 0%, #0052CC 100%)',
                        boxShadow: '0 6px 16px rgba(10,132,255,0.42)',
                      }}
                    >
                      <Icon size={15} className="text-white" />
                    </span>
                  </button>
                </motion.li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Cerrar acciones' : 'Acciones rápidas'}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.92 }}
        animate={{ rotate: open ? 135 : 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        className="relative w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg,#0A84FF 0%,#00B8D9 50%,#0052CC 100%)',
          boxShadow: '0 12px 32px rgba(10,132,255,0.45), 0 0 0 1px rgba(255,255,255,0.18) inset',
        }}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.32), transparent 55%)',
          }}
        />
        {open ? <X size={22} color="#FFFFFF" /> : <Plus size={22} color="#FFFFFF" />}
        {!open && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ border: '2px solid rgba(255,255,255,0.4)' }}
            animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0, 0.55] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </motion.button>
    </div>
  )
}
