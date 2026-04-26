import axios from 'axios'
import { useAuthStore } from '../store/useAuthStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
})

// Adjunta Authorization y X-Priv-Keys automáticamente (cuando aplican).
api.interceptors.request.use((config) => {
  const user = useAuthStore.getState().user
  if (user?.token) {
    config.headers = config.headers || {}
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${user.token}`
    }
  }
  if (user?.llave_privada && config.attachPrivKeys) {
    // HTTP headers no admiten CR/LF: el bundle PEM viaja en base64.
    config.headers['X-Priv-Keys'] = btoa(unescape(encodeURIComponent(user.llave_privada)))
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status
    const detail = err?.response?.data?.detail || err?.response?.data?.message
    const message = typeof detail === 'string' ? detail : err?.message
    err.uiMessage = translateError(status, message)
    return Promise.reject(err)
  }
)

function translateError(status, message) {
  if (!status) return 'No se pudo conectar con el servidor'
  if (status === 401) return message || 'Usuario o contraseña incorrectos'
  if (status === 409) return message || 'Conflicto: el recurso ya existe'
  if (status === 403) {
    if (/llave\s+(privada|ec|rsa)\s+no\s+pertenece/i.test(message)) {
      // Mensaje específico EC vs RSA si el backend lo distinguió.
      if (/llave\s+rsa\s+no\s+pertenece/i.test(message)) return 'Tu llave RSA no coincide con la cuenta · revisa el archivo .pem que subiste'
      return 'Tu llave EC (ECDSA) no coincide con la cuenta · revisa el archivo .pem que subiste'
    }
    if (/rol/i.test(message)) return message
    return message || 'No tienes permisos para esta acción'
  }
  if (status === 404) return message || 'Recurso no encontrado'
  if (status === 400) {
    if (/INTEGRIDAD/i.test(message)) return 'INTEGRIDAD COMPROMETIDA: el hash SHA3-256 o el TAG GCM no coincide'
    if (/FIRMA/i.test(message)) return 'FIRMA INVÁLIDA: la firma ECDSA no pudo verificarse'
    if (/PEM/i.test(message))    return 'Llave privada con formato PEM inválido'
    return message || 'Solicitud inválida'
  }
  return message || 'Error inesperado'
}

export const usuariosAPI = {
  registrar: (datos)   => api.post('/usuarios/registro', datos),
  login:     (datos)   => api.post('/usuarios/login', datos),
  porUsername: (u)     => api.get(`/usuarios/${encodeURIComponent(u)}`),
  buscar:    (q, rol)  => api.get(`/usuarios/buscar`, { params: { q, rol } }),
}

const withKeys = { attachPrivKeys: true }

export const adminAPI = {
  solicitudes: (estado = 'pendiente') => api.get(`/admin/solicitudes?estado=${encodeURIComponent(estado)}`),
  aprobar:     (id)                   => api.post(`/admin/solicitudes/${id}/aprobar`),
  suspender:   (id, datos)            => api.post(`/admin/solicitudes/${id}/suspender`, datos),
  rechazar:    (id, datos)            => api.post(`/admin/solicitudes/${id}/rechazar`, datos),
}

export const dispensacionTicketsAPI = {
  pendientes:     ()                => api.get('/recetas/eventos-dispensacion/pendientes'),
  mios:           ()                => api.get('/recetas/eventos-dispensacion'),
  firmarPaciente: (eventoId, datos) => api.post(`/recetas/eventos-dispensacion/${eventoId}/firmar-paciente`, datos),
  porReceta:      (recetaId)        => api.get(`/recetas/${recetaId}/eventos-dispensacion`),
  verificar:      (eventoId)        => api.get(`/recetas/eventos-dispensacion/${eventoId}/verificar`),
}

export const recetasAPI = {
  crear:          (medicoId, datos) => api.post(`/recetas?medico_id=${medicoId}`, datos),
  porPaciente:    (pacienteId)      => api.get(`/recetas/paciente/${pacienteId}`, withKeys),
  porMedico:      (medicoId)        => api.get(`/recetas/medico/${medicoId}`),
  porFarmaceutico:(farmId)          => api.get(`/recetas/farmaceutico/${farmId}`, withKeys),
  pendientes:     ()                => api.get('/recetas/pendientes', withKeys),
  dispensar:      (recetaId, farmId, datos) =>
    api.post(`/recetas/${recetaId}/dispensar?farmaceutico_id=${farmId}`, datos),
  cancelar:       (recetaId, datos) => api.post(`/recetas/${recetaId}/cancelar`, datos),
  nuevaVersion:   (recetaId, datos) => api.post(`/recetas/${recetaId}/nueva-version`, datos),
  verificarFirmas: (recetaId)       => api.get(`/recetas/${recetaId}/verificar-firmas`),
}

export default api
