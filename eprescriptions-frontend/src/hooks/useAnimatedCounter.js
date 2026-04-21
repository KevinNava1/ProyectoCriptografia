import { useEffect, useRef, useState } from 'react'

export function useAnimatedCounter(target = 0, duration = 1000) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  const fromRef = useRef(0)

  useEffect(() => {
    const el = ref.current
    const to = Number(target) || 0

    const animate = () => {
      const from = fromRef.current
      if (from === to) {
        setValue(to)
        return
      }
      const start = performance.now()
      const tick = (t) => {
        const p = Math.min(1, (t - start) / duration)
        const eased = 1 - Math.pow(1 - p, 3)
        setValue(Math.round(from + (to - from) * eased))
        if (p < 1) requestAnimationFrame(tick)
        else fromRef.current = to
      }
      requestAnimationFrame(tick)
    }

    if (!el) {
      animate()
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animate()
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, duration])

  return { ref, value }
}
