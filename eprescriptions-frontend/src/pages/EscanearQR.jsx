import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  CheckCircle,
  AlertCircle,
  QrCode,
  RotateCcw,
} from "lucide-react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import PageTransition from "../components/ui/PageTransition";
import SecureCard from "../components/ui/SecureCard";

/**
 * EscanearQR — página exclusiva del farmacéutico.
 *
 * Usa html5-qrcode para leer el QR de la receta con la cámara.
 * El QR codifica el ID numérico de la receta.
 * Al leerlo, navega a /pendientes?receta=<id> para que Pendientes
 * arranque la búsqueda automáticamente.
 */
export default function EscanearQR() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const mountedRef = useRef(true);

  const [fase, setFase] = useState("scanning"); // "scanning" | "success" | "error"
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    mountedRef.current = true;
    let scanner = null;
    let isDestroying = false;

    // Retrasamos la inicialización ligeramente para dar tiempo a que
    // cualquier ciclo previo termine de limpiar el DOM.
    const timer = setTimeout(() => {
      // Verificamos que el contenedor exista y esté vacío antes de inicializar
      const container = document.getElementById("qr-reader-container");
      if (!container || container.innerHTML !== "") return;

      scanner = new Html5QrcodeScanner(
        "qr-reader-container",
        {
          fps: 12,
          qrbox: { width: 240, height: 240 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
        },
        false,
      );

      scanner.render(
        (decoded) => {
          if (!mountedRef.current || isDestroying) return;
          const id = decoded.trim();

          if (!/^\d+$/.test(id)) {
            setFase("error");
            setMensaje(`QR no reconocido (valor: "${id}")`);
            isDestroying = true;
            scanner.clear().catch(() => {});
            return;
          }

          setFase("success");
          setMensaje(`Receta #${id} encontrada — redirigiendo…`);
          isDestroying = true;
          scanner.clear().catch(() => {});

          setTimeout(() => {
            if (mountedRef.current) navigate(`/pendientes?receta=${id}`);
          }, 900);
        },
        () => {},
      );

      scannerRef.current = scanner;
    }, 50); // 50ms son suficientes para eludir el Strict Mode

    return () => {
      mountedRef.current = false;
      isDestroying = true;
      clearTimeout(timer);
      if (scanner) {
        scanner.clear().catch(() => {});
      }
    };
  }, [navigate]);

  const reintentar = () => {
    setFase("scanning");
    setMensaje(null);
    // Remontar el scanner limpiando y volviendo a renderizar
    const scanner = scannerRef.current;
    if (!scanner) return;
    scanner
      .clear()
      .catch(() => {})
      .finally(() => {
        scanner.render(
          (decoded) => {
            const id = decoded.trim();
            if (!/^\d+$/.test(id)) {
              setFase("error");
              setMensaje(`QR no reconocido (valor: "${id}")`);
              scanner.clear().catch(() => {});
              return;
            }
            setFase("success");
            setMensaje(`Receta #${id} encontrada — redirigiendo…`);
            scanner.clear().catch(() => {});
            setTimeout(() => {
              if (mountedRef.current) navigate(`/pendientes?receta=${id}`);
            }, 900);
          },
          () => {},
        );
      });
  };

  return (
    <PageTransition>
      <div className="space-y-6 max-w-lg mx-auto">
        {/* Header */}
        <header>
          <div className="label-xs">Farmacéutico · Escáner</div>
          <h1 className="font-heading text-3xl md:text-4xl mt-2 flex items-center gap-3">
            <QrCode className="text-[color:var(--cyan)]" />
            Escanear receta
          </h1>
          <p className="text-[color:var(--text-secondary)] text-sm mt-2">
            Apunta la cámara al código QR de la receta del paciente para
            encontrarla al instante.
          </p>
        </header>

        {/* Área del escáner */}
        <SecureCard hover={false}>
          {/* Feedback de estado */}
          <AnimatePresence mode="wait">
            {fase === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 p-3 mb-4 rounded-xl"
                style={{
                  background: "rgba(0,168,112,0.08)",
                  border: "1px solid rgba(0,168,112,0.30)",
                }}
              >
                <CheckCircle
                  size={18}
                  style={{ color: "#00A870" }}
                  className="shrink-0"
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: "#00775A" }}
                >
                  {mensaje}
                </span>
              </motion.div>
            )}
            {fase === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 p-3 mb-4 rounded-xl"
                style={{
                  background: "rgba(255,59,48,0.08)",
                  border: "1px solid rgba(255,59,48,0.30)",
                }}
              >
                <AlertCircle
                  size={18}
                  style={{ color: "#FF3B30" }}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm" style={{ color: "#C0392B" }}>
                    {mensaje}
                  </span>
                </div>
                <button
                  onClick={reintentar}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg shrink-0"
                  style={{
                    background: "rgba(255,59,48,0.10)",
                    color: "#C0392B",
                    border: "1px solid rgba(255,59,48,0.25)",
                  }}
                >
                  <RotateCcw size={11} /> Reintentar
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Contenedor donde html5-qrcode inyecta su UI */}
          <div
            id="qr-reader-container"
            className="rounded-xl overflow-hidden"
            style={{ minHeight: 300 }}
          />

          {fase === "scanning" && (
            <div
              className="flex items-center gap-2 mt-4 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              <Camera size={13} />
              Asegúrate de dar permiso de cámara al navegador
            </div>
          )}
        </SecureCard>

        {/* Instrucciones */}
        <div
          className="p-4 rounded-xl text-sm space-y-2"
          style={{
            background: "rgba(10,132,255,0.04)",
            border: "1px solid rgba(10,132,255,0.18)",
          }}
        >
          <div className="label-xs mb-2">¿Cómo funciona?</div>
          <ol
            className="space-y-1.5 list-decimal list-inside"
            style={{ color: "var(--text-secondary)" }}
          >
            <li>El paciente abre su receta en "Mis recetas" y muestra el QR</li>
            <li>Apunta esta cámara al código</li>
            <li>El sistema busca y carga la receta automáticamente</li>
          </ol>
        </div>
      </div>
    </PageTransition>
  );
}
