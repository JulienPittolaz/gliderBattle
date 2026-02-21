import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ForestInstance } from './terrain'

interface TerrainForestProps {
  instances: ForestInstance[]
}

const dummy = new THREE.Object3D()
const trunkScale = new THREE.Vector3()
const canopyScale = new THREE.Vector3()
const canopyTopScale = new THREE.Vector3()

export const TerrainForest = ({ instances }: TerrainForestProps) => {
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const canopyRef = useRef<THREE.InstancedMesh>(null)
  const canopyTopRef = useRef<THREE.InstancedMesh>(null)

  const matrices = useMemo(() => {
    const trunkMatrices: THREE.Matrix4[] = []
    const canopyMatrices: THREE.Matrix4[] = []
    const canopyTopMatrices: THREE.Matrix4[] = []

    for (const instance of instances) {
      const trunkHeight = THREE.MathUtils.lerp(1.05, 1.45, instance.scale)
      trunkScale.set(0.2 * instance.scale, trunkHeight, 0.2 * instance.scale)
      dummy.position.set(instance.x, instance.y + trunkHeight * 0.5, instance.z)
      dummy.rotation.set(0, instance.yaw, 0)
      dummy.scale.copy(trunkScale)
      dummy.updateMatrix()
      trunkMatrices.push(dummy.matrix.clone())

      const typeBlend = instance.type * 0.5
      const canopyY = instance.y + trunkHeight + THREE.MathUtils.lerp(0.58, 0.76, typeBlend)
      canopyScale.set(
        THREE.MathUtils.lerp(0.9, 1.15, typeBlend) * instance.scale,
        THREE.MathUtils.lerp(1.0, 1.22, typeBlend) * instance.scale,
        THREE.MathUtils.lerp(0.9, 1.15, typeBlend) * instance.scale,
      )
      dummy.position.set(instance.x, canopyY, instance.z)
      dummy.rotation.set(0, instance.yaw + 0.28, 0)
      dummy.scale.copy(canopyScale)
      dummy.updateMatrix()
      canopyMatrices.push(dummy.matrix.clone())

      const canopyTopY = canopyY + THREE.MathUtils.lerp(0.62, 0.82, typeBlend) * instance.scale
      canopyTopScale.set(
        THREE.MathUtils.lerp(0.6, 0.85, typeBlend) * instance.scale,
        THREE.MathUtils.lerp(0.8, 1.02, typeBlend) * instance.scale,
        THREE.MathUtils.lerp(0.6, 0.85, typeBlend) * instance.scale,
      )
      dummy.position.set(instance.x, canopyTopY, instance.z)
      dummy.rotation.set(0, instance.yaw - 0.16, 0)
      dummy.scale.copy(canopyTopScale)
      dummy.updateMatrix()
      canopyTopMatrices.push(dummy.matrix.clone())
    }

    return { trunkMatrices, canopyMatrices, canopyTopMatrices }
  }, [instances])

  useLayoutEffect(() => {
    if (!trunkRef.current || !canopyRef.current || !canopyTopRef.current) {
      return
    }

    for (let i = 0; i < matrices.trunkMatrices.length; i += 1) {
      trunkRef.current.setMatrixAt(i, matrices.trunkMatrices[i])
      canopyRef.current.setMatrixAt(i, matrices.canopyMatrices[i])
      canopyTopRef.current.setMatrixAt(i, matrices.canopyTopMatrices[i])
    }

    trunkRef.current.instanceMatrix.needsUpdate = true
    canopyRef.current.instanceMatrix.needsUpdate = true
    canopyTopRef.current.instanceMatrix.needsUpdate = true
  }, [matrices])

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, instances.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.72, 1, 6]} />
        <meshStandardMaterial color="#6f4c2f" roughness={0.9} metalness={0.01} flatShading />
      </instancedMesh>
      <instancedMesh ref={canopyRef} args={[undefined, undefined, instances.length]} castShadow receiveShadow>
        <coneGeometry args={[0.95, 1.25, 7]} />
        <meshStandardMaterial color="#3f6f3a" roughness={0.92} metalness={0.01} flatShading />
      </instancedMesh>
      <instancedMesh ref={canopyTopRef} args={[undefined, undefined, instances.length]} castShadow receiveShadow>
        <coneGeometry args={[0.68, 1.05, 7]} />
        <meshStandardMaterial color="#4f8248" roughness={0.9} metalness={0.01} flatShading />
      </instancedMesh>
    </group>
  )
}
