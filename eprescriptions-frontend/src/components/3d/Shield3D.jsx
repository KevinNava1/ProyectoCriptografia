import { Suspense, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'

function Knot({ hover }) {
  const m = useRef()
  useFrame((_, d) => {
    if (!m.current) return
    m.current.rotation.y += d * 0.6
    const target = hover ? 0.26 : 0
    m.current.rotation.x += (target - m.current.rotation.x) * 0.1
  })
  return (
    <mesh ref={m}>
      <torusKnotGeometry args={[0.7, 0.22, 120, 18]} />
      <meshStandardMaterial color="#00D4FF" emissive="#00D4FF" emissiveIntensity={0.6} metalness={0.9} roughness={0.15} />
    </mesh>
  )
}

export default function Shield3D({ size = 42 }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ width: size, height: size }}
      className="shrink-0"
    >
      <Canvas camera={{ position: [0, 0, 2.6], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[2, 2, 2]} intensity={1.6} color="#00D4FF" />
        <pointLight position={[-2, -1, 1]} intensity={0.8} color="#7C3AED" />
        <Suspense fallback={null}>
          <Knot hover={hover} />
        </Suspense>
      </Canvas>
    </div>
  )
}
