import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

export default function SecureCard({ children, className, hover = true, ...rest }) {
  return (
    <motion.div
      whileHover={hover ? { y: -3, boxShadow: '0 20px 40px rgba(0,212,255,0.15)' } : undefined}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={cn('secure-card p-5', className)}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
