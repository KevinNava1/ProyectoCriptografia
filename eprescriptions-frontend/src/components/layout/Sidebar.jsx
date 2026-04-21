import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Pill, FileSignature, ClipboardList,
  Activity, ShieldCheck, KeyRound, PanelLeftClose, PanelLeftOpen, X,
} from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'

function linksForRole(role) {
  const base = [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Resumen' }]
  if (role === 'paciente') {
    base.push({ to: '/mis-recetas',  label: 'Mis recetas',      icon: Pill,           hint: 'Recetas activas' })
    base.push({ to: '/verificar',    label: 'Verificar firmas', icon: KeyRound,       hint: 'ECDSA · AES-GCM' })
  }
  if (role === 'medico')       base.push({ to: '/nueva-receta', label: 'Emitir receta', icon: FileSignature, hint: 'Firmar nueva' })
  if (role === 'farmaceutico') base.push({ to: '/pendientes',   label: 'Pendientes',    icon: ClipboardList, hint: 'Por dispensar' })
  return base
}

function BrandBlock({ expanded }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-5 border-b border-[var(--border-subtle)]">
      <motion.div
        whileHover={{ rotate: 14, scale: 1.06 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg,#0A84FF 0%,#00B8D9 55%,#0052CC 100%)',
          boxShadow: '0 6px 18px rgba(10,132,255,0.35), inset 0 0 0 1px rgba(255,255,255,0.25)',
        }}
      >
        <Activity size={19} className="text-white relative z-10" />
        <motion.span
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.45), transparent 55%)' }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 3.2, repeat: Infinity }}
        />
      </motion.div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="brand-text"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
            className="min-w-0 overflow-hidden"
          >
            <div className="font-heading text-sm font-bold leading-none whitespace-nowrap">SecureRx</div>
            <div className="text-[9px] text-[color:var(--text-secondary)] tracking-[0.18em] uppercase mt-1 whitespace-nowrap">
              e-prescriptions
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NavItem({ link, active, expanded, onNavigate }) {
  const Icon = link.icon
  return (
    <NavLink
      to={link.to}
      onClick={onNavigate}
      className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
      style={{ color: active ? 'var(--blue-deep)' : 'var(--text-secondary)' }}
      title={expanded ? undefined : link.label}
    >
      {active && (
        <motion.span
          layoutId="nav-indicator"
          className="absolute inset-0 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(10,132,255,0.18), rgba(0,184,217,0.10))',
            border: '1px solid rgba(10,132,255,0.40)',
            boxShadow: '0 8px 24px rgba(10,132,255,0.18), inset 0 0 0 1px rgba(255,255,255,0.22)',
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
      {active && (
        <motion.span
          layoutId="nav-accent"
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
          style={{ background: 'linear-gradient(180deg,#0A84FF,#00B8D9)' }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
      <motion.span
        whileHover={{ scale: 1.14, rotate: active ? 0 : -4 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18 }}
        className="relative z-10 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{
          background: active ? 'rgba(10,132,255,0.12)' : 'transparent',
        }}
      >
        <Icon size={16} />
      </motion.span>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.span
            key={`${link.to}-label`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.16 }}
            className="relative z-10 flex-1 min-w-0 overflow-hidden"
          >
            <div className="text-sm font-medium whitespace-nowrap">{link.label}</div>
            <div className="text-[10px] text-[color:var(--text-secondary)] whitespace-nowrap truncate">
              {link.hint}
            </div>
          </motion.span>
        )}
      </AnimatePresence>
      {active && expanded && (
        <motion.span
          className="relative z-10 w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: 'var(--cyan)' }}
          animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.2, 0.9] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}
    </NavLink>
  )
}

