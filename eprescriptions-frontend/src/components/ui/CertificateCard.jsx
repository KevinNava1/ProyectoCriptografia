import { motion } from 'framer-motion'
import { ShieldCheck, KeyRound, Fingerprint } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { cn } from '../../lib/utils'

// Card específica para certificados X.509. Hover suave (translateY -2px +
// box-shadow), transición 220ms. Diseñada para listas de certs o detalles
// de solicitud. Convive con SecureCard pero tiene layout fijo y semántica.
//
// Props:
//   algo        — 'EC' | 'RSA'  → cambia el icono y el chip
//   fingerprint — string SHA-256 truncado del cert
//   serial      — número de serie del cert (string)
//   issuedAt    — Date | string
//   validUntil  — Date | string
//   status      — 'active' | 'revoked' | 'expired'
//   onClick     — opcional

const ALGO_META = {
  EC:  { label: 'ECDSA P-256',   tone: 'cyan',    icon: KeyRound },
  RSA: { label: 'RSA-OAEP 2048', tone: 'emerald', icon: KeyRound },
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

export default function CertificateCard({
  algo = 'EC',
  fingerprint,
  serial,
  issuedAt,
  validUntil,
  status = 'active',
  subjectCN,
  className,
  onClick,
}) {
  const a = ALGO_META[algo] || ALGO_META.EC
  const s = STATUS_META[status] || STATUS_META.active
  const Icon = a.icon

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 18px 38px rgba(10,132,255,0.16)' }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      onClick={onClick}
      className={cn(
        'secure-card p-4 cursor-default select-text',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: a.tone === 'cyan' ? 'rgba(10,132,255,0.10)' : 'rgba(0,168,112,0.10)',
            border: `1px solid ${a.tone === 'cyan' ? 'rgba(10,132,255,0.32)' : 'rgba(0,168,112,0.32)'}`,
          }}
        >
          <Icon size={18} style={{ color: a.tone === 'cyan' ? 'var(--cyan)' : 'var(--emerald)' }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-heading text-base">{a.label}</span>
            <StatusBadge tone={s.tone} pulse={status === 'active'} size="sm">
              {s.label}
            </StatusBadge>
          </div>
          {subjectCN && (
            <div className="text-xs text-[color:var(--text-secondary)] mt-0.5 truncate">
              CN={subjectCN}
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            {fingerprint && (
              <Row icon={<Fingerprint size={11} />} label="Fingerprint">
                <span className="font-mono break-all">{fingerprint}</span>
              </Row>
            )}
            {serial && (
              <Row icon={<ShieldCheck size={11} />} label="Serial">
                <span className="font-mono">{serial}</span>
              </Row>
            )}
            {issuedAt && <Row label="Emitido">{fmt(issuedAt)}</Row>}
            {validUntil && <Row label="Vence">{fmt(validUntil)}</Row>}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function Row({ icon, label, children }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="label-xs flex items-center gap-1 shrink-0">
        {icon}{label}
      </span>
      <span className="text-[color:var(--text-primary)] truncate">{children}</span>
    </div>
  )
}
