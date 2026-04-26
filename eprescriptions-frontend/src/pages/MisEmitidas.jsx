import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Stethoscope, FileSignature, RefreshCcw, Filter, X, GitBranch, ShieldOff, Pill,
  User, Calendar, AlertTriangle,
} from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import SecureCard from '../components/ui/SecureCard'
import StatusChip from '../components/ui/StatusChip'
import LoadingPulse from '../components/ui/LoadingPulse'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import CryptoHash from '../components/ui/CryptoHash'
import SessionKeyPicker, { validateKeysBundle } from '../components/ui/SessionKeyPicker'
import { useAuthStore } from '../store/useAuthStore'
import { recetasAPI } from '../api'
import { formatDate } from '../lib/utils'

const FILTROS = [
  { id: 'todas',    label: 'Todas' },
  { id: 'emitida',  label: 'Activas' },
  { id: 'dispensada', label: 'Dispensadas' },
  { id: 'revocada', label: 'Revocadas' },
]

export default function MisEmitidas() {
  const user = useAuthStore(s => s.user)
  const [recetas, setRecetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('todas')
  const [version, setVersion] = useState(0)
  const [cancelOf, setCancelOf] = useState(null)
  const [versionOf, setVersionOf] = useState(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      setLoading(true); setError(null)
      try {
        const { data } = await recetasAPI.porMedico(user.id)
        if (!cancelled) setRecetas(data || [])
      } catch (err) {
        if (!cancelled) setError(err?.uiMessage || 'No se pudieron cargar tus recetas')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user, version])

  const visibles = useMemo(() => {
    if (filtro === 'todas') return recetas
    return recetas.filter(r => r.estado === filtro)
  }, [recetas, filtro])

  const stats = useMemo(() => ({
    total: recetas.length,
    activas: recetas.filter(r => r.estado === 'emitida').length,
    dispensadas: recetas.filter(r => r.estado === 'dispensada').length,
    revocadas: recetas.filter(r => r.estado === 'revocada').length,
  }), [recetas])

  return (
    <PageTransition>
      <div className="space-y-6">
        <header className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="label-xs flex items-center gap-1.5">
              <Stethoscope size={11} className="text-[color:var(--cyan)]" />
              Médico · @{user?.username}
            </div>
            <h1 className="font-heading text-3xl md:text-4xl mt-2 flex items-center gap-3">
              <FileSignature className="text-[color:var(--cyan)]" /> Mis recetas emitidas
            </h1>
            <p className="text-[color:var(--text-secondary)] mt-2 text-sm max-w-xl">
              Gestiona las recetas que has firmado: cancela las que aún no se completaron o emite
              una nueva versión cuando necesites ajustar dosis o medicamento.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVersion(v => v + 1)}
            className="btn btn-ghost btn-sm"
          >
            <RefreshCcw size={14}/> Refrescar
          </button>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Kpi label="Total" value={stats.total} accent="#0A84FF" />
          <Kpi label="Activas" value={stats.activas} accent="#E08700" />
          <Kpi label="Dispensadas" value={stats.dispensadas} accent="#00A870" />
          <Kpi label="Revocadas" value={stats.revocadas} accent="#B42318" />
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Filter size={14} className="text-[color:var(--text-secondary)]" />
            {FILTROS.map(f => {
              const active = filtro === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltro(f.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{
                    background: active ? 'rgba(10,132,255,0.10)' : 'var(--bg-tertiary)',
                    border: `1px solid ${active ? 'rgba(10,132,255,0.55)' : 'var(--border-subtle)'}`,
                    color: active ? 'var(--blue-deep)' : 'var(--text-secondary)',
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>

          {loading && <LoadingPulse rows={4} />}
          {!loading && error && <EmptyState title="Error" message={error} />}
          {!loading && !error && visibles.length === 0 && (
            <EmptyState
              title={filtro === 'todas' ? 'Aún no has emitido recetas' : 'No hay recetas con este filtro'}
              message="Cuando firmes una receta, aparecerá aquí con sus contadores y firmas."
            />
          )}
          {!loading && !error && visibles.length > 0 && (
            <div className="grid gap-3">
              {visibles.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <RecetaCard
                    receta={r}
                    onCancel={() => setCancelOf(r)}
                    onNuevaVersion={() => setVersionOf(r)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modal — Cancelar */}
      <CancelModal
        receta={cancelOf}
        onClose={() => setCancelOf(null)}
        onDone={() => { setCancelOf(null); setVersion(v => v + 1) }}
      />

      {/* Modal — Nueva versión */}
      <NuevaVersionModal
        receta={versionOf}
        onClose={() => setVersionOf(null)}
        onDone={() => { setVersionOf(null); setVersion(v => v + 1) }}
      />
    </PageTransition>
  )
}

function Kpi({ label, value, accent }) {
  return (
    <SecureCard className="relative overflow-hidden min-h-[110px] flex flex-col justify-between">
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-50 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accent}33, transparent 70%)` }}
      />
      <div className="label-xs">{label}</div>
      <div className="font-heading text-3xl mt-2" style={{ color: accent }}>{value}</div>
    </SecureCard>
  )
}

function RecetaCard({ receta: r, onCancel, onNuevaVersion }) {
  const cancelable = r.estado === 'emitida'
  const replaceable = r.estado === 'emitida'
  return (
    <SecureCard className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.32)' }}>
          <Pill className="text-[color:var(--cyan)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-heading text-lg">Receta #{r.id}</div>
            <StatusChip estado={r.estado} />
            {r.parent_id && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.40)', color: '#0052CC' }}>
                <GitBranch size={10}/> deriva de #{r.parent_id}
              </span>
            )}
          </div>
          <div className="text-xs text-[color:var(--text-secondary)] flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            <span className="flex items-center gap-1"><User size={11}/> @{r.paciente_username || r.paciente_id}</span>
            <span className="flex items-center gap-1"><Calendar size={11}/> {formatDate(r.fecha)}</span>
            <span>· dispensaciones {r.dispensaciones_realizadas}/{r.dispensaciones_permitidas}</span>
          </div>
          <div className="mt-2">
            <CryptoHash value={r.hash_sha3} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        <motion.button
          whileHover={replaceable ? { scale: 1.03 } : undefined}
          whileTap={replaceable ? { scale: 0.97 } : undefined}
          onClick={onNuevaVersion}
          disabled={!replaceable}
          className="btn btn-ghost btn-sm"
          title={replaceable ? '' : 'Solo recetas activas pueden ser sustituidas'}
        >
          <GitBranch size={13}/> Nueva versión
        </motion.button>
        <motion.button
          whileHover={cancelable ? { scale: 1.03 } : undefined}
          whileTap={cancelable ? { scale: 0.97 } : undefined}
          onClick={onCancel}
          disabled={!cancelable}
          className="btn btn-ghost btn-sm"
          style={cancelable ? { color: '#B42318', borderColor: 'rgba(180,35,24,0.30)' } : undefined}
          title={cancelable ? '' : 'Solo recetas activas pueden ser canceladas'}
        >
          <ShieldOff size={13}/> Cancelar
        </motion.button>
      </div>
    </SecureCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancelar (§8)
// ─────────────────────────────────────────────────────────────────────────────
function CancelModal({ receta, onClose, onDone }) {
  const [motivo, setMotivo] = useState('')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!receta) { setMotivo(''); setBusy(false) }
  }, [receta])

  const submit = async () => {
    if (motivo.trim().length < 3) return toast.error('Escribe un motivo (mín. 3 caracteres)')
    const v = validateKeysBundle(key, ['ec'])
    if (!v.ok) return toast.error(v.reason)
    setBusy(true)
    try {
      await recetasAPI.cancelar(receta.id, {
        motivo: motivo.trim(),
        llave_privada_medico: key,
      })
      toast.success(`Receta #${receta.id} cancelada · S_cancel firmado`)
      onDone()
    } catch (err) {
      toast.error(err?.uiMessage || 'No se pudo cancelar')
    } finally { setBusy(false) }
  }

  return (
    <Modal open={!!receta} onClose={busy ? () => {} : onClose} title={`Cancelar receta #${receta?.id ?? ''}`}>
      {receta && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: 'rgba(180,35,24,0.06)', border: '1px solid rgba(180,35,24,0.30)' }}>
            <AlertTriangle className="text-[color:var(--red)] shrink-0 mt-0.5" size={18} />
            <div className="text-xs leading-relaxed">
              La cancelación queda firmada con tu ECDSA y registrada como prueba criptográfica
              inmutable (M_cancel + S_cancel). La receta cifrada permanece en BD, pero ninguna
              farmacia podrá dispensarla. Solo aplica a recetas activas o en proceso.
            </div>
          </div>
          <div>
            <div className="label-xs mb-1.5">Motivo</div>
            <textarea
              className="input-field"
              rows={3}
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="cambio_de_terapia · interaccion_farmaco · datos_incorrectos · …"
            />
          </div>
          <SessionKeyPicker requires={['ec']} value={key} onChange={setKey} />
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancelar</button>
            <button
              className="btn btn-primary btn-sm"
              style={{ background: '#B42318', borderColor: '#8a1610' }}
              onClick={submit}
              disabled={busy}
            >
              <ShieldOff size={13}/> {busy ? 'Firmando…' : 'Confirmar cancelación'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Nueva versión (§9)
// ─────────────────────────────────────────────────────────────────────────────
function NuevaVersionModal({ receta, onClose, onDone }) {
  const [form, setForm] = useState({
    medicamento: '',
    dosis: '',
    cantidad: 1,
    instrucciones: '',
    dispensaciones_permitidas: 1,
    intervalo_dias: '',
    motivo_sustitucion: '',
  })
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!receta) {
      setForm({
        medicamento: '', dosis: '', cantidad: 1, instrucciones: '',
        dispensaciones_permitidas: 1, intervalo_dias: '', motivo_sustitucion: '',
      })
      setBusy(false)
    }
  }, [receta])

  const ch = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.medicamento || !form.dosis) return toast.error('Completa medicamento y dosis')
    if (Number(form.cantidad) <= 0) return toast.error('Cantidad debe ser ≥ 1')
    if (form.motivo_sustitucion.trim().length < 3) return toast.error('Indica un motivo de sustitución')
    const v = validateKeysBundle(key, ['ec'])
    if (!v.ok) return toast.error(v.reason)
    setBusy(true)
    try {
      const payload = {
        paciente_username: receta.paciente_username || '',
        medicamento: form.medicamento.trim(),
        dosis: form.dosis.trim(),
        cantidad: Number(form.cantidad),
        instrucciones: form.instrucciones,
        dispensaciones_permitidas: Number(form.dispensaciones_permitidas) || 1,
        intervalo_dias: form.intervalo_dias === '' ? null : Number(form.intervalo_dias),
        motivo_sustitucion: form.motivo_sustitucion.trim(),
        llave_privada_medico: key,
      }
      const { data } = await recetasAPI.nuevaVersion(receta.id, payload)
      toast.success(`Receta #${receta.id} sustituida · nueva #${data.id}`)
      onDone()
    } catch (err) {
      toast.error(err?.uiMessage || 'No se pudo crear la nueva versión')
    } finally { setBusy(false) }
  }

  return (
    <Modal open={!!receta} onClose={busy ? () => {} : onClose} title={`Nueva versión de receta #${receta?.id ?? ''}`} wide>
      {receta && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.28)' }}>
            <GitBranch className="text-[color:var(--cyan)] shrink-0 mt-0.5" size={18} />
            <div className="text-xs leading-relaxed">
              La receta original quedará en estado <strong>sustituida</strong> y se creará una receta
              nueva con <strong>parent_id = #{receta.id}</strong>. La nueva tiene K_aes/IV/AAD
              propios y reinicia el contador de dispensaciones.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Paciente">
              <input className="input-field" value={`@${receta.paciente_username || receta.paciente_id}`} readOnly />
            </Field>
            <Field label="Motivo de sustitución" hint="≥ 3 caracteres">
              <input className="input-field" value={form.motivo_sustitucion}
                onChange={e => ch('motivo_sustitucion', e.target.value)}
                placeholder="ajuste_dosis · cambio_terapia · …" />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Medicamento">
              <input className="input-field" value={form.medicamento}
                onChange={e => ch('medicamento', e.target.value)} placeholder="Paracetamol 500mg" />
            </Field>
            <Field label="Dosis">
              <input className="input-field" value={form.dosis}
                onChange={e => ch('dosis', e.target.value)} placeholder="1 c/8h" />
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Cantidad">
              <input className="input-field" type="number" min="1" value={form.cantidad}
                onChange={e => ch('cantidad', e.target.value)} />
            </Field>
            <Field label="Dispensaciones">
              <input className="input-field" type="number" min="1" max="30"
                value={form.dispensaciones_permitidas}
                onChange={e => ch('dispensaciones_permitidas', e.target.value)} />
            </Field>
            <Field label="Intervalo (días)" hint="opcional">
              <input className="input-field" type="number" min="0" max="365"
                value={form.intervalo_dias}
                onChange={e => ch('intervalo_dias', e.target.value)} placeholder="—" />
            </Field>
          </div>

          <Field label="Indicaciones">
            <textarea className="input-field" rows={2} value={form.instrucciones}
              onChange={e => ch('instrucciones', e.target.value)}
              placeholder="Tomar después de comer · evitar alcohol · …" />
          </Field>

          <SessionKeyPicker requires={['ec']} value={key} onChange={setKey} />

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
              <GitBranch size={13}/> {busy ? 'Firmando y emitiendo…' : 'Firmar nueva versión'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}


function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="label-xs">{label}</span>
        {hint && <span className="text-[10px] text-[color:var(--text-secondary)]/70">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
