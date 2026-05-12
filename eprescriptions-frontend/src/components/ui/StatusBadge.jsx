// Pill semántica con dot pulsante. Misma paleta que el sistema (StatusChip
// para estados de receta, EstadoChip para solicitudes); este StatusBadge es
// la primitiva genérica — recibe `tone` y opcional `pulse`.
//
// Tones: 'cyan' | 'emerald' | 'amber' | 'red' | 'neutral'
// Pulse: si la prop está, fuerza el dot pulsante con el color del tone.

const TONES = {
  cyan:    { bg: 'rgba(10,132,255,0.10)', border: 'rgba(10,132,255,0.42)', color: '#0052CC', dot: 'cyan'  },
  emerald: { bg: 'rgba(0,168,112,0.10)',  border: 'rgba(0,168,112,0.42)',  color: '#00775A', dot: ''      },
  amber:   { bg: 'rgba(224,135,0,0.10)',  border: 'rgba(224,135,0,0.42)',  color: '#8F4700', dot: 'amber' },
  red:     { bg: 'rgba(180,35,24,0.10)',  border: 'rgba(180,35,24,0.42)',  color: '#B42318', dot: 'red'   },
  neutral: { bg: 'rgba(91,107,123,0.10)', border: 'rgba(91,107,123,0.32)', color: '#5B6B7B', dot: ''      },
}

export default function StatusBadge({ tone = 'cyan', pulse = true, icon, children, className = '', size = 'md' }) {
  const t = TONES[tone] || TONES.cyan
  const sizeCls = size === 'sm'
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-2.5 py-1 text-[11px]'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wider ${sizeCls} ${className}`}
      style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.color }}
    >
      {pulse && (
        <span
          className={`dot-pulse ${t.dot}`}
          style={{ width: 6, height: 6 }}
          aria-hidden
        />
      )}
      {icon}
      {children}
    </span>
  )
}
