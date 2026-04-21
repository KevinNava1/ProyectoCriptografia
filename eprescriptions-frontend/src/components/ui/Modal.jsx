import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    if (open) {
      window.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop sólido oscuro */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[9998]"
            style={{ background: 'rgba(10,25,48,0.72)' }}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Centering container — PORTAL al body para quedar centrado al viewport */}
          <motion.div
            key="dialog"
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <motion.div
              className={`modal-card w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} pointer-events-auto flex flex-col max-h-[88vh]`}
              initial={{ scale: 0.94, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-6 pb-4 shrink-0 relative"
                style={{ borderBottom: '1px solid var(--border-subtle)', background: '#FFFFFF' }}
              >
                <h3 className="font-heading text-lg sm:text-xl truncate text-[color:var(--text-primary)]">
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="p-1.5 rounded-lg transition-colors shrink-0 text-[color:var(--text-secondary)] hover:text-[color:var(--cyan)] hover:bg-[rgba(10,132,255,0.1)]"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body (scrollable) */}
              <div
                className="px-5 sm:px-6 py-5 sm:py-6 overflow-y-auto flex-1"
                style={{ background: '#FFFFFF' }}
              >
                {children}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
