/**
 * VideoBackdrop — fondo de video loop muteado con overlay azul para
 * preservar la legibilidad del contenido. Respeta prefers-reduced-motion.
 */
export default function VideoBackdrop({
  src = '/videofondo.mp4',
  intensity = 'soft', // 'soft' | 'medium' | 'strong'
  className = '',
}) {
  const overlayLayers = {
    soft: [
      'linear-gradient(180deg, rgba(238,244,251,0.78) 0%, rgba(238,244,251,0.58) 40%, rgba(238,244,251,0.82) 100%)',
      'radial-gradient(ellipse at 30% 20%, rgba(10,132,255,0.15), transparent 55%)',
      'radial-gradient(ellipse at 70% 80%, rgba(0,184,217,0.12), transparent 55%)',
    ],
    medium: [
      'linear-gradient(180deg, rgba(238,244,251,0.65) 0%, rgba(238,244,251,0.42) 40%, rgba(238,244,251,0.72) 100%)',
      'radial-gradient(ellipse at 30% 20%, rgba(10,132,255,0.22), transparent 55%)',
      'radial-gradient(ellipse at 70% 80%, rgba(0,184,217,0.18), transparent 55%)',
    ],
    strong: [
      'linear-gradient(180deg, rgba(238,244,251,0.52) 0%, rgba(238,244,251,0.32) 40%, rgba(238,244,251,0.62) 100%)',
      'radial-gradient(ellipse at 30% 20%, rgba(10,132,255,0.28), transparent 55%)',
      'radial-gradient(ellipse at 70% 80%, rgba(0,184,217,0.22), transparent 55%)',
    ],
  }[intensity]

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'saturate(1.05) contrast(1.02) brightness(1.05)' }}
      >
        <source src={src} type="video/mp4" />
      </video>
      <div
        className="absolute inset-0"
        style={{ background: overlayLayers.join(', ') }}
      />
    </div>
  )
}
