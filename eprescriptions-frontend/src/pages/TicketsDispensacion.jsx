import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Stamp, RefreshCcw, Pill, User, Stethoscope, Calendar, ShieldCheck,
  Hourglass, Check, ChevronRight, ArrowLeft, FileSignature,
} from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import SecureCard from '../components/ui/SecureCard'
import StatusChip from '../components/ui/StatusChip'
import LoadingPulse from '../components/ui/LoadingPulse'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import SessionKeyPicker, { validateKeysBundle } from '../components/ui/SessionKeyPicker'
import { useAuthStore } from '../store/useAuthStore'
import { dispensacionTicketsAPI, recetasAPI } from '../api'
import { formatDate } from '../lib/utils'

/**
 * Acuses / Dispensaciones — drill-down receta → dispensaciones.
 *  Nivel 1: lista de recetas (paciente: las suyas; médico: las que emitió;
 *           farmacéutico: las que dispensó).
 *  Nivel 2: dispensaciones de la receta seleccionada.
 *  Sign modal (solo paciente) sobre la dispensación que escoja.
 */
export default function TicketsDispensacion() {
  const user = useAuthStore(s => s.user)
  const role = user?.rol

  const [recetas, setRecetas] = useState([])
  const [pendingByReceta, setPendingByReceta] = useState({})
  const [loadingRec, setLoadingRec] = useState(true)
  const [errorRec, setErrorRec] = useState(null)

  const [selected, setSelected] = useState(null)
  const [eventos, setEventos] = useState([])
  const [loadingEv, setLoadingEv] = useState(false)
  const [errorEv, setErrorEv] = useState(null)

  const [signFor, setSignFor] = useState(null)
  const [version, setVersion] = useState(0)

  // Carga el listado de recetas según el rol.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingRec(true); setErrorRec(null)
      try {
        const fetcher =
          role === 'paciente'    ? recetasAPI.porPaciente(user.id) :
          role === 'medico'      ? recetasAPI.porMedico(user.id) :
          role === 'farmaceutico'? recetasAPI.porFarmaceutico(user.id) :
          Promise.resolve({ data: [] })
        const { data } = await fetcher
        if (cancelled) return
        // El médico solo ve aquí recetas con al menos 1 dispensación (si no,
        // duplica "Mis emitidas"). Paciente ve todas porque puede tener
        // recetas sin dispensar aún. Farmacéutico ya viene filtrado por su
        // ID via porFarmaceutico.
        const visibles = role === 'medico'
          ? (data || []).filter(r => (r.dispensaciones_realizadas || 0) > 0)
          : (data || [])
        setRecetas(visibles)
        // Para el paciente, además contamos cuántos acuses pendientes tiene
        // por receta para poder mostrar el badge en el listado.
        if (role === 'paciente') {
          try {
            const { data: pend } = await dispensacionTicketsAPI.pendientes()
            const map = {}
            for (const ev of (pend || [])) {
              map[ev.receta_id] = (map[ev.receta_id] || 0) + 1
            }
            setPendingByReceta(map)
          } catch { /* opcional */ }
        }
      } catch (err) {
        if (!cancelled) setErrorRec(err?.uiMessage || 'No se pudieron cargar las recetas')
      } finally { if (!cancelled) setLoadingRec(false) }
    }
    load()
    return () => { cancelled = true }
  }, [role, user?.id, version])

  // Cuando se selecciona una receta, cargamos sus dispensaciones.
  const pickReceta = async (r) => {
    setSelected(r); setEventos([]); setErrorEv(null); setLoadingEv(true)
    try {
      const { data } = await dispensacionTicketsAPI.porReceta(r.id)
      setEventos(data || [])
    } catch (err) {
      setErrorEv(err?.uiMessage || 'No se pudieron cargar las dispensaciones')
    } finally { setLoadingEv(false) }
  }

  const back = () => { setSelected(null); setEventos([]); setErrorEv(null) }

  const stats = useMemo(() => {
    const totalRec = recetas.length
    const pendTotal = role === 'paciente'
      ? Object.values(pendingByReceta).reduce((a, b) => a + b, 0)
      : 0
    return { totalRec, pendTotal }
  }, [recetas, pendingByReceta, role])

  const headerTitle = role === 'paciente' ? 'Acuses de dispensación'
                    : role === 'medico'   ? 'Dispensaciones de tus recetas'
                    : 'Tus dispensaciones'

  const headerSubtitle = role === 'paciente'
    ? 'Selecciona una receta para ver sus dispensaciones y firmar el acuse de las que falten. Hasta que firmes, la farmacia NO puede volver a dispensar.'
    : role === 'medico'
    ? 'Selecciona una receta para ver el detalle de cada dispensación que se hizo de ella.'
    : 'Selecciona una receta para ver las dispensaciones que tu farmacia hizo sobre ella.'

  return (
    <PageTransition>
      <div className="space-y-6">
        <header className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="label-xs flex items-center gap-1.5">
              <Stamp size={11} className="text-[color:var(--cyan)]" />
              {role === 'paciente' ? 'Paciente' : role === 'medico' ? 'Médico' : 'Farmacéutico'} · @{user?.username}
            </div>
            <h1 className="font-heading text-3xl md:text-4xl mt-2 flex items-center gap-3">
              <Stamp className="text-[color:var(--cyan)]" /> {headerTitle}
            </h1>
            <p className="text-[color:var(--text-secondary)] mt-2 text-sm max-w-2xl">
              {headerSubtitle}
            </p>
          </div>
          <button type="button" onClick={() => setVersion(v => v + 1)} className="btn btn-ghost btn-sm">
            <RefreshCcw size={14}/> Refrescar
          </button>
        </header>

        {/* KPIs solo en nivel 1 */}
        {!selected && (
          <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Kpi label="Recetas" value={stats.totalRec} accent="#0A84FF" />
            {role === 'paciente' && (
              <Kpi label="Acuses pendientes" value={stats.pendTotal} accent="#E08700" />
            )}
          </section>
        )}

        {/* Breadcrumb */}
        {selected && (
          <Breadcrumb receta={selected} onRoot={back} />
        )}

        {/* Nivel 1 — lista de recetas */}
        {!selected && (
          <RecetasGrid
            recetas={recetas}
            loading={loadingRec}
            error={errorRec}
            pendingByReceta={pendingByReceta}
            role={role}
            onPick={pickReceta}
          />
        )}

        {/* Nivel 2 — dispensaciones de la receta */}
        {selected && (
          <DispensacionesList
            receta={selected}
            eventos={eventos}
            loading={loadingEv}
            error={errorEv}
            role={role}
            user={user}
            onSign={(ev) => setSignFor(ev)}
            onBack={back}
          />
        )}
      </div>

      <SignTicketModal
        ticket={signFor}
        onClose={() => setSignFor(null)}
        onDone={() => {
          setSignFor(null)
          setVersion(v => v + 1)
          if (selected) pickReceta(selected)
        }}
      />
    </PageTransition>
  )
}

