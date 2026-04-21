import { motion } from 'framer-motion'

/**
 * Compact 3D-feel ECG pulse line. Narrow by design so it doesn't collide
 * with other page content. Used at the bottom of Login.
 */
export default function HeartbeatLine({ width = 360, height = 64, className = '' }) {
  return (
    <div
      className={`relative pointer-events-none select-none ${className}`}
      style={{ width, height }}
      aria-hidden
    >
      {/* Glow pad */}
      <div
        className="absolute inset-0 rounded-full blur-xl"
        style={{
          background:
            'radial-gradient(ellipse at 50% 60%, rgba(10,132,255,0.22), rgba(0,184,217,0.10) 50%, transparent 75%)',
        }}
      />
      <svg
        viewBox="0 0 360 64"
        width={width}
        height={height}
        className="relative z-10"
      >
        <defs>
          <linearGradient id="hbl-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#0A84FF" stopOpacity="0" />
            <stop offset="12%" stopColor="#0A84FF" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#00B8D9" stopOpacity="1" />
            <stop offset="88%" stopColor="#0052CC" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0052CC" stopOpacity="0" />
          </linearGradient>
          <filter id="hbl-glow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>

        {/* baseline */}
        <line
          x1="0" y1="32" x2="360" y2="32"
          stroke="rgba(10,132,255,0.16)" strokeWidth="1" strokeDasharray="2 6"
        />

        {/* blurred glow path */}
        <path
          d="M0 32 L60 32 L80 32 L95 10 L110 54 L125 32 L170 32 L185 24 L200 40 L215 32 L260 32 L275 6 L290 58 L305 32 L360 32"
          fill="none" stroke="url(#hbl-stroke)" strokeWidth="5"
          strokeLinecap="round" strokeLinejoin="round"
          opacity="0.45" filter="url(#hbl-glow)"
        />
        {/* sharp path */}
        <path
          className="ecg-line"
          d="M0 32 L60 32 L80 32 L95 10 L110 54 L125 32 L170 32 L185 24 L200 40 L215 32 L260 32 L275 6 L290 58 L305 32 L360 32"
          fill="none" stroke="url(#hbl-stroke)" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round"
        />

        {/* Traveling dot */}
        <motion.g
          initial={{ x: 0 }}
          animate={{ x: 360 }}
          transition={{ duration: 3.6, ease: 'linear', repeat: Infinity }}
        >
          <circle cx="0" cy="32" r="3.2" fill="#FFFFFF" stroke="#0A84FF" strokeWidth="1.6" />
          <circle cx="0" cy="32" r="7" fill="rgba(10,132,255,0.22)" />
        </motion.g>
      </svg>
    </div>
  )
}
