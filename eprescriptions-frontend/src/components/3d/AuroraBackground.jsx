export default function AuroraBackground({ variant = 'default' }) {
  const scale = variant === 'subtle' ? 0.6 : 1
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="aurora-blob aurora-blob-1" style={{ opacity: 0.42 * scale }} />
      <div className="aurora-blob aurora-blob-2" style={{ opacity: 0.38 * scale }} />
      <div className="aurora-blob aurora-blob-3" style={{ opacity: 0.22 * scale }} />
      {/* Vignette claro y sutil — no oscurece los bordes en pantallas grandes */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 60%, transparent 35%, rgba(238,244,251,0.55) 100%)',
        }}
      />
    </div>
  )
}
