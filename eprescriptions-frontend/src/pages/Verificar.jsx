import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  KeyRound, ShieldCheck, ShieldAlert, Pill, Stethoscope, Stamp,
  Copy, Check, FileKey2, ChevronRight, Fingerprint, Calendar,
  Hourglass, ArrowLeft, User, Download, Sparkles, Hash, Lock,
  SkipForward, Play, FileLock2, RefreshCcw,
} from 'lucide-react'
import imgTeam from '../assets/login/team.png'
import imgMachine from '../assets/login/machine.png'
import imgSyringe from '../assets/login/syringe.png'
import PageHero from '../components/ui/PageHero'
import iconFingerprint from '../assets/icons/fingerprint.png'
import PageTransition from '../components/ui/PageTransition'
import SecureCard from '../components/ui/SecureCard'
import StatusChip from '../components/ui/StatusChip'
import EmptyState from '../components/ui/EmptyState'
import LoadingPulse from '../components/ui/LoadingPulse'
import Pagination from '../components/ui/Pagination'
import SearchInput from '../components/ui/SearchInput'

const RECETAS_PAGE_SIZE = 6
const EVENTOS_PAGE_SIZE = 6
import { listContainer, listItem } from '../lib/animations'
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
  const [version, setVersion] = useState(0)

  useEffect(() => {
    (async () => {
      setLoadingRec(true)
      try {
        const { data } = await recetasAPI.porPaciente(user.id)
        setRecetas(data || [])
      } catch (err) {
        toast.error(err?.uiMessage || 'No se pudieron cargar tus recetas')
      } finally { setLoadingRec(false) }
    })()
  }, [user.id, version])

  // Re-sincroniza el `selectedReceta` con la versión fresca tras refrescar,
  // para que el flag cripto_ok / motivo_no_verificada de la cabecera se
  // actualice si el admin (o tampering) cambió la receta en BD.
  useEffect(() => {
    if (!selectedReceta) return
    const fresh = recetas.find(x => x.id === selectedReceta.id)
    if (fresh && fresh !== selectedReceta) setSelectedReceta(fresh)
  }, [recetas, selectedReceta])

  const refrescar = async () => {
    setVersion(v => v + 1)
    if (selectedReceta) {
      setLoadingEv(true)
      try {
        const { data } = await dispensacionTicketsAPI.porReceta(selectedReceta.id)
        setEventos(data || [])
        if (selectedEv) {
          const fresh = (data || []).find(e => e.id === selectedEv.id)
          if (fresh) setSelectedEv(fresh)
        }
      } catch (err) {
        toast.error(err?.uiMessage || 'No se pudieron cargar las dispensaciones')
      } finally { setLoadingEv(false) }
    }
  }

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
      const { data } = await dispensacionTicketsAPI.verificar(ev.id)
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
        <PageHero
          eyebrow={`Paciente · @${user?.username || ''}`}
          title="Verificar firmas"
          subtitle="La verificación es por dispensación, no por receta. Selecciona una receta y luego la dispensación que quieres validar."
          iconImg={iconFingerprint}
          accent="#0A84FF"
        >
          <button
            type="button"
            onClick={refrescar}
            className="btn btn-ghost btn-sm"
            disabled={loadingRec || loadingEv}
          >
            <RefreshCcw size={14} className={loadingRec || loadingEv ? 'animate-spin' : ''} /> Refrescar
          </button>
        </PageHero>

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
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recetas
    return recetas.filter(r => [r.medicamento, r.estado, r.medico_username, `#${r.id}`]
      .filter(Boolean).join(' ').toLowerCase().includes(q))
  }, [recetas, query])

  const totalPages = Math.max(1, Math.ceil(filtradas.length / RECETAS_PAGE_SIZE))
  useEffect(() => { setPage(1) }, [query])
  const safePage = Math.min(page, totalPages)
  const items = filtradas.slice((safePage - 1) * RECETAS_PAGE_SIZE, safePage * RECETAS_PAGE_SIZE)

  if (loading) return <LoadingPulse rows={3} />
  if (recetas.length === 0) return <EmptyState title="Sin recetas" message="Todavía no tienes recetas emitidas a tu nombre." />

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.35)' }}>
            <ShieldCheck size={16} className="text-[color:var(--cyan)]" />
          </div>
          <div>
            <div className="font-heading text-base leading-tight">Selecciona una receta</div>
            <div className="text-[11px] text-[color:var(--text-secondary)]">para verificar su cadena criptográfica</div>
          </div>
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar receta…" maxWidthClass="max-w-sm" />
      </div>

      {filtradas.length === 0 ? (
        <EmptyState title="Ninguna coincide" message="Ajusta tu búsqueda." />
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-[color:var(--text-secondary)] font-mono">
              {filtradas.length} receta{filtradas.length === 1 ? '' : 's'}
            </span>
            <span className="text-xs text-[color:var(--text-secondary)] font-mono">
              Página {safePage} / {totalPages}
            </span>
          </div>
          <motion.div
            key={`r-${query}-${safePage}`}
            variants={listContainer}
            initial="initial"
            animate="animate"
            className="grid gap-3"
          >
            {items.map((r) => (
              <motion.button
                key={r.id}
                type="button"
                onClick={() => onPick(r)}
                variants={listItem}
                whileHover={{ y: -2, boxShadow: '0 12px 28px rgba(10,132,255,0.15)' }}
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
                  <motion.div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, rgba(10,132,255,0.18) 0%, rgba(0,184,217,0.12) 100%)',
                      border: '1px solid rgba(10,132,255,0.40)',
                    }}
                    whileHover={{ rotate: [0, -8, 8, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    <Pill size={20} className="text-[color:var(--cyan)]" />
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-heading text-[15px] truncate">{r.medicamento}</div>
                      <StatusChip estado={r.estado} />
                    </div>
                    <div className="text-[11px] text-[color:var(--text-secondary)] flex gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><Hash size={10}/>{r.id}</span>
                      <span className="flex items-center gap-1"><Calendar size={10}/>{formatDate(r.fecha)}</span>
                      <span className="flex items-center gap-1"><Stethoscope size={10}/>dr.@{r.medico_username}</span>
                      <span className="flex items-center gap-1"><Stamp size={10}/>{r.dispensaciones_realizadas}/{r.dispensaciones_permitidas}</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-[color:var(--cyan)] group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>
            ))}
          </motion.div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </section>
  )
}

