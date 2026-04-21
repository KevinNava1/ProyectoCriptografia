import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function Orb() {
  const ref = useRef()
  const glow = useRef()
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    const beat = 1 + Math.pow(Math.max(0, Math.sin(t * 2.1)), 12) * 0.18
    if (ref.current) ref.current.scale.setScalar(beat)
    if (glow.current) glow.current.scale.setScalar(beat * 1.35)
    if (ref.current) ref.current.rotation.y = t * 0.15
  })
  return (
    <group>
      <mesh ref={glow}>
        <sphereGeometry args={[1.25, 32, 32]} />
        <meshBasicMaterial color="#0A84FF" transparent opacity={0.1} />
      </mesh>
      <mesh ref={ref}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          color="#0A84FF"
          emissive="#00B8D9"
          emissiveIntensity={0.45}
          roughness={0.25}
          metalness={0.55}
          wireframe
        />
      </mesh>
    </group>
  )
}

function Particles() {
  const ref = useRef()
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const count = 220
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 2.2 + Math.random() * 2.1
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [])
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.06 })
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#0A84FF" size={0.045} sizeAttenuation transparent opacity={0.75} />
    </points>
  )
}

export default function HeartbeatOrb3D({ className = '' }) {
  return (
    <div className={`absolute inset-0 ${className}`} aria-hidden>
      <Canvas camera={{ position: [0, 0, 6], fov: 55 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[4, 3, 5]} intensity={1.2} color="#0A84FF" />
        <pointLight position={[-4, -2, 4]} intensity={0.8} color="#00B8D9" />
        <Suspense fallback={null}>
          <Orb />
          <Particles />
        </Suspense>
      </Canvas>
    </div>
  )
}
