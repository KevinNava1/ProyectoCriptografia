import { motion } from 'framer-motion'

/**
 * Large animated SVG scene used on Login/Registro.
 * Blue + white medical aesthetic. Fully original SVG (no external assets).
 *
 * variant:
 *   'stethoscope' — hero: floating medical badge + orbiting tools (login)
 *   'capsules'    — orbit of capsules/pills around a central ring (registro)
 */
export default function MedicalScene({ variant = 'stethoscope', className = '' }) {
  if (variant === 'capsules') return <Capsules className={className} />
  return <Stethoscope className={className} />
}

function SceneDefs() {
  return (
    <defs>
      <linearGradient id="ms-blue" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"  stopColor="#0A84FF" />
        <stop offset="100%" stopColor="#0052CC" />
      </linearGradient>
      <linearGradient id="ms-teal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"  stopColor="#00B8D9" />
        <stop offset="100%" stopColor="#0A84FF" />
      </linearGradient>
      <linearGradient id="ms-panel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#E6F0FB" />
      </linearGradient>
      <radialGradient id="ms-glow" cx="0.5" cy="0.5" r="0.6">
        <stop offset="0%"  stopColor="rgba(10,132,255,0.35)" />
        <stop offset="100%" stopColor="rgba(10,132,255,0)" />
      </radialGradient>
      <radialGradient id="ms-shine" cx="0.3" cy="0.2" r="0.7">
        <stop offset="0%"  stopColor="rgba(255,255,255,0.6)" />
        <stop offset="60%" stopColor="rgba(255,255,255,0)" />
      </radialGradient>
      <filter id="ms-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
    </defs>
  )
}

function Stethoscope({ className }) {
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`} aria-hidden>
      <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
        <SceneDefs />
        {/* ambient glow */}
        <circle cx="300" cy="300" r="260" fill="url(#ms-glow)" />

        {/* orbit rings */}
        <g stroke="rgba(10,132,255,0.20)" fill="none">
          <circle cx="300" cy="300" r="190" strokeWidth="1.2" strokeDasharray="4 8" className="spin-slow" />
          <circle cx="300" cy="300" r="250" strokeWidth="1"   strokeDasharray="2 10" className="spin-mid"  />
          <circle cx="300" cy="300" r="120" strokeWidth="0.8" strokeDasharray="3 6"  className="spin-slow" />
        </g>

        {/* Sin chips SVG — las píldoras 3D orbitando se renderizan aparte en el Login */}

        {/* floating sparkles (se expanden por el fondo) */}
        <g className="float-mid">
          <circle cx="90"  cy="130" r="4" fill="#0A84FF" />
          <circle cx="500" cy="150" r="3" fill="#00B8D9" />
          <circle cx="540" cy="420" r="4" fill="#0052CC" />
          <circle cx="60"  cy="400" r="3" fill="#0A84FF" />
          <circle cx="150" cy="500" r="2.5" fill="#00B8D9" />
          <circle cx="450" cy="520" r="3" fill="#0A84FF" />
        </g>
      </svg>
    </div>
  )
}

function Capsules({ className }) {
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`} aria-hidden>
      <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
        <SceneDefs />
        <circle cx="300" cy="300" r="240" fill="url(#ms-glow)" />

        {/* double orbit */}
        <g stroke="rgba(10,132,255,0.22)" fill="none">
          <ellipse cx="300" cy="300" rx="200" ry="92" strokeWidth="1.4" strokeDasharray="4 8" className="spin-slow" />
          <ellipse cx="300" cy="300" rx="160" ry="160" strokeWidth="1" strokeDasharray="2 10" className="spin-mid" />
        </g>

        {/* central ring / DNA symbol */}
        <g className="float-slow" transform="translate(300 300)">
          <circle r="72" fill="url(#ms-panel)" stroke="#BBD6F2" strokeWidth="1.5" />
          <circle r="72" fill="url(#ms-shine)" />
          {/* mini DNA */}
          <g stroke="url(#ms-blue)" strokeWidth="3" fill="none" strokeLinecap="round">
            <path d="M-36 -40 C -10 -20, 10 -20, 36 -40" />
            <path d="M-36 -10 C -10  10, 10  10, 36 -10" />
            <path d="M-36  20 C -10  40, 10  40, 36  20" />
          </g>
          <g fill="#00B8D9">
            <circle cx="-36" cy="-40" r="3.5" />
            <circle cx=" 36" cy="-10" r="3.5" />
            <circle cx="-36" cy=" 20" r="3.5" />
          </g>
          <g fill="#0A84FF">
            <circle cx=" 36" cy="-40" r="3.5" />
            <circle cx="-36" cy="-10" r="3.5" />
            <circle cx=" 36" cy=" 20" r="3.5" />
          </g>
        </g>

        {/* Las cápsulas planas SVG se retiran — las Pill3D reales se montan aparte */}

        <g className="float-fast">
          <circle cx="90" cy="200" r="5" fill="#0A84FF" opacity="0.7"/>
          <circle cx="510" cy="420" r="4" fill="#00B8D9" opacity="0.7"/>
          <circle cx="460" cy="130" r="3" fill="#0052CC" opacity="0.6"/>
        </g>
      </svg>
    </div>
  )
}

