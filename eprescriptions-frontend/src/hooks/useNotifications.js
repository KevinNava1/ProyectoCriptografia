import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { recetasAPI } from '../api'

// Hook de notificaciones derivadas de recetas reales + persistencia de
// "leídas" en sessionStorage para que sobrevivan navegaciones SPA pero
// no entre tabs/sesiones.
//
// API:
//   const { items, refresh, dismiss, clearAll } = useNotifications()
//   - items   : array de notificaciones NO leídas
//   - refresh : recarga las recetas del backend
//   - dismiss : marca una notif como leída (por id)
//   - clearAll: marca TODAS como leídas

const READ_KEY = 'securerx:notif-read'

function loadRead() {
  try {
    const raw = sessionStorage.getItem(READ_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function saveRead(set) {
  try {
    sessionStorage.setItem(READ_KEY, JSON.stringify([...set]))
  } catch { /* quota o private mode */ }
}

function relativeTime(date) {
  const now = Date.now()
  const ts = new Date(date).getTime()
  const diff = Math.max(0, now - ts)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d < 7) return `hace ${d} d`
  return new Date(date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

function buildFromRecetas(user, recetas) {
  const out = []
  if (!user) return out

  const sorted = [...(recetas || [])].sort((a, b) => {
    const ta = a.fecha ? new Date(a.fecha).getTime() : 0
    const tb = b.fecha ? new Date(b.fecha).getTime() : 0
    return tb - ta
  })

  if (user.rol === 'paciente') {
    const recientes = sorted.filter(r => r.estado === 'emitida').slice(0, 3)
    for (const r of recientes) {
      out.push({
        id: `rx-emit-${r.id}`,
        icon: '💊',
        title: `Receta #${r.id}${r.medicamento && r.medicamento !== '(cifrado)' ? ` · ${r.medicamento}` : ''}`,
        subtitle: `Emitida por dr.@${r.medico_username || r.medico_id}`,
        ts: r.fecha,
        color: '#0A84FF',
      })
    }
    const dispensadas = sorted.filter(r => r.estado === 'dispensada').slice(0, 2)
    for (const r of dispensadas) {
      out.push({
        id: `rx-disp-${r.id}`,
        icon: '✓',
        title: `Tu receta #${r.id} fue dispensada`,
        subtitle: 'Confirma el acuse para cerrar el círculo criptográfico',
        ts: r.fecha,
        color: '#00A870',
      })
    }
  }

  if (user.rol === 'medico') {
    const recientes = sorted.slice(0, 3)
    for (const r of recientes) {
      const emoji = r.estado === 'dispensada' ? '🧪' : r.estado === 'revocada' ? '⛔' : '✍️'
      const title = r.estado === 'dispensada'
        ? `Tu receta #${r.id} fue dispensada`
        : r.estado === 'revocada'
          ? `Tu receta #${r.id} fue revocada`
          : `Emitiste la receta #${r.id}`
      out.push({
        id: `rx-${r.id}-${r.estado}`,
        icon: emoji,
        title,
        subtitle: `Para @${r.paciente_username || r.paciente_id}`,
        ts: r.fecha,
        color: r.estado === 'dispensada' ? '#00A870' : r.estado === 'revocada' ? '#B42318' : '#0A84FF',
      })
    }
  }

  if (user.rol === 'farmaceutico') {
    const mias = sorted.filter(r => r.farmaceutico_id === user.id && r.estado === 'dispensada').slice(0, 3)
    for (const r of mias) {
      out.push({
        id: `rx-mia-${r.id}`,
        icon: '📋',
        title: `Dispensaste la receta #${r.id}`,
        subtitle: `${r.medicamento === '(cifrado)' ? '(cifrado)' : r.medicamento || ''} · @${r.paciente_username || r.paciente_id}`,
        ts: r.fecha,
        color: '#00A870',
      })
    }
    const activas = sorted.filter(r => r.estado === 'emitida').length
    if (activas > 0) {
      out.push({
        id: 'farm-pendientes',
        icon: '⏳',
        title: `${activas} receta${activas === 1 ? '' : 's'} para dispensar`,
        subtitle: 'Visibles en /pendientes',
        ts: new Date().toISOString(),
        color: '#E08700',
      })
    }
  }

  return out
}

export function useNotifications(pollMs = 60000) {
  const user = useAuthStore(s => s.user)
  const [recetas, setRecetas] = useState([])
  const [pushed, setPushed] = useState([])
  const [readIds, setReadIds] = useState(() => loadRead())
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!user || user.rol === 'admin') {
      setRecetas([])
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        let data = []
        if (user.rol === 'paciente') data = (await recetasAPI.porPaciente(user.id)).data || []
        else if (user.rol === 'medico') data = (await recetasAPI.porMedico(user.id)).data || []
        else if (user.rol === 'farmaceutico') data = (await recetasAPI.porFarmaceutico(user.id)).data || []
        if (!cancelled) setRecetas(data)
      } catch { /* silent */ }
    }
    load()
    const t = setInterval(load, pollMs)
    return () => { cancelled = true; clearInterval(t) }
  }, [user, pollMs, version])

  useEffect(() => {
    const onPush = (e) => {
      const n = e.detail
      if (!n || !n.title) return
      setPushed(prev => [
        { ...n, id: n.id || `push-${Date.now()}`, ts: n.ts || new Date().toISOString() },
        ...prev,
      ].slice(0, 10))
    }
    window.addEventListener('securerx:notify', onPush)
    return () => window.removeEventListener('securerx:notify', onPush)
  }, [])

  const items = useMemo(() => {
    const base = buildFromRecetas(user, recetas)
    const merged = [...pushed, ...base]
    const seen = new Set()
    const out = []
    for (const n of merged) {
      if (seen.has(n.id)) continue
      if (readIds.has(n.id)) continue   // filtra leídas
      seen.add(n.id)
      out.push({ ...n, hint: relativeTime(n.ts) })
    }
    return out.slice(0, 10)
  }, [user, recetas, pushed, readIds])

  const dismiss = (id) => {
    setReadIds(prev => {
      const next = new Set(prev)
      next.add(id)
      saveRead(next)
      return next
    })
  }

  const clearAll = () => {
    setReadIds(prev => {
      const next = new Set(prev)
      for (const it of items) next.add(it.id)
      saveRead(next)
      return next
    })
    setPushed([])
  }

  const refresh = () => setVersion(v => v + 1)

  return { items, refresh, dismiss, clearAll }
}
