import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  ClipboardList,
  Pill,
  User,
  Stethoscope,
  Calendar,
  Stamp,
  AtSign,
  X,
  Hash,
  ShieldCheck,
  ShieldAlert,
  QrCode,
  CheckCircle,
  RefreshCcw,
} from "lucide-react";
import ShieldLogo from "../components/3d/ShieldLogo";
import PageTransition from "../components/ui/PageTransition";
import SecureCard from "../components/ui/SecureCard";
import StatusChip from "../components/ui/StatusChip";
import Modal from "../components/ui/Modal";
import SessionKeyPicker, {
  validateKeysBundle,
} from "../components/ui/SessionKeyPicker";
import VerificationSteps from "../components/ui/VerificationSteps";
import Spinner from "../components/ui/Spinner";
import ActionFeedback from "../components/ui/ActionFeedback";
import { DispensationTicketPreview } from "../components/ui/DispensationTicket";
import { listContainer, listItem } from "../lib/animations";
import RxTemplate from "../components/ui/RxTemplate";
import PageHero from "../components/ui/PageHero";
import iconAmbulance from "../assets/icons/ambulance.png";
import { useAuthStore } from "../store/useAuthStore";
import { recetasAPI, usuariosAPI } from "../api";
import { formatDate } from "../lib/utils";

const MODES = [
  { id: "id", label: "Por ID de receta", icon: Hash },
  { id: "usuario", label: "Por usuario del paciente", icon: User },
  { id: "qr", label: "Escanear QR", icon: QrCode },
];

