import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, AlertTriangle, ShieldCheck, Activity, Clock } from 'lucide-react'
import { formatDate } from '../../lib/utils'

// Timeline vertical para audit log. Cada item:
//   { id, ts, title, detail, kind: 'ok' | 'warn' | 'info' | 'crypto' }
// Reveal animado al entrar al viewport con IntersectionObserver. Cada dot
// se anima con un pequeño bounce + el contenido hace stagger.

const KIND_META = {
  ok:     { color: 'var(--emerald)',     bg: 'rgba(0,168,112,0.10)',  border: 'rgba(0,168,112,0.45)',  Icon: Check },
  warn:   { color: 'var(--amber, #B54708)', bg: 'rgba(224,135,0,0.10)', border: 'rgba(224,135,0,0.45)', Icon: AlertTriangle },
  info:   { color: 'var(--cyan)',        bg: 'rgba(10,132,255,0.10)', border: 'rgba(10,132,255,0.42)', Icon: Activity },
  crypto: { color: 'var(--blue-deep)',   bg: 'rgba(10,132,255,0.10)', border: 'rgba(10,132,255,0.42)', Icon: ShieldCheck },
}

export default function AuditTimeline({ items = [], className = '' }) {
  return (
    <div className={`relative pl-9 ${className}`}>
      <span className="audit-line" aria-hidden />
      <ul className="space-y-4">
        {items.map((it, i) => (
          <AuditItem key={it.id ?? i} item={it} index={i} />
        ))}
      </ul>
    </div>
  )
}

function AuditItem({ item, index }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const meta = KIND_META[item.kind] || KIND_META.info
  const Icon = meta.Icon

  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.18 },
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <li ref={ref} className="relative">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <motion.span
              aria-hidden
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18, delay: index * 0.05 + 0.05 }}
              className="absolute left-[-29px] top-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
            >
              <Icon size={13} />
            </motion.span>
            <div className="secure-card p-3.5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm leading-tight">{item.title}</div>
                  {item.detail && (
                    <div className="text-xs text-[color:var(--text-secondary)] mt-1 leading-relaxed">
                      {item.detail}
                    </div>
                  )}
                </div>
                {item.ts && (
                  <span className="text-[10px] font-mono text-[color:var(--text-secondary)] inline-flex items-center gap-1 shrink-0">
                    <Clock size={10} /> {formatDate(item.ts)}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
