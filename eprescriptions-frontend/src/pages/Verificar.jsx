import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  KeyRound, ShieldCheck, ShieldAlert, Pill, Stethoscope, Stamp,
  Copy, Check, FileKey2, CircleDot, ChevronRight, X, Fingerprint,
  Sparkles, ClipboardPaste, Eraser, ChevronDown,
} from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import SecureCard from '../components/ui/SecureCard'
import StatusChip from '../components/ui/StatusChip'
import CryptoHash from '../components/ui/CryptoHash'
import EmptyState from '../components/ui/EmptyState'
import LoadingPulse from '../components/ui/LoadingPulse'
import { useAuthStore } from '../store/useAuthStore'
import { recetasAPI } from '../api'
import { formatDate } from '../lib/utils'

export default function Verificar() {
  const user = useAuthStore(s => s.user)
  const [recetas, setRecetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [result, setResult] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | running | done | error

  useEffect(() => {
    (async () => {
      try {
        const { data } = await recetasAPI.porPaciente(user.id)
        setRecetas(data || [])
      } catch (err) {
        toast.error(err?.uiMessage || 'No se pudieron cargar tus recetas')
      } finally { setLoading(false) }
    })()
  }, [user.id])

  const verify = async (r) => {
    setSelected(r)
    setResult(null)
    setPhase('running')
    try {
      // Mínimo 1.8s para que se aprecie la animación paso a paso
      const [{ data }] = await Promise.all([
        recetasAPI.verificarFirmas(r.id),
        new Promise(res => setTimeout(res, 1800)),
      ])
      setResult(data)
      setPhase('done')
    } catch (err) {
      toast.error(err?.uiMessage || 'No se pudo verificar la receta')
      setPhase('error')
    }
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <header>
          <div className="label-xs">Paciente · @{user?.username}</div>
          <h1 className="font-heading text-3xl md:text-4xl mt-2 flex items-center gap-3">
            <KeyRound className="text-[color:var(--cyan)]" /> Verificar firmas
          </h1>
          <p className="text-[color:var(--text-secondary)] text-sm mt-2 max-w-2xl">
            Confirma criptográficamente quién emitió y quién dispensó tu receta usando las
            <strong className="mx-1 text-[color:var(--blue-deep)]">llaves públicas</strong>
            del médico y del farmacéutico. Este proceso es
            <strong className="mx-1 text-[color:var(--emerald)]">no‑repudiable</strong>
            y se realiza sin exponer ninguna llave privada.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {/* Lista de recetas */}
          <section className="space-y-3">
            <div className="label-xs px-1">Selecciona una receta</div>
            {loading && <LoadingPulse rows={3} />}
            {!loading && recetas.length === 0 && (
              <EmptyState title="Sin recetas" message="Todavía no tienes recetas emitidas a tu nombre." />
            )}
            {!loading && recetas.map((r, i) => {
              const active = selected?.id === r.id
              return (
                <motion.button
                  key={r.id}
                  type="button"
                  onClick={() => verify(r)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full text-left relative rounded-2xl overflow-hidden group"
                  style={{
                    background: active
                      ? 'linear-gradient(135deg, rgba(10,132,255,0.12), rgba(0,184,217,0.08))'
                      : 'var(--card-bg)',
                    border: `1px solid ${active ? 'rgba(10,132,255,0.50)' : 'var(--card-border)'}`,
                    backdropFilter: 'blur(14px) saturate(1.1)',
                    WebkitBackdropFilter: 'blur(14px) saturate(1.1)',
                    boxShadow: active
                      ? '0 12px 32px rgba(10,132,255,0.18)'
                      : '0 2px 8px rgba(10,36,67,0.06)',
                  }}
                >
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: active
                          ? 'linear-gradient(135deg,#0A84FF,#00B8D9)'
                          : 'rgba(10,132,255,0.10)',
                        border: '1px solid rgba(10,132,255,0.35)',
                      }}>
                      <Pill size={18} className={active ? 'text-white' : 'text-[color:var(--cyan)]'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-heading text-[15px] truncate">{r.medicamento}</div>
                        <StatusChip estado={r.estado} />
                      </div>
                      <div className="text-[11px] text-[color:var(--text-secondary)] flex gap-3 mt-1">
                        <span>#{r.id}</span>
                        <span>{formatDate(r.fecha)}</span>
                        <span>dr.@{r.medico_username}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className={`shrink-0 transition-transform ${active ? 'translate-x-1 text-[color:var(--cyan)]' : 'text-[color:var(--text-secondary)] group-hover:translate-x-1'}`} />
                  </div>
                  {active && (
                    <motion.span
                      layoutId="verify-marker"
                      className="absolute left-0 top-0 bottom-0 w-[3px]"
                      style={{ background: 'linear-gradient(180deg,#0A84FF,#00B8D9)' }}
                    />
                  )}
                </motion.button>
              )
            })}
          </section>

          {/* Panel de verificación */}
          <section>
            <AnimatePresence mode="wait">
              {!selected && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                >
                  <SecureCard className="text-center py-14">
                    <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                      style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.32)' }}>
                      <FileKey2 size={22} className="text-[color:var(--cyan)]" />
                    </div>
                    <div className="font-heading text-lg">Elige una receta</div>
                    <p className="text-sm text-[color:var(--text-secondary)] mt-1.5 max-w-sm mx-auto">
                      Al seleccionarla, pediremos al servidor las llaves públicas involucradas
                      y reproduciremos la verificación ECDSA paso a paso.
                    </p>
                  </SecureCard>
                </motion.div>
              )}

              {selected && (
                <motion.div
                  key={selected.id + '-' + phase}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="space-y-4"
                >
                  <SecureCard>
                    <header className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="label-xs">Receta #{selected.id}</div>
                        <div className="font-heading text-xl mt-1">{selected.medicamento}</div>
                        <div className="text-[12px] text-[color:var(--text-secondary)] mt-0.5">
                          {selected.dosis} · x{selected.cantidad} · {formatDate(selected.fecha)}
                        </div>
                      </div>
                      <StatusChip estado={selected.estado} />
                    </header>

                    <div className="mt-4">
                      <div className="label-xs mb-1.5">Hash SHA-256</div>
                      <CryptoHash value={selected.hash_sha256} full />
                    </div>
                  </SecureCard>

                  <SecureCard>
                    <div className="flex items-center gap-2 mb-3">
                      <CircleDot size={15} className="text-[color:var(--cyan)]" />
                      <span className="font-heading text-sm">Proceso de verificación</span>
                    </div>
                    <RichSteps phase={phase} hasFarm={!!selected.farmaceutico_username} />
                  </SecureCard>

                  <AnimatePresence>
                    {phase === 'done' && result && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="space-y-4"
                      >
                        <IntegrityBanner result={result} />

                        <SignerCard
                          role="Médico que emitió"
                          Icon={Stethoscope}
                          data={result.medico}
                        />

                        {result.farmaceutico && (
                          <SignerCard
                            role="Farmacéutico que dispensó"
                            Icon={Stamp}
                            data={result.farmaceutico}
                          />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </div>
    </PageTransition>
  )
}

function RichSteps({ phase, hasFarm }) {
  const base = useMemo(() => {
    const items = [
      'Descifrando con AES-256-GCM y validando el auth tag de 128 bits',
      'Solicitando la llave pública del médico al servidor',
      'Re-calculando SHA-256 del contenido y comparando con el hash firmado',
      'Verificando firma ECDSA P-256 del médico con su llave pública',
    ]
    if (hasFarm) {
      items.push('Solicitando la llave pública del farmacéutico')
      items.push('Verificando firma ECDSA del farmacéutico sobre el estado "dispensada"')
    }
    return items
  }, [hasFarm])

  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (phase !== 'running') { setIdx(base.length); return }
    setIdx(0)
    const id = setInterval(() => setIdx(i => Math.min(i + 1, base.length)), 360)
    return () => clearInterval(id)
  }, [phase, base.length])

  return (
    <ol className="space-y-2">
      {base.map((t, i) => {
        const state = i < idx ? 'done' : i === idx && phase === 'running' ? 'active' : phase === 'done' ? 'done' : 'pending'
        const tone = state === 'done'
          ? { b: 'rgba(0,168,112,0.38)', bg: 'rgba(0,168,112,0.08)', c: 'var(--emerald)' }
          : state === 'active'
          ? { b: 'rgba(10,132,255,0.48)', bg: 'rgba(10,132,255,0.09)', c: 'var(--cyan)' }
          : { b: 'var(--border-subtle)', bg: 'transparent', c: 'var(--text-secondary)' }
        return (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm"
            style={{ borderColor: tone.b, background: tone.bg }}
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-mono"
              style={{
                background: state === 'done' ? 'rgba(0,168,112,0.15)' : state === 'active' ? 'rgba(10,132,255,0.15)' : 'transparent',
                border: `1px solid ${tone.b}`,
                color: tone.c,
              }}
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span className={state === 'pending' ? 'text-[color:var(--text-secondary)]' : ''}>{t}</span>
            {state === 'active' && (
              <motion.span
                className="ml-auto w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--cyan)' }}
                animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.2, 0.9] }}
                transition={{ duration: 1.1, repeat: Infinity }}
              />
            )}
          </motion.li>
        )
      })}
    </ol>
  )
}

