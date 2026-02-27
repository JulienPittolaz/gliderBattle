import * as THREE from 'three'
import {
  SPAWN_BASE_XZ,
  SPAWN_MIN_GROUND_HEIGHT,
  THERMAL_ACTIVATION_DELAY_MAX_SECONDS,
  THERMAL_ACTIVATION_DELAY_MIN_SECONDS,
  THERMAL_BASE_Y,
  THERMAL_BASE_HEIGHT_MAX,
  THERMAL_BASE_HEIGHT_MIN,
  THERMAL_EDGE_MARGIN,
  THERMAL_HEIGHT_AMPLITUDE_MAX,
  THERMAL_HEIGHT_AMPLITUDE_MIN,
  THERMAL_SOFT_CEILING_ABOVE,
  THERMAL_SOFT_CEILING_BELOW,
  THERMAL_LARGE_RADIUS_MAX,
  THERMAL_LARGE_RADIUS_MIN,
  THERMAL_LARGE_STRENGTH_MAX,
  THERMAL_LARGE_STRENGTH_MIN,
  THERMAL_MIN_GAP,
  THERMAL_SMALL_RADIUS_MAX,
  THERMAL_SMALL_RADIUS_MIN,
  THERMAL_SMALL_RATIO,
  THERMAL_SMALL_STRENGTH_MAX,
  THERMAL_SMALL_STRENGTH_MIN,
  THERMAL_SPAWN_EXCLUSION_RADIUS,
} from './constants'

export interface ThermalColumn {
  id: string
  sizeClass: 'small' | 'large'
  activationAt: number
  groundY: number
  x: number
  z: number
  radius: number
  baseHeight: number
  heightAmplitude: number
  strength: number
  phase: number
}

export interface ThermalVisualEntry {
  id: string
  thermal: ThermalColumn
  cloudAppearAt: number
  thermalAppearAt: number
  disappearAt: number | null
}

