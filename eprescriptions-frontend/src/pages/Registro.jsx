import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { AlertTriangle, Copy, Check, ArrowRight, UserPlus, Download, AtSign, KeyRound, Globe } from 'lucide-react'
import AuroraBackground from '../components/3d/AuroraBackground'
import VideoBackdrop from '../components/3d/VideoBackdrop'
import MedicalVortex3D from '../components/3d/MedicalVortex3D'
import ShieldLogo from '../components/3d/ShieldLogo'
import Pill3DOrbit from '../components/3d/Pill3DOrbit'
import MedicalScene from '../components/illustrations/MedicalScene'
import { DoctorLogo, PatientLogo, PharmacistLogo } from '../components/illustrations/RoleLogos'
import PageTransition from '../components/ui/PageTransition'
import { usuariosAPI } from '../api'

const ROLES = [
  { id: 'medico',       label: 'Médico',       Logo: DoctorLogo,     desc: 'Firma y emite recetas' },
  { id: 'paciente',     label: 'Paciente',     Logo: PatientLogo,    desc: 'Recibe recetas cifradas' },
  { id: 'farmaceutico', label: 'Farmacéutico', Logo: PharmacistLogo, desc: 'Dispensa y verifica' },
]

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,40}$/

export default function Registro() {
  const nav = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ username: '', nombre: '', email: '', password: '', rol: 'paciente' })
  const [resp, setResp] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedPub, setCopiedPub] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const onChange = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.nombre || !form.email || !form.password) {
      return toast.error('Completa todos los campos')
    }
    if (!USERNAME_RE.test(form.username)) {
      return toast.error('El usuario debe tener 3-40 caracteres (letras, números, . _ -)')
    }
    if (form.password.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres')
    setBusy(true)
    try {
      const { data } = await usuariosAPI.registrar({
        ...form,
        username: form.username.trim(),
      })
      setResp(data)
      setStep(2)
    } catch (err) {
      toast.error(err?.uiMessage || 'No se pudo registrar')
    } finally { setBusy(false) }
  }

  const copyKey = async () => {
    if (!resp?.llave_privada) return
    try {
      await navigator.clipboard.writeText(resp.llave_privada)
      setCopied(true)
      toast.success('Llave privada copiada')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const copyPub = async () => {
    if (!resp?.llave_publica) return
    try {
      await navigator.clipboard.writeText(resp.llave_publica)
      setCopiedPub(true)
      toast.success('Llave pública copiada')
      setTimeout(() => setCopiedPub(false), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const downloadKey = () => {
    if (!resp?.llave_privada) return
    const blob = new Blob([resp.llave_privada], { type: 'application/x-pem-file' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `securerx_${resp.username}_private.pem`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadPub = () => {
    if (!resp?.llave_publica) return
    const blob = new Blob([resp.llave_publica], { type: 'application/x-pem-file' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `securerx_${resp.username}_public.pem`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageTransition>
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-8 sm:py-10 px-4">
        <VideoBackdrop intensity="soft" />
        <AuroraBackground variant="subtle" />

        {/* Vórtice médico 3D detrás del formulario */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ width: 'min(1100px, 110vw)', height: 'min(900px, 100vh)' }}
          aria-hidden
        >
          <MedicalVortex3D />
        </div>

        {/* Escena SVG sin píldoras planas + dos Pill3D reales orbitando */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ width: 'min(860px, 96vw)', height: 'min(860px, 88vh)' }}
          aria-hidden
        >
          <MedicalScene variant="capsules" />
          <Pill3DOrbit radius={270} duration={22} size={140} />
          <Pill3DOrbit radius={270} duration={22} size={110} delay={-11} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-xl"
        >
          <div className="secure-card p-6 sm:p-8">
            <StepHeader step={step} />

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.form
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={submit}
                  className="space-y-5 mt-7"
                >
                  <div>
                    <div className="label-xs mb-2.5">Soy…</div>
                    <div className="grid grid-cols-3 gap-3">
                      {ROLES.map(r => {
                        const active = form.rol === r.id
                        const Logo = r.Logo
                        return (
                          <motion.button
                            key={r.id}
                            type="button"
                            whileHover={{ y: -3 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => onChange('rol', r.id)}
                            className="p-4 rounded-xl border text-left transition-colors flex flex-col items-center gap-2 min-h-[148px]"
                            style={{
                              background: active ? 'rgba(10,132,255,0.08)' : 'var(--bg-tertiary)',
                              borderColor: active ? 'rgba(10,132,255,0.55)' : 'var(--border-subtle)',
                            }}
                          >
                            <Logo size={64} active={active} />
                            <div className="text-center">
                              <div className="text-sm font-semibold">{r.label}</div>
                              <div className="text-[10px] text-[color:var(--text-secondary)] leading-snug mt-0.5">{r.desc}</div>
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Usuario" hint="único, sin espacios">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[color:var(--text-secondary)]">
                          <AtSign size={14} />
                        </div>
                        <input
                          value={form.username}
                          onChange={e => onChange('username', e.target.value)}
                          className="input-field pl-9"
                          placeholder="ana.perez"
                          spellCheck={false}
                          autoCapitalize="none"
                          autoComplete="username"
                        />
                      </div>
                    </Field>
                    <Field label="Nombre completo">
                      <input value={form.nombre} onChange={e => onChange('nombre', e.target.value)} className="input-field" placeholder="Ana Pérez" autoComplete="name" />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Email">
                      <input type="email" value={form.email} onChange={e => onChange('email', e.target.value)} className="input-field" placeholder="ana@hosp.mx" autoComplete="email" />
                    </Field>
                    <Field label="Contraseña">
                      <input type="password" value={form.password} onChange={e => onChange('password', e.target.value)} className="input-field" placeholder="Mín. 6 caracteres" autoComplete="new-password" />
                    </Field>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={busy}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn btn-primary btn-lg w-full"
                  >
                    <UserPlus size={16}/> {busy ? 'Creando…' : 'Crear cuenta'} <ArrowRight size={16}/>
                  </motion.button>

                  <div className="text-center text-xs text-[color:var(--text-secondary)] pt-1">
                    ¿Ya tienes cuenta?{' '}
                    <Link to="/login" className="text-[color:var(--cyan)] hover:underline font-medium">Inicia sesión</Link>
                  </div>
                </motion.form>
              )}

              {step === 2 && resp && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="mt-7 space-y-5"
                >
                  <div className="p-5 rounded-xl"
                    style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.30)' }}>
                    <div className="label-xs flex items-center gap-1.5">
                      <span className="dot-pulse cyan" style={{ width: 6, height: 6 }} />
                      Tu cuenta está lista
                    </div>
                    <div className="flex items-baseline gap-3 mt-2 flex-wrap">
                      <span className="font-mono text-lg sm:text-xl text-[color:var(--blue-deep)] break-all font-semibold">@{resp.username}</span>
                      <span className="text-xs text-[color:var(--text-secondary)] uppercase tracking-wider">{resp.rol}</span>
                    </div>
                    <p className="text-[12px] text-[color:var(--text-secondary)] mt-2 leading-relaxed">
                      Usa este nombre de usuario para iniciar sesión. Si eres paciente, este username es el que debe
                      darte tu médico para emitir recetas a tu nombre.
                    </p>
                  </div>

                  {resp.llave_privada && (
                    <>
                      <div
                        className="flex items-start gap-3 p-4 rounded-xl"
                        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.4)' }}
                      >
                        <AlertTriangle className="text-[color:var(--amber)] shrink-0 mt-0.5" size={22} />
                        <div className="min-w-0">
                          <div className="font-heading text-lg text-[color:var(--amber)]">Tu llave privada solo se muestra una vez</div>
                          <p className="text-sm text-[color:var(--text-secondary)] mt-1 leading-relaxed">
                            Guárdala en un gestor de contraseñas. La necesitarás cada vez que firmes o dispenses.
                            Si la pierdes, tu cuenta no podrá volver a operar con criptografía. La llave pública
                            queda registrada en el servidor y puede consultarse en cualquier momento.
                          </p>
                        </div>
                      </div>

                      {resp.llave_publica && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="label-xs flex items-center gap-1.5">
                              <Globe size={12} className="text-[color:var(--emerald)]" />
                              Tu llave pública ECDSA (P-256)
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={downloadPub} className="btn btn-ghost btn-sm">
                                <Download size={12}/> Descargar .pem
                              </button>
                              <button type="button" onClick={copyPub} className="btn btn-ghost btn-sm">
                                {copiedPub ? <><Check size={12}/> Copiado</> : <><Copy size={12}/> Copiar</>}
                              </button>
                            </div>
                          </div>
                          <pre className="hash-mono text-[10px] p-4 rounded-lg overflow-auto max-h-56 leading-relaxed whitespace-pre"
                            style={{ background: 'rgba(0,168,112,0.05)', border: '1px solid rgba(0,168,112,0.28)' }}>
{resp.llave_publica}
                          </pre>
                          <p className="text-[11px] text-[color:var(--text-secondary)] leading-relaxed">
                            Esta llave se usa para verificar tus firmas. No es secreta: puede compartirse
                            libremente.
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="label-xs flex items-center gap-1.5">
                            <KeyRound size={12} className="text-[color:var(--amber)]" />
                            Tu llave privada ECDSA (P-256)
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={downloadKey} className="btn btn-ghost btn-sm">
                              <Download size={12}/> Descargar .pem
                            </button>
                            <button type="button" onClick={copyKey} className="btn btn-ghost btn-sm">
                              {copied ? <><Check size={12}/> Copiado</> : <><Copy size={12}/> Copiar</>}
                            </button>
                          </div>
                        </div>
                        <pre className="hash-mono text-[10px] p-4 rounded-lg overflow-auto max-h-64 leading-relaxed whitespace-pre"
                          style={{ background: 'rgba(10,132,255,0.05)', border: '1px solid rgba(10,132,255,0.25)' }}>
{resp.llave_privada}
                        </pre>
                      </div>

                      <label className="flex items-center gap-3 text-sm cursor-pointer p-3 rounded-lg"
                        style={{
                          background: confirmed ? 'rgba(0,168,112,0.08)' : 'var(--bg-tertiary)',
                          border: `1px solid ${confirmed ? 'rgba(0,168,112,0.4)' : 'var(--border-subtle)'}`,
                        }}>
                        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                        <span>Confirmo que guardé mi llave privada de forma segura</span>
                      </label>
                    </>
                  )}

                  <motion.button
                    disabled={resp.llave_privada && !confirmed}
                    onClick={() => nav('/login')}
                    whileHover={(!resp.llave_privada || confirmed) ? { scale: 1.02 } : undefined}
                    whileTap={(!resp.llave_privada || confirmed) ? { scale: 0.98 } : undefined}
                    className="btn btn-primary btn-lg w-full"
                  >
                    Continuar al login <ArrowRight size={16}/>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </PageTransition>
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

function StepHeader({ step }) {
  return (
    <div className="flex items-center gap-3">
      <ShieldLogo size={48} />
      <div className="flex-1 min-w-0">
        <div className="label-xs">Paso {step} de 2</div>
        <h1 className="font-heading text-2xl">
          {step === 1 ? 'Crear cuenta' : 'Credenciales listas'}
        </h1>
      </div>
      <div className="flex gap-1 shrink-0">
        {[1, 2].map(n => (
          <div key={n} className="w-8 h-1.5 rounded-full"
            style={{ background: step >= n ? 'linear-gradient(90deg,#0A84FF,#0052CC)' : 'rgba(10,36,67,0.08)' }} />
        ))}
      </div>
    </div>
  )
}
