import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileSignature,
  ClipboardList,
  Pill,
  ShieldCheck,
  Sparkles,
  AtSign,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Stethoscope,
  Stamp,
  KeyRound,
  Activity,
  Lock,
  Zap,
  CalendarClock,
  Download,
  FileBadge,
  User,
} from "lucide-react";
import PageTransition from "../components/ui/PageTransition";
import SecureCard from "../components/ui/SecureCard";
import StatusChip from "../components/ui/StatusChip";
import AnimatedCounter from "../components/ui/AnimatedCounter";
import LoadingPulse from "../components/ui/LoadingPulse";
import EmptyState from "../components/ui/EmptyState";
import TiltCard from "../components/ui/TiltCard";
import MagneticButton from "../components/ui/MagneticButton";
import { DonutChart, LineChart } from "../components/charts";
import { RevealText, ShineSweep } from "../components/ui/GsapEffects";
import { DoctorMonogram, EcgRibbon } from "../components/illustrations/MedicalAssets";
import {
  donutEstados,
  lineRecetasUltimos14,
  sparklineUltimos7,
  metricasResumen,
} from "../lib/dashboardStats";
import { useGsapTimeline } from "../hooks/useGsapTimeline";
import { listContainer, listItem } from "../lib/animations";
import { useAuthStore } from "../store/useAuthStore";
import { recetasAPI, usuariosAPI, dispensacionTicketsAPI } from "../api";
import { formatDate } from "../lib/utils";
import CertificateCard from "../components/ui/CertificateCard";
import { datasetParaPaciente } from "../lib/stats/paciente";
import { datasetParaMedico } from "../lib/stats/medico";
import { datasetParaFarma } from "../lib/stats/farma";

// Iconos 3D — uno por concepto. Se aplican a las KPI cards según el rol.
import iconShieldCheck   from "../assets/icons/shield-check.png";
import iconDocLock       from "../assets/icons/doc-lock.png";
import iconLockPassword  from "../assets/icons/lock-password.png";
import iconFingerprint   from "../assets/icons/fingerprint.png";
import iconAmbulance     from "../assets/icons/ambulance.png";
import iconPillBottle    from "../assets/icons/pill-bottle.png";
import iconHospital      from "../assets/icons/hospital.png";

