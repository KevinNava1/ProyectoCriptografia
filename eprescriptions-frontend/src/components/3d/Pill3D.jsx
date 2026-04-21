import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'

function SpinningPill() {
  const group = useRef()
  useFrame((state) => {
    if (!group.current) return
    const t = state.clock.getElapsedTime()
    group.current.rotation.y = t * 0.9
    group.current.rotation.z = Math.sin(t * 0.7) * 0.35
    group.current.position.y = Math.sin(t * 1.2) * 0.15
  })
  return (
    <group ref={group} rotation={[0.35, 0, 0.5]}>
      {/* Lado cian */}
      <mesh position={[-0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.5, 0.6, 18, 28]} />
        <meshStandardMaterial color="#00B8D9" roughness={0.28} metalness={0.35} emissive="#00B8D9" emissiveIntensity={0.18} />
      </mesh>
      {/* Lado azul */}
      <mesh position={[0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.5, 0.6, 18, 28]} />
        <meshStandardMaterial color="#0A84FF" roughness={0.28} metalness={0.35} emissive="#0A84FF" emissiveIntensity={0.22} />
      </mesh>
      {/* Banda divisoria blanca */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.505, 0.505, 0.04, 28]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.2} metalness={0.1} />
      </mesh>
      {/* Shine highlight */}
      <mesh position={[0, 0.32, 0.3]} rotation={[0, 0, Math.PI / 2]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" transparent opacity={0.18} emissive="#FFFFFF" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

export default function Pill3D({ className = '', size = 160 }) {
  return (
    <div
      className={`pointer-events-none select-none ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Canvas camera={{ position: [0, 0, 4.2], fov: 45 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.55} />
        <pointLight position={[3, 3, 4]} intensity={1.4} color="#00B8D9" />
        <pointLight position={[-3, -2, 3]} intensity={1.0} color="#0A84FF" />
        <pointLight position={[0, 4, -3]} intensity={0.5} color="#FFFFFF" />
        <Suspense fallback={null}>
          <SpinningPill />
        </Suspense>
      </Canvas>
    </div>
  )
}