function EventosList({ receta, eventos, loading, onPick, onBack }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(eventos.length / EVENTOS_PAGE_SIZE))
  useEffect(() => { setPage(1) }, [receta?.id])
  const safePage = Math.min(page, totalPages)
  const items = eventos.slice((safePage - 1) * EVENTOS_PAGE_SIZE, safePage * EVENTOS_PAGE_SIZE)

  if (loading) return <LoadingPulse rows={2} />
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.35)' }}>
            <Stamp size={16} className="text-[color:var(--cyan)]" />
          </div>
          <div className="min-w-0">
            <div className="font-heading text-base leading-tight truncate">Dispensaciones de la receta #{receta.id}</div>
            <div className="text-[11px] text-[color:var(--text-secondary)]">Elige una para ver su verificación cripto</div>
          </div>
        </div>
        <button type="button" onClick={onBack} className="btn btn-ghost btn-sm">
          <ArrowLeft size={13}/> Volver
        </button>
      </div>
      {eventos.length === 0 ? (
        <EmptyState title="Aún no hay dispensaciones"
          message="Esta receta no ha sido dispensada todavía. Cuando la farmacia entregue el medicamento, aparecerá aquí." />
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-[color:var(--text-secondary)] font-mono">
              {eventos.length} dispensación{eventos.length === 1 ? '' : 'es'}
            </span>
            <span className="text-xs text-[color:var(--text-secondary)] font-mono">
              Página {safePage} / {totalPages}
            </span>
          </div>
          <motion.div
            key={`e-${receta.id}-${safePage}`}
            variants={listContainer}
            initial="initial"
            animate="animate"
            className="grid gap-3"
          >
            {items.map((ev) => {
              const completo = ev.estado === 'completo'
              return (
                <motion.button
                  key={ev.id}
                  type="button"
                  onClick={() => onPick(ev)}
                  variants={listItem}
                  whileHover={{ y: -2, boxShadow: '0 12px 28px rgba(10,132,255,0.15)' }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full text-left rounded-2xl overflow-hidden group"
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    boxShadow: '0 2px 8px rgba(10,36,67,0.06)',
                  }}
                >
                  <div className="flex items-center gap-3 p-4">
                    <motion.div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: completo
                          ? 'linear-gradient(135deg, rgba(0,168,112,0.18) 0%, rgba(0,168,112,0.08) 100%)'
                          : 'linear-gradient(135deg, rgba(224,135,0,0.18) 0%, rgba(224,135,0,0.08) 100%)',
                        border: `1px solid ${completo ? 'rgba(0,168,112,0.45)' : 'rgba(224,135,0,0.45)'}`,
                      }}
                      whileHover={{ rotate: [0, -8, 8, 0] }}
                      transition={{ duration: 0.5 }}
                    >
                      {completo
                        ? <ShieldCheck size={20} style={{ color: '#00775A' }} />
                        : <Hourglass size={20} style={{ color: '#9A6700' }} />}
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-heading text-[15px]">Dispensación #{ev.numero_dispensacion}</div>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider"
                          style={completo
                            ? { background: 'rgba(0,168,112,0.10)', border: '1px solid rgba(0,168,112,0.40)', color: '#00775A' }
                            : { background: 'rgba(224,135,0,0.10)', border: '1px solid rgba(224,135,0,0.40)', color: '#9A6700' }}>
                          {completo ? <Check size={10}/> : <Hourglass size={10}/>}
                          {completo ? 'Acuse firmado' : 'Acuse pendiente'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[color:var(--text-secondary)] flex gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1"><Stamp size={11}/> farm @{ev.farmaceutico_username}</span>
                        <span className="flex items-center gap-1"><Calendar size={11}/> {formatDate(ev.timestamp)}</span>
                        {ev.fecha_firma_paciente && (
                          <span className="flex items-center gap-1"><Fingerprint size={11}/> firmado por paciente</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-[color:var(--cyan)] group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.button>
              )
            })}
          </motion.div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </>
      )}
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
        <VerificacionSlideshow verif={verif} evento={evento} />
      )}
    </section>
  )
}

