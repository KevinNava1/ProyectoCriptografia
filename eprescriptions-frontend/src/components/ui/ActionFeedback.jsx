import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Confirmaciones tipo Lottie pero SVG nativo (draw + bounce + glow).
// Modos:
//   'success' → checkmark verde, halo emerald
//   'error'   → X roja, halo red
//
// Uso: <ActionFeedback open={state==='ok'} mode="success" onDone={...} />
// Se autocierra a los `duration` ms (1200 por defecto) llamando a onDone.

const COLORS = {
  success: {
    main: '#00A870', halo: 'rgba(0,168,112,0.32)', label: 'Operación exitosa',
  },
  error: {
    main: '#B42318', halo: 'rgba(180,35,24,0.32)', label: 'Operación fallida',
  },
}

export default function ActionFeedback({
  open,
  mode = 'success',
  duration = 1200,
  onDone,
  label,
  fullscreen = false,
}) {
  const meta = COLORS[mode] || COLORS.success

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => onDone?.(), duration)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, duration])

  const inner = (
    <motion.div
      key={`feedback-${mode}`}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 240, damping: 18 }}
      className="flex flex-col items-center"
    >
      <div className="relative">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${meta.halo}, transparent 65%)`,
            filter: 'blur(22px)',
            transform: 'scale(1.6)',
          }}
          animate={{ opacity: [0.6, 1, 0.7] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <svg width="88" height="88" viewBox="0 0 88 88" aria-label={label || meta.label}>
          <motion.circle
            cx="44" cy="44" r="38"
            fill="none"
            stroke={meta.main}
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0.4 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 6px ${meta.halo})` }}
          />
          {mode === 'success' ? (
            <motion.path
              d="M28 46 L40 58 L62 34"
              fill="none"
              stroke={meta.main}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, delay: 0.30, ease: 'easeOut' }}
            />
          ) : (
            <>
              <motion.path
                d="M30 30 L58 58"
                fill="none"
                stroke={meta.main}
                strokeWidth="5"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, delay: 0.28 }}
              />
              <motion.path
                d="M58 30 L30 58"
                fill="none"
                stroke={meta.main}
                strokeWidth="5"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, delay: 0.40 }}
              />
            </>
          )}
        </svg>
      </div>
      {label && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.3 }}
          className="font-heading text-base mt-3 uppercase tracking-wider"
          style={{ color: meta.main }}
        >
          {label}
        </motion.div>
      )}
    </motion.div>
  )

  if (fullscreen) {
    return (
      <AnimatePresence>
        {open && (
          <motion.div
            key="fb-fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(10,25,48,0.34)', backdropFilter: 'blur(2px)' }}
          >
            {inner}
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence>{open && inner}</AnimatePresence>
  )
}
