import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileSignature, ClipboardList, Pill, ShieldCheck, Sparkles, Activity, AtSign } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import SecureCard from '../components/ui/SecureCard'
import StatusChip from '../components/ui/StatusChip'
import AnimatedCounter from '../components/ui/AnimatedCounter'
import LoadingPulse from '../components/ui/LoadingPulse'
import EmptyState from '../components/ui/EmptyState'
import HeartbeatOrb3D from '../components/3d/HeartbeatOrb3D'
import { useAuthStore } from '../store/useAuthStore'
import { recetasAPI } from '../api'
import { formatDate } from '../lib/utils'

const container = { animate: { transition: { staggerChildren: 0.07 } } }
const item = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

export default function Dashboard() {
  const user = useAuthStore(s => s.user)
  const [recetas, setRecetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        let data = []
        if (user.rol === 'paciente') {
          const r = await recetasAPI.porPaciente(user.id)
          data = r.data || []
        } else if (user.rol === 'medico') {
          const r = await recetasAPI.porMedico(user.id)
          data = r.data || []
        } else if (user.rol === 'farmaceutico') {
          const [pend, dispensadas] = await Promise.all([
            recetasAPI.pendientes().catch(() => ({ data: [] })),
            recetasAPI.porFarmaceutico(user.id).catch(() => ({ data: [] })),
          ])
          const map = new Map()
          for (const r of [...(pend.data || []), ...(dispensadas.data || [])]) {
            map.set(r.id, r)
          }
          data = Array.from(map.values()).sort((a, b) => b.id - a.id)
        }
        if (!cancelled) setRecetas(data)
      } catch (err) {
        if (!cancelled) setError(err?.uiMessage || 'No se pudieron cargar los datos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const stats = useMemo(() => {
    const base = {
      total: recetas.length,
      emitidas: recetas.filter(r => r.estado === 'emitida').length,
      dispensadas: recetas.filter(r => r.estado === 'dispensada').length,
    }
    if (user?.rol === 'farmaceutico') {
      base.dispensadas_por_mi = recetas.filter(r => r.estado === 'dispensada' && r.farmaceutico_id === user.id).length
    }
    return base
  }, [recetas, user])

  const latest = recetas.slice(0, 5)
  const firstName = user?.nombre?.split(' ')[0] || 'Usuario'

  const kpi3 = user?.rol === 'farmaceutico'
    ? { label: 'Dispensadas por ti', value: stats.dispensadas_por_mi || 0, icon: Pill, accent: '#00A870' }
    : { label: 'Dispensadas', value: stats.dispensadas, icon: Pill, accent: '#00A870' }

  return (
    <PageTransition>
      <motion.div variants={container} initial="initial" animate="animate" className="space-y-8">
        <motion.header variants={item} className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="label-xs flex items-center gap-1.5">
              <AtSign size={11} className="opacity-70" />
              <span className="font-mono">{user?.username}</span>
              <span className="opacity-50">·</span>
              <span>Panel de control</span>
            </div>
            <h1 className="font-heading text-3xl md:text-4xl mt-2">Hola, {firstName}.</h1>
            <p className="text-[color:var(--text-secondary)] mt-2 text-sm max-w-xl">
              Resumen en tiempo real de tus recetas y el estado criptográfico del sistema.
            </p>
          </div>
          <QuickAction role={user?.rol} count={stats.emitidas} />
        </motion.header>

        <motion.section variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Kpi label="Total" value={stats.total} icon={FileSignature} accent="#0A84FF" />
          <Kpi label="Emitidas" value={stats.emitidas} icon={ClipboardList} accent="#E08700" />
          <Kpi {...kpi3} />
          <CryptoStatus />
        </motion.section>

        <motion.section variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-heading text-xl">Recetas recientes</h2>
              <span className="text-xs text-[color:var(--text-secondary)]">
                Mostrando {latest.length} · Vista {user?.rol}
              </span>
            </div>

            {loading && <LoadingPulse rows={3} />}
            {!loading && error && <EmptyState title="Error" message={error} />}
            {!loading && !error && latest.length === 0 && (
              <EmptyState title="Aún no hay recetas" message="Cuando haya movimiento aparecerá aquí." />
            )}
            {!loading && !error && latest.length > 0 && (
              <div className="grid gap-3">
                {latest.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <SecureCard className="flex items-center justify-between gap-4 flex-wrap md:flex-nowrap">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.32)' }}>
                          <Pill size={18} className="text-[color:var(--cyan)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate">{r.medicamento}</div>
                          <div className="text-xs text-[color:var(--text-secondary)] flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                            <span>{r.dosis}</span>
                            <span>·</span>
                            <span>@{r.paciente_username || `id${r.paciente_id}`}</span>
                            <span>·</span>
                            <span className="font-mono">dr.@{r.medico_username || `id${r.medico_id}`}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-[color:var(--text-secondary)] hidden lg:inline">
                          {formatDate(r.fecha)}
                        </span>
                        <StatusChip estado={r.estado} />
                      </div>
                    </SecureCard>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <SecureCard hover={false} className="relative overflow-hidden min-h-[320px] flex flex-col p-5">
            <div className="relative z-10">
              <div className="label-xs flex items-center gap-1.5"><Activity size={11}/> Salud del sistema</div>
              <div className="font-heading text-xl mt-2">Pulso criptográfico</div>
              <p className="text-xs text-[color:var(--text-secondary)] leading-relaxed mt-2">
                Validación continua de integridad SHA-256, firma ECDSA P-256 y cifrado AES-256-GCM.
              </p>
            </div>
            <div className="flex-1 relative min-h-[180px]">
              <HeartbeatOrb3D />
            </div>
            <div className="relative z-10 flex items-center gap-3 pt-3 border-t border-[var(--border-subtle)]">
              <span className="dot-pulse" style={{ width: 10, height: 10 }} />
              <div className="text-xs">
                <div className="font-semibold">Todos los protocolos OK</div>
                <div className="text-[color:var(--text-secondary)]">Última verificación: ahora</div>
              </div>
            </div>
          </SecureCard>
        </motion.section>
      </motion.div>
    </PageTransition>
  )
}

function Kpi({ label, value, icon: Icon, accent }) {
  return (
    <SecureCard className="relative overflow-hidden min-h-[124px] flex flex-col justify-between p-4 sm:p-5">
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-50 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accent}33, transparent 70%)` }}
      />
      <div className="flex items-start justify-between relative gap-3">
        <div className="label-xs">{label}</div>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${accent}18`, border: `1px solid ${accent}55` }}
        >
          <Icon size={16} style={{ color: accent }} />
        </div>
      </div>
      <div className="font-heading text-3xl sm:text-4xl mt-2" style={{ color: accent }}>
        <AnimatedCounter value={value} />
      </div>
    </SecureCard>
  )
}

