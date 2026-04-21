import Pill3D from './Pill3D'

/**
 * Píldora 3D real orbitando un centro. Usa CSS transforms con un wrapper
 * que rota alrededor del centro y un hijo que contrarrota para mantener la
 * píldora siempre alineada a cámara (el giro propio de la píldora lo hace
 * Three.js dentro de Pill3D).
 */
export default function Pill3DOrbit({
  radius = 230,
  duration = 22,
  size = 140,
  delay = 0,
}) {
  return (
    <>
      <style>{`
        @keyframes pill3d-orbit      { to { transform: rotate(360deg); } }
        @keyframes pill3d-counter    { to { transform: rotate(-360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .pill3d-orbit-rot, .pill3d-orbit-counter { animation: none !important; }
        }
      `}</style>
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 pointer-events-none"
        style={{ width: 0, height: 0 }}
      >
        <div
          className="pill3d-orbit-rot"
          style={{
            width: 0, height: 0,
            animation: `pill3d-orbit ${duration}s linear infinite`,
            animationDelay: `${delay}s`,
            transformOrigin: '0 0',
          }}
        >
          <div style={{ transform: `translate(${radius}px, 0)` }}>
            <div
              className="pill3d-orbit-counter"
              style={{
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                animation: `pill3d-counter ${duration}s linear infinite`,
                animationDelay: `${delay}s`,
                filter: 'drop-shadow(0 12px 28px rgba(10,132,255,0.35))',
              }}
            >
              <Pill3D size={size} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
