import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, ArrowLeft, RefreshCcw, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import PageTransition from "../components/ui/PageTransition";
import LoadingPulse from "../components/ui/LoadingPulse";
import EmptyState from "../components/ui/EmptyState";
import {
  DonutChart, LineChart, BarChart, ActivityHeatmap, ChartCard,
} from "../components/charts";
import MonthlyHeatmap from "../components/charts/MonthlyHeatmap";
import {
  donutEstados,
  lineRecetasUltimos14,
  barEmitidasSemana,
  topMedicamentos,
  heatmapActividad,
  metricasResumen,
} from "../lib/dashboardStats";
import { useAuthStore } from "../store/useAuthStore";
import { recetasAPI } from "../api";
import { datasetParaPaciente } from "../lib/stats/paciente";
import { datasetParaMedico } from "../lib/stats/medico";
import { datasetParaFarma } from "../lib/stats/farma";
import PageHero from "../components/ui/PageHero";
import iconPillBottle from "../assets/icons/pill-bottle.png";
import iconHospital from "../assets/icons/hospital.png";
import iconAmbulance from "../assets/icons/ambulance.png";

const ICONO_POR_ROL = {
  paciente: iconPillBottle,
  medico: iconHospital,
  farmaceutico: iconAmbulance,
};

// Página dedicada de estadísticas / dashboard analítico.
// Vive aparte del Dashboard principal — esa página solo enseña un widget
// con preview y CTA a esta. Aquí ponemos todas las gráficas detalladas
// + un mapa de calor mensual completo (calendario).

export default function Estadisticas() {
  const user = useAuthStore((s) => s.user);
  const nav = useNavigate();
  const [recetas, setRecetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  // Refetch automático cuando la pestaña vuelve a estar visible / gana focus,
  // así los cambios hechos en otras vistas (dispensar, firmar acuse) se
  // reflejan al regresar a estadísticas sin reload manual.
  useEffect(() => {
    const onActive = () => {
      if (document.visibilityState === "visible") {
        setVersion((v) => v + 1);
      }
    };
    document.addEventListener("visibilitychange", onActive);
    window.addEventListener("focus", onActive);
    return () => {
      document.removeEventListener("visibilitychange", onActive);
      window.removeEventListener("focus", onActive);
    };
  }, []);

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
        if (!cancelled) setError(err?.uiMessage || "No se pudieron cargar los datos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true };
  }, [user, version]);

  // Dataset que alimenta charts/calendar/heatmap según el rol. Cada rol
  // tiene su propia función en src/lib/stats/<rol>.js — así la lógica de
  // "qué fecha cuenta para mí" vive separada y no se mezcla.
  const recetasGrafico = useMemo(() => {
    if (user?.rol === "paciente") return datasetParaPaciente(recetas);
    if (user?.rol === "farmaceutico") return datasetParaFarma(recetas);
    if (user?.rol === "medico") return datasetParaMedico(recetas);
    return recetas;
  }, [recetas, user?.rol]);

  const donut = useMemo(() => donutEstados(recetas), [recetas]);
  const line = useMemo(() => lineRecetasUltimos14(recetasGrafico), [recetasGrafico]);
  const bar = useMemo(() => barEmitidasSemana(recetasGrafico), [recetasGrafico]);
  const top = useMemo(() => topMedicamentos(recetas, 5), [recetas]);
  const heat = useMemo(() => heatmapActividad(recetasGrafico, 12), [recetasGrafico]);
  const resumen = useMemo(() => metricasResumen(recetasGrafico), [recetasGrafico]);

  const rolLabel = {
    paciente: "Paciente",
    medico: "Médico",
    farmaceutico: "Farmacéutico",
  }[user?.rol] || user?.rol;

  return (
    <PageTransition>
      <div className="space-y-6 min-w-0">
        <PageHero
          eyebrow={`Vista ${rolLabel}`}
          title="Estadísticas"
          subtitle="Tu actividad criptográfica detallada."
          iconImg={ICONO_POR_ROL[user?.rol]}
          icon={BarChart3}
          accent="#0A84FF"
        >
          <button
            type="button"
            onClick={() => nav("/dashboard")}
            className="btn btn-ghost btn-sm"
          >
            <ArrowLeft size={14} /> Dashboard
          </button>
          <button
            type="button"
            onClick={() => setVersion((v) => v + 1)}
            className="btn btn-ghost btn-sm"
          >
            <RefreshCcw size={14} /> Refrescar
          </button>
        </PageHero>

        {/* Resumen rápido (chips) */}
        <ResumenChips recetas={recetas} resumen={resumen} rol={user?.rol} userId={user?.id} />

        {error && (
          <div
            className="rounded-xl p-3.5 flex items-start gap-3"
            style={{ background: "rgba(180,35,24,0.06)", border: "1px solid rgba(180,35,24,0.32)" }}
          >
            <div className="text-sm">
              <strong>No se pudieron cargar tus datos.</strong> {error}
            </div>
          </div>
        )}

        {loading && <LoadingPulse rows={4} />}

        {!loading && !error && recetas.length === 0 && (
          <EmptyState
            title="Sin datos para mostrar"
            message="Cuando haya actividad aquí podrás ver tendencias, distribución y mapas de calor."
          />
        )}

        {!loading && !error && recetas.length > 0 && (
          <>
            {/* Stats principales por rol */}
            {user?.rol === "paciente" && (
              <PacienteStats line={line} donut={donut} resumen={resumen} total={recetas.length} />
            )}
            {user?.rol === "medico" && (
              <MedicoStats line={line} donut={donut} resumen={resumen} total={recetas.length} />
            )}
            {user?.rol === "farmaceutico" && (
              <FarmaceuticoStats
                recetas={recetas}
                dispensaciones={recetasGrafico}
                donut={donut}
                resumen={resumen}
              />
            )}

            {/* Mapa de calor mensual — para todos los roles */}
            <section className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(10,132,255,0.10)", border: "1px solid rgba(10,132,255,0.32)" }}
                >
                  <Calendar size={16} className="text-[color:var(--cyan)]" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-heading text-xl leading-tight">Mapa de calor mensual</h2>
                  <div className="text-xs text-[color:var(--text-secondary)] mt-0.5">
                    Cada celda = un día del mes actual · intensidad = nivel de actividad
                  </div>
                </div>
              </div>
              <ChartCard
                title={new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
                subtitle="Recetas con fecha en este mes"
                dense
              >
                <MonthlyHeatmap recetas={recetasGrafico} color="#0A84FF" />
              </ChartCard>
            </section>
          </>
        )}
      </div>
    </PageTransition>
  );
}

// ─────────────── Resumen tipo chips ───────────────
function ResumenChips({ recetas, resumen, rol, userId }) {
  const chips = useMemo(() => {
    const total = recetas.length;
    const emit = recetas.filter((r) => r.estado === "emitida").length;
    const disp = recetas.filter((r) => r.estado === "dispensada").length;
    const rev = recetas.filter((r) => r.estado === "revocada").length;
    const base = [
      { label: "Total", value: total, color: "#0A84FF" },
      { label: "Emitidas", value: emit, color: "#E08700" },
      { label: "Dispensadas", value: disp, color: "#00A870" },
      { label: "Revocadas", value: rev, color: "#B42318" },
    ];
    if (rol === "farmaceutico") {
      base.push({
        label: "Tuyas",
        value: recetas.filter((r) => r.farmaceutico_id === userId && r.estado === "dispensada").length,
        color: "#00B8D9",
      });
    }
    return base;
  }, [recetas, rol, userId]);

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {chips.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
          style={{
            background: `${c.color}12`,
            border: `1px solid ${c.color}38`,
            color: c.color,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
          {c.label} <strong className="tabular-nums">{c.value}</strong>
        </span>
      ))}
      <DeltaChip delta={resumen.cambio} />
    </div>
  );
}

