import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Check, CheckCheck, X, Clock, RefreshCcw } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'

// Bell de notificaciones — alimentado por useNotifications (hook real).
// Se actualiza cuando:
//   - El user cambia
//   - Páginas disparan `window.dispatchEvent(new CustomEvent('securerx:notify', ...))`
//   - Polling cada 60s en background
//   - El usuario hace click en "Refrescar" dentro del panel

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const { items, refresh, dismiss, clearAll } = useNotifications(60000)
  const count = items.length

  // Cierre al click fuera
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (popRef.current?.contains(e.target)) return
      if (btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Al abrir, refresca por si llegaron nuevas
  useEffect(() => {
    if (open) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Notificaciones"
        className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors shrink-0"
        style={{
          background: open ? 'rgba(10,132,255,0.12)' : 'rgba(255,255,255,0.6)',
          border: `1px solid ${open ? 'rgba(10,132,255,0.45)' : 'var(--border-subtle)'}`,
          color: open ? 'var(--cyan)' : 'var(--text-secondary)',
        }}
      >
        <Bell size={16} />
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              key={`badge-${count}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg,#0A84FF,#00B8D9)',
                color: '#FFFFFF',
                boxShadow: '0 4px 10px rgba(10,132,255,0.45)',
              }}
            >
              {count}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={popRef}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              role="dialog"
              className="fixed right-4 top-16 z-[9999] w-[min(380px,calc(100vw-32px))] rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.96)',
                border: '1px solid rgba(10,132,255,0.28)',
                boxShadow: '0 24px 56px rgba(10,36,67,0.24), 0 0 0 1px rgba(10,132,255,0.08) inset',
                backdropFilter: 'blur(20px)',
              }}
            >
              <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-heading text-sm font-bold">Notificaciones</div>
                  <div className="text-[10px] text-[color:var(--text-secondary)]">
                    {count === 0 ? 'Sin eventos' : `${count} evento${count === 1 ? '' : 's'} reciente${count === 1 ? '' : 's'}`}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={refresh}
                    className="p-1.5 rounded hover:bg-[rgba(10,132,255,0.08)] transition-colors text-[color:var(--text-secondary)]"
                    aria-label="Refrescar"
                    title="Refrescar"
                  >
                    <RefreshCcw size={13} />
                  </button>
                  {count > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="p-1.5 rounded hover:bg-[rgba(10,132,255,0.08)] transition-colors text-[color:var(--text-secondary)]"
                      aria-label="Marcar todas como leídas"
                      title="Marcar todas como leídas"
                    >
                      <CheckCheck size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded hover:bg-[rgba(10,132,255,0.08)] transition-colors"
                    aria-label="Cerrar"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-2">
                {items.length === 0 ? (
                  <div className="px-3 py-10 text-center">
                    <Check size={28} className="mx-auto text-[color:var(--emerald)]" />
                    <div className="text-sm font-medium mt-2">Todo al día</div>
                    <div className="text-xs text-[color:var(--text-secondary)] mt-1">
                      No hay eventos nuevos.
                    </div>
                  </div>
                ) : (
<AnimatePresence initial={false}>
                    {items.map((n, i) => (
                      <motion.div
                        key={n.id}
                        layout
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                        transition={{ delay: i * 0.02 }}
                        className="group flex items-start gap-3 p-2.5 rounded-lg hover:bg-[rgba(10,132,255,0.06)] transition-colors min-w-0 cursor-pointer relative"
                        onClick={() => dismiss(n.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dismiss(n.id) } }}
                        title="Click para marcar como leída"
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base"
                          style={{ background: `${n.color}1A`, border: `1px solid ${n.color}40` }}
                        >
                          {n.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium leading-tight truncate pr-6">{n.title}</div>
                          {n.subtitle && (
                            <div className="text-[11px] text-[color:var(--text-secondary)] mt-0.5 leading-snug line-clamp-2">
                              {n.subtitle}
                            </div>
                          )}
                          <div className="text-[10px] text-[color:var(--text-secondary)] mt-1 flex items-center gap-1">
                            <Clock size={9} /> {n.hint}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); dismiss(n.id) }}
                          className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[rgba(10,132,255,0.12)] transition-all"
                          aria-label="Marcar como leída"
                          title="Marcar como leída"
                        >
                          <Check size={12} className="text-[color:var(--cyan)]" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
