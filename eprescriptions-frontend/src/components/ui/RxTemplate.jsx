import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill,
  User,
  Calendar,
  Stethoscope,
  ShieldCheck,
  ShieldAlert,
  Hash,
  RotateCw,
  Download,
  Copy,
  Check,
  QrCode,
  FileDown,
} from "lucide-react";
import StatusChip from "./StatusChip";
import CryptoHash from "./CryptoHash";
import QRReceta from "./QRReceta";
import Modal from "./Modal";
import { formatDate } from "../../lib/utils";
import { downloadRecetaPdf } from "../../lib/recetaPdf";
import {
  RxMonogram,
  CapsulePill,
  EcgRibbon,
  CrossPattern,
  DoctorMonogram,
  GradientRule,
} from "../illustrations/MedicalAssets";
import prescriptionBg from "../../assets/prescription-bg.png";

// Plantilla premium de receta — flip 3D con CSS Grid stacking.
//
// Por qué grid stacking:
//   - Ambas caras viven en la misma celda (`grid-template-areas: "stack"`).
//   - El contenedor toma la altura del lado MÁS ALTO automáticamente —
//     sin ResizeObserver, sin medir, sin flash inicial.
//   - Las caras siguen siendo "normal flow" (sin position:absolute),
//     que es lo que `backface-visibility: hidden` necesita para
//     comportarse predecible en Chrome/Safari.
//
// Props:
//   receta       — payload del backend
//   dimmed       — true si OTRA receta está flipped → blur del wrapper
//   onFlipChange — callback (bool) cuando esta cambia de flipped
//
// Estructura:
//   <wrapper outer> perspective + filter blur si dimmed
//     <grid> rotación 3D
//       <article front>    — grid cell, backface hidden
//       <article back>     — grid cell rotateY 180, backface hidden

// Altura FIJA de la receta. Todas las tarjetas miden exactamente lo mismo en
// la rejilla, sin importar cuánto texto traiga cada receta. El contenido
// variable (nombre del medicamento, instrucciones) se recorta con line-clamp
// para que nunca empuje la altura. 540px cubre el peor caso: nombre a 2
// líneas + instrucciones a 2 líneas + banner de manipulación.
const CARD_HEIGHT = 580;

