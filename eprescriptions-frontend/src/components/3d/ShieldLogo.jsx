import { useState } from 'react'
import { motion } from 'framer-motion'

export default function ShieldLogo({ size = 44 }) {
  const [hover, setHover] = useState(false)
  return (
    <motion.div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      animate={{
        rotateY: hover ? 16 : 0,
        rotateX: hover ? -10 : 0,
        scale: hover ? 1.05 : 1,
      }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      style={{
        width: size,
        height: size,
        transformStyle: 'preserve-3d',
        transformPerspective: 500,
      }}
      className="shrink-0 cursor-pointer"
    >
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none"
        style={{ filter: 'drop-shadow(0 4px 12px rgba(10,132,255,0.35))' }}>
        <defs>
          <linearGradient id="shBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E6F0FB" />
          </linearGradient>
          <linearGradient id="shStroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#0A84FF" />
            <stop offset="100%" stopColor="#0052CC" />
          </linearGradient>
          <linearGradient id="shCross" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#0A84FF" />
            <stop offset="100%" stopColor="#0052CC" />
          </linearGradient>
          <radialGradient id="shShine" cx="0.35" cy="0.2" r="0.7">
            <stop offset="0%"  stopColor="rgba(255,255,255,0.65)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        <path
          d="M24 3.5 L41 9 V24 C41 33.5 33.5 41 24 44.5 C14.5 41 7 33.5 7 24 V9 Z"
          fill="url(#shBody)"
          stroke="url(#shStroke)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M24 3.5 L41 9 V24 C41 33.5 33.5 41 24 44.5 C14.5 41 7 33.5 7 24 V9 Z"
          fill="url(#shShine)"
        />

        <g>
          <rect x="21.25" y="14" width="5.5" height="18" rx="1.4" fill="url(#shCross)" />
          <rect x="15" y="20.25" width="18" height="5.5" rx="1.4" fill="url(#shCross)" />
          <rect x="22.1" y="14.8" width="1.2" height="16.4" rx="0.6" fill="rgba(255,255,255,0.45)" />
        </g>

        <path
          d="M24 7 L37.5 11.3 V24 C37.5 31.6 31.5 37.7 24 40.5 C16.5 37.7 10.5 31.6 10.5 24 V11.3 Z"
          fill="none"
          stroke="rgba(10,132,255,0.18)"
          strokeWidth="0.8"
        />
      </svg>
    </motion.div>
  )
}
