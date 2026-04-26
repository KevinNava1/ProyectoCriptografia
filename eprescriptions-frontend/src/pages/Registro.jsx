import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import JSZip from 'jszip'
import { AlertTriangle, ArrowRight, UserPlus, Download, AtSign, KeyRound, Globe, Package, Check } from 'lucide-react'
import AuroraBackground from '../components/3d/AuroraBackground'
import VideoBackdrop from '../components/3d/VideoBackdrop'
import MedicalVortex3D from '../components/3d/MedicalVortex3D'
import ShieldLogo from '../components/3d/ShieldLogo'
import Pill3DOrbit from '../components/3d/Pill3DOrbit'
import MedicalScene from '../components/illustrations/MedicalScene'
import { DoctorLogo, PatientLogo, PharmacistLogo } from '../components/illustrations/RoleLogos'
import PageTransition from '../components/ui/PageTransition'
import { splitPemBundle } from '../lib/utils'
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
  const [confirmed, setConfirmed] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [downloaded, setDownloaded] = useState({}) // {ec_priv: true, ...}

  // Llaves separadas: si el backend aún no envía los campos partidos,
  // las extraemos del bundle PEM como fallback.
  const keys = useMemo(() => {
    if (!resp) return null
    const split = splitPemBundle(resp.llave_privada || '')
    return {
      ec_priv:  resp.llave_privada_ec  || split.ec  || '',
      rsa_priv: resp.llave_privada_rsa || split.rsa || '',
      ec_pub:   resp.llave_publica_ec  || resp.llave_publica || '',
      rsa_pub:  resp.llave_publica_rsa || '',
    }
  }, [resp])

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

  const downloadPem = (slot, text, suffix) => {
    if (!text) return
    const blob = new Blob([text], { type: 'application/x-pem-file' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `securerx_${resp.username}_${suffix}.pem`
    a.click()
    URL.revokeObjectURL(url)
    setDownloaded(s => ({ ...s, [slot]: true }))
  }

  const downloadAllZip = async () => {
    if (!keys) return
    setZipping(true)
    try {
      const zip = new JSZip()
      const folder = zip.folder(`securerx_${resp.username}_keys`)
      const README =
`SecureRx — Llaves de @${resp.username}
Generadas: ${new Date().toISOString()}

Contenido:
  ec_private.pem   — ECDSA P-256 PRIVADA (firma)        ⚠ NO COMPARTIR
  rsa_private.pem  — RSA-OAEP 2048 PRIVADA (descifrado) ⚠ NO COMPARTIR
  ec_public.pem    — ECDSA P-256 pública
  rsa_public.pem   — RSA-OAEP 2048 pública

Para iniciar sesión sube los dos .pem PRIVADOS en sus campos
correspondientes. Las públicas ya están registradas en el servidor.
`
      folder.file('README.txt', README)
      if (keys.ec_priv)  folder.file('ec_private.pem',  keys.ec_priv)
      if (keys.rsa_priv) folder.file('rsa_private.pem', keys.rsa_priv)
      if (keys.ec_pub)   folder.file('ec_public.pem',   keys.ec_pub)
      if (keys.rsa_pub)  folder.file('rsa_public.pem',  keys.rsa_pub)
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `securerx_${resp.username}_keys.zip`
      a.click()
      URL.revokeObjectURL(url)
      setDownloaded({ ec_priv: true, rsa_priv: true, ec_pub: true, rsa_pub: true, zip: true })
      toast.success('ZIP con tus 4 llaves descargado')
    } catch (err) {
      toast.error('No se pudo generar el ZIP')
    } finally { setZipping(false) }
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
          className={`relative z-10 w-full ${step === 2 ? 'max-w-4xl' : 'max-w-xl'}`}
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

                  {keys && (keys.ec_priv || keys.rsa_priv) && (
                    <>
                      <div
                        className="flex items-start gap-3 p-4 rounded-xl"
                        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.4)' }}
                      >
                        <AlertTriangle className="text-[color:var(--amber)] shrink-0 mt-0.5" size={22} />
                        <div className="min-w-0">
                          <div className="font-heading text-lg text-[color:var(--amber)]">
                            Tus llaves privadas existen solo en este momento
                          </div>
                          <p className="text-sm text-[color:var(--text-secondary)] mt-1 leading-relaxed">
                            Necesitas <strong>ambas</strong> para operar: la <strong>ECDSA</strong> firma tus
                            recetas / cancelaciones / sellos, y la <strong>RSA-OAEP</strong> descifra los datos
                            que el sistema envuelve para ti. Descárgalas ahora — el servidor no las almacena
                            y no podrás recuperarlas.
                          </p>
                        </div>
                      </div>

                      {/* CTA principal — ZIP de las 4 */}
                      <button
                        type="button"
                        onClick={downloadAllZip}
                        disabled={zipping}
                        className="w-full p-5 rounded-xl text-left flex items-center gap-4 transition-all hover:shadow-lg disabled:opacity-60"
                        style={{
                          background: downloaded.zip
                            ? 'linear-gradient(135deg, rgba(0,168,112,0.15), rgba(0,184,217,0.10))'
                            : 'linear-gradient(135deg, rgba(10,132,255,0.15), rgba(0,184,217,0.12))',
                          border: `1px solid ${downloaded.zip ? 'rgba(0,168,112,0.50)' : 'rgba(10,132,255,0.50)'}`,
                        }}
                      >
                        <div
                          className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: downloaded.zip ? 'rgba(0,168,112,0.20)' : 'rgba(10,132,255,0.20)',
                            border: `1px solid ${downloaded.zip ? 'rgba(0,168,112,0.55)' : 'rgba(10,132,255,0.55)'}`,
                          }}
                        >
                          <Package size={26} style={{ color: downloaded.zip ? 'var(--emerald)' : 'var(--cyan)' }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-heading text-lg">
                            {zipping ? 'Empaquetando…' : 'Descargar las 4 llaves (.zip)'}
                          </div>
                          <div className="text-xs text-[color:var(--text-secondary)] mt-0.5">
                            Un solo archivo con EC priv + RSA priv + EC pub + RSA pub + README.
                          </div>
                        </div>
                        <Download size={18} className="shrink-0 opacity-70" />
                      </button>

                      <div className="flex items-center gap-3">
                        <span className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                        <span className="text-[10px] uppercase tracking-wider text-[color:var(--text-secondary)]">
                          o descarga individual
                        </span>
                        <span className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                      </div>

                      <div>
                        <div className="label-xs flex items-center gap-1.5 mb-2">
                          <KeyRound size={12} className="text-[color:var(--amber)]" />
                          Privadas — guárdalas en lugar seguro
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <KeyCard
                            title="ECDSA P-256"
                            subtitle="firma"
                            accent="rgba(10,132,255,0.55)"
                            bg="rgba(10,132,255,0.06)"
                            icon={KeyRound}
                            iconColor="var(--cyan)"
                            done={downloaded.ec_priv}
                            onDownload={() => downloadPem('ec_priv', keys.ec_priv, 'ec_private')}
                          />
                          <KeyCard
                            title="RSA-OAEP 2048"
                            subtitle="descifrado"
                            accent="rgba(0,168,112,0.55)"
                            bg="rgba(0,168,112,0.06)"
                            icon={KeyRound}
                            iconColor="var(--emerald)"
                            done={downloaded.rsa_priv}
                            onDownload={() => downloadPem('rsa_priv', keys.rsa_priv, 'rsa_private')}
                          />
                        </div>
                      </div>

                      {(keys.ec_pub || keys.rsa_pub) && (
                        <div>
                          <div className="label-xs flex items-center gap-1.5 mb-2">
                            <Globe size={12} className="text-[color:var(--emerald)]" />
                            Públicas — opcional, quedan en el servidor
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {keys.ec_pub && (
                              <KeyCard
                                title="ECDSA P-256"
                                subtitle="pública"
                                accent="rgba(91,107,123,0.45)"
                                bg="rgba(91,107,123,0.04)"
                                icon={Globe}
                                iconColor="var(--text-secondary)"
                                subdued
                                done={downloaded.ec_pub}
                                onDownload={() => downloadPem('ec_pub', keys.ec_pub, 'ec_public')}
                              />
                            )}
                            {keys.rsa_pub && (
                              <KeyCard
                                title="RSA-OAEP 2048"
                                subtitle="pública"
                                accent="rgba(91,107,123,0.45)"
                                bg="rgba(91,107,123,0.04)"
                                icon={Globe}
                                iconColor="var(--text-secondary)"
                                subdued
                                done={downloaded.rsa_pub}
                                onDownload={() => downloadPem('rsa_pub', keys.rsa_pub, 'rsa_public')}
                              />
                            )}
                          </div>
                        </div>
                      )}

                      <label className="flex items-center gap-3 text-sm cursor-pointer p-3 rounded-lg"
                        style={{
                          background: confirmed ? 'rgba(0,168,112,0.08)' : 'var(--bg-tertiary)',
                          border: `1px solid ${confirmed ? 'rgba(0,168,112,0.4)' : 'var(--border-subtle)'}`,
                        }}>
                        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                        <span>Confirmo que descargué y guardé mis DOS llaves privadas (EC y RSA)</span>
                      </label>
                    </>
                  )}

                  <motion.button
                    disabled={keys && (keys.ec_priv || keys.rsa_priv) && !confirmed}
                    onClick={() => nav('/login')}
                    whileHover={(!keys || (!keys.ec_priv && !keys.rsa_priv) || confirmed) ? { scale: 1.02 } : undefined}
                    whileTap={(!keys || (!keys.ec_priv && !keys.rsa_priv) || confirmed) ? { scale: 0.98 } : undefined}
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

function KeyCard({ title, subtitle, accent, bg, icon: Icon, iconColor, done, onDownload, subdued }) {
  return (
    <button
      type="button"
      onClick={onDownload}
      className={`relative w-full text-left rounded-xl p-4 flex items-center gap-3 transition-all hover:translate-y-[-1px] hover:shadow-md ${subdued ? 'opacity-90' : ''}`}
      style={{ background: bg, border: `1px solid ${accent}` }}
    >
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'rgba(255,255,255,0.55)', border: `1px solid ${accent}` }}
      >
        <Icon size={20} style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm truncate">{title}</div>
        <div className="text-[11px] text-[color:var(--text-secondary)] truncate">{subtitle}</div>
      </div>
      <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-medium"
        style={{ color: done ? 'var(--emerald)' : iconColor }}>
        {done ? <><Check size={14}/> Descargada</> : <><Download size={14}/> .pem</>}
      </div>
    </button>
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
