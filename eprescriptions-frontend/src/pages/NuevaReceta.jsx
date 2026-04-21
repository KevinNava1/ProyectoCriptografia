import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { User, Pill, ShieldCheck, Check, Sparkles, ArrowRight, ArrowLeft, Loader2, FileSignature, AtSign } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import SecureCard from '../components/ui/SecureCard'
import PrivKeyInput from '../components/ui/PrivKeyInput'
import CryptoHash from '../components/ui/CryptoHash'
import { useAuthStore } from '../store/useAuthStore'
import { recetasAPI, usuariosAPI } from '../api'
import { isValidPEM } from '../lib/utils'

const STEPS = [
  { id: 1, label: 'Paciente' },
  { id: 2, label: 'Medicamento' },
  { id: 3, label: 'Firmar' },
  { id: 4, label: 'Confirmación' },
]

export default function NuevaReceta() {
  const user = useAuthStore(s => s.user)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    paciente_username: '',
    medicamento: '',
    dosis: '',
    cantidad: 1,
    instrucciones: '',
    llave_privada_medico: user?.llave_privada || '',
  })
  const [pacienteInfo, setPacienteInfo] = useState(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [result, setResult] = useState(null)
  const [signing, setSigning] = useState(false)

  const onChange = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const onBlurPaciente = async () => {
    const u = form.paciente_username.trim()
    if (!u) { setPacienteInfo(null); return }
    setLookingUp(true)
    try {
      const { data } = await usuariosAPI.porUsername(u)
      if (data.rol !== 'paciente') {
        setPacienteInfo({ error: `@${u} existe pero no es paciente (es ${data.rol})` })
      } else {
        setPacienteInfo({ nombre: data.nombre, username: data.username })
      }
    } catch (err) {
      setPacienteInfo({ error: err?.uiMessage || 'Paciente no encontrado' })
    } finally { setLookingUp(false) }
  }

  const canNext =
    (step === 1 && form.paciente_username && pacienteInfo && !pacienteInfo.error) ||
    (step === 2 && form.medicamento && form.dosis && Number(form.cantidad) > 0) ||
    step === 3

  const submit = async () => {
    if (!isValidPEM(form.llave_privada_medico)) {
      return toast.error('La llave privada no tiene formato PEM válido')
    }
    setSigning(true)
    try {
      const { data } = await recetasAPI.crear(user.id, {
        paciente_username: form.paciente_username.trim(),
        medicamento: form.medicamento,
        dosis: form.dosis,
        cantidad: Number(form.cantidad),
        instrucciones: form.instrucciones,
        llave_privada_medico: form.llave_privada_medico,
      })
      setResult(data)
      setStep(4)
      toast.success(`Receta #${data.id} firmada con ECDSA`)
    } catch (err) {
      toast.error(err?.uiMessage || 'No se pudo firmar la receta')
    } finally { setSigning(false) }
  }

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <div className="label-xs">Médico · {user?.nombre}</div>
          <h1 className="font-heading text-3xl md:text-4xl mt-2 flex items-center gap-3">
            <FileSignature className="text-[color:var(--cyan)]" /> Emitir nueva receta
          </h1>
          <p className="text-[color:var(--text-secondary)] text-sm mt-2">
            Cada receta se cifra con AES-256-GCM y se firma con tu llave privada ECDSA.
          </p>
        </header>

        <ProgressBar step={step} />

        <SecureCard className="p-6 md:p-8" hover={false}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <StepWrap key="s1">
                <StepTitle icon={User} title="Paciente" subtitle="Ingresa el nombre de usuario del paciente" />
                <Field label="Usuario del paciente">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[color:var(--text-secondary)]">
                      <AtSign size={14} />
                    </div>
                    <input
                      value={form.paciente_username}
                      onChange={e => { onChange('paciente_username', e.target.value); setPacienteInfo(null) }}
                      onBlur={onBlurPaciente}
                      className="input-field pl-9"
                      placeholder="ana.perez"
                      spellCheck={false}
                      autoCapitalize="none"
                    />
                  </div>
                </Field>
                {lookingUp && (
                  <div className="mt-3 text-xs text-[color:var(--text-secondary)] flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" /> Buscando paciente…
                  </div>
                )}
                {!lookingUp && pacienteInfo?.error && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 rounded-xl text-sm"
                    style={{ background: 'rgba(180,35,24,0.08)', border: '1px solid rgba(180,35,24,0.35)', color: '#B42318' }}
                  >
                    {pacienteInfo.error}
                  </motion.div>
                )}
                {!lookingUp && pacienteInfo && !pacienteInfo.error && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.25)' }}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(10,132,255,0.12)' }}>
                      <User size={18} className="text-[color:var(--cyan)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{pacienteInfo.nombre}</div>
                      <div className="text-xs text-[color:var(--text-secondary)] font-mono">@{pacienteInfo.username}</div>
                    </div>
                    <Check size={18} className="text-[color:var(--emerald)] ml-auto shrink-0" />
                  </motion.div>
                )}
              </StepWrap>
            )}

            {step === 2 && (
              <StepWrap key="s2">
                <StepTitle icon={Pill} title="Detalles del medicamento" subtitle="Completa dosis, cantidad e instrucciones" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Medicamento">
                    <input value={form.medicamento} onChange={e => onChange('medicamento', e.target.value)} className="input-field" placeholder="Amoxicilina 500mg" />
                  </Field>
                  <Field label="Dosis">
                    <input value={form.dosis} onChange={e => onChange('dosis', e.target.value)} className="input-field" placeholder="1 cada 8 hrs" />
                  </Field>
                  <Field label="Cantidad" className="md:col-span-1">
                    <input type="number" min={1} value={form.cantidad} onChange={e => onChange('cantidad', e.target.value)} className="input-field" />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Instrucciones">
                      <textarea value={form.instrucciones} onChange={e => onChange('instrucciones', e.target.value)} className="input-field" rows={3} placeholder="Tomar después de alimentos…" />
                    </Field>
                  </div>
                </div>
              </StepWrap>
            )}

            {step === 3 && (
              <StepWrap key="s3">
                <StepTitle icon={ShieldCheck} title="Firma criptográfica" subtitle="Revisa y firma con ECDSA P-256" />
                <div className="mb-5 p-4 rounded-xl"
                  style={{ background: 'rgba(10,132,255,0.04)', border: '1px solid rgba(10,132,255,0.22)' }}>
                  <div className="label-xs mb-2">Resumen</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <SummaryRow label="Paciente" value={pacienteInfo?.nombre ? `${pacienteInfo.nombre} (@${pacienteInfo.username})` : `@${form.paciente_username}`} />
                    <SummaryRow label="Medicamento" value={form.medicamento} />
                    <SummaryRow label="Dosis" value={form.dosis} />
                    <SummaryRow label="Cantidad" value={form.cantidad} />
                  </div>
                  {form.instrucciones && (
                    <div className="text-xs text-[color:var(--text-secondary)] mt-3 pt-3 border-t border-[var(--border-subtle)] leading-relaxed">
                      {form.instrucciones}
                    </div>
                  )}
                </div>
                <PrivKeyInput
                  value={form.llave_privada_medico}
                  onChange={v => onChange('llave_privada_medico', v)}
                  label="Pega tu llave privada ECDSA para firmar"
                />
                <AnimatePresence>
                  {signing && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-5 flex items-center gap-3 p-4 rounded-xl"
                      style={{ background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.35)' }}
                    >
                      <Loader2 className="animate-spin text-[color:var(--cyan)] shrink-0" />
                      <div className="min-w-0">
                        <div className="font-semibold">Firmando con ECDSA P-256…</div>
                        <div className="text-xs text-[color:var(--text-secondary)]">
                          Calculando hash SHA-256 y cifrando el payload.
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </StepWrap>
            )}

            {step === 4 && result && (
              <StepWrap key="s4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                  className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
                  style={{ background: 'radial-gradient(circle,#00A870,#007049)', boxShadow: '0 0 40px rgba(0,168,112,0.55)' }}
                >
                  <Check size={32} className="text-white" />
                </motion.div>
                <h2 className="font-heading text-2xl text-center mt-4 glitch text-[color:var(--emerald)]">Receta firmada</h2>
                <p className="text-center text-sm text-[color:var(--text-secondary)] mt-2 max-w-md mx-auto">
                  Cifrada con AES-256-GCM · firmada con ECDSA · integridad verificable con SHA-256.
                </p>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SecureCard hover={false}>
                    <div className="label-xs">Receta</div>
                    <div className="font-heading text-3xl mt-1">#{result.id}</div>
                    <div className="text-xs text-[color:var(--text-secondary)] mt-2">Estado: {result.estado}</div>
                  </SecureCard>
                  <SecureCard hover={false}>
                    <div className="label-xs mb-2">Integridad</div>
                    <CryptoHash value={result.hash_sha256} />
                  </SecureCard>
                </div>

                <div className="flex flex-col md:flex-row gap-3 mt-6 justify-center">
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setStep(1)
                      setResult(null)
                      setPacienteInfo(null)
                      setForm(f => ({ ...f, paciente_username: '', medicamento: '', dosis: '', cantidad: 1, instrucciones: '' }))
                    }}
                  >
                    <Sparkles size={14}/> Nueva receta
                  </button>
                  <Link to="/dashboard" className="btn btn-primary">
                    Volver al dashboard
                  </Link>
                </div>
              </StepWrap>
            )}
          </AnimatePresence>

          {step < 4 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--border-subtle)]">
              {step > 1 ? (
                <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>
                  <ArrowLeft size={14}/> Atrás
                </button>
              ) : <span />}

              {step < 3 && (
                <motion.button
                  disabled={!canNext}
                  onClick={() => setStep(s => s + 1)}
                  whileHover={canNext ? { scale: 1.03 } : undefined}
                  whileTap={canNext ? { scale: 0.97 } : undefined}
                  className="btn btn-primary"
                >
                  Continuar <ArrowRight size={14}/>
                </motion.button>
              )}
              {step === 3 && (
                <motion.button
                  disabled={signing}
                  onClick={submit}
                  whileHover={!signing ? { scale: 1.03 } : undefined}
                  whileTap={!signing ? { scale: 0.97 } : undefined}
                  className="btn btn-primary"
                >
                  <ShieldCheck size={14}/> {signing ? 'Firmando…' : 'Firmar y emitir'}
                </motion.button>
              )}
            </div>
          )}
        </SecureCard>
      </div>
    </PageTransition>
  )
}

