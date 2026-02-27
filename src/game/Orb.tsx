import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { OrbSnapshot } from '../net/types'

interface OrbProps {
  orb: OrbSnapshot | null
}

export const Orb = ({ orb }: OrbProps) => {
  const rootRef = useRef<THREE.Group>(null)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    const root = rootRef.current
    if (!root || !orb) {
      return
    }
    elapsedRef.current += delta

    const t = elapsedRef.current
    const bob = Math.sin(t * 2.1) * 0.18
    const target = new THREE.Vector3(orb.x, orb.y + bob, orb.z)
    const blend = 1 - Math.exp(-18 * delta)
    root.position.lerp(target, blend)
    root.rotation.y += delta * 1.7
    root.rotation.x = Math.sin(t * 1.3) * 0.08
  })

  if (!orb) {
    return null
  }

  const held = orb.holderSessionId.length > 0
  const beamHeight = Math.max(orb.y + 10, 56)

  return (
    <group ref={rootRef} position={[orb.x, orb.y, orb.z]}>
      {!held ? (
        <mesh position={[0, -beamHeight * 0.5 + 0.4, 0]}>
          <cylinderGeometry args={[0.22, 0.65, beamHeight, 12, 1, true]} />
          <meshBasicMaterial color="#8de6ff" transparent opacity={0.2} depthWrite={false} />
        </mesh>
      ) : null}
      <mesh castShadow>
        <icosahedronGeometry args={[0.62, 1]} />
        <meshStandardMaterial
          color={held ? '#ffd15f' : '#9de2ff'}
          emissive={held ? '#ff9a3d' : '#70c8ff'}
          emissiveIntensity={held ? 0.7 : 0.45}
          roughness={0.28}
          metalness={0.18}
          flatShading
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.08, 0.06, 10, 30]} />
        <meshBasicMaterial color={held ? '#ffd88a' : '#b5edff'} transparent opacity={0.72} />
      </mesh>
      <mesh rotation={[0.35, 0.9, 0]}>
        <torusGeometry args={[1.34, 0.035, 10, 32]} />
        <meshBasicMaterial color={held ? '#ffbe58' : '#86d7ff'} transparent opacity={0.45} />
      </mesh>
    </group>
  )
}
