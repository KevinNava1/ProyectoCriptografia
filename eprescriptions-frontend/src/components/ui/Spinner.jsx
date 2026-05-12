// Spinner SVG inline 16px (configurable). Hereda currentColor para que se
// integre con el color del botón/contexto. Mucho más ligero que importar un
// Lottie para algo tan común.

export default function Spinner({ size = 16, stroke = 2, className = '', label = 'Cargando' }) {
  return (
    <svg
      role="status"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeOpacity="0.22"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.75s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  )
}
