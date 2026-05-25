import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  AlertCircle,
  QrCode,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  X,
  Camera,
  RefreshCw,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";

/**
 * EscanearQR — página full-screen del farmacéutico.
 *
 * Usa la API low-level `Html5Qrcode` (no el `Scanner` con UI propia) para
 * controlar el video al 100 %. Sin `qrbox` el decoder escanea TODO el frame
 * del video — es lo que garantiza que SÍ lea el QR sin importar el tamaño
 * del recuadro visual.
 *
 * El QR codifica el ID numérico de la receta. Al leerlo, navega a
 * /pendientes?receta=<id>.
 */
export default function EscanearQR() {
  const navigate = useNavigate();
  const qrRef = useRef(null);
  const mountedRef = useRef(true);
  const lockRef = useRef(false); // evita disparar el handler 2× en el mismo lote

  const [fase, setFase] = useState("loading"); // loading | scanning | success | error
  const [mensaje, setMensaje] = useState(null);
  const [recetaId, setRecetaId] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [activeCamId, setActiveCamId] = useState(null);

  // Handler de decodificación — solo dispara una vez por sesión gracias a lockRef.
  const onDecoded = (decoded) => {
    console.log("[QR] decoded:", decoded);
    if (lockRef.current || !mountedRef.current) return;
    const id = String(decoded).trim();
    const qr = qrRef.current;
    if (!/^\d+$/.test(id)) {
      lockRef.current = true;
      setFase("error");
      setMensaje(`QR no reconocido (valor: "${id}")`);
      if (qr) qr.stop().catch(() => {});
      return;
    }
    lockRef.current = true;
    setRecetaId(id);
    setFase("success");
    setMensaje(`Receta #${id} encontrada — redirigiendo…`);
    if (qr) qr.stop().catch(() => {});
    setTimeout(() => {
      if (mountedRef.current) navigate(`/pendientes?receta=${id}`);
    }, 3500);
  };

  // Config base del decoder.
  const decoderConfig = {
    fps: 15,
    // disableFlip:false → analiza también la versión espejada del frame.
    // Cubre el caso de webcam frontal con mirror nativo del navegador.
    disableFlip: false,
    videoConstraints: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };

  // ────────── Arrancar la cámara ──────────
  // cameraSpec puede ser:
  //   - string (deviceId)
  //   - { facingMode: "environment" | "user" }   ← preferido
  const startCamera = async (cameraSpec, label = "") => {
    const qr = qrRef.current;
    if (!qr) return;
    console.log("[QR] start():", cameraSpec, label);
    try {
      await qr.start(cameraSpec, decoderConfig, onDecoded, () => {});
      // Comprueba dimensiones reales del video tras un breve delay.
      setTimeout(() => {
        const v = document.querySelector("#qr-reader-region video");
        if (v) {
          console.log(
            "[QR] video activo:",
            v.videoWidth + "×" + v.videoHeight,
            "readyState=" + v.readyState,
          );
        } else {
          console.warn("[QR] no se encontró <video> tras start()");
        }
      }, 800);
      if (mountedRef.current) setFase("scanning");
      return true;
    } catch (err) {
      console.error("[QR] start() falló:", err);
      throw err;
    }
  };

  // ────────── Mount: pide permiso, lista cámaras, arranca ──────────
  useEffect(() => {
    mountedRef.current = true;
    lockRef.current = false;

    // verbose:true → loguea en DevTools cada intento de decodificación.
    const qr = new Html5Qrcode("qr-reader-region", /* verbose */ true);
    qrRef.current = qr;

    (async () => {
      try {
        // 1) Permiso EXPLÍCITO. Sin esto, getCameras() en algunos navegadores
        //    devuelve labels vacíos y la detección "trasera/frontal" falla.
        console.log("[QR] solicitando permiso de cámara…");
        const probe = await navigator.mediaDevices.getUserMedia({
          video: true, audio: false,
        });
        probe.getTracks().forEach((t) => t.stop());
        console.log("[QR] permiso OK");

        // 2) Lista cámaras (alimenta el switcher de UI).
        const cams = await Html5Qrcode.getCameras();
        console.log("[QR] cámaras detectadas:", cams);
        if (!mountedRef.current) return;
        if (!cams || cams.length === 0) {
          setFase("error");
          setMensaje("No se detectó ninguna cámara en este dispositivo.");
          return;
        }
        setCameras(cams);
        setActiveCamId(cams[0].id);

        // 3) Arrancar con facingMode "environment" (trasera). Si falla,
        //    intentar "user" (frontal). Pasar facingMode directo es MÁS
        //    robusto que pasar deviceId — algunas plataformas (iOS Safari)
        //    rechazan deviceIds que se obtuvieron antes de permitir cámara.
        try {
          await startCamera({ facingMode: "environment" }, "environment");
        } catch {
          console.warn("[QR] environment falló, intentando user…");
          try {
            await startCamera({ facingMode: "user" }, "user");
          } catch {
            console.warn("[QR] user falló, intentando primer deviceId…");
            await startCamera(cams[0].id, cams[0].label);
          }
        }
      } catch (err) {
        console.error("[QR] setup falló:", err);
        if (!mountedRef.current) return;
        setFase("error");
        const msg = err?.message || "";
        if (/Permission|NotAllowed/i.test(err?.name + " " + msg)) {
          setMensaje(
            "Permiso de cámara denegado. Habilítalo en el navegador (icono de candado en la barra) y recarga.",
          );
        } else if (/NotFound/i.test(err?.name + " " + msg)) {
          setMensaje("No se detectó ninguna cámara conectada.");
        } else {
          setMensaje(msg || "No se pudo iniciar la cámara");
        }
      }
    })();

    return () => {
      mountedRef.current = false;
      const inst = qrRef.current;
      if (inst) {
        inst
          .stop()
          .catch(() => {})
          .finally(() => {
            try { inst.clear(); } catch {/* noop */}
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ────────── Cambio de cámara ──────────
  const switchCamera = async () => {
    if (cameras.length < 2 || !qrRef.current) return;
    const idx = cameras.findIndex((c) => c.id === activeCamId);
    const next = cameras[(idx + 1) % cameras.length];
    setActiveCamId(next.id);
    try { await qrRef.current.stop(); } catch {/* noop */}
    lockRef.current = false;
    setFase("loading");
    setMensaje(null);
    try {
      await startCamera(next.id, next.label);
      toast.success(`Cámara: ${next.label || "alterna"}`);
    } catch (err) {
      setFase("error");
      setMensaje(err?.message || "No se pudo cambiar de cámara");
    }
  };

  // ────────── Reintentar ──────────
  const reintentar = async () => {
    lockRef.current = false;
    setMensaje(null);
    setRecetaId(null);
    setFase("loading");
    try {
      await startCamera({ facingMode: "environment" }, "environment");
    } catch {
      try {
        await startCamera({ facingMode: "user" }, "user");
      } catch (err) {
        setFase("error");
        setMensaje(err?.message || "No se pudo reiniciar la cámara");
      }
    }
  };

  const cerrar = () => navigate(-1);

  return (
    <>
      {/* CSS scoped: el video del library debe LLENAR su contenedor. */}
      <style>{`
        #qr-reader-region {
          width: 100% !important;
          height: 100% !important;
          background: #000;
          overflow: hidden;
        }
        #qr-reader-region video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          display: block !important;
          /* SIN transform: el video se muestra tal como lo entrega el stream,
             para que lo que ves coincida 1:1 con lo que el decoder analiza. */
        }
        /* Ocultar cualquier overlay propio que pueda inyectar la libreria. */
        #qr-reader-region__scan_region,
        #qr-reader-region__dashboard {
          display: none !important;
        }
      `}</style>

      {/* CONTENEDOR FULL-SCREEN */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex flex-col"
        style={{ background: "#000" }}
      >
        {/* Video + region en background absoluto */}
        <div className="absolute inset-0">
          <div id="qr-reader-region" />
        </div>

        {/* Vignette superior e inferior para legibilidad de los chips */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-32 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,18,32,0.85) 0%, transparent 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
          style={{
            background:
              "linear-gradient(0deg, rgba(11,18,32,0.85) 0%, transparent 100%)",
          }}
        />

        {/* HEADER overlay */}
        <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-5">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "rgba(10,132,255,0.20)",
                border: "1px solid rgba(79,209,197,0.45)",
                backdropFilter: "blur(10px)",
              }}
            >
              <QrCode size={18} style={{ color: "#4FD1C5" }} />
            </div>
            <div className="min-w-0">
              <div
                className="text-[10.5px] font-mono font-semibold uppercase tracking-wider"
                style={{ color: "#4FD1C5", letterSpacing: "0.08em" }}
              >
                Farmacéutico · Escáner
              </div>
              <h1
                className="font-heading text-lg sm:text-xl truncate"
                style={{ color: "#fff" }}
              >
                Escanear receta
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                title="Cambiar de cámara"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.20)",
                  color: "#fff",
                  backdropFilter: "blur(10px)",
                }}
              >
                <Camera size={13} /> {cameras.length}
              </button>
            )}
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar escáner"
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.20)",
                color: "#fff",
                backdropFilter: "blur(10px)",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Cuerpo: nada más que el video ya está detrás */}
        <main className="relative flex-1" />

        {/* Cuando la cámara está activa: entry animation cinemática.
            Las esquinas VUELAN desde fuera, un radar pulsa una vez en el
            centro, y la scan line aparece con fade después de la entrada. */}
        {fase === "scanning" && (
          <>
            <CornerEntry pos="top-left"     delay={0.0}  />
            <CornerEntry pos="top-right"    delay={0.05} />
            <CornerEntry pos="bottom-left"  delay={0.10} />
            <CornerEntry pos="bottom-right" delay={0.15} />

            {/* Radar pulse — un solo pulso grande al abrir */}
            <motion.span
              aria-hidden
              className="absolute rounded-full pointer-events-none"
              initial={{ scale: 0.2, opacity: 0.8 }}
              animate={{ scale: 3.5, opacity: 0 }}
              transition={{ duration: 1.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{
                top: "50%", left: "50%",
                marginTop: -100, marginLeft: -100,
                width: 200, height: 200,
                border: "2px solid rgba(79,209,197,0.85)",
                boxShadow: "0 0 36px rgba(79,209,197,0.55)",
                zIndex: 8,
              }}
            />

            {/* Línea de escaneo: aparece DESPUÉS de las esquinas con fade */}
            <motion.div
              aria-hidden
              className="absolute pointer-events-none z-10"
              initial={{ opacity: 0, top: "20%" }}
              animate={{
                opacity: 1,
                top: ["20%", "78%", "20%"],
              }}
              transition={{
                opacity: { duration: 0.4, delay: 0.5 },
                top: { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
              }}
              style={{
                left: "10%",
                right: "10%",
                height: 2,
                background:
                  "linear-gradient(90deg, transparent 0%, #4FD1C5 20%, #0A84FF 50%, #4FD1C5 80%, transparent 100%)",
                boxShadow:
                  "0 0 24px rgba(79,209,197,0.85), 0 0 48px rgba(10,132,255,0.55)",
                borderRadius: 999,
              }}
            />
          </>
        )}

        {/* FOOTER overlay con instrucciones / estado */}
        <footer className="relative z-20 px-4 sm:px-6 pb-5 sm:pb-6">
          <AnimatePresence mode="wait">
            {fase === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full max-w-fit mx-auto"
                style={{
                  background: "rgba(11,18,32,0.72)",
                  border: "1px solid rgba(79,209,197,0.40)",
                  backdropFilter: "blur(10px)",
                  color: "#4FD1C5",
                }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                >
                  <RefreshCw size={13} />
                </motion.div>
                <span className="text-xs font-mono font-semibold uppercase tracking-wider">
                  Iniciando cámara…
                </span>
              </motion.div>
            )}

            {fase === "scanning" && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3"
              >
                <motion.div
                  animate={{ opacity: [0.65, 1, 0.65] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider"
                  style={{
                    background: "rgba(11,18,32,0.72)",
                    border: "1px solid rgba(79,209,197,0.50)",
                    color: "#4FD1C5",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <ScanLine size={12} /> Buscando QR…
                </motion.div>
                <p
                  className="text-[12.5px] text-center max-w-sm"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  Apunta la cámara al código QR de la receta del paciente.
                  Mantenlo enfocado y bien iluminado.
                </p>
              </motion.div>
            )}

            {fase === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3 p-3.5 rounded-2xl max-w-xl mx-auto"
                style={{
                  background: "rgba(180,35,24,0.18)",
                  border: "1px solid rgba(255,59,48,0.45)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <AlertCircle
                  size={20}
                  style={{ color: "#FCA5A5" }}
                  className="shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: "#fff" }}>
                    No se pudo escanear
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.78)" }}>
                    {mensaje}
                  </div>
                </div>
                <button
                  onClick={reintentar}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shrink-0 text-xs font-semibold"
                  style={{
                    background: "rgba(255,255,255,0.92)",
                    color: "#B42318",
                    border: "1px solid rgba(255,255,255,0.50)",
                  }}
                >
                  <RotateCcw size={12} /> Reintentar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </footer>

        {/* OVERLAY DE ÉXITO con la animación celebratoria */}
        <AnimatePresence>
          {fase === "success" && <SuccessOverlay recetaId={recetaId} />}
        </AnimatePresence>
      </motion.div>
    </>
  );
}

// ────────────────────────── PIEZAS VISUALES ──────────────────────────

// Variante animada: las esquinas vuelan desde fuera del viewport al abrir
// la cámara, dando sensación de "calibración" cinematográfica.
function CornerEntry({ pos, delay = 0 }) {
  const baseStyle = cornerStyleFor(pos);
  const fromMap = {
    "top-left":     { x: -120, y: -120 },
    "top-right":    { x:  120, y: -120 },
    "bottom-left":  { x: -120, y:  120 },
    "bottom-right": { x:  120, y:  120 },
  };
  return (
    <motion.span
      aria-hidden
      initial={{ ...fromMap[pos], opacity: 0, scale: 0.6 }}
      animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      style={baseStyle}
    />
  );
}

function cornerStyleFor(pos) {
  const base = {
    position: "absolute",
    width: 110,
    height: 110,
    borderColor: "#4FD1C5",
    borderStyle: "solid",
    borderWidth: 0,
    pointerEvents: "none",
    zIndex: 9,
    filter: "drop-shadow(0 0 14px rgba(79,209,197,0.75))",
  };
  const inset = "5%";
  const map = {
    "top-left":     { top: inset, left: inset,   borderTopWidth: 5, borderLeftWidth: 5,    borderTopLeftRadius: 18 },
    "top-right":    { top: inset, right: inset,  borderTopWidth: 5, borderRightWidth: 5,   borderTopRightRadius: 18 },
    "bottom-left":  { bottom: inset, left: inset, borderBottomWidth: 5, borderLeftWidth: 5,  borderBottomLeftRadius: 18 },
    "bottom-right": { bottom: inset, right: inset, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 18 },
  };
  return { ...base, ...map[pos] };
}

function CornerOverlay({ pos }) {
  // Esquinas más grandes y más cerca de los bordes — el "cuadro de captura"
  // visualmente cubre casi toda la pantalla.
  const base = {
    position: "absolute",
    width: 110,
    height: 110,
    borderColor: "#4FD1C5",
    borderStyle: "solid",
    borderWidth: 0,
    pointerEvents: "none",
    zIndex: 9,
    filter: "drop-shadow(0 0 14px rgba(79,209,197,0.75))",
  };
  const inset = "5%";
  const map = {
    "top-left": {
      top: inset, left: inset,
      borderTopWidth: 5, borderLeftWidth: 5,
      borderTopLeftRadius: 18,
    },
    "top-right": {
      top: inset, right: inset,
      borderTopWidth: 5, borderRightWidth: 5,
      borderTopRightRadius: 18,
    },
    "bottom-left": {
      bottom: inset, left: inset,
      borderBottomWidth: 5, borderLeftWidth: 5,
      borderBottomLeftRadius: 18,
    },
    "bottom-right": {
      bottom: inset, right: inset,
      borderBottomWidth: 5, borderRightWidth: 5,
      borderBottomRightRadius: 18,
    },
  };
  return <span aria-hidden style={{ ...base, ...map[pos] }} />;
}

// ─────────────────────────── SUCCESS OVERLAY ────────────────────────────
// Secuencia coreografiada (todos los tiempos en segundos):
//   0.00 → flash blanco (180ms)              ← efecto "captura de cámara"
//   0.00 → backdrop blur + radial gradient
//   0.05 → 4 lock-on corners agarran el centro
//   0.18 → 12 beams radiales rotando como sol
//   0.20 → 4 shockwaves concéntricas
//   0.30 → halo verde + check con spring rebote
//   0.45 → 28 confetti caen con física
//   0.55 → 8 sparkles emanando
//   0.65 → chip "QR verificado" fade-in
//   0.75 → número de receta con scale impactante
//   0.95 → "Redirigiendo…" + barra de progreso (1.4s)
const CONFETTI_COLORS = ["#4FD1C5", "#0A84FF", "#00A870", "#F6AD55", "#A78BFA", "#FCA5A5"];
const CONFETTI_PIECES = 28;
const BEAM_COUNT = 12;
const SPARK_COUNT = 8;

function SuccessOverlay({ recetaId }) {
  console.log("[QR] SuccessOverlay render, recetaId=", recetaId);
  return (
    <motion.div
      key="success-overlay"
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{ zIndex: 100 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* ▸ Backdrop con gradiente + blur — capa base */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{
          background:
            "radial-gradient(circle at center, rgba(0,168,112,0.32) 0%, rgba(11,18,32,0.96) 70%)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      />

      {/* ▸ FLASH blanco — efecto cámara fotográfica (0.18s) */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.18, times: [0, 0.25, 1] }}
        style={{ background: "#ffffff" }}
      />

      {/* ▸ LOCK-ON corners — 4 esquinas verdes "agarran" el centro */}
      <LockOnCorners />

      {/* ▸ BEAMS radiales rotando como rayos de sol */}
      <BeamsBurst />

      {/* ▸ SHOCKWAVES — 4 anillos con stagger */}
      {[0, 0.14, 0.28, 0.42].map((delay, i) => (
        <motion.span
          key={`ring-${i}`}
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          initial={{ scale: 0.15, opacity: 0.9 }}
          animate={{ scale: 5.2, opacity: 0 }}
          transition={{
            duration: 1.6,
            delay: 0.2 + delay,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            width: 220,
            height: 220,
            border: `${i === 0 ? 3 : 2}px solid rgba(79,209,197,${0.9 - i * 0.15})`,
            boxShadow: "0 0 48px rgba(79,209,197,0.55)",
          }}
        />
      ))}

      {/* ▸ HALO radial detrás del check */}
      <motion.div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1.05, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: 360,
          height: 360,
          background:
            "radial-gradient(circle, rgba(79,209,197,0.45) 0%, rgba(0,168,112,0.20) 40%, transparent 70%)",
          filter: "blur(14px)",
        }}
      />

      {/* ▸ CHECK central — spring con rotación inicial */}
      <motion.div
        className="relative z-10"
        initial={{ scale: 0, rotate: -90, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 14,
          delay: 0.3,
        }}
      >
        <motion.div
          className="rounded-full flex items-center justify-center relative"
          // Pulso continuo sutil después de aparecer
          animate={{
            boxShadow: [
              "0 22px 56px rgba(0,168,112,0.60), 0 0 0 0 rgba(79,209,197,0.55)",
              "0 22px 56px rgba(0,168,112,0.60), 0 0 0 18px rgba(79,209,197,0)",
              "0 22px 56px rgba(0,168,112,0.60), 0 0 0 0 rgba(79,209,197,0.55)",
            ],
          }}
          transition={{ duration: 1.6, delay: 0.7, repeat: Infinity, ease: "easeOut" }}
          style={{
            width: 150,
            height: 150,
            background: "linear-gradient(135deg, #00A870 0%, #00775A 100%)",
          }}
        >
          {/* Highlight superior sutil */}
          <span
            aria-hidden
            className="absolute pointer-events-none rounded-full"
            style={{
              inset: 6,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.32) 0%, transparent 50%)",
              opacity: 0.7,
            }}
          />
          {/* Check con stroke "dibujándose" */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.5, ease: "backOut" }}
          >
            <CheckCircle size={74} color="#fff" strokeWidth={2.6} />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* ▸ SPARKLES emanando del centro */}
      {Array.from({ length: SPARK_COUNT }, (_, i) => {
        const deg = (360 / SPARK_COUNT) * i;
        const dist = 180;
        return (
          <motion.span
            key={`spark-${i}`}
            aria-hidden
            className="absolute"
            initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
            animate={{
              scale: [0, 1.3, 0.7, 0],
              opacity: [0, 1, 1, 0],
              x: Math.cos((deg * Math.PI) / 180) * dist,
              y: Math.sin((deg * Math.PI) / 180) * dist,
              rotate: 180,
            }}
            transition={{
              duration: 1.2,
              delay: 0.55 + i * 0.03,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{ color: "#4FD1C5" }}
          >
            <Sparkles size={22} />
          </motion.span>
        );
      })}

      {/* ▸ CONFETTI cayendo con física */}
      <Confetti />

      {/* ▸ TEXTO con stagger */}
      <motion.div
        className="relative z-10 mt-8 flex flex-col items-center gap-3"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.12, delayChildren: 0.65 } },
        }}
      >
        {/* Chip */}
        <motion.div
          variants={textChildVariant}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider"
          style={{
            background: "rgba(79,209,197,0.20)",
            border: "1px solid rgba(79,209,197,0.55)",
            color: "#4FD1C5",
            backdropFilter: "blur(8px)",
          }}
        >
          <ShieldCheck size={13} /> QR verificado
        </motion.div>

        {/* Número de receta con pop scale */}
        <motion.h2
          variants={{
            hidden: { opacity: 0, scale: 0.5, y: 18 },
            show: {
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { type: "spring", stiffness: 320, damping: 18 },
            },
          }}
          className="font-heading text-center"
          style={{
            color: "#fff",
            fontSize: "clamp(2.4rem, 5vw, 3.6rem)",
            lineHeight: 1,
            letterSpacing: "-0.025em",
            textShadow: "0 8px 32px rgba(0,168,112,0.65)",
          }}
        >
          Receta{" "}
          <span style={{ color: "#4FD1C5", fontVariantNumeric: "tabular-nums" }}>
            #{recetaId}
          </span>
        </motion.h2>

        {/* Subtítulo */}
        <motion.p
          variants={textChildVariant}
          className="text-sm font-mono flex items-center gap-2"
          style={{ color: "rgba(255,255,255,0.78)" }}
        >
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            ●
          </motion.span>
          Redirigiendo a pendientes…
        </motion.p>
      </motion.div>

      {/* ▸ BARRA de progreso sincronizada con navigate (2.2s) */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[3px] origin-left z-10"
        style={{
          background:
            "linear-gradient(90deg, #4FD1C5 0%, #0A84FF 50%, #00A870 100%)",
          boxShadow: "0 0 18px rgba(79,209,197,0.85)",
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 3.4, ease: "linear", delay: 0.05 }}
      />
    </motion.div>
  );
}

