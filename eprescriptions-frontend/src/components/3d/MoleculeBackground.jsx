import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

function Molecule() {
  const group = useRef()
  const nodes = useMemo(() => {
    const arr = []
    for (let i = 0; i < 14; i++) {
      const phi = Math.acos(-1 + (2 * i) / 14)
      const theta = Math.sqrt(14 * Math.PI) * phi
      const r = 2.4
      arr.push([
        r * Math.cos(theta) * Math.sin(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(phi),
      ])
    }
    return arr
  }, [])

  const edges = useMemo(() => {
    const list = []
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j]
        const d = Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2])
        if (d < 2.6) list.push([a, b])
      }
    }
    return list
  }, [nodes])

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.08
      group.current.rotation.x += delta * 0.03
    }
  })

  return (
    <group ref={group}>
      {nodes.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.09, 20, 20]} />
          <meshStandardMaterial
            color="#00D4FF"
            emissive="#00D4FF"
            emissiveIntensity={1.4}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
      ))}
      {edges.map(([a, b], i) => (
        <Line key={i} points={[a, b]} color="#00D4FF" transparent opacity={0.25} lineWidth={1} />
      ))}
    </group>
  )
}

export default function MoleculeBackground({ className = '' }) {
  return (
    <div className={`absolute inset-0 ${className}`} aria-hidden>
      <Canvas camera={{ position: [0, 0, 7], fov: 50 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[6, 6, 6]} intensity={1.2} color="#00D4FF" />
        <pointLight position={[-6, -4, 2]} intensity={0.6} color="#7C3AED" />
        <Suspense fallback={null}>
          <Molecule />
        </Suspense>
      </Canvas>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 50%, transparent 0%, #0A0E1A 75%)' }} />
    </div>
  )
}
