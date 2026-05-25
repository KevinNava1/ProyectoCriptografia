import { motion } from 'framer-motion'

/**
 * PageHero — header animado y consistente para cada página del proyecto.
 *
 * Resuelve el "cada página se ve simple y desconectada" centralizando un
 * patrón visual reusable: icono 3D flotante a la derecha, título grande,
 * subtítulo breve, gradiente sutil y acciones opcionales.
 *
 * Props:
 *   eyebrow  — texto pequeño arriba (ej. "Paciente", "Médico · @user")
 *   title    — título grande (ej. "Mis recetas")
 *   subtitle — descripción breve (1 línea)
 *   icon     — icono Lucide para el cuadrito de la izquierda
 *   iconImg  — opcional: imagen 3D PNG (sobrescribe el icono Lucide)
 *   accent   — color base ('#0A84FF' default)
 *   children — acciones opcionales (botones, badges) en la derecha
 */
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  iconImg,
  accent = '#0A84FF',
  children,
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl p-5 sm:p-7"
      style={{
        background: `linear-gradient(135deg, ${accent}14 0%, ${accent}06 60%, transparent 100%)`,
        border: `1px solid ${accent}33`,
        boxShadow: `0 8px 24px ${accent}14, 0 1px 1px rgba(255,255,255,0.55) inset`,
      }}
    >
      {/* Halo decorativo en la esquina superior derecha */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: '-30%', right: '-15%', width: 280, height: 280,
          background: `radial-gradient(circle, ${accent}30, transparent 65%)`,
          filter: 'blur(36px)',
        }}
      />

      <div className="relative flex items-start justify-between gap-5 flex-wrap">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          {/* Icono / imagen 3D */}
          {iconImg ? (
            <motion.div
              className="shrink-0"
              style={{ width: 72, height: 72 }}
              animate={{ y: [0, -6, 0], rotate: [0, 2.5, 0, -2.5, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <img
                src={iconImg}
                alt=""
                draggable={false}
                className="w-full h-full object-contain"
                style={{
                  filter: `drop-shadow(0 10px 18px ${accent}55) drop-shadow(0 3px 6px rgba(10,36,67,0.20))`,
                }}
              />
            </motion.div>
          ) : Icon ? (
            <motion.div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${accent}25 0%, ${accent}10 100%)`,
                border: `1px solid ${accent}55`,
                boxShadow: `0 6px 16px ${accent}25`,
              }}
              whileHover={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 0.5 }}
            >
              <Icon size={24} style={{ color: accent }} />
            </motion.div>
          ) : null}

          <div className="min-w-0 flex-1">
            {eyebrow && <div className="label-xs">{eyebrow}</div>}
            {/* Mismas clases que tenían los headers antes — el usuario no
                quiere fuente "Syne grande": usamos la tipografía heading
                base del proyecto, sin overrides. */}
            <h1 className="font-heading text-3xl md:text-4xl mt-2">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[color:var(--text-secondary)] text-sm mt-2 max-w-xl">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {children && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {children}
          </div>
        )}
      </div>
    </motion.header>
  )
}