const textChildVariant = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

// 4 esquinas verdes que vienen desde las esquinas reales del overlay y se
// "cierran" sobre el centro — efecto lock-on de mira de cámara.
function LockOnCorners() {
  const corners = [
    { from: { x: "-60vw", y: "-60vh" }, pos: "top-left",     border: "borderTopWidth borderLeftWidth",   radius: "borderTopLeftRadius" },
    { from: { x:  "60vw", y: "-60vh" }, pos: "top-right",    border: "borderTopWidth borderRightWidth",  radius: "borderTopRightRadius" },
    { from: { x: "-60vw", y:  "60vh" }, pos: "bottom-left",  border: "borderBottomWidth borderLeftWidth", radius: "borderBottomLeftRadius" },
    { from: { x:  "60vw", y:  "60vh" }, pos: "bottom-right", border: "borderBottomWidth borderRightWidth", radius: "borderBottomRightRadius" },
  ];
  const styleFor = (c) => {
    const out = {
      position: "absolute",
      width: 80,
      height: 80,
      borderColor: "#4FD1C5",
      borderStyle: "solid",
      borderWidth: 0,
      filter: "drop-shadow(0 0 12px rgba(79,209,197,0.85))",
      pointerEvents: "none",
    };
    const { pos } = c;
    if (pos === "top-left")     return { ...out, borderTopWidth: 5, borderLeftWidth: 5,   borderTopLeftRadius: 18, top: "16%", left: "14%" };
    if (pos === "top-right")    return { ...out, borderTopWidth: 5, borderRightWidth: 5,  borderTopRightRadius: 18, top: "16%", right: "14%" };
    if (pos === "bottom-left")  return { ...out, borderBottomWidth: 5, borderLeftWidth: 5,  borderBottomLeftRadius: 18, bottom: "16%", left: "14%" };
    if (pos === "bottom-right") return { ...out, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 18, bottom: "16%", right: "14%" };
    return out;
  };
  return corners.map((c, i) => (
    <motion.span
      key={`lock-${c.pos}`}
      aria-hidden
      initial={{ ...c.from, opacity: 0, scale: 0.4 }}
      animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
      transition={{
        duration: 0.55,
        delay: 0.05 + i * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={styleFor(c)}
    />
  ));
}

// 12 rayos saliendo radialmente del centro, escalan y se desvanecen.
function BeamsBurst() {
  return Array.from({ length: BEAM_COUNT }, (_, i) => {
    const rotation = (360 / BEAM_COUNT) * i;
    return (
      <motion.span
        key={`beam-${i}`}
        aria-hidden
        className="absolute pointer-events-none"
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: [0, 1, 0.85, 0], opacity: [0, 0.95, 0.6, 0] }}
        transition={{
          duration: 1.1,
          delay: 0.18 + (i % 3) * 0.05,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          width: 4,
          height: 280,
          transformOrigin: "bottom center",
          transform: `translate(-50%, -100%) rotate(${rotation}deg)`,
          left: "50%",
          top: "50%",
          background:
            "linear-gradient(to top, rgba(79,209,197,0) 0%, rgba(79,209,197,0.85) 50%, rgba(255,255,255,0.95) 100%)",
          filter: "blur(0.5px) drop-shadow(0 0 8px rgba(79,209,197,0.85))",
          borderRadius: 999,
        }}
      />
    );
  });
}

