import { useMemo, useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'

// Charts SVG formales. Principios:
//   - viewBox fijo, preserveAspectRatio "xMidYMid meet" (default sano)
//   - Padding interno garantizado (sin recortes)
//   - Eje Y con labels formateados (0, 25, 50, …)
//   - Tooltip con hover (cursor crosshair)
//   - Leyenda y headers consistentes via <ChartCard>

// ──────────────────────────── HOOK: container width ─────────────────
function useContainerWidth(initial = 600) {
  const ref = useRef(null)
  const [w, setW] = useState(initial)
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(([entry]) => {
      const cw = entry.contentRect.width
      if (cw > 0) setW(cw)
    })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return [ref, w]
}

// Escala Y con ticks "bonitos" (1, 2, 5, 10, 20, 50, 100…)
function niceScale(max, ticks = 4) {
  if (max <= 0) return { max: 4, step: 1, ticks: [0, 1, 2, 3, 4] }
  const rough = max / ticks
  const pow = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / pow
  const niceNorm = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  const step = niceNorm * pow
  const niceMax = Math.ceil(max / step) * step
  const t = []
  for (let i = 0; i <= niceMax / step; i++) t.push(Math.round(i * step))
  return { max: niceMax, step, ticks: t }
}

// ──────────────────────────── CHART CARD WRAPPER ─────────────────────
export function ChartCard({ title, subtitle, delta, action, footer, children, className = '', dense = false }) {
  return (
    <div
      className={`secure-card relative overflow-hidden flex flex-col ${dense ? 'p-4' : 'p-5'} ${className}`}
      style={{ minWidth: 0 }}
    >
      <header className="flex items-start justify-between gap-3 mb-3 min-w-0">
        <div className="min-w-0">
          <div className="font-semibold text-sm leading-tight truncate">{title}</div>
          {subtitle && (
            <div className="text-[10px] text-[color:var(--text-secondary)] mt-0.5 truncate">{subtitle}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {typeof delta === 'number' && <DeltaPill delta={delta} />}
          {action}
        </div>
      </header>
      <div className="flex-1 min-w-0 min-h-0">{children}</div>
      {footer && (
        <footer className="mt-3 pt-3 border-t border-[var(--border-subtle)] text-[11px] text-[color:var(--text-secondary)]">
          {footer}
        </footer>
      )}
    </div>
  )
}

function DeltaPill({ delta }) {
  const up = delta >= 0
  return (
    <span
      className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={
        up
          ? { background: 'rgba(0,168,112,0.10)', color: '#00775A', border: '1px solid rgba(0,168,112,0.32)' }
          : { background: 'rgba(180,35,24,0.10)', color: '#B42318', border: '1px solid rgba(180,35,24,0.32)' }
      }
    >
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{delta}%
    </span>
  )
}

// ──────────────────────────── LINE CHART ─────────────────────────────
// data: [{ label, value }]
export function LineChart({
  data = [],
  height = 200,
  color = '#0A84FF',
  fill = 'rgba(10,132,255,0.16)',
  className,
  yLabel,
}) {
  const [ref, width] = useContainerWidth(600)
  const [hover, setHover] = useState(null)

  if (data.length === 0) {
    return <EmptyChart height={height} />
  }

  const PAD_L = 38, PAD_R = 16, PAD_T = 14, PAD_B = 26
  const innerW = Math.max(80, width - PAD_L - PAD_R)
  const innerH = Math.max(40, height - PAD_T - PAD_B)

  const maxVal = Math.max(0, ...data.map(d => d.value))
  const scale = niceScale(maxVal, 4)
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0

  const points = data.map((d, i) => {
    const x = PAD_L + i * stepX
    const y = PAD_T + innerH - (d.value / Math.max(1, scale.max)) * innerH
    return { x, y, ...d }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')
  const fillPath = points.length === 0
    ? ''
    : `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${PAD_T + innerH} L ${points[0].x.toFixed(2)} ${PAD_T + innerH} Z`

  // Etiquetas X — solo cada ~N para no saturar
  const labelStep = Math.max(1, Math.ceil(data.length / 6))

  // Manejo de hover: mapea x→índice más cercano
  const onMove = (e) => {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * width
    const i = Math.round((x - PAD_L) / Math.max(1, stepX))
    if (i >= 0 && i < points.length) setHover(i)
  }
  const onLeave = () => setHover(null)

  return (
    <div ref={ref} className={`relative ${className || ''}`} style={{ width: '100%' }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="line-fill-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={fill} />
            <stop offset="100%" stopColor={fill} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y gridlines + labels */}
        {scale.ticks.map((t, i) => {
          const y = PAD_T + innerH - (t / Math.max(1, scale.max)) * innerH
          return (
            <g key={i}>
              <line x1={PAD_L} x2={width - PAD_R} y1={y} y2={y} stroke="rgba(10,36,67,0.06)" strokeWidth="1" />
              <text
                x={PAD_L - 8}
                y={y + 3}
                textAnchor="end"
                fontFamily="JetBrains Mono, monospace"
                fontSize="9"
                fill="rgba(91,107,123,0.85)"
              >
                {t}
              </text>
            </g>
          )
        })}

        {/* Eje X baseline */}
        <line x1={PAD_L} x2={width - PAD_R} y1={PAD_T + innerH} y2={PAD_T + innerH} stroke="rgba(10,36,67,0.18)" strokeWidth="1" />

        {/* Fill */}
        <motion.path
          d={fillPath}
          fill="url(#line-fill-grad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        {/* Línea */}
        <motion.path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Hover guide */}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={points[hover].x} x2={points[hover].x} y1={PAD_T} y2={PAD_T + innerH} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
            <circle cx={points[hover].x} cy={points[hover].y} r="5" fill="white" stroke={color} strokeWidth="2" />
          </g>
        )}

        {/* Puntos chicos siempre */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hover === i ? 0 : 2.5}
            fill="white"
            stroke={color}
            strokeWidth="1.6"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.35, delay: 0.5 + i * 0.03, type: 'spring', stiffness: 300, damping: 18 }}
          />
        ))}

        {/* Etiquetas X */}
        {points.map((p, i) => (i % labelStep === 0 || i === points.length - 1) && (
          <text
            key={`l-${i}`}
            x={p.x}
            y={PAD_T + innerH + 16}
            textAnchor="middle"
            fontFamily="JetBrains Mono, monospace"
            fontSize="9"
            fill="rgba(91,107,123,0.85)"
          >
            {p.label}
          </text>
        ))}
      </svg>

      {/* Tooltip flotante */}
      {hover !== null && points[hover] && (
        <Tooltip
          x={points[hover].x}
          y={points[hover].y}
          chartW={width}
          chartH={height}
          label={points[hover].label}
          value={points[hover].value}
          color={color}
          yLabel={yLabel}
        />
      )}
    </div>
  )
}

