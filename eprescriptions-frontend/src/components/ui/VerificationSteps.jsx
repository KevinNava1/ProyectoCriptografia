import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2 } from 'lucide-react'

const DEFAULT_STEPS = [
  'Verificando integridad SHA-256…',
  'Verificando firma ECDSA del médico…',
  'Sellando con tu firma…',
]

export default function VerificationSteps({ steps = DEFAULT_STEPS, running = false, onDone }) {
  const [idx, setIdx] = useState(-1)
  useEffect(() => {
    if (!running) { setIdx(-1); return }
    let i = 0
    setIdx(0)
    const id = setInterval(() => {
      i++
      if (i >= steps.length) {
        clearInterval(id)
        setIdx(steps.length)
        onDone?.()
      } else setIdx(i)
    }, 700)
    return () => clearInterval(id)
  }, [running, steps.length])

  return (
    <ul className="space-y-2.5">
      {steps.map((s, i) => {
        const state = idx === -1 ? 'pending' : i < idx ? 'done' : i === idx ? 'active' : 'pending'
        const tone =
          state === 'done'
            ? { border: 'rgba(0,168,112,0.40)', bg: 'rgba(0,168,112,0.08)' }
            : state === 'active'
            ? { border: 'rgba(10,132,255,0.40)', bg: 'rgba(10,132,255,0.08)' }
            : { border: 'var(--border-subtle)', bg: 'transparent' }
        return (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
            style={{ borderColor: tone.border, background: tone.bg }}
          >
            {state === 'done' && <CheckCircle2 size={18} className="text-[color:var(--emerald)] shrink-0" />}
            {state === 'active' && <Loader2 size={18} className="animate-spin text-[color:var(--cyan)] shrink-0" />}
            {state === 'pending' && <span className="w-[18px] h-[18px] rounded-full border border-[var(--border-subtle)] shrink-0" />}
            <span
              className={`text-sm ${
                state === 'pending' ? 'text-[color:var(--text-secondary)]' : 'text-[color:var(--text-primary)]'
              }`}
            >
              {s}
            </span>
          </motion.li>
        )
      })}
    </ul>
  )
}
