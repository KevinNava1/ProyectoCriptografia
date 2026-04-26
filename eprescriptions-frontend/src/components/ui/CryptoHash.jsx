import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { truncateHash } from '../../lib/utils'
import { toast } from 'sonner'

export default function CryptoHash({ value, label = 'SHA3-256', full = false }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value || '')
      setCopied(true)
      toast.success('Hash copiado')
      setTimeout(() => setCopied(false), 1500)
    } catch { toast.error('No se pudo copiar') }
  }
  if (!value) return <span className="text-[color:var(--text-secondary)] text-sm">— sin hash —</span>
  return (
    <div className="flex items-center gap-2 group">
      <span className="text-[10px] tracking-widest uppercase text-[color:var(--text-secondary)]">{label}</span>
      <code
        className="hash-mono select-all"
        title={value}
      >
        {full ? value : truncateHash(value, 10, 10)}
      </code>
      <button
        onClick={copy}
        className="opacity-60 group-hover:opacity-100 text-[color:var(--cyan)] hover:text-[color:var(--blue-deep)] transition-opacity"
        aria-label="Copiar hash"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  )
}
