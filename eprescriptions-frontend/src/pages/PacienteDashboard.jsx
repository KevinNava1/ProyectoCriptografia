import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { obtenerRecetasPaciente } from '@/lib/api'

export default function PacienteDashboard() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState(null)
  const [recetas, setRecetas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem('usuario') || 'null')
    if (!u || u.rol !== 'paciente') {
      navigate('/')
      return
    }
    setUsuario(u)
    cargarRecetas(u.id)
  }, [navigate])

  const cargarRecetas = async (id) => {
    setLoading(true)
    try {
      const data = await obtenerRecetasPaciente(id)
      setRecetas(data)
    } catch (err) {
      console.error(err)
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
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mis Recetas</h1>
            <p className="text-slate-600">{usuario.nombre} · <Badge>paciente</Badge></p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => cargarRecetas(usuario.id)}>
              Recargar
            </Button>
            <Button variant="outline" onClick={logout}>Cerrar sesión</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recetas emitidas ({recetas.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-slate-500 py-8">Cargando...</p>
            ) : recetas.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No tienes recetas aún</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Medicamento</TableHead>
                    <TableHead>Dosis</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Instrucciones</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recetas.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>#{r.id}</TableCell>
                      <TableCell>{r.fecha}</TableCell>
                      <TableCell className="font-medium">{r.medicamento}</TableCell>
                      <TableCell>{r.dosis}</TableCell>
                      <TableCell>{r.cantidad}</TableCell>
                      <TableCell className="text-sm text-slate-600">{r.instrucciones}</TableCell>
                      <TableCell>
                        <Badge variant={r.estado === 'dispensada' ? 'default' : 'secondary'}>
                          {r.estado}
                        </Badge>
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
