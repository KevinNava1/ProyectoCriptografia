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
