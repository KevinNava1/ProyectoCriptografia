import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  KeyRound, ShieldCheck, ShieldAlert, Pill, Stethoscope, Stamp,
  Copy, Check, FileKey2, ChevronRight, Fingerprint, Calendar,
  Hourglass, ArrowLeft, User,
} from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import SecureCard from '../components/ui/SecureCard'
import StatusChip from '../components/ui/StatusChip'
import EmptyState from '../components/ui/EmptyState'
import LoadingPulse from '../components/ui/LoadingPulse'
import { useAuthStore } from '../store/useAuthStore'
import { recetasAPI, dispensacionTicketsAPI } from '../api'
import { formatDate } from '../lib/utils'

/**
 * Verificar — drill-down en 3 niveles:
 *  1. Selecciona una receta (todas las del paciente).
 *  2. Lista las dispensaciones de esa receta (cada una pudo ser firmada
 *     por una farmacia distinta).
 *  3. Selecciona una dispensación → muestra la verificación criptográfica
 *     específica: firma del médico (sobre R), firma del farmacéutico que
 *     dispensó (sobre el sello), acuse del paciente (sobre el mismo sello).
 */
export default function Verificar() {
  const user = useAuthStore(s => s.user)
  const [recetas, setRecetas] = useState([])
  const [loadingRec, setLoadingRec] = useState(true)
  const [selectedReceta, setSelectedReceta] = useState(null)
  const [eventos, setEventos] = useState([])
  const [loadingEv, setLoadingEv] = useState(false)
  const [selectedEv, setSelectedEv] = useState(null)
  const [verif, setVerif] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | running | done | error

  useEffect(() => {
    (async () => {
      try {
        const { data } = await recetasAPI.porPaciente(user.id)
        setRecetas(data || [])
      } catch (err) {
        toast.error(err?.uiMessage || 'No se pudieron cargar tus recetas')
      } finally { setLoadingRec(false) }
    })()
  }, [user.id])

  const pickReceta = async (r) => {
    setSelectedReceta(r); setSelectedEv(null); setVerif(null); setPhase('idle')
    setLoadingEv(true); setEventos([])
    try {
      const { data } = await dispensacionTicketsAPI.porReceta(r.id)
      setEventos(data || [])
    } catch (err) {
      toast.error(err?.uiMessage || 'No se pudieron cargar las dispensaciones')
    } finally { setLoadingEv(false) }
  }

  const pickEvento = async (ev) => {
    setSelectedEv(ev); setVerif(null); setPhase('running')
    try {
      const [{ data }] = await Promise.all([
        dispensacionTicketsAPI.verificar(ev.id),
        new Promise(res => setTimeout(res, 900)),
      ])
      setVerif(data); setPhase('done')
    } catch (err) {
      toast.error(err?.uiMessage || 'No se pudo verificar la dispensación')
      setPhase('error')
    }
  }

  const back = () => {
    setSelectedReceta(null); setSelectedEv(null); setVerif(null)
    setEventos([]); setPhase('idle')
  }
  const backFromEv = () => { setSelectedEv(null); setVerif(null); setPhase('idle') }

  return (
    <PageTransition>
      <div className="space-y-6">
        <header>
          <div className="label-xs">Paciente · @{user?.username}</div>
          <h1 className="font-heading text-3xl md:text-4xl mt-2 flex items-center gap-3">
            <KeyRound className="text-[color:var(--cyan)]" /> Verificar firmas
          </h1>
          <p className="text-[color:var(--text-secondary)] text-sm mt-2 max-w-2xl">
            La verificación es <strong className="mx-1 text-[color:var(--blue-deep)]">por dispensación</strong>,
            no por receta. Cada entrega pudo ser firmada por una farmacia distinta. Selecciona
            una receta, luego la dispensación que quieres validar.
          </p>
        </header>

        <Breadcrumb
          receta={selectedReceta}
          evento={selectedEv}
          onRoot={back}
          onReceta={() => { setSelectedEv(null); setVerif(null); setPhase('idle') }}
        />

        {/* Nivel 1 — selección de receta */}
        {!selectedReceta && (
          <RecetasGrid recetas={recetas} loading={loadingRec} onPick={pickReceta} />
        )}

        {/* Nivel 2 — lista de dispensaciones de la receta */}
        {selectedReceta && !selectedEv && (
          <EventosList
            receta={selectedReceta}
            eventos={eventos}
            loading={loadingEv}
            onPick={pickEvento}
            onBack={back}
          />
        )}

        {/* Nivel 3 — resultado de verificación */}
        {selectedEv && (
          <VerificacionPanel
            receta={selectedReceta}
            evento={selectedEv}
            verif={verif}
            phase={phase}
            onBack={backFromEv}
          />
        )}
      </div>
    </PageTransition>
  )
}

