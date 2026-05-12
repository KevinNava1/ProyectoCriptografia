import { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Search, LayoutDashboard, Pill, FileSignature, ClipboardList,
  ShieldCheck, KeyRound, Stamp, LogOut, Hash, ArrowRight, BarChart3,
} from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'

// Cmd palette tipo Linear/Notion.
// Atajos:
//   Ctrl+K / Cmd+K → abrir
//   Esc            → cerrar
//   ↑ / ↓          → navegar resultados
//   Enter          → ejecutar acción seleccionada
//
// Comandos:
//   - Navegación a páginas (filtradas por rol)
//   - Búsqueda de receta por ID (si escribes #42 o "receta 42")
//   - Logout
//
// Cero deps externas. Fuzzy search simple (substring case-insensitive).

function commandsFor(rol) {
  const base = [
    { id: 'dashboard', label: 'Ir al Dashboard', icon: LayoutDashboard, hint: 'Panel principal', to: '/dashboard' },
  ]
  if (rol && rol !== 'admin') {
    base.push({ id: 'estadisticas', label: 'Ver estadísticas', icon: BarChart3, hint: 'Gráficos y mapa de calor', to: '/estadisticas' })
  }
  if (rol === 'paciente') {
    base.push(
      { id: 'mis-recetas', label: 'Mis recetas', icon: Pill, hint: 'Ver mis recetas', to: '/mis-recetas' },
      { id: 'verificar', label: 'Verificar firmas', icon: KeyRound, hint: 'ECDSA · AES-GCM', to: '/verificar' },
      { id: 'dispensaciones', label: 'Acuses de dispensación', icon: Stamp, hint: 'Firmar entregas', to: '/dispensaciones' },
    )
  }
  if (rol === 'medico') {
    base.push(
      { id: 'nueva-receta', label: 'Emitir nueva receta', icon: FileSignature, hint: 'Firmar nueva', to: '/nueva-receta' },
      { id: 'mis-emitidas', label: 'Mis recetas emitidas', icon: ClipboardList, hint: 'Cancelar o sustituir', to: '/mis-emitidas' },
      { id: 'dispensaciones', label: 'Histórico de dispensaciones', icon: Stamp, hint: 'Read-only', to: '/dispensaciones' },
    )
  }
  if (rol === 'farmaceutico') {
    base.push(
      { id: 'pendientes', label: 'Recetas pendientes', icon: ClipboardList, hint: 'Por dispensar', to: '/pendientes' },
      { id: 'dispensaciones', label: 'Histórico de dispensaciones', icon: Stamp, hint: 'Read-only', to: '/dispensaciones' },
    )
  }
  if (rol === 'admin') {
    base.push(
      { id: 'admin', label: 'Solicitudes de certificación', icon: ShieldCheck, hint: 'Aprobar / rechazar', to: '/admin/solicitudes' },
    )
  }
  return base
}

function fuzzyMatch(text, query) {
  if (!query) return true
  const t = text.toLowerCase()
  const q = query.toLowerCase().trim()
  if (t.includes(q)) return true
  // Match palabra por palabra
  return q.split(/\s+/).every(part => t.includes(part))
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const nav = useNavigate()
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)

  // Atajo global Ctrl/Cmd+K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Focus al abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setActive(0)
    }
  }, [open])

  const commands = useMemo(() => commandsFor(user?.rol), [user?.rol])

  // Detectar "receta 42" o "#42" → comando especial
  const recetaId = useMemo(() => {
    const m = query.match(/(?:receta\s*|#)\s*(\d+)/i) || query.match(/^\s*(\d+)\s*$/)
    return m ? m[1] : null
  }, [query])

  const filtered = useMemo(() => {
    const base = commands.filter(c => fuzzyMatch(`${c.label} ${c.hint}`, query))
    if (recetaId) {
      base.unshift({
        id: 'receta',
        label: `Abrir receta #${recetaId}`,
        icon: Hash,
        hint: 'Va al verificador (paciente) o búsqueda',
        to: user?.rol === 'farmaceutico' ? '/pendientes' : '/verificar',
      })
    }
    return base
  }, [commands, query, recetaId, user?.rol])

  const exec = (cmd) => {
    if (!cmd) return
    setOpen(false)
    if (cmd.id === 'logout') {
      logout()
      nav('/login', { replace: true })
      return
    }
    if (cmd.to) nav(cmd.to)
  }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(a => Math.min(filtered.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(a => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      exec(filtered[active])
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="cmd-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[10001]"
            style={{
              background: 'rgba(10,25,48,0.55)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            key="cmd-modal"
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed inset-x-4 top-[14vh] mx-auto z-[10002] w-[min(640px,calc(100vw-32px))] rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.96)',
              border: '1px solid rgba(10,132,255,0.32)',
              boxShadow: '0 30px 70px rgba(10,36,67,0.32), 0 0 0 1px rgba(10,132,255,0.08) inset',
              backdropFilter: 'blur(24px)',
            }}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-subtle)]">
              <Search size={18} className="text-[color:var(--text-secondary)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0) }}
                onKeyDown={onKey}
                placeholder="Busca páginas, recetas (#42), comandos…"
                className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-[color:var(--text-secondary)]"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[color:var(--text-secondary)]">
                ESC
              </kbd>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-[color:var(--text-secondary)]">
                  Sin coincidencias.
                </div>
              )}
              {filtered.map((cmd, i) => {
                const Icon = cmd.icon
                const isActive = i === active
                return (
                  <button
                    key={cmd.id + i}
                    type="button"
                    onClick={() => exec(cmd)}
                    onMouseEnter={() => setActive(i)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                    style={{
                      background: isActive ? 'rgba(10,132,255,0.10)' : 'transparent',
                      color: isActive ? 'var(--blue-deep)' : 'var(--text-primary)',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                      style={{
                        background: isActive ? 'rgba(10,132,255,0.20)' : 'rgba(10,132,255,0.08)',
                        border: '1px solid rgba(10,132,255,0.24)',
                      }}
                    >
                      <Icon size={15} className="text-[color:var(--cyan)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-tight">{cmd.label}</div>
                      {cmd.hint && (
                        <div className="text-[11px] text-[color:var(--text-secondary)] mt-0.5 truncate">
                          {cmd.hint}
                        </div>
                      )}
                    </div>
                    {isActive && <ArrowRight size={14} className="text-[color:var(--cyan)] shrink-0" />}
                  </button>
                )
              })}
            </div>

            <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] text-[color:var(--text-secondary)] font-mono">
              <span className="flex items-center gap-3">
                <span><kbd className="px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">↑↓</kbd> navegar</span>
                <span><kbd className="px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">↵</kbd> ejecutar</span>
              </span>
              <span>SecureRx · ⌘K</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
