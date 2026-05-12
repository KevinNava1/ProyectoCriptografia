import { forwardRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import Spinner from './Spinner'

// Botón premium con:
//  - Ripple en el punto de click (CSS animation, sin libs)
//  - Loading: el icono se reemplaza por un spinner inline y el botón
//    queda deshabilitado mientras dura.
//  - hover/tap micro-feedback con framer-motion.
//
// Uso:
//   <RippleButton loading={busy} icon={<LogIn size={16} />}>
//     Iniciar sesión
//   </RippleButton>
//
// El consumidor sigue pudiendo añadir `className="btn btn-primary"` para
// heredar los estilos del design system.

const RippleButton = forwardRef(function RippleButton(
  {
    children,
    onClick,
    loading = false,
    disabled,
    icon,
    className = 'btn btn-primary',
    type = 'button',
    rippleColor = 'rgba(255,255,255,0.45)',
    motionProps,
    ...rest
  },
  ref,
) {
  const [ripples, setRipples] = useState([])

  const fireRipple = useCallback((e) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2
    const r = {
      key: Date.now() + Math.random(),
      x: e.clientX - rect.left - size / 2,
      y: e.clientY - rect.top - size / 2,
      size,
    }
    setRipples((prev) => [...prev, r])
    setTimeout(() => {
      setRipples((prev) => prev.filter((p) => p.key !== r.key))
    }, 620)
  }, [])

  const handleClick = (e) => {
    if (loading || disabled) return
    fireRipple(e)
    onClick?.(e)
  }

  const interactive = !(loading || disabled)

  return (
    <motion.button
      ref={ref}
      type={type}
      onClick={handleClick}
      disabled={loading || disabled}
      whileHover={interactive ? { scale: 1.02 } : undefined}
      whileTap={interactive ? { scale: 0.97 } : undefined}
      className={cn(className, 'ripple-host')}
      style={{ position: 'relative', overflow: 'hidden' }}
      {...motionProps}
      {...rest}
    >
      <span
        aria-hidden
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {ripples.map((r) => (
          <span
            key={r.key}
            className="ripple-dot"
            style={{
              left: r.x,
              top: r.y,
              width: r.size,
              height: r.size,
              background: rippleColor,
            }}
          />
        ))}
      </span>
      <span
        className="relative flex items-center justify-center gap-2"
        style={{ pointerEvents: 'none' }}
      >
        {loading ? <Spinner size={16} /> : icon}
        {children}
      </span>
    </motion.button>
  )
})

export default RippleButton