function Breadcrumb({ receta, evento, onRoot, onReceta }) {
  return (
    <nav className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)] flex-wrap">
      <button type="button" onClick={onRoot}
        className={`hover:text-[color:var(--cyan)] transition-colors ${!receta ? 'font-semibold text-[color:var(--blue-deep)]' : ''}`}>
        Mis recetas
      </button>
      {receta && (
        <>
          <ChevronRight size={12} />
          <button type="button" onClick={onReceta}
            className={`hover:text-[color:var(--cyan)] transition-colors ${!evento ? 'font-semibold text-[color:var(--blue-deep)]' : ''}`}>
            Receta #{receta.id} · {receta.medicamento}
          </button>
        </>
      )}
      {evento && (
        <>
          <ChevronRight size={12} />
          <span className="font-semibold text-[color:var(--blue-deep)]">
            Dispensación #{evento.numero_dispensacion}
          </span>
        </>
      )}
    </nav>
  )
}

function RecetasGrid({ recetas, loading, onPick }) {
  if (loading) return <LoadingPulse rows={3} />
  if (recetas.length === 0) return <EmptyState title="Sin recetas" message="Todavía no tienes recetas emitidas a tu nombre." />
  return (
    <section className="grid gap-3">
      <div className="label-xs">Selecciona una receta</div>
      {recetas.map((r, i) => (
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
            border: '1px solid var(--card-border)',
            backdropFilter: 'blur(14px) saturate(1.1)',
            boxShadow: '0 2px 8px rgba(10,36,67,0.06)',
          }}
        >
          <div className="flex items-center gap-3 p-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.35)' }}>
              <Pill size={18} className="text-[color:var(--cyan)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-heading text-[15px] truncate">{r.medicamento}</div>
                <StatusChip estado={r.estado} />
              </div>
              <div className="text-[11px] text-[color:var(--text-secondary)] flex gap-3 mt-1 flex-wrap">
                <span>#{r.id}</span>
                <span>{formatDate(r.fecha)}</span>
                <span>dr.@{r.medico_username}</span>
                <span>· {r.dispensaciones_realizadas}/{r.dispensaciones_permitidas} dispensaciones</span>
              </div>
            </div>
            <ChevronRight size={16} className="shrink-0 text-[color:var(--text-secondary)] group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>
      ))}
    </section>
  )
}

