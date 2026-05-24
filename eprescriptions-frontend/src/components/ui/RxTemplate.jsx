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
const CARD_HEIGHT = 540;

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
}) {
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
          }}
        >
          <div className="rx-watermark">
            <RxMonogram size={420} color="#0A84FF" />
          </div>
          <CrossPattern />

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
                  className="font-editorial text-[color:var(--blue-deep)]"
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
              className="font-editorial italic shrink-0"
              style={{
                fontSize: 52,
                fontWeight: 900,
                letterSpacing: "-0.06em",
                lineHeight: 0.85,
                background: "linear-gradient(135deg,#0A84FF 0%,#0052CC 70%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 4px 18px rgba(10,132,255,0.18)",
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
            <h2
              className="font-editorial mt-2"
              style={{
                fontSize: "clamp(24px, 3.4vw, 30px)",
                lineHeight: 1.1,
                fontWeight: 800,
                color: tampered ? "#B42318" : "var(--text-primary)",
                letterSpacing: "-0.02em",
                wordBreak: "break-word",
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
                className="mt-4 p-3.5 rounded-xl"
                style={{
                  background: "rgba(10,132,255,0.05)",
                  border: "1px solid rgba(10,132,255,0.18)",
                }}
              >
                <div className="label-xs mb-1">Instrucciones</div>
                <p
                  className="text-sm text-[color:var(--text-primary)] leading-relaxed"
                  style={clampLines(2)}
                >
                  {receta.instrucciones}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-5">
              <Meta
                icon={User}
                label="Paciente"
                value={`@${receta.paciente_username || `id${receta.paciente_id}`}`}
              />
              <Meta icon={Calendar} label="Emitida" value={fechaCorta} />
            </div>
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
              <button
                type="button"
                onClick={() => setQrOpen((v) => !v)}
                className="btn btn-ghost btn-sm shrink-0"
                style={qrOpen ? { color: "var(--cyan, #0A84FF)" } : undefined}
                title="Mostrar código QR"
              >
                <QrCode size={12} /> QR
              </button>
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

          {/* Panel QR — se expande debajo del footer dentro del anverso */}
          <AnimatePresence>
            {qrOpen && (
              <motion.div
                key="qr-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                className="relative z-10 overflow-hidden px-5 sm:px-6 pb-5"
              >
                <QRReceta
                  recetaId={receta.id}
                  medicamento={receta.medicamento}
                />
              </motion.div>
            )}
          </AnimatePresence>

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
                className="font-editorial text-xl"
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
    </motion.div>
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