const Caduceus3D = lazy(() => import("../components/3d/Caduceus3D"));

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const nav = useNavigate();
  const [recetas, setRecetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [certs, setCerts] = useState([]);
  const [certsLoading, setCertsLoading] = useState(true);
  const [certsError, setCertsError] = useState(null);
  const [pendientesAcuses, setPendientesAcuses] = useState([]);
  // Tick que sube cuando la pestaña vuelve a primer plano → fuerza refetch
  // de recetas para que cambios hechos en otras vistas (dispensar/firmar
  // acuse) se reflejen al volver al dashboard sin reload manual.
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const onActive = () => {
      if (document.visibilityState === "visible") {
        setRefreshTick((t) => t + 1);
      }
    };
    document.addEventListener("visibilitychange", onActive);
    window.addEventListener("focus", onActive);
    return () => {
      document.removeEventListener("visibilitychange", onActive);
      window.removeEventListener("focus", onActive);
    };
  }, []);

  const { register } = useGsapTimeline(["hero", "kpis", "recommended", "stats", "list"]);

  useEffect(() => {
    if (user?.rol === "admin") nav("/admin/solicitudes", { replace: true });
  }, [user, nav]);

  useEffect(() => {
    if (!user || user.rol === "admin") return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let data = [];
        if (user.rol === "paciente") {
          const r = await recetasAPI.porPaciente(user.id);
          data = r.data || [];
        } else if (user.rol === "medico") {
          const r = await recetasAPI.porMedico(user.id);
          data = r.data || [];
        } else if (user.rol === "farmaceutico") {
          const r = await recetasAPI.porFarmaceutico(user.id);
          data = r.data || [];
        }
        if (!cancelled) setRecetas(data);
      } catch (err) {
        if (!cancelled)
          setError(err?.uiMessage || "No se pudieron cargar los datos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user, refreshTick]);

  // Carga de los certificados X.509 del usuario (lectura pura — no afecta nada).
  useEffect(() => {
    if (!user || user.rol === "admin") return;
    let cancelled = false;
    const loadCerts = async () => {
      setCertsLoading(true);
      setCertsError(null);
      try {
        const r = await usuariosAPI.misCertificados();
        if (!cancelled) setCerts(r.data || []);
      } catch (err) {
        if (!cancelled)
          setCertsError(err?.uiMessage || "No se pudieron cargar tus certificados");
      } finally {
        if (!cancelled) setCertsLoading(false);
      }
    };
    loadCerts();
    return () => { cancelled = true; };
  }, [user]);

  // Acuses pendientes de firma — solo paciente. Endpoint ya existente.
  useEffect(() => {
    if (!user || user.rol !== "paciente") return;
    let cancelled = false;
    dispensacionTicketsAPI
      .pendientes()
      .then((r) => { if (!cancelled) setPendientesAcuses(r.data || []); })
      .catch(() => { if (!cancelled) setPendientesAcuses([]); });
    return () => { cancelled = true; };
  }, [user, refreshTick]);

  const stats = useMemo(() => {
    const base = {
      total: recetas.length,
      emitidas: recetas.filter((r) => r.estado === "emitida").length,
      dispensadas: recetas.filter((r) => r.estado === "dispensada").length,
    };
    if (user?.rol === "farmaceutico") {
      base.dispensadas_por_mi = recetas.filter(
        (r) => r.estado === "dispensada" && r.farmaceutico_id === user.id,
      ).length;
    }
    return base;
  }, [recetas, user]);

  // Dataset que alimenta charts/calendar/heatmap, derivado según el rol.
  // KPIs y "actividad reciente" siguen usando `recetas` original.
  //   - médico    → 1 punto por receta (fecha = creación)
  //   - paciente  → 1 punto por acuse firmado (expande firmas_paciente[])
  //   - farma     → 1 punto por dispensación que hizo (expande dispensaciones_propias[])
  const recetasParaGraficos = useMemo(() => {
    if (user?.rol === "paciente") return datasetParaPaciente(recetas);
    if (user?.rol === "farmaceutico") return datasetParaFarma(recetas);
    if (user?.rol === "medico") return datasetParaMedico(recetas);
    return recetas;
  }, [recetas, user?.rol]);

  const sparkTotal = useMemo(() => sparklineUltimos7(recetasParaGraficos), [recetasParaGraficos]);
  const sparkEmitidas = useMemo(
    () => sparklineUltimos7(recetasParaGraficos, (r) => r.estado === "emitida"),
    [recetasParaGraficos],
  );
  const sparkDispensadas = useMemo(
    () => sparklineUltimos7(recetasParaGraficos, (r) => r.estado === "dispensada"),
    [recetasParaGraficos],
  );
  const resumen = useMemo(() => metricasResumen(recetasParaGraficos), [recetasParaGraficos]);

  const latest = recetas.slice(0, 3);
  const firstName = user?.nombre?.split(" ")[0] || "Usuario";

  // Iconos 3D que se muestran en las 3 KPI cards, distintos por rol para que
  // visualmente cada usuario sienta su contexto (paciente = medicamentos,
  // farma = ambulancia/cifrado, médico = hospital/firma digital).
  const ICON_BY_ROLE = {
    paciente:    { total: iconPillBottle,  emitidas: iconDocLock,      dispensadas: iconShieldCheck },
    medico:      { total: iconHospital,    emitidas: iconDocLock,      dispensadas: iconShieldCheck },
    farmaceutico:{ total: iconAmbulance,   emitidas: iconLockPassword, dispensadas: iconFingerprint },
  };
  const icons = ICON_BY_ROLE[user?.rol] || ICON_BY_ROLE.paciente;

  const routes = (() => {
    const rol = user?.rol;
    if (rol === "paciente") return {
      total: "/mis-recetas",
      emitidas: "/mis-recetas?filter=emitida",
      dispensadas: "/mis-recetas?filter=dispensada",
    };
    if (rol === "medico") return {
      total: "/mis-emitidas",
      emitidas: "/mis-emitidas?filter=emitida",
      dispensadas: "/mis-emitidas?filter=dispensada",
    };
    if (rol === "farmaceutico") return {
      total: "/dispensaciones",
      emitidas: "/pendientes",
      dispensadas: "/dispensaciones",
    };
    return { total: "/dashboard", emitidas: "/dashboard", dispensadas: "/dashboard" };
  })();

  const kpi3 = user?.rol === "farmaceutico"
    ? {
        label: "Dispensadas por ti",
        value: stats.dispensadas_por_mi || 0,
        icon: Pill,
        accent: "#00A870",
        to: routes.dispensadas,
        cta: "Ir a dispensaciones",
        spark: sparkDispensadas,
      }
    : {
        label: "Dispensadas",
        value: stats.dispensadas,
        icon: Pill,
        accent: "#00A870",
        to: routes.dispensadas,
        cta: user?.rol === "medico" ? "Ver dispensadas" : "Ver mis dispensadas",
        spark: sparkDispensadas,
      };

  const docInitials = (user?.nombre || "DR")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <PageTransition>
      <div className="space-y-6 min-w-0">
        {/* HERO */}
        <section ref={register("hero")} className="min-w-0">
          <HeroCard firstName={firstName} user={user} docInitials={docInitials} stats={stats} />
        </section>

        {error && (
          <div
            className="rounded-xl p-3.5 flex items-start gap-3"
            style={{ background: "rgba(180,35,24,0.06)", border: "1px solid rgba(180,35,24,0.32)" }}
          >
            <ShieldCheck size={18} className="text-[color:var(--red,#B42318)] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-semibold text-sm text-[color:var(--text-primary)]">
                No se pudieron cargar tus recetas
              </div>
              <div className="text-xs text-[color:var(--text-secondary)] mt-0.5">
                {error}. Verifica tu sesión o vuelve a iniciar con tus llaves privadas.
              </div>
            </div>
          </div>
        )}

        {/* KPIs */}
        <section
          ref={register("kpis")}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 min-w-0"
        >
          <Kpi
            label="Total"
            value={stats.total}
            icon={FileSignature}
            iconImg={icons.total}
            accent="#0A84FF"
            to={routes.total}
            cta={
              user?.rol === "medico"
                ? "Ver todas las emitidas"
                : user?.rol === "farmaceutico"
                  ? "Ver dispensaciones"
                  : "Ver mis recetas"
            }
            spark={sparkTotal}
            delta={resumen.cambio}
            primary
          />
          <Kpi
            label={user?.rol === "farmaceutico" ? "Por dispensar" : "Emitidas"}
            value={stats.emitidas}
            icon={ClipboardList}
            iconImg={icons.emitidas}
            accent="#E08700"
            to={routes.emitidas}
            cta={user?.rol === "farmaceutico" ? "Ir a pendientes" : "Ver activas"}
            spark={sparkEmitidas}
          />
          <Kpi {...kpi3} iconImg={icons.dispensadas} />
        </section>

        {/* RECOMMENDED */}
        <section ref={register("recommended")} className="min-w-0">
          <RecommendedActions rol={user?.rol} stats={stats} />
        </section>

        {/* STATS WIDGET (preview con CTA a /estadisticas).
            Usa el MISMO dataset transformado por rol que /estadisticas
            (recetasParaGraficos = datasetParaPaciente/Medico/Farma).
            Antes recibía `recetas` raw → la gráfica no se actualizaba con
            dispensaciones/acuses recientes. */}
        {!loading && !error && recetas.length > 0 && (
          <section className="min-w-0">
            <StatsWidget
              recetas={recetasParaGraficos}
              rol={user?.rol}
              resumen={resumen}
            />
          </section>
        )}

        {/* RECIENTES */}
        <section ref={register("list")} className="min-w-0">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <SectionTitle
              icon={Activity}
              title="Actividad reciente"
              subtitle={`Últimas ${latest.length} · Vista ${user?.rol || ""}`}
            />
            {!loading && !error && recetas.length > 0 && (
              <Link
                to={routes.total}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, rgba(10,132,255,0.12) 0%, rgba(10,132,255,0.04) 100%)",
                  border: "1px solid rgba(10,132,255,0.32)",
                  color: "var(--cyan)",
                  boxShadow: "0 4px 14px rgba(10,132,255,0.10)",
                }}
              >
                Ver toda la actividad
                <ArrowUpRight size={13} />
              </Link>
            )}
          </div>
          <div className="mt-4">
            {loading && <LoadingPulse rows={3} />}
            {!loading && error && <EmptyState title="Error" message={error} />}
            {!loading && !error && latest.length === 0 && (
              <EmptyState
                title="Aún no hay recetas"
                message="Cuando haya movimiento aparecerá aquí."
              />
            )}
            {!loading && !error && latest.length > 0 && (
              <motion.div
                variants={listContainer}
                initial="initial"
                animate="animate"
                className="grid gap-3"
              >
                {latest.map((r) => (
                  <motion.div key={r.id} variants={listItem}>
                    <ActivityRow r={r} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </section>

        {/* HOY (solo farma) — métricas operativas del día */}
        {user?.rol === "farmaceutico" && !loading && !error && (
          <section className="min-w-0">
            <HoyFarmaSection recetas={recetas} userId={user.id} />
          </section>
        )}

        {/* ACUSES PENDIENTES (solo paciente, solo si hay) */}
        {user?.rol === "paciente" && pendientesAcuses.length > 0 && (
          <section className="min-w-0">
            <AcusesPendientesSection acuses={pendientesAcuses} />
          </section>
        )}

        {/* MIS CERTIFICADOS X.509 (no aplica a admin) */}
        {user?.rol !== "admin" && (
          <section className="min-w-0">
            <MisCertificadosSection
              certs={certs}
              loading={certsLoading}
              error={certsError}
              username={user?.username}
            />
          </section>
        )}
      </div>
    </PageTransition>
  );
}

// ──────────────────────── HOY (FARMA) ────────────────────────
function HoyFarmaSection({ recetas, userId }) {
  // Recetas tienen array `dispensaciones_propias` con timestamps ISO de
  // dispensaciones que ESTE farma hizo. Contamos las de HOY local.
  const stats = useMemo(() => {
    const hoy = new Date();
    const sameDay = (d) =>
      d.getFullYear() === hoy.getFullYear() &&
      d.getMonth() === hoy.getMonth() &&
      d.getDate() === hoy.getDate();

    let dispHoy = 0;
    let pacientesUnicos = new Set();
    for (const r of recetas) {
      const propias = r.dispensaciones_propias || [];
      for (const ts of propias) {
        const d = new Date(ts);
        if (sameDay(d)) {
          dispHoy++;
          pacientesUnicos.add(r.paciente_id);
        }
      }
    }
    return { dispHoy, pacientes: pacientesUnicos.size };
  }, [recetas]);

  const fmt = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <SectionTitle
        icon={CalendarClock}
        title="Hoy"
        subtitle={fmt.charAt(0).toUpperCase() + fmt.slice(1)}
      />
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <HoyCard
          label="Dispensaste hoy"
          value={stats.dispHoy}
          icon={Stamp}
          accent="#00A870"
          desc={stats.dispHoy === 0 ? "Ninguna aún" : "acciones cripto-firmadas"}
        />
        <HoyCard
          label="Pacientes atendidos"
          value={stats.pacientes}
          icon={Stethoscope}
          accent="#0A84FF"
          desc={stats.pacientes === 0 ? "Ninguno aún" : "distintos hoy"}
        />
        <Link
          to="/pendientes"
          className="rounded-2xl p-4 flex items-center gap-3 transition-all hover:-translate-y-1"
          style={{
            background: "linear-gradient(135deg, rgba(10,132,255,0.16) 0%, rgba(10,132,255,0.06) 100%)",
            border: "1px solid rgba(10,132,255,0.42)",
            boxShadow: "0 6px 16px rgba(10,132,255,0.12)",
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(10,132,255,0.20)", border: "1px solid rgba(10,132,255,0.45)" }}
          >
            <Pill size={20} className="text-[color:var(--cyan)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-heading text-base">Ir a pendientes</div>
            <div className="text-xs text-[color:var(--text-secondary)] mt-0.5">
              Recetas listas para dispensar
            </div>
          </div>
          <ArrowUpRight size={16} className="text-[color:var(--cyan)] shrink-0" />
        </Link>
      </div>
    </>
  );
}

function HoyCard({ label, value, icon: Icon, accent, desc }) {
  return (
    <div
      className="rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: "var(--card-bg)",
        border: `1px solid ${accent}55`,
        boxShadow: `0 6px 16px ${accent}18`,
      }}
    >
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-40 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accent}33, transparent 70%)` }}
      />
      <div className="flex items-center gap-3 relative">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accent}1f`, border: `1px solid ${accent}66` }}
        >
          <Icon size={20} style={{ color: accent }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="label-xs truncate">{label}</div>
          <div className="font-heading text-3xl leading-none mt-1" style={{ color: accent }}>
            {value}
          </div>
          <div className="text-[11px] text-[color:var(--text-secondary)] mt-1 truncate">{desc}</div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── ACUSES PENDIENTES ─────────────────────────
function AcusesPendientesSection({ acuses }) {
  // Agrupamos por receta para que el paciente vea "Receta X: 2 acuses".
  const grupos = useMemo(() => {
    const m = {};
    for (const ev of acuses) {
      if (!m[ev.receta_id]) m[ev.receta_id] = { receta_id: ev.receta_id, medicamento: ev.medicamento, count: 0 };
      m[ev.receta_id].count++;
    }
    return Object.values(m);
  }, [acuses]);
  return (
    <>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <SectionTitle
          icon={CalendarClock}
          title="Acuses pendientes de firma"
          subtitle={`${acuses.length} dispensación${acuses.length === 1 ? "" : "es"} esperando tu acuse cripto`}
        />
        <Link
          to="/dispensaciones"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg, rgba(224,135,0,0.18) 0%, rgba(224,135,0,0.08) 100%)",
            border: "1px solid rgba(224,135,0,0.45)",
            color: "#9A6700",
            boxShadow: "0 4px 14px rgba(224,135,0,0.16)",
          }}
        >
          Ir a firmar
          <ArrowUpRight size={13} />
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {grupos.map((g) => (
          <Link
            key={g.receta_id}
            to="/dispensaciones"
            className="block rounded-2xl p-3.5 transition-all hover:-translate-y-1"
            style={{
              background: "linear-gradient(135deg, rgba(255,250,240,0.95) 0%, rgba(255,237,213,0.85) 100%)",
              border: "1px solid rgba(224,135,0,0.42)",
              boxShadow: "0 6px 16px rgba(224,135,0,0.10)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(224,135,0,0.18)",
                  border: "1px solid rgba(224,135,0,0.45)",
                }}
              >
                <CalendarClock size={18} style={{ color: "#9A6700" }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-heading text-sm truncate" style={{ color: "#7A5300" }}>
                  Receta #{g.receta_id}
                </div>
                {g.medicamento && g.medicamento !== "(cifrado)" && (
                  <div className="text-xs mt-0.5 truncate" style={{ color: "#6B5C20" }}>
                    {g.medicamento}
                  </div>
                )}
                <div className="text-[10.5px] font-mono mt-1" style={{ color: "#9A6700", fontWeight: 600 }}>
                  {g.count} acuse{g.count === 1 ? "" : "s"} por firmar
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

// ───────────────────────── MIS CERTIFICADOS ─────────────────────────
function MisCertificadosSection({ certs, loading, error, username }) {
  const downloadPem = (cert) => {
    const blob = new Blob([cert.cert_pem], { type: "application/x-pem-file" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = (username || "usuario").replace(/[^a-zA-Z0-9_.-]/g, "");
    a.download = `securerx_${slug}_cert_${cert.tipo}_${cert.uso}.pem`;
    a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <>
      <SectionTitle
        icon={FileBadge}
        title="Mis certificados X.509"
        subtitle="Descarga tus .pem cuando los necesites"
      />
      <div className="mt-4">
        {loading && <LoadingPulse rows={2} />}
        {!loading && error && <EmptyState title="Error" message={error} />}
        {!loading && !error && certs.length === 0 && (
          <EmptyState
            title="Aún no tienes certificados"
            message="Cuando el administrador apruebe tu solicitud, aparecerán aquí."
          />
        )}
        {!loading && !error && certs.length > 0 && (
          <motion.div
            variants={listContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {certs.map((c) => (
              <motion.div key={c.id} variants={listItem} className="flex flex-col gap-2">
                <CertificateCard
                  algo={c.tipo === "rsa" ? "RSA" : "EC"}
                  serial={c.serial_hex}
                  validUntil={c.fecha_expiracion}
                  status={c.revocado ? "revoked" : "active"}
                  uso={c.uso}
                />
                <button
                  type="button"
                  onClick={() => downloadPem(c)}
                  disabled={c.revocado}
                  className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                  style={{
                    background: "rgba(10,132,255,0.10)",
                    border: "1px solid rgba(10,132,255,0.32)",
                    color: "var(--cyan)",
                  }}
                >
                  <Download size={12} />
                  Descargar .pem
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────── HERO CARD ─────────────────────────────
function HeroCard({ firstName, user, docInitials, stats }) {
  const rolLabel = {
    paciente: "Paciente",
    medico: "Médico",
    farmaceutico: "Farmacéutico",
    admin: "Administrador",
  }[user?.rol] || user?.rol;

  return (
    <div
      className="relative overflow-hidden rounded-3xl"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.78) 0%, rgba(244,250,255,0.55) 100%)",
        border: "1px solid rgba(10,132,255,0.22)",
        backdropFilter: "blur(28px) saturate(1.35)",
        WebkitBackdropFilter: "blur(28px) saturate(1.35)",
        boxShadow: "0 30px 70px rgba(10,36,67,0.14), 0 1px 1px rgba(255,255,255,0.6) inset",
      }}
    >
      {/* Halos */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "-30%", right: "-10%", width: 480, height: 480,
          background: "radial-gradient(circle, rgba(10,132,255,0.30), transparent 65%)",
          filter: "blur(40px)",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: "-30%", left: "10%", width: 380, height: 380,
          background: "radial-gradient(circle, rgba(0,184,217,0.25), transparent 65%)",
          filter: "blur(40px)",
        }}
      />
      {/* ECG decorativa al fondo */}
      <div className="absolute inset-x-0 bottom-0 opacity-50 pointer-events-none">
        <EcgRibbon height={60} color="#0A84FF" />
      </div>

      <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[1fr_200px] gap-6 p-6 sm:p-8 min-w-0">
        <div className="min-w-0 flex flex-col justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0 mb-1">
              <DoctorMonogram initials={docInitials} size={26} />
              <div className="label-xs flex items-center gap-1.5 min-w-0">
                <AtSign size={10} className="opacity-70 shrink-0" />
                <span className="font-mono truncate">{user?.username}</span>
                <span className="opacity-50 shrink-0">·</span>
                <span className="shrink-0 truncate">{rolLabel}</span>
              </div>
            </div>
            <div className="font-heading text-2xl sm:text-[28px] md:text-[32px] leading-[1.1] break-words">
              <RevealText as="span">{`Hola, ${firstName}.`}</RevealText>
            </div>

            <p className="text-[color:var(--text-secondary)] mt-4 text-[14px] sm:text-[15px] max-w-2xl leading-relaxed">
              {greetingFor(user?.rol, stats)}
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <QuickAction role={user?.rol} />
          </div>
        </div>

        {/* Caduceo solo en xl+ — en pantallas medianas no cabe bien */}
        <div className="hidden xl:block">
          <div
            className="rounded-2xl overflow-hidden h-full flex items-center justify-center"
            style={{
              background: "radial-gradient(circle at 50% 40%, rgba(10,132,255,0.10), transparent 70%)",
              border: "1px solid rgba(10,132,255,0.18)",
              minHeight: 160,
              maxHeight: 180,
            }}
          >
            <Suspense fallback={null}>
              <Caduceus3D height={160} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

function greetingFor(rol, stats) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  if (rol === "paciente") {
    return `${part}. Tienes ${stats.emitidas} receta${stats.emitidas === 1 ? "" : "s"} activa${stats.emitidas === 1 ? "" : "s"}. Cada receta viaja cifrada con AES-GCM y firmada por tu médico.`;
  }
  if (rol === "medico") {
    return `${part}. Has emitido ${stats.total} receta${stats.total === 1 ? "" : "s"} en total. Tu llave ECDSA está activa y verificable por la CA SecureRx.`;
  }
  if (rol === "farmaceutico") {
    const my = stats.dispensadas_por_mi || 0;
    return `${part}. ${my} dispensación${my === 1 ? "" : "es"} firmada${my === 1 ? "" : "s"} por ti. Cada sello queda verificable contra el manifiesto canónico.`;
  }
  return `${part}.`;
}

function SystemPing() {
  return (
    <span className="relative inline-flex items-center justify-center shrink-0">
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: "var(--emerald)" }}
      />
      <motion.span
        aria-hidden
        className="absolute w-2 h-2 rounded-full"
        style={{ background: "var(--emerald)" }}
        animate={{ scale: [1, 2.4], opacity: [0.55, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
      />
    </span>
  );
}

// ─────────────────────────── KPI CARD ──────────────────────────────
function Kpi({ label, value, icon: Icon, iconImg, accent, to, cta, spark, delta, primary }) {
  const content = (
    <SecureCard className="group relative overflow-hidden min-h-[160px] flex flex-col justify-between p-4 sm:p-5 cursor-pointer min-w-0">
      <div
        className="absolute -top-12 -right-12 w-36 h-36 rounded-full opacity-50 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accent}33, transparent 70%)` }}
      />

      <div className="relative flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="label-xs truncate">{label}</div>
          {typeof delta === "number" && (
            <span
              className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={
                delta >= 0
                  ? { background: "rgba(0,168,112,0.12)", color: "#00775A", border: "1px solid rgba(0,168,112,0.32)" }
                  : { background: "rgba(180,35,24,0.10)", color: "#B42318", border: "1px solid rgba(180,35,24,0.32)" }
              }
            >
              {delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {delta >= 0 ? "+" : ""}{delta}% vs mes ant.
            </span>
          )}
        </div>
        {iconImg ? (
          // Icono 3D — flota continuamente y hace un wiggle leve en hover.
          // drop-shadow del color del KPI une el icono con la paleta de la card.
          <motion.div
            className="relative shrink-0 pointer-events-none"
            style={{ width: 86, height: 86 }}
            animate={{ y: [0, -5, 0], rotate: [0, 2.5, 0, -2.5, 0] }}
            transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <img
              src={iconImg}
              alt=""
              draggable={false}
              className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
              style={{
                filter: `drop-shadow(0 10px 18px ${accent}66) drop-shadow(0 3px 6px rgba(10,36,67,0.22))`,
              }}
            />
          </motion.div>
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${accent}18`, border: `1px solid ${accent}55` }}
          >
            <Icon size={18} style={{ color: accent }} />
          </div>
        )}
      </div>

      <div
        className="relative font-heading text-3xl sm:text-4xl mt-2 leading-none tabular-nums"
        style={{ color: accent }}
      >
        <AnimatedCounter value={value} />
      </div>

      {to && (
        <div
          className="relative mt-3 flex items-center justify-between text-[11px] font-medium min-w-0"
          style={{ color: "var(--text-secondary)" }}
        >
          <span className="truncate min-w-0 pr-2">{cta || "Ver detalle"}</span>
          <ArrowUpRight
            size={14}
            className="shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            style={{ color: accent }}
          />
        </div>
      )}

      {primary && <ShineSweep duration={5} delay={1.2} intensity={0.25} />}
    </SecureCard>
  );

  return (
    <TiltCard max={4}>
      {to ? (
        <Link
          to={to}
          aria-label={cta || label}
          className="block focus:outline-none focus-visible:ring-2 rounded-xl"
          style={{ "--tw-ring-color": accent }}
        >
          {content}
        </Link>
      ) : content}
    </TiltCard>
  );
}

// ───────────────────────── QUICK ACTION ───────────────────────────
function QuickAction({ role }) {
  if (role === "medico") {
    return (
      <Link to="/nueva-receta">
        <MagneticButton className="btn btn-primary btn-lg">
          <Sparkles size={16} /> Emitir nueva receta
        </MagneticButton>
      </Link>
    );
  }
  if (role === "farmaceutico") {
    return (
      <Link to="/pendientes">
        <MagneticButton className="btn btn-primary btn-lg">
          <ClipboardList size={16} /> Dispensar
        </MagneticButton>
      </Link>
    );
  }
  if (role === "paciente") {
    return (
      <Link to="/mis-recetas">
        <MagneticButton className="btn btn-primary btn-lg">
          <Pill size={16} /> Mis recetas
        </MagneticButton>
      </Link>
    );
  }
  return null;
}

// ────────────────── RECOMMENDED ACTIONS POR ROL ───────────────────
function RecommendedActions({ rol, stats }) {
  const items = (() => {
    if (rol === "paciente") return [
      { icon: Pill,      title: "Revisar tus recetas",   hint: "Ver activas y dispensadas", to: "/mis-recetas",   accent: "#0A84FF" },
      { icon: Stamp,     title: "Firmar acuses",         hint: "Confirma entregas recibidas", to: "/dispensaciones", accent: "#00A870" },
      { icon: KeyRound,  title: "Verificar firmas",      hint: "ECDSA P-256 + SHA3-256",     to: "/verificar",     accent: "#00B8D9" },
    ];
    if (rol === "medico") return [
      { icon: FileSignature, title: "Emitir nueva receta",   hint: "Firmar con tu ECDSA", to: "/nueva-receta", accent: "#0A84FF" },
      { icon: ClipboardList, title: "Mis recetas emitidas",  hint: `${stats.emitidas} activa${stats.emitidas === 1 ? "" : "s"}`, to: "/mis-emitidas", accent: "#E08700" },
      { icon: Stamp,         title: "Histórico de dispensaciones", hint: "Read-only", to: "/dispensaciones", accent: "#00A870" },
    ];
    if (rol === "farmaceutico") return [
      { icon: ClipboardList, title: "Recetas pendientes",   hint: "Buscar por ID o paciente", to: "/pendientes", accent: "#E08700" },
      { icon: Stamp,         title: "Dispensaciones",        hint: "Histórico completo", to: "/dispensaciones", accent: "#00A870" },
    ];
    return [];
  })();

  if (items.length === 0) return null;

  return (
    <div className="space-y-4 min-w-0">
      <SectionTitle icon={Zap} title="Acciones recomendadas" subtitle="Atajos rápidos según tu rol" />
      <motion.div
        variants={listContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        {items.map((it, i) => (
          <motion.div key={i} variants={listItem}>
            <TiltCard max={10} scale={1.04} perspective={1000}>
              <Link
                to={it.to}
                className="group block rounded-2xl p-5 relative overflow-hidden transition-shadow min-w-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.86), rgba(244,250,255,0.62))",
                  border: `1px solid ${it.accent}55`,
                  backdropFilter: "blur(20px) saturate(1.2)",
                  WebkitBackdropFilter: "blur(20px) saturate(1.2)",
                  boxShadow: `0 12px 32px ${it.accent}1A, 0 1px 1px rgba(255,255,255,0.55) inset`,
                  transformStyle: "preserve-3d",
                }}
              >
                {/* Halo radial superior — se intensifica en hover */}
                <div
                  aria-hidden
                  className="absolute -top-14 -right-14 w-40 h-40 rounded-full pointer-events-none opacity-50 transition-opacity duration-300 group-hover:opacity-90"
                  style={{
                    background: `radial-gradient(circle, ${it.accent}55, transparent 70%)`,
                    filter: "blur(8px)",
                  }}
                />

                {/* Sparkle decorativo que aparece en hover */}
                <motion.div
                  aria-hidden
                  className="absolute top-3 right-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  style={{ color: it.accent }}
                >
                  <Sparkles size={14} />
                </motion.div>

                {/* Shimmer sweep en hover */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl"
                >
                  <div
                    className="absolute -inset-y-2 -left-1/2 w-1/3 transition-transform duration-700 ease-out group-hover:translate-x-[420%]"
                    style={{
                      background:
                        "linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
                      transform: "translateX(0)",
                      filter: "blur(6px)",
                    }}
                  />
                </div>

                <div className="relative flex items-start gap-3.5 min-w-0" style={{ transform: "translateZ(20px)" }}>
                  {/* Icono que se anima en hover: scale + wiggle */}
                  <motion.div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${it.accent}28 0%, ${it.accent}10 100%)`,
                      border: `1px solid ${it.accent}66`,
                      boxShadow: `0 6px 16px ${it.accent}25`,
                    }}
                    whileHover={{
                      scale: 1.15,
                      rotate: [0, -10, 10, -6, 6, 0],
                      transition: { duration: 0.55 },
                    }}
                  >
                    <it.icon size={20} style={{ color: it.accent }} />
                  </motion.div>

                  <div className="min-w-0 flex-1" style={{ transform: "translateZ(10px)" }}>
                    <div className="font-semibold text-[15px] leading-tight truncate">{it.title}</div>
                    <div className="text-xs text-[color:var(--text-secondary)] mt-1 leading-snug">
                      {it.hint}
                    </div>
                  </div>

                  <motion.div
                    className="shrink-0"
                    style={{ color: it.accent, transform: "translateZ(15px)" }}
                    whileHover={{ x: 4, y: -4 }}
                  >
                    <ArrowUpRight
                      size={18}
                      className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                    />
                  </motion.div>
                </div>
              </Link>
            </TiltCard>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

// ───────────────────────── ACTIVITY ROW ───────────────────────────
function ActivityRow({ r }) {
  const realizadas = r.dispensaciones_realizadas ?? 0;
  const permitidas = r.dispensaciones_permitidas ?? 1;
  const ratio = Math.min(1, realizadas / Math.max(1, permitidas));
  const titulo = r.medicamento === "(cifrado)" ? `Receta #${r.id}` : r.medicamento;
  // Fecha corta: "24 may" sin año/hora — la card de actividad reciente no
  // necesita timestamp completo, solo orientación temporal.
  const fechaCorta = r.fecha
    ? new Date(r.fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
    : "";

  return (
    <SecureCard className="flex items-center gap-4 min-w-0">
      <motion.div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: "linear-gradient(135deg, rgba(10,132,255,0.18) 0%, rgba(0,184,217,0.10) 100%)",
          border: "1px solid rgba(10,132,255,0.40)",
        }}
        whileHover={{ rotate: [0, -8, 8, 0] }}
        transition={{ duration: 0.5 }}
      >
        <Pill size={20} className="text-[color:var(--cyan)]" />
      </motion.div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="font-semibold truncate text-[15px]">{titulo}</div>
          <StatusChip estado={r.estado} />
        </div>
        {/* Solo iconos + nombres — sin "·" sueltos, sin texto redundante. */}
        <div className="text-xs text-[color:var(--text-secondary)] flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          <span className="flex items-center gap-1 truncate">
            <User size={11} className="shrink-0" />
            @{r.paciente_username || `id${r.paciente_id}`}
          </span>
          <span className="flex items-center gap-1 truncate">
            <Stethoscope size={11} className="shrink-0" />
            @{r.medico_username || `id${r.medico_id}`}
          </span>
          {fechaCorta && (
            <span className="flex items-center gap-1">
              <CalendarClock size={11} className="shrink-0" />
              {fechaCorta}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 max-w-[280px]">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(10,36,67,0.08)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,#0A84FF,#00A870)" }}
              initial={{ width: 0 }}
              animate={{ width: `${ratio * 100}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="text-[10.5px] font-mono font-semibold tabular-nums" style={{ color: "var(--blue-deep)" }}>
            {realizadas}/{permitidas}
          </span>
        </div>
      </div>
    </SecureCard>
  );
}

// ─────────────────────── SYSTEM STATUS FOOTER ──────────────────────
function SystemStatus() {
  const items = [
    { icon: Lock,         label: "TLS",     value: "1.3 activo",            tone: "#00A870" },
    { icon: ShieldCheck,  label: "Firma",   value: "ECDSA P-256 + SHA3-256", tone: "#0A84FF" },
    { icon: KeyRound,     label: "Cifrado", value: "AES-128-GCM",            tone: "#00B8D9" },
    { icon: Stethoscope,  label: "CA",      value: "SecureRx interna",       tone: "#0052CC" },
  ];
  return (
    <div
      className="rounded-2xl p-4 sm:p-5 relative overflow-hidden min-w-0"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.62), rgba(244,250,255,0.42))",
        border: "1px solid rgba(10,132,255,0.18)",
        backdropFilter: "blur(20px) saturate(1.2)",
        WebkitBackdropFilter: "blur(20px) saturate(1.2)",
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <SystemPing />
          <div className="font-heading text-sm">Sistema operativo</div>
        </div>
        <div className="text-[10px] font-mono text-[color:var(--text-secondary)]">
          SecureRx · v1.0
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 min-w-0">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${it.tone}14`, border: `1px solid ${it.tone}38` }}
            >
              <it.icon size={14} style={{ color: it.tone }} />
            </div>
            <div className="min-w-0">
              <div className="label-xs">{it.label}</div>
              <div className="text-[11px] font-mono truncate" style={{ color: it.tone }}>
                {it.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─────────────── STATS WIDGET (preview con CTA a /estadisticas) ───────────
// Card grande con donut + line de tendencia + CTA que lleva al dashboard
// completo de estadísticas. El detalle vive en /estadisticas; aquí solo
// preview.
function StatsWidget({ recetas, rol, resumen }) {
  const donut = useMemo(() => donutEstados(recetas), [recetas]);
  const line = useMemo(() => lineRecetasUltimos14(recetas), [recetas]);
  const subtitle = rol === "paciente"
    ? "Tu actividad criptográfica"
    : rol === "medico"
      ? "Tu emisión de recetas"
      : "Tu actividad de dispensación";
  const accent = rol === "farmaceutico" ? "#00A870" : "#0A84FF";

  return (
    <div className="space-y-3 min-w-0">
      <SectionTitle icon={BarChart3} title="Estadísticas" subtitle={subtitle} />
      <Link
        to="/estadisticas"
        className="group block rounded-2xl overflow-hidden transition-all min-w-0"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.78), rgba(244,250,255,0.55))",
          border: "1px solid rgba(10,132,255,0.22)",
          backdropFilter: "blur(20px) saturate(1.2)",
          WebkitBackdropFilter: "blur(20px) saturate(1.2)",
          boxShadow: "0 12px 28px rgba(10,36,67,0.08)",
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-4 md:gap-6 p-4 sm:p-5 items-center min-w-0">
          <div className="flex justify-center md:justify-start">
            <DonutChart
              segments={donut}
              size={150}
              thickness={16}
              centerValue={recetas.length}
              centerLabel="TOTAL"
              legend="none"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
              <div className="min-w-0">
                <div className="font-semibold text-sm">Tendencia · últimos 14 días</div>
                <div className="text-[10.5px] text-[color:var(--text-secondary)] mt-0.5">
                  Click para ver detalle, top medicamentos y mapa mensual
                </div>
              </div>
              {typeof resumen.cambio === "number" && (
                <span
                  className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={
                    resumen.cambio >= 0
                      ? { background: "rgba(0,168,112,0.10)", color: "#00775A", border: "1px solid rgba(0,168,112,0.32)" }
                      : { background: "rgba(180,35,24,0.10)", color: "#B42318", border: "1px solid rgba(180,35,24,0.32)" }
                  }
                >
                  {resumen.cambio >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {resumen.cambio >= 0 ? "+" : ""}{resumen.cambio}%
                </span>
              )}
            </div>
            <div className="h-[100px] min-w-0">
              <LineChart data={line} height={100} color={accent} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {donut.map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10px] font-medium">
                  <span className="w-2 h-2 rounded-sm" style={{ background: d.color }} />
                  <span style={{ color: "var(--text-secondary)" }}>{d.label}</span>
                  <strong className="tabular-nums" style={{ color: "var(--text-primary)" }}>{d.value}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0 self-stretch flex md:flex-col md:items-end justify-between gap-3 min-w-0">
            <div
              className="font-heading text-3xl tabular-nums text-right hidden md:block leading-none"
              style={{ color: accent }}
            >
              {recetas.length}
            </div>
            <div
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all group-hover:gap-2.5 whitespace-nowrap"
              style={{ background: `${accent}14`, color: accent, border: `1px solid ${accent}38` }}
            >
              Ver estadísticas
              <ArrowUpRight
                size={14}
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: "rgba(10,132,255,0.10)",
          border: "1px solid rgba(10,132,255,0.32)",
        }}
      >
        <Icon size={16} className="text-[color:var(--cyan)]" />
      </div>
      <div className="min-w-0">
        <h2 className="font-heading text-xl leading-tight truncate">{title}</h2>
        {subtitle && (
          <div className="text-xs text-[color:var(--text-secondary)] mt-0.5 truncate">{subtitle}</div>
        )}
      </div>
    </div>
  );
}
