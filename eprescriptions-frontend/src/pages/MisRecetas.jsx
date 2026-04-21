import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Filter, Pill } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import RxCard3D from '../components/ui/RxCard3D'
import LoadingPulse from '../components/ui/LoadingPulse'
import EmptyState from '../components/ui/EmptyState'
import { useAuthStore } from '../store/useAuthStore'
import { recetasAPI } from '../api'

const FILTERS = [
  { id: 'all',        label: 'Todas'      },
  { id: 'emitida',    label: 'Emitidas'   },
  { id: 'dispensada', label: 'Dispensadas'},
]

const container = { animate: { transition: { staggerChildren: 0.07 } } }
const item = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

export default function MisRecetas() {
  const user = useAuthStore(s => s.user)
  const [recetas, setRecetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await recetasAPI.porPaciente(user.id)
        if (!cancelled) setRecetas(data || [])
      } catch (err) {
        if (!cancelled) setError(err?.uiMessage || 'No se pudieron cargar las recetas')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const filtered = useMemo(() => {
    if (filter === 'all') return recetas
    return recetas.filter(r => r.estado === filter)
  }, [recetas, filter])

  return (
    <PageTransition>
      <div className="space-y-6">
        <header className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="label-xs">Paciente</div>
            <h1 className="font-heading text-3xl md:text-4xl mt-2 flex items-center gap-3">
              <Pill className="text-[color:var(--cyan)]" /> Mis recetas
            </h1>
            <p className="text-[color:var(--text-secondary)] text-sm mt-2 max-w-xl">
              Toca "Ver firma" en cada receta para mostrar el hash SHA-256 y la firma ECDSA del médico.
            </p>
          </div>
          <div className="flex items-center gap-1 glass rounded-xl p-1 self-start sm:self-auto">
            <Filter size={14} className="text-[color:var(--text-secondary)] ml-2" />
            {FILTERS.map(f => {
              const active = filter === f.id
              return (
                <motion.button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  whileTap={{ scale: 0.97 }}
                  className="relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ color: active ? '#FFFFFF' : 'var(--text-secondary)' }}
                >
                  {active && (
                    <motion.span
                      layoutId="mis-recetas-filter"
                      className="absolute inset-0 rounded-lg"
                      style={{ background: 'linear-gradient(135deg,#0A84FF,#0052CC)', boxShadow: '0 4px 14px rgba(10,132,255,0.32)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{f.label}</span>
                </motion.button>
              )
            })}
          </div>
        </header>

        {loading && <LoadingPulse rows={4} />}
        {!loading && error && <EmptyState title="Error" message={error} />}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            title={filter === 'all' ? 'Sin recetas todavía' : 'Ninguna coincide con el filtro'}
            message="Cuando un médico te emita una receta, aparecerá aquí cifrada con AES-256-GCM."
          />
        )}

        {!loading && !error && filtered.length > 0 && (
          <motion.div
            variants={container}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          >
            {filtered.map(r => (
              <motion.div key={r.id} variants={item}>
                <RxCard3D receta={r} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </PageTransition>
  )
}
