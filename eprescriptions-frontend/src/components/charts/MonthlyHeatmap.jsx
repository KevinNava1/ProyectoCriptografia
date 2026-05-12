import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

// Calendario mensual compacto y dinámico.
//
// Mejoras vs versión anterior:
//   - Celdas chicas (max-width fija 34px) — antes ocupaban todo el ancho
//   - Navegación mes anterior / siguiente (mismos datos, distinta vista)
//   - Hover: panel lateral con detalle del día seleccionado
//   - Animación de entrada por filas (no celda por celda)
//   - Tooltip rico con día completo y count

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function weekdayCol(d) {
  return (d.getDay() + 6) % 7;
}

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function monthLabel(d) {
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function dayFullLabel(d) {
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

export default function MonthlyHeatmap({ recetas = [], color = "#0A84FF", dateField = "fecha" }) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [hoveredDay, setHoveredDay] = useState(null);

  const monthStart = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1), [cursor]);
  const monthEnd = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), [cursor]);
  const daysInMonth = monthEnd.getDate();
  const firstCol = weekdayCol(monthStart);
  const canGoFwd = cursor.getFullYear() < today.getFullYear() ||
                   (cursor.getFullYear() === today.getFullYear() && cursor.getMonth() < today.getMonth());

  // Contar recetas por día del mes en el cursor
  const counts = useMemo(() => {
    const c = new Array(daysInMonth + 1).fill(0);
    for (const r of recetas) {
      const ts = r[dateField] || r.fecha;
      if (!ts) continue;
      try {
        const d = new Date(ts);
        if (d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth()) {
          c[d.getDate()] += 1;
        }
      } catch { /* skip */ }
    }
    return c;
  }, [recetas, dateField, daysInMonth, cursor]);

  const maxCount = Math.max(1, ...counts);

  const cells = useMemo(() => {
    const totalSlots = firstCol + daysInMonth;
    const rows = Math.ceil(totalSlots / 7);
    const grid = [];
    for (let i = 0; i < rows * 7; i++) {
      const dayNumber = i - firstCol + 1;
      if (dayNumber >= 1 && dayNumber <= daysInMonth) {
        grid.push({ day: dayNumber, count: counts[dayNumber] });
      } else {
        grid.push(null);
      }
    }
    return grid;
  }, [firstCol, daysInMonth, counts]);

  const opacity = (c) => (c === 0 ? 0.10 : 0.30 + (c / maxCount) * 0.70);
  const isToday = (day) => sameMonth(cursor, today) && day === today.getDate();
  const totalDelMes = counts.reduce((a, b) => a + b, 0);
  const diaMax = counts.indexOf(Math.max(...counts.slice(1)));

  // Métricas extra para llenar el panel lateral con info útil
  const diasActivos = useMemo(
    () => counts.slice(1).filter((c) => c > 0).length,
    [counts]
  );
  const diasSinActividad = daysInMonth - diasActivos;
  const promedioActivo = diasActivos > 0
    ? Math.round((totalDelMes / diasActivos) * 10) / 10
    : 0;
  const promedioMes = Math.round((totalDelMes / daysInMonth) * 10) / 10;

  // Distribución por día de la semana (L-D). Útil para mostrar cuál es el
  // día "favorito": el dow con más recetas acumuladas en el mes.
  const dowDist = useMemo(() => {
    const dist = [0, 0, 0, 0, 0, 0, 0];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      dist[weekdayCol(d)] += counts[day] || 0;
    }
    return dist;
  }, [counts, daysInMonth, cursor]);
  const dowMax = Math.max(...dowDist);
  const dowTop = dowDist.indexOf(dowMax);

  // Sparkline por día (1..daysInMonth) — array crudo para pintar mini barras
  const sparkline = useMemo(() => counts.slice(1), [counts]);

  const hoveredCount = hoveredDay !== null ? counts[hoveredDay] : null;
  const hoveredDate = hoveredDay !== null ? new Date(cursor.getFullYear(), cursor.getMonth(), hoveredDay) : null;
  // Delta del día hover vs promedio del mes activo (para contexto)
  const hoveredDelta = hoveredCount && promedioActivo > 0
    ? Math.round(((hoveredCount - promedioActivo) / promedioActivo) * 100)
    : null;

  // Stats de la semana donde cae el día seleccionado.
  // Lunes..domingo, los días fuera del mes salen marcados (fuera=true) para
  // pintarlos en gris en la mini barra semanal.
  const semanaHover = useMemo(() => {
    if (!hoveredDate) return null;
    const col = weekdayCol(hoveredDate); // 0=L .. 6=D
    const lunes = new Date(hoveredDate);
    lunes.setDate(hoveredDate.getDate() - col);
    const dias = [];
    let total = 0, activos = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      const fuera = d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear();
      const c = fuera ? 0 : (counts[d.getDate()] || 0);
      if (!fuera) {
        total += c;
        if (c > 0) activos += 1;
      }
      dias.push({
        day: d.getDate(),
        date: d,
        count: c,
        fuera,
        esHovered: !fuera && d.getDate() === hoveredDay,
      });
    }
    const promedio = activos > 0 ? Math.round((total / activos) * 10) / 10 : 0;
    // Número de semana del mes (1..6) y rango "DD–DD" en mismo mes
    const numeroSemana = Math.ceil((hoveredDay + firstCol) / 7);
    return { dias, total, promedio, activos, numeroSemana };
  }, [hoveredDate, hoveredDay, cursor, counts, firstCol]);

  return (
    <div className="min-w-0">
      {/* Header con navegación */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[rgba(10,132,255,0.10)] text-[color:var(--text-secondary)]"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <div className="text-[12px] font-mono uppercase tracking-wider px-2 min-w-[140px] text-center" style={{ color: 'var(--text-primary)' }}>
            {monthLabel(cursor)}
          </div>
          <button
            type="button"
            onClick={() => canGoFwd && setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            disabled={!canGoFwd}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[rgba(10,132,255,0.10)] text-[color:var(--text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[color:var(--text-secondary)]">
          <span>Menos</span>
          {[0.15, 0.4, 0.65, 0.9].map((o, i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: color, opacity: o }}
            />
          ))}
          <span>Más</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 items-stretch justify-center min-w-0">
        {/* Calendario — un poco más grande que antes (celdas 56px) y centrado
            dentro de su carril para no dejar un hueco visual a la izquierda
            cuando el card es más ancho que el calendario. */}
        <div className="min-w-0">
          {/* Encabezado días */}
          <div className="grid grid-cols-7 gap-1.5 mb-1.5" style={{ width: 7 * 68 + 6 * 6 }}>
            {WEEKDAYS.map((w, i) => (
              <div
                key={i}
                className="text-center text-[11px] font-mono text-[color:var(--text-secondary)] uppercase tracking-wider"
                style={{ width: 68 }}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Grid de días */}
          <div className="grid grid-cols-7 gap-1.5" style={{ width: 7 * 68 + 6 * 6 }}>
            {cells.map((cell, i) => {
              if (!cell) {
                return <div key={i} style={{ width: 68, height: 68 }} />;
              }
              const today_ = isToday(cell.day);
              const hov = hoveredDay === cell.day;
              return (
                <motion.button
                  key={i}
                  type="button"
                  onMouseEnter={() => setHoveredDay(cell.day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onFocus={() => setHoveredDay(cell.day)}
                  onBlur={() => setHoveredDay(null)}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: Math.floor(i / 7) * 0.04, ease: "easeOut" }}
                  whileHover={{ scale: 1.12, zIndex: 5 }}
                  whileTap={{ scale: 0.94 }}
                  className="rounded-lg flex flex-col items-center justify-center relative cursor-pointer"
                  style={{
                    width: 68,
                    height: 68,
                    background: cell.count > 0
                      ? `${color}${Math.round(opacity(cell.count) * 255).toString(16).padStart(2, "0")}`
                      : "rgba(10,36,67,0.04)",
                    border: today_
                      ? `1.5px solid ${color}`
                      : hov
                        ? `1px solid ${color}80`
                        : "1px solid rgba(10,36,67,0.06)",
                    boxShadow: today_ ? `0 0 0 3px ${color}22` : hov ? `0 4px 12px ${color}33` : "none",
                    transition: 'border 180ms ease, box-shadow 180ms ease',
                  }}
                  aria-label={`${cell.day}, ${cell.count} actividad${cell.count === 1 ? '' : 'es'}`}
                >
                  <span
                    className="text-[14px] font-mono tabular-nums leading-none"
                    style={{
                      color: cell.count > maxCount * 0.55
                        ? "rgba(255,255,255,0.95)"
                        : "var(--text-primary)",
                      opacity: cell.count === 0 ? 0.55 : 1,
                      fontWeight: today_ ? 700 : 500,
                    }}
                  >
                    {cell.day}
                  </span>
                  {cell.count > 0 && (
                    <span
                      className="text-[11px] font-bold tabular-nums leading-none mt-0.5"
                      style={{
                        color: cell.count > maxCount * 0.55
                          ? "rgba(255,255,255,0.95)"
                          : color,
                      }}
                    >
                      {cell.count}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Panel lateral con detalle del día hover/today */}
        <aside className="hidden md:block w-[400px] shrink-0 self-stretch">
          <div
            className="rounded-xl p-6 h-full flex flex-col justify-center"
            style={{ background: "rgba(255,255,255,0.55)", border: "1px solid var(--border-subtle)" }}
          >
            <div className="label-xs flex items-center gap-1.5 mb-4">
              <Calendar size={12} />
              {hoveredDay ? "Día seleccionado" : "Resumen del mes"}
            </div>

            <AnimatePresence mode="wait">
              {hoveredDay !== null ? (
                <motion.div
                  key={`day-${hoveredDay}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="flex-1 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <div className="font-heading text-5xl tabular-nums leading-none" style={{ color }}>
                        {hoveredCount}
                      </div>
                      {hoveredDelta !== null && hoveredCount > 0 && (
                        <span
                          className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded"
                          style={{
                            background: hoveredDelta >= 0 ? `${color}18` : 'rgba(180,35,24,0.12)',
                            color: hoveredDelta >= 0 ? color : '#B42318',
                          }}
                        >
                          {hoveredDelta >= 0 ? '+' : ''}{hoveredDelta}% vs prom.
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-[color:var(--text-secondary)] mt-1.5 leading-snug capitalize">
                      {dayFullLabel(hoveredDate)}
                    </div>
                  </div>

                  {/* Resumen de la semana donde cae el día */}
                  {semanaHover && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] uppercase tracking-wider text-[color:var(--text-secondary)]">
                          Semana {semanaHover.numeroSemana}
                        </div>
                        <div className="text-[10px] font-mono tabular-nums text-[color:var(--text-secondary)]">
                          {semanaHover.total} total · {semanaHover.promedio}/día
                        </div>
                      </div>
                      <div className="grid grid-cols-7 gap-1.5">
                        {semanaHover.dias.map((d, i) => {
                          const h = maxCount > 0 ? (d.count / maxCount) * 100 : 0
                          return (
                            <div key={i} className="flex flex-col items-center gap-1">
                              <div
                                className="w-full rounded-sm flex items-end"
                                style={{
                                  height: 36,
                                  background: d.fuera ? 'rgba(10,36,67,0.025)' : 'rgba(10,36,67,0.05)',
                                  opacity: d.fuera ? 0.45 : 1,
                                }}
                              >
                                <div
                                  className="w-full rounded-sm"
                                  style={{
                                    height: `${Math.max(h, d.count > 0 ? 10 : 0)}%`,
                                    background: d.esHovered
                                      ? color
                                      : d.fuera
                                        ? 'rgba(10,36,67,0.15)'
                                        : `${color}66`,
                                    boxShadow: d.esHovered ? `0 0 0 1.5px ${color}` : 'none',
                                  }}
                                />
                              </div>
                              <span
                                className="text-[10px] font-mono tabular-nums"
                                style={{
                                  color: d.esHovered ? color : 'var(--text-secondary)',
                                  fontWeight: d.esHovered ? 700 : 400,
                                  opacity: d.fuera ? 0.45 : 1,
                                }}
                              >
                                {d.day}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] space-y-2">
                    <div className="flex justify-between text-[11px] text-[color:var(--text-secondary)]">
                      <span>Estado</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {hoveredCount === 0
                          ? 'Sin actividad'
                          : hoveredCount === maxCount && maxCount > 0
                            ? 'Día pico del mes'
                            : hoveredCount > promedioActivo
                              ? 'Por encima del promedio'
                              : 'Por debajo del promedio'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px] text-[color:var(--text-secondary)]">
                      <span>Promedio (activos)</span>
                      <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {promedioActivo || '—'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px] text-[color:var(--text-secondary)]">
                      <span>Pico del mes</span>
                      <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {maxCount > 0 ? `${maxCount} · día ${diaMax}` : '—'}
                      </strong>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="flex-1 flex flex-col"
                >
                  {/* Total grande */}
                  <div>
                    <div className="font-heading text-5xl tabular-nums leading-none" style={{ color }}>
                      {totalDelMes}
                    </div>
                    <div className="text-[13px] text-[color:var(--text-secondary)] mt-2 leading-snug">
                      Total del mes · {promedioMes}/día prom.
                    </div>
                  </div>

                  {/* Sparkline diaria del mes */}
                  <div className="mt-4">
                    <div className="text-[10px] uppercase tracking-wider text-[color:var(--text-secondary)] mb-2">
                      Tendencia diaria
                    </div>
                    <div
                      className="flex items-end gap-[2px] h-14 rounded-md px-2 py-1.5"
                      style={{ background: 'rgba(10,132,255,0.04)' }}
                    >
                      {sparkline.map((c, i) => {
                        const h = maxCount > 0 ? Math.max(c > 0 ? 3 : 1, (c / maxCount) * 100) : 1
                        const isPeak = c === maxCount && c > 0
                        return (
                          <div
                            key={i}
                            className="flex-1 rounded-[1px]"
                            style={{
                              height: `${h}%`,
                              background: c === 0
                                ? 'rgba(10,36,67,0.10)'
                                : isPeak
                                  ? color
                                  : `${color}88`,
                            }}
                            title={`Día ${i + 1}: ${c}`}
                          />
                        )
                      })}
                    </div>
                  </div>

                  {/* Distribución por día de semana */}
                  <div className="mt-4">
                    <div className="text-[10px] uppercase tracking-wider text-[color:var(--text-secondary)] mb-2">
                      Por día de semana
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {dowDist.map((v, i) => {
                        const h = dowMax > 0 ? (v / dowMax) * 100 : 0
                        const top = i === dowTop && v > 0
                        return (
                          <div key={i} className="flex flex-col items-center gap-1.5">
                            <div
                              className="w-full rounded-sm flex items-end"
                              style={{ height: 36, background: 'rgba(10,36,67,0.05)' }}
                            >
                              <div
                                className="w-full rounded-sm"
                                style={{
                                  height: `${Math.max(h, v > 0 ? 8 : 0)}%`,
                                  background: top ? color : `${color}66`,
                                }}
                                title={`${WEEKDAYS[i]}: ${v}`}
                              />
                            </div>
                            <span
                              className="text-[10px] font-mono"
                              style={{
                                color: top ? color : 'var(--text-secondary)',
                                fontWeight: top ? 700 : 400,
                              }}
                            >
                              {WEEKDAYS[i]}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Métricas en grilla */}
                  <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-[color:var(--text-secondary)]">
                    <div className="flex justify-between">
                      <span>Pico</span>
                      <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {maxCount > 0 ? maxCount : '—'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Día top</span>
                      <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {diaMax > 0 ? diaMax : '—'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Activos</span>
                      <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {diasActivos}/{daysInMonth}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Sin act.</span>
                      <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {diasSinActividad}
                      </strong>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span>Día favorito</span>
                      <strong className="capitalize" style={{ color: dowMax > 0 ? color : 'var(--text-primary)' }}>
                        {dowMax > 0 ? WEEKDAY_NAMES[dowTop] : '—'}
                        {dowMax > 0 && (
                          <span className="font-mono tabular-nums opacity-70 ml-1">· {dowMax}</span>
                        )}
                      </strong>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </div>
    </div>
  );
}
