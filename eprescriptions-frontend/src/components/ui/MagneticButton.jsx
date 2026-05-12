import { useRef } from 'react'
import { prefersReducedMotion } from '../../lib/animations'

// Button que atrae al cursor cuando se acerca a su área expandida.
// Implementación: detectamos mousemove en el wrapper (con padding virtual),
// calculamos offset desde el centro del botón, y movemos el contenido
// proporcionalmente hasta `maxPull` px.
//
// Uso:
//   <MagneticButton className="btn btn-primary btn-lg" onClick={...}>
//     <Sparkles /> Emitir receta
//   </MagneticButton>
//
// Respeta prefers-reduced-motion → en ese caso no se mueve.

export default function MagneticButton({
  children,
  className = 'btn btn-primary',
  onClick,
  type = 'button',
  maxPull = 8,
  radius = 80,
  disabled,
  ...rest
}) {
  const wrapRef = useRef(null)
  const innerRef = useRef(null)
  const reduced = prefersReducedMotion()

  const onMove = (e) => {
    if (reduced || disabled) return
    const wrap = wrapRef.current
    const inner = innerRef.current
    if (!wrap || !inner) return
    const rect = wrap.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > radius) {
      inner.style.transform = 'translate3d(0,0,0)'
      return
    }
    const factor = 1 - dist / radius
    const tx = (dx / radius) * maxPull * factor * 2
    const ty = (dy / radius) * maxPull * factor * 2
    inner.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`
  }

  const onLeave = () => {
    const inner = innerRef.current
    if (inner) inner.style.transform = 'translate3d(0,0,0)'
  }

  return (
    <span
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ display: 'inline-block', padding: 12, margin: -12 }}
    >
      <button
        ref={innerRef}
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={className}
        style={{ transition: 'transform 280ms cubic-bezier(.22,1,.36,1)', willChange: 'transform' }}
        {...rest}
      >
        {children}
      </button>
    </span>
  )
}
