import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ScanSearch, RefreshCcw, Database, Lock, KeyRound, FileSignature,
  Hash, Copy, Check, ChevronRight, ChevronDown, ListTree, Clock,
} from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import LoadingPulse from '../components/ui/LoadingPulse'
import EmptyState from '../components/ui/EmptyState'
import { auditoriaCriptoAPI } from '../api'
import { useAuthStore } from '../store/useAuthStore'
import { formatDate } from '../lib/utils'

// Trunca un hex/base64 largo para pintarlo sin reventar la fila pero deja
// al usuario copiar el valor completo.
function shortHex(s, head = 14, tail = 8) {
  if (!s) return '—'
  if (s.length <= head + tail + 3) return s
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}

function CopyableMono({ value, className = '' }) {
  const [copied, setCopied] = useState(false)
  if (!value) return <span className={`font-mono text-xs text-[color:var(--text-secondary)] ${className}`}>—</span>
  const copy = (e) => {
    e.stopPropagation()
    navigator.clipboard?.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1100)
  }
  return (
    <button
      type="button"
      onClick={copy}
      title={value}
      className={`group inline-flex items-center gap-1.5 font-mono text-[11px] px-2 py-1 rounded-md transition-colors ${className}`}
      style={{
        background: 'rgba(10,132,255,0.06)',
        border: '1px solid rgba(10,132,255,0.18)',
        color: 'var(--text-primary)',
      }}
    >
      <span className="truncate max-w-[280px]">{shortHex(value, 18, 10)}</span>
      {copied
        ? <Check size={11} className="text-emerald-600 shrink-0" />
        : <Copy size={11} className="opacity-50 group-hover:opacity-100 shrink-0" />}
    </button>
  )
}

function FieldRow({ icon: Icon, label, value, sublabel }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: 'rgba(10,132,255,0.10)',
          border: '1px solid rgba(10,132,255,0.20)',
          color: 'var(--blue-deep)',
        }}
      >
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-[color:var(--text-secondary)]">{label}</span>
          {sublabel && (
            <span className="text-[10px] font-mono text-[color:var(--text-secondary)] opacity-80">{sublabel}</span>
          )}
        </div>
        <div className="mt-1">{value}</div>
      </div>
    </div>
  )
}

