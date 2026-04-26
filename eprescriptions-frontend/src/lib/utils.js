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

export function formatDate(d) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
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