// Recorte de texto a N líneas — el sobrante se corta con "…".
const clampLines = (n) => ({
  display: "-webkit-box",
  WebkitLineClamp: n,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

// flipped/onFlipChange son OPCIONALES: si se omiten, el componente gestiona
// su propio estado (modo standalone). Si se pasan, queda controlado por el
// padre — esto es lo que MisRecetas hace para coordinar "solo una abierta
// a la vez" + dimming de las demás.
export default function RxTemplate({
  receta,
  dimmed = false,
  flipped: flippedProp,
  onFlipChange,
  role = "paciente",
}) {
  // QR y PDF de la receta son acciones del paciente (lleva su QR a la
  // farmacia / descarga su PDF). El médico y el farmacéutico tienen sus
  // propias vistas; aquí solo les mostramos la firma cripto.
  const showQR = role === "paciente";
  const showPDF = role === "paciente";
  const [flippedLocal, setFlippedLocal] = useState(false);
  const isControlled = typeof flippedProp === "boolean";
  const flipped = isControlled ? flippedProp : flippedLocal;
  const setFlipped = (next) => {
    if (!isControlled) setFlippedLocal(next);
    onFlipChange?.(next);
  };
  const [qrOpen, setQrOpen] = useState(false);
  const tampered = receta.cripto_ok === false;

  const docInitials = (receta.medico_username || receta.medico_nombre || "DR")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 2)
    .toUpperCase();

  const fechaCorta = receta.fecha ? formatDate(receta.fecha) : "—";

  return (
    <motion.div
      animate={{
        filter: dimmed ? "blur(4px) saturate(0.9)" : "blur(0px) saturate(1)",
        opacity: dimmed ? 0.55 : 1,
        scale: dimmed ? 0.985 : 1,
      }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={!flipped && !dimmed ? { y: -4 } : undefined}
      className="relative"
      style={{ perspective: 1800 }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateAreas: '"stack"',
          transformStyle: "preserve-3d",
          transition: "transform 780ms cubic-bezier(.22,1,.36,1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          width: "100%",
          height: CARD_HEIGHT,
        }}
      >
        {/* ─────────────── ANVERSO ─────────────── */}
        <article
          className="glass-template rx-face overflow-hidden flex flex-col"
          style={{
            gridArea: "stack",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            height: "100%",
            // SOLO el fondo de la imagen — el formato (header, monograma,
            // EcgRibbon, etc.) vuelve a ser el original.
            backgroundImage: `url(${prescriptionBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* RxMonogram + CrossPattern removidos del anverso —
              el nuevo fondo (caduceo + olas) ya es la marca de agua y las
              cruces decorativas se veían como ruido. */}

          {tampered && <TamperedBanner motivo={receta.motivo_no_verificada} />}

          <header className="relative px-5 sm:px-6 pt-5 pb-3 flex items-start gap-3.5 z-10">
            <DoctorMonogram initials={docInitials} size={48} />
            <div className="flex-1 min-w-0">
              <div className="label-xs flex items-center gap-1.5">
                <ShieldCheck
                  size={11}
                  className="text-[color:var(--emerald)]"
                />
                Recetario digital SecureRx
              </div>
              <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                <span
                  className="font-heading text-[color:var(--blue-deep)]"
                  style={{ fontSize: 19, fontWeight: 700 }}
                >
                  Dr. @{receta.medico_username || `id${receta.medico_id}`}
                </span>
                <span className="text-[11px] font-mono text-[color:var(--text-secondary)]">
                  ECDSA P-256 · cert verificado
                </span>
              </div>
            </div>
            <div
              className="font-heading italic shrink-0"
              style={{
                fontSize: 30,
                fontWeight: 900,
                letterSpacing: "-0.15em",
                lineHeight: 0.85,
                transform: "scaleX(0.78)",
                transformOrigin: "right center",
                background: "linear-gradient(135deg,#0A84FF 0%,#0052CC 70%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 3px 12px rgba(10,132,255,0.18)",
              }}
            >
              Rx
            </div>
          </header>

          <div className="px-5 sm:px-6">
            <GradientRule />
          </div>

          <section
            className="relative px-5 sm:px-6 pt-4 z-10 flex-1"
            style={{ minHeight: 0, overflow: "hidden" }}
          >
            <div className="label-xs flex items-center gap-1.5">
              <Pill size={11} /> Medicamento prescrito
            </div>
            {/* MEDICAMENTO — fuente DM Sans (sans-serif limpia), distinta del
                resto. Antes era serif (Playfair) y al usuario no le gustaba. */}
            <h2
              className="mt-2"
              style={{
                fontSize: "clamp(24px, 3.4vw, 30px)",
                lineHeight: 1.1,
                fontWeight: 800,
                color: tampered ? "#B42318" : "var(--text-primary)",
                letterSpacing: "-0.02em",
                wordBreak: "break-word",
                fontFamily: "var(--font-sans)",
                ...clampLines(2),
              }}
            >
              {tampered ? "— censurado —" : receta.medicamento}
            </h2>

            <div className="flex items-baseline gap-3 flex-wrap mt-3">
              <span
                className="font-semibold"
                style={{
                  fontSize: 16,
                  color: "var(--blue-deep)",
                  lineHeight: 1.3,
                }}
              >
                {tampered ? "—" : receta.dosis}
              </span>
              <span className="text-sm text-[color:var(--text-secondary)]">
                ·{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {tampered ? "—" : receta.cantidad}
                </strong>{" "}
                unidades
              </span>
              <span className="text-sm text-[color:var(--text-secondary)]">
                ·{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {receta.dispensaciones_permitidas ?? 1}
                </strong>{" "}
                dispensaciones
              </span>
            </div>

            {!tampered && receta.instrucciones && (
              <div
                className="mt-3 p-2.5 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.86)",
                  border: "1px solid rgba(10,132,255,0.22)",
                  backdropFilter: "blur(2px)",
                }}
              >
                <div className="label-xs mb-0.5">Instrucciones</div>
                <p
                  className="text-[12.5px] text-[color:var(--text-primary)] leading-snug"
                  style={clampLines(2)}
                >
                  {receta.instrucciones}
                </p>
              </div>
            )}

            {/* Paciente + emitida en una sola fila compacta. */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Meta
                icon={User}
                label="Paciente"
                value={`@${receta.paciente_username || `id${receta.paciente_id}`}`}
              />
              <Meta icon={Calendar} label="Emitida" value={fechaCorta} />
            </div>

            {/* Próxima dispensación — solo paciente, solo recetas con
                intervalo de días configurado y aún con dispensaciones
                disponibles. */}
            {role === "paciente" && receta.intervalo_dias && receta.dispensaciones_realizadas > 0
              && receta.dispensaciones_realizadas < receta.dispensaciones_permitidas && (
              <ProximaDispensacionChip receta={receta} />
            )}
          </section>

          <div className="relative z-10">
            <EcgRibbon height={48} color="#0A84FF" />
          </div>

          <footer className="relative px-5 sm:px-6 pb-5 flex items-center justify-between gap-3 z-10 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <StatusChip estado={receta.estado} />
              <div className="text-[10px] font-mono text-[color:var(--text-secondary)] flex items-center gap-1">
                <Hash size={9} /> #{receta.id}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {showQR && (
                <button
                  type="button"
                  onClick={() => setQrOpen((v) => !v)}
                  className="btn btn-ghost btn-sm shrink-0"
                  style={qrOpen ? { color: "var(--cyan, #0A84FF)" } : undefined}
                  title="Mostrar código QR"
                >
                  <QrCode size={12} /> QR
                </button>
              )}
              {showPDF && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await downloadRecetaPdf(receta);
                    } catch (err) {
                      console.error(err);
                      toast.error("No se pudo generar el PDF de la receta");
                    }
                  }}
                  className="btn btn-ghost btn-sm shrink-0"
                  title="Descargar receta en PDF"
                >
                  <FileDown size={12} /> PDF
                </button>
              )}
              <button
                type="button"
                onClick={() => setFlipped(true)}
                className="btn btn-ghost btn-sm shrink-0"
                title="Ver firma criptográfica"
              >
                <RotateCw size={12} /> Firma
              </button>
            </div>
          </footer>

          <div
            className="absolute pointer-events-none capsule-float z-0"
            style={{ top: 18, right: 28, opacity: 0.18 }}
          >
            <CapsulePill size={140} />
          </div>
        </article>

        {/* ─────────────── REVERSO ─────────────── */}
        <article
          className="glass-template rx-face overflow-hidden flex flex-col"
          style={{
            gridArea: "stack",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            height: "100%",
          }}
        >
          <CrossPattern />
          <div className="rx-watermark">
            <RxMonogram size={360} color="#0052CC" />
          </div>

          <header className="relative px-5 sm:px-6 pt-5 pb-3 flex items-center gap-3 z-10">
            <ShieldCheck size={22} className="text-[color:var(--cyan)]" />
            <div className="flex-1 min-w-0">
              <div className="label-xs">Sello criptográfico</div>
              <h3
                className="font-heading text-xl"
                style={{ fontWeight: 700 }}
              >
                Receta #{receta.id}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setFlipped(false)}
              className="btn btn-ghost btn-sm"
            >
              <RotateCw size={12} /> Volver
            </button>
          </header>

          <div className="px-5 sm:px-6">
            <GradientRule />
          </div>

          <section className="relative px-5 sm:px-6 py-5 z-10 space-y-4 flex-1 overflow-auto">
            <div>
              <div className="label-xs mb-1.5 flex items-center gap-1.5">
                <Hash size={11} /> Huella SHA3-256 (firmada por ECDSA P-256)
              </div>
              <CryptoHash value={receta.hash_sha3} full />
            </div>
            <SignatureRow
              label="Firma ECDSA P-256 + SHA3-256 del médico"
              signature={receta.firma_medico}
              filename={`receta_${receta.id}_firma_medico.sig`}
              tone="blue"
            />
            {receta.firma_farmaceutico && (
              <SignatureRow
                label="Firma ECDSA del farmacéutico"
                signature={receta.firma_farmaceutico}
                filename={`receta_${receta.id}_firma_farmaceutico.sig`}
                tone="green"
              />
            )}
          </section>

          <footer className="relative px-5 sm:px-6 pb-5 z-10 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
            <div className="text-[10px] font-mono text-[color:var(--text-secondary)]">
              X.509 v3 · CA SecureRx · {fechaCorta}
            </div>
            <DoctorMonogram initials={docInitials} size={44} />
          </footer>
        </article>
      </div>

      {/* QR en modal — sale del card para verse completo sin recortes. */}
      <Modal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        title={`Código QR · Receta #${receta.id}`}
      >
        <QRReceta recetaId={receta.id} size={240} />
      </Modal>
    </motion.div>
  );
}

// Línea "Label: ____valor____" estilo receta de papel. Usa la fuente del
// Login (var(--font-heading)) en TODO para que se sienta consistente con el
// resto de la app.
function FieldLine({ label, children, small = false, tiny = false }) {
  const labelSize = tiny ? 11 : small ? 12.5 : 13.5;
  const valueSize = tiny ? 11.5 : small ? 13 : 14;
  return (
    <span
      className="inline-flex items-baseline gap-2 min-w-0"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      <span
        style={{
          color: "#3B4A66",
          fontSize: labelSize,
          fontWeight: 600,
        }}
      >
        {label}:
      </span>
      <span
        className="truncate"
        style={{
          color: "#0B2443",
          fontSize: valueSize,
          fontWeight: 600,
          borderBottom: "1px solid rgba(10,79,179,0.50)",
          paddingBottom: 2,
          minWidth: tiny ? 56 : small ? 96 : 220,
          display: "inline-block",
        }}
      >
        {children}
      </span>
    </span>
  );
}

// Chip que dice "Próxima dispensación: en X días" o "Disponible ahora".
// Calcula en cliente: última fecha + intervalo_dias. Si no hay último
// timestamp, muestra solo "Cada X días".
function ProximaDispensacionChip({ receta }) {
  const ultima = receta.ultima_dispensacion
    ? new Date(receta.ultima_dispensacion)
    : null;
  const dias = receta.intervalo_dias;
  if (!ultima) {
    return (
      <div
        className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
        style={{
          background: "rgba(10,132,255,0.10)",
          border: "1px solid rgba(10,132,255,0.32)",
          color: "var(--blue-deep)",
          fontWeight: 600,
        }}
      >
        <Calendar size={11} /> Cada {dias} día{dias === 1 ? "" : "s"}
      </div>
    );
  }
  const proxima = new Date(ultima.getTime() + dias * 86400000);
  const ahora = new Date();
  const diff = Math.ceil((proxima - ahora) / 86400000);
  const disponible = diff <= 0;
  return (
    <div
      className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
      style={{
        background: disponible ? "rgba(0,109,73,0.18)" : "rgba(224,135,0,0.12)",
        border: `1px solid ${disponible ? "#004D33" : "rgba(224,135,0,0.45)"}`,
        color: disponible ? "#004D33" : "#9A6700",
        fontWeight: 700,
      }}
    >
      <Calendar size={11} />
      {disponible
        ? "Próxima dispensación disponible ahora"
        : `Próxima dispensación en ${diff} día${diff === 1 ? "" : "s"}`}
    </div>
  );
}

function Meta({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0">
      <div className="label-xs flex items-center gap-1">
        <Icon size={11} /> {label}
      </div>
      <div className="font-mono text-sm truncate mt-0.5">{value || "—"}</div>
    </div>
  );
}

function TamperedBanner({ motivo }) {
  return (
    <div
      className="relative z-20 mx-4 mt-4 flex items-start gap-2.5 p-3 rounded-xl"
      style={{
        background: "rgba(180,35,24,0.08)",
        border: "1px solid rgba(180,35,24,0.40)",
      }}
    >
      <ShieldAlert
        size={18}
        style={{ color: "#B42318" }}
        className="shrink-0 mt-0.5"
      />
      <div className="min-w-0">
        <div className="font-heading text-sm" style={{ color: "#B42318" }}>
          Verificación criptográfica fallida
        </div>
        <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "#7A1F12" }}>
          {motivo ||
            "La firma digital ECDSA P-256 + SHA3-256 del médico emisor no coincide con el contenido cifrado de esta receta. Esto indica que el documento pudo haber sido alterado posteriormente a su emisión. Por motivos de seguridad, absténgase de utilizar esta prescripción y contacte a su médico tratante o al equipo de soporte de SecureRx."}
        </div>
      </div>
    </div>
  );
}

function SignatureRow({ label, signature, filename, tone = "blue" }) {
  const [copied, setCopied] = useState(false);
  const palette =
    tone === "green"
      ? {
          bg: "rgba(0,168,112,0.07)",
          border: "rgba(0,168,112,0.32)",
          fg: "#00775A",
        }
      : {
          bg: "rgba(10,132,255,0.07)",
          border: "rgba(10,132,255,0.28)",
          fg: "var(--blue-deep)",
        };
  const has = !!signature;

  const copy = async () => {
    if (!has) return;
    await navigator.clipboard.writeText(signature);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const download = () => {
    if (!has) return;
    const blob = new Blob([signature], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="label-xs mb-1.5">{label}</div>
      <div
        className="flex items-center gap-1.5 flex-wrap p-2.5 rounded-lg"
        style={{
          background: palette.bg,
          border: `1px solid ${palette.border}`,
        }}
      >
        <span className="text-[10.5px] font-mono" style={{ color: palette.fg }}>
          {has ? "ECDSA / DER → base64" : "— no firmada —"}
        </span>
        <AnimatePresence>
          {has && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="ml-auto flex gap-1"
            >
              <button
                type="button"
                onClick={download}
                className="inline-flex items-center gap-1 text-[10.5px] px-2 py-1 rounded hover:bg-white/40 transition-colors"
                style={{ color: palette.fg }}
              >
                <Download size={11} /> Descargar
              </button>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1 text-[10.5px] px-2 py-1 rounded hover:bg-white/40 transition-colors"
                style={{ color: palette.fg }}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}{" "}
                {copied ? "Copiada" : "Copiar"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
