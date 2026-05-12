import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

// Barra fina (2px) en lo alto del viewport que se anima a 100% cuando cambia
// la ruta. Como nuestras transiciones de página duran ~300ms, el progreso
// avanza rápido y se desvanece. Si una página lazy tarda más, la barra se
// queda en 80% hasta que el componente termine de montar (siguiente render).
export default function TopProgressBar() {
  const location = useLocation()
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let raf
    let t1, t2, t3
    setActive(true)
    setProgress(0)

    raf = requestAnimationFrame(() => setProgress(35))
    t1 = setTimeout(() => setProgress(70), 140)
    t2 = setTimeout(() => setProgress(92), 320)
    t3 = setTimeout(() => {
      setProgress(100)
      setTimeout(() => setActive(false), 220)
    }, 520)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
    }
  }, [location.pathname])

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="top-progress"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed top-0 left-0 right-0 z-[10000] pointer-events-none"
          style={{ height: 2 }}
        >
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="h-full origin-left"
            style={{
              background:
                'linear-gradient(90deg, #0A84FF 0%, #00B8D9 55%, #0052CC 100%)',
              boxShadow: '0 0 8px rgba(10,132,255,0.55)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
