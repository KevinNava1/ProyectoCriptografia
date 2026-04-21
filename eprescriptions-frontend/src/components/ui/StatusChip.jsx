const MAP = {
  emitida:    { label: 'Emitida',    color: '#0052CC', bg: 'rgba(10,132,255,0.10)', border: 'rgba(10,132,255,0.40)', pulse: 'cyan' },
  dispensada: { label: 'Dispensada', color: '#00775A', bg: 'rgba(0,168,112,0.10)',  border: 'rgba(0,168,112,0.40)',  pulse: null },
  revocada:   { label: 'Revocada',   color: '#B42318', bg: 'rgba(180,35,24,0.10)',  border: 'rgba(180,35,24,0.40)',  pulse: null },
  pendiente:  { label: 'Pendiente',  color: '#8F4700', bg: 'rgba(224,135,0,0.10)',  border: 'rgba(224,135,0,0.40)',  pulse: 'amber' },
}

export default function StatusChip({ estado }) {
  const s = MAP[estado] || {
    label: estado || 'Desconocido',
    color: '#5B6B7B',
    bg: 'rgba(91,107,123,0.10)',
    border: 'rgba(91,107,123,0.32)',
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {s.pulse && <span className={`dot-pulse ${s.pulse}`} style={{ width: 6, height: 6 }} />}
      {s.label}
    </span>
  )
}
