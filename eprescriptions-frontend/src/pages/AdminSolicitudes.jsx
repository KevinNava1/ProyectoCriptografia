import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ShieldCheck, Check, X, RefreshCcw, Filter, Clock, FileText, CheckCheck, Loader2, Pause, Trash2, AlertTriangle, MoreVertical } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import SecureCard from '../components/ui/SecureCard'
import LoadingPulse from '../components/ui/LoadingPulse'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { adminAPI } from '../api'
import { formatDate } from '../lib/utils'

const FILTROS = [
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'aprobada',  label: 'Aprobadas' },
  { id: 'suspendida', label: 'Suspendidas' },
  { id: 'rechazada', label: 'Rechazadas' },
  { id: 'todas',     label: 'Todas' },
]

const ROL_LABEL = {
  medico: 'Médico',
  paciente: 'Paciente',
  farmaceutico: 'Farmacéutico',
  admin: 'Admin',
}

export default function AdminSolicitudes() {
  const [estado, setEstado] = useState('pendiente')
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [working, setWorking] = useState(null)        // id en curso
  const [suspendFor, setSuspendFor] = useState(null)  // solicitud a suspender
  const [rejectFor, setRejectFor] = useState(null)    // solicitud a rechazar (borrar)
  const [motivo, setMotivo] = useState('')
  const [version, setVersion] = useState(0)            // fuerza recarga
  const [bulkOpen, setBulkOpen] = useState(false)      // confirmar masivo
  const [bulk, setBulk] = useState(null)               // { total, done, ok, fail, currentName }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data } = await adminAPI.solicitudes(estado)
        if (!cancelled) setSolicitudes(data || [])
      } catch (err) {
        if (!cancelled) setError(err?.uiMessage || 'No se pudieron cargar las solicitudes')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [estado, version])

  const stats = useMemo(() => {
    const total = solicitudes.length
    const pend = solicitudes.filter(s => s.estado === 'pendiente').length
    return { total, pend }
  }, [solicitudes])

  const aprobar = async (s) => {
    setWorking(s.id)
    const reactivacion = s.estado === 'suspendida'
    try {
      await adminAPI.aprobar(s.id)
      toast.success(reactivacion
        ? `@${s.username} reactivado · certificados emitidos`
        : `@${s.username} aprobado · certificados emitidos`)
      setVersion(v => v + 1)
    } catch (err) {
      toast.error(err?.uiMessage || 'No se pudo aprobar')
    } finally { setWorking(null) }
  }

  const aprobarTodasPendientes = async () => {
    const pendientes = solicitudes.filter(s => s.estado === 'pendiente')
    if (pendientes.length === 0) {
      setBulkOpen(false)
      return toast.info('No hay solicitudes pendientes')
    }
    setBulk({ total: pendientes.length, done: 0, ok: 0, fail: 0, currentName: '', errors: [] })
    let ok = 0, fail = 0
    const errors = []
    for (let i = 0; i < pendientes.length; i++) {
      const s = pendientes[i]
      setBulk(b => ({ ...b, currentName: `@${s.username}`, done: i }))
      try {
        await adminAPI.aprobar(s.id)
        ok += 1
      } catch (err) {
        fail += 1
        errors.push(`@${s.username}: ${err?.uiMessage || 'error'}`)
      }
      setBulk(b => ({ ...b, ok, fail, done: i + 1, errors }))
    }
    if (fail === 0) {
      toast.success(`${ok} solicitud${ok === 1 ? '' : 'es'} aprobada${ok === 1 ? '' : 's'} · certs emitidos`)
    } else {
      toast.warning(`${ok} OK · ${fail} fallida${fail === 1 ? '' : 's'}`)
    }
    setVersion(v => v + 1)
    setTimeout(() => { setBulk(null); setBulkOpen(false) }, fail === 0 ? 800 : 2200)
  }

  const confirmSuspender = async () => {
    if (!suspendFor) return
    if (motivo.trim().length < 3) return toast.error('Escribe un motivo de al menos 3 caracteres')
    setWorking(suspendFor.id)
    try {
      await adminAPI.suspender(suspendFor.id, { motivo: motivo.trim() })
      toast.success(`@${suspendFor.username} suspendido · cuenta inhabilitada`)
      setSuspendFor(null); setMotivo('')
      setVersion(v => v + 1)
    } catch (err) {
      toast.error(err?.uiMessage || 'No se pudo suspender')
    } finally { setWorking(null) }
  }

  const confirmRechazo = async () => {
    if (!rejectFor) return
    if (motivo.trim().length < 3) return toast.error('Escribe un motivo de al menos 3 caracteres')
    setWorking(rejectFor.id)
    try {
      await adminAPI.rechazar(rejectFor.id, { motivo: motivo.trim() })
      toast.success(`@${rejectFor.username} rechazado · usuario eliminado, username y email liberados`)
      setRejectFor(null); setMotivo('')
      setVersion(v => v + 1)
    } catch (err) {
      toast.error(err?.uiMessage || 'No se pudo rechazar')
    } finally { setWorking(null) }
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <header className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="label-xs flex items-center gap-1.5">
              <ShieldCheck size={11} className="text-[color:var(--emerald)]" />
              Panel administrativo
            </div>
            <h1 className="font-heading text-3xl md:text-4xl mt-2">Solicitudes de certificación</h1>
            <p className="text-[color:var(--text-secondary)] mt-2 text-sm max-w-xl">
              Aprueba o rechaza el alta de cada usuario. Al aprobar, se emiten los dos certificados X.509
              (ECDSA P-256 para firma · RSA-OAEP 2048 para cifrado) y se activa la cuenta.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {stats.pend > 0 && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setBulkOpen(true)}
                className="btn btn-primary btn-sm relative overflow-hidden"
              >
                <CheckCheck size={14}/>
                Aprobar todas
                <span
                  className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(255,255,255,0.22)', color: '#FFFFFF' }}
                >
                  {stats.pend}
                </span>
              </motion.button>
            )}
            <button
              type="button"
              onClick={() => setVersion(v => v + 1)}
              className="btn btn-ghost btn-sm"
            >
              <RefreshCcw size={14}/> Refrescar
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Kpi label="En vista" value={stats.total} accent="#0A84FF" icon={FileText} />
          <Kpi label="Pendientes" value={stats.pend}  accent="#E08700" icon={Clock} />
          <SecureCard hover={false} className="hidden lg:flex flex-col justify-between">
            <div className="label-xs flex items-center gap-1.5">
              <ShieldCheck size={11} className="text-[color:var(--emerald)]" />
              CA interna activa
            </div>
            <div className="font-heading text-base mt-1">SecP256r1 · RSA-OAEP-SHA256</div>
            <div className="text-[10px] text-[color:var(--text-secondary)] mt-1">
              X.509 v3 · KeyUsage crítico · BasicConstraints CA=FALSE
            </div>
          </SecureCard>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Filter size={14} className="text-[color:var(--text-secondary)]" />
            {FILTROS.map(f => {
              const active = estado === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setEstado(f.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{
                    background: active ? 'rgba(10,132,255,0.10)' : 'var(--bg-tertiary)',
                    border: `1px solid ${active ? 'rgba(10,132,255,0.55)' : 'var(--border-subtle)'}`,
                    color: active ? 'var(--blue-deep)' : 'var(--text-secondary)',
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>

          {loading && <LoadingPulse rows={4} />}
          {!loading && error && <EmptyState title="Error" message={error} />}
          {!loading && !error && solicitudes.length === 0 && (
            <EmptyState
              title="Sin solicitudes"
              message={estado === 'pendiente'
                ? 'No hay solicitudes pendientes ahora mismo.'
                : 'No hay solicitudes para este filtro.'}
            />
          )}
          {!loading && !error && solicitudes.length > 0 && (
            <div className="grid gap-3">
              {solicitudes.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <SecureCard className="flex items-center justify-between gap-4 flex-wrap md:flex-nowrap">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.32)' }}>
                        <ShieldCheck size={18} className="text-[color:var(--cyan)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-semibold truncate">{s.nombre}</span>
                          <span className="font-mono text-xs text-[color:var(--text-secondary)]">@{s.username}</span>
                        </div>
                        <div className="text-xs text-[color:var(--text-secondary)] flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                          <span>{ROL_LABEL[s.rol] || s.rol}</span>
                          <span>·</span>
                          <span>{s.email}</span>
                          {s.fecha_solicitud && <>
                            <span>·</span>
                            <span>{formatDate(s.fecha_solicitud)}</span>
                          </>}
                        </div>
                        {s.estado !== 'pendiente' && (
                          <div className="mt-2">
                            <EstadoChip estado={s.estado} motivo={s.motivo_rechazo} />
                          </div>
                        )}
                      </div>
                    </div>
                    {s.estado === 'pendiente' && (
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          type="button"
                          disabled={working === s.id}
                          onClick={() => aprobar(s)}
                          className="btn btn-primary btn-sm"
                        >
                          <Check size={14}/> Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={working === s.id}
                          onClick={() => { setSuspendFor(s); setMotivo('') }}
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#9A6700', borderColor: 'rgba(224,135,0,0.40)' }}
                          title="Inhabilita la cuenta pero conserva username/email"
                        >
                          <Pause size={13}/> Suspender
                        </button>
                        <button
                          type="button"
                          disabled={working === s.id}
                          onClick={() => { setRejectFor(s); setMotivo('') }}
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#B42318', borderColor: 'rgba(180,35,24,0.30)' }}
                          title="Elimina el usuario y libera username/email"
                        >
                          <Trash2 size={13}/> Rechazar
                        </button>
                      </div>
                    )}
                    {s.estado === 'suspendida' && (
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          type="button"
                          disabled={working === s.id}
                          onClick={() => aprobar(s)}
                          className="btn btn-primary btn-sm"
                          title="Reactiva la cuenta y emite los certificados"
                        >
                          <Check size={14}/> Reactivar y aprobar
                        </button>
                        <button
                          type="button"
                          disabled={working === s.id}
                          onClick={() => { setRejectFor(s); setMotivo('') }}
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#B42318', borderColor: 'rgba(180,35,24,0.30)' }}
                          title="Elimina el usuario y libera username/email (si no tiene historial)"
                        >
                          <Trash2 size={13}/> Rechazar
                        </button>
                      </div>
                    )}
                    {s.estado === 'aprobada' && (
                      <div className="shrink-0">
                        <KebabMenu
                          disabled={working === s.id}
                          items={[
                            {
                              icon: Pause,
                              label: 'Suspender',
                              hint: 'Inhabilita la cuenta y revoca certificados',
                              color: '#9A6700',
                              onClick: () => { setSuspendFor(s); setMotivo('') },
                            },
                            {
                              icon: Trash2,
                              label: 'Rechazar',
                              hint: 'Borrar usuario (sólo si no tiene historial)',
                              color: '#B42318',
                              onClick: () => { setRejectFor(s); setMotivo('') },
                            },
                          ]}
                        />
                      </div>
                    )}
                  </SecureCard>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Modal
        open={!!suspendFor}
        onClose={() => { setSuspendFor(null); setMotivo('') }}
        title={`Suspender solicitud de @${suspendFor?.username || ''}`}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: 'rgba(224,135,0,0.08)', border: '1px solid rgba(224,135,0,0.32)' }}>
            <Pause className="shrink-0 mt-0.5" size={18} style={{ color: '#9A6700' }}/>
            <div className="text-xs leading-relaxed">
              La cuenta queda en estado <strong>suspendido</strong> y el login responderá 403.
              Se conservan <strong>username y email</strong>, así como la pista de la solicitud.
              {suspendFor?.estado === 'aprobada' && (
                <> Sus <strong>certificados X.509 quedarán revocados</strong> con timestamp y motivo (las firmas históricas siguen verificables, pero no podrá emitir ni firmar nada nuevo).</>
              )}
              {' '}Reversible: el admin puede aprobar de nuevo y se emiten certificados nuevos.
            </div>
          </div>
          <div>
            <div className="label-xs mb-1.5">Motivo</div>
            <textarea
              className="input-field"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="documentacion_pendiente, revision_compliance, …"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setSuspendFor(null); setMotivo('') }}
              className="btn btn-ghost btn-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={working === suspendFor?.id}
              onClick={confirmSuspender}
              className="btn btn-primary btn-sm"
              style={{ background: '#9A6700', borderColor: '#7a5100' }}
            >
              <Pause size={13}/> Confirmar suspensión
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!rejectFor}
        onClose={() => { setRejectFor(null); setMotivo('') }}
        title={`Rechazar solicitud de @${rejectFor?.username || ''}`}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: 'rgba(180,35,24,0.06)', border: '1px solid rgba(180,35,24,0.30)' }}>
            <AlertTriangle className="text-[color:var(--red)] shrink-0 mt-0.5" size={18} />
            <div className="text-xs leading-relaxed">
              <strong>Acción irreversible.</strong> El usuario se elimina de la base junto con sus
              certificados y solicitudes (cascade). El <strong>username y el email quedan libres</strong>
              y otra persona podrá registrarse con ellos. La traza queda en audit_log con snapshot
              del usuario borrado.
              {(rejectFor?.estado === 'aprobada' || rejectFor?.estado === 'suspendida') && (
                <> <strong>Si el usuario tiene historial</strong> (recetas firmadas, dispensaciones, tickets) <strong>el rechazo será bloqueado</strong> para no destruir evidencia médico-legal — usa Suspender en ese caso.</>
              )}
            </div>
          </div>
          <div>
            <div className="label-xs mb-1.5">Motivo</div>
            <textarea
              className="input-field"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="datos_invalidos, identidad_no_verificada, …"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setRejectFor(null); setMotivo('') }}
              className="btn btn-ghost btn-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={working === rejectFor?.id}
              onClick={confirmRechazo}
              className="btn btn-primary btn-sm"
              style={{ background: '#B42318', borderColor: '#8a1610' }}
            >
              <Trash2 size={13}/> Borrar usuario
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal — Aprobar todas */}
      <Modal
        open={bulkOpen}
        onClose={bulk ? () => {} : () => setBulkOpen(false)}
        title={bulk ? 'Aprobando solicitudes' : `Aprobar ${stats.pend} solicitud${stats.pend === 1 ? '' : 'es'}`}
      >
        {!bulk ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.30)' }}>
              <ShieldCheck className="text-[color:var(--cyan)] shrink-0 mt-0.5" size={18} />
              <div className="text-xs leading-relaxed">
                Se emitirán <strong>{stats.pend * 2}</strong> certificados X.509
                ({stats.pend} EC para firma + {stats.pend} RSA para cifrado) y se activarán
                las <strong>{stats.pend}</strong> cuentas. Cada operación queda en el audit log.
              </div>
            </div>
            <p className="text-sm text-[color:var(--text-secondary)] leading-relaxed">
              Si quieres revisar identidad antes de aprobar a alguno en concreto,
              cancela y úsa los botones individuales.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button className="btn btn-ghost btn-sm" onClick={() => setBulkOpen(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={aprobarTodasPendientes}>
                <CheckCheck size={14}/> Aprobar las {stats.pend}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin text-[color:var(--cyan)]" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {bulk.done < bulk.total
                    ? `Procesando ${bulk.currentName}…`
                    : 'Completado'}
                </div>
                <div className="text-[11px] text-[color:var(--text-secondary)]">
                  {bulk.done} / {bulk.total} · {bulk.ok} OK · {bulk.fail} fallidas
                </div>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(10,36,67,0.08)' }}>
              <motion.div
                animate={{ width: `${(bulk.done / bulk.total) * 100}%` }}
                transition={{ duration: 0.2 }}
                className="h-full"
                style={{ background: 'linear-gradient(90deg,#0A84FF,#00B8D9)' }}
              />
            </div>
            {bulk.errors.length > 0 && (
              <div
                className="rounded-lg p-3 text-[11px] max-h-32 overflow-auto leading-relaxed font-mono"
                style={{ background: 'rgba(180,35,24,0.06)', border: '1px solid rgba(180,35,24,0.30)', color: '#7a1a13' }}
              >
                {bulk.errors.map((e, i) => <div key={i}>· {e}</div>)}
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageTransition>
  )
}

function KebabMenu({ items, disabled }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const MENU_WIDTH = 240

  // Recalcula la posición contra el viewport (position:fixed) cada vez que se
  // abre, y al hacer scroll/resize. Si no hay espacio abajo, abre hacia arriba.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      const spaceBelow = window.innerHeight - r.bottom
      const top = spaceBelow < 180 ? Math.max(8, r.top - 8 - 120) : r.bottom + 6
      const left = Math.min(
        Math.max(8, r.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - 8,
      )
      setPos({ top, left })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
        style={{
          background: open ? 'rgba(10,132,255,0.10)' : 'var(--bg-tertiary)',
          border: `1px solid ${open ? 'rgba(10,132,255,0.55)' : 'var(--border-subtle)'}`,
          color: 'var(--text-secondary)',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Más acciones"
      >
        <MoreVertical size={16} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              role="menu"
              className="rounded-xl overflow-hidden"
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                width: MENU_WIDTH,
                zIndex: 9999,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 12px 40px rgba(10,36,67,0.22)',
              }}
            >
              {items.map((it, i) => {
                const Icon = it.icon
                return (
                  <button
                    key={i}
                    type="button"
                    role="menuitem"
                    onClick={() => { setOpen(false); it.onClick?.() }}
                    className="w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
                    style={{ color: it.color || 'var(--text-primary)' }}
                  >
                    <Icon size={15} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-tight">{it.label}</div>
                      {it.hint && (
                        <div className="text-[11px] text-[color:var(--text-secondary)] mt-0.5 leading-snug">
                          {it.hint}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

function Kpi({ label, value, accent, icon: Icon }) {
  return (
    <SecureCard className="relative overflow-hidden min-h-[110px] flex flex-col justify-between">
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
      <div className="font-heading text-3xl mt-2" style={{ color: accent }}>{value}</div>
    </SecureCard>
  )
}

function EstadoChip({ estado, motivo }) {
  const meta = estado === 'aprobada'
    ? { bg: 'rgba(0,168,112,0.10)', border: 'rgba(0,168,112,0.40)', color: '#00775A', label: 'Aprobada' }
    : estado === 'suspendida'
      ? { bg: 'rgba(224,135,0,0.10)', border: 'rgba(224,135,0,0.40)', color: '#9A6700', label: 'Suspendida' }
      : { bg: 'rgba(180,35,24,0.10)', border: 'rgba(180,35,24,0.35)', color: '#B42318', label: 'Rechazada' }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium"
      style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
    >
      {meta.label}{motivo ? ` · ${motivo}` : ''}
    </span>
  )
}
