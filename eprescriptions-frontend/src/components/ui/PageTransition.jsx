import { motion } from 'framer-motion'
import { pageTransition } from '../../lib/animations'

// Crossfade + slide suave (300ms). Centralizado en animations.js para que
// todas las rutas respiren igual. Si una página necesita otro timing, que
// monte motion.div con sus propios variants — no parchar aquí.
export default function PageTransition({ children, className }) {
  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      exit={pageTransition.exit}
      transition={pageTransition.transition}
      className={className}
    >
      {children}
    </motion.div>
  )
}