function ResumenBanner({ verif }) {
  const allOk = verif.cifrado_aes_gcm
    && (verif.medico?.firma_valida == null || verif.medico.firma_valida === true)
    && verif.farmaceutico?.firma_valida
    && (verif.paciente?.firma_valida == null || verif.paciente.firma_valida === true)

  const tone = allOk
    ? { b: 'rgba(0,168,112,0.45)', bg: 'rgba(0,168,112,0.10)', c: '#007A55', Icon: ShieldCheck,
        title: 'Cadena criptográfica íntegra',
        msg: 'AES-128-GCM autentica el cifrado y las firmas ECDSA P-256 + SHA3-256 validan al médico y al farmacéutico que dispensó. El acuse del paciente (si existe) está firmado correctamente.' }
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
        <Chip label="AES-128-GCM" ok={!!verif.cifrado_aes_gcm} />
        <Chip label="ECDSA médico" ok={verif.medico?.firma_valida ?? null} />
        <Chip label="ECDSA farmacéutico" ok={!!verif.farmaceutico?.firma_valida} />
        {verif.paciente?.firma_valida != null && (
          <Chip label="Acuse paciente" ok={!!verif.paciente.firma_valida} />
        )}
      </div>
    </motion.div>
  )
}

function Chip({ label, ok }) {
  // ok puede ser true/false/null. null = no se pudo verificar en este endpoint
  // (sin priv RSA, p. ej. cuando el médico abre /verificar). No mentimos
  // pintándolo verde ni rojo: queda en gris "N/A".
  const isPending = ok == null
  const isOk = ok === true
  const c = isPending
    ? { b: 'rgba(91,107,123,0.32)', bg: 'rgba(91,107,123,0.08)', fg: 'var(--text-secondary)' }
    : isOk
      // Badge SÓLIDO verde oscuro con texto blanco — máxima legibilidad.
      ? { b: '#004D33', bg: 'linear-gradient(135deg, #00875E 0%, #006044 100%)', fg: '#FFFFFF' }
      : { b: 'rgba(180,35,24,0.42)', bg: 'rgba(180,35,24,0.08)', fg: '#B42318' }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-mono font-bold"
      style={{
        border: `1px solid ${c.b}`,
        background: c.bg,
        color: c.fg,
        boxShadow: isOk ? '0 4px 12px rgba(0,77,51,0.35)' : undefined,
        textShadow: isOk ? '0 1px 0 rgba(0,0,0,0.18)' : undefined,
      }}
    >
      {isPending ? <Hourglass size={12}/> : isOk ? <ShieldCheck size={12}/> : <ShieldAlert size={12}/>}
      {label}
      <span>· {isPending ? 'N/A' : isOk ? 'OK' : 'FAIL'}</span>
    </span>
  )
}

