import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import * as THREE from 'three'
import {
  EDGE_SINK_CURVE_EXP,
  EDGE_SINK_MAX,
  EDGE_SINK_START_RATIO,
  FORWARD_SPEED,
  MIN_ALTITUDE,
  PLAYER_CLEARANCE,
  SINK_RATE,
  SPEEDBAR_BOOST,
  SPEEDBAR_SINK_BOOST,
  TERRAIN_ISLAND_RADIUS,
  TERRAIN_SIZE,
  YAW_RATE,
} from './constants'
import { computeSafeSpawn } from './spawn'
import type { ThermalColumn } from './thermals'
import { getThermalLiftAtPoint } from './thermals'
import { useKeyboard } from './useKeyboard'

export interface PlayerProps {
  playerRef: RefObject<THREE.Group | null>
  terrainHeightAt?: (x: number, z: number) => number
  thermals?: ThermalColumn[]
  gameSpeed?: number
}

export const Player = ({
  playerRef,
  terrainHeightAt,
  thermals = [],
  gameSpeed = 1,
}: PlayerProps) => {
  const input = useKeyboard()
  const direction = useMemo(() => new THREE.Vector3(), [])
  const initialSpawn = useMemo(
    () => computeSafeSpawn(terrainHeightAt),
    [terrainHeightAt],
  )
  const yawRef = useRef(initialSpawn.yaw)
  const waterRadius = TERRAIN_SIZE * 0.9
  const sinkStartRadius =
    TERRAIN_ISLAND_RADIUS + (waterRadius - TERRAIN_ISLAND_RADIUS) * EDGE_SINK_START_RATIO

  useFrame((_, delta) => {
    const player = playerRef.current
    if (!player) {
      return
    }

    const scaledDelta = delta * gameSpeed

    if (input.yawLeft) {
      yawRef.current += YAW_RATE * scaledDelta
    }
    if (input.yawRight) {
      yawRef.current -= YAW_RATE * scaledDelta
    }
    direction.set(0, 0, -1)
    direction.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yawRef.current)
    direction.normalize()

    const currentSpeed = FORWARD_SPEED + (input.speedbar ? SPEEDBAR_BOOST : 0)
    const currentSink = SINK_RATE + (input.speedbar ? SPEEDBAR_SINK_BOOST : 0)
    const distanceFromCenter = Math.hypot(player.position.x, player.position.z)
    const edgeSinkT = THREE.MathUtils.clamp(
      (distanceFromCenter - sinkStartRadius) / Math.max(waterRadius - sinkStartRadius, 1),
      0,
      1,
    )
    const edgeSink = EDGE_SINK_MAX * Math.pow(edgeSinkT, EDGE_SINK_CURVE_EXP)
    const totalSink = currentSink + edgeSink
    let thermalLift = 0

    for (const thermal of thermals) {
      thermalLift += getThermalLiftAtPoint(
        thermal,
        player.position.x,
        player.position.y,
        player.position.z,
      )
    }

    player.position.addScaledVector(direction, currentSpeed * scaledDelta)
    player.position.y += (thermalLift - totalSink) * scaledDelta

    const impactAltitude = terrainHeightAt
      ? terrainHeightAt(player.position.x, player.position.z) + PLAYER_CLEARANCE
      : MIN_ALTITUDE

    if (player.position.y <= impactAltitude) {
      const safeSpawn = computeSafeSpawn(terrainHeightAt)
      player.position.copy(safeSpawn.position)
      yawRef.current = safeSpawn.yaw
    }

    player.rotation.set(0, yawRef.current, 0)
  })

  return (
    <group ref={playerRef} position={initialSpawn.position.toArray()}>
      <mesh castShadow>
        <boxGeometry args={[0.8, 0.4, 1.2]} />
        <meshStandardMaterial color="#ff9a3c" metalness={0.05} roughness={0.35} />
      </mesh>
    </group>
  )
}
