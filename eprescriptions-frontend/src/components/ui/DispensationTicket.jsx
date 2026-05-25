import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pill, Stamp, Stethoscope, User, Calendar, Clock,
  ShieldCheck, ShieldAlert, Check, FileSignature, Hash,
  Download, Copy,
} from 'lucide-react'
import {
  RxMonogram,
  DoctorSeal,
  EcgRibbon,
  CrossPattern,
  GradientRule,
  MedicalCross,
} from '../illustrations/MedicalAssets'

// CDMX permanente — Mx eliminó DST en 2022, así que fijamos la TZ aquí en
// lugar de heredar la del navegador (que en demos remotas suele no ser CDMX).
const TZ_CDMX = 'America/Mexico_City'

function _normalizeForDate(d) {
  const s = String(d).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, day] = s.split('-').map(Number)
    return { date: new Date(y, m - 1, day), dateOnly: true }
  }
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s)
  return { date: new Date(hasTz ? s : `${s}Z`), dateOnly: false }
}

function fmtFecha(d) {
  if (!d) return '—'
  try {
    const { date, dateOnly } = _normalizeForDate(d)
    return date.toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      ...(dateOnly ? {} : { timeZone: TZ_CDMX }),
    })
  } catch { return '—' }
}
function fmtHora(d) {
  if (!d) return '—'
  try {
    const { date, dateOnly } = _normalizeForDate(d)
    if (dateOnly) return '—'
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: TZ_CDMX,
    })
  } catch { return '—' }
}