function Breadcrumb({ receta, onRoot }) {
  return (
    <nav className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)] flex-wrap">
      <button type="button" onClick={onRoot} className="hover:text-[color:var(--cyan)] transition-colors">
        Recetas
      </button>
      <ChevronRight size={12} />
      <span className="font-semibold text-[color:var(--blue-deep)]">
        Receta #{receta.id}{receta.medicamento && receta.medicamento !== '(cifrado)' ? ` · ${receta.medicamento}` : ''}
      </span>
    </nav>
  )
}

function Kpi({ label, value, accent }) {
  return (
    <SecureCard className="relative overflow-hidden min-h-[100px] flex flex-col justify-between">
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-50 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accent}33, transparent 70%)` }} />
      <div className="label-xs">{label}</div>
      <div className="font-heading text-3xl mt-2" style={{ color: accent }}>{value}</div>
    </SecureCard>
  )
}

function RecetasGrid({ recetas, loading, error, pendingByReceta, role, onPick }) {
  if (loading) return <LoadingPulse rows={3} />
  if (error)   return <EmptyState title="Error" message={error} />
  if (recetas.length === 0) {
    return (
      <EmptyState
        title={role === 'paciente' ? 'Sin recetas a tu nombre' : role === 'medico' ? 'Sin recetas emitidas' : 'Sin recetas dispensadas'}
        message={role === 'paciente'
          ? 'Cuando un médico emita una receta a tu nombre y la farmacia la dispense, aparecerá aquí para que firmes el acuse.'
          : role === 'medico'
          ? 'Aún no has emitido recetas que se hayan dispensado.'
          : 'Aún no has dispensado recetas.'}
      />
    )
  }
  return (
    <section className="grid gap-3">
      <div className="label-xs">Selecciona una receta</div>
      {recetas.map((r, i) => {
        const pendCount = role === 'paciente' ? (pendingByReceta[r.id] || 0) : 0
        const realizadas = r.dispensaciones_realizadas ?? 0
        const permitidas = r.dispensaciones_permitidas ?? 0
        const empty = realizadas === 0
        return (
          <motion.button
            key={r.id}
            type="button"
            onClick={() => onPick(r)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            className="w-full text-left rounded-2xl overflow-hidden group"
            style={{
              background: 'var(--card-bg)',
              border: pendCount > 0 ? '1px solid rgba(224,135,0,0.55)' : '1px solid var(--card-border)',
              backdropFilter: 'blur(14px) saturate(1.1)',
              boxShadow: pendCount > 0
                ? '0 6px 22px rgba(224,135,0,0.15)'
                : '0 2px 8px rgba(10,36,67,0.06)',
            }}
          >
            <div className="flex items-center gap-3 p-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.35)' }}>
                <Pill size={18} className="text-[color:var(--cyan)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-heading text-[15px] truncate">
                    {r.medicamento && r.medicamento !== '(cifrado)' ? r.medicamento : `Receta #${r.id}`}
                  </div>
                  <StatusChip estado={r.estado} />
                  {pendCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: 'rgba(224,135,0,0.10)', border: '1px solid rgba(224,135,0,0.40)', color: '#9A6700' }}>
                      <Hourglass size={10}/> {pendCount} acuse{pendCount > 1 ? 's' : ''} por firmar
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[color:var(--text-secondary)] flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  <span>#{r.id}</span>
                  {r.fecha && <span><Calendar size={10} className="inline mr-1"/>{formatDate(r.fecha)}</span>}
                  {r.medico_username   && <span>dr.@{r.medico_username}</span>}
                  {r.paciente_username && role !== 'paciente' && <span>pac @{r.paciente_username}</span>}
                  <span className={empty ? '' : 'font-semibold text-[color:var(--blue-deep)]'}>
                    · {realizadas}/{permitidas} dispensadas
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-[color:var(--text-secondary)] group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>
        )
      })}
    </section>
  )
}

