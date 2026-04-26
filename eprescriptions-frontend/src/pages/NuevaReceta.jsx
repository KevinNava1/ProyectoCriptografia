import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { User, Pill, ShieldCheck, Check, Sparkles, ArrowRight, ArrowLeft, Loader2, FileSignature, AtSign, Search } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import SecureCard from '../components/ui/SecureCard'
import SessionKeyPicker, { validateKeysBundle } from '../components/ui/SessionKeyPicker'
import CryptoHash from '../components/ui/CryptoHash'
import { useAuthStore } from '../store/useAuthStore'
import { recetasAPI, usuariosAPI } from '../api'

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
    dispensaciones_permitidas: 1,
    intervalo_dias: '',
    // Default a la EC del login; el SessionKeyPicker la mantiene viva.
    llave_privada_medico: user?.llave_privada_ec || user?.llave_privada || '',
  })
  const [pacienteInfo, setPacienteInfo] = useState(null)
  const [result, setResult] = useState(null)
  const [signing, setSigning] = useState(false)

  const onChange = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const pickPaciente = (p) => {
    setForm(f => ({ ...f, paciente_username: p.username }))
    setPacienteInfo({ nombre: p.nombre, username: p.username })
  }

  const canNext =
    (step === 1 && form.paciente_username && pacienteInfo && !pacienteInfo.error) ||
    (step === 2 && form.medicamento && form.dosis && Number(form.cantidad) > 0) ||
    step === 3

  const submit = async () => {
    const v = validateKeysBundle(form.llave_privada_medico, ['ec'])
    if (!v.ok) return toast.error(v.reason)
    setSigning(true)
    try {
      const { data } = await recetasAPI.crear(user.id, {
        paciente_username: form.paciente_username.trim(),
        medicamento: form.medicamento,
        dosis: form.dosis,
        cantidad: Number(form.cantidad),
        instrucciones: form.instrucciones,
        dispensaciones_permitidas: Number(form.dispensaciones_permitidas) || 1,
        intervalo_dias: form.intervalo_dias === '' ? null : Number(form.intervalo_dias),
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
                <StepTitle icon={User} title="Paciente" subtitle="Empieza a escribir y selecciona de la lista" />
                <PacienteTypeahead
                  value={form.paciente_username}
                  onChange={(v) => {
                    onChange('paciente_username', v)
                    if (!v || (pacienteInfo && pacienteInfo.username !== v)) setPacienteInfo(null)
                  }}
                  onPick={pickPaciente}
                />
                {pacienteInfo && !pacienteInfo.error && (
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
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <Field label="Cantidad">
                    <input type="number" min={1} value={form.cantidad}
                      onChange={e => onChange('cantidad', e.target.value)} className="input-field" />
                  </Field>
                  <Field label="Dispensaciones" hint="cuántas surtidas">
                    <input type="number" min={1} max={30} value={form.dispensaciones_permitidas}
                      onChange={e => onChange('dispensaciones_permitidas', e.target.value)} className="input-field" />
                  </Field>
                  <Field label="Intervalo (días)" hint="opcional">
                    <input type="number" min={0} max={365} value={form.intervalo_dias}
                      onChange={e => onChange('intervalo_dias', e.target.value)} className="input-field" placeholder="—" />
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="Instrucciones">
                    <textarea value={form.instrucciones} onChange={e => onChange('instrucciones', e.target.value)} className="input-field" rows={3} placeholder="Tomar después de alimentos…" />
                  </Field>
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
                    <SummaryRow label="Dispensaciones (= refills)" value={form.dispensaciones_permitidas} />
                    <SummaryRow label="Intervalo (días)" value={form.intervalo_dias === '' ? 'sin restricción' : form.intervalo_dias} />
                  </div>
                  {form.instrucciones && (
                    <div className="text-xs text-[color:var(--text-secondary)] mt-3 pt-3 border-t border-[var(--border-subtle)] leading-relaxed">
                      {form.instrucciones}
                    </div>
                  )}
                </div>
                <SessionKeyPicker
                  requires={['ec']}
                  value={form.llave_privada_medico}
                  onChange={v => onChange('llave_privada_medico', v)}
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
                        <div className="font-semibold">Firmando con ECDSA P-256 + SHA3-256…</div>
                        <div className="text-xs text-[color:var(--text-secondary)]">
                          ECDSA integra el hash internamente; en paralelo se cifra el payload con AES-256-GCM.
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
                  Cifrada con AES-256-GCM y firmada con ECDSA P-256 + SHA3-256 (hash integrado en la firma).
                </p>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SecureCard hover={false}>
                    <div className="label-xs">Receta</div>
                    <div className="font-heading text-3xl mt-1">#{result.id}</div>
                    <div className="text-xs text-[color:var(--text-secondary)] mt-2">Estado: {result.estado}</div>
                  </SecureCard>
                  <SecureCard hover={false}>
                    <div className="label-xs mb-2">Huella SHA3-256</div>
                    <CryptoHash value={result.hash_sha3} label="SHA3-256" />
                  </SecureCard>
                </div>

                <div className="flex flex-col md:flex-row gap-3 mt-6 justify-center">
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setStep(1)
                      setResult(null)
                      setPacienteInfo(null)
                      setForm(f => ({ ...f,
                        paciente_username: '', medicamento: '', dosis: '', cantidad: 1,
                        instrucciones: '', dispensaciones_permitidas: 1, intervalo_dias: '',
                      }))
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

function PacienteTypeahead({ value, onChange, onPick }) {
  const [matches, setMatches] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [active, setActive] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const lastQ = useRef('')

  // Debounce: dispara la búsqueda 250ms después del último teclazo.
  useEffect(() => {
    const q = (value || '').trim()
    if (q.length === 0) {
      setMatches([]); setError(null); setOpen(false); return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      lastQ.current = q
      try {
        const { data } = await usuariosAPI.buscar(q, 'paciente')
        if (lastQ.current !== q) return  // resultado obsoleto
        setMatches(data || [])
        setOpen(true)
        setActive(0)
        setError((data || []).length === 0 ? 'Sin coincidencias' : null)
      } catch (err) {
        setError(err?.uiMessage || 'No se pudo buscar')
        setMatches([])
        setOpen(true)
      } finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [value])

  // Cierra el dropdown si haces click fuera.
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const choose = (p) => {
    onPick(p)
    setOpen(false)
    setMatches([])
    inputRef.current?.blur()
  }

  const onKeyDown = (e) => {
    if (!open || matches.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(matches[active]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="label-xs mb-1.5">Paciente</div>
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[color:var(--text-secondary)]">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => { if (matches.length > 0) setOpen(true) }}
          onKeyDown={onKeyDown}
          className="input-field pl-9"
          placeholder="escribe nombre o usuario…"
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
        />
      </div>
      <AnimatePresence>
        {open && (matches.length > 0 || error) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-30 left-0 right-0 mt-1 rounded-xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(14px) saturate(1.15)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 12px 36px rgba(10,36,67,0.14)',
              maxHeight: 280,
              overflowY: 'auto',
            }}
            role="listbox"
          >
            {matches.length === 0 && error && (
              <div className="px-3 py-2.5 text-[11px] text-[color:var(--text-secondary)]">{error}</div>
            )}
            {matches.map((p, i) => {
              const isActive = i === active
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(p)}
                  onMouseEnter={() => setActive(i)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                  style={{
                    background: isActive ? 'rgba(10,132,255,0.10)' : 'transparent',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.30)' }}>
                    <User size={14} className="text-[color:var(--cyan)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{p.nombre}</div>
                    <div className="text-[11px] font-mono text-[color:var(--text-secondary)] truncate">@{p.username}</div>
                  </div>
                  {isActive && <Check size={14} className="text-[color:var(--cyan)] shrink-0" />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
