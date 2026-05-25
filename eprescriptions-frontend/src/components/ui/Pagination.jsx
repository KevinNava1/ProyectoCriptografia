import { ChevronLeft, ChevronRight } from "lucide-react";

// Paginador reusable. Idéntico al que vive inline en MisRecetas (lo extraje
// aquí para que MisEmitidas, AdminSolicitudes, TicketsDispensacion y futuras
// listas compartan el mismo widget — un solo lugar para tunear estilo/UX).

// Ventana: 1 … (n-1) n (n+1) … last. Para miles de elementos no tiene sentido
// renderizar 80 botones.
function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  if (current > 4) out.push("…");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) out.push(i);
  if (current < total - 3) out.push("…");
  out.push(total);
  return out;
}

function PageBtn({ children, active, disabled, onClick, label }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="min-w-[38px] h-9 px-2.5 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1 transition-all disabled:opacity-35 disabled:cursor-not-allowed"
      style={
        active
          ? {
              background: "linear-gradient(135deg,#0A84FF,#0052CC)",
              color: "#fff",
              boxShadow: "0 4px 14px rgba(10,132,255,0.32)",
            }
          : {
              background: "rgba(255,255,255,0.72)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }
      }
    >
      {children}
    </button>
  );
}

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap pt-2">
      <PageBtn disabled={page === 1} onClick={() => onChange(page - 1)} label="Página anterior">
        <ChevronLeft size={15} />
        <span className="hidden sm:inline">Anterior</span>
      </PageBtn>
      {pageWindow(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-[color:var(--text-secondary)] select-none">…</span>
        ) : (
          <PageBtn key={p} active={p === page} onClick={() => onChange(p)} label={`Página ${p}`}>{p}</PageBtn>
        ),
      )}
      <PageBtn disabled={page === totalPages} onClick={() => onChange(page + 1)} label="Página siguiente">
        <span className="hidden sm:inline">Siguiente</span>
        <ChevronRight size={15} />
      </PageBtn>
    </div>
  );
}