const createRng = (seed: number) => {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const randomInRange = (rng: () => number, min: number, max: number) =>
  THREE.MathUtils.lerp(min, max, rng())

export const getThermalHeight = (thermal: ThermalColumn) =>
  Math.max(4, thermal.baseHeight)

export const getThermalTopY = (thermal: ThermalColumn) =>
  THERMAL_BASE_Y + getThermalHeight(thermal)

export const getThermalLiftAtPoint = (
  thermal: ThermalColumn,
  x: number,
  y: number,
  z: number,
): number => {
  const dx = x - thermal.x
  const dz = z - thermal.z
  const distance = Math.hypot(dx, dz)
  if (distance >= thermal.radius) {
    return 0
  }

  const topY = getThermalTopY(thermal)
  const ceilingStart = topY - THERMAL_SOFT_CEILING_BELOW
  const ceilingEnd = topY + THERMAL_SOFT_CEILING_ABOVE
  if (y >= ceilingEnd) {
    return 0
  }
  const ceilingT = THREE.MathUtils.clamp(
    (y - ceilingStart) / Math.max(ceilingEnd - ceilingStart, 0.001),
    0,
    1,
  )
  const smoothCeiling = ceilingT * ceilingT * (3 - 2 * ceilingT)
  const ceilingInfluence = 1 - smoothCeiling
  return thermal.strength * ceilingInfluence
}

export const getThermalStrengthNormalized = (thermal: ThermalColumn) => {
  const minStrength =
    thermal.sizeClass === 'small'
      ? THERMAL_SMALL_STRENGTH_MIN
      : THERMAL_LARGE_STRENGTH_MIN
  const maxStrength =
    thermal.sizeClass === 'small'
      ? THERMAL_SMALL_STRENGTH_MAX
      : THERMAL_LARGE_STRENGTH_MAX
  return THREE.MathUtils.clamp(
    (thermal.strength - minStrength) / Math.max(maxStrength - minStrength, Number.EPSILON),
    0,
    1,
  )
}

export const generateThermals = (
  count: number,
  terrainHeightAt: (x: number, z: number) => number,
  islandRadius: number,
  seed: number,
): ThermalColumn[] => {
  const rng = createRng(seed)
  const batchNowSeconds = Date.now() * 0.001
  const thermals: ThermalColumn[] = []
  const CANDIDATES_PER_THERMAL = 64
  const FALLBACK_ATTEMPTS_PER_THERMAL = 120

  while (thermals.length < count) {
    let bestCandidate: { x: number; z: number; radius: number; isSmall: boolean; score: number } | null = null

    for (let i = 0; i < CANDIDATES_PER_THERMAL; i += 1) {
      const theta = rng() * Math.PI * 2
      const maxRadius = Math.max(islandRadius - THERMAL_EDGE_MARGIN, 10)
      const radiusFromCenter = Math.sqrt(rng()) * maxRadius
      const x = Math.cos(theta) * radiusFromCenter
      const z = Math.sin(theta) * radiusFromCenter

      if (Math.hypot(x - SPAWN_BASE_XZ.x, z - SPAWN_BASE_XZ.y) < THERMAL_SPAWN_EXCLUSION_RADIUS) {
        continue
      }

      const terrainY = terrainHeightAt(x, z)
      if (terrainY < SPAWN_MIN_GROUND_HEIGHT) {
        continue
      }

      const isSmall = rng() < THERMAL_SMALL_RATIO
      const radius = isSmall
        ? randomInRange(rng, THERMAL_SMALL_RADIUS_MIN, THERMAL_SMALL_RADIUS_MAX)
        : randomInRange(rng, THERMAL_LARGE_RADIUS_MIN, THERMAL_LARGE_RADIUS_MAX)

      let minClearance = Infinity
      let overlapsExisting = false
      for (const existing of thermals) {
        const centerDistance = Math.hypot(existing.x - x, existing.z - z)
        const clearance = centerDistance - (existing.radius + radius + THERMAL_MIN_GAP)
        minClearance = Math.min(minClearance, clearance)
        if (clearance < 0) {
          overlapsExisting = true
          break
        }
      }
      if (overlapsExisting) {
        continue
      }

      const edgeBias = radiusFromCenter / maxRadius
      const spreadScore = Number.isFinite(minClearance) ? minClearance : maxRadius * 0.5
      const score = spreadScore + edgeBias * 6

      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = { x, z, radius, isSmall, score }
      }
    }

    if (!bestCandidate) {
      // If the layout is saturated, try random fallback positions for this slot.
      let placed = false
      for (let attempt = 0; attempt < FALLBACK_ATTEMPTS_PER_THERMAL; attempt += 1) {
        const theta = rng() * Math.PI * 2
        const maxRadius = Math.max(islandRadius - THERMAL_EDGE_MARGIN, 10)
        const radiusFromCenter = Math.sqrt(rng()) * maxRadius
        const x = Math.cos(theta) * radiusFromCenter
        const z = Math.sin(theta) * radiusFromCenter
        if (Math.hypot(x - SPAWN_BASE_XZ.x, z - SPAWN_BASE_XZ.y) < THERMAL_SPAWN_EXCLUSION_RADIUS) {
          continue
        }
        if (terrainHeightAt(x, z) < SPAWN_MIN_GROUND_HEIGHT) {
          continue
        }
        const isSmall = rng() < THERMAL_SMALL_RATIO
        const radius = isSmall
          ? randomInRange(rng, THERMAL_SMALL_RADIUS_MIN, THERMAL_SMALL_RADIUS_MAX)
          : randomInRange(rng, THERMAL_LARGE_RADIUS_MIN, THERMAL_LARGE_RADIUS_MAX)
        const overlapsExisting = thermals.some((existing) => {
          const centerDistance = Math.hypot(existing.x - x, existing.z - z)
          return centerDistance < existing.radius + radius + THERMAL_MIN_GAP
        })
        if (overlapsExisting) {
          continue
        }
        bestCandidate = { x, z, radius, isSmall, score: 0 }
        placed = true
        break
      }
      if (!placed) {
        break
      }
    }

    const candidate = bestCandidate
    if (!candidate) {
      break
    }

    const strength = candidate.isSmall
      ? randomInRange(rng, THERMAL_SMALL_STRENGTH_MIN, THERMAL_SMALL_STRENGTH_MAX)
      : randomInRange(rng, THERMAL_LARGE_STRENGTH_MIN, THERMAL_LARGE_STRENGTH_MAX)

    thermals.push({
      id: `thermal-${seed}-${thermals.length}`,
      sizeClass: candidate.isSmall ? 'small' : 'large',
      activationAt: batchNowSeconds,
      groundY: THERMAL_BASE_Y,
      x: candidate.x,
      z: candidate.z,
      radius: candidate.radius,
      baseHeight: randomInRange(rng, THERMAL_BASE_HEIGHT_MIN, THERMAL_BASE_HEIGHT_MAX),
      heightAmplitude: randomInRange(
        rng,
        THERMAL_HEIGHT_AMPLITUDE_MIN,
        THERMAL_HEIGHT_AMPLITUDE_MAX,
      ),
      strength,
      phase: rng() * Math.PI * 2,
    })
  }

  const activationRange = Math.max(
    THERMAL_ACTIVATION_DELAY_MAX_SECONDS - THERMAL_ACTIVATION_DELAY_MIN_SECONDS,
    0,
  )
  if (activationRange > 0 && thermals.length > 0) {
    const slotSize = activationRange / thermals.length
    const ranked = thermals
      .map((_, index) => ({ index, key: rng() }))
      .sort((a, b) => a.key - b.key)

    for (let rank = 0; rank < ranked.length; rank += 1) {
      const { index } = ranked[rank]
      const centerDelay = THERMAL_ACTIVATION_DELAY_MIN_SECONDS + (rank + 0.5) * slotSize
      const jitter = (rng() - 0.5) * slotSize * 0.7
      const delayed = THREE.MathUtils.clamp(
        centerDelay + jitter,
        THERMAL_ACTIVATION_DELAY_MIN_SECONDS,
        THERMAL_ACTIVATION_DELAY_MAX_SECONDS,
      )
      thermals[index].activationAt = batchNowSeconds + delayed
    }
  }

  return thermals
}