function CryptoStatus() {
  return (
    <SecureCard className="relative overflow-hidden min-h-[124px] flex flex-col justify-between p-4 sm:p-5">
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 30% 30%, #00A870, transparent 60%)' }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 label-xs">
          <span className="dot-pulse" style={{ width: 8, height: 8 }} /> Criptografía
        </div>
      </div>
      <div className="relative">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-[color:var(--emerald)]" size={22} />
          <span className="font-heading text-base sm:text-lg">Sistema seguro</span>
        </div>
        <div className="text-[10px] text-[color:var(--text-secondary)] mt-1 tracking-wide">
          AES-256-GCM · ECDSA P-256 · SHA-256
        </div>
      </div>
    </SecureCard>
  )
}

function QuickAction({ role, count }) {
  if (role === 'medico') return (
    <Link to="/nueva-receta">
      <motion.span
        whileHover={{ scale: 1.04, boxShadow: '0 0 24px rgba(10,132,255,0.45)' }}
        whileTap={{ scale: 0.97 }}
        className="btn btn-primary btn-lg"
      >
        <Sparkles size={16}/> Emitir nueva receta
      </motion.span>
    </Link>
  )
  if (role === 'farmaceutico') return (
    <Link to="/pendientes">
      <motion.span whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="btn btn-primary btn-lg">
        <ClipboardList size={16}/> Ver pendientes
        {count > 0 && (
          <span
            className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: 'rgba(255,255,255,0.22)', color: '#FFFFFF' }}
          >
            {count}
          </span>
        )}
      </motion.span>
    </Link>
  )
  if (role === 'paciente') return (
    <Link to="/mis-recetas">
      <motion.span whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="btn btn-primary btn-lg">
        <Pill size={16}/> Mis recetas
      </motion.span>
    </Link>
  )
  return null
}
