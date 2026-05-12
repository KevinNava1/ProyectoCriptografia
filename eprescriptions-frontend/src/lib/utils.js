import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...args) {
  return twMerge(clsx(...args))
}

export function truncateHash(h, start = 8, end = 8) {
  if (!h) return ''
  if (h.length <= start + end + 3) return h
  return `${h.slice(0, start)}…${h.slice(-end)}`
}

// CDMX permanente: no aplicamos DST porque México lo eliminó (2022). Forzamos
// la TZ aquí en lugar de depender del navegador del usuario.
const TZ_CDMX = 'America/Mexico_City'

// Acepta:
//   - ISO completo "2026-05-12T13:45:00+00:00" → localiza a CDMX con hora.
//   - Date-only "2026-05-12" → muestra ese día, sin shift de TZ (legacy).
//   - Datetime naive del backend "2026-05-12T13:45:00" → lo tratamos como UTC.
export function formatDate(d) {
  if (!d) return ''
  try {
    const s = String(d).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, day] = s.split('-').map(Number)
      return new Date(y, m - 1, day).toLocaleDateString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    }
    const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s)
    const iso = hasTz ? s : `${s}Z`
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: TZ_CDMX,
    })
  } catch {
    return String(d)
  }
}

export function isValidPEM(text) {
  if (!text) return false
  const t = text.trim()
  return /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----[\s\S]+-----END (?:EC |RSA )?PRIVATE KEY-----/.test(t)
}

// Extrae cada bloque PEM (BEGIN…END) del texto.
export function splitPemBlocks(text) {
  if (!text) return []
  const re = /-----BEGIN [A-Z0-9 ]+-----[\s\S]+?-----END [A-Z0-9 ]+-----/g
  return (text.match(re) || []).map(b => b.trim())
}

// Marcador estructural EC P-256 (SEC1) o heurística PKCS8 por tamaño.
// La validación dura la hace el backend; aquí basta para guiar al usuario
// si subió el archivo equivocado.
export function isEcPrivatePem(text) {
  if (!text) return false
  const t = text.trim()
  if (/-----BEGIN EC PRIVATE KEY-----/.test(t)) return true
  if (!/-----BEGIN PRIVATE KEY-----/.test(t)) return false
  const body = t.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  return body.length < 700
}

export function isRsaPrivatePem(text) {
  if (!text) return false
  const t = text.trim()
  if (/-----BEGIN RSA PRIVATE KEY-----/.test(t)) return true
  if (!/-----BEGIN PRIVATE KEY-----/.test(t)) return false
  const body = t.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  return body.length >= 700
}

// Une dos PEMs (orden EC, RSA) como bundle multi-PEM, igual que el backend.
export function joinPemBundle(ecPem, rsaPem) {
  const a = (ecPem || '').trim()
  const b = (rsaPem || '').trim()
  if (a && b) return `${a}\n${b}\n`
  return a || b || ''
}

// Devuelve { ec, rsa } separando bloques de un bundle multi-PEM.
export function splitPemBundle(bundle) {
  const out = { ec: '', rsa: '' }
  for (const block of splitPemBlocks(bundle)) {
    if (isEcPrivatePem(block)) out.ec = block
    else if (isRsaPrivatePem(block)) out.rsa = block
  }
  return out
}
