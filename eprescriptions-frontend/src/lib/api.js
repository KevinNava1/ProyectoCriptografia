import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

// ── Usuarios ─────────────────────────────────────
export const registrarUsuario = (datos) =>
  api.post('/usuarios/registro', datos).then(r => r.data)

// ── Recetas ──────────────────────────────────────
export const crearReceta = (medicoId, datos) =>
  api.post(`/recetas?medico_id=${medicoId}`, datos).then(r => r.data)

export const obtenerRecetasPaciente = (pacienteId) =>
  api.get(`/recetas/paciente/${pacienteId}`).then(r => r.data)

export const dispensarReceta = (recetaId, datos) =>
  api.post(`/recetas/${recetaId}/dispensar`, datos).then(r => r.data)

export const obtenerRecetasPendientes = () =>
  api.get('/recetas/pendientes').then(r => r.data)

export default api
