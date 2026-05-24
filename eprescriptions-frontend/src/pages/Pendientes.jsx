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
  QrCode,
} from "lucide-react";
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
      setTimeout(() => {
        setPicked(null);
        setPhase("idle");
        setObservaciones(""); //Limpieza del campo
        limpiar();
      }, 1400);
    } catch (err) {
      setPhase("error");
      toast.error(err?.uiMessage || err?.message || "No se pudo dispensar");
      setTimeout(() => setPhase("idle"), 1200);
    }
  };

  const close = () => {
    if (phase !== "idle" && phase !== "error") return;
    setPicked(null);
    setPhase("idle");
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <header>
          <div className="label-xs">Farmacéutico · @{user?.username}</div>
          <h1 className="font-heading text-3xl md:text-4xl mt-2 flex items-center gap-3">
            <ClipboardList className="text-[color:var(--cyan)]" /> Dispensar
            receta
          </h1>
          <p className="text-[color:var(--text-secondary)] text-sm mt-2 max-w-xl">
            Busca por ID de receta o por el usuario del paciente. Cada
            dispensado verifica AES-GCM y la firma ECDSA P-256 + SHA3-256 antes
            de sellarse.
          </p>
        </header>

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
                      setPicked(data); // Abre el modal de dispensación
                      setPhase("idle");
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
              className="grid gap-4"
            >
              {recetas.map((r) => (
                <motion.div key={r.id} variants={listItem}>
                  <SecureCard className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: "rgba(10,132,255,0.10)",
                          border: "1px solid rgba(10,132,255,0.32)",
                        }}
                      >
                        <Pill className="text-[color:var(--cyan)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-heading text-lg truncate">
                            {r.medicamento}
                          </div>
                          <StatusChip estado={r.estado} />
                        </div>
                        <div className="text-xs text-[color:var(--text-secondary)] flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                          <span>
                            {r.dosis} · x{r.cantidad}
                          </span>
                          <span className="flex items-center gap-1">
                            <Stethoscope size={11} /> dr.@
                            {r.medico_username || r.medico_id}
                          </span>
                          <span className="flex items-center gap-1">
                            <User size={11} /> @
                            {r.paciente_username || r.paciente_id}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={11} /> {formatDate(r.fecha)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setPicked(r);
                        setPhase("idle");
                      }}
                      className="btn btn-primary shrink-0"
                    >
                      <Stamp size={14} /> Dispensar
                    </motion.button>
                  </SecureCard>
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
        {picked && (
          <div className="space-y-5">
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
                whileHover={phase === "idle" ? { scale: 1.02 } : undefined}
                whileTap={phase === "idle" ? { scale: 0.98 } : undefined}
                className="btn btn-success"
                onClick={dispense}
                disabled={phase !== "idle"}
              >
                <Stamp size={14} /> Confirmar dispensado
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
