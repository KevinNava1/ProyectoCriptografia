import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../lib/animations'

// Devuelve un ref para un elemento que se desplazará sutilmente con el
// movimiento del mouse. Factor por defecto 0.02 → en una pantalla de
// 1440px el blob máximo se desplaza ~14px. Suficiente para profundidad
// sin marear. Las capas pueden recibir factores distintos para crear
// efecto de profundidad multicapa.
export function useParallax(factor = 0.02) {
  const ref = useRef(null)
  const rafRef = useRef(null)
  const stateRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 })

  useEffect(() => {
    if (prefersReducedMotion()) return
    const handler = (e) => {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      stateRef.current.tx = (e.clientX - cx) * factor
      stateRef.current.ty = (e.clientY - cy) * factor
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(tick)
    }
    const tick = () => {
      rafRef.current = null
      const s = stateRef.current
      // ease-out hacia el target — el cursor sube de golpe pero la capa
      // se mueve con cierta inercia (más cinematográfico).
      s.x += (s.tx - s.x) * 0.18
      s.y += (s.ty - s.y) * 0.18
      const el = ref.current
      if (el) el.style.transform = `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0)`
      if (Math.abs(s.tx - s.x) > 0.05 || Math.abs(s.ty - s.y) > 0.05) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handler)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [factor])

  return ref
}