export default function DispensationTicket({
  ev,
  receta,
  role,
  user,
  onSign,
  onDetail,
}) {
  const tampered = ev.cripto_ok === false
  const completo = ev.estado === 'completo'
  const canSign =
    role === 'paciente' &&
    ev.estado === 'pendiente_paciente' &&
    ev.paciente_id === user?.id &&
    !tampered

  const docInitials = (ev.medico_username || 'DR').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
  const farmInitials = (ev.farmaceutico_username || 'FA').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()

  const tone = tampered
    ? { color: '#B42318', label: 'Sello no verificado', bg: 'rgba(180,35,24,0.10)', border: 'rgba(180,35,24,0.40)' }
    : completo
      ? { color: '#00A870', label: 'Acuse firmado',     bg: 'rgba(0,168,112,0.10)',  border: 'rgba(0,168,112,0.40)' }
      : { color: '#E08700', label: 'Pendiente',          bg: 'rgba(224,135,0,0.10)',  border: 'rgba(224,135,0,0.45)' }

  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      className="ticket-perforation relative"
    >
      <CrossPattern />

      <div className="rx-watermark">
        <RxMonogram size={360} color={tampered ? '#B42318' : '#0A84FF'} />
      </div>

      {/* HEADER */}
      <header className="relative px-6 sm:px-8 pt-6 pb-3 flex items-start gap-4 z-10">
        <MedicalCross size={44} color={tampered ? '#B42318' : '#00A870'} pulse={!completo} />
        <div className="flex-1 min-w-0">
          <div className="label-xs flex items-center gap-1.5">
            <Stamp size={11} className="text-[color:var(--cyan)]" /> Ticket de dispensación
          </div>
          <div className="font-editorial mt-0.5" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
            #{ev.numero_dispensacion} <span className="text-[color:var(--text-secondary)] font-normal text-base">/ Receta #{ev.receta_id}</span>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider"
          style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}
        >
          {completo && <Check size={11} />}
          {tone.label}
        </span>
      </header>

      <div className="px-6 sm:px-8">
        <GradientRule />
      </div>

      {tampered && (
        <div
          className="relative mx-6 sm:mx-8 mt-3 p-3 rounded-xl flex items-start gap-2.5 z-10"
          style={{ background: 'rgba(180,35,24,0.08)', border: '1px solid rgba(180,35,24,0.42)' }}
        >
          <ShieldAlert size={18} style={{ color: '#B42318' }} className="shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-editorial text-sm" style={{ color: '#B42318' }}>Sello criptográfico inválido</div>
            <div className="text-[11px] mt-0.5" style={{ color: '#7A1F12' }}>
              {ev.motivo_no_verificada || 'La firma ECDSA del farmacéutico no verifica contra el manifiesto.'}
            </div>
          </div>
        </div>
      )}

      {/* Sección "Medicamento + actores" QUITADA — esa info ya se muestra
          arriba en el RxTemplate. Aquí solo dejamos lo que es DEL EVENTO
          de dispensación (observación del farma, sello, fechas, acciones). */}
      {ev.observaciones && (
        <div
          className="mx-6 sm:mx-8 mt-4 mb-1 p-2.5 rounded-lg text-xs relative z-10"
          style={{ background: 'rgba(10,132,255,0.05)', border: '1px solid rgba(10,132,255,0.18)' }}
        >
          <span className="label-xs mr-1">Observación del farmacéutico:</span>
          <span className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {ev.observaciones}
          </span>
        </div>
      )}

      {/* Actores compactos en una sola fila — útil para identificar quién
          dispensó y a quién, sin duplicar el medicamento que ya está arriba. */}
      <section className="relative px-6 sm:px-8 pt-3 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-2 z-10">
        <Actor icon={Stethoscope} role="Médico"        handle={ev.medico_username} fallback={`id${ev.medico_id || '?'}`} initials={docInitials} />
        <Actor icon={Stamp}      role="Farmacéutico"  handle={ev.farmaceutico_username} fallback={`id${ev.farmaceutico_id || '?'}`} initials={farmInitials} />
        <Actor icon={User}       role="Paciente"      handle={ev.paciente_username} fallback={`id${ev.paciente_id || '?'}`} initials={'PT'} />
      </section>

      <div className="relative z-10">
        <EcgRibbon height={42} color={tampered ? '#B42318' : tone.color} />
      </div>

      {/* CUT */}
      <div className="relative px-6 sm:px-8 z-10">
        <div className="ticket-cut mt-1 mb-4" />
      </div>

      {/* STUB inferior — fecha+hora separadas, sello, acciones */}
      <section className="relative px-6 sm:px-8 pb-6 z-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Stub label="Fecha dispensación" value={fmtFecha(ev.timestamp)} icon={Calendar} />
          <Stub label="Hora dispensación"  value={fmtHora(ev.timestamp)}  icon={Clock} mono />
          <Stub
            label="Firmado paciente"
            value={ev.fecha_firma_paciente ? fmtFecha(ev.fecha_firma_paciente) : '—'}
            icon={Calendar}
            tone={ev.fecha_firma_paciente ? 'ok' : 'muted'}
          />
          <Stub
            label="Hora firma paciente"
            value={ev.fecha_firma_paciente ? fmtHora(ev.fecha_firma_paciente) : '—'}
            icon={Clock}
            mono
            tone={ev.fecha_firma_paciente ? 'ok' : 'muted'}
          />
        </div>

        {/* Firmas digitales reales — block que muestra ECDSA con download/copy */}
        <div className="space-y-2.5 mb-4">
          <SignatureBlock
            label="Firma ECDSA del farmacéutico (sobre el sello)"
            signature={ev.firma_farmaceutico}
            filename={`ticket_${ev.id}_firma_farmaceutico.sig`}
            tone="blue"
          />
          <SignatureBlock
            label="Firma ECDSA del paciente (acuse de recibo)"
            signature={ev.firma_paciente}
            filename={`ticket_${ev.id}_firma_paciente.sig`}
            tone="green"
            emptyLabel="Acuse aún no firmado"
          />
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <DoctorSeal
              size={64}
              text="DISPENSADO · SECURERX"
              initials={farmInitials}
              color={tampered ? '#B42318' : completo ? '#00A870' : '#0A84FF'}
              stamped={completo}
            />
            <div className="min-w-0">
              <div className="label-xs flex items-center gap-1">
                <Hash size={9} /> ID ticket
              </div>
              <div className="font-mono text-[12px] text-[color:var(--blue-deep)]">
                {ev.id}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canSign ? (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onSign?.(ev)}
                className="btn btn-primary btn-sm"
              >
                <ShieldCheck size={14} /> Firmar acuse
              </motion.button>
            ) : null}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onDetail?.(ev)}
              className="btn btn-ghost btn-sm"
            >
              <FileSignature size={14} /> Detalle
            </motion.button>
          </div>
        </div>
      </section>
    </motion.article>
  )
}

function Actor({ icon: Icon, role, handle, fallback, initials }) {
  return (
    <div
      className="flex items-center gap-2.5 p-2 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(10,132,255,0.16)' }}
    >
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0"
        style={{ background: 'rgba(10,132,255,0.12)', color: 'var(--blue-deep)', border: '1px solid rgba(10,132,255,0.28)' }}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="label-xs flex items-center gap-1">
          <Icon size={10} /> {role}
        </div>
        <div className="font-mono text-[11px] truncate text-[color:var(--text-primary)]">
          @{handle || fallback}
        </div>
      </div>
    </div>
  )
}

