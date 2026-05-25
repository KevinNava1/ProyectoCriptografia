import { useEffect, useState, lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  LogIn, AtSign, Lock, Wifi, WifiOff, ShieldCheck,
  ArrowRight, ArrowLeft, KeyRound,
} from 'lucide-react'
import { useShake } from '../hooks/useShake'
import Spinner from '../components/ui/Spinner'
// 3D / video → lazy: pesan ~600KB de three.js + assets de video. Se cargan
// asíncronos para no bloquear el render inicial.
const AuroraBackground = lazy(() => import('../components/3d/AuroraBackground'))
const VideoBackdrop    = lazy(() => import('../components/3d/VideoBackdrop'))
const MedicalVortex3D  = lazy(() => import('../components/3d/MedicalVortex3D'))
const Pill3DOrbit      = lazy(() => import('../components/3d/Pill3DOrbit'))
const MedicalScene     = lazy(() => import('../components/illustrations/MedicalScene'))
import ShieldLogo from '../components/3d/ShieldLogo'
import { DoctorLogo, PatientLogo, PharmacistLogo } from '../components/illustrations/RoleLogos'
import PageTransition from '../components/ui/PageTransition'
import HeartbeatLine from '../components/ui/HeartbeatLine'
import KeyFileInput from '../components/ui/KeyFileInput'
import { useAuthStore } from '../store/useAuthStore'
import { joinPemBundle, isEcPrivatePem, isRsaPrivatePem } from '../lib/utils'
import api, { usuariosAPI } from '../api'

// Imágenes 3D del set médico — una por paso del wizard.
import imgTeam from '../assets/login/team.png'         // paso 1: credenciales
import imgMachine from '../assets/login/machine.png'   // paso 2: llaves (cripto)

const AdminLogo = ({ size = 48, active }) => (
  <ShieldCheck
    size={size}
    style={{ color: active ? 'var(--blue-deep)' : 'var(--text-secondary)', opacity: active ? 1 : 0.85 }}
  />
)

const ROLES = [
  { id: 'medico',       label: 'Médico',       Logo: DoctorLogo },
  { id: 'paciente',     label: 'Paciente',     Logo: PatientLogo },
  { id: 'farmaceutico', label: 'Farmacéutico', Logo: PharmacistLogo },
  { id: 'admin',        label: 'Admin',        Logo: AdminLogo },
]