function SecurityCard({ expanded }) {
  return (
    <div className="m-3 rounded-xl overflow-hidden relative"
      style={{
        background: 'linear-gradient(135deg, rgba(10,132,255,0.10), rgba(0,184,217,0.08))',
        border: '1px solid rgba(10,132,255,0.30)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35)',
      }}
    >
      <motion.span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 20% 0%, rgba(10,132,255,0.18), transparent 55%)' }}
        animate={{ opacity: [0.45, 0.8, 0.45] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <div className="relative p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-[color:var(--emerald)] shrink-0" />
          <AnimatePresence initial={false}>
            {expanded ? (
              <motion.span
                key="sec-label"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                className="text-[11px] font-semibold whitespace-nowrap"
              >
                Sistema seguro
              </motion.span>
            ) : null}
          </AnimatePresence>
          <span className="dot-pulse ml-auto shrink-0" style={{ width: 6, height: 6 }} />
        </div>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="sec-desc"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-[10px] text-[color:var(--text-secondary)] leading-relaxed mt-2 overflow-hidden"
            >
              <div className="font-mono">AES-256-GCM</div>
              <div className="font-mono">ECDSA P-256 · SHA-256</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function SidebarBody({ links, currentPath, expanded, onToggle, onNavigate, showToggle = true }) {
  return (
    <>
      <BrandBlock expanded={expanded} />

      <nav className="flex flex-col gap-1 p-2 flex-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="nav-label"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="label-xs px-3 py-2"
            >
              Navegación
            </motion.div>
          )}
        </AnimatePresence>
        {links.map((link) => (
          <NavItem
            key={link.to}
            link={link}
            active={currentPath === link.to}
            expanded={expanded}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="mt-auto">
        <SecurityCard expanded={expanded} />
        {showToggle && (
          <div className="px-2 pb-3">
            <button
              type="button"
              onClick={onToggle}
              aria-label={expanded ? 'Colapsar menú' : 'Expandir menú'}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-[11px] font-medium transition-colors"
              style={{
                background: 'rgba(255,255,255,0.45)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              {expanded ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.span
                    key="toggle-text"
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                  >
                    Colapsar
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default function Sidebar({ mobileOpen = false, onMobileClose }) {
  const user = useAuthStore(s => s.user)
  const location = useLocation()
  const links = linksForRole(user?.rol)

  // Rail compacto por defecto; expande con hover o toggle pinneado
  const [pinned, setPinned] = useState(true)
  const [hovered, setHovered] = useState(false)
  const expanded = pinned || hovered

  return (
    <>
      {/* Desktop */}
      <motion.aside
        className="hidden md:flex shrink-0 flex-col sticky top-0 h-screen z-20 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(244,249,255,0.78) 100%)',
          backdropFilter: 'blur(22px) saturate(1.15)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.15)',
          borderRight: '1px solid var(--border-subtle)',
          boxShadow: expanded
            ? '8px 0 36px rgba(10,36,67,0.08), inset -1px 0 0 rgba(10,132,255,0.05)'
            : '4px 0 18px rgba(10,36,67,0.04), inset -1px 0 0 rgba(10,132,255,0.05)',
        }}
        animate={{ width: expanded ? 248 : 74 }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Línea de acento vertical en el borde derecho */}
        <div
          aria-hidden
          className="absolute top-0 right-0 bottom-0 w-[2px] opacity-70"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(10,132,255,0.35) 35%, rgba(0,184,217,0.35) 65%, transparent 100%)',
          }}
        />
        <SidebarBody
          links={links}
          currentPath={location.pathname}
          expanded={expanded}
          onToggle={() => setPinned(p => !p)}
        />
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="overlay"
              className="md:hidden fixed inset-0 z-40"
              style={{ background: 'rgba(10,36,67,0.42)', backdropFilter: 'blur(4px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onMobileClose}
              aria-hidden
            />
            <motion.aside
              key="drawer"
              className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(244,249,255,0.88) 100%)',
                backdropFilter: 'blur(22px) saturate(1.15)',
                WebkitBackdropFilter: 'blur(22px) saturate(1.15)',
                borderRight: '1px solid var(--border-subtle)',
                boxShadow: '16px 0 60px rgba(10,36,67,0.24)',
              }}
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div
                aria-hidden
                className="absolute top-0 right-0 bottom-0 w-[2px]"
                style={{
                  background: 'linear-gradient(180deg, transparent, rgba(10,132,255,0.5), rgba(0,184,217,0.5), transparent)',
                }}
              />
              <button
                type="button"
                onClick={onMobileClose}
                aria-label="Cerrar menú"
                className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-[rgba(10,132,255,0.1)] transition-colors z-10"
              >
                <X size={16} />
              </button>
              <SidebarBody
                links={links}
                currentPath={location.pathname}
                expanded
                onNavigate={onMobileClose}
                showToggle={false}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
