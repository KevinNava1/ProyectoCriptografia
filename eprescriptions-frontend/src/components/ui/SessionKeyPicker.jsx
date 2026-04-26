import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Upload, Undo2, KeyRound } from 'lucide-react'
import KeyFileInput from './KeyFileInput'
import { useAuthStore } from '../../store/useAuthStore'
import { joinPemBundle, splitPemBundle, isEcPrivatePem, isRsaPrivatePem } from '../../lib/utils'

/**
 * Selector de llave privada que reusa por default la llave cargada en la sesión
 * (al hacer login) y solo pide subir un .pem si el usuario opta explícitamente
 * por usar otra. Evita el patrón "pegar PEM en cada formulario".
 *
 * Props:
 *   requires:  array con los tipos requeridos. ['ec'] | ['rsa'] | ['ec','rsa'].
 *   value:     string controlado externamente (PEM o bundle EC+RSA).
 *   onChange:  fn(string) — se llama con la llave actual a usar.
 */
export default function SessionKeyPicker({ requires = ['ec'], value, onChange }) {
  const user = useAuthStore(s => s.user)

  // Llave de sesión que aplica para los tipos requeridos.
  const sessionEc  = user?.llave_privada_ec  || ''
  const sessionRsa = user?.llave_privada_rsa || ''
  const sessionDefault = (() => {
    if (requires.length === 1 && requires[0] === 'ec')  return sessionEc
    if (requires.length === 1 && requires[0] === 'rsa') return sessionRsa
    if (requires.includes('ec') && requires.includes('rsa')) return joinPemBundle(sessionEc, sessionRsa)
    return ''
  })()
  const sessionAvailable = !!sessionDefault &&
    (!requires.includes('ec')  || !!sessionEc) &&
    (!requires.includes('rsa') || !!sessionRsa)

  const [mode, setMode] = useState(sessionAvailable ? 'session' : 'upload')
  // Buffers individuales del modo upload.
  const [upEc, setUpEc] = useState('')
  const [upRsa, setUpRsa] = useState('')

  // En modo sesión, mantenemos value sincronizado con la llave del store.
  useEffect(() => {
    if (mode === 'session') {
      if (value !== sessionDefault) onChange?.(sessionDefault)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sessionDefault])

  // En modo upload, value = bundle/único de los uploads.
  useEffect(() => {
    if (mode !== 'upload') return
    let v = ''
    if (requires.includes('ec') && requires.includes('rsa')) {
      v = joinPemBundle(upEc, upRsa)
    } else if (requires[0] === 'ec') {
      v = upEc
    } else if (requires[0] === 'rsa') {
      v = upRsa
    }
    if (v !== value) onChange?.(v)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, upEc, upRsa])

  const labelTipos = requires
    .map(t => t === 'ec' ? 'ECDSA' : 'RSA-OAEP')
    .join(' + ')

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {mode === 'session' && sessionAvailable && (
          <motion.div
            key="session"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(0,168,112,0.08)', border: '1px solid rgba(0,168,112,0.40)' }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(0,168,112,0.12)', border: '1px solid rgba(0,168,112,0.45)' }}
            >
              <ShieldCheck size={18} className="text-[color:var(--emerald)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Usando tu llave de la sesión</div>
              <div className="text-[11px] text-[color:var(--text-secondary)] mt-0.5">
                {labelTipos} cargadas al iniciar sesión. No tienes que volver a subirlas.
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setMode('upload'); setUpEc(''); setUpRsa('') }}
              className="btn btn-ghost btn-sm shrink-0"
            >
              <Upload size={12}/> Usar otra
            </button>
          </motion.div>
        )}

        {mode === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="label-xs flex items-center gap-1.5">
                <KeyRound size={12} className="text-[color:var(--cyan)]" />
                Sube tu(s) llave(s) {labelTipos} para esta operación
              </div>
              {sessionAvailable && (
                <button
                  type="button"
                  onClick={() => setMode('session')}
                  className="btn btn-ghost btn-sm"
                >
                  <Undo2 size={12}/> Volver a la del login
                </button>
              )}
            </div>
            {requires.includes('ec') && (
              <KeyFileInput kind="ec" value={upEc} onChange={setUpEc} />
            )}
            {requires.includes('rsa') && (
              <KeyFileInput kind="rsa" value={upRsa} onChange={setUpRsa} />
            )}
            <p className="text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
              La llave viaja cifrada por TLS al backend solo para esta operación. Nunca se almacena
              en el servidor.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Helper externo para validar antes de submit (sin desempacar el componente).
// Separa el bundle en bloques por tipo y valida cada uno por su cuenta — la
// heurística de tipo no funciona sobre el bundle entero porque mezcla largos.
export function validateKeysBundle(bundle, requires) {
  if (!bundle) return { ok: false, reason: 'Falta la llave privada' }
  // Una sola llave: la validación directa basta.
  if (requires.length === 1) {
    if (requires[0] === 'ec'  && !isEcPrivatePem(bundle))  return { ok: false, reason: 'La llave EC no tiene formato válido' }
    if (requires[0] === 'rsa' && !isRsaPrivatePem(bundle)) return { ok: false, reason: 'La llave RSA no tiene formato válido' }
    return { ok: true }
  }
  // Bundle con varias: separar y validar cada parte.
  const parts = splitPemBundle(bundle)
  if (requires.includes('ec')  && !parts.ec)  return { ok: false, reason: 'Falta la llave EC en el bundle' }
  if (requires.includes('rsa') && !parts.rsa) return { ok: false, reason: 'Falta la llave RSA en el bundle' }
  if (requires.includes('ec')  && !isEcPrivatePem(parts.ec))  return { ok: false, reason: 'La llave EC no tiene formato válido' }
  if (requires.includes('rsa') && !isRsaPrivatePem(parts.rsa)) return { ok: false, reason: 'La llave RSA no tiene formato válido' }
  return { ok: true }
}