/* ── Sub-ornaments ──────────────────────────── */
function StethoscopeBadge() {
  return (
    <g>
      <circle r="24" fill="#FFFFFF" stroke="#BBD6F2" strokeWidth="1.2" />
      <g stroke="#0A84FF" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M-10 -4 C -12 6, -6 10, -2 8" />
        <path d="M10 -4 C 12 6, 6 10, 2 8" />
      </g>
      <circle cy="10" r="4.5" fill="#0A84FF" />
      <circle cy="10" r="1.4" fill="#FFFFFF" />
    </g>
  )
}
function HeartBadge() {
  return (
    <g>
      <circle r="24" fill="#FFFFFF" stroke="#BBD6F2" strokeWidth="1.2" />
      <path
        d="M0 8 L-8 0 C -13 -5, -6 -12, 0 -6 C 6 -12, 13 -5, 8 0 Z"
        fill="#0A84FF"
      />
    </g>
  )
}
function CapsuleBadge() {
  return (
    <g>
      <circle r="24" fill="#FFFFFF" stroke="#BBD6F2" strokeWidth="1.2" />
      <g transform="rotate(-28)">
        <rect x="-14" y="-5" width="28" height="10" rx="5" fill="#0A84FF" />
        <rect x="-14" y="-5" width="14" height="10" rx="5" fill="#00B8D9" />
        <rect x="-14" y="-5" width="28" height="3"  rx="1" fill="rgba(255,255,255,0.5)" />
      </g>
    </g>
  )
}
function PillSmall({ color = '#0A84FF' }) {
  return (
    <g>
      <rect x="-14" y="-5" width="28" height="10" rx="5" fill={color} />
      <rect x="-14" y="-5" width="14" height="10" rx="5" fill="#00B8D9" opacity="0.9" />
      <rect x="-14" y="-5" width="28" height="3"  rx="1" fill="rgba(255,255,255,0.5)" />
    </g>
  )
}

/* ── Orbit primitives (Framer Motion on SVG <g>) ── */
function OrbitChip({ cx, cy, r, speed = 20, offset = 0, children }) {
  return (
    <motion.g
      initial={false}
      animate={{ rotate: 360 }}
      transition={{ duration: speed, repeat: Infinity, ease: 'linear', delay: -offset * speed }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      <g transform={`translate(${cx + r} ${cy})`}>
        {/* counter-rotate children so they stay upright */}
        <motion.g
          initial={false}
          animate={{ rotate: -360 }}
          transition={{ duration: speed, repeat: Infinity, ease: 'linear', delay: -offset * speed }}
        >
          {children}
        </motion.g>
      </g>
    </motion.g>
  )
}

function OrbitOnEllipse({ cx, cy, rx, ry, speed = 20, offset = 0, children }) {
  return (
    <motion.g
      initial={false}
      animate={{ rotate: 360 }}
      transition={{ duration: speed, repeat: Infinity, ease: 'linear', delay: -offset * speed }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      <g transform={`translate(${cx + rx} ${cy})`}>
        <motion.g
          initial={false}
          animate={{ rotate: -360 }}
          transition={{ duration: speed, repeat: Infinity, ease: 'linear', delay: -offset * speed }}
        >
          {children}
        </motion.g>
      </g>
    </motion.g>
  )
}
