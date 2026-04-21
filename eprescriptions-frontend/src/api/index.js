import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
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
    if (/llave privada no pertenece/i.test(message)) return 'Esa llave privada no coincide con tu cuenta'
    if (/rol/i.test(message)) return message
    return message || 'No tienes permisos para esta acción'
  }
  if (status === 404) return message || 'Recurso no encontrado'
  if (status === 400) {
    if (/INTEGRIDAD/i.test(message)) return 'INTEGRIDAD COMPROMETIDA: el hash SHA-256 no coincide'
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
}

export const recetasAPI = {
  crear:          (medicoId, datos) => api.post(`/recetas?medico_id=${medicoId}`, datos),
  porPaciente:    (pacienteId)      => api.get(`/recetas/paciente/${pacienteId}`),
  porMedico:      (medicoId)        => api.get(`/recetas/medico/${medicoId}`),
  porFarmaceutico:(farmId)          => api.get(`/recetas/farmaceutico/${farmId}`),
  pendientes:     ()                => api.get('/recetas/pendientes'),
  dispensar:      (recetaId, farmId, datos) =>
    api.post(`/recetas/${recetaId}/dispensar?farmaceutico_id=${farmId}`, datos),
  verificarFirmas: (recetaId)       => api.get(`/recetas/${recetaId}/verificar-firmas`),
}

export default api
