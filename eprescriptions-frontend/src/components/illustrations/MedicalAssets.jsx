// Colección de ilustraciones SVG médicas hechas a mano. Cero dependencias
// externas, peso bajo, totalmente libres de problemas de licencia.
// Todas reciben `size`, `color` y `className` y heredan currentColor donde
// tiene sentido.

import { motion } from 'framer-motion'

// ─── Caduceo / Rx logogram para watermark ──────────────────────────
export function RxMonogram({ size = 200, color = '#0A84FF', className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="rx-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"  stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0052CC" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <text
        x="50%"
        y="58%"
        textAnchor="middle"
        fontFamily="Playfair Display, Syne, serif"
        fontSize="140"
        fontWeight="900"
        fontStyle="italic"
        fill="url(#rx-grad)"
        style={{ letterSpacing: '-0.08em' }}
      >
        Rx
      </text>
      <line x1="118" y1="148" x2="118" y2="178" stroke={color} strokeWidth="6" strokeLinecap="round" />
      <line x1="106" y1="160" x2="130" y2="160" stroke={color} strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

// ─── Cápsula partida en dos colores ────────────────────────────────
export function CapsulePill({ size = 120, primary = '#0A84FF', secondary = '#00B8D9', className, animate = false }) {
  const Comp = animate ? motion.svg : 'svg'
  const motionProps = animate
    ? { animate: { y: [0, -8, 0], rotate: [-8, -4, -8] }, transition: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' } }
    : {}

  return (
    <Comp
      width={size}
      height={size * 0.55}
      viewBox="0 0 200 110"
      fill="none"
      className={className}
      aria-hidden
      {...motionProps}
    >
      <defs>
        <linearGradient id="pill-left" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={primary} stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0052CC" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="pill-right" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={secondary} stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0080A1" stopOpacity="0.85" />
        </linearGradient>
        <filter id="pill-shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0A84FF" floodOpacity="0.35" />
        </filter>
      </defs>
      <g transform="rotate(-8 100 55)" filter="url(#pill-shadow)">
        <rect x="10" y="20" width="92" height="70" rx="35" fill="url(#pill-left)" />
        <rect x="98" y="20" width="92" height="70" rx="35" fill="url(#pill-right)" />
        {/* Brillo superior */}
        <ellipse cx="60" cy="38" rx="32" ry="6" fill="rgba(255,255,255,0.45)" />
        <ellipse cx="148" cy="38" rx="32" ry="6" fill="rgba(255,255,255,0.40)" />
        {/* Línea de separación */}
        <line x1="100" y1="22" x2="100" y2="88" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
      </g>
    </Comp>
  )
}

// ─── Sello de doctor con texto curvo ──────────────────────────────
export function DoctorSeal({ size = 140, color = '#B42318', text = 'CERTIFICADO · SECURERX', initials = 'AP', stamped = false, className }) {
  const r = 60
  const cx = 70
  const cy = 70
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      fill="none"
      className={`${className || ''} ${stamped ? 'stamp-impress' : ''}`}
      aria-hidden
    >
      <defs>
        <path
          id="seal-arc"
          d={`M ${cx},${cy} m -${r - 12},0 a ${r - 12},${r - 12} 0 1,1 ${(r - 12) * 2},0 a ${r - 12},${r - 12} 0 1,1 -${(r - 12) * 2},0`}
          fill="none"
        />
      </defs>
      {/* Anillo externo */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="3" opacity="0.85" />
      {/* Anillo interno */}
      <circle cx={cx} cy={cy} r={r - 14} fill="none" stroke={color} strokeWidth="1.5" opacity="0.55" />
      {/* Texto curvo */}
      <text fontFamily="JetBrains Mono, monospace" fontSize="7" fontWeight="700" fill={color} letterSpacing="2">
        <textPath href="#seal-arc" startOffset="0%">
          {text} · {text}
        </textPath>
      </text>
      {/* Caduceo simple en el centro */}
      <g transform={`translate(${cx - 10},${cy - 18})`} stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none">
        <line x1="10" y1="0" x2="10" y2="32" />
        <path d="M 10 6 q 8 4 0 10 q -8 6 0 12" />
        <path d="M 10 6 q -8 4 0 10 q 8 6 0 12" />
        <path d="M 2 0 q 8 -4 16 0" />
        <circle cx="10" cy="-1.5" r="1.8" fill={color} />
      </g>
      {/* Iniciales debajo del caduceo */}
      <text
        x={cx}
        y={cy + 28}
        textAnchor="middle"
        fontFamily="Playfair Display, serif"
        fontSize="14"
        fontWeight="700"
        fill={color}
      >
        {initials}
      </text>
    </svg>
  )
}

// ─── Estetoscopio decorativo ───────────────────────────────────────
export function StethoscopeArc({ size = 200, color = '#0A84FF', className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="steth-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00B8D9" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path
        d="M 50 40 Q 50 130, 100 130 Q 150 130, 150 40"
        stroke="url(#steth-grad)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="50" cy="40" r="6" fill={color} opacity="0.85" />
      <circle cx="150" cy="40" r="6" fill={color} opacity="0.85" />
      <line x1="100" y1="130" x2="100" y2="160" stroke="url(#steth-grad)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="170" r="14" fill={color} opacity="0.18" />
      <circle cx="100" cy="170" r="9" fill={color} opacity="0.65" />
      <circle cx="100" cy="170" r="4" fill="white" opacity="0.7" />
    </svg>
  )
}

// ─── Cruz médica + halo ────────────────────────────────────────────
export function MedicalCross({ size = 48, color = '#00A870', className, pulse = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      {pulse && (
        <circle cx="24" cy="24" r="22" fill={color} opacity="0.10">
          <animate attributeName="r" values="18;22;18" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.18;0.05;0.18" dur="2.4s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx="24" cy="24" r="18" fill={color} opacity="0.12" />
      <path
        d="M19 10 H29 V19 H38 V29 H29 V38 H19 V29 H10 V19 H19 Z"
        fill={color}
      />
    </svg>
  )
}

// ─── Línea ECG continua decorativa ─────────────────────────────────
export function EcgRibbon({ width = 600, height = 80, color = '#00A870', className }) {
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="ecg-fade" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="20%" stopColor={color} stopOpacity="0.7" />
          <stop offset="80%" stopColor={color} stopOpacity="0.7" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M 0 ${height / 2} L ${width * 0.2} ${height / 2} L ${width * 0.24} ${height * 0.3}
            L ${width * 0.28} ${height * 0.85} L ${width * 0.32} ${height * 0.1}
            L ${width * 0.36} ${height * 0.9} L ${width * 0.40} ${height / 2}
            L ${width * 0.55} ${height / 2} L ${width * 0.59} ${height * 0.25}
            L ${width * 0.63} ${height * 0.78} L ${width * 0.67} ${height / 2}
            L ${width} ${height / 2}`}
        stroke="url(#ecg-fade)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="heart-trace"
      />
    </svg>
  )
}

// ─── Pattern de cruces sutil ───────────────────────────────────────
export function CrossPattern({ color = 'rgba(10,132,255,0.08)', className }) {
  return (
    <svg
      width="100%"
      height="100%"
      className={className}
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <pattern id="cross-pat" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 22 14 H 26 V 22 H 34 V 26 H 26 V 34 H 22 V 26 H 14 V 22 H 22 Z" fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#cross-pat)" />
    </svg>
  )
}

// ─── Monograma del doctor (iniciales con marco editorial) ──────────
export function DoctorMonogram({ initials = 'DR', size = 56, color = '#0A84FF', className }) {
  const safe = (initials || '??').slice(0, 2).toUpperCase()
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className || ''}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 56 56"
        className="absolute inset-0"
        aria-hidden
      >
        <defs>
          <linearGradient id="mono-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#0052CC" />
          </linearGradient>
        </defs>
        <circle cx="28" cy="28" r="26" fill="none" stroke="url(#mono-ring)" strokeWidth="1.5" />
        <circle cx="28" cy="28" r="22" fill="rgba(255,255,255,0.55)" />
      </svg>
      <span
        className="font-editorial"
        style={{
          fontWeight: 800,
          fontSize: size * 0.42,
          color: '#0052CC',
          letterSpacing: '-0.04em',
          position: 'relative',
        }}
      >
        {safe}
      </span>
    </div>
  )
}

// ─── Línea decorativa de gradiente (acento del header) ─────────────
export function GradientRule({ className = '' }) {
  return (
    <div
      className={`h-[3px] w-full ${className}`}
      style={{
        background: 'linear-gradient(90deg, #0A84FF 0%, #00B8D9 50%, #0052CC 100%)',
        borderRadius: 3,
        boxShadow: '0 1px 8px rgba(10,132,255,0.45)',
      }}
    />
  )
}
