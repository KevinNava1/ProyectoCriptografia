import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ShieldLogo from '../3d/ShieldLogo'

// Splash inicial — logo centrado con pulse + texto con typing effect.
// Vida útil corta: 1.4s + 0.3s de fade-out. La idea no es bloquear sino
// "anunciar" que la app arranca de forma segura. El usuario que ya está
// logueado lo ve solo en el primer paint del refresh.
const PHRASE = 'Iniciando sesión segura…'

export default function SplashScreen({ onDone, minDuration = 1400 }) {
  const [typed, setTyped] = useState('')
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    let i = 0
    const start = performance.now()
    const interval = setInterval(() => {
      i += 1
      setTyped(PHRASE.slice(0, i))
      if (i >= PHRASE.length) clearInterval(interval)
    }, 48)

    const finish = () => {
      const elapsed = performance.now() - start
      const wait = Math.max(0, minDuration - elapsed)
      setTimeout(() => {
        setVisible(false)
        setTimeout(() => onDone?.(), 320)
      }, wait)
    }

    const t = setTimeout(finish, PHRASE.length * 48 + 240)
    return () => { clearInterval(interval); clearTimeout(t) }
  }, [minDuration, onDone])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[10001] flex flex-col items-center justify-center"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          style={{
            background:
              'radial-gradient(1000px 700px at 50% 35%, rgba(10,132,255,0.18), transparent 60%), var(--bg-primary)',
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-col items-center"
          >
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
              className="relative"
            >
              <span
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, rgba(10,132,255,0.32), transparent 65%)',
                  filter: 'blur(28px)',
                  transform: 'scale(1.6)',
                }}
              />
              <ShieldLogo size={88} />
            </motion.div>

            <div
              className="font-heading text-xl sm:text-2xl mt-6 tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              SecureRx
            </div>
            <div
              className="font-mono text-xs sm:text-sm mt-2 min-h-[18px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {typed}
              <motion.span
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 0.9, repeat: Infinity }}
                className="inline-block w-[7px] h-[1em] align-[-2px] ml-0.5"
                style={{ background: 'var(--cyan)' }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