// Confetti — 28 piezas con colores variados que caen rebotando levemente.
function Confetti() {
  // Generamos posiciones/colores estables por monto.
  const pieces = Array.from({ length: CONFETTI_PIECES }, (_, i) => {
    const seed = i * 9301 + 49297;
    const rand = (k) => {
      const x = Math.sin(seed * k) * 10000;
      return x - Math.floor(x);
    };
    return {
      i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: `${rand(1.1) * 100}%`,
      delay: 0.4 + rand(1.3) * 0.6,
      duration: 1.2 + rand(1.7) * 0.9,
      drift: (rand(2.3) - 0.5) * 160,
      rot: (rand(3.1) - 0.5) * 720,
      size: 6 + rand(4.5) * 8,
      shape: i % 3, // 0:square 1:circle 2:rect
    };
  });
  return pieces.map((p) => (
    <motion.span
      key={`confetti-${p.i}`}
      aria-hidden
      className="absolute pointer-events-none"
      initial={{
        top: "-8%",
        left: p.left,
        opacity: 0,
        rotate: 0,
        x: 0,
      }}
      animate={{
        top: "108%",
        opacity: [0, 1, 1, 0],
        rotate: p.rot,
        x: p.drift,
      }}
      transition={{
        duration: p.duration,
        delay: p.delay,
        ease: [0.22, 1, 0.36, 1],
        opacity: { times: [0, 0.15, 0.8, 1] },
      }}
      style={{
        width: p.shape === 2 ? p.size * 1.8 : p.size,
        height: p.size,
        background: p.color,
        borderRadius: p.shape === 1 ? "50%" : 2,
        boxShadow: `0 0 8px ${p.color}66`,
      }}
    />
  ));
}
