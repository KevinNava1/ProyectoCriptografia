import { motion } from 'framer-motion'
import { ShieldCheck, KeyRound, Fingerprint, CalendarClock } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { cn } from '../../lib/utils'

// Card para certificados X.509 — versión compacta. Mostramos solo lo
// necesario: algoritmo, uso, serial truncado y fecha de vencimiento.
//
// Props:
//   algo        — 'EC' | 'RSA'
//   serial      — número de serie (truncamos a primeros/últimos chars)
//   validUntil  — Date | string
//   status      — 'active' | 'revoked' | 'expired'
//   uso         — 'firma' | 'cifrado' (más legible que CN raw)

const ALGO_META = {
  EC: {
    label: 'ECDSA P-256',
    tone: '#0A84FF',
    bg: 'rgba(10,132,255,0.10)',
    border: 'rgba(10,132,255,0.42)',
    icon: KeyRound,
  },
  RSA: {
    label: 'RSA-OAEP 2048',
    tone: '#00A870',
    bg: 'rgba(0,168,112,0.10)',
    border: 'rgba(0,168,112,0.42)',
    icon: KeyRound,
  },
}
const STATUS_META = {
  active:  { tone: 'emerald', label: 'Activo' },
  revoked: { tone: 'red',     label: 'Revocado' },
  expired: { tone: 'amber',   label: 'Vencido' },
}

function fmt(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return String(d) }
}

// "5f92913b51e1c4c586bc6a5e9bc5a92bb761fed9" → "5f9291…1fed9"
function truncSerial(s) {
  if (!s) return ''
  if (s.length <= 14) return s
  return `${s.slice(0, 6)}…${s.slice(-5)}`
}

export default function CertificateCard({
  algo = 'EC',
  serial,
  validUntil,
  status = 'active',
  uso,
  className,
  onClick,
}) {
  const a = ALGO_META[algo] || ALGO_META.EC
  const s = STATUS_META[status] || STATUS_META.active
  const Icon = a.icon
  const usoLabel = uso === 'cifrado' ? 'Cifrado' : 'Firma'

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: `0 18px 38px ${a.tone}26` }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      onClick={onClick}
      className={cn(
        'secure-card p-4 cursor-default select-text',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <motion.div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: a.bg, border: `1px solid ${a.border}` }}
          whileHover={{ rotate: [0, -8, 8, 0] }}
          transition={{ duration: 0.5 }}
        >
          <Icon size={20} style={{ color: a.tone }} />
        </motion.div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-heading text-base">{a.label}</span>
            <StatusBadge tone={s.tone} pulse={status === 'active'} size="sm">
              {s.label}
            </StatusBadge>
          </div>

          {/* Subtítulo: uso del certificado, claro y sin redundancia. */}
          <div
            className="text-[11.5px] font-semibold uppercase tracking-wider mt-1"
            style={{ color: a.tone, letterSpacing: '0.08em' }}
          >
            {usoLabel}
          </div>

          <div className="mt-3 space-y-1.5 text-[11.5px]">
            {serial && (
              <Row icon={<Fingerprint size={12} style={{ color: a.tone }} />} title={serial}>
                <span className="font-mono">{truncSerial(serial)}</span>
              </Row>
            )}
            {validUntil && (
              <Row icon={<CalendarClock size={12} style={{ color: a.tone }} />}>
                Vence <strong className="font-mono">{fmt(validUntil)}</strong>
              </Row>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function Row({ icon, children, title }) {
  return (
    <div className="flex items-center gap-2 text-[color:var(--text-primary)]" title={title}>
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  )
}
