import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function BasePair({ a, b }) {
  const len = useMemo(() => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]
    return Math.sqrt(dx*dx + dy*dy + dz*dz)
  }, [a, b])
  const mid = useMemo(() => [(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2], [a, b])
  const quat = useMemo(() => {
    const dir = new THREE.Vector3(b[0]-a[0], b[1]-a[1], b[2]-a[2]).normalize()
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir)
  }, [a, b])
  return (
    <mesh position={mid} quaternion={quat}>
      <cylinderGeometry args={[0.025, 0.025, len, 6]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.28} />
    </mesh>
  )
}

function Helix() {
  const group = useRef()
  const { strand1, strand2, pairs } = useMemo(() => {
    const length = 34, radius = 1.3, step = 0.35, freq = 0.55
    const s1 = [], s2 = [], bp = []
    for (let i = 0; i < length; i++) {
      const y = (i - length / 2) * step
      const angle = i * freq
      const a = [Math.cos(angle) * radius, y, Math.sin(angle) * radius]
      const b = [Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius]
      s1.push(a); s2.push(b)
      if (i % 1 === 0) bp.push([a, b])
    }
    return { strand1: s1, strand2: s2, pairs: bp }
  }, [])

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.18
    }
  })

  return (
    <group ref={group} rotation={[0, 0, 0.1]}>
      {strand1.map((p, i) => (
        <mesh key={`a-${i}`} position={p}>
          <sphereGeometry args={[0.16, 18, 18]} />
          <meshStandardMaterial color="#00D4FF" emissive="#00D4FF" emissiveIntensity={0.9} roughness={0.25} metalness={0.4} />
        </mesh>
      ))}
      {strand2.map((p, i) => (
        <mesh key={`b-${i}`} position={p}>
          <sphereGeometry args={[0.16, 18, 18]} />
          <meshStandardMaterial color="#7C3AED" emissive="#7C3AED" emissiveIntensity={0.75} roughness={0.25} metalness={0.4} />
        </mesh>
      ))}
      {pairs.map(([a, b], i) => <BasePair key={`p-${i}`} a={a} b={b} />)}
    </group>
  )
}

export default function DnaHelix3D({ className = '' }) {
  return (
    <div className={`absolute inset-0 ${className}`} aria-hidden>
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.35} />
        <pointLight position={[6, 4, 6]} intensity={1.5} color="#00D4FF" />
        <pointLight position={[-6, -3, 3]} intensity={1.0} color="#7C3AED" />
        <pointLight position={[0, 6, -4]} intensity={0.5} color="#F0F6FF" />
        <Suspense fallback={null}>
          <Helix />
        </Suspense>
      </Canvas>
    </div>
  )
}
