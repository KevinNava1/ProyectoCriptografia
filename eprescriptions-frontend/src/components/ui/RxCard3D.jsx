import { useState } from 'react'
import { motion } from 'framer-motion'
import { Pill, User, Calendar, RotateCw, Stethoscope } from 'lucide-react'
import StatusChip from './StatusChip'
import CryptoHash from './CryptoHash'
import SignatureBadge from './SignatureBadge'
import { formatDate } from '../../lib/utils'

export default function RxCard3D({ receta }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="flip-card" style={{ height: 340 }}>
      <div className="flip-card-inner" style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
        {/* Anverso */}
        <div className="flip-face secure-card p-5">
          <div className="flex justify-between items-start mb-3 gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 label-xs">
                <Pill size={12} className="text-[color:var(--cyan)]" /> Receta #{receta.id}
              </div>
              <h3 className="font-heading text-2xl mt-1 truncate">{receta.medicamento}</h3>
            </div>
            <StatusChip estado={receta.estado} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            <Info label="Dosis" value={receta.dosis} />
            <Info label="Cantidad" value={receta.cantidad} />
            <Info label="Paciente" value={`@${receta.paciente_username || receta.paciente_id}`} icon={<User size={11}/>} />
            <Info label="Médico" value={`@${receta.medico_username || receta.medico_id}`} icon={<Stethoscope size={11}/>} />
          </div>

          {receta.instrucciones && (
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
            <div>
              <div className="label-xs mb-1">Firma ECDSA P-256 + SHA3-256 del médico</div>
              <code
                className="hash-mono text-[9px] block p-2.5 rounded-md"
                style={{
                  background: 'rgba(10,132,255,0.06)',
                  border: '1px solid rgba(10,132,255,0.25)',
                  color: 'var(--blue-deep)',
                }}
              >
                {receta.firma_medico || '— no firmada —'}
              </code>
            </div>
            {receta.firma_farmaceutico && (
              <div>
                <div className="label-xs mb-1">Firma ECDSA del farmacéutico</div>
                <code
                  className="hash-mono text-[9px] block p-2.5 rounded-md"
                  style={{
                    background: 'rgba(0,168,112,0.06)',
                    border: '1px solid rgba(0,168,112,0.28)',
                    color: '#00775A',
                  }}
                >
                  {receta.firma_farmaceutico}
                </code>
              </div>
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