function ProgressBar({ step }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s) => {
        const done = step > s.id
        const active = step === s.id
        return (
          <div key={s.id} className="flex-1 flex flex-col gap-1.5 min-w-0">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(10,36,67,0.08)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: done || active ? '100%' : '0%' }}
                transition={{ duration: 0.35 }}
                className="h-full"
                style={{
                  background: done
                    ? 'linear-gradient(90deg,#00A870,#0A84FF)'
                    : 'linear-gradient(90deg,#0A84FF,#0052CC)',
                }}
              />
            </div>
            <div
              className="text-[10px] font-medium tracking-wider uppercase text-center truncate"
              style={{ color: active ? 'var(--blue-deep)' : done ? 'var(--emerald)' : 'var(--text-secondary)' }}
            >
              {s.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StepWrap({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  )
}

function StepTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(10,132,255,0.1)', border: '1px solid rgba(10,132,255,0.32)' }}>
        <Icon size={18} className="text-[color:var(--cyan)]" />
      </div>
      <div className="min-w-0">
        <h2 className="font-heading text-xl">{title}</h2>
        {subtitle && <p className="text-xs text-[color:var(--text-secondary)] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <div className="label-xs mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-[color:var(--text-secondary)] text-xs shrink-0">{label}:</span>
      <span className="font-medium truncate">{value || '—'}</span>
    </div>
  )
}
