import { motion } from 'framer-motion'

const BASE = {
  blue: '#0A84FF',
  deep: '#0052CC',
  teal: '#00B8D9',
  light: '#DCEBFF',
  white: '#FFFFFF',
}

function Gradients() {
  return (
    <defs>
      <linearGradient id="rl-skin" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stopColor="#FFE2CF" />
        <stop offset="100%" stopColor="#F5C9A9" />
      </linearGradient>
      <linearGradient id="rl-coat" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#E6F0FB" />
      </linearGradient>
      <linearGradient id="rl-blue" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"  stopColor="#0A84FF" />
        <stop offset="100%" stopColor="#0052CC" />
      </linearGradient>
      <linearGradient id="rl-teal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"  stopColor="#00B8D9" />
        <stop offset="100%" stopColor="#0A84FF" />
      </linearGradient>
      <radialGradient id="rl-shine" cx="0.3" cy="0.2" r="0.8">
        <stop offset="0%"  stopColor="rgba(255,255,255,0.5)" />
        <stop offset="60%" stopColor="rgba(255,255,255,0)" />
      </radialGradient>
    </defs>
  )
}

function IconShell({ size, active, children, ariaLabel }) {
  return (
    <motion.div
      role="img"
      aria-label={ariaLabel}
      initial={false}
      animate={{
        scale: active ? 1.04 : 1,
        filter: active
          ? 'drop-shadow(0 6px 18px rgba(10,132,255,0.35))'
          : 'drop-shadow(0 3px 10px rgba(10,36,67,0.1))',
      }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 96 96" width={size} height={size} fill="none">
        <Gradients />
        {/* Soft rounded backdrop */}
        <rect x="2" y="2" width="92" height="92" rx="22"
          fill={BASE.white} stroke="rgba(10,132,255,0.18)" strokeWidth="1.2" />
        <rect x="2" y="2" width="92" height="92" rx="22" fill="url(#rl-shine)" opacity="0.8" />
        {/* floor shadow */}
        <ellipse cx="48" cy="82" rx="22" ry="2.4" fill="rgba(10,36,67,0.1)" />
        {children}
      </svg>
    </motion.div>
  )
}

/* ── DOCTOR ──────────────────────────────────── */
export function DoctorLogo({ size = 72, active = false }) {
  return (
    <IconShell size={size} active={active} ariaLabel="Médico">
      {/* body / coat */}
      <path
        d="M26 78 C26 64, 36 58, 48 58 C60 58, 70 64, 70 78 Z"
        fill="url(#rl-coat)" stroke="#BBD6F2" strokeWidth="1.1"
      />
      {/* lapels */}
      <path d="M42 60 L48 72 L54 60" fill="#FFFFFF" stroke="#BBD6F2" strokeWidth="1.1" strokeLinejoin="round" />
      {/* neck */}
      <rect x="44" y="52" width="8" height="10" rx="2" fill="url(#rl-skin)" />
      {/* head */}
      <circle cx="48" cy="42" r="13" fill="url(#rl-skin)" />
      {/* hair */}
      <path d="M35 40 C36 32, 42 28, 48 28 C56 28, 62 33, 62 40 C60 35, 54 34, 48 35 C41 35, 37 36, 35 40 Z" fill="#1E293B" />
      {/* glasses */}
      <circle cx="43" cy="43" r="3" stroke={BASE.blue} strokeWidth="1.3" fill="none" />
      <circle cx="53" cy="43" r="3" stroke={BASE.blue} strokeWidth="1.3" fill="none" />
      <path d="M46 43 L50 43" stroke={BASE.blue} strokeWidth="1.1" />
      {/* mouth */}
      <path d="M45 48 Q48 50 51 48" stroke="#1E293B" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* stethoscope */}
      <motion.g
        initial={{ rotate: 0 }}
        animate={{ rotate: active ? [0, -3, 3, 0] : 0 }}
        transition={{ duration: 1.6, repeat: active ? Infinity : 0 }}
        style={{ transformOrigin: '48px 64px' }}
      >
        <path d="M40 60 C38 68, 38 72, 44 74" stroke={BASE.blue} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M56 60 C58 68, 58 72, 52 74" stroke={BASE.blue} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <circle cx="48" cy="76" r="3.2" fill="url(#rl-blue)" stroke="#0052CC" strokeWidth="0.7" />
        <circle cx="48" cy="76" r="1.1" fill="#FFFFFF" opacity="0.85" />
      </motion.g>
      {/* badge */}
      <g>
        <rect x="56" y="66" width="9" height="6" rx="1.2" fill="url(#rl-blue)" />
        <rect x="57.5" y="67.5" width="6" height="1" fill="#FFFFFF" opacity="0.8" />
        <rect x="57.5" y="69.2" width="4" height="1" fill="#FFFFFF" opacity="0.6" />
      </g>
    </IconShell>
  )
}

/* ── PATIENT ─────────────────────────────────── */
export function PatientLogo({ size = 72, active = false }) {
  return (
    <IconShell size={size} active={active} ariaLabel="Paciente">
      {/* shirt */}
      <path
        d="M26 78 C26 64, 36 58, 48 58 C60 58, 70 64, 70 78 Z"
        fill="#EAF4FF" stroke="#BBD6F2" strokeWidth="1.1"
      />
      {/* neck */}
      <rect x="44" y="52" width="8" height="10" rx="2" fill="url(#rl-skin)" />
      {/* head */}
      <circle cx="48" cy="42" r="13" fill="url(#rl-skin)" />
      {/* hair */}
      <path d="M36 40 C36 31, 44 26, 50 27 C58 27, 62 33, 61 40 C58 36, 52 35, 47 36 C41 36, 38 37, 36 40 Z" fill="#8B5E3C" />
      {/* eyes */}
      <circle cx="43.5" cy="43" r="1.1" fill="#1E293B" />
      <circle cx="52.5" cy="43" r="1.1" fill="#1E293B" />
      {/* smile */}
      <path d="M44 48 Q48 51 52 48" stroke="#1E293B" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* heart badge on chest, pulses when active */}
      <motion.g
        initial={{ scale: 1 }}
        animate={{ scale: active ? [1, 1.2, 1] : 1 }}
        transition={{ duration: 0.9, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
        style={{ transformOrigin: '48px 68px' }}
      >
        <circle cx="48" cy="68" r="7.5" fill="url(#rl-blue)" />
        <path
          d="M48 71.5 L44.8 68.3 C43.6 67.1 44.5 65.2 46.1 65.2 C47 65.2 47.6 65.7 48 66.3 C48.4 65.7 49 65.2 49.9 65.2 C51.5 65.2 52.4 67.1 51.2 68.3 Z"
          fill="#FFFFFF"
        />
      </motion.g>
    </IconShell>
  )
}

/* ── PHARMACIST ─────────────────────────────── */
export function PharmacistLogo({ size = 72, active = false }) {
  return (
    <IconShell size={size} active={active} ariaLabel="Farmacéutico">
      {/* coat */}
      <path
        d="M26 78 C26 64, 36 58, 48 58 C60 58, 70 64, 70 78 Z"
        fill="url(#rl-coat)" stroke="#BBD6F2" strokeWidth="1.1"
      />
      {/* green cross patch */}
      <g transform="translate(56 62)">
        <rect x="-4" y="-4" width="8" height="8" rx="1.6" fill="#00A870" />
        <rect x="-1.2" y="-2.6" width="2.4" height="5.2" fill="#FFFFFF" />
        <rect x="-2.6" y="-1.2" width="5.2" height="2.4" fill="#FFFFFF" />
      </g>
      {/* neck */}
      <rect x="44" y="52" width="8" height="10" rx="2" fill="url(#rl-skin)" />
      {/* head */}
      <circle cx="48" cy="42" r="13" fill="url(#rl-skin)" />
      {/* pharmacist cap with cross */}
      <path d="M35 33 L61 33 L59 39 L37 39 Z" fill={BASE.white} stroke="#BBD6F2" strokeWidth="1" />
      <rect x="46.5" y="34.5" width="3" height="3" fill="#00A870" />
      <rect x="45.25" y="35.75" width="5.5" height="0.6" fill="#FFFFFF" />
      <rect x="47.7" y="34.6" width="0.6" height="2.8" fill="#FFFFFF" />
      {/* eyes + mask */}
      <rect x="38" y="46" width="20" height="6" rx="3" fill="#E4F0FB" stroke="#BBD6F2" strokeWidth="0.8" />
      <circle cx="43.5" cy="43" r="1.1" fill="#1E293B" />
      <circle cx="52.5" cy="43" r="1.1" fill="#1E293B" />
      {/* capsule held, rotates when active */}
      <motion.g
        initial={{ rotate: -20 }}
        animate={{ rotate: active ? [-20, 20, -20] : -20 }}
        transition={{ duration: 2.2, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
        style={{ transformOrigin: '36px 66px' }}
      >
        <rect x="28" y="63" width="16" height="6" rx="3" fill="url(#rl-blue)" />
        <rect x="28" y="63" width="8" height="6" rx="3" fill="url(#rl-teal)" />
        <rect x="28" y="63" width="16" height="2" rx="1" fill="rgba(255,255,255,0.4)" />
      </motion.g>
    </IconShell>
  )
}

export default { DoctorLogo, PatientLogo, PharmacistLogo }
