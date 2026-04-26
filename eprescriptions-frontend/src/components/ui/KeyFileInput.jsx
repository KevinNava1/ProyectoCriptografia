import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileKey, X, CheckCircle2, ShieldAlert, KeyRound } from 'lucide-react'
import { isEcPrivatePem, isRsaPrivatePem } from '../../lib/utils'

const META = {
  ec: {
    label: 'Llave privada ECDSA (P-256)',
    accent: 'rgba(10,132,255,0.55)',
    accentSoft: 'rgba(10,132,255,0.08)',
    hint: '-----BEGIN EC PRIVATE KEY----- · firmas',
    isValid: isEcPrivatePem,
    badType: 'Esa llave parece RSA, no EC. Sube tu .pem ECDSA (firma).',
    placeholder: 'Selecciona o arrastra tu securerx_*_ec_private.pem',
  },
  rsa: {
    label: 'Llave privada RSA-OAEP (2048)',
    accent: 'rgba(0,168,112,0.55)',
    accentSoft: 'rgba(0,168,112,0.08)',
    hint: '-----BEGIN RSA PRIVATE KEY----- · descifrado',
    isValid: isRsaPrivatePem,
    badType: 'Esa llave parece EC, no RSA. Sube tu .pem RSA (descifrado).',
    placeholder: 'Selecciona o arrastra tu securerx_*_rsa_private.pem',
  },
}

export default function KeyFileInput({ kind, value, onChange, label }) {
  const meta = META[kind] || META.ec
  const inputRef = useRef(null)
  const [drag, setDrag] = useState(false)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')

  const ok = value && meta.isValid(value)
  const badType = value && !ok

  const accept = (text, name = '') => {
    setError('')
    const trimmed = (text || '').trim()
    if (!trimmed) {
      onChange('')
      setFileName('')
      return
    }
    if (!/-----BEGIN[\s\S]+-----END/.test(trimmed)) {
      setError('El archivo no parece ser un PEM válido.')
      return
    }
    if (!meta.isValid(trimmed)) {
      setError(meta.badType)
    }
    setFileName(name || '')
    onChange(trimmed)
  }

  const handleFiles = async (files) => {
    if (!files?.length) return
    const f = files[0]
    if (f.size > 32_000) {
      setError('Archivo demasiado grande para ser una llave PEM.')
      return
    }
    try {
      const txt = await f.text()
      accept(txt, f.name)
    } catch {
      setError('No se pudo leer el archivo.')
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDrag(false)
    handleFiles(e.dataTransfer.files)
  }

  const clear = () => {
    onChange('')
    setFileName('')
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="flex items-center gap-2 text-sm font-medium">
          <KeyRound size={14} style={{ color: meta.accent }} />
          {label || meta.label}
        </label>
        {value && (
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 text-[11px] text-[color:var(--text-secondary)] hover:text-[color:var(--red)] transition-colors"
          >
            <X size={12}/> Quitar
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        className="rounded-xl border border-dashed cursor-pointer transition-all px-4 py-5 flex items-center gap-3"
        style={{
          background: drag ? meta.accentSoft : 'var(--bg-tertiary)',
          borderColor: ok
            ? 'rgba(0,168,112,0.55)'
            : badType
              ? 'rgba(245,158,11,0.55)'
              : drag
                ? meta.accent
                : 'var(--border-subtle)',
        }}
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: meta.accentSoft, border: `1px solid ${meta.accent}` }}
        >
          {ok ? (
            <CheckCircle2 size={18} className="text-[color:var(--emerald)]" />
          ) : (
            <FileKey size={18} style={{ color: meta.accent }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {value ? (
            <>
              <div className="text-sm font-medium truncate">
                {fileName || (ok ? 'Llave cargada' : 'Llave en revisión')}
              </div>
              <div className="text-[11px] text-[color:var(--text-secondary)] truncate">
                {meta.hint}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium">{meta.placeholder}</div>
              <div className="text-[11px] text-[color:var(--text-secondary)]">
                {meta.hint}
              </div>
            </>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[11px] text-[color:var(--text-secondary)] shrink-0">
          <Upload size={12}/> Examinar
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pem,.key,.crt,application/x-pem-file,text/plain"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <AnimatePresence mode="wait">
        {(error || badType) && (
          <motion.div
            key="warn"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-xs text-[color:var(--amber)]"
          >
            <ShieldAlert size={13}/> {error || meta.badType}
          </motion.div>
        )}
        {ok && !error && (
          <motion.div
            key="ok"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-xs text-[color:var(--emerald)]"
          >
            <CheckCircle2 size={13}/> Formato correcto
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
