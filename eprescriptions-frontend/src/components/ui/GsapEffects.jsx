import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from '../../lib/animations'

// Texto con reveal letra por letra usando GSAP. Cada char entra con
// y:18 → 0 y blur(8px) → 0 con stagger 0.025s.
//
// Uso: <RevealText>Hola, Ana.</RevealText>
// Limitación: split character-by-character, ignora HTML interno.
export function RevealText({ children, className, delay = 0, as: Tag = 'span' }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) return

    const chars = el.querySelectorAll('[data-char]')
    if (chars.length === 0) return

    gsap.fromTo(
      chars,
      { yPercent: 80, opacity: 0, filter: 'blur(6px)' },
      {
        yPercent: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: 0.55,
        ease: 'power3.out',
        stagger: 0.022,
        delay,
      }
    )
    return () => gsap.killTweensOf(chars)
  }, [children, delay])

  const text = String(children ?? '')
  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {text.split('').map((c, i) => (
        <span
          key={i}
          data-char
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {c}
        </span>
      ))}
    </Tag>
  )
}

// Sweep brillo barriendo de izquierda a derecha cada N segundos.
// Se monta como overlay absoluto sobre cualquier contenedor con
// position:relative + overflow:hidden. El padre debe tener esos.
export function ShineSweep({ duration = 4, delay = 1, intensity = 0.35 }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ borderRadius: 'inherit' }}
    >
      <span
        className="block absolute top-0 bottom-0"
        style={{
          left: '-50%',
          width: '40%',
          background: `linear-gradient(120deg, transparent 0%, rgba(255,255,255,${intensity}) 50%, transparent 100%)`,
          transform: 'skewX(-15deg)',
          animation: `shineSweep ${duration}s ease-in-out ${delay}s infinite`,
        }}
      />
    </span>
  )
}

// Wrapper para aplicar un gradient animado (cyan → teal → blue-deep)
// que respira. Lo usamos en el header del Dashboard y en el FAB.
export function BreathingGradient({ children, className, intensity = 1, palette = ['#0A84FF', '#00B8D9', '#0052CC'] }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return

    const tl = gsap.timeline({ repeat: -1, yoyo: true })
    const stops = [
      `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 50%, ${palette[2]} 100%)`,
      `linear-gradient(135deg, ${palette[2]} 0%, ${palette[0]} 50%, ${palette[1]} 100%)`,
      `linear-gradient(135deg, ${palette[1]} 0%, ${palette[2]} 50%, ${palette[0]} 100%)`,
    ]
    let i = 0
    const tick = () => {
      i = (i + 1) % stops.length
      gsap.to(el, {
        backgroundImage: stops[i],
        duration: 4 * intensity,
        ease: 'sine.inOut',
        onComplete: tick,
      })
    }
    tick()
    return () => { tl.kill(); gsap.killTweensOf(el) }
  }, [intensity, palette])

  return (
    <span
      ref={ref}
      className={className}
      style={{
        backgroundImage: `linear-gradient(135deg, ${palette[0]}, ${palette[1]}, ${palette[2]})`,
        backgroundSize: '200% 200%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      {children}
    </span>
  )
}
