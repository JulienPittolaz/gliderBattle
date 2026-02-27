import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  LAKE_MONSTER_BOB_AMPLITUDE,
  LAKE_MONSTER_BOB_SPEED,
  LAKE_MONSTER_SCALE,
  LAKE_MONSTER_SWAY_AMPLITUDE,
  LAKE_MONSTER_SWAY_SPEED,
} from './constants'

interface LakeMonsterProps {
  position: [number, number, number]
  gameSpeed?: number
}

export const LakeMonster = ({ position, gameSpeed = 1 }: LakeMonsterProps) => {
  const rootRef = useRef<THREE.Group>(null)
  const baseY = useMemo(() => position[1], [position])
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    const root = rootRef.current
    if (!root) {
      return
    }
    elapsedRef.current += delta

    const t = elapsedRef.current * gameSpeed
    root.position.y = baseY + Math.sin(t * LAKE_MONSTER_BOB_SPEED) * LAKE_MONSTER_BOB_AMPLITUDE
    root.rotation.y = Math.sin(t * LAKE_MONSTER_SWAY_SPEED) * LAKE_MONSTER_SWAY_AMPLITUDE
  })

  return (
    <group ref={rootRef} position={position} scale={LAKE_MONSTER_SCALE}>
      <mesh castShadow position={[-0.95, -0.05, 0.15]}>
        <icosahedronGeometry args={[0.46, 0]} />
        <meshStandardMaterial color="#3f6150" roughness={0.86} metalness={0.02} flatShading />
      </mesh>
      <mesh castShadow position={[-0.25, 0.03, -0.1]}>
        <icosahedronGeometry args={[0.54, 0]} />
        <meshStandardMaterial color="#4f775f" roughness={0.84} metalness={0.02} flatShading />
      </mesh>
      <mesh castShadow position={[0.46, 0.01, 0.05]}>
        <icosahedronGeometry args={[0.49, 0]} />
        <meshStandardMaterial color="#3e6d57" roughness={0.84} metalness={0.02} flatShading />
      </mesh>

      <group position={[0.88, 0.16, -0.04]} rotation={[0.1, -0.28, 0.14]}>
        <mesh castShadow position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.12, 0.16, 0.42, 7]} />
          <meshStandardMaterial color="#4d735e" roughness={0.82} metalness={0.02} flatShading />
        </mesh>
        <mesh castShadow position={[0.02, 0.55, -0.04]} rotation={[0.12, -0.1, 0]}>
          <icosahedronGeometry args={[0.24, 0]} />
          <meshStandardMaterial color="#5a8469" roughness={0.8} metalness={0.02} flatShading />
        </mesh>
        <mesh castShadow position={[0.11, 0.6, -0.15]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#f8fff7" roughness={0.3} metalness={0.01} flatShading />
        </mesh>
        <mesh castShadow position={[0.11, 0.6, -0.17]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color="#212423" roughness={0.2} metalness={0.02} flatShading />
        </mesh>
      </group>
    </group>
  )
}
