import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import MedicoDashboard from './pages/MedicoDashboard'
import PacienteDashboard from './pages/PacienteDashboard'
import FarmaceuticoDashboard from './pages/FarmaceuticoDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/medico" element={<MedicoDashboard />} />
        <Route path="/paciente" element={<PacienteDashboard />} />
        <Route path="/farmaceutico" element={<FarmaceuticoDashboard />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
