import * as THREE from 'three'
import {
  SPAWN_BASE_XZ,
  SPAWN_MIN_GROUND_HEIGHT,
  THERMAL_BASE_Y,
  THERMAL_BASE_HEIGHT_MAX,
  THERMAL_BASE_HEIGHT_MIN,
  THERMAL_EDGE_MARGIN,
  THERMAL_HEIGHT_AMPLITUDE_MAX,
  THERMAL_HEIGHT_AMPLITUDE_MIN,
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
  groundY: number
  x: number
  z: number
  radius: number
  baseHeight: number
  heightAmplitude: number
  strength: number
  phase: number
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
  if (y > topY) {
    return 0
  }

  const radialT = 1 - distance / thermal.radius
  const radialInfluence = radialT * radialT
  const height = Math.max(topY - THERMAL_BASE_Y, 1)
  const verticalRatio = THREE.MathUtils.clamp((y - THERMAL_BASE_Y) / height, 0, 1)
  const verticalInfluence = THREE.MathUtils.lerp(1, 0.2, verticalRatio)
  return thermal.strength * radialInfluence * verticalInfluence
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
  const thermals: ThermalColumn[] = []
  const maxAttempts = count * 80
  let attempts = 0

  while (thermals.length < count && attempts < maxAttempts) {
    attempts += 1

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
    const strength = isSmall
      ? randomInRange(rng, THERMAL_SMALL_STRENGTH_MIN, THERMAL_SMALL_STRENGTH_MAX)
      : randomInRange(rng, THERMAL_LARGE_STRENGTH_MIN, THERMAL_LARGE_STRENGTH_MAX)

    const overlapsExisting = thermals.some((existing) => {
      const centerDistance = Math.hypot(existing.x - x, existing.z - z)
      return centerDistance < existing.radius + radius + THERMAL_MIN_GAP
    })
    if (overlapsExisting) {
      continue
    }

    thermals.push({
      id: `thermal-${seed}-${thermals.length}`,
      sizeClass: isSmall ? 'small' : 'large',
      groundY: THERMAL_BASE_Y,
      x,
      z,
      radius,
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

  return thermals
}
