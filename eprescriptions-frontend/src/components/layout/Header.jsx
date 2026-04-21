import { useNavigate } from 'react-router-dom'
import { LogOut, AtSign, Menu } from 'lucide-react'
import ShieldLogo from '../3d/ShieldLogo'
import { useAuthStore } from '../../store/useAuthStore'

const ROLE_STYLES = {
  medico:       { label: 'Médico',       bg: 'rgba(10,132,255,0.10)', border: 'rgba(10,132,255,0.38)', color: '#0052CC' },
  paciente:     { label: 'Paciente',     bg: 'rgba(0,184,217,0.10)',  border: 'rgba(0,184,217,0.38)',  color: '#007A91' },
  farmaceutico: { label: 'Farmacéutico', bg: 'rgba(0,168,112,0.10)',  border: 'rgba(0,168,112,0.38)',  color: '#00775A' },
}

export default function Header({ onOpenMenu }) {
  const nav = useNavigate()
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const roleStyle = ROLE_STYLES[user?.rol] || ROLE_STYLES.paciente

  const onLogout = () => {
    logout()
    nav('/login', { replace: true })
  }

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 md:px-8 py-3 sm:py-3.5 border-b border-[var(--border-subtle)]"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(16px) saturate(1.1)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.1)',
      }}
    >
      {/* Botón menú móvil */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir menú"
        className="md:hidden p-2 rounded-lg border border-[var(--border-subtle)] bg-white/80 hover:bg-[rgba(10,132,255,0.08)] transition-colors shrink-0"
      >
        <Menu size={18} />
      </button>

      <ShieldLogo size={40} />

      {/* Columna flexible: bienvenido + nombre + chip rol (abajo, en la misma columna) */}
      <div className="min-w-0 flex-1">
        <div className="label-xs">Bienvenido</div>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <span className="font-heading text-sm sm:text-base md:text-lg leading-tight truncate max-w-[160px] sm:max-w-[220px] md:max-w-[280px]">
            {user?.nombre || 'Usuario'}
          </span>
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

      {/* Logout a la derecha */}
      <button onClick={onLogout} className="btn btn-ghost btn-sm shrink-0" aria-label="Cerrar sesión">
        <LogOut size={14} /> <span className="hidden sm:inline">Salir</span>
      </button>
    </header>
  )
}