export default function Pendientes() {
  const user = useAuthStore((s) => s.user);

  // Modo de búsqueda
  const [mode, setMode] = useState("id");

  // Búsqueda por ID
  const [queryId, setQueryId] = useState("");

  // Búsqueda por usuario
  const [queryUser, setQueryUser] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const debounceRef = useRef(null);

  // Resultados
  const [recetas, setRecetas] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Modal dispensado
  const [picked, setPicked] = useState(null);
  const [key, setKey] = useState(user?.llave_privada || "");
  const [phase, setPhase] = useState("idle");
  const [observaciones, setObservaciones] = useState("");
  const [dispenseErr, setDispenseErr] = useState(null); // mensaje del overlay rojo

  // ── Búsqueda por ID ──────────────────────────────────────────
  const buscarPorId = async (e) => {
    e?.preventDefault();
    const id = queryId.trim();
    if (!id) return toast.warning("Ingresa un ID de receta");
    if (!/^\d+$/.test(id)) return toast.warning("El ID debe ser un número");

    setSearching(true);
    setSearchError(null);
    setRecetas([]);

    try {
      const { data } = await recetasAPI.porId(id);
      if (!["activa", "en_proceso", "emitida"].includes(data.estado)) {
        setSearchError(
          `Esta receta no está disponible para dispensar (estado: ${data.estado})`,
        );
      } else {
        setRecetas([data]);
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404)
        setSearchError("No se encontró ninguna receta con ese ID.");
      else if (status === 403)
        setSearchError("No tienes acceso a esta receta.");
      else if (status === 409)
        setSearchError(
          err?.uiMessage || "La receta no está disponible para dispensar.",
        );
      else setSearchError(err?.uiMessage || "Error al buscar la receta.");
    } finally {
      setSearching(false);
    }
  };

  // ── Typeahead de usuarios ────────────────────────────────────
  const onQueryUserChange = (val) => {
    setQueryUser(val);
    setSearchError(null);
    setRecetas([]);
    setSuggestions([]);
    clearTimeout(debounceRef.current);
    if (!val.trim()) return;
    debounceRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const { data } = await usuariosAPI.buscar(val.trim(), "paciente");
        setSuggestions(data || []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);
  };

  const seleccionarPaciente = async (paciente) => {
    setQueryUser(`@${paciente.username} — ${paciente.nombre}`);
    setSuggestions([]);
    setSearching(true);
    setSearchError(null);
    setRecetas([]);

    try {
      const { data } = await recetasAPI.dispensablesPaciente(paciente.id);
      if (!data || data.length === 0) {
        setSearchError(
          `@${paciente.username} no tiene recetas disponibles para dispensar.`,
        );
      } else {
        setRecetas(data);
      }
    } catch (err) {
      setSearchError(err?.uiMessage || "Error al buscar recetas del paciente.");
    } finally {
      setSearching(false);
    }
  };

  // ── Limpiar ──────────────────────────────────────────────────
  const limpiar = () => {
    setQueryId("");
    setQueryUser("");
    setRecetas([]);
    setSearchError(null);
    setSuggestions([]);
  };

  const cambiarModo = (m) => {
    setMode(m);
    limpiar();
  };

  // ── Dispensar ────────────────────────────────────────────────
  const dispense = async () => {
    if (picked?.cripto_ok === false) {
      return toast.error(
        "Verificación criptográfica fallida — esta receta no puede dispensarse."
      );
    }
    const v = validateKeysBundle(key, ["ec", "rsa"]);
    if (!v.ok) return toast.error(v.reason);
    setPhase("verifying");
    try {
      const { data } = await recetasAPI.dispensar(picked.id, user.id, {
        llave_privada_farmaceutico: key,
        observaciones: observaciones || null,
      });
      const ok = Object.values(data?.verificaciones || {}).every(Boolean);
      if (!ok) throw new Error("Alguna verificación falló");
      setPhase("success");
      toast.success(`Receta #${data.receta_id} dispensada`);
      // 2.6s para que la animación verde tipo "Email verificado" se vea
      // completa antes de cerrar el modal y volver al estado inicial.
      setTimeout(() => {
        setPicked(null);
        setPhase("idle");
        setObservaciones("");
        limpiar();
      }, 2600);
    } catch (err) {
      const msg = err?.uiMessage || err?.message || "No se pudo dispensar";
      setDispenseErr(msg);
      setPhase("error");
      toast.error(msg);
      // 2.6s para que la animación roja se vea completa, igual que el éxito.
      setTimeout(() => {
        setPhase("idle");
        setDispenseErr(null);
      }, 2600);
    }
  };

  const close = () => {
    if (phase !== "idle" && phase !== "error") return;
    setPicked(null);
    setPhase("idle");
  };

  // Refrescar lo que esté visible: picked > último resultado > último query.
  // No tira un re-fetch ciego porque la página es búsqueda-driven, no listado.
  const refrescar = async () => {
    if (picked) {
      try {
        const { data } = await recetasAPI.porId(picked.id);
        setPicked(data);
        setRecetas([data]);
      } catch (err) {
        toast.error(err?.uiMessage || "No se pudo recargar la receta.");
      }
      return;
    }
    if (recetas.length > 0 && mode === "id" && queryId.trim()) {
      return buscarPorId();
    }
    if (recetas.length > 0 && mode === "usuario") {
      toast.info("Re-selecciona el paciente para refrescar sus recetas.");
      return;
    }
    toast.info("Nada que refrescar — busca primero una receta.");
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHero
          eyebrow={`Farmacéutico · @${user?.username || ""}`}
          title="Dispensar receta"
          subtitle="Busca por ID o por usuario del paciente."
          iconImg={iconAmbulance}
          accent="#0A84FF"
        >
          <button
            type="button"
            onClick={refrescar}
            className="btn btn-ghost btn-sm"
            disabled={searching}
          >
            <RefreshCcw size={14} className={searching ? "animate-spin" : ""} /> Refrescar
          </button>
        </PageHero>

        {/* Selector de modo */}
        <div className="flex gap-2 flex-wrap">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => cambiarModo(m.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={
                mode === m.id
                  ? {
                      background: "rgba(10,132,255,0.15)",
                      border: "1px solid rgba(10,132,255,0.45)",
                      color: "var(--cyan, #0A84FF)",
                    }
                  : {
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-secondary)",
                    }
              }
            >
              <m.icon size={14} />
              {m.label}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <SecureCard>
          {mode === "id" ? (
            <form
              onSubmit={buscarPorId}
              className="flex gap-3 items-end flex-wrap"
            >
              <div className="flex-1 min-w-[200px]">
                <div className="label-xs mb-1.5">ID de receta</div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[color:var(--text-secondary)]">
                    <Hash size={14} />
                  </div>
                  <input
                    className="input-field pl-9 pr-9"
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: 42"
                    value={queryId}
                    onChange={(e) => {
                      setQueryId(e.target.value);
                      setSearchError(null);
                      setRecetas([]);
                    }}
                    autoFocus
                  />
                  {queryId && (
                    <button
                      type="button"
                      onClick={limpiar}
                      className="absolute inset-y-0 right-3 flex items-center text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <motion.button
                type="submit"
                whileHover={!searching ? { scale: 1.03 } : undefined}
                whileTap={!searching ? { scale: 0.97 } : undefined}
                disabled={searching}
                className="btn btn-primary shrink-0"
              >
                {searching ? <Spinner size={14} /> : <Search size={14} />}
                {searching ? "Buscando…" : "Buscar"}
              </motion.button>
            </form>
          ) : mode === "usuario" ? (
            <div className="flex-1">
              <div className="label-xs mb-1.5">Usuario del paciente</div>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[color:var(--text-secondary)]">
                  <User size={14} />
                </div>
                <input
                  className="input-field pl-9 pr-9"
                  type="text"
                  placeholder="Buscar por username o nombre…"
                  value={queryUser}
                  onChange={(e) => onQueryUserChange(e.target.value)}
                  autoFocus
                />
                {queryUser && (
                  <button
                    type="button"
                    onClick={limpiar}
                    className="absolute inset-y-0 right-3 flex items-center text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                  >
                    <X size={14} />
                  </button>
                )}

                {/* Dropdown sugerencias */}
                <AnimatePresence>
                  {(suggestions.length > 0 || loadingSuggestions) && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border-subtle)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
                      }}
                    >
                      {loadingSuggestions && (
                        <div className="px-4 py-3 text-sm text-[color:var(--text-secondary)]">
                          Buscando…
                        </div>
                      )}
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => seleccionarPaciente(s)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[rgba(10,132,255,0.08)] transition-colors"
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                            style={{
                              background: "rgba(10,132,255,0.15)",
                              color: "var(--cyan)",
                            }}
                          >
                            {s.username[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium">
                              @{s.username}
                            </div>
                            <div className="text-xs text-[color:var(--text-secondary)] truncate">
                              {s.nombre}
                            </div>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {searching && (
                <div className="mt-3 flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                  <span
                    className="dot-pulse cyan"
                    style={{ width: 7, height: 7 }}
                  />{" "}
                  Cargando recetas…
                </div>
              )}
            </div>
          ) : (
            <QRScanner
              onResult={(id) => {
                // 1. Forzamos el cambio de pestaña.
                // Esto desmonta el QRScanner y apaga la cámara de inmediato.
                setMode("id");
                setQueryId(id);

                // 2. Disparamos la búsqueda y apertura del modal
                setSearching(true);
                setSearchError(null);
                setRecetas([]);

                recetasAPI
                  .porId(id)
                  .then(({ data }) => {
                    if (
                      !["activa", "en_proceso", "emitida"].includes(data.estado)
                    ) {
                      setSearchError(
                        `Receta no disponible para dispensar (estado: ${data.estado})`,
                      );
                    } else {
                      // Mostrar la receta en el grid (mismo formato visual
                      // que cuando se busca por paciente). El usuario hace
                      // click en "Dispensar" cuando esté listo.
                      setRecetas([data]);
                      setPhase("idle");
                      toast.success(`Receta #${data.id} encontrada`);
                    }
                  })
                  .catch((err) => {
                    const status = err?.response?.status;
                    if (status === 404)
                      setSearchError("No se encontró la receta.");
                    else setSearchError(err?.uiMessage || "Error al buscar.");
                  })
                  .finally(() => setSearching(false));
              }}
            />
          )}
        </SecureCard>

        {/* Resultados */}
        <AnimatePresence mode="wait">
          {searchError && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="px-4 py-3 rounded-xl text-sm"
              style={{
                background: "rgba(255,59,48,0.08)",
                border: "1px solid rgba(255,59,48,0.30)",
                color: "var(--red, #ff3b30)",
              }}
            >
              {searchError}
            </motion.div>
          )}

          {recetas.length > 0 && (
            <motion.div
              key="results"
              variants={listContainer}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0 }}
              className="grid gap-4 md:grid-cols-2"
            >
              {(() => {
                // Cola priorizada: recetas EN PROCESO (con dispensaciones ya
                // hechas) primero — el paciente ya está a mitad de tratamiento
                // y no debe esperar. Dentro de cada grupo, por fecha asc
                // (la más vieja es la que ha esperado más).
                const sorted = [...recetas].sort((a, b) => {
                  const aProc = (a.dispensaciones_realizadas || 0) > 0 ? 0 : 1;
                  const bProc = (b.dispensaciones_realizadas || 0) > 0 ? 0 : 1;
                  if (aProc !== bProc) return aProc - bProc;
                  return new Date(a.fecha) - new Date(b.fecha);
                });
                return sorted;
              })().map((r) => (
                <motion.div key={r.id} variants={listItem} className="flex flex-col gap-2">
                  <RxTemplate receta={r} role="farmaceutico" />
                  {/* Acción del farma: dispensar esta receta. */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setPicked(r);
                      setPhase("idle");
                    }}
                    className="btn btn-primary"
                  >
                    <Stamp size={14} /> Dispensar receta #{r.id}
                  </motion.button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal de dispensado */}
      <Modal
        open={!!picked}
        onClose={close}
        title={`Dispensar receta #${picked?.id ?? ""}`}
        wide
      >
        {/* Overlay de éxito al estilo "Email verificado" — aparece encima
            del modal cuando la dispensación se completa cripto-firmada. */}
        <AnimatePresence>
          {phase === "success" && picked && (
            <motion.div
              key="dispensada-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 flex items-center justify-center z-30 rounded-2xl overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0,168,112,0.18) 0%, rgba(255,255,255,0.98) 60%)",
              }}
            >
              {/* Halos decorativos verdes */}
              <div
                aria-hidden
                className="absolute pointer-events-none"
                style={{
                  top: "-20%", left: "-10%", width: 360, height: 360,
                  background: "radial-gradient(circle, rgba(0,168,112,0.35), transparent 65%)",
                  filter: "blur(40px)",
                }}
              />
              <div
                aria-hidden
                className="absolute pointer-events-none"
                style={{
                  bottom: "-15%", right: "-10%", width: 320, height: 320,
                  background: "radial-gradient(circle, rgba(79,209,197,0.30), transparent 65%)",
                  filter: "blur(40px)",
                }}
              />

              <motion.div
                initial={{ scale: 0.88, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="relative z-10 text-center px-6 py-8"
              >
                <div className="flex justify-center mb-5">
                  <ShieldLogo size={64} />
                </div>

                {/* Anillos pulsantes detrás del check */}
                {[0, 0.18, 0.36].map((d, i) => (
                  <motion.span
                    key={i}
                    aria-hidden
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                    initial={{ scale: 0.3, opacity: 0.85 }}
                    animate={{ scale: 3.6, opacity: 0 }}
                    transition={{ duration: 1.4, delay: d, ease: "easeOut", repeat: 1 }}
                    style={{
                      width: 120, height: 120,
                      border: "2px solid rgba(0,168,112,0.7)",
                      boxShadow: "0 0 36px rgba(0,168,112,0.45)",
                    }}
                  />
                ))}

                <motion.div
                  initial={{ scale: 0, rotate: -90, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 14, delay: 0.12 }}
                  className="relative z-10 inline-block"
                >
                  <CheckCircle
                    size={72}
                    style={{ color: "#00A870" }}
                    strokeWidth={2.4}
                  />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.35 }}
                  className="font-heading mt-5 uppercase"
                  style={{
                    fontSize: "clamp(28px, 4vw, 36px)",
                    color: "#00775A",
                    letterSpacing: "0.08em",
                    textShadow: "0 4px 18px rgba(0,168,112,0.30)",
                  }}
                >
                  Dispensada
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                  className="text-sm mt-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Receta <strong style={{ color: "#0B2443" }}>#{picked.id}</strong> · sello criptográfico registrado
                </motion.p>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.7 }}
                  className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full text-[11px] font-mono font-bold"
                  style={{
                    background: "linear-gradient(135deg, #00875E 0%, #006044 100%)",
                    color: "#FFFFFF",
                    boxShadow: "0 6px 16px rgba(0,77,51,0.40)",
                  }}
                >
                  <ShieldCheck size={13}/> ECDSA + AES-GCM verificados
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {/* Overlay de ERROR — versión roja del éxito, con el mensaje
              capturado en `dispenseErr`. Anillos en rojo, shield-alert
              en lugar de check, shake horizontal sutil. */}
          {phase === "error" && picked && (
            <motion.div
              key="dispensada-error-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 flex items-center justify-center z-30 rounded-2xl overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, rgba(220,40,40,0.20) 0%, rgba(255,255,255,0.98) 60%)",
              }}
            >
              {/* Halos decorativos rojos */}
              <div
                aria-hidden
                className="absolute pointer-events-none"
                style={{
                  top: "-20%", left: "-10%", width: 360, height: 360,
                  background: "radial-gradient(circle, rgba(220,40,40,0.35), transparent 65%)",
                  filter: "blur(40px)",
                }}
              />
              <div
                aria-hidden
                className="absolute pointer-events-none"
                style={{
                  bottom: "-15%", right: "-10%", width: 320, height: 320,
                  background: "radial-gradient(circle, rgba(252,165,165,0.45), transparent 65%)",
                  filter: "blur(40px)",
                }}
              />

              <motion.div
                initial={{ scale: 0.88, y: 12 }}
                animate={{ scale: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
                transition={{
                  scale: { type: "spring", stiffness: 260, damping: 20 },
                  y: { type: "spring", stiffness: 260, damping: 20 },
                  x: { duration: 0.5, delay: 0.15 },
                }}
                className="relative z-10 text-center px-6 py-8 max-w-md"
              >
                <div className="flex justify-center mb-5">
                  <ShieldLogo size={64} />
                </div>

                {/* Anillos rojos pulsantes */}
                {[0, 0.18, 0.36].map((d, i) => (
                  <motion.span
                    key={i}
                    aria-hidden
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                    initial={{ scale: 0.3, opacity: 0.85 }}
                    animate={{ scale: 3.6, opacity: 0 }}
                    transition={{ duration: 1.4, delay: d, ease: "easeOut", repeat: 1 }}
                    style={{
                      width: 120, height: 120,
                      border: "2px solid rgba(220,40,40,0.75)",
                      boxShadow: "0 0 36px rgba(220,40,40,0.50)",
                    }}
                  />
                ))}

                <motion.div
                  initial={{ scale: 0, rotate: -90, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 14, delay: 0.12 }}
                  className="relative z-10 inline-block"
                >
                  <ShieldAlert
                    size={72}
                    style={{ color: "#DC2828" }}
                    strokeWidth={2.4}
                  />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.35 }}
                  className="font-heading mt-5 uppercase"
                  style={{
                    fontSize: "clamp(26px, 3.6vw, 32px)",
                    color: "#9A1410",
                    letterSpacing: "0.08em",
                    textShadow: "0 4px 18px rgba(180,35,24,0.30)",
                  }}
                >
                  No se pudo dispensar
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                  className="text-sm mt-3 leading-relaxed"
                  style={{ color: "#7A1F12" }}
                >
                  {dispenseErr ||
                    "Una verificación criptográfica falló o la receta no es válida en este momento."}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.7 }}
                  className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full text-[11px] font-mono font-bold"
                  style={{
                    background: "linear-gradient(135deg, #DC2828 0%, #9A1410 100%)",
                    color: "#FFFFFF",
                    boxShadow: "0 6px 16px rgba(180,35,24,0.40)",
                  }}
                >
                  <ShieldAlert size={13}/> Receta #{picked.id} no dispensada
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {picked && (
          <div className="space-y-5">
            {/* Alerta de integridad: la firma del médico no verifica */}
            {picked.cripto_ok === false && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{
                  background: "rgba(180,35,24,0.08)",
                  border: "1px solid rgba(180,35,24,0.42)",
                }}
              >
                <ShieldAlert
                  size={22}
                  style={{ color: "#B42318" }}
                  className="shrink-0 mt-0.5"
                />
                <div className="min-w-0">
                  <div
                    className="font-heading text-sm"
                    style={{ color: "#B42318" }}
                  >
                    Verificación criptográfica fallida
                  </div>
                  <div
                    className="text-xs mt-1 leading-relaxed"
                    style={{ color: "#7A1F12" }}
                  >
                    {picked.motivo_no_verificada ||
                      "La firma digital ECDSA P-256 + SHA3-256 del médico emisor no coincide con el contenido cifrado de esta receta. Esto indica que el documento pudo haber sido alterado posteriormente a su emisión."}
                  </div>
                  <div
                    className="text-[11px] mt-2 font-medium"
                    style={{ color: "#B42318" }}
                  >
                    Por motivos de seguridad, la dispensación está bloqueada.
                    Contacte al médico emisor o al equipo de soporte de
                    SecureRx.
                  </div>
                </div>
              </motion.div>
            )}

            {/* Ticket preview — vista premium del medicamento + actores */}
            <DispensationTicketPreview
              receta={picked}
              medicoUsername={picked.medico_username}
              farmaceuticoUsername={user?.username}
            />

            {picked.instrucciones && (
              <div
                className="p-3.5 rounded-xl"
                style={{
                  background: "rgba(10,132,255,0.05)",
                  border: "1px solid rgba(10,132,255,0.20)",
                }}
              >
                <div className="label-xs mb-1">Instrucciones del médico</div>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-primary)" }}
                >
                  {picked.instrucciones}
                </p>
              </div>
            )}

            {/* Fecha + Dispensaciones */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className="p-3 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="label-xs mb-1 flex items-center gap-1">
                  <Calendar size={10} /> Emitida
                </div>
                <div className="font-medium text-sm">
                  {formatDate(picked.fecha)}
                </div>
              </div>
              <div
                className="p-3 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="label-xs mb-1 flex items-center gap-1">
                  <Stamp size={10} /> Dispensaciones
                </div>
                <div className="flex items-end gap-1.5 mt-0.5">
                  <span className="font-heading text-2xl text-[color:var(--cyan)]">
                    {picked.dispensaciones_realizadas}
                  </span>
                  <span className="text-sm text-[color:var(--text-secondary)] mb-0.5">
                    / {picked.dispensaciones_permitidas}
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "var(--cyan, #0A84FF)" }}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(picked.dispensaciones_realizadas / picked.dispensaciones_permitidas) * 100}%`,
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>

            {/* Este va a ser el campo para las observaciones. Quité la firma y el campo de farmaceutico que no entiendo para que lo pusieron */}
            <div>
              <div className="label-xs mb-1.5">
                Observaciones <span className="opacity-50">(opcional)</span>
              </div>
              <textarea
                className="input-field resize-none"
                rows={3}
                placeholder="Notas del farmacéutico para este dispensado…"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                disabled={phase !== "idle"}
              />
            </div>

            <SessionKeyPicker
              requires={["ec", "rsa"]}
              value={key}
              onChange={setKey}
            />

            {phase !== "idle" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl"
                style={{
                  background: "rgba(10,132,255,0.05)",
                  border: "1px solid rgba(10,132,255,0.28)",
                }}
              >
                <VerificationSteps
                  running={phase === "verifying" || phase === "success"}
                />
                {phase === "success" && (
                  <div className="mt-4 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 14,
                      }}
                      className="inline-flex items-center gap-2 glitch font-heading text-2xl text-[color:var(--emerald)]"
                    >
                      <Stamp size={22} /> DISPENSADA
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                className="btn btn-ghost"
                onClick={close}
                disabled={phase === "verifying" || phase === "success"}
              >
                Cancelar
              </button>
              <motion.button
                whileHover={
                  phase === "idle" && picked.cripto_ok !== false
                    ? { scale: 1.02 }
                    : undefined
                }
                whileTap={
                  phase === "idle" && picked.cripto_ok !== false
                    ? { scale: 0.98 }
                    : undefined
                }
                className="btn btn-success"
                onClick={dispense}
                disabled={phase !== "idle" || picked.cripto_ok === false}
                title={
                  picked.cripto_ok === false
                    ? "Receta con verificación criptográfica fallida — no puede dispensarse"
                    : undefined
                }
              >
                <Stamp size={14} />{" "}
                {picked.cripto_ok === false
                  ? "Dispensación bloqueada"
                  : "Confirmar dispensado"}
              </motion.button>
            </div>
          </div>
        )}
      </Modal>
    </PageTransition>
  );
}

function QRScanner({ onResult }) {
  useEffect(() => {
    let isMounted = true;
    let qr = null;

    // Delegamos la inicialización a la cola de macrotareas.
    // 150ms es suficiente para que el Strict Mode termine su ciclo.
    const timer = setTimeout(() => {
      if (!isMounted) return;

      import("html5-qrcode").then(({ Html5Qrcode }) => {
        if (!isMounted) return;

        const containerId = "qr-scanner-pendientes";
        const container = document.getElementById(containerId);
        if (container) container.innerHTML = "";

        qr = new Html5Qrcode(containerId);

        qr.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 280, height: 280 } },
          (decoded) => {
            const id = decoded.trim();
            if (/^\d+$/.test(id)) {
              // Congela el frame de video para dar feedback visual de éxito
              qr.pause(true);
              onResult(id);
            }
          },
          () => {}, // Callback silencioso para los frames sin QR
        ).catch((err) => {
          console.warn("Inicialización de hardware abortada/fallida:", err);
        });
      });
    }, 150);

    return () => {
      isMounted = false;
      // Si fue un montaje fantasma, cancelamos el timer antes de que inicie la cámara
      clearTimeout(timer);

      if (qr) {
        try {
          const state = qr.getState();
          // Solo detenemos el hardware si el estado interno es SCANNING (2) o PAUSED (3)
          if (state === 2 || state === 3) {
            qr.stop().catch(() => {});
          }
        } catch (e) {
          console.warn("Excepción al liberar el stream de video:", e);
        }
      }
    };
  }, [onResult]);

  return (
    <div className="space-y-3">
      <div className="label-xs">Apunta la cámara al QR de la receta</div>
      <div
        id="qr-scanner-pendientes"
        className="rounded-xl overflow-hidden w-full bg-[rgba(10,36,67,0.02)] relative flex items-center justify-center"
        style={{ minHeight: 300 }}
      />
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Al leer el QR, la cámara se apagará, cambiarás a la vista por ID y la
        receta se abrirá automáticamente para dispensar.
      </p>
    </div>
  );
}
