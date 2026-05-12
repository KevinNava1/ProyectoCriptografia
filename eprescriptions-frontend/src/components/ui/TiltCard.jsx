import { useRef } from 'react'
import { prefersReducedMotion } from '../../lib/animations'

// Tilt 3D suave al pasar el cursor por encima. Máximo ±5° en X/Y.
// Implementación rAF + transform inline para evitar re-renders.
// Respeta prefers-reduced-motion: en ese caso el wrapper es transparente.

export default function TiltCard({
  children,
  max = 5,
  scale = 1.01,
  perspective = 1000,
  className = '',
  style,
  disabled = false,
  // eslint-disable-next-line no-unused-vars -- Comp se usa como tag JSX (<Comp />) y el parser de ESLint no lo detecta en alias destructuring.
  as: Comp = 'div',
}) {
  const ref = useRef(null)
  const rafRef = useRef(null)
  const reduced = prefersReducedMotion()
  const inert = disabled || reduced

  const onMove = (e) => {
    if (inert) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const rotY = (x - 0.5) * 2 * max
    const rotX = -(y - 0.5) * 2 * max
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      el.style.transform =
        `perspective(${perspective}px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale(${scale})`
    })
  }

  const onLeave = () => {
    if (inert) return
    const el = ref.current
    if (!el) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`
  }

  return (
    <Comp
      ref={ref}
      className={`tilt-host ${className}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={style}
    >
      {children}
    </Comp>
  )
}
