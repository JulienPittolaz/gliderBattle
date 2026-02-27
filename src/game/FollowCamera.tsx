import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import * as THREE from 'three'
import {
  CAMERA_OFFSET,
  CAMERA_POSITION_LERP,
  CAMERA_TARGET_LERP,
  LOOK_OFFSET,
} from './constants'

export interface FollowCameraProps {
  targetRef: RefObject<THREE.Group | null>
  gameSpeed?: number
  speedFxAmountRef?: MutableRefObject<number>
}

export const FollowCamera = ({
  targetRef,
  gameSpeed = 1,
  speedFxAmountRef,
}: FollowCameraProps) => {
  const { camera } = useThree()
  const desiredPosition = useMemo(() => new THREE.Vector3(), [])
  const lookAtTarget = useMemo(() => new THREE.Vector3(), [])
  const currentLookAt = useRef(new THREE.Vector3())
  const baseFovRef = useRef<number | null>(null)

  useFrame((_, delta) => {
    const scaledDelta = delta * gameSpeed
    const target = targetRef.current
    if (!target) {
      return
    }

    lookAtTarget.copy(target.position).add(LOOK_OFFSET)

    const yawOnly = new THREE.Euler(0, target.rotation.y, 0)
    desiredPosition.copy(CAMERA_OFFSET).applyEuler(yawOnly).add(target.position)

    camera.position.lerp(
      desiredPosition,
      1 - Math.exp(-CAMERA_POSITION_LERP * scaledDelta),
    )

    currentLookAt.current.lerp(
      lookAtTarget,
      1 - Math.exp(-CAMERA_TARGET_LERP * scaledDelta),
    )
    camera.lookAt(currentLookAt.current)

    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const perspective = camera as THREE.PerspectiveCamera
      if (baseFovRef.current === null) {
        baseFovRef.current = perspective.fov
      }
      const amount = speedFxAmountRef ? THREE.MathUtils.clamp(speedFxAmountRef.current, 0, 1) : 0
      const targetFov = baseFovRef.current + amount * 8
      const nextFov = THREE.MathUtils.lerp(
        perspective.fov,
        targetFov,
        1 - Math.exp(-10 * scaledDelta),
      )
      if (Math.abs(nextFov - perspective.fov) > 0.001) {
        perspective.fov = nextFov
        perspective.updateProjectionMatrix()
      }
    }
  })

  return null
}
