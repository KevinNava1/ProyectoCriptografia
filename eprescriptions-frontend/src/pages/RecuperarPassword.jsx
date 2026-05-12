import { useState, lazy, Suspense } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Mail, Lock, ArrowRight, CheckCircle } from 'lucide-react'
const AuroraBackground = lazy(() => import('../components/3d/AuroraBackground'))
const VideoBackdrop    = lazy(() => import('../components/3d/VideoBackdrop'))
import ShieldLogo from '../components/3d/ShieldLogo'
import PageTransition from '../components/ui/PageTransition'
import Spinner from '../components/ui/Spinner'
import { useShake } from '../hooks/useShake'
import { usuariosAPI } from '../api'

export default function RecuperarPassword() {
  const [params] = useSearchParams()
  const token    = params.get('token')

  return token ? <ResetForm token={token} /> : <SolicitarForm />
}

function SolicitarForm() {
  const [email, setEmail] = useState('')
  const [busy,  setBusy]  = useState(false)
  const [sent,  setSent]  = useState(false)
  const [shakeCls, shake] = useShake()

  const submit = async (e) => {
    e.preventDefault()
    if (!email) { shake(); return toast.error('Ingresa tu email') }
    setBusy(true)
    try {
      await usuariosAPI.recuperarPassword(email)
      setSent(true)
    } catch {
      shake()
      toast.error('No se pudo enviar el correo')
    } finally { setBusy(false) }
  }

  return (
    <PageTransition>
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4">
        <Suspense fallback={null}>
          <VideoBackdrop intensity="soft" />
          <AuroraBackground variant="subtle" />
        </Suspense>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className={`secure-card p-6 sm:p-8 ${shakeCls}`}>
            <div className="flex items-center gap-3 mb-7">
              <ShieldLogo size={48} />
              <div>
                <div className="label-xs">SecureRx</div>
                <h1 className="font-heading text-2xl">Recuperar contraseña</h1>
              </div>
            </div>

            {sent ? (
              <div className="text-center space-y-4">
                <CheckCircle size={48} className="mx-auto" style={{ color: 'var(--emerald)' }} />
                <p className="text-sm text-[color:var(--text-secondary)]">
                  Si ese email está registrado, recibirás un enlace para restablecer tu contraseña.
                  Revisa tu bandeja de entrada (y el spam).
                </p>
                <Link to="/login" className="btn btn-primary w-full inline-flex justify-center">
                  Volver al login
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <p className="text-sm text-[color:var(--text-secondary)]">
                  Ingresa tu email y te enviaremos un enlace para crear una nueva contraseña.
                </p>
                <div>
                  <div className="label-xs mb-1.5">Email</div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[color:var(--text-secondary)]">
                      <Mail size={14} />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="input-field pl-9"
                      placeholder="tu@email.com"
                      autoComplete="email"
                    />
                  </div>
                </div>
                <motion.button
                  type="submit"
                  disabled={busy}
                  whileHover={!busy ? { scale: 1.02 } : undefined}
                  whileTap={!busy ? { scale: 0.98 } : undefined}
                  className="btn btn-primary btn-lg w-full"
                >
                  {busy ? <Spinner size={16} /> : null}
                  {busy ? 'Enviando…' : 'Enviar enlace'}
                  {!busy && <ArrowRight size={16} />}
                </motion.button>
                <div className="text-center text-xs text-[color:var(--text-secondary)]">
                  <Link to="/login" className="hover:underline">Volver al login</Link>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </PageTransition>
  )
}

function ResetForm({ token }) {
  const nav = useNavigate()
  const [pw,      setPw]      = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy,    setBusy]    = useState(false)
  const [shakeCls, shake] = useShake()

  const submit = async (e) => {
    e.preventDefault()
    if (pw.length < 6) { shake(); return toast.error('La contraseña debe tener al menos 6 caracteres') }
    if (pw !== confirm) { shake(); return toast.error('Las contraseñas no coinciden') }
    setBusy(true)
    try {
      await usuariosAPI.resetPassword(token, pw)
      toast.success('Contraseña actualizada. Inicia sesión.')
      setTimeout(() => nav('/login', { replace: true }), 1200)
    } catch (err) {
      shake()
      toast.error(err?.uiMessage || 'El enlace es inválido o ha expirado')
    } finally { setBusy(false) }
  }

  return (
    <PageTransition>
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4">
        <Suspense fallback={null}>
          <VideoBackdrop intensity="soft" />
          <AuroraBackground variant="subtle" />
        </Suspense>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className={`secure-card p-6 sm:p-8 ${shakeCls}`}>
            <div className="flex items-center gap-3 mb-7">
              <ShieldLogo size={48} />
              <div>
                <div className="label-xs">SecureRx</div>
                <h1 className="font-heading text-2xl">Nueva contraseña</h1>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <div className="label-xs mb-1.5">Nueva contraseña</div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[color:var(--text-secondary)]">
                    <Lock size={14} />
                  </div>
                  <input
                    type="password"
                    value={pw}
                    onChange={e => setPw(e.target.value)}
                    className="input-field pl-9"
                    placeholder="Mín. 6 caracteres"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div>
                <div className="label-xs mb-1.5">Confirmar contraseña</div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[color:var(--text-secondary)]">
                    <Lock size={14} />
                  </div>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="input-field pl-9"
                    placeholder="Repite la contraseña"
                    autoComplete="new-password"
                    style={confirm && confirm !== pw
                      ? { borderColor: 'rgba(180,35,24,0.6)' }
                      : confirm && confirm === pw
                        ? { borderColor: 'rgba(0,168,112,0.6)' }
                        : {}
                    }
                  />
                </div>
              </div>
              <motion.button
                type="submit"
                disabled={busy}
                whileHover={!busy ? { scale: 1.02 } : undefined}
                whileTap={!busy ? { scale: 0.98 } : undefined}
                className="btn btn-primary btn-lg w-full"
              >
                {busy ? <Spinner size={16} /> : null}
                {busy ? 'Guardando…' : 'Guardar contraseña'}
                {!busy && <ArrowRight size={16} />}
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  )
}
