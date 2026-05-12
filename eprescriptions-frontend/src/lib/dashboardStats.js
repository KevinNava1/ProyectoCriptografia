// Cálculos derivados para los gráficos del Dashboard. Reciben el array de
// recetas tal cual viene del backend y devuelven datos listos para los
// componentes de charts. Todo es función pura — sin side effects.

// Buckets de los últimos N días.
function lastNDays(n) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    out.push(d)
  }
  return out
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function shortDayLabel(d) {
  const fmt = d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
  return fmt
}

function weekLabel(d) {
  return d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')
}

// ─── DONUT por estado (todos los roles) ─────────────────────────────
export function donutEstados(recetas) {
  const c = { emitida: 0, dispensada: 0, revocada: 0 }
  for (const r of recetas) {
    if (c[r.estado] !== undefined) c[r.estado]++
    else if (r.estado === 'revocada' || r.estado === 'cancelada' || r.estado === 'sustituida') c.revocada++
  }
  return [
    { label: 'Emitidas',    value: c.emitida,    color: '#0A84FF' },
    { label: 'Dispensadas', value: c.dispensada, color: '#00A870' },
    { label: 'Revocadas',   value: c.revocada,   color: '#B42318' },
  ]
}

// ─── LINE: emitidas o dispensadas por día (últimos 14 días) ────────
export function lineRecetasUltimos14(recetas, key = 'fecha') {
  const days = lastNDays(14)
  return days.map((d) => {
    const n = recetas.filter(r => {
      const ts = r[key] || r.fecha
      if (!ts) return false
      try { return sameDay(new Date(ts), d) }
      catch { return false }
    }).length
    return { label: shortDayLabel(d), value: n }
  })
}

// ─── BAR: emitidas por día (última semana) ─────────────────────────
export function barEmitidasSemana(recetas) {
  const days = lastNDays(7)
  return days.map((d) => {
    const n = recetas.filter(r => {
      if (!r.fecha) return false
      try { return sameDay(new Date(r.fecha), d) }
      catch { return false }
    }).length
    return { label: weekLabel(d), value: n }
  })
}

// ─── TOP medicamentos (médico) ─────────────────────────────────────
export function topMedicamentos(recetas, n = 5) {
  const m = {}
  for (const r of recetas) {
    if (!r.medicamento || r.medicamento === '(cifrado)') continue
    m[r.medicamento] = (m[r.medicamento] || 0) + 1
  }
  return Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, value]) => ({ label, value }))
}

// ─── Sparkline (últimos 7 días para KPI cards) ─────────────────────
export function sparklineUltimos7(recetas, predicate = () => true) {
  const days = lastNDays(7)
  return days.map(d => recetas.filter(r => {
    if (!predicate(r)) return false
    const ts = r.fecha
    if (!ts) return false
    try { return sameDay(new Date(ts), d) } catch { return false }
  }).length)
}

// ─── Heatmap de actividad (12 semanas × 7 días) ────────────────────
export function heatmapActividad(recetas, cols = 12) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cells = []
  for (let c = cols - 1; c >= 0; c--) {
    for (let r = 0; r < 7; r++) {
      const d = new Date(today)
      // semanas hacia atrás → c, día dentro de la semana → r
      d.setDate(today.getDate() - c * 7 - (6 - r))
      const n = recetas.filter(rec => {
        if (!rec.fecha) return false
        try { return sameDay(new Date(rec.fecha), d) } catch { return false }
      }).length
      cells.push(n)
    }
  }
  return cells
}

// ─── Promedio diario, total mes, racha actual ───────────────────────
export function metricasResumen(recetas) {
  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const inicioMesAnt = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
  const finMesAnt = new Date(ahora.getFullYear(), ahora.getMonth(), 0, 23, 59, 59)

  let mesActual = 0
  let mesAnterior = 0
  for (const r of recetas) {
    if (!r.fecha) continue
    const ts = new Date(r.fecha)
    if (ts >= inicioMes) mesActual++
    else if (ts >= inicioMesAnt && ts <= finMesAnt) mesAnterior++
  }
  const cambio = mesAnterior === 0
    ? (mesActual > 0 ? 100 : 0)
    : Math.round(((mesActual - mesAnterior) / mesAnterior) * 100)

  return { mesActual, mesAnterior, cambio }
}
