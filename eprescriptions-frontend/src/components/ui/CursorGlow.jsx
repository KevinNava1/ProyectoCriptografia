import { useEffect, useRef } from 'react'

/**
 * Glow sutil azul que sigue al cursor. Usa un div fijo con radial-gradient
 * y transform GPU-acelerado. Oculto en dispositivos táctiles y si el user
 * prefiere menos movimiento.
 */
export default function CursorGlow({ size = 520, color = 'rgba(10,132,255,0.12)' }) {
  const ref = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isTouch = window.matchMedia('(pointer: coarse)').matches
    const reduce  = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (isTouch || reduce) return

    let raf = 0
    let tx = window.innerWidth / 2
    let ty = window.innerHeight / 2
    let cx = tx, cy = ty

    const onMove = (e) => {
      tx = e.clientX
      ty = e.clientY
    }
    const tick = () => {
      cx += (tx - cx) * 0.18
      cy += (ty - cy) * 0.18
      if (ref.current) {
        ref.current.style.transform = `translate3d(${cx - size / 2}px, ${cy - size / 2}px, 0)`
      }
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [size])

  return (
    <div
      ref={ref}
      aria-hidden
      className="fixed top-0 left-0 pointer-events-none z-[9997] hidden md:block"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, transparent 55%)`,
        mixBlendMode: 'plus-lighter',
        filter: 'blur(2px)',
        willChange: 'transform',
      }}
    />
  )
}
