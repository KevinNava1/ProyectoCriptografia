import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { LogIn, AtSign, Lock, Wifi, WifiOff, ShieldCheck } from 'lucide-react'
import AuroraBackground from '../components/3d/AuroraBackground'
import VideoBackdrop from '../components/3d/VideoBackdrop'
import MedicalVortex3D from '../components/3d/MedicalVortex3D'
import Pill3DOrbit from '../components/3d/Pill3DOrbit'
import ShieldLogo from '../components/3d/ShieldLogo'
import MedicalScene from '../components/illustrations/MedicalScene'
import { DoctorLogo, PatientLogo, PharmacistLogo } from '../components/illustrations/RoleLogos'
import PageTransition from '../components/ui/PageTransition'
import HeartbeatLine from '../components/ui/HeartbeatLine'
import KeyFileInput from '../components/ui/KeyFileInput'
import { useAuthStore } from '../store/useAuthStore'
import { joinPemBundle, isEcPrivatePem, isRsaPrivatePem } from '../lib/utils'
import api, { usuariosAPI } from '../api'

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
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.get('/').then(() => !cancelled && setOnline(true)).catch(() => !cancelled && setOnline(false))
    return () => { cancelled = true }
  }, [])

  const onChange = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const needsKeys = form.rol !== 'admin'

  const submit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) return toast.error('Ingresa usuario y contraseña')
    if (needsKeys) {
      if (!form.priv_ec || !form.priv_rsa) {
        return toast.error('Sube tus DOS llaves: la ECDSA y la RSA')
      }
      if (!isEcPrivatePem(form.priv_ec))   return toast.error('La llave EC no tiene formato válido')
      if (!isRsaPrivatePem(form.priv_rsa)) return toast.error('La llave RSA no tiene formato válido')
    }
    setBusy(true)
    try {
      const { data } = await usuariosAPI.login({
        username: form.username.trim(),
        password: form.password,
        rol: form.rol,
        // Para no-admin: el backend deriva la pub desde cada priv y la compara
        // con la pub registrada. Si no coincide, rechaza el login (no JWT).
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
        // Bundle se sigue mandando al backend en X-Priv-Keys; las dos partes
        // por separado quedan disponibles para vistas que las necesiten.
        llave_privada: bundle,
        llave_privada_ec: needsKeys ? form.priv_ec : null,
        llave_privada_rsa: needsKeys ? form.priv_rsa : null,
      })
      toast.success(`Bienvenido, ${data.nombre.split(' ')[0]}`)
      const to = data.rol === 'admin' ? '/admin/solicitudes' : '/dashboard'
      setTimeout(() => nav(to, { replace: true }), 350)
    } catch (err) {
      toast.error(err?.uiMessage || 'No se pudo iniciar sesión')
    } finally { setBusy(false) }
  }

  return (
    <PageTransition>
      <div className="relative min-h-screen flex items-start sm:items-center justify-center overflow-hidden pt-6 pb-36 sm:pt-10 sm:pb-32 px-4">
        <VideoBackdrop intensity="soft" />
        <AuroraBackground variant="subtle" />

        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ width: 'min(1100px, 110vw)', height: 'min(900px, 100vh)' }}
          aria-hidden
        >
          <MedicalVortex3D />
        </div>

        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ width: 'min(860px, 96vw)', height: 'min(860px, 88vh)' }}
          aria-hidden
        >
          <MedicalScene variant="stethoscope" />
          <Pill3DOrbit radius={270} duration={22} size={140} />
          <Pill3DOrbit radius={270} duration={22} size={110} delay={-11} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="secure-card p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-7">
              <ShieldLogo size={48} />
              <div className="flex-1 min-w-0">
                <div className="label-xs">SecureRx</div>
                <h1 className="font-heading text-2xl">Acceso seguro</h1>
              </div>
              <ConnectionBadge online={online} />
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <div className="label-xs mb-2">Rol</div>
                <div className="grid grid-cols-4 gap-2">
                  {ROLES.map(r => {
                    const active = form.rol === r.id
                    const Logo = r.Logo
                    return (
                      <motion.button
                        key={r.id}
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onChange('rol', r.id)}
                        className="relative p-2.5 rounded-xl border text-[11px] flex flex-col items-center gap-1.5 transition-colors"
                        style={{
                          background: active ? 'rgba(10,132,255,0.08)' : 'var(--bg-tertiary)',
                          borderColor: active ? 'rgba(10,132,255,0.55)' : 'var(--border-subtle)',
                          color: active ? 'var(--blue-deep)' : 'var(--text-secondary)',
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        <Logo size={40} active={active} />
                        {r.label}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              <Field label="Usuario">
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[color:var(--text-secondary)]">
                    <AtSign size={14} />
                  </div>
                  <input
                    value={form.username}
                    onChange={e => onChange('username', e.target.value)}
                    className="input-field pl-9"
                    placeholder={form.rol === 'admin' ? 'admin' : 'ana.perez'}
                    autoComplete="username"
                    spellCheck={false}
                  />
                </div>
              </Field>

              <Field label="Contraseña">
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[color:var(--text-secondary)]">
                    <Lock size={14} />
                  </div>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => onChange('password', e.target.value)}
                    className="input-field pl-9"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
              </Field>

              <AnimatePresence initial={false}>
                {needsKeys && (
                  <motion.div
                    key="keys"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                    style={{ overflow: 'hidden' }}
                  >
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
                    <p className="text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
                      Tus dos llaves viajan cifradas por TLS al backend solo para esta operación.
                      Nunca se almacenan en el servidor.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={busy || online === false}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn btn-primary btn-lg w-full"
              >
                <LogIn size={16} />
                {busy ? 'Iniciando…' : 'Iniciar sesión'}
              </motion.button>
            </form>

            <div className="mt-6 pt-5 border-t border-[var(--border-subtle)] text-center text-xs text-[color:var(--text-secondary)]">
              ¿Nuevo?{' '}
              <Link to="/registro" className="text-[color:var(--cyan)] hover:underline font-medium">Crea una cuenta</Link>
            </div>
          </div>

        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="absolute left-1/2 -translate-x-1/2 bottom-6 sm:bottom-10 z-10 flex flex-col items-center gap-1.5"
        >
          <HeartbeatLine
            width={320}
            height={56}
            className="sm:!w-[360px] sm:!h-[60px]"
          />
          <div className="text-[10px] font-mono tracking-wider uppercase text-[color:var(--text-secondary)] opacity-80">
            Señal segura · latencia mínima
          </div>
        </motion.div>
      </div>
    </PageTransition>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div className="label-xs mb-1.5">{label}</div>
      {children}
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