// ──────────────────────────── BAR CHART ─────────────────────────────
// data: [{ label, value }]
export function BarChart({
  data = [],
  height = 220,
  color = '#0A84FF',
  className,
  yLabel,
}) {
  const [ref, width] = useContainerWidth(600)
  const [hover, setHover] = useState(null)

  if (data.length === 0) {
    return <EmptyChart height={height} />
  }

  const PAD_L = 38, PAD_R = 14, PAD_T = 14, PAD_B = 30
  const innerW = Math.max(80, width - PAD_L - PAD_R)
  const innerH = Math.max(40, height - PAD_T - PAD_B)
  const maxVal = Math.max(0, ...data.map(d => d.value))
  const scale = niceScale(maxVal, 4)
  const gap = 6
  const barW = Math.max(6, (innerW - gap * (data.length - 1)) / data.length)

  return (
    <div ref={ref} className={`relative ${className || ''}`} style={{ width: '100%' }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="bar-grad-v2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Y gridlines + labels */}
        {scale.ticks.map((t, i) => {
          const y = PAD_T + innerH - (t / Math.max(1, scale.max)) * innerH
          return (
            <g key={i}>
              <line x1={PAD_L} x2={width - PAD_R} y1={y} y2={y} stroke="rgba(10,36,67,0.06)" strokeWidth="1" />
              <text
                x={PAD_L - 8}
                y={y + 3}
                textAnchor="end"
                fontFamily="JetBrains Mono, monospace"
                fontSize="9"
                fill="rgba(91,107,123,0.85)"
              >
                {t}
              </text>
            </g>
          )
        })}

        {/* Eje X baseline */}
        <line x1={PAD_L} x2={width - PAD_R} y1={PAD_T + innerH} y2={PAD_T + innerH} stroke="rgba(10,36,67,0.18)" strokeWidth="1" />

        {data.map((d, i) => {
          const h = (d.value / Math.max(1, scale.max)) * innerH
          const x = PAD_L + i * (barW + gap)
          const y = PAD_T + innerH - h
          const isHover = hover === i
          return (
            <g key={i}>
              {/* Área transparente para mejor hover */}
              <rect
                x={x - gap / 2}
                y={PAD_T}
                width={barW + gap}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                style={{ cursor: 'default' }}
              />
              <motion.rect
                x={x}
                width={barW}
                rx="4"
                fill="url(#bar-grad-v2)"
                style={{ filter: isHover ? 'brightness(1.12)' : 'none', transition: 'filter 180ms ease' }}
                initial={{ y: PAD_T + innerH, height: 0 }}
                animate={{ y, height: h }}
                transition={{ duration: 0.7, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              />
              <text
                x={x + barW / 2}
                y={PAD_T + innerH + 18}
                textAnchor="middle"
                fontFamily="JetBrains Mono, monospace"
                fontSize="9"
                fill="rgba(91,107,123,0.85)"
              >
                {String(d.label).slice(0, 8)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hover !== null && data[hover] && (
        <Tooltip
          x={PAD_L + hover * (barW + gap) + barW / 2}
          y={PAD_T + innerH - (data[hover].value / Math.max(1, scale.max)) * innerH}
          chartW={width}
          chartH={height}
          label={data[hover].label}
          value={data[hover].value}
          color={color}
          yLabel={yLabel}
        />
      )}
    </div>
  )
}

// ──────────────────────────── DONUT CHART ─────────────────────────────
// segments: [{ label, value, color }]
export function DonutChart({
  segments = [],
  size = 200,
  thickness = 22,
  centerLabel,
  centerValue,
  className,
  legend = 'right',  // 'right' | 'bottom' | 'none'
}) {
  const total = Math.max(1, segments.reduce((s, x) => s + (x.value || 0), 0))
  const cx = size / 2
  const cy = size / 2
  const r = (size - thickness) / 2

  const arcs = useMemo(() => {
    let acc = 0
    return segments.map((seg, i) => {
      const start = acc / total
      acc += seg.value || 0
      const end = acc / total
      return { ...seg, start, end, i, pct: ((seg.value || 0) / total) * 100 }
    })
  }, [segments, total])

  const valueText = centerValue !== undefined ? String(centerValue) : ''
  const valueFontSize = valueText.length >= 5 ? 18 : valueText.length >= 4 ? 22 : 26

  const chartSvg = (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(10,36,67,0.06)" strokeWidth={thickness} />
        {arcs.map((a) => {
          const c = 2 * Math.PI * r
          const len = (a.end - a.start) * c
          const dash = `${len} ${c - len}`
          const offset = -a.start * c
          return (
            <motion.circle
              key={a.i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={thickness}
              strokeDasharray={dash}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: a.i * 0.1 }}
            />
          )
        })}
      </svg>
      {(centerLabel || centerValue !== undefined) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
          {centerValue !== undefined && (
            <div
              className="font-heading leading-none"
              style={{ color: 'var(--text-primary)', fontSize: valueFontSize }}
            >
              {centerValue}
            </div>
          )}
          {centerLabel && <div className="label-xs mt-1">{centerLabel}</div>}
        </div>
      )}
    </div>
  )

  const legendBlock = (
    <ul className={legend === 'right' ? 'space-y-2 min-w-0' : 'flex flex-wrap gap-x-3 gap-y-1.5 justify-center'}>
      {arcs.map((s, i) => (
        <li
          key={i}
          className={legend === 'right' ? 'flex items-center gap-2 text-[11px]' : 'inline-flex items-center gap-1.5 text-[11px]'}
        >
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
          <span style={{ color: 'var(--text-secondary)' }} className="truncate">{s.label}</span>
          <strong style={{ color: 'var(--text-primary)' }} className="ml-auto pl-2">{s.value}</strong>
          {legend === 'right' && (
            <span className="font-mono text-[10px] text-[color:var(--text-secondary)] tabular-nums w-10 text-right">
              {Math.round(s.pct)}%
            </span>
          )}
        </li>
      ))}
    </ul>
  )

  if (legend === 'none') {
    return <div className={className}>{chartSvg}</div>
  }

  if (legend === 'right') {
    return (
      <div className={`flex items-center gap-5 min-w-0 ${className || ''}`}>
        {chartSvg}
        <div className="flex-1 min-w-0">{legendBlock}</div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center min-w-0 ${className || ''}`}>
      {chartSvg}
      <div className="mt-4 w-full">{legendBlock}</div>
    </div>
  )
}

// ──────────────────────────── SPARKLINE ──────────────────────────────
// Mini line para fondo de KPI cards. Sin padding, escala simple.
export function Sparkline({ values = [], width = 110, height = 32, color = '#0A84FF' }) {
  if (values.length === 0) return null
  const maxY = Math.max(1, ...values)
  const stepX = values.length > 1 ? width / (values.length - 1) : 0
  const points = values.map((v, i) => {
    const x = i * stepX
    const y = height - (v / maxY) * height
    return [x, y]
  })
  const id = `sp-${color.replace('#', '')}`
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')
  const fillPath = `${linePath} L ${points[points.length - 1][0]} ${height} L 0 ${height} Z`

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={fillPath}
        fill={`url(#${id})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  )
}

// ──────────────────────────── HEATMAP ────────────────────────────────
export function ActivityHeatmap({ cells = [], cols = 12, color = '#0A84FF', className }) {
  const max = Math.max(1, ...cells)
  const cellSize = 12
  const gap = 3
  const rows = 7
  const width = cols * (cellSize + gap)
  const height = rows * (cellSize + gap)

  const opacity = (v) => (v === 0 ? 0.08 : 0.22 + (v / max) * 0.75)

  return (
    <div className={`overflow-x-auto ${className || ''}`} style={{ maxWidth: '100%' }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {cells.slice(0, cols * rows).map((v, i) => {
          const c = Math.floor(i / rows)
          const r = i % rows
          return (
            <motion.rect
              key={i}
              x={c * (cellSize + gap)}
              y={r * (cellSize + gap)}
              width={cellSize}
              height={cellSize}
              rx="3"
              fill={color}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: opacity(v), scale: 1 }}
              transition={{ duration: 0.4, delay: i * 0.004, ease: 'easeOut' }}
            >
              <title>{`${v} actividades`}</title>
            </motion.rect>
          )
        })}
      </svg>
    </div>
  )
}

// ──────────────────────────── EMPTY STATE ────────────────────────────
function EmptyChart({ height = 200 }) {
  return (
    <div
      className="w-full flex items-center justify-center rounded-lg"
      style={{ height, background: 'rgba(10,36,67,0.03)', border: '1px dashed rgba(10,36,67,0.10)' }}
    >
      <span className="text-xs text-[color:var(--text-secondary)]">Sin datos</span>
    </div>
  )
}

// ──────────────────────────── TOOLTIP ────────────────────────────────
function Tooltip({ x, y, chartW, chartH, label, value, color, yLabel }) {
  // Posicionamiento relativo al SVG (que es responsive). Convertimos
  // las coords del viewBox a porcentaje del contenedor.
  const left = `${(x / chartW) * 100}%`
  const top = Math.max(8, y - 48)
  return (
    <div
      className="absolute pointer-events-none px-2.5 py-1.5 rounded-lg text-[11px] font-mono whitespace-nowrap"
      style={{
        left,
        top,
        transform: 'translate(-50%, 0)',
        background: 'rgba(255,255,255,0.96)',
        border: `1px solid ${color}55`,
        boxShadow: '0 8px 22px rgba(10,36,67,0.18)',
        backdropFilter: 'blur(8px)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="text-[9px] text-[color:var(--text-secondary)] uppercase tracking-wider">{label}</div>
      <div className="font-semibold tabular-nums" style={{ color }}>
        {value}{yLabel ? ` ${yLabel}` : ''}
      </div>
    </div>
  )
}