function DispensacionesList({ receta, eventos, loading, error, role, user, onSign, onBack }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="label-xs">Dispensaciones de la receta #{receta.id}</div>
        <button type="button" onClick={onBack} className="btn btn-ghost btn-sm">
          <ArrowLeft size={13}/> Volver a recetas
        </button>
      </div>

      {loading && <LoadingPulse rows={2} />}
      {!loading && error && <EmptyState title="Error" message={error} />}
      {!loading && !error && eventos.length === 0 && (
        <EmptyState
          title="Aún no hay dispensaciones"
          message={role === 'farmaceutico'
            ? 'Cuando dispenses esta receta, aparecerá aquí.'
            : 'Esta receta todavía no ha sido dispensada por ninguna farmacia.'}
        />
      )}

      {!loading && !error && eventos.map((ev, i) => (
        <motion.div
          key={ev.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          <EventoCard ev={ev} role={role} user={user} onSign={onSign} />
        </motion.div>
      ))}
    </section>
  )
}

function EventoCard({ ev, role, user, onSign }) {
  // Etiqueta del estado role-aware (el "tu firma" solo aplica al paciente).
  const meta = ev.estado === 'completo'
    ? { label: 'Acuse firmado', color: '#00775A', bg: 'rgba(0,168,112,0.10)' }
    : role === 'paciente'
    ? { label: 'Pendiente de tu firma',     color: '#E08700', bg: 'rgba(224,135,0,0.10)' }
    : { label: 'Pendiente del paciente',    color: '#E08700', bg: 'rgba(224,135,0,0.10)' }

  const canSign = role === 'paciente'
    && ev.estado === 'pendiente_paciente'
    && ev.paciente_id === user.id

  return (
    <SecureCard className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.32)' }}>
          <Stamp className="text-[color:var(--cyan)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-heading text-lg">Dispensación #{ev.numero_dispensacion}</div>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider"
              style={{ background: meta.bg, border: `1px solid ${meta.color}55`, color: meta.color }}>
              {meta.label}
            </span>
          </div>
          <div className="text-xs text-[color:var(--text-secondary)] flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            <span className="flex items-center gap-1"><Stamp size={11}/> farm @{ev.farmaceutico_username || ev.farmaceutico_id}</span>
            {ev.medico_username && <span className="flex items-center gap-1"><Stethoscope size={11}/> dr.@{ev.medico_username}</span>}
            {ev.paciente_username && <span className="flex items-center gap-1"><User size={11}/> pac @{ev.paciente_username}</span>}
            <span className="flex items-center gap-1"><Calendar size={11}/> {formatDate(ev.timestamp)}</span>
            {ev.fecha_firma_paciente && (
              <span className="flex items-center gap-1 text-[color:var(--emerald)]">
                <Check size={11}/> firmado {formatDate(ev.fecha_firma_paciente)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 text-[10px]">
            <FirmaDot label="farmacéutico" ok={!!ev.firma_farmaceutico} />
            <FirmaDot label="paciente" ok={!!ev.firma_paciente} />
          </div>
        </div>
      </div>
      <div className="shrink-0">
        {canSign ? (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSign(ev)}
            className="btn btn-primary btn-sm"
          >
            <ShieldCheck size={14}/> Firmar acuse
          </motion.button>
        ) : (
          <span className="text-[11px] text-[color:var(--text-secondary)] italic">
            {ev.estado === 'completo'
              ? 'Acuse firmado'
              : role === 'paciente'
              ? 'Pendiente de tu firma'
              : 'Pendiente del paciente'}
          </span>
        )}
      </div>
    </SecureCard>
  )
}

function FirmaDot({ label, ok }) {
  return (
    <span className="inline-flex items-center gap-1"
      style={{ color: ok ? 'var(--emerald)' : 'var(--text-secondary)' }}>
      <span className="w-1.5 h-1.5 rounded-full"
        style={{ background: ok ? 'var(--emerald)' : 'rgba(91,107,123,0.45)' }} />
      {label}
    </span>
  )
}

function SignTicketModal({ ticket, onClose, onDone }) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (!ticket) { setKey(''); setBusy(false) } }, [ticket])

  const submit = async () => {
    const v = validateKeysBundle(key, ['ec'])
    if (!v.ok) return toast.error(v.reason)
    setBusy(true)
    try {
      await dispensacionTicketsAPI.firmarPaciente(ticket.id, { llave_privada: key })
      toast.success(`Acuse firmado · dispensación #${ticket.numero_dispensacion} confirmada`)
      onDone()
    } catch (err) {
      toast.error(err?.uiMessage || 'No se pudo firmar el acuse')
    } finally { setBusy(false) }
  }

  return (
    <Modal open={!!ticket} onClose={busy ? () => {} : onClose}
      title={ticket ? `Firmar acuse de dispensación #${ticket.numero_dispensacion}` : ''}>
      {ticket && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg text-xs leading-relaxed"
            style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.30)' }}>
            La farmacia <strong>@{ticket.farmaceutico_username}</strong> firmó la dispensación
            <strong> #{ticket.numero_dispensacion}</strong> de la receta <strong>#{ticket.receta_id}</strong>
            {' '}el {formatDate(ticket.timestamp)}. Tu firma sobre el mismo manifiesto canónico
            confirma que recibiste el medicamento (acuse no-repudiable). Hasta firmar, la
            farmacia NO puede volver a dispensar.
          </div>

          <SessionKeyPicker requires={['ec']} value={key} onChange={setKey} />

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
              <ShieldCheck size={14}/> {busy ? 'Firmando…' : 'Firmar con ECDSA P-256 + SHA3-256'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