function IntegrityBanner({ result }) {
  const allOk = result.cifrado_aes_gcm &&
    result.integridad_sha256 &&
    result.medico?.firma_valida &&
    (result.farmaceutico == null || result.farmaceutico.firma_valida)

  const tone = allOk
    ? { b: 'rgba(0,168,112,0.45)', bg: 'rgba(0,168,112,0.10)', c: '#007A55', Icon: ShieldCheck, title: 'Cadena criptográfica íntegra', msg: 'AES-256-GCM autentica el cifrado, SHA-256 confirma el contenido y las firmas ECDSA validan al médico y al farmacéutico. Ninguna llave privada fue expuesta.' }
    : { b: 'rgba(180,35,24,0.42)', bg: 'rgba(180,35,24,0.08)', c: '#B42318', Icon: ShieldAlert, title: 'Hay una verificación fallida', msg: 'Alguna comprobación (AES-GCM, SHA-256 o una firma ECDSA) no pasó. Revisa los detalles a continuación.' }

  const allEcdsa = result.medico?.firma_valida &&
    (result.farmaceutico == null || result.farmaceutico.firma_valida)

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
        <CryptoChip label="AES-256-GCM"     ok={!!result.cifrado_aes_gcm} />
        <CryptoChip label="SHA-256"         ok={!!result.integridad_sha256} />
        <CryptoChip label="ECDSA P-256"     ok={!!allEcdsa} />
      </div>
    </motion.div>
  )
}

