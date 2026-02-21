import * as THREE from 'three'
import {
  SPAWN_BASE_XZ,
  SPAWN_FORWARD_CLEARANCE,
  SPAWN_FORWARD_CLEAR_DISTANCE,
  SPAWN_FORWARD_SAMPLES,
  SPAWN_MIN_GROUND_HEIGHT,
  SPAWN_MIN_ABSOLUTE_Y,
  SPAWN_POSITION,
  SPAWN_SEARCH_RADIUS,
  SPAWN_SEARCH_STEPS,
  SPAWN_VERTICAL_MARGIN,
} from './constants'

export interface SafeSpawn {
  position: THREE.Vector3
  yaw: number
}

interface CandidateEval {
  groundY: number
  spawnY: number
  minClearance: number
}

const evaluateCandidate = (
  terrainHeightAt: (x: number, z: number) => number,
  x: number,
  z: number,
): CandidateEval => {
  const groundY = terrainHeightAt(x, z)
  let spawnY = Math.max(groundY + SPAWN_VERTICAL_MARGIN, SPAWN_MIN_ABSOLUTE_Y)
  let minClearance = Number.POSITIVE_INFINITY
  let maxForwardGround = Number.NEGATIVE_INFINITY

  for (let i = 1; i <= SPAWN_FORWARD_SAMPLES; i += 1) {
    const distance = (i / SPAWN_FORWARD_SAMPLES) * SPAWN_FORWARD_CLEAR_DISTANCE
    const sampleZ = z - distance
    const ground = terrainHeightAt(x, sampleZ)
    maxForwardGround = Math.max(maxForwardGround, ground)
    minClearance = Math.min(minClearance, spawnY - ground)
  }

  if (minClearance < SPAWN_FORWARD_CLEARANCE) {
    spawnY = Math.max(spawnY, maxForwardGround + SPAWN_FORWARD_CLEARANCE)
    minClearance = Number.POSITIVE_INFINITY
    for (let i = 1; i <= SPAWN_FORWARD_SAMPLES; i += 1) {
      const distance = (i / SPAWN_FORWARD_SAMPLES) * SPAWN_FORWARD_CLEAR_DISTANCE
      const sampleZ = z - distance
      const ground = terrainHeightAt(x, sampleZ)
      minClearance = Math.min(minClearance, spawnY - ground)
    }
  }

  return { groundY, spawnY, minClearance }
}

const ringCandidates = (center: THREE.Vector2) => {
  const candidates: THREE.Vector2[] = [center.clone()]
  const angleSamples = 16

  for (let step = 1; step <= SPAWN_SEARCH_STEPS; step += 1) {
    const radius = (step / SPAWN_SEARCH_STEPS) * SPAWN_SEARCH_RADIUS
    for (let a = 0; a < angleSamples; a += 1) {
      const theta = (a / angleSamples) * Math.PI * 2
      candidates.push(
        new THREE.Vector2(
          center.x + Math.cos(theta) * radius,
          center.y + Math.sin(theta) * radius,
        ),
      )
    }
  }

  return candidates
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

  const candidates = ringCandidates(preferredXZ)
  let bestValid: { x: number; z: number; spawnY: number; groundY: number } | null = null
  let bestFallback: {
    x: number
    z: number
    spawnY: number
    groundY: number
    minClearance: number
  } | null = null

  for (const candidate of candidates) {
    const { groundY, spawnY, minClearance } = evaluateCandidate(
      terrainHeightAt,
      candidate.x,
      candidate.y,
    )

    if (groundY < SPAWN_MIN_GROUND_HEIGHT) {
      continue
    }

    if (minClearance >= SPAWN_FORWARD_CLEARANCE) {
      if (!bestValid || groundY > bestValid.groundY) {
        bestValid = {
          x: candidate.x,
          z: candidate.y,
          spawnY,
          groundY,
        }
      }
      continue
    }

    if (
      !bestFallback ||
      groundY > bestFallback.groundY ||
      (groundY === bestFallback.groundY && minClearance > bestFallback.minClearance)
    ) {
      bestFallback = {
        x: candidate.x,
        z: candidate.y,
        spawnY,
        groundY,
        minClearance,
      }
    }
  }

  if (bestValid) {
    return {
      position: new THREE.Vector3(bestValid.x, bestValid.spawnY, bestValid.z),
      yaw: 0,
    }
  }

  if (bestFallback) {
    const boostedY = bestFallback.spawnY + (SPAWN_FORWARD_CLEARANCE - bestFallback.minClearance)
    return {
      position: new THREE.Vector3(bestFallback.x, boostedY, bestFallback.z),
      yaw: 0,
    }
  }

  return {
    position: SPAWN_POSITION.clone(),
    yaw: 0,
  }
}
