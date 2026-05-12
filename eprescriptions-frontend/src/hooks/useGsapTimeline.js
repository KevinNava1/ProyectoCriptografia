import { useEffect, useRef } from 'react'
import gsap from 'gsap'

// Timeline declarativo para entradas secuenciales tipo dashboard.
// Robustez crítica:
//   - Si GSAP falla por cualquier razón, el cleanup deja los elementos con
//     opacity:1 (NUNCA quedan invisibles).
//   - Si el listado de steps cambia, mata el timeline previo limpio.
//   - Si el usuario tiene prefers-reduced-motion, no anima.
export function useGsapTimeline(steps = ['header', 'kpis', 'tabs', 'table']) {
  const refs = useRef({})
  const tlRef = useRef(null)

  const register = (key) => (el) => {
    if (el) refs.current[key] = el
    else delete refs.current[key]
  }

  useEffect(() => {
    const reduced = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const elements = steps.map((k) => refs.current[k]).filter(Boolean)
    if (elements.length === 0) return

    if (reduced) {
      gsap.set(elements, { opacity: 1, y: 0, clearProps: 'all' })
      return
    }

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onInterrupt: () => {
        // Garantizar visibilidad si algo aborta a media animación.
        gsap.set(elements, { opacity: 1, y: 0, clearProps: 'all' })
      },
    })
    tlRef.current = tl

    gsap.set(elements, { opacity: 0, y: 18 })

    elements.forEach((el, i) => {
      tl.to(el, { opacity: 1, y: 0, duration: 0.55 }, i === 0 ? 0 : '-=0.30')
    })

    return () => {
      tl.kill()
      // Failsafe: cleanup deja los elementos visibles.
      gsap.set(elements, { opacity: 1, y: 0, clearProps: 'all' })
      tlRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.join('|')])

  return { register }
}
