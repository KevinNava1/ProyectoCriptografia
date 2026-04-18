import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { registrarUsuario } from '@/lib/api'

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    nombre: '', email: '', password: '', rol: 'medico'
  })

  const handleRegistro = async (rol) => {
    setLoading(true)
    try {
      const datos = { ...form, rol }
      const resp = await registrarUsuario(datos)
      // Guardar info del usuario en sessionStorage
      sessionStorage.setItem('usuario', JSON.stringify({
        id: resp.id, nombre: resp.nombre, rol: resp.rol,
        llave_privada: resp.llave_privada || null
      }))
      navigate(`/${rol}`)
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Secure e-prescriptions</CardTitle>
          <CardDescription>Sistema seguro de recetas médicas</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="medico" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="medico">Médico</TabsTrigger>
              <TabsTrigger value="paciente">Paciente</TabsTrigger>
              <TabsTrigger value="farmaceutico">Farmacia</TabsTrigger>
            </TabsList>

            {['medico', 'paciente', 'farmaceutico'].map((rol) => (
              <TabsContent key={rol} value={rol} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Nombre completo</Label>
                  <Input
                    placeholder="Dr. Garcia"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contraseña</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleRegistro(rol)}
                  disabled={loading || !form.nombre || !form.email || !form.password}
                >
                  {loading ? 'Registrando...' : `Registrarse como ${rol}`}
                </Button>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}