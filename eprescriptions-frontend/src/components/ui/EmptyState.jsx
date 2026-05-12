import { motion } from 'framer-motion'
import { FileText } from 'lucide-react'

// Empty state animado: icono flotando con loop suave (CSS .empty-float),
// halo radial que pulsa, y tipografía heading que entra desde abajo.
// El icono puede sobreescribirse: si la página pasa <Icon /> custom, se
// aplica el mismo wrapper animado.
export default function EmptyState({
  title = 'Sin datos',
  message = 'No hay registros que mostrar todavía.',
  icon,
  action,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="secure-card flex flex-col items-center justify-center text-center py-14 sm:py-16 px-6 sm:px-8"
    >
      <div className="relative empty-float">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(10,132,255,0.22), transparent 70%)',
            filter: 'blur(18px)',
            transform: 'scale(1.6)',
          }}
          animate={{ opacity: [0.45, 0.85, 0.45] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="relative w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: 'radial-gradient(circle, rgba(10,132,255,0.18), transparent 70%)' }}
        >
          {icon || <FileText size={32} className="text-[color:var(--cyan)]" />}
        </div>
      </div>
      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="font-heading text-xl mb-2"
      >
        {title}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.22, duration: 0.35 }}
        className="text-sm text-[color:var(--text-secondary)] max-w-sm leading-relaxed"
      >
        {message}
      </motion.p>
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.35 }}
          className="mt-5"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  )
}
