import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * "Doctor black hole" vortex — un disco de acreción médico:
 * partículas espiraleadas convergen hacia un núcleo azul, con
 * anillos orbitales inclinados y una capa de destello central.
 * Paleta: azul/cian/azul profundo.
 */

function AccretionDisc({ particles = 900 }) {
  const ref = useRef()
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = new Float32Array(particles * 3)
    const colors    = new Float32Array(particles * 3)
    const sizes     = new Float32Array(particles)
    const seeds     = new Float32Array(particles) // fase por partícula
    const palette = [
      new THREE.Color('#0A84FF'),
      new THREE.Color('#00B8D9'),
      new THREE.Color('#0052CC'),
      new THREE.Color('#6FB3FF'),
      new THREE.Color('#FFFFFF'),
    ]
    for (let i = 0; i < particles; i++) {
      const t = i / particles
      const radius = 0.9 + t * 3.8                 // 0.9 → 4.7
      const spiral = t * Math.PI * 10              // 5 vueltas
      const theta  = spiral + Math.random() * 0.4
      const zJit   = (Math.random() - 0.5) * 0.4 * (1 - t)
      positions[i * 3 + 0] = Math.cos(theta) * radius
      positions[i * 3 + 1] = Math.sin(theta) * radius * 0.45       // disco aplanado
      positions[i * 3 + 2] = zJit
      const c = palette[Math.floor(Math.random() * palette.length)]
      colors[i * 3 + 0] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
      sizes[i]          = 0.04 + Math.random() * 0.08
      seeds[i]          = Math.random() * 100
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color',    new THREE.BufferAttribute(colors, 3))
    g.setAttribute('size',     new THREE.BufferAttribute(sizes, 1))
    g.setAttribute('seed',     new THREE.BufferAttribute(seeds, 1))
    return g
  }, [particles])

  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.z = state.clock.getElapsedTime() * 0.12
  })

  return (
    <points ref={ref} geometry={geometry} rotation={[-Math.PI / 2.6, 0, 0]}>
      <pointsMaterial
        vertexColors
        size={0.065}
        sizeAttenuation
        transparent
        opacity={0.92}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function EventHorizon() {
  const ref = useRef()
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime()
    ref.current.scale.setScalar(1 + Math.sin(t * 1.2) * 0.06)
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.75, 48, 48]} />
      <meshBasicMaterial color="#0A2A55" transparent opacity={0.9} />
    </mesh>
  )
}

function InnerGlow() {
  return (
    <mesh>
      <sphereGeometry args={[1.1, 48, 48]} />
      <meshBasicMaterial
        color="#0A84FF"
        transparent
        opacity={0.35}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

function CrossBadge({ position, speed, phase }) {
  const ref = useRef()
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime() * speed + phase
    const r = 2.2
    ref.current.position.x = Math.cos(t) * r
    ref.current.position.z = Math.sin(t) * r
    ref.current.position.y = position[1] + Math.sin(t * 2) * 0.2
    ref.current.rotation.y = t
    ref.current.rotation.z = t * 0.5
  })
  return (
    <group ref={ref}>
      <mesh>
        <boxGeometry args={[0.42, 0.14, 0.08]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#0A84FF" emissiveIntensity={0.7} roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.14, 0.42, 0.08]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#0A84FF" emissiveIntensity={0.7} roughness={0.3} metalness={0.4} />
      </mesh>
    </group>
  )
}

function TiltedRing({ radius, tilt, color, thickness = 0.02, dashed = false, speed = 0.2 }) {
  const ref = useRef()
  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.z = state.clock.getElapsedTime() * speed
  })
  const geom = useMemo(() => new THREE.TorusGeometry(radius, thickness, 12, dashed ? 60 : 160), [radius, thickness, dashed])
  return (
    <mesh ref={ref} geometry={geom} rotation={[tilt, 0, 0]}>
      <meshBasicMaterial color={color} transparent opacity={dashed ? 0.55 : 0.8} />
    </mesh>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[4, 3, 4]} intensity={1.2} color="#00B8D9" />
      <pointLight position={[-4, -2, 3]} intensity={0.9} color="#0A84FF" />

      <InnerGlow />
      <EventHorizon />
      <AccretionDisc particles={1100} />

      <TiltedRing radius={2.4} tilt={-Math.PI / 2.4} color="#0A84FF" thickness={0.012} speed={0.18} />
      <TiltedRing radius={3.1} tilt={-Math.PI / 2.2} color="#00B8D9" thickness={0.01}  speed={-0.14} />
      <TiltedRing radius={3.8} tilt={-Math.PI / 1.9} color="#0052CC" thickness={0.008} speed={0.09} />

      <CrossBadge position={[0, 0.2, 0]}   speed={0.7} phase={0} />
      <CrossBadge position={[0, -0.15, 0]} speed={0.55} phase={2.1} />
      <CrossBadge position={[0, 0.35, 0]}  speed={0.6}  phase={4.2} />
    </>
  )
}

export default function MedicalVortex3D({ className = '' }) {
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`} aria-hidden>
      <Canvas
        camera={{ position: [0, 0.7, 7.5], fov: 48 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  )
}
