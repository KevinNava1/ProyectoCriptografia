import { useCallback } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Download, QrCode, ScanLine } from "lucide-react";

/**
 * QRReceta — muestra el QR de una receta para que el paciente lo guarde.
 *
 * El QR codifica solo el ID numérico de la receta.
 * El farmacéutico lo escanea con EscanearQR y el sistema busca la receta.
 *
 * Props:
 *   recetaId — número/string, id de la receta
 *   size     — tamaño en px del QR (default 180; en modal usar 220-260)
 */
export default function QRReceta({ recetaId, size = 180 }) {
  const svgId = `qr-rx-${recetaId}`;

  const descargar = useCallback(() => {
    const svgEl = document.getElementById(svgId);
    if (!svgEl) return;

    // QUIET ZONE obligatoria — los lectores QR (incluido html5-qrcode) exigen
    // un margen blanco de ≥4 módulos alrededor de la matriz. Sin él, escaneos
    // desde PNG impreso fallan. Lienzo 640 con 80px (12.5%) de margen → QR
    // efectivo 480×480 centrado sobre fondo blanco.
    const SIZE = 640;
    const PADDING = 80;
    const QR_SIZE = SIZE - PADDING * 2;

    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");

    // Fondo blanco completo → es la quiet zone.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      // Pintamos el QR CENTRADO con padding alrededor.
      ctx.drawImage(img, PADDING, PADDING, QR_SIZE, QR_SIZE);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `receta-${recetaId}-qr.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  }, [svgId, recetaId]);

  return (
    <div
      className="flex flex-col items-center gap-4 p-5 rounded-2xl relative overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #F4FAFF 0%, #E8F2FE 60%, #DCEBFD 100%)",
        border: "1px solid rgba(10,132,255,0.32)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.75), 0 8px 28px rgba(10,36,67,0.10)",
      }}
    >
      {/* Halo decorativo (fondo) para reforzar contraste sin estorbar */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "-40%",
          right: "-15%",
          width: 240,
          height: 240,
          background:
            "radial-gradient(circle, rgba(10,132,255,0.18), transparent 65%)",
          filter: "blur(28px)",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: "-30%",
          left: "-15%",
          width: 220,
          height: 220,
          background:
            "radial-gradient(circle, rgba(0,168,112,0.12), transparent 65%)",
          filter: "blur(28px)",
        }}
      />

      {/* Header con label visible (peso medio + color oscuro) */}
      <div className="relative z-10 flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: "rgba(10,132,255,0.14)",
              border: "1px solid rgba(10,132,255,0.36)",
            }}
          >
            <QrCode size={14} style={{ color: "#0A4FB3" }} />
          </div>
          <div className="min-w-0">
            <div
              className="text-[10.5px] font-semibold uppercase tracking-wider"
              style={{ color: "#0A4FB3", letterSpacing: "0.08em" }}
            >
              Código QR
            </div>
            <div
              className="text-xs font-mono"
              style={{ color: "#0B2443", fontWeight: 600 }}
            >
              Receta #{recetaId}
            </div>
          </div>
        </div>
        <span
          className="text-[10px] font-mono px-2 py-1 rounded-md"
          style={{
            background: "rgba(10,132,255,0.10)",
            border: "1px solid rgba(10,132,255,0.30)",
            color: "#0A4FB3",
            fontWeight: 600,
          }}
        >
          ID-only
        </span>
      </div>

      {/* QR sobre fondo blanco sólido con esquinas tipo "framecorners" */}
      <div className="relative z-10">
        <div
          className="p-4 rounded-2xl relative"
          style={{
            background: "#ffffff",
            boxShadow:
              "0 10px 32px rgba(10,36,67,0.18), 0 0 0 1px rgba(10,132,255,0.18)",
          }}
        >
          <QRCodeSVG
            id={svgId}
            value={String(recetaId)}
            size={size}
            // level="Q" (25% error correction) → tolera mejor manchas/borrones
            // en impresión y captura por cámara que el "M" anterior.
            level="Q"
            // Quiet zone built-in: el SVG ya incluye los 4 módulos de margen
            // blanco que necesita el lector. Garantiza legibilidad si alguien
            // toma screenshot del QR en pantalla en vez de descargar el PNG.
            includeMargin={true}
            fgColor="#0B2443"
            bgColor="#ffffff"
          />
          {/* Marcas decorativas en las esquinas */}
          <Corner pos="top-left" />
          <Corner pos="top-right" />
          <Corner pos="bottom-left" />
          <Corner pos="bottom-right" />
        </div>
      </div>

      {/* Descripción con contraste reforzado */}
      <div className="relative z-10 flex items-start gap-2 max-w-[280px]">
        <ScanLine
          size={14}
          style={{ color: "#0A4FB3" }}
          className="shrink-0 mt-0.5"
        />
        <p
          className="text-[12.5px] text-center leading-relaxed"
          style={{ color: "#0B2443", fontWeight: 500 }}
        >
          El farmacéutico escanea este QR para encontrar tu receta al instante.
        </p>
      </div>

      <motion.button
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={descargar}
        className="relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold w-full justify-center transition-shadow"
        style={{
          background: "linear-gradient(135deg, #0A84FF 0%, #0052CC 100%)",
          color: "#FFFFFF",
          boxShadow: "0 6px 18px rgba(10,132,255,0.34)",
        }}
      >
        <Download size={13} />
        Guardar como PNG (512×512)
      </motion.button>
    </div>
  );
}

// Esquinas decorativas que enmarcan el QR — solo estética, refuerza foco.
function Corner({ pos }) {
  const base = {
    position: "absolute",
    width: 14,
    height: 14,
    borderColor: "#0A4FB3",
    borderStyle: "solid",
    borderWidth: 0,
  };
  const map = {
    "top-left":     { top: -2,    left: -2,    borderTopWidth: 2, borderLeftWidth: 2,   borderTopLeftRadius: 6 },
    "top-right":    { top: -2,    right: -2,   borderTopWidth: 2, borderRightWidth: 2,  borderTopRightRadius: 6 },
    "bottom-left":  { bottom: -2, left: -2,    borderBottomWidth: 2, borderLeftWidth: 2,  borderBottomLeftRadius: 6 },
    "bottom-right": { bottom: -2, right: -2,   borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 6 },
  };
  return <span aria-hidden style={{ ...base, ...map[pos] }} />;
}
