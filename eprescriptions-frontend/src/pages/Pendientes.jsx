import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ClipboardList, Pill, User, Stethoscope, Calendar, Stamp, AtSign } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import SecureCard from '../components/ui/SecureCard'
import CryptoHash from '../components/ui/CryptoHash'
import StatusChip from '../components/ui/StatusChip'
import LoadingPulse from '../components/ui/LoadingPulse'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import PrivKeyInput from '../components/ui/PrivKeyInput'
import VerificationSteps from '../components/ui/VerificationSteps'
import { useAuthStore } from '../store/useAuthStore'
import { recetasAPI } from '../api'
import { formatDate, isValidPEM } from '../lib/utils'

export default function Pendientes() {
  const user = useAuthStore(s => s.user)
  const [recetas, setRecetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [picked, setPicked] = useState(null)
  const [key, setKey] = useState(user?.llave_privada || '')
  const [phase, setPhase] = useState('idle')

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await recetasAPI.pendientes()
      setRecetas(data || [])
    } catch (err) {
      setError(err?.uiMessage || 'No se pudieron cargar las recetas pendientes')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const dispense = async () => {
    if (!isValidPEM(key)) return toast.error('Llave privada inválida')
    setPhase('verifying')
    try {
      const { data } = await recetasAPI.dispensar(picked.id, user.id, {
        llave_privada_farmaceutico: key,
      })
      const ok = Object.values(data?.verificaciones || {}).every(Boolean)
      await new Promise(r => setTimeout(r, 2200))
      if (!ok) throw new Error('Alguna verificación falló')
      setPhase('success')
      toast.success(`Receta #${data.receta_id} dispensada`)
      setTimeout(() => {
        setPicked(null)
        setPhase('idle')
        load()
      }, 1400)
    } catch (err) {
      setPhase('error')
      toast.error(err?.uiMessage || err?.message || 'No se pudo dispensar')
      setTimeout(() => setPhase('idle'), 1200)
    }
  }

  const close = () => {
    if (phase !== 'idle' && phase !== 'error') return
    setPicked(null)
    setPhase('idle')
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <header className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="label-xs">Farmacéutico · @{user?.username}</div>
            <h1 className="font-heading text-3xl md:text-4xl mt-2 flex items-center gap-3">
              <ClipboardList className="text-[color:var(--cyan)]" /> Recetas pendientes
            </h1>
            <p className="text-[color:var(--text-secondary)] text-sm mt-2 max-w-xl">
              Cada dispensado verifica AES-GCM, SHA-256 y la firma ECDSA antes de sellarse con tu firma.
            </p>
          </div>
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium self-start lg:self-auto shrink-0"
            style={{
              background: 'rgba(10,132,255,0.10)',
              border: '1px solid rgba(10,132,255,0.40)',
              color: '#0052CC',
            }}
          >
            <span className="dot-pulse cyan" style={{ width: 8, height: 8 }} />
            {recetas.length} por dispensar
          </span>
        </header>

        {loading && <LoadingPulse rows={4} />}
        {!loading && error && <EmptyState title="Error" message={error} />}
        {!loading && !error && recetas.length === 0 && (
          <EmptyState title="Todo al día" message="No hay recetas pendientes en este momento." />
        )}

        {!loading && !error && recetas.length > 0 && (
          <div className="grid gap-4">
            {recetas.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <SecureCard className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.32)' }}>
                      <Pill className="text-[color:var(--cyan)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-heading text-lg truncate">{r.medicamento}</div>
                        <StatusChip estado={r.estado} />
                      </div>
                      <div className="text-xs text-[color:var(--text-secondary)] flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                        <span>{r.dosis} · x{r.cantidad}</span>
                        <span className="flex items-center gap-1"><Stethoscope size={11}/> dr.@{r.medico_username || r.medico_id}</span>
                        <span className="flex items-center gap-1"><User size={11}/> @{r.paciente_username || r.paciente_id}</span>
                        <span className="flex items-center gap-1"><Calendar size={11}/> {formatDate(r.fecha)}</span>
                      </div>
                      <div className="mt-2">
                        <CryptoHash value={r.hash_sha256} />
                      </div>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setPicked(r); setPhase('idle') }}
                    className="btn btn-primary shrink-0"
                  >
                    <Stamp size={14}/> Dispensar
                  </motion.button>
                </SecureCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!picked} onClose={close} title={`Dispensar receta #${picked?.id ?? ''}`} wide>
        {picked && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl"
              style={{ background: 'rgba(10,132,255,0.04)', border: '1px solid rgba(10,132,255,0.22)' }}>
              <Info label="Medicamento" value={picked.medicamento} />
              <Info label="Dosis" value={picked.dosis} />
              <Info label="Paciente" value={`@${picked.paciente_username || picked.paciente_id}`} />
              <Info label="Médico" value={`@${picked.medico_username || picked.medico_id}`} />
            </div>

            <div>
              <div className="label-xs mb-1.5">Hash de integridad</div>
              <CryptoHash value={picked.hash_sha256} full />
            </div>

            <div>
              <div className="label-xs mb-1.5">Farmacéutico</div>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[color:var(--text-secondary)]">
                  <AtSign size={14} />
                </div>
                <input className="input-field pl-9" value={user?.username || ''} readOnly />
              </div>
            </div>

            <PrivKeyInput
              compact
              value={key}
              onChange={setKey}
              label="Pega tu llave privada para sellar el dispensado"
            />

            {phase !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl"
                style={{ background: 'rgba(10,132,255,0.05)', border: '1px solid rgba(10,132,255,0.28)' }}
              >
                <VerificationSteps running={phase === 'verifying' || phase === 'success'} />
                {phase === 'success' && (
                  <div className="mt-4 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                      className="inline-flex items-center gap-2 glitch font-heading text-2xl text-[color:var(--emerald)]"
                    >
                      <Stamp size={22} /> DISPENSADA
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button className="btn btn-ghost" onClick={close} disabled={phase === 'verifying' || phase === 'success'}>
                Cancelar
              </button>
              <motion.button
                whileHover={phase === 'idle' ? { scale: 1.02 } : undefined}
                whileTap={phase === 'idle' ? { scale: 0.98 } : undefined}
                className="btn btn-success"
                onClick={dispense}
                disabled={phase !== 'idle'}
              >
                <Stamp size={14}/> Confirmar dispensado
              </motion.button>
            </div>
          </div>
        )}
      </Modal>
    </PageTransition>
  )
}

function Info({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="label-xs">{label}</div>
      <div className="font-medium mt-0.5 truncate">{value}</div>
    </div>
  )
}
