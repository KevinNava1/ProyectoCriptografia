import { useState } from 'react'
import { motion } from 'framer-motion'
import { Pill, User, Calendar, RotateCw, Stethoscope, Download, Copy, Check, ShieldAlert } from 'lucide-react'
import StatusChip from './StatusChip'
import CryptoHash from './CryptoHash'
import SignatureBadge from './SignatureBadge'
import { formatDate } from '../../lib/utils'

export default function RxCard3D({ receta }) {
  const [flipped, setFlipped] = useState(false)
  // cripto_ok=false: el backend ya devolvió "(no verificada)" en los campos
  // sensibles. La UI refuerza con borde rojo y banner para que el paciente
  // entienda que esta receta NO se debe consumir.
  const tampered = receta.cripto_ok === false

  return (
    <div className="flip-card" style={{ height: tampered ? 360 : 340 }}>
      <div className="flip-card-inner" style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
        {/* Anverso */}
        <div
          className="flip-face secure-card p-5"
          style={tampered ? { border: '2px solid rgba(180,35,24,0.55)', background: 'rgba(180,35,24,0.04)' } : undefined}
        >
          {tampered && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg mb-3"
              style={{ background: 'rgba(180,35,24,0.10)', border: '1px solid rgba(180,35,24,0.45)' }}
            >
              <ShieldAlert size={18} style={{ color: '#B42318' }} className="shrink-0 mt-0.5"/>
              <div className="min-w-0">
                <div className="font-heading text-sm" style={{ color: '#B42318' }}>
                  Receta NO verificada
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: '#7A1F12' }}>
                  {receta.motivo_no_verificada
                    || 'La firma ECDSA del médico no verifica. No consumas el medicamento; contacta a tu médico.'}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-start mb-3 gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 label-xs">
                <Pill size={12} className="text-[color:var(--cyan)]" /> Receta #{receta.id}
              </div>
              <h3
                className="font-heading text-2xl mt-1 truncate"
                style={tampered ? { color: '#B42318' } : undefined}
              >
                {tampered ? '— censurado —' : receta.medicamento}
              </h3>
            </div>
            <StatusChip estado={receta.estado} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            <Info label="Dosis" value={tampered ? '— censurado —' : receta.dosis} />
            <Info label="Cantidad" value={tampered ? '—' : receta.cantidad} />
            <Info label="Paciente" value={`@${receta.paciente_username || receta.paciente_id}`} icon={<User size={11}/>} />
            <Info label="Médico" value={`@${receta.medico_username || receta.medico_id}`} icon={<Stethoscope size={11}/>} />
          </div>

          {!tampered && receta.instrucciones && (
            <p className="text-xs text-[color:var(--text-secondary)] border-t border-[var(--border-subtle)] pt-3 leading-relaxed line-clamp-2 flex-1">
              {receta.instrucciones}
            </p>
          )}

          <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--border-subtle)]">
            <span className="text-[11px] text-[color:var(--text-secondary)] flex items-center gap-1">
              <Calendar size={11}/> {formatDate(receta.fecha)}
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFlipped(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--cyan)] hover:text-[color:var(--blue-deep)] transition-colors"
            >
              <RotateCw size={12}/> Ver firma
            </motion.button>
          </div>
        </div>

        {/* Reverso */}
        <div className="flip-face flip-back secure-card p-5">
          <div className="flex justify-between items-start mb-4 gap-3">
            <div className="min-w-0">
              <div className="label-xs">Sello criptográfico</div>
              <h3 className="font-heading text-xl mt-1">Receta #{receta.id}</h3>
            </div>
            <SignatureBadge signed={!!receta.firma_medico} />
          </div>

          <div className="space-y-3 flex-1 overflow-auto pr-1">
            <div>
              <div className="label-xs mb-1">Huella SHA3-256 (firmada por ECDSA)</div>
              <CryptoHash value={receta.hash_sha3} full />
            </div>
            <SignatureRow
              label="Firma ECDSA P-256 + SHA3-256 del médico"
              signature={receta.firma_medico}
              filename={`receta_${receta.id}_firma_medico.sig`}
              tone="blue"
            />
            {receta.firma_farmaceutico && (
              <SignatureRow
                label="Firma ECDSA del farmacéutico"
                signature={receta.firma_farmaceutico}
                filename={`receta_${receta.id}_firma_farmaceutico.sig`}
                tone="green"
              />
            )}
          </div>

          <div className="flex justify-end mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFlipped(false)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--cyan)] hover:text-[color:var(--blue-deep)] transition-colors"
            >
              <RotateCw size={12}/> Volver
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value, icon }) {
  return (
    <div className="min-w-0">
      <div className="label-xs flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="font-medium truncate mt-0.5">{value || '—'}</div>
    </div>
  )
}

// Muestra una firma ECDSA como botones (descargar / copiar) en vez de
// volcar el base64 entero al DOM. El usuario que quiera el blob lo baja.
function SignatureRow({ label, signature, filename, tone = 'blue' }) {
  const [copied, setCopied] = useState(false)
  const palette = tone === 'green'
    ? { bg: 'rgba(0,168,112,0.06)', border: 'rgba(0,168,112,0.28)', fg: '#00775A' }
    : { bg: 'rgba(10,132,255,0.06)', border: 'rgba(10,132,255,0.25)', fg: 'var(--blue-deep)' }
  const has = !!signature
  const copy = async () => {
    if (!has) return
    await navigator.clipboard.writeText(signature)
    setCopied(true); setTimeout(() => setCopied(false), 1400)
  }
  const download = () => {
    if (!has) return
    const blob = new Blob([signature], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div>
      <div className="label-xs mb-1">{label}</div>
      <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-md"
        style={{ background: palette.bg, border: `1px solid ${palette.border}` }}>
        <span className="text-[10.5px] font-mono" style={{ color: palette.fg }}>
          {has ? 'ECDSA / DER → base64' : '— no firmada —'}
        </span>
        {has && (
          <>
            <button type="button" onClick={download}
              className="ml-auto inline-flex items-center gap-1 text-[10.5px] px-2 py-1 rounded hover:bg-white/40 transition-colors"
              style={{ color: palette.fg }}>
              <Download size={11}/> Descargar
            </button>
            <button type="button" onClick={copy}
              className="inline-flex items-center gap-1 text-[10.5px] px-2 py-1 rounded hover:bg-white/40 transition-colors"
              style={{ color: palette.fg }}>
              {copied ? <Check size={11}/> : <Copy size={11}/>} {copied ? 'Copiada' : 'Copiar'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