export default function Login() {
  const nav = useNavigate()
  const login = useAuthStore(s => s.login)
  const [form, setForm] = useState({
    username: '', password: '', rol: 'paciente',
    priv_ec: '', priv_rsa: '',
  })
  const [step, setStep] = useState(1)           // 1 = credenciales · 2 = llaves
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(null)
  const [shakeCls, shake] = useShake()

  useEffect(() => {
    let cancelled = false
    api.get('/').then(() => !cancelled && setOnline(true)).catch(() => !cancelled && setOnline(false))
    return () => { cancelled = true }
  }, [])

  const onChange = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const needsKeys = form.rol !== 'admin'
  const fail = (msg) => { shake(); toast.error(msg) }

  // Si el usuario cambia el rol a admin estando en paso 2, saltar al 1
  // (porque admin no requiere llaves).
  useEffect(() => {
    if (!needsKeys && step === 2) setStep(1)
  }, [needsKeys, step])

  const goNext = () => {
    if (!form.username || !form.password) return fail('Ingresa usuario y contraseña')
    if (needsKeys) {
      setStep(2)
    } else {
      submitLogin()
    }
  }

  const submitLogin = async () => {
    if (needsKeys) {
      if (!form.priv_ec || !form.priv_rsa) return fail('Sube tus DOS llaves: la ECDSA y la RSA')
      if (!isEcPrivatePem(form.priv_ec))   return fail('La llave EC no tiene formato válido')
      if (!isRsaPrivatePem(form.priv_rsa)) return fail('La llave RSA no tiene formato válido')
    }
    setBusy(true)
    try {
      const { data } = await usuariosAPI.login({
        username: form.username.trim(),
        password: form.password,
        rol: form.rol,
        llave_privada_ec:  needsKeys ? form.priv_ec  : null,
        llave_privada_rsa: needsKeys ? form.priv_rsa : null,
      })
      const bundle = needsKeys ? joinPemBundle(form.priv_ec, form.priv_rsa) : null
      login({
        id: data.id,
        username: data.username,
        nombre: data.nombre,
        email: data.email,
        rol: data.rol,
        token: data.token || null,
        llave_privada: bundle,
        llave_privada_ec: needsKeys ? form.priv_ec : null,
        llave_privada_rsa: needsKeys ? form.priv_rsa : null,
      })
      toast.success(`Bienvenido, ${data.nombre.split(' ')[0]}`)
      const to = data.rol === 'admin' ? '/admin/solicitudes' : '/dashboard'
      setTimeout(() => nav(to, { replace: true }), 350)
    } catch (err) {
      const msg = err?.response?.data?.detail || ''
      if (/verifica tu email/i.test(msg)) {
        usuariosAPI.reenviarVerificacion(null, form.username.trim()).catch(() => {})
        toast.warning('Revisa tu correo — te reenviamos el enlace de verificación')
      } else {
        shake()
        toast.error(err?.uiMessage || 'No se pudo iniciar sesión')
      }
    } finally { setBusy(false) }
  }

  const onSubmit = (e) => { e.preventDefault(); step === 1 ? goNext() : submitLogin() }

  return (
    <PageTransition>
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-8 px-4">
        {/* FONDO — intacto, como pediste */}
        <Suspense fallback={null}>
          <VideoBackdrop intensity="strong" />
          {/* AuroraBackground REMOVIDO: sus 3 "blobs" azules de 640px con
              mix-blend-mode:multiply pintaban toda la pantalla de azul. */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              // Anillos grandes (como te gustaron). SIN mix-blend-mode ni
              // filter saturate — eso pintaba la pantalla de azul.
              width: 'min(1500px, 140vw)',
              height: 'min(1200px, 110vh)',
            }}
            aria-hidden
          >
            <MedicalVortex3D />
          </div>
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ width: 'min(1100px, 110vw)', height: 'min(1100px, 96vh)' }}
            aria-hidden
          >
            <MedicalScene variant="stethoscope" />
            <Pill3DOrbit radius={330} duration={22} size={160} />
            <Pill3DOrbit radius={330} duration={22} size={130} delay={-11} />
          </div>
        </Suspense>

        {/* CARD ANCHO de 2 columnas (apila en móvil) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-5xl"
        >
          <div
            className={`relative overflow-hidden rounded-3xl ${shakeCls}`}
            style={{
              // Más transparente para que se vean los anillos del vortex y la
              // aurora detrás. Compensamos con un blur más fuerte y saturate
              // alto para que el contenido siga legible sin perder el efecto
              // "glass" — el fondo se siente, pero no compite con el texto.
              background: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(244,250,255,0.82) 100%)',
              border: '1px solid rgba(10,132,255,0.30)',
              backdropFilter: 'blur(26px) saturate(1.35)',
              WebkitBackdropFilter: 'blur(26px) saturate(1.35)',
              boxShadow: '0 30px 80px rgba(10,36,67,0.22), 0 1px 1px rgba(255,255,255,0.7) inset',
            }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[560px]">
              {/* COLUMNA IZQUIERDA — imagen 3D animada por paso.
                  En step 1 predomina el azul (acceso). En step 2 el verde
                  se intensifica (acción cripto: llaves verificadas).
                  Solo cambia la INTENSIDAD del degradado, no los colores. */}
              <div
                className="relative overflow-hidden hidden lg:flex flex-col items-center justify-center px-8"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(10,132,255,0.10) 0%, rgba(0,168,112,0.08) 50%, rgba(10,82,204,0.10) 100%)',
                  borderRight: '1px solid rgba(10,132,255,0.18)',
                }}
              >
                {/* Halo superior — azul siempre */}
                <div
                  aria-hidden
                  className="absolute pointer-events-none"
                  style={{
                    top: '-20%', left: '-15%', width: 380, height: 380,
                    background: 'radial-gradient(circle, rgba(10,132,255,0.30), transparent 65%)',
                    filter: 'blur(40px)',
                  }}
                />
                {/* Halo inferior — verde que se INTENSIFICA en step 2. */}
                <div
                  aria-hidden
                  className="absolute pointer-events-none"
                  style={{
                    bottom: '-20%', right: '-15%', width: 360, height: 360,
                    background: 'radial-gradient(circle, rgba(0,168,112,0.22), transparent 65%)',
                    filter: 'blur(40px)',
                  }}
                />

                {/* Imagen 3D — cambia con el paso, flota y rota sutilmente */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, scale: 0.85, rotateY: step === 2 ? 90 : -90 }}
                    animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                    exit={{ opacity: 0, scale: 0.85, rotateY: step === 2 ? -90 : 90 }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="relative z-10"
                    style={{ transformStyle: 'preserve-3d', perspective: 1400 }}
                  >
                    <motion.img
                      src={step === 1 ? imgTeam : imgMachine}
                      alt={step === 1 ? 'Equipo médico' : 'Máquina cripto'}
                      className="select-none pointer-events-none"
                      draggable={false}
                      style={{
                        maxWidth: '100%',
                        width: 'min(420px, 100%)',
                        height: 'auto',
                        filter: 'drop-shadow(0 28px 38px rgba(10,36,67,0.28))',
                      }}
                      animate={{
                        y: [0, -14, 0],
                        rotate: [0, 1.5, 0, -1.5, 0],
                      }}
                      transition={{
                        duration: 6,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                  </motion.div>
                </AnimatePresence>

                {/* Texto descriptivo bajo la imagen */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`txt-${step}`}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.45, delay: 0.15 }}
                    className="relative z-10 mt-6 text-center"
                  >
                    {step === 1 ? (
                      <>
                        <h2
                          className="font-heading text-3xl"
                          style={{ color: 'var(--blue-deep)', letterSpacing: '-0.02em' }}
                        >
                          Tu equipo de salud
                        </h2>
                        <p
                          className="text-sm mt-2 max-w-sm mx-auto"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Recetas firmadas cripto­gráficamente entre médicos, farmacias y pacientes.
                        </p>
                      </>
                    ) : (
                      <>
                        <h2
                          className="font-heading text-3xl"
                          style={{ color: 'var(--blue-deep)', letterSpacing: '-0.02em' }}
                        >
                          Acceso con tus llaves
                        </h2>
                        <p
                          className="text-sm mt-2 max-w-sm mx-auto"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Tu llave privada nunca sale del navegador: viaja por TLS solo para esta sesión.
                        </p>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Stepper visual */}
                <div className="relative z-10 mt-7 flex items-center gap-3">
                  <StepDot active={step === 1} done={step > 1} label="1" />
                  <div
                    className="h-[2px] w-12 rounded-full"
                    style={{
                      background:
                        step > 1
                          ? 'linear-gradient(90deg, #0A84FF, #00A870)'
                          : 'rgba(10,132,255,0.20)',
                    }}
                  />
                  <StepDot active={step === 2} done={false} label="2" />
                </div>
              </div>

              {/* COLUMNA DERECHA — formulario */}
              <div className="p-6 sm:p-9 lg:p-10 flex flex-col">
                <div className="flex items-center gap-3 mb-7">
                  <ShieldLogo size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="label-xs">SecureRx</div>
                    <h1 className="font-heading text-3xl" style={{ letterSpacing: '-0.02em' }}>
                      Acceso seguro
                    </h1>
                  </div>
                  <ConnectionBadge online={online} />
                </div>

                <form onSubmit={onSubmit} className="flex-1 flex flex-col">
                  <AnimatePresence mode="wait">
                    {step === 1 && (
                      <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: -24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -32 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="space-y-5"
                      >
                        <div>
                          <div className="label-md mb-2.5" style={{ fontSize: 13 }}>Rol</div>
                          <div className="grid grid-cols-4 gap-2">
                            {ROLES.map(r => {
                              const active = form.rol === r.id
                              const Logo = r.Logo
                              return (
                                <motion.button
                                  key={r.id}
                                  type="button"
                                  whileHover={{ y: -3, scale: 1.02 }}
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => onChange('rol', r.id)}
                                  className="relative p-2.5 rounded-xl border text-xs flex flex-col items-center gap-1.5 transition-colors"
                                  style={{
                                    background: active ? 'rgba(10,132,255,0.10)' : 'var(--bg-tertiary)',
                                    borderColor: active ? 'rgba(10,132,255,0.60)' : 'var(--border-subtle)',
                                    color: active ? 'var(--blue-deep)' : 'var(--text-secondary)',
                                    fontWeight: active ? 600 : 500,
                                    boxShadow: active ? '0 6px 18px rgba(10,132,255,0.18)' : undefined,
                                  }}
                                >
                                  <Logo size={42} active={active} />
                                  {r.label}
                                </motion.button>
                              )
                            })}
                          </div>
                        </div>

                        <BigField label="Usuario" icon={<AtSign size={16} />}>
                          <input
                            value={form.username}
                            onChange={e => onChange('username', e.target.value)}
                            className="input-field input-lg pl-11"
                            placeholder={form.rol === 'admin' ? 'admin' : 'ana.perez'}
                            autoComplete="username"
                            spellCheck={false}
                          />
                        </BigField>

                        <BigField label="Contraseña" icon={<Lock size={16} />}>
                          <input
                            type="password"
                            value={form.password}
                            onChange={e => onChange('password', e.target.value)}
                            className="input-field input-lg pl-11"
                            placeholder="••••••••"
                            autoComplete="current-password"
                          />
                        </BigField>

                        <motion.button
                          type="submit"
                          disabled={busy || online === false}
                          whileHover={!busy ? { scale: 1.02 } : undefined}
                          whileTap={!busy ? { scale: 0.98 } : undefined}
                          className="btn btn-primary w-full"
                          style={{ height: 52, fontSize: 15, fontWeight: 600 }}
                        >
                          {needsKeys ? (
                            <>
                              Siguiente <ArrowRight size={18} />
                            </>
                          ) : busy ? (
                            <>
                              <Spinner size={16} /> Iniciando…
                            </>
                          ) : (
                            <>
                              <LogIn size={18} /> Iniciar sesión
                            </>
                          )}
                        </motion.button>
                      </motion.div>
                    )}

                    {step === 2 && (
                      <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 32 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="space-y-5"
                      >
                        <div
                          className="flex items-center gap-3 p-3.5 rounded-xl"
                          style={{
                            background: 'rgba(10,132,255,0.07)',
                            border: '1px solid rgba(10,132,255,0.28)',
                          }}
                        >
                          <KeyRound size={22} className="text-[color:var(--cyan)] shrink-0" />
                          <div className="text-xs leading-relaxed">
                            <strong style={{ color: 'var(--blue-deep)' }}>Hola @{form.username || '…'}.</strong>{' '}
                            Carga tus dos llaves privadas para completar el acceso.
                          </div>
                        </div>

                        <KeyFileInput
                          kind="ec"
                          value={form.priv_ec}
                          onChange={(v) => onChange('priv_ec', v)}
                        />
                        <KeyFileInput
                          kind="rsa"
                          value={form.priv_rsa}
                          onChange={(v) => onChange('priv_rsa', v)}
                        />
                        <p className="text-xs leading-relaxed text-[color:var(--text-secondary)]">
                          Viajan cifradas por TLS solo para esta operación. Nunca se almacenan en el servidor.
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                          <motion.button
                            type="button"
                            onClick={() => setStep(1)}
                            whileHover={{ x: -2 }}
                            whileTap={{ scale: 0.97 }}
                            disabled={busy}
                            className="btn btn-ghost"
                            style={{ height: 52, fontSize: 14 }}
                          >
                            <ArrowLeft size={16} /> Atrás
                          </motion.button>
                          <motion.button
                            type="submit"
                            disabled={busy || online === false}
                            whileHover={!busy ? { scale: 1.02 } : undefined}
                            whileTap={!busy ? { scale: 0.98 } : undefined}
                            className="btn btn-primary"
                            style={{ height: 52, fontSize: 15, fontWeight: 600 }}
                          >
                            {busy ? <Spinner size={16} /> : <LogIn size={18} />}
                            {busy ? 'Iniciando…' : 'Iniciar sesión'}
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>

                <div className="mt-7 pt-5 border-t border-[var(--border-subtle)] text-center text-xs text-[color:var(--text-secondary)] space-y-2">
                  <div>
                    ¿Nuevo?{' '}
                    <Link to="/registro" className="text-[color:var(--cyan)] hover:underline font-medium">Crea una cuenta</Link>
                  </div>
                  <div>
                    <Link to="/recuperar-password" className="text-[color:var(--text-secondary)] hover:underline">
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="absolute left-1/2 -translate-x-1/2 bottom-4 z-10 flex flex-col items-center gap-1.5"
        >
          <HeartbeatLine
            width={320}
            height={48}
            className="sm:!w-[360px] sm:!h-[52px]"
          />
          <div className="text-[10px] font-mono tracking-wider uppercase text-[color:var(--text-secondary)] opacity-80">
            Señal segura · latencia mínima
          </div>
        </motion.div>
      </div>
    </PageTransition>
  )
}

function BigField({ label, icon, children }) {
  return (
    <div>
      <div
        className="mb-2.5 font-bold uppercase tracking-wide"
        style={{ fontSize: 14, color: 'var(--blue-deep)', letterSpacing: '0.08em' }}
      >
        {label}
      </div>
      <div className="relative">
        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-[color:var(--text-secondary)]">
          {icon}
        </div>
        {children}
      </div>
    </div>
  )
}

function StepDot({ active, done, label }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold transition-all"
      style={{
        background: done
          ? 'linear-gradient(135deg, #00A870, #00775A)'
          : active
            ? 'linear-gradient(135deg, #0A84FF, #0052CC)'
            : 'rgba(255,255,255,0.65)',
        color: (active || done) ? '#fff' : 'var(--text-secondary)',
        border: '1px solid rgba(10,132,255,0.30)',
        boxShadow: active || done ? '0 6px 16px rgba(10,132,255,0.30)' : undefined,
      }}
    >
      {done ? '✓' : label}
    </div>
  )
}

function ConnectionBadge({ online }) {
  if (online === null) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium shrink-0"
        style={{ background: 'rgba(91,107,123,0.08)', border: '1px solid rgba(91,107,123,0.25)', color: 'var(--text-secondary)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--text-secondary)] animate-pulse" /> Conectando
      </span>
    )
  }
  if (online) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium shrink-0"
        style={{ background: 'rgba(0,168,112,0.1)', border: '1px solid rgba(0,168,112,0.4)', color: '#00775A' }}>
        <Wifi size={11}/> Online
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium shrink-0"
      style={{ background: 'rgba(180,35,24,0.08)', border: '1px solid rgba(180,35,24,0.35)', color: '#B42318' }}>
      <WifiOff size={11}/> Offline
    </span>
  )
}

// Estilos extra para inputs grandes — agregados inline ya que el design system
// solo tiene `input-field` mediano.
const STYLES = `
.input-lg {
  font-size: 15px !important;
  padding-top: 14px !important;
  padding-bottom: 14px !important;
}
`
if (typeof document !== 'undefined' && !document.getElementById('login-extra-styles')) {
  const tag = document.createElement('style')
  tag.id = 'login-extra-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}
