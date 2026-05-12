// Animation presets reusables — un único punto de verdad para que todas las
// listas, páginas y secciones respiren con el mismo ritmo. Importar desde aquí
// en vez de redefinir variants inline.

// Crossfade + slide suave para transiciones de página entre rutas.
export const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
  transition: { duration: 0.30, ease: [0.22, 1, 0.36, 1] },
}

// Stagger de listas: cada item entra con +50ms y un slide-up de 20px.
// Úsalo en motion.div padre con `variants={listContainer}`, e hijos con
// `variants={listItem}`.
export const listContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
}

export const listItem = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  },
}

// Variant equivalente para secciones grandes (header, KPIs, tabla).
export const sectionFade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

// Shake suave para errores de validación.
export const shake = {
  shake: {
    x: [0, -8, 8, -6, 6, -3, 3, 0],
    transition: { duration: 0.5, ease: 'easeInOut' },
  },
}

// easeOutExpo manual para counters que arrancan rápido y se asientan.
export function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

// Reducir movimiento — los componentes lo consultan para apagar tilt/parallax
// sin tocar los keyframes globales (que el media query del CSS ya neutraliza).
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