function Stub({ label, value, icon: Icon, mono, tone = 'default' }) {
  const color = tone === 'ok' ? 'var(--emerald)' : tone === 'muted' ? 'var(--text-secondary)' : 'var(--text-primary)'
  return (
    <div
      className="p-2.5 rounded-lg min-w-0"
      style={{ background: 'rgba(255,255,255,0.40)', border: '1px solid rgba(10,132,255,0.14)' }}
    >
      <div className="label-xs flex items-center gap-1">
        {Icon && <Icon size={10} />} {label}
      </div>
      <div
        className={`text-sm truncate mt-0.5 ${mono ? 'font-mono text-[12px]' : 'font-medium'}`}
        style={{ color }}
      >
        {value}
      </div>
    </div>
  )
}

function SignatureBlock({ label, signature, filename, tone = 'blue', emptyLabel = '— sin firma —' }) {
  const [copied, setCopied] = useState(false)
  const palette = tone === 'green'
    ? { bg: 'rgba(0,168,112,0.07)', border: 'rgba(0,168,112,0.32)', fg: '#00775A' }
    : { bg: 'rgba(10,132,255,0.07)', border: 'rgba(10,132,255,0.28)', fg: 'var(--blue-deep)' }
  const has = !!signature

  const copy = async () => {
    if (!has) return
    await navigator.clipboard.writeText(signature)
    setCopied(true); setTimeout(() => setCopied(false), 1400)
  }
  const download = () => {
    if (!has) return
    const blob = new Blob([signature], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Muestra los primeros 24 + últimos 24 chars de la firma para que sea
  // reconocible visualmente sin volcar 700+ chars al DOM.
  const preview = has
    ? `${signature.slice(0, 28)}…${signature.slice(-24)}`
    : ''

  return (
    <div>
      <div className="label-xs mb-1">{label}</div>
      <div
        className="rounded-lg p-2.5"
        style={{ background: palette.bg, border: `1px solid ${palette.border}` }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: palette.fg }}>
            {has ? 'ECDSA · DER → base64' : emptyLabel}
          </span>
          <AnimatePresence>
            {has && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ml-auto flex gap-1"
              >
                <button
                  type="button"
                  onClick={download}
                  className="inline-flex items-center gap-1 text-[10.5px] px-2 py-1 rounded hover:bg-white/40 transition-colors"
                  style={{ color: palette.fg }}
                >
                  <Download size={11} /> Descargar .sig
                </button>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1 text-[10.5px] px-2 py-1 rounded hover:bg-white/40 transition-colors"
                  style={{ color: palette.fg }}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copiada' : 'Copiar'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {has && (
          <div
            className="mt-1.5 text-[11px] font-mono break-all"
            style={{ color: palette.fg, opacity: 0.85 }}
          >
            {preview}
          </div>
        )}
      </div>
    </div>
  )
}

// Mini-preview para el modal de Pendientes (sin firmas todavía — el ticket
// no existe aún hasta que el farmacéutico confirme).
export function DispensationTicketPreview({ receta, medicoUsername, farmaceuticoUsername }) {
  if (!receta) return null
  const docInitials = (medicoUsername || receta.medico_username || 'DR').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
  const farmInitials = (farmaceuticoUsername || 'FA').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()

  return (
    <article className="ticket-perforation relative overflow-hidden">
      <CrossPattern />
      <div className="rx-watermark">
        <RxMonogram size={280} />
      </div>

      <header className="relative px-5 pt-5 pb-3 flex items-start gap-3 z-10">
        <MedicalCross size={36} pulse />
        <div className="flex-1 min-w-0">
          <div className="label-xs">Vas a dispensar</div>
          <h3
            className="font-editorial mt-0.5"
            style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05 }}
          >
            {receta.medicamento}
          </h3>
          <div
            className="mt-1 font-medium"
            style={{ fontSize: 15, color: 'var(--blue-deep)', lineHeight: 1.3 }}
          >
            {receta.dosis} · x{receta.cantidad}
          </div>
        </div>
      </header>

      <div className="px-5"><GradientRule /></div>

      <div className="relative grid grid-cols-2 gap-2 px-5 py-4 z-10">
        <Actor icon={Stethoscope} role="Médico" handle={medicoUsername || receta.medico_username} fallback={`id${receta.medico_id}`} initials={docInitials} />
        <Actor icon={User} role="Paciente" handle={receta.paciente_username} fallback={`id${receta.paciente_id}`} initials={'PT'} />
      </div>

      <div className="px-5 pb-4 z-10 relative flex items-center justify-between text-[11px]">
        <span className="label-xs flex items-center gap-1">
          <Calendar size={10} /> {fmtFecha(receta.fecha)}
        </span>
        <DoctorSeal size={48} initials={farmInitials} text="DISPENSADO · SECURERX" color="#0A84FF" />
      </div>
    </article>
  )
}
