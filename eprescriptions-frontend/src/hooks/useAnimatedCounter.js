import { useEffect, useRef, useState } from 'react'
import { easeOutExpo } from '../lib/animations'

// Counter rAF-driven. Anima desde el último valor conocido hasta el target
// nuevo cuando éste cambia. Dispara la animación de inicio cuando el elemento
// entra al viewport — si IntersectionObserver no está disponible, anima
// directo. Robustez:
//   - Si target === 0 desde el inicio, no esperamos al observer: mostramos 0
//     ya (no hay nada que animar).
//   - Si el target cambia DESPUÉS de que ya entramos al viewport, animamos
//     con un timer simple sin re-observar.
//   - Devuelve siempre un número renderizable: nunca undefined.
export function useAnimatedCounter(target = 0, duration = 800) {
  const safeTarget = Number.isFinite(Number(target)) ? Number(target) : 0
  const [value, setValue] = useState(safeTarget === 0 ? 0 : 0)
  const ref = useRef(null)
  const fromRef = useRef(0)
  const hasRunRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    const to = safeTarget

    const animate = () => {
      const from = fromRef.current
      if (from === to) {
        setValue(to)
        return
      }
      const start = performance.now()
      const tick = (t) => {
        const p = Math.min(1, (t - start) / duration)
        const eased = easeOutExpo(p)
        setValue(Math.round(from + (to - from) * eased))
        if (p < 1) requestAnimationFrame(tick)
        else fromRef.current = to
      }
      requestAnimationFrame(tick)
    }

    // Caso target=0 → render directo sin animar (no hay diferencia visual).
    if (to === 0 && !hasRunRef.current) {
      setValue(0)
      fromRef.current = 0
      return
    }

    // Si ya animamos una vez, los cambios subsecuentes animan sin observer.
    if (hasRunRef.current) {
      animate()
      return
    }

    if (!el || typeof IntersectionObserver === 'undefined') {
      hasRunRef.current = true
      animate()
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          hasRunRef.current = true
          animate()
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [safeTarget, duration])

  return { ref, value }
}
