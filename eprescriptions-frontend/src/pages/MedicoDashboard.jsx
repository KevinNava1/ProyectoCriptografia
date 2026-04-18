import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { crearReceta } from '@/lib/api'

export default function MedicoDashboard() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const [form, setForm] = useState({
    paciente_id: '',
    medicamento: '',
    dosis: '',
    cantidad: '',
    instrucciones: ''
  })

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('usuario') || 'null')
    if (!u || u.rol !== 'medico') {
      navigate('/')
      return
    }
    setUsuario(u)
  }, [navigate])

  const handleEmitir = async () => {
    if (!usuario?.llave_privada) {
      alert('No se encontró la llave privada. Vuelve a registrarte.')
      return
    }
    setLoading(true)
    setMensaje(null)
    try {
      const resp = await crearReceta(usuario.id, {
        paciente_id: parseInt(form.paciente_id),
        medicamento: form.medicamento,
        dosis: form.dosis,
        cantidad: parseInt(form.cantidad),
        instrucciones: form.instrucciones,
        llave_privada_medico: usuario.llave_privada
      })
      setMensaje({ tipo: 'ok', texto: `Receta #${resp.id} emitida correctamente. Hash: ${resp.hash_sha256.slice(0, 20)}...` })
      setForm({ paciente_id: '', medicamento: '', dosis: '', cantidad: '', instrucciones: '' })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.response?.data?.detail || 'Error al emitir receta' })
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    sessionStorage.clear()
    navigate('/')
  }

  if (!usuario) return null

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Panel del Médico</h1>
            <p className="text-slate-600">{usuario.nombre} · <Badge>médico</Badge></p>
          </div>
          <Button variant="outline" onClick={logout}>Cerrar sesión</Button>
        </div>

        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle>Emitir nueva receta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID del paciente</Label>
                <Input
                  type="number"
                  placeholder="Ej: 2"
                  value={form.paciente_id}
                  onChange={(e) => setForm({ ...form, paciente_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Medicamento</Label>
                <Input
                  placeholder="Ej: Amoxicilina"
                  value={form.medicamento}
                  onChange={(e) => setForm({ ...form, medicamento: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dosis</Label>
                <Input
                  placeholder="Ej: 500mg"
                  value={form.dosis}
                  onChange={(e) => setForm({ ...form, dosis: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  placeholder="Ej: 21"
                  value={form.cantidad}
                  onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instrucciones</Label>
              <Input
                placeholder="Ej: 1 cada 8 horas por 7 días"
                value={form.instrucciones}
                onChange={(e) => setForm({ ...form, instrucciones: e.target.value })}
              />
            </div>

            {mensaje && (
              <div className={`p-3 rounded text-sm ${mensaje.tipo === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {mensaje.texto}
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleEmitir}
              disabled={loading || !form.paciente_id || !form.medicamento}
            >
              {loading ? 'Firmando y cifrando...' : 'Emitir receta (firma ECDSA + cifrado AES)'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
