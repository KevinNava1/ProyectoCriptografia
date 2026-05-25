import { Search, X } from "lucide-react";

// Input de búsqueda reusable — icono Search a la izquierda, X de limpiar
// cuando hay texto. Estilo consistente con la del MisRecetas original.
export default function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  className = "",
  maxWidthClass = "max-w-md",
}) {
  return (
    <div className={`relative flex-1 min-w-[220px] ${maxWidthClass} ${className}`}>
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)] pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
        style={{ paddingLeft: "2.3rem", paddingRight: value ? "2.3rem" : "0.95rem" }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
