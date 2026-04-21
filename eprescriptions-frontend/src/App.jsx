import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import Login from './pages/Login'
import Registro from './pages/Registro'
import Dashboard from './pages/Dashboard'
import MisRecetas from './pages/MisRecetas'
import Verificar from './pages/Verificar'
import NuevaReceta from './pages/NuevaReceta'
import Pendientes from './pages/Pendientes'
import AppLayout from './components/layout/AppLayout'
import CursorGlow from './components/ui/CursorGlow'
import { useAuthStore } from './store/useAuthStore'

function Protected({ children, roles }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.rol)) return <Navigate to="/dashboard" replace />
  return children
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/mis-recetas" element={<Protected roles={['paciente']}><MisRecetas /></Protected>} />
          <Route path="/verificar"   element={<Protected roles={['paciente']}><Verificar /></Protected>} />
          <Route path="/nueva-receta" element={<Protected roles={['medico']}><NuevaReceta /></Protected>} />
          <Route path="/pendientes" element={<Protected roles={['farmaceutico']}><Pendientes /></Protected>} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <CursorGlow />
      <AnimatedRoutes />
      <Toaster
        theme="light"
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(10,132,255,0.25)',
            color: '#0B2443',
            boxShadow: '0 10px 30px rgba(10,36,67,0.10)',
          },
        }}
      />
    </BrowserRouter>
  )
}