function EventosList({ receta, eventos, loading, onPick, onBack }) {
  if (loading) return <LoadingPulse rows={2} />
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="label-xs">Dispensaciones de la receta #{receta.id}</div>
        <button type="button" onClick={onBack} className="btn btn-ghost btn-sm">
          <ArrowLeft size={13}/> Volver
        </button>
      </div>
      {eventos.length === 0 && (
        <EmptyState title="Aún no hay dispensaciones"
          message="Esta receta no ha sido dispensada todavía. Cuando la farmacia entregue el medicamento, aparecerá aquí." />
      )}
      {eventos.map((ev, i) => (
        <motion.button
          key={ev.id}
          type="button"
          onClick={() => onPick(ev)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          className="w-full text-left rounded-2xl overflow-hidden group"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            boxShadow: '0 2px 8px rgba(10,36,67,0.06)',
          }}
        >
          <div className="flex items-center gap-3 p-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.35)' }}>
              <Stamp size={18} className="text-[color:var(--cyan)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-heading text-[15px]">Dispensación #{ev.numero_dispensacion}</div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider"
                  style={ev.estado === 'completo'
                    ? { background: 'rgba(0,168,112,0.10)', border: '1px solid rgba(0,168,112,0.40)', color: '#00775A' }
                    : { background: 'rgba(224,135,0,0.10)', border: '1px solid rgba(224,135,0,0.40)', color: '#9A6700' }}>
                  {ev.estado === 'completo' ? <Check size={10}/> : <Hourglass size={10}/>}
                  {ev.estado === 'completo' ? 'Acuse firmado' : 'Acuse pendiente'}
                </span>
              </div>
              <div className="text-[11px] text-[color:var(--text-secondary)] flex gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1"><Stamp size={11}/> farm @{ev.farmaceutico_username}</span>
                <span className="flex items-center gap-1"><Calendar size={11}/> {formatDate(ev.timestamp)}</span>
              </div>
            </div>
            <ChevronRight size={16} className="shrink-0 text-[color:var(--text-secondary)] group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>
      ))}
    </section>
  )
}

function VerificacionPanel({ receta, evento, verif, phase, onBack }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="label-xs">
          Verificación · receta #{receta.id} · dispensación #{evento.numero_dispensacion}
        </div>
        <button type="button" onClick={onBack} className="btn btn-ghost btn-sm">
          <ArrowLeft size={13}/> Otra dispensación
        </button>
      </div>

      <SecureCard>
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="label-xs">Receta #{receta.id}</div>
            <div className="font-heading text-xl mt-1">{receta.medicamento}</div>
            <div className="text-[12px] text-[color:var(--text-secondary)] mt-0.5">
              {receta.dosis} · x{receta.cantidad} · emitida {formatDate(receta.fecha)}
            </div>
          </div>
          <StatusChip estado={receta.estado} />
        </header>
      </SecureCard>

      {phase === 'running' && (
        <SecureCard className="text-center py-10">
          <Fingerprint className="mx-auto text-[color:var(--cyan)] animate-pulse" size={32} />
          <div className="mt-3 font-heading">Verificando ECDSA P-256 + SHA3-256…</div>
          <div className="text-xs text-[color:var(--text-secondary)] mt-1">
            Recomputando firmas con las llaves públicas registradas.
          </div>
        </SecureCard>
      )}

      {phase === 'done' && verif && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <ResumenBanner verif={verif} />

            <SignerCard
              role="Médico que emitió la receta"
              Icon={Stethoscope}
              data={verif.medico}
              hint="La firma ECDSA del médico es sobre R (cifrado); la coherencia se valida vía AAD del AES-GCM."
            />
            <SignerCard
              role={`Farmacéutico que dispensó (entrega #${evento.numero_dispensacion})`}
              Icon={Stamp}
              data={verif.farmaceutico}
              hint="Firma ECDSA P-256 + SHA3-256 sobre el manifiesto de sello de ESTA dispensación específica."
            />
            <SignerCard
              role="Acuse del paciente"
              Icon={User}
              data={verif.paciente}
              hint="Tu firma sobre el mismo manifiesto del sello — sirve como acuse no-repudiable de recepción."
              optional
            />
          </motion.div>
        </AnimatePresence>
      )}
    </section>
  )
}

function ResumenBanner({ verif }) {
  const allOk = verif.cifrado_aes_gcm
    && verif.medico?.firma_valida
    && verif.farmaceutico?.firma_valida
    && (verif.paciente?.firma_valida == null || verif.paciente.firma_valida === true)

  const tone = allOk
    ? { b: 'rgba(0,168,112,0.45)', bg: 'rgba(0,168,112,0.10)', c: '#007A55', Icon: ShieldCheck,
        title: 'Cadena criptográfica íntegra',
        msg: 'AES-256-GCM autentica el cifrado y las firmas ECDSA P-256 + SHA3-256 validan al médico y al farmacéutico que dispensó. El acuse del paciente (si existe) está firmado correctamente.' }
    : { b: 'rgba(180,35,24,0.42)', bg: 'rgba(180,35,24,0.08)', c: '#B42318', Icon: ShieldAlert,
        title: 'Hay una verificación fallida',
        msg: 'Alguna comprobación (AES-GCM o una firma ECDSA) no pasó. Revisa los detalles de cada firmante a continuación.' }

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className="p-4 rounded-2xl"
      style={{ border: `1px solid ${tone.b}`, background: tone.bg }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${tone.c}14`, border: `1px solid ${tone.b}` }}>
          <tone.Icon size={20} style={{ color: tone.c }} />
        </div>
        <div className="min-w-0">
          <div className="font-heading text-base" style={{ color: tone.c }}>{tone.title}</div>
          <div className="text-[13px] text-[color:var(--text-secondary)] mt-0.5">{tone.msg}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3.5 pl-1">
        <Chip label="AES-256-GCM" ok={!!verif.cifrado_aes_gcm} />
        <Chip label="ECDSA médico" ok={!!verif.medico?.firma_valida} />
        <Chip label="ECDSA farmacéutico" ok={!!verif.farmaceutico?.firma_valida} />
        {verif.paciente?.firma_valida != null && (
          <Chip label="Acuse paciente" ok={!!verif.paciente.firma_valida} />
        )}
      </div>
    </motion.div>
  )
}

function Chip({ label, ok }) {
  const c = ok
    ? { b: 'rgba(0,168,112,0.45)', bg: 'rgba(0,168,112,0.10)', fg: '#007A55' }
    : { b: 'rgba(180,35,24,0.42)', bg: 'rgba(180,35,24,0.08)', fg: '#B42318' }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium"
      style={{ border: `1px solid ${c.b}`, background: c.bg, color: c.fg }}>
      {ok ? <ShieldCheck size={11}/> : <ShieldAlert size={11}/>}
      {label}
      <span>· {ok ? 'OK' : 'FAIL'}</span>
    </span>
  )
}

function SignerCard({ role, Icon, data, hint, optional }) {
  const [copied, setCopied] = useState(false)
  if (!data) return null
  const ok = data.firma_valida
  const isPending = optional && data.firma == null
  const tone = isPending
    ? 'rgba(91,107,123,0.30)'
    : ok ? 'rgba(0,168,112,0.38)' : 'rgba(180,35,24,0.38)'
  const copy = async () => {
    await navigator.clipboard.writeText(data.llave_publica || '')
    setCopied(true); setTimeout(() => setCopied(false), 1400)
  }
  return (
    <SecureCard>
      <header className="flex items-center gap-3 flex-wrap">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.35)' }}>
          <Icon size={18} className="text-[color:var(--cyan)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="label-xs">{role}</div>
          <div className="font-heading text-base mt-0.5 truncate">{data.nombre}</div>
          <div className="text-[11px] font-mono text-[color:var(--text-secondary)]">@{data.username}</div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0"
          style={{
            background: isPending ? 'rgba(91,107,123,0.08)' : ok ? 'rgba(0,168,112,0.10)' : 'rgba(180,35,24,0.08)',
            border: `1px solid ${tone}`,
            color: isPending ? 'var(--text-secondary)' : ok ? '#007A55' : '#B42318',
          }}>
          {isPending ? <Hourglass size={12}/> : ok ? <ShieldCheck size={12}/> : <ShieldAlert size={12}/>}
          {isPending ? 'Pendiente' : ok ? 'Firma válida' : 'Firma inválida'}
        </span>
      </header>

      {hint && (
        <p className="text-[11px] text-[color:var(--text-secondary)] mt-3 leading-relaxed">{hint}</p>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="label-xs">Llave pública (PEM)</div>
          <button type="button" onClick={copy}
            className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md hover:bg-[rgba(10,132,255,0.08)] transition-colors text-[color:var(--cyan)]">
            {copied ? <Check size={12}/> : <Copy size={12}/>} {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <pre className="text-[10.5px] font-mono p-3 rounded-xl overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto"
          style={{ background: 'rgba(10,25,48,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
          {data.llave_publica}
        </pre>
      </div>
    </SecureCard>
  )
}
