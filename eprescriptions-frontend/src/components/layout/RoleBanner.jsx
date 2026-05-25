import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import roleCardBg from '../../assets/role-card-bg.png'

// Banner horizontal que vive debajo del header, en TODAS las páginas
// (excepto rutas públicas como /login, /registro). Usa la imagen TARJETA
// (caduceo + SECURERX) como fondo y muestra un saludo dinámico según rol.

const HIDDEN_ON = ['/login', '/registro', '/verificar-email', '/recuperar-password']

const ROLES = {
  paciente:     { saludo: 'Hola',        sufijo: '',                accent: '#0A84FF' },
  medico:       { saludo: 'Hola, Dr.',   sufijo: '',                accent: '#0A84FF' },
  farmaceutico: { saludo: 'Hola',        sufijo: '· Farmacia',      accent: '#00A870' },
  admin:        { saludo: 'Hola, Admin', sufijo: '',                accent: '#0052CC' },
}

const LABEL_ROL = {
  paciente:     'Paciente',
  medico:       'Médico',
  farmaceutico: 'Farmacéutico',
  admin:        'Administrador',
}

export default function RoleBanner() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!user) return null
  if (HIDDEN_ON.includes(location.pathname)) return null

  const r = ROLES[user.rol] || ROLES.paciente
  const rolLabel = LABEL_ROL[user.rol] || user.rol
  const firstName = (user.nombre || '').split(' ')[0] || user.username

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl mb-5"
      style={{
        backgroundImage: `url(${roleCardBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: 130,
        border: `1px solid ${r.accent}33`,
        boxShadow: `0 12px 28px ${r.accent}14, 0 1px 1px rgba(255,255,255,0.55) inset`,
      }}
    >
      {/* Velo sutil para legibilidad del texto sobre el fondo */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.0) 35%, rgba(255,255,255,0.0) 65%, rgba(255,255,255,0.25) 100%)',
        }}
      />

      {/* Texto principal — alineado a la derecha del caduceo (que vive en
          la imagen). En móvil se centra. */}
      <div className="relative h-full flex items-center justify-end px-5 sm:px-10 py-5">
        <div className="flex flex-col items-end text-right">
          <div
            className="font-mono font-semibold uppercase tracking-wider"
            style={{ fontSize: 11, color: r.accent, letterSpacing: '0.16em' }}
          >
            {rolLabel} {r.sufijo}
          </div>
          <h2
            className="font-heading mt-1"
            style={{
              fontSize: 'clamp(20px, 3vw, 26px)',
              lineHeight: 1.1,
              color: 'var(--blue-deep, #0B2443)',
              fontWeight: 800,
              letterSpacing: '-0.01em',
            }}
          >
            {r.saludo} {firstName}
          </h2>
          <div
            className="text-xs font-mono mt-1"
            style={{ color: 'var(--text-secondary, #5B6B7B)' }}
          >
            @{user.username}
          </div>
        </div>
      </div>
    </motion.section>
  )
}