function SignerCard({ role, Icon, data, hint, optional }) {
  const [copied, setCopied] = useState(false)
  if (!data) return null
  const ok = data.firma_valida
  // Pendiente cubre dos casos: (a) firmante opcional que aún no firmó
  // (acuse del paciente), (b) firma_valida=null porque este endpoint no
  // pudo verificarla sin la priv RSA del destinatario (p. ej. médico).
  const isPending = (optional && data.firma == null) || ok == null
  const tone = isPending
    ? 'rgba(91,107,123,0.30)'
    : ok ? 'rgba(0,168,112,0.38)' : 'rgba(180,35,24,0.38)'

  const pem = data.llave_publica || ''
  const copy = async () => {
    if (!pem) return
    await navigator.clipboard.writeText(pem)
    setCopied(true); setTimeout(() => setCopied(false), 1400)
  }
  const download = () => {
    if (!pem) return
    const blob = new Blob([pem], { type: 'application/x-pem-file' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // role contiene texto largo: derivamos un nombre de archivo seguro.
    const slug = (data.username || 'firmante').replace(/[^a-zA-Z0-9_.-]/g, '')
    a.download = `securerx_${slug}_public.pem`
    a.click()
    URL.revokeObjectURL(url)
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

      {/* Llave pública: NO se renderiza el PEM en pantalla. El usuario la
          descarga (.pem) o la copia al portapapeles si la necesita. */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-mono"
          style={{ background: 'rgba(10,25,48,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          <FileKey2 size={12}/> Llave pública (PEM)
        </span>
        <button type="button" onClick={download} disabled={!pem}
          className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md transition-colors text-[color:var(--cyan)] hover:bg-[rgba(10,132,255,0.10)] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ border: '1px solid rgba(10,132,255,0.35)' }}>
          <Download size={12}/> Descargar .pem
        </button>
        <button type="button" onClick={copy} disabled={!pem}
          className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md transition-colors text-[color:var(--cyan)] hover:bg-[rgba(10,132,255,0.08)] disabled:opacity-40 disabled:cursor-not-allowed">
          {copied ? <Check size={12}/> : <Copy size={12}/>} {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </SecureCard>
  )
}

// ─────────────── VERIFICACIÓN — SLIDESHOW ANIMADO ─────────────────
// 4 slides cinemáticos al estilo login (imagen 3D que flota + flip horizontal),
// uno por cada paso cripto. Auto-avance cada 2s. Al terminar, resumen completo
// con todas las firmas verificadas (vista compacta que ya existía).
const SLIDES = [
  {
    key: 'aes',
    img: imgMachine,
    Icon: FileLock2,
    title: 'AES-128-GCM',
    subtitle: 'Cifrado autenticado del contenido',
    desc:
      'El criptograma se descifró sin tampering. El TAG de GCM validó el ciphertext y el AAD (id_receta, id_doctor, fecha) — nadie movió la receta de su contexto original.',
    valueOf: (v) => !!v.cifrado_aes_gcm,
  },
  {
    key: 'medico',
    img: imgTeam,
    Icon: Stethoscope,
    title: 'ECDSA del médico',
    subtitle: 'Firma sobre el JSON canónico R',
    desc:
      'La firma ECDSA P-256 + SHA3-256 del médico se verifica contra su llave pública del certificado X.509 emitido por la CA interna.',
    valueOf: (v) => v.medico?.firma_valida,
  },
  {
    key: 'farma',
    img: imgSyringe,
    Icon: Stamp,
    title: 'ECDSA del farmacéutico',
    subtitle: 'Sello de la dispensación',
    desc:
      'El farmacéutico firmó el manifiesto del evento (id_evento, num_dispensación, timestamp) con su llave EC. Vincula criptográficamente la entrega física a su identidad.',
    valueOf: (v) => v.farmaceutico?.firma_valida,
  },
  {
    key: 'paciente',
    img: imgTeam,
    Icon: User,
    title: 'Acuse del paciente',
    subtitle: 'Firma no-repudiable de recepción',
    desc:
      'Si firmaste el acuse, tu ECDSA queda sobre el MISMO manifiesto que el farma — prueba criptográfica de que confirmaste haber recibido el medicamento.',
    valueOf: (v) => v.paciente?.firma_valida,
    optional: true,
  },
]

function VerificacionSlideshow({ verif, evento }) {
  const [step, setStep] = useState(0)
  const [showResumen, setShowResumen] = useState(false)
  const [auto, setAuto] = useState(true)
  const total = SLIDES.length

  useEffect(() => {
    if (!auto || showResumen) return
    const t = setTimeout(() => {
      if (step < total - 1) setStep(step + 1)
      else setShowResumen(true)
    }, 2200)
    return () => clearTimeout(t)
  }, [step, auto, showResumen, total])

  // Toast destacado cuando llega al resumen y alguna firma falló — para
  // que el usuario reciba alerta inmediata aunque luego cierre el panel.
  useEffect(() => {
    if (!showResumen) return
    const fallas = []
    if (verif.cifrado_aes_gcm === false) fallas.push('AES-128-GCM')
    if (verif.medico?.firma_valida === false) fallas.push('firma del médico')
    if (verif.farmaceutico?.firma_valida === false) fallas.push('firma del farmacéutico')
    if (verif.paciente?.firma_valida === false) fallas.push('acuse del paciente')
    if (fallas.length > 0) {
      toast.error(
        `Verificación fallida: ${fallas.join(' · ')}`,
        {
          description: 'La cadena criptográfica de esta dispensación NO es íntegra. Revisa el detalle abajo.',
          duration: 8000,
        },
      )
    } else {
      toast.success(
        'Cadena criptográfica íntegra',
        { description: 'AES-GCM + ECDSA verificados correctamente.', duration: 4500 },
      )
    }
  }, [showResumen, verif])

  if (showResumen) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="label-xs flex items-center gap-1.5">
            <Sparkles size={11} className="text-[color:var(--cyan)]" />
            Verificación completa · resumen
          </span>
          <button
            type="button"
            onClick={() => { setShowResumen(false); setStep(0); setAuto(true) }}
            className="btn btn-ghost btn-sm"
          >
            <Play size={13} /> Ver de nuevo
          </button>
        </div>

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
    )
  }

  const slide = SLIDES[step]
  const ok = slide.valueOf(verif)
  const isPending = ok == null

  return (
    <div
      className="relative overflow-hidden rounded-3xl"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(244,250,255,0.82) 100%)',
        border: '1px solid rgba(10,132,255,0.30)',
        backdropFilter: 'blur(26px) saturate(1.35)',
        boxShadow: '0 30px 80px rgba(10,36,67,0.22), 0 1px 1px rgba(255,255,255,0.7) inset',
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[440px]">
        {/* COLUMNA IZQUIERDA — imagen 3D animada del paso actual */}
        <div
          className="relative overflow-hidden hidden lg:flex flex-col items-center justify-center px-8"
          style={{
            background:
              'linear-gradient(135deg, rgba(10,132,255,0.10) 0%, rgba(0,168,112,0.08) 50%, rgba(10,82,204,0.10) 100%)',
            borderRight: '1px solid rgba(10,132,255,0.18)',
          }}
        >
          <div aria-hidden className="absolute pointer-events-none"
            style={{ top: '-20%', left: '-15%', width: 320, height: 320,
              background: 'radial-gradient(circle, rgba(10,132,255,0.30), transparent 65%)',
              filter: 'blur(40px)' }} />
          <div aria-hidden className="absolute pointer-events-none"
            style={{ bottom: '-20%', right: '-15%', width: 320, height: 320,
              background: 'radial-gradient(circle, rgba(0,168,112,0.22), transparent 65%)',
              filter: 'blur(40px)' }} />

          <AnimatePresence mode="wait">
            <motion.div
              key={slide.key}
              initial={{ opacity: 0, scale: 0.85, rotateY: -90 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.85, rotateY: 90 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10"
              style={{ transformStyle: 'preserve-3d', perspective: 1400 }}
            >
              <motion.img
                src={slide.img}
                alt=""
                draggable={false}
                style={{
                  width: 'min(320px, 100%)', height: 'auto',
                  filter: 'drop-shadow(0 28px 38px rgba(10,36,67,0.28))',
                }}
                animate={{ y: [0, -12, 0], rotate: [0, 1.5, 0, -1.5, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* COLUMNA DERECHA — info del paso + estado verificación */}
        <div className="p-7 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.40)' }}>
              <slide.Icon size={18} className="text-[color:var(--cyan)]" />
            </div>
            <div className="font-mono text-[11px] font-semibold tracking-wider uppercase"
              style={{ color: 'var(--blue-deep)', letterSpacing: '0.12em' }}>
              Paso {step + 1} / {total}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`txt-${slide.key}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="flex-1"
            >
              <h2 className="font-heading text-2xl" style={{ letterSpacing: '-0.02em', color: 'var(--blue-deep)' }}>
                {slide.title}
              </h2>
              <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {slide.subtitle}
              </div>
              <p className="text-[13px] mt-4 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {slide.desc}
              </p>

              {/* Chip de resultado */}
              <div className="mt-6 flex items-center gap-3 flex-wrap">
                {isPending ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11.5px] font-mono font-bold"
                    style={{ background: 'rgba(91,107,123,0.10)', border: '1px solid rgba(91,107,123,0.35)', color: 'var(--text-secondary)' }}>
                    <Hourglass size={12}/> {slide.optional ? 'No aplica' : 'Pendiente'}
                  </span>
                ) : ok ? (
                  <motion.span
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 14, delay: 0.4 }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11.5px] font-mono font-bold"
                    style={{
                      border: '1px solid #004D33',
                      background: 'linear-gradient(135deg, #00875E 0%, #006044 100%)',
                      color: '#FFFFFF',
                      boxShadow: '0 6px 16px rgba(0,77,51,0.40)',
                    }}
                  >
                    <ShieldCheck size={13}/> Verificado · OK
                  </motion.span>
                ) : (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11.5px] font-mono font-bold"
                    style={{
                      border: '1px solid #B42318',
                      background: 'linear-gradient(135deg, #DC2828 0%, #9A1410 100%)',
                      color: '#FFFFFF',
                      boxShadow: '0 6px 16px rgba(180,35,24,0.40)',
                    }}
                  >
                    <ShieldAlert size={13}/> Falló · FAIL
                  </motion.span>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Stepper inferior */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {SLIDES.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => { setAuto(false); setStep(i) }}
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: i === step ? 28 : 10,
                    background: i <= step ? '#0A84FF' : 'rgba(10,132,255,0.25)',
                  }}
                  aria-label={`Ir al paso ${i + 1}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowResumen(true)}
              className="btn btn-ghost btn-sm"
              title="Saltar al resumen completo"
            >
              <SkipForward size={13}/> Resumen
            </button>
          </div>
        </div>
      </div>

      {/* Barra de progreso lineal en el fondo */}
      <motion.div
        key={`bar-${step}`}
        className="absolute bottom-0 left-0 right-0 h-[3px] origin-left"
        style={{
          background: 'linear-gradient(90deg, #4FD1C5 0%, #0A84FF 50%, #00A870 100%)',
          boxShadow: '0 0 12px rgba(79,209,197,0.75)',
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: auto ? 1 : 0 }}
        transition={{ duration: auto ? 2.15 : 0, ease: 'linear' }}
      />
    </div>
  )
}
