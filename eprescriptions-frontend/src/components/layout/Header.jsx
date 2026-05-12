import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogOut, AtSign, Menu, Command } from 'lucide-react'
import ShieldLogo from '../3d/ShieldLogo'
import NotificationBell from '../ui/NotificationBell'
import { useAuthStore } from '../../store/useAuthStore'

const ROLE_STYLES = {
  medico:       { label: 'Médico',       bg: 'rgba(10,132,255,0.10)', border: 'rgba(10,132,255,0.38)', color: '#0052CC' },
  paciente:     { label: 'Paciente',     bg: 'rgba(0,184,217,0.10)',  border: 'rgba(0,184,217,0.38)',  color: '#007A91' },
  farmaceutico: { label: 'Farmacéutico', bg: 'rgba(0,168,112,0.10)',  border: 'rgba(0,168,112,0.38)',  color: '#00775A' },
  admin:        { label: 'Admin',        bg: 'rgba(132,80,210,0.10)', border: 'rgba(132,80,210,0.38)', color: '#5C2EAD' },
}

// Header dinámico: a partir de ~32px de scroll se compacta (menos padding,
// logo y tipografía más chicos, fondo más opaco). Esto evita que tape contenido
// y se siente "responsivo" al scroll, no estático. La transición es animada
// para que el cambio se vea fluido.
export default function Header({ onOpenMenu }) {
  const nav = useNavigate()
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const roleStyle = ROLE_STYLES[user?.rol] || ROLE_STYLES.paciente
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const onLogout = () => {
    logout()
    nav('/login', { replace: true })
  }

  return (
    <motion.header
      initial={false}
      animate={{
        paddingTop: scrolled ? 8 : 14,
        paddingBottom: scrolled ? 8 : 14,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 md:px-8 border-b border-[var(--border-subtle)]"
      style={{
        background: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(20px) saturate(1.15)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.15)',
        boxShadow: scrolled
          ? '0 4px 18px rgba(10,36,67,0.08)'
          : '0 1px 0 rgba(10,36,67,0.04)',
        transition: 'background 240ms ease, box-shadow 240ms ease',
      }}
    >
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir menú"
        className="md:hidden p-2 rounded-lg border border-[var(--border-subtle)] bg-white/80 hover:bg-[rgba(10,132,255,0.08)] transition-colors shrink-0"
      >
        <Menu size={18} />
      </button>

      <motion.div
        initial={false}
        animate={{ scale: scrolled ? 0.82 : 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        style={{ transformOrigin: 'left center' }}
      >
        <ShieldLogo size={40} />
      </motion.div>

      <div className="min-w-0 flex-1">
        <motion.div
          initial={false}
          animate={{
            opacity: scrolled ? 0 : 1,
            height: scrolled ? 0 : 'auto',
            marginBottom: scrolled ? 0 : 2,
          }}
          transition={{ duration: 0.18 }}
          className="label-xs overflow-hidden"
        >
          Bienvenido
        </motion.div>
        <div className="flex items-center gap-2 flex-wrap">
          <motion.span
            initial={false}
            animate={{ fontSize: scrolled ? 14 : 16 }}
            transition={{ duration: 0.2 }}
            className="font-heading leading-tight truncate max-w-[160px] sm:max-w-[220px] md:max-w-[280px]"
          >
            {user?.nombre || 'Usuario'}
          </motion.span>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium whitespace-nowrap"
            style={{ background: roleStyle.bg, border: `1px solid ${roleStyle.border}`, color: roleStyle.color }}
          >
            <span className="hidden xs:inline sm:inline">{roleStyle.label}</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <AtSign size={10} className="opacity-70" />
              <span className="truncate max-w-[90px] sm:max-w-[140px]">{user?.username}</span>
            </span>
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
        aria-label="Buscar (Ctrl+K)"
        className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs shrink-0 transition-colors"
        style={{
          background: 'rgba(255,255,255,0.6)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
        title="Buscar (Ctrl+K)"
      >
        <Command size={13} />
        <span>Buscar</span>
        <kbd className="ml-1 px-1.5 py-0.5 rounded border border-[var(--border-subtle)] font-mono text-[9px]">⌘K</kbd>
      </button>

      <NotificationBell />

      <button onClick={onLogout} className="btn btn-ghost btn-sm shrink-0" aria-label="Cerrar sesión">
        <LogOut size={14} /> <span className="hidden sm:inline">Salir</span>
      </button>
    </motion.header>
  )
}
