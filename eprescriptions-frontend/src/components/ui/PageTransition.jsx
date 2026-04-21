import { motion } from 'framer-motion'

const variants = {
  initial: { opacity: 0, y: 20, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -10, filter: 'blur(4px)', transition: { duration: 0.25 } },
}

export default function PageTransition({ children, className }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  )
}
