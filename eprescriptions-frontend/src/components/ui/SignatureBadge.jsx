import { motion } from 'framer-motion'
import { ShieldCheck, ShieldAlert } from 'lucide-react'

export default function SignatureBadge({ signed = true, label }) {
  if (signed) {
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
        style={{
          background: 'rgba(0,168,112,0.12)',
          border: '1px solid rgba(0,168,112,0.40)',
          color: '#00775A',
        }}
      >
        <ShieldCheck size={13} /> {label || 'Firmada ECDSA'}
      </motion.span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{
        background: 'rgba(224,135,0,0.10)',
        border: '1px solid rgba(224,135,0,0.38)',
        color: '#8F4700',
      }}
    >
      <ShieldAlert size={13}/> Sin firma
    </span>
  )
}
