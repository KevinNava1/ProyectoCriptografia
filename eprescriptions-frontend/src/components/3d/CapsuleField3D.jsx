import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'

function Capsule({ position, rotation, color, speed = 1, phase = 0 }) {
  const ref = useRef()
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime() * speed + phase
    ref.current.position.y = position[1] + Math.sin(t) * 0.25
    ref.current.rotation.x = rotation[0] + t * 0.22
    ref.current.rotation.z = rotation[2] + t * 0.14
  })
  return (
    <mesh ref={ref} position={position} rotation={rotation}>
      <capsuleGeometry args={[0.22, 0.9, 8, 20]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.45}
        roughness={0.25}
        metalness={0.55}
      />
    </mesh>
  )
}

function Field() {
  const capsules = useMemo(() => {
    const palette = ['#00D4FF', '#7C3AED', '#10B981', '#F0F6FF']
    const out = []
    const N = 14
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2
      const radius = 2 + (i % 3) * 0.6
      out.push({
        position: [
          Math.cos(angle) * radius,
          Math.sin(i * 1.7) * 1.4,
          Math.sin(angle) * radius - 1,
        ],
        rotation: [Math.random() * 1.6, Math.random() * 2.2, Math.random() * 1.2],
        color: palette[i % palette.length],
        speed: 0.4 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      })
    }
    return out
  }, [])
  return capsules.map((c, i) => <Capsule key={i} {...c} />)
}

export default function CapsuleField3D({ className = '' }) {
  return (
    <div className={`absolute inset-0 ${className}`} aria-hidden>
      <Canvas camera={{ position: [0, 0, 7], fov: 50 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.35} />
        <pointLight position={[5, 4, 5]} intensity={1.4} color="#00D4FF" />
        <pointLight position={[-5, -3, 3]} intensity={1.0} color="#7C3AED" />
        <pointLight position={[0, 6, -4]} intensity={0.6} color="#F0F6FF" />
        <Suspense fallback={null}>
          <Field />
        </Suspense>
      </Canvas>
    </div>
  )
}
