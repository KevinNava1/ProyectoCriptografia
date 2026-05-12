import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, Environment, MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'

// Caduceo procedural. Geometría hecha 100% en código — varilla central,
// dos serpientes helicoidales y dos alas planas. Sin cargar GLTF/OBJ.
//
// Reacciona al mouse: ligero "look-at" del grupo entero. Float wrapper
// añade respiración. Material transmissive para look cristalino premium.

function Wing({ side = 1 }) {
  // Ala estilizada como elipse aplanada
  return (
    <mesh position={[0.55 * side, 1.1, 0]} rotation={[0, 0, side * -0.25]}>
      <sphereGeometry args={[0.55, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshPhysicalMaterial
        color="#0A84FF"
        metalness={0.4}
        roughness={0.2}
        clearcoat={1}
        clearcoatRoughness={0.1}
        envMapIntensity={1.2}
        emissive="#0052CC"
        emissiveIntensity={0.18}
      />
    </mesh>
  )
}

// Serpiente helicoidal: TubeGeometry sobre una curva paramétrica
function Snake({ phase = 0, color = '#0A84FF' }) {
  const curve = useMemo(() => {
    const pts = []
    const turns = 3
    const height = 2.4
    const radius = 0.18
    for (let i = 0; i <= 120; i++) {
      const t = i / 120
      const angle = phase + t * Math.PI * 2 * turns
      const x = Math.cos(angle) * radius
      const y = -height / 2 + t * height
      const z = Math.sin(angle) * radius
      pts.push(new THREE.Vector3(x, y, z))
    }
    return new THREE.CatmullRomCurve3(pts)
  }, [phase])

  return (
    <mesh>
      <tubeGeometry args={[curve, 240, 0.045, 8, false]} />
      <meshPhysicalMaterial
        color={color}
        metalness={0.6}
        roughness={0.18}
        clearcoat={1}
        clearcoatRoughness={0.1}
        emissive={color}
        emissiveIntensity={0.2}
      />
    </mesh>
  )
}

// Cabeza de serpiente arriba (esfera pequeña)
function SnakeHead({ phase = 0, color = '#00B8D9' }) {
  const top = useMemo(() => {
    const turns = 3
    const height = 2.4
    const radius = 0.18
    const angle = phase + Math.PI * 2 * turns
    const x = Math.cos(angle) * radius
    const y = height / 2
    const z = Math.sin(angle) * radius
    return [x, y, z]
  }, [phase])

  return (
    <mesh position={top}>
      <sphereGeometry args={[0.10, 16, 16]} />
      <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.4} metalness={0.7} roughness={0.15} />
    </mesh>
  )
}

function Rod() {
  return (
    <mesh>
      <cylinderGeometry args={[0.045, 0.045, 2.6, 24]} />
      <meshPhysicalMaterial color="#E4EEF8" metalness={0.9} roughness={0.15} envMapIntensity={1.5} />
    </mesh>
  )
}

// Sphere orb sobre la varilla (acento brillante)
function Orb() {
  return (
    <mesh position={[0, 1.45, 0]}>
      <sphereGeometry args={[0.16, 32, 32]} />
      <MeshTransmissionMaterial
        thickness={0.5}
        chromaticAberration={0.04}
        anisotropy={0.1}
        roughness={0.05}
        ior={1.4}
        backside
        backsideThickness={0.2}
        color="#7FC8FF"
      />
    </mesh>
  )
}

function CaduceusGroup() {
  const groupRef = useRef()
  const { mouse } = useThree()

  // Suave seguimiento del cursor — el grupo entero gira ligeramente.
  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const targetY = mouse.x * 0.6
    const targetX = -mouse.y * 0.25
    g.rotation.y += (targetY - g.rotation.y) * 0.06
    g.rotation.x += (targetX - g.rotation.x) * 0.06
  })

  return (
    <group ref={groupRef}>
      <Float speed={1.2} rotationIntensity={0.35} floatIntensity={0.4}>
        <Rod />
        <Snake phase={0}        color="#0A84FF" />
        <Snake phase={Math.PI}  color="#00B8D9" />
        <SnakeHead phase={0}        color="#0A84FF" />
        <SnakeHead phase={Math.PI}  color="#00B8D9" />
        <Wing side={1} />
        <Wing side={-1} />
        <Orb />
      </Float>
    </group>
  )
}

export default function Caduceus3D({ className, height = 280 }) {
  return (
    <div className={className} style={{ height, width: '100%' }}>
      <Canvas
        camera={{ position: [0, 0.3, 5.4], fov: 34 }}
        dpr={[1, 1.8]}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.55} />
        <pointLight position={[3, 4, 3]} intensity={1.2} color="#0A84FF" />
        <pointLight position={[-3, -2, 2]} intensity={0.8} color="#00B8D9" />
        <directionalLight position={[0, 5, 5]} intensity={0.6} color="#FFFFFF" />
        <Suspense fallback={null}>
          <Environment preset="city" />
          <CaduceusGroup />
        </Suspense>
      </Canvas>
    </div>
  )
}
