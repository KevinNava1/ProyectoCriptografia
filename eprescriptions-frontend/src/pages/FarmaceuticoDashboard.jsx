import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { obtenerRecetasPendientes, dispensarReceta } from '@/lib/api'

export default function FarmaceuticoDashboard() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState(null)
  const [recetas, setRecetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(null)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('usuario') || 'null')
    if (!u || u.rol !== 'farmaceutico') {
      navigate('/')
      return
    }
    setUsuario(u)
    cargar()
  }, [navigate])

  const cargar = async () => {
    setLoading(true)
    try {
      setRecetas(await obtenerRecetasPendientes())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const dispensar = async (recetaId) => {
    if (!usuario?.llave_privada) {
      alert('No se encontró tu llave privada. Vuelve a registrarte.')
      return
    }
    setProcesando(recetaId)
    setMensaje(null)
    try {
      const resp = await dispensarReceta(recetaId, {
        farmaceutico_id: usuario.id,
        llave_privada_farmaceutico: usuario.llave_privada
      })
      setMensaje({
        tipo: 'ok',
        texto: `Receta #${recetaId} dispensada. Integridad: ${resp.verificaciones.integridad_sha256} · Firma médico: ${resp.verificaciones.firma_medico_ecdsa}`
      })
      await cargar()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.response?.data?.detail || 'Error al dispensar' })
    } finally {
      setProcesando(null)
    }
  }

  const logout = () => {
    sessionStorage.clear()
    navigate('/')
  }

  if (!usuario) return null

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Panel de Farmacia</h1>
            <p className="text-slate-600">{usuario.nombre} · <Badge>farmacéutico</Badge></p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cargar}>Recargar</Button>
            <Button variant="outline" onClick={logout}>Cerrar sesión</Button>
          </div>
        </div>

        {mensaje && (
          <div className={`p-4 rounded ${mensaje.tipo === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {mensaje.texto}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recetas pendientes de dispensar ({recetas.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-slate-500 py-8">Cargando...</p>
            ) : recetas.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No hay recetas pendientes</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Médico</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Medicamento</TableHead>
                    <TableHead>Dosis</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recetas.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>#{r.id}</TableCell>
                      <TableCell>#{r.medico_id}</TableCell>
                      <TableCell>#{r.paciente_id}</TableCell>
                      <TableCell className="font-medium">{r.medicamento}</TableCell>
                      <TableCell>{r.dosis}</TableCell>
                      <TableCell>{r.cantidad}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => dispensar(r.id)}
                          disabled={procesando === r.id}
                        >
                          {procesando === r.id ? 'Verificando...' : 'Verificar y dispensar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
