import { useEffect, useState, lazy, Suspense } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
const AuroraBackground = lazy(() => import('../components/3d/AuroraBackground'))
const VideoBackdrop    = lazy(() => import('../components/3d/VideoBackdrop'))
import ShieldLogo from '../components/3d/ShieldLogo'
import PageTransition from '../components/ui/PageTransition'
import { usuariosAPI } from '../api'

export default function VerificarEmail() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [estado, setEstado] = useState('cargando') // cargando | ok | error
  const [msg, setMsg]       = useState('')

  useEffect(() => {
    if (!token) { setEstado('error'); setMsg('No se encontró el token en el enlace.'); return }
    usuariosAPI.verificarEmail(token)
      .then(({ data }) => { setEstado('ok'); setMsg(`¡Hola ${data.username}! Tu email fue verificado.`) })
      .catch(err => { setEstado('error'); setMsg(err?.uiMessage || 'El enlace es inválido o ya fue usado.') })
  }, [token])

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
          <div className="secure-card p-6 sm:p-8 text-center">
            <div className="flex justify-center mb-5">
              <ShieldLogo size={56} />
            </div>

            {estado === 'cargando' && (
              <>
                <Loader size={40} className="mx-auto animate-spin text-[color:var(--cyan)] mb-4" />
                <p className="text-[color:var(--text-secondary)] text-sm">Verificando tu email…</p>
              </>
            )}

            {estado === 'ok' && (
              <>
                <CheckCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--emerald)' }} />
                <h1 className="font-heading text-2xl mb-2">Email verificado</h1>
                <p className="text-[color:var(--text-secondary)] text-sm mb-6">{msg}</p>
                <Link to="/login" className="btn btn-primary btn-lg w-full inline-flex justify-center">
                  Ir al login
                </Link>
              </>
            )}

            {estado === 'error' && (
              <>
                <XCircle size={48} className="mx-auto mb-4" style={{ color: '#B42318' }} />
                <h1 className="font-heading text-2xl mb-2">Enlace inválido</h1>
                <p className="text-[color:var(--text-secondary)] text-sm mb-6">{msg}</p>
                <Link to="/login" className="btn btn-primary btn-lg w-full inline-flex justify-center">
                  Volver al login
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </PageTransition>
  )
}
