import { useState } from 'react'
import { Eye, EyeOff, X, CheckCircle2, KeyRound, ShieldAlert } from 'lucide-react'
import { isValidPEM } from '../../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export default function PrivKeyInput({ value, onChange, label = 'Llave privada ECDSA (PEM)', placeholder, compact = false }) {
  const [show, setShow] = useState(false)
  const valid = isValidPEM(value)
  const hasValue = !!value

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <KeyRound size={14} className="text-[color:var(--cyan)]" />
          {label}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="flex items-center gap-1 text-[11px] text-[color:var(--text-secondary)] hover:text-[color:var(--cyan)] transition-colors"
          >
            {show ? <><EyeOff size={12}/> Ocultar</> : <><Eye size={12}/> Mostrar</>}
          </button>
          {hasValue && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="flex items-center gap-1 text-[11px] text-[color:var(--text-secondary)] hover:text-[color:var(--red)] transition-colors"
            >
              <X size={12}/> Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <textarea
          className="input-field text-xs"
          rows={compact ? 4 : 6}
          placeholder={placeholder || '-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          style={show ? {} : { WebkitTextSecurity: 'disc', color: 'var(--text-secondary)' }}
        />
      </div>

      <AnimatePresence mode="wait">
        {hasValue && (
          <motion.div
            key={valid ? 'ok' : 'bad'}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-xs"
          >
            {valid ? (
              <span className="flex items-center gap-1.5 text-[color:var(--emerald)]">
                <CheckCircle2 size={13}/> Formato PEM válido
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[color:var(--amber)]">
                <ShieldAlert size={13}/> Formato no reconocido (se espera BEGIN EC PRIVATE KEY)
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
        La llave viaja cifrada por TLS al backend solo para firmar esta operación. Nunca se almacena en el servidor.
      </p>
    </div>
  )
}