function RecetaCryptoCard({ r, idx, prev }) {
  const [open, setOpen] = useState(idx < 2) // primeras dos abiertas por defecto

  // Avalancha cripto: si tengo la receta anterior comparable, calculo el % de
  // bytes distintos en el ciphertext, IV y c_wrap_pac. Es solo visual —
  // un Hamming a nivel char hex, perfecto para mostrar no-determinismo.
  const avalancha = useMemo(() => {
    if (!prev) return null
    const diff = (a, b) => {
      if (!a || !b) return null
      const n = Math.min(a.length, b.length)
      if (!n) return null
      let d = 0
      for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++
      return Math.round((d / n) * 1000) / 10
    }
    return {
      iv: diff(r.aes_gcm?.iv_hex, prev.aes_gcm?.iv_hex),
      tag: diff(r.aes_gcm?.tag_hex, prev.aes_gcm?.tag_hex),
      ct: diff(r.aes_gcm?.ciphertext_hex, prev.aes_gcm?.ciphertext_hex),
      wrap: diff(r.rsa_oaep_paciente?.c_wrap_hex, prev.rsa_oaep_paciente?.c_wrap_hex),
    }
  }, [r, prev])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.4) }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(12px) saturate(1.1)',
        border: '1px solid rgba(10,132,255,0.20)',
        boxShadow: '0 10px 30px rgba(10,36,67,0.06)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[rgba(10,132,255,0.05)] transition-colors"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg,#0A84FF,#00B8D9)',
            color: 'white',
            boxShadow: '0 6px 16px rgba(10,132,255,0.30)',
          }}
        >
          <Lock size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">Receta #{r.id}</span>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(10,132,255,0.10)',
                color: 'var(--blue-deep)',
                border: '1px solid rgba(10,132,255,0.25)',
              }}
            >
              {r.estado}
            </span>
            <span className="text-[11px] text-[color:var(--text-secondary)]">
              {formatDate(r.fecha_creacion)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-mono text-[color:var(--text-secondary)]">
              ct {r.aes_gcm?.ciphertext_len}B · iv 12B · tag 16B · wrap {r.rsa_oaep_paciente?.c_wrap_len}B
            </span>
            {avalancha && (avalancha.ct != null || avalancha.iv != null) && (
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(0,184,217,0.10)',
                  color: 'var(--blue-deep)',
                  border: '1px solid rgba(0,184,217,0.25)',
                }}
                title="Bytes distintos vs receta anterior"
              >
                Δ vs #{prev?.id}: ct {avalancha.ct ?? '—'}% · iv {avalancha.iv ?? '—'}% · wrap {avalancha.wrap ?? '—'}%
              </span>
            )}
          </div>
        </div>
        {open
          ? <ChevronDown size={16} className="opacity-70 shrink-0" />
          : <ChevronRight size={16} className="opacity-70 shrink-0" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 grid md:grid-cols-2 gap-x-6 border-t" style={{ borderColor: 'rgba(10,132,255,0.15)' }}>
              <FieldRow
                icon={Lock}
                label="AES-GCM · ciphertext"
                sublabel={`${r.aes_gcm?.ciphertext_len ?? 0} bytes`}
                value={<CopyableMono value={r.aes_gcm?.ciphertext_hex} />}
              />
              <FieldRow
                icon={Hash}
                label="AES-GCM · IV (nonce)"
                sublabel="12 B aleatorio"
                value={<CopyableMono value={r.aes_gcm?.iv_hex} />}
              />
              <FieldRow
                icon={Hash}
                label="AES-GCM · TAG"
                sublabel="MAC 16 B"
                value={<CopyableMono value={r.aes_gcm?.tag_hex} />}
              />
              <FieldRow
                icon={ListTree}
                label="AAD canónico"
                sublabel="auth, no cifrado"
                value={
                  r.aes_gcm?.aad_json ? (
                    <pre
                      className="font-mono text-[11px] px-2 py-1.5 rounded-md whitespace-pre-wrap max-w-full overflow-x-auto"
                      style={{
                        background: 'rgba(10,132,255,0.05)',
                        border: '1px solid rgba(10,132,255,0.15)',
                      }}
                    >{JSON.stringify(r.aes_gcm.aad_json, null, 0)}</pre>
                  ) : <span className="font-mono text-xs">—</span>
                }
              />
              <FieldRow
                icon={KeyRound}
                label="RSA-OAEP · wrap (paciente)"
                sublabel={`${r.rsa_oaep_paciente?.c_wrap_len ?? 0} B`}
                value={<CopyableMono value={r.rsa_oaep_paciente?.c_wrap_hex} />}
              />
              <FieldRow
                icon={KeyRound}
                label={`RSA-OAEP · wraps (farmacias)`}
                sublabel={`${r.rsa_oaep_farmacias?.length || 0} destinatarios`}
                value={
                  r.rsa_oaep_farmacias?.length ? (
                    <div className="flex flex-col gap-1">
                      {r.rsa_oaep_farmacias.map(f => (
                        <div key={f.farmacia_id} className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono text-[color:var(--text-secondary)]">farm #{f.farmacia_id}</span>
                          <CopyableMono value={f.c_wrap_hex} />
                        </div>
                      ))}
                    </div>
                  ) : <span className="font-mono text-xs">—</span>
                }
              />
              <FieldRow
                icon={FileSignature}
                label="ECDSA · firma del médico"
                sublabel="P-256 + SHA3-256"
                value={<CopyableMono value={r.ecdsa_medico?.firma_b64} />}
              />
              <FieldRow
                icon={Hash}
                label="SHA3-256 de R canónico"
                value={<CopyableMono value={r.sha3_256_hex} />}
              />
              {r.sellos_dispensacion?.length > 0 && (
                <div className="md:col-span-2 mt-2 pt-3" style={{ borderTop: '1px dashed rgba(10,132,255,0.20)' }}>
                  <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-secondary)] mb-2">
                    Sellos de dispensación
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    {r.sellos_dispensacion.map(s => (
                      <div
                        key={s.evento_id}
                        className="rounded-lg p-2"
                        style={{ background: 'rgba(0,184,217,0.06)', border: '1px solid rgba(0,184,217,0.20)' }}
                      >
                        <div className="text-[11px] font-mono mb-1">
                          #{s.numero_dispensacion} · farm {s.farmaceutico_id} · {formatDate(s.timestamp)}
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2"><span className="text-[10px] text-[color:var(--text-secondary)]">manifiesto</span><CopyableMono value={s.manifiesto_hex} /></div>
                          <div className="flex items-center gap-2"><span className="text-[10px] text-[color:var(--text-secondary)]">firma_F</span><CopyableMono value={s.firma_farm_b64} /></div>
                          {s.firma_paciente_b64 && (
                            <div className="flex items-center gap-2"><span className="text-[10px] text-[color:var(--text-secondary)]">firma_P</span><CopyableMono value={s.firma_paciente_b64} /></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function AuditoriaCripto() {
  const user = useAuthStore(s => s.user)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Historial de consultas: cada refetch añade una entrada para que se vea
  // EXACTAMENTE cuántas veces el cliente fue a la BD.
  const [historial, setHistorial] = useState([])

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    const t0 = performance.now()
    try {
      const { data } = await auditoriaCriptoAPI.inventario()
      const ms = Math.round(performance.now() - t0)
      setData(data)
      setHistorial(h => [
        { ts: data.consultado_en, total: data.total, ms },
        ...h.slice(0, 19),
      ])
    } catch (err) {
      setError(err?.uiMessage || 'No se pudo consultar la base de datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    cargar()
  }, [user, cargar])

  const recetas = data?.recetas || []

  return (
    <PageTransition>
      <div className="space-y-6">
        <header className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
              <ScanSearch size={13} />
              <span>Auditoría · §12</span>
            </div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold mt-1">
              Inspector criptográfico
            </h1>
            <p className="text-sm text-[color:var(--text-secondary)] mt-1 max-w-2xl">
              Cada botón <span className="font-semibold">Consultar BD</span> ejecuta un <code className="font-mono">SELECT</code> a
              MySQL y trae los blobs en bruto: ciphertext AES-GCM, IV, TAG, AAD,
              wraps RSA-OAEP, firmas ECDSA y hashes SHA3-256. Compara entre
              recetas: aunque el contenido clínico sea idéntico, IV/TAG/ciphertext
              cambian al ~100% (no determinismo).
            </p>
          </div>
          <button
            type="button"
            onClick={cargar}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg,#0A84FF,#0052CC)',
              boxShadow: '0 8px 20px rgba(10,132,255,0.30)',
            }}
          >
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
            Consultar BD
          </button>
        </header>

        {/* Historial de consultas */}
        <section
          className="rounded-2xl p-4"
          style={{
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(10,132,255,0.18)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Database size={14} className="text-[color:var(--blue-deep)]" />
            <span className="text-[11px] uppercase tracking-wider text-[color:var(--text-secondary)]">
              Historial de consultas
            </span>
            <span className="ml-auto text-[10px] font-mono text-[color:var(--text-secondary)]">
              rol={data?.rol || user?.rol} · total recetas={data?.total ?? 0}
            </span>
          </div>
          {historial.length === 0 ? (
            <div className="text-xs text-[color:var(--text-secondary)] font-mono">
              Aún no hay consultas registradas.
            </div>
          ) : (
            <div className="flex flex-col gap-1 max-h-44 overflow-y-auto">
              {historial.map((h, i) => (
                <div
                  key={`${h.ts}-${i}`}
                  className="flex items-center gap-3 text-[11px] font-mono px-2 py-1 rounded-md"
                  style={{ background: i === 0 ? 'rgba(0,184,217,0.10)' : 'transparent' }}
                >
                  <Clock size={11} className="opacity-60" />
                  <span>{formatDate(h.ts)}</span>
                  <span className="text-[color:var(--text-secondary)]">·</span>
                  <span>{h.total} recetas</span>
                  <span className="text-[color:var(--text-secondary)]">·</span>
                  <span>{h.ms} ms</span>
                  {i === 0 && (
                    <span
                      className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(0,184,217,0.20)',
                        color: 'var(--blue-deep)',
                      }}
                    >
                      última
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Lista de recetas con bytes crudos */}
        {loading && !data && <LoadingPulse rows={4} />}
        {error && (
          <div
            className="rounded-xl p-4 text-sm"
            style={{
              background: 'rgba(255,76,76,0.06)',
              border: '1px solid rgba(255,76,76,0.30)',
              color: '#b91c1c',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && recetas.length === 0 && (
          <EmptyState
            title="Sin recetas en alcance"
            message="Tu rol no tiene visibilidad criptográfica sobre ninguna receta todavía."
          />
        )}

        <div className="space-y-3">
          {recetas.map((r, i) => (
            <RecetaCryptoCard key={r.id} r={r} idx={i} prev={recetas[i + 1]} />
          ))}
        </div>
      </div>
    </PageTransition>
  )
}
