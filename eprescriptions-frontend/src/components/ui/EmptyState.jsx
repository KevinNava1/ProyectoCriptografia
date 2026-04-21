import { motion } from 'framer-motion'
import { FileText } from 'lucide-react'

export default function EmptyState({ title = 'Sin datos', message = 'No hay registros que mostrar todavía.', icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="secure-card flex flex-col items-center justify-center text-center py-14 sm:py-16 px-6 sm:px-8"
    >
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{ background: 'radial-gradient(circle, rgba(10,132,255,0.18), transparent 70%)' }}
      >
        {icon || <FileText size={32} className="text-[color:var(--cyan)]" />}
      </div>
      <h3 className="font-heading text-xl mb-2">{title}</h3>
      <p className="text-sm text-[color:var(--text-secondary)] max-w-sm leading-relaxed">{message}</p>
    </motion.div>
  )
}
