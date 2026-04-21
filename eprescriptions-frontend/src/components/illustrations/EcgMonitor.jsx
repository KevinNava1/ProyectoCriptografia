import { motion } from 'framer-motion'

export default function EcgMonitor({ className = '' }) {
  return (
    <div className={`relative w-full h-full ${className}`} aria-hidden>
      <svg viewBox="0 0 420 300" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
        <defs>
          <linearGradient id="ecg-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E8F1FC" />
          </linearGradient>
          <linearGradient id="ecg-screen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F2F8FF" />
            <stop offset="100%" stopColor="#CDE2FA" />
          </linearGradient>
          <linearGradient id="ecg-stand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#BCD1EA" />
            <stop offset="100%" stopColor="#90AACB" />
          </linearGradient>
          <radialGradient id="ecg-shine" cx="0.25" cy="0.2" r="0.7">
            <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* floor shadow */}
        <ellipse cx="210" cy="282" rx="120" ry="6" fill="rgba(10,36,67,0.1)" />

        {/* monitor body */}
        <g>
          <rect x="60" y="40" width="300" height="190" rx="18" fill="url(#ecg-body)" stroke="#BBD6F2" strokeWidth="1.4" />
          <rect x="60" y="40" width="300" height="190" rx="18" fill="url(#ecg-shine)" />
          {/* screen */}
          <rect x="80" y="60" width="260" height="140" rx="10" fill="url(#ecg-screen)" stroke="#9FC1E8" strokeWidth="1" />
          {/* grid */}
          <g stroke="rgba(10,132,255,0.12)" strokeWidth="0.8">
            {Array.from({ length: 11 }).map((_, i) => (
              <line key={`v${i}`} x1={80 + i * 26} y1="60" x2={80 + i * 26} y2="200" />
            ))}
            {Array.from({ length: 7 }).map((_, i) => (
              <line key={`h${i}`} x1="80" y1={60 + i * 23} x2="340" y2={60 + i * 23} />
            ))}
          </g>
          {/* ECG path */}
          <path
            d="M80 130 L140 130 L152 130 L160 110 L170 150 L180 130 L220 130 L232 125 L244 135 L256 130 L290 130 L300 100 L312 160 L322 130 L340 130"
            stroke="#0A84FF" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"
            className="ecg-line"
          />
          {/* traveling dot */}
          <motion.circle
            r="4" fill="#0052CC"
            initial={{ cx: 80, cy: 130 }}
            animate={{ cx: [80, 340], cy: [130, 130] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
          />
          {/* readings */}
          <g fontFamily="JetBrains Mono, monospace" fill="#0A84FF" fontSize="10">
            <text x="90"  y="80">HR  72 bpm</text>
            <text x="280" y="80">SpO₂ 98%</text>
            <text x="90"  y="195">SHA-256 · OK</text>
            <text x="240" y="195">ECDSA P-256 · ✓</text>
          </g>
          {/* buttons */}
          <g fill="#BBD6F2">
            <rect x="80"  y="212" width="52" height="10" rx="4" />
            <rect x="140" y="212" width="52" height="10" rx="4" />
            <rect x="200" y="212" width="52" height="10" rx="4" />
            <rect x="260" y="212" width="52" height="10" rx="4" />
          </g>
          <circle cx="336" cy="217" r="4" fill="#00A870" className="ecg-led">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* stand */}
        <rect x="200" y="230" width="20" height="28" rx="3" fill="url(#ecg-stand)" />
        <rect x="170" y="258" width="80" height="10" rx="4" fill="url(#ecg-stand)" />

        {/* floating heart */}
        <motion.g
          initial={{ y: 0 }}
          animate={{ y: [-4, 4, -4] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          transform="translate(370 60)"
        >
          <circle r="16" fill="#FFFFFF" stroke="#BBD6F2" strokeWidth="1" />
          <path
            d="M0 6 L-7 0 C -11 -4, -5 -10, 0 -5 C 5 -10, 11 -4, 7 0 Z"
            fill="#0A84FF"
          />
        </motion.g>
      </svg>
    </div>
  )
}
