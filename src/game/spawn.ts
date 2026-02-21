import * as THREE from 'three'
import {
  SPAWN_BEACH_MAX_GROUND_OFFSET,
  SPAWN_BASE_XZ,
  SPAWN_MIN_ABSOLUTE_Y,
  SPAWN_MIN_GROUND_HEIGHT,
  SPAWN_POSITION,
  SPAWN_RING_MAX_ATTEMPTS,
  SPAWN_RING_RADIUS,
  SPAWN_VERTICAL_MARGIN,
  TERRAIN_WATER_LEVEL,
} from './constants'

export interface SafeSpawn {
  position: THREE.Vector3
  yaw: number
}

interface SpawnCandidate {
  x: number
  z: number
  groundY: number
}

const candidateOnRing = (center: THREE.Vector2, angle: number, terrainHeightAt: (x: number, z: number) => number): SpawnCandidate => {
  const x = center.x + Math.cos(angle) * SPAWN_RING_RADIUS
  const z = center.y + Math.sin(angle) * SPAWN_RING_RADIUS
  const groundY = terrainHeightAt(x, z)
  return { x, z, groundY }
}

const isValidCandidate = (candidate: SpawnCandidate) =>
  candidate.groundY >= SPAWN_MIN_GROUND_HEIGHT &&
  candidate.groundY <= TERRAIN_WATER_LEVEL + SPAWN_BEACH_MAX_GROUND_OFFSET

const yawTowardCenter = (center: THREE.Vector2, x: number, z: number) => {
  const toCenter = new THREE.Vector2(center.x - x, center.y - z)
  if (toCenter.lengthSq() <= Number.EPSILON) {
    return 0
  }
  toCenter.normalize()
  return Math.atan2(-toCenter.x, -toCenter.y)
}

const safeSpawnFromCandidate = (center: THREE.Vector2, candidate: SpawnCandidate): SafeSpawn => {
  const spawnY = Math.max(candidate.groundY + SPAWN_VERTICAL_MARGIN, SPAWN_MIN_ABSOLUTE_Y)
  return {
    position: new THREE.Vector3(candidate.x, spawnY, candidate.z),
    yaw: yawTowardCenter(center, candidate.x, candidate.z),
  }
}

export const computeSafeSpawn = (
  terrainHeightAt?: (x: number, z: number) => number,
  preferredXZ: THREE.Vector2 = SPAWN_BASE_XZ,
): SafeSpawn => {
  if (!terrainHeightAt) {
    return {
      position: SPAWN_POSITION.clone(),
      yaw: 0,
    }
  }

  const sampledCandidates: SpawnCandidate[] = []

  for (let i = 0; i < SPAWN_RING_MAX_ATTEMPTS; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const candidate = candidateOnRing(preferredXZ, angle, terrainHeightAt)
    sampledCandidates.push(candidate)
    if (isValidCandidate(candidate)) {
      return safeSpawnFromCandidate(preferredXZ, candidate)
    }
  }

  for (let i = 0; i < 72; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const candidate = candidateOnRing(preferredXZ, angle, terrainHeightAt)
    sampledCandidates.push(candidate)
    if (isValidCandidate(candidate)) {
      return safeSpawnFromCandidate(preferredXZ, candidate)
    }
  }

  if (sampledCandidates.length > 0) {
    const randomFallback = sampledCandidates[Math.floor(Math.random() * sampledCandidates.length)]
    return safeSpawnFromCandidate(preferredXZ, randomFallback)
  }

  return {
    position: SPAWN_POSITION.clone(),
    yaw: 0,
  }
}
