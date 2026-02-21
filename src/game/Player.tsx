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
  STORM_MAX_TOTAL_SINK,
  STORM_START_RATIO,
  TERRAIN_ISLAND_RADIUS,
  TERRAIN_SIZE,
  TERRAIN_WATER_LEVEL,
  YAW_RATE,
} from './constants'
import { ParagliderModel } from './ParagliderModel'
import { computeSafeSpawn } from './spawn'
import type { ThermalColumn } from './thermals'
import { getThermalLiftAtPoint } from './thermals'
import { useKeyboard } from './useKeyboard'
import type { LocalPoseMessage } from '../net/types'

export interface PlayerProps {
  playerRef: RefObject<THREE.Group | null>
  terrainHeightAt?: (x: number, z: number) => number
  thermals?: ThermalColumn[]
  gameSpeed?: number
  onPose?: (pose: LocalPoseMessage) => void
}

export const Player = ({
  playerRef,
  terrainHeightAt,
  thermals = [],
  gameSpeed = 1,
  onPose,
}: PlayerProps) => {
  const WATER_SURFACE_Y = TERRAIN_WATER_LEVEL
  const WATER_RESPAWN_DEPTH = 0.25
  const input = useKeyboard()
  const direction = useMemo(() => new THREE.Vector3(), [])
  const initialSpawn = useMemo(
    () => computeSafeSpawn(terrainHeightAt),
    [terrainHeightAt],
  )
  const yawRef = useRef(initialSpawn.yaw)
  const bankRef = useRef(0)
  const speedbarRef = useRef(false)
  const waterRadius = TERRAIN_SIZE * 0.9
  const sinkStartRadius =
    TERRAIN_ISLAND_RADIUS + (waterRadius - TERRAIN_ISLAND_RADIUS) * EDGE_SINK_START_RATIO
  const stormStartRadius =
    TERRAIN_ISLAND_RADIUS + (waterRadius - TERRAIN_ISLAND_RADIUS) * STORM_START_RATIO

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
    const targetBank = (input.yawRight ? 1 : 0) - (input.yawLeft ? 1 : 0)
    bankRef.current = THREE.MathUtils.lerp(
      bankRef.current,
      targetBank,
      1 - Math.exp(-8 * scaledDelta),
    )
    speedbarRef.current = input.speedbar
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
    const stormT = THREE.MathUtils.clamp(
      (distanceFromCenter - stormStartRadius) / Math.max(waterRadius - stormStartRadius, 1),
      0,
      1,
    )
    const uncappedSink = currentSink + edgeSink
    const sinkCap = THREE.MathUtils.lerp(1000, STORM_MAX_TOTAL_SINK, stormT)
    const totalSink = Math.min(uncappedSink, sinkCap)
    let thermalLift = 0
    const nowSeconds = Date.now() * 0.001

    for (const thermal of thermals) {
      if (nowSeconds < thermal.activationAt) {
        continue
      }
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
      ? (() => {
          const groundY = terrainHeightAt(player.position.x, player.position.z)
          const terrainImpactY = groundY + PLAYER_CLEARANCE
          const isOverWater = groundY <= WATER_SURFACE_Y
          if (isOverWater) {
            return WATER_SURFACE_Y - WATER_RESPAWN_DEPTH
          }
          return terrainImpactY
        })()
      : MIN_ALTITUDE

    if (player.position.y <= impactAltitude) {
      const safeSpawn = computeSafeSpawn(terrainHeightAt)
      player.position.copy(safeSpawn.position)
      yawRef.current = safeSpawn.yaw
    }

    player.rotation.set(0, yawRef.current, 0)

    if (onPose) {
      onPose({
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        yaw: yawRef.current,
        bank: bankRef.current,
        speedbar: speedbarRef.current,
      })
    }
  })

  return (
    <group ref={playerRef} position={initialSpawn.position.toArray()}>
      <group scale={0.58}>
        <ParagliderModel bankRef={bankRef} speedbarRef={speedbarRef} />
      </group>
    </group>
  )
}