function DeltaChip({ delta }) {
  if (typeof delta !== "number") return null;
  const up = delta >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={
        up
          ? { background: "rgba(0,168,112,0.10)", color: "#00775A", border: "1px solid rgba(0,168,112,0.32)" }
          : { background: "rgba(180,35,24,0.10)", color: "#B42318", border: "1px solid rgba(180,35,24,0.32)" }
      }
    >
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? "+" : ""}{delta}% vs mes anterior
    </span>
  );
}

function PacienteStats({ line, donut, resumen, total }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
      <ChartCard
        className="lg:col-span-2"
        title="Acuses firmados"
        subtitle="Últimos 14 días · firmas de dispensación que has hecho"
        delta={resumen.cambio}
        footer={`Recetas totales: ${total}`}
      >
        <LineChart data={line} height={220} color="#0A84FF" yLabel="acuses" />
      </ChartCard>
      <ChartCard title="Distribución por estado" subtitle="Total por categoría">
        <DonutChart segments={donut} size={180} thickness={22} centerValue={total} centerLabel="TOTAL" legend="bottom" />
      </ChartCard>
    </section>
  );
}

function MedicoStats({ line, donut, resumen, total }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
      <ChartCard
        className="lg:col-span-2"
        title="Recetas emitidas"
        subtitle="Últimos 14 días · 1 punto por emisión"
        delta={resumen.cambio}
        footer={`Total emitidas: ${total}`}
      >
        <LineChart
          data={line}
          height={220}
          color="#0A84FF"
          fill="rgba(10,132,255,0.18)"
          yLabel="recetas"
        />
      </ChartCard>
      <ChartCard title="Estado actual" subtitle="Distribución por etapa">
        <DonutChart segments={donut} size={180} thickness={22} centerValue={total} centerLabel="TOTAL" legend="bottom" />
      </ChartCard>
    </section>
  );
}

function FarmaceuticoStats({ recetas, dispensaciones, donut, resumen }) {
  // `dispensaciones` ya viene expandido por el datasetParaFarma — 1 entrada
  // por dispensación que ÉL hizo. La línea cuenta esas entradas directas,
  // así un día con 8 dispensaciones suyas aparece como 8, no como 1.
  const lineMias = useMemo(
    () => lineRecetasUltimos14(dispensaciones),
    [dispensaciones],
  );
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
      <ChartCard
        className="lg:col-span-2"
        title="Tus dispensaciones"
        subtitle="Últimos 14 días · 1 punto por acción de dispensación"
        delta={resumen.cambio}
        footer={`Total dispensaciones: ${dispensaciones.length} · Recetas tocadas: ${recetas.length}`}
      >
        <LineChart
          data={lineMias}
          height={220}
          color="#00A870"
          fill="rgba(0,168,112,0.18)"
          yLabel="dispensaciones"
        />
      </ChartCard>
      <ChartCard title="Estado del catálogo" subtitle="Recetas visibles">
        <DonutChart segments={donut} size={180} thickness={22} centerValue={recetas.length} centerLabel="VISTAS" legend="bottom" />
      </ChartCard>
    </section>
  );
}