function CryptoChip({ label, ok }) {
  const c = ok
    ? { b: 'rgba(0,168,112,0.45)', bg: 'rgba(0,168,112,0.10)', fg: '#007A55' }
    : { b: 'rgba(180,35,24,0.42)', bg: 'rgba(180,35,24,0.08)', fg: '#B42318' }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium"
      style={{ border: `1px solid ${c.b}`, background: c.bg, color: c.fg }}
    >
      {ok ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
      {label}
      <span>· {ok ? 'OK' : 'FAIL'}</span>
    </span>
  )
}

function SignerCard({ role, Icon, data }) {
  const [copied, setCopied] = useState(false)
  const ok = data.firma_valida
  const tone = ok ? 'rgba(0,168,112,0.38)' : 'rgba(180,35,24,0.38)'
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
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0"
          style={{
            background: ok ? 'rgba(0,168,112,0.10)' : 'rgba(180,35,24,0.08)',
            border: `1px solid ${tone}`,
            color: ok ? '#007A55' : '#B42318',
          }}
        >
          {ok ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
          {ok ? 'Firma válida' : 'Firma inválida'}
        </span>
      </header>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="label-xs">Llave pública (PEM)</div>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md hover:bg-[rgba(10,132,255,0.08)] transition-colors text-[color:var(--cyan)]"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <pre
          className="text-[10.5px] font-mono p-3 rounded-xl overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto"
          style={{
            background: 'rgba(10,25,48,0.04)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >{data.llave_publica}</pre>
      </div>
    </SecureCard>
  )
}
