import { useCallback } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Download } from "lucide-react";

/**
 * QRReceta — muestra el QR de una receta para que el paciente lo guarde.
 *
 * El QR codifica solo el ID numérico de la receta.
 * El farmacéutico lo escanea con EscanearQR y el sistema busca la receta.
 *
 * Props:
 *   recetaId    — número/string, id de la receta
 *   medicamento — string, nombre para el label y el archivo descargado
 */
export default function QRReceta({ recetaId, medicamento = "" }) {
  const svgId = `qr-rx-${recetaId}`;

  const descargar = useCallback(() => {
    const svgEl = document.getElementById(svgId);
    if (!svgEl) return;

    const SIZE = 400;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");

    // Fondo blanco obligatorio para que el QR tenga contraste
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
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
      className="flex flex-col items-center gap-3 p-4 rounded-xl"
      style={{
        background: "rgba(10,132,255,0.04)",
        border: "1px solid rgba(10,132,255,0.20)",
      }}
    >
      <div className="label-xs self-start">Código QR — receta #{recetaId}</div>

      {/* QR sobre fondo blanco con padding interno */}
      <div
        className="p-3 rounded-xl"
        style={{
          background: "#ffffff",
          boxShadow: "0 4px 18px rgba(10,36,67,0.13)",
        }}
      >
        <QRCodeSVG
          id={svgId}
          value={String(recetaId)} // codifica solo el ID
          size={148}
          level="M"
          includeMargin={false}
          fgColor="#0B2443"
          bgColor="#ffffff"
        />
      </div>

      <p
        className="text-xs text-center leading-relaxed max-w-[180px]"
        style={{ color: "var(--text-secondary)" }}
      >
        El farmacéutico escanea este QR para encontrar tu receta al instante.
      </p>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={descargar}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium w-full justify-center"
        style={{
          background: "rgba(10,132,255,0.12)",
          border: "1px solid rgba(10,132,255,0.30)",
          color: "var(--cyan, #0A84FF)",
        }}
      >
        <Download size={12} />
        Guardar como PNG
      </motion.button>
    </div>
  );
}
