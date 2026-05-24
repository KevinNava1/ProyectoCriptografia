import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import VerificarEmail from "./pages/VerificarEmail";
import RecuperarPassword from "./pages/RecuperarPassword";
import Dashboard from "./pages/Dashboard";
import Estadisticas from "./pages/Estadisticas";
import MisRecetas from "./pages/MisRecetas";
import Verificar from "./pages/Verificar";
import NuevaReceta from "./pages/NuevaReceta";
import MisEmitidas from "./pages/MisEmitidas";
import Pendientes from "./pages/Pendientes";
import EscanearQR from "./pages/EscanearQR";
import TicketsDispensacion from "./pages/TicketsDispensacion";
import AdminSolicitudes from "./pages/AdminSolicitudes";
import AppLayout from "./components/layout/AppLayout";
import CursorGlow from "./components/ui/CursorGlow";
import SplashScreen from "./components/ui/SplashScreen";
import RouteLoader from "./components/ui/RouteLoader";
import CommandPalette from "./components/ui/CommandPalette";
import FloatingActions from "./components/ui/FloatingActions";
import { useAuthStore } from "./store/useAuthStore";

function Protected({ children, roles }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.rol))
    return <Navigate to="/dashboard" replace />;
  return children;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/verificar-email" element={<VerificarEmail />} />
        <Route path="/recuperar-password" element={<RecuperarPassword />} />
        <Route element={<AppLayout />}>
          <Route
            path="/dashboard"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/estadisticas"
            element={
              <Protected roles={["paciente", "medico", "farmaceutico"]}>
                <Estadisticas />
              </Protected>
            }
          />
          <Route
            path="/mis-recetas"
            element={
              <Protected roles={["paciente"]}>
                <MisRecetas />
              </Protected>
            }
          />
          <Route
            path="/verificar"
            element={
              <Protected roles={["paciente"]}>
                <Verificar />
              </Protected>
            }
          />
          <Route
            path="/nueva-receta"
            element={
              <Protected roles={["medico"]}>
                <NuevaReceta />
              </Protected>
            }
          />
          <Route
            path="/mis-emitidas"
            element={
              <Protected roles={["medico"]}>
                <MisEmitidas />
              </Protected>
            }
          />
          <Route
            path="/pendientes"
            element={
              <Protected roles={["farmaceutico"]}>
                <Pendientes />
              </Protected>
            }
          />
          <Route
            path="/escanear"
            element={
              <Protected roles={["farmaceutico"]}>
                <EscanearQR />
              </Protected>
            }
          />
          <Route
            path="/dispensaciones"
            element={
              <Protected roles={["paciente", "farmaceutico", "medico"]}>
                <TicketsDispensacion />
              </Protected>
            }
          />
          <Route
            path="/admin/solicitudes"
            element={
              <Protected roles={["admin"]}>
                <AdminSolicitudes />
              </Protected>
            }
          />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

// Splash visible solo en el primer paint del bundle. Si el usuario navega
// dentro de la SPA, ya pasó — pequeño flag en sessionStorage para no repetir
// en cada full-reload de development (pero sí cuando abre la app nueva).
function useFirstLoad() {
  const [done, setDone] = useState(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem("securerx-splashed") === "1";
  });
  useEffect(() => {
    if (done) return;
    sessionStorage.setItem("securerx-splashed", "1");
  }, [done]);
  return { splashing: !done, finish: () => setDone(true) };
}

export default function App() {
  const { splashing, finish } = useFirstLoad();
  return (
    <BrowserRouter>
      {splashing && <SplashScreen onDone={finish} />}
      <CursorGlow />
      <RouteLoader />
      <CommandPalette />
      <FloatingActions />
      <AnimatedRoutes />
      <Toaster
        theme="light"
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(10,132,255,0.25)",
            color: "#0B2443",
            boxShadow: "0 10px 30px rgba(10,36,67,0.10)",
          },
        }}
      />
    </BrowserRouter>
  );
}
