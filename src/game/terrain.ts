import * as THREE from 'three'
import {
  SPAWN_BASE_XZ,
  SPAWN_MIN_GROUND_HEIGHT,
  TERRAIN_BIOME_BEACH_MAX_SLOPE,
  TERRAIN_BIOME_BEACH_RADIUS_START,
  TERRAIN_BIOME_FOREST_MAX_HEIGHT,
  TERRAIN_BIOME_FOREST_MAX_SLOPE,
  TERRAIN_BIOME_FOREST_MIN_HEIGHT,
  TERRAIN_BIOME_ROCK_MIN_SLOPE,
  TERRAIN_BIOME_SNOW_MAX_SLOPE,
  TERRAIN_BIOME_SNOW_MIN_HEIGHT,
  TERRAIN_COLOR_BEACH,
  TERRAIN_COLOR_FOREST,
  TERRAIN_COLOR_GRASS,
  TERRAIN_COLOR_ROCK,
  TERRAIN_COLOR_SNOW,
  TERRAIN_FOREST_EDGE_MARGIN,
  TERRAIN_FOREST_INSTANCE_COUNT,
  TERRAIN_FOREST_MIN_SPACING,
  TERRAIN_FOREST_SCALE_MAX,
  TERRAIN_FOREST_SCALE_MIN,
  TERRAIN_FOREST_SPAWN_EXCLUSION_RADIUS,
  TERRAIN_INLAND_LAKE_DEPTH,
  TERRAIN_INLAND_LAKE_MAX_CENTER_RADIUS_RATIO,
  TERRAIN_INLAND_LAKE_MIN_DIST_FROM_SPAWN,
  TERRAIN_INLAND_LAKE_MIN_RIM_ABOVE_WATER,
  TERRAIN_INLAND_LAKE_MIN_UNDERWATER_DEPTH,
  TERRAIN_INLAND_LAKE_RADIUS_MAX,
  TERRAIN_INLAND_LAKE_RADIUS_MIN,
  TERRAIN_INLAND_LAKE_RIM_WIDTH,
  TERRAIN_INLAND_LAKE_SHORE_BLEND,
  TERRAIN_HEIGHT_BASE,
  TERRAIN_ISLAND_RADIUS,
  TERRAIN_MAX_HEIGHT,
  TERRAIN_NOISE_SCALE,
  TERRAIN_SEED,
  TERRAIN_SEGMENTS,
  TERRAIN_SIZE,
  TERRAIN_WATER_LEVEL,
  LAKE_MONSTER_MIN_SHORE_CLEARANCE,
} from './constants'

export type TerrainBiome = 'beach' | 'grass' | 'forest' | 'rock' | 'snow'

export interface ForestInstance {
  x: number
  y: number
  z: number
  scale: number
  yaw: number
  type: number
}

export interface InlandLake {
  x: number
  z: number
  radius: number
  waterY: number
}

export interface LakeMonsterAnchor {
  x: number
  z: number
}

export interface TerrainData {
  geometry: THREE.BufferGeometry
  getHeightAt: (x: number, z: number) => number
  biomeAt: (x: number, z: number) => TerrainBiome
  inlandLake: InlandLake | null
  isInInlandLake: (x: number, z: number) => boolean
  lakeMonsterAnchor: LakeMonsterAnchor | null
  forestInstances: ForestInstance[]
  islandRadius: number
}

const fract = (n: number) => n - Math.floor(n)

const hash2 = (x: number, z: number, seed: number) =>
  fract(Math.sin(x * 127.1 + z * 311.7 + seed * 17.13) * 43758.5453123)

const smoothstep = (t: number) => t * t * (3 - 2 * t)

const createRng = (seed: number) => {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const valueNoise2 = (x: number, z: number, seed: number) => {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const x1 = x0 + 1
  const z1 = z0 + 1

  const tx = smoothstep(x - x0)
  const tz = smoothstep(z - z0)

  const n00 = hash2(x0, z0, seed)
  const n10 = hash2(x1, z0, seed)
  const n01 = hash2(x0, z1, seed)
  const n11 = hash2(x1, z1, seed)

  const nx0 = THREE.MathUtils.lerp(n00, n10, tx)
  const nx1 = THREE.MathUtils.lerp(n01, n11, tx)
  return THREE.MathUtils.lerp(nx0, nx1, tz)
}

const fractalNoise = (x: number, z: number) => {
  let frequency = TERRAIN_NOISE_SCALE
  let amplitude = 1
  let total = 0
  let amplitudeSum = 0

  for (let octave = 0; octave < 4; octave += 1) {
    total += (valueNoise2(x * frequency, z * frequency, TERRAIN_SEED + octave * 53) * 2 - 1) * amplitude
    amplitudeSum += amplitude
    amplitude *= 0.5
    frequency *= 2
  }

  return total / Math.max(amplitudeSum, Number.EPSILON)
}

const ridgeNoise = (x: number, z: number) => {
  const n = valueNoise2(
    x * TERRAIN_NOISE_SCALE * 2.3,
    z * TERRAIN_NOISE_SCALE * 2.3,
    TERRAIN_SEED + 999,
  )
  return 1 - Math.abs(n * 2 - 1)
}

const islandMask = (x: number, z: number) => {
  const dist = Math.hypot(x, z)
  const r = dist / TERRAIN_ISLAND_RADIUS
  if (r >= 1) {
    return 0
  }

  return 1 - smoothstep(r * r)
}

const baseTerrainHeightAt = (x: number, z: number) => {
  const mask = islandMask(x, z)
  if (mask <= 0) {
    return TERRAIN_HEIGHT_BASE - 2
  }

  const base = fractalNoise(x, z)
  const ridges = ridgeNoise(x, z)
  const mixed = base * 0.75 + ridges * 0.25
  return TERRAIN_HEIGHT_BASE + mixed * TERRAIN_MAX_HEIGHT * mask
}

const lakeDepthFromDistance = (
  distance: number,
  radius: number,
  baseHeight: number,
  waterY: number,
) => {
  const outerRadius = radius + TERRAIN_INLAND_LAKE_RIM_WIDTH
  if (distance >= outerRadius) {
    return 0
  }

  const tOuter = THREE.MathUtils.clamp(distance / outerRadius, 0, 1)
  const outerFalloff = 1 - smoothstep(tOuter)
  const innerT = THREE.MathUtils.clamp(1 - distance / Math.max(radius, Number.EPSILON), 0, 1)
  const bowl = innerT * innerT
  const proceduralDepth = TERRAIN_INLAND_LAKE_DEPTH * (bowl * 0.85 + outerFalloff * 0.15)
  const minDepthToExposeWater = Math.max(0, baseHeight - (waterY - 0.18))
  return Math.max(proceduralDepth, minDepthToExposeWater * innerT)
}

const carvedHeightForLakeCandidate = (
  x: number,
  z: number,
  lakeX: number,
  lakeZ: number,
  lakeRadius: number,
) => {
  const baseHeight = baseTerrainHeightAt(x, z)
  const distance = Math.hypot(x - lakeX, z - lakeZ)
  return (
    baseHeight -
    lakeDepthFromDistance(distance, lakeRadius, baseHeight, TERRAIN_WATER_LEVEL)
  )
}

const generateInlandLake = (): InlandLake | null => {
  const rng = createRng(TERRAIN_SEED + 911)
  const maxCenterRadius = TERRAIN_ISLAND_RADIUS * TERRAIN_INLAND_LAKE_MAX_CENTER_RADIUS_RATIO
  const attempts = 260
  const shoreSafety = 5

  for (let i = 0; i < attempts; i += 1) {
    const theta = rng() * Math.PI * 2
    const centerRadius = Math.sqrt(rng()) * maxCenterRadius
    const x = Math.cos(theta) * centerRadius
    const z = Math.sin(theta) * centerRadius
    const radius = THREE.MathUtils.lerp(TERRAIN_INLAND_LAKE_RADIUS_MIN, TERRAIN_INLAND_LAKE_RADIUS_MAX, rng())

    if (Math.hypot(x - SPAWN_BASE_XZ.x, z - SPAWN_BASE_XZ.y) < TERRAIN_INLAND_LAKE_MIN_DIST_FROM_SPAWN) {
      continue
    }
    if (Math.hypot(x, z) + radius + shoreSafety > TERRAIN_ISLAND_RADIUS * 0.82) {
      continue
    }

    const centerGround = baseTerrainHeightAt(x, z)
    if (centerGround < TERRAIN_WATER_LEVEL + 3) {
      continue
    }

    let valid = true
    let minRimGround = Number.POSITIVE_INFINITY
    for (let sample = 0; sample < 16; sample += 1) {
      const a = (sample / 16) * Math.PI * 2
      const sx = x + Math.cos(a) * (radius + TERRAIN_INLAND_LAKE_RIM_WIDTH)
      const sz = z + Math.sin(a) * (radius + TERRAIN_INLAND_LAKE_RIM_WIDTH)
      if (islandMask(sx, sz) <= 0.2) {
        valid = false
        break
      }
      const rimGround = baseTerrainHeightAt(sx, sz)
      minRimGround = Math.min(minRimGround, rimGround)
    }
    if (!valid || minRimGround < TERRAIN_WATER_LEVEL + 0.8) {
      continue
    }

    const centerCarvedY = carvedHeightForLakeCandidate(x, z, x, z, radius)
    if (centerCarvedY > TERRAIN_WATER_LEVEL - TERRAIN_INLAND_LAKE_MIN_UNDERWATER_DEPTH) {
      continue
    }

    let rimOk = true
    for (let sample = 0; sample < 16; sample += 1) {
      const a = (sample / 16) * Math.PI * 2
      const sx = x + Math.cos(a) * (radius + TERRAIN_INLAND_LAKE_RIM_WIDTH * 0.5)
      const sz = z + Math.sin(a) * (radius + TERRAIN_INLAND_LAKE_RIM_WIDTH * 0.5)
      const carvedRimY = carvedHeightForLakeCandidate(sx, sz, x, z, radius)
      if (carvedRimY < TERRAIN_WATER_LEVEL + TERRAIN_INLAND_LAKE_MIN_RIM_ABOVE_WATER) {
        rimOk = false
        break
      }
    }
    if (!rimOk) {
      continue
    }

    return {
      x,
      z,
      radius,
      waterY: TERRAIN_WATER_LEVEL,
    }
  }

  const fallbackCandidates: Array<{ x: number; z: number; radius: number }> = [
    { x: 34, z: -22, radius: 10.5 },
    { x: -30, z: 25, radius: 9.8 },
    { x: 22, z: 31, radius: 9.2 },
  ]
  for (const candidate of fallbackCandidates) {
    if (Math.hypot(candidate.x, candidate.z) + candidate.radius + 4 > TERRAIN_ISLAND_RADIUS * 0.84) {
      continue
    }
    if (Math.hypot(candidate.x - SPAWN_BASE_XZ.x, candidate.z - SPAWN_BASE_XZ.y) < TERRAIN_INLAND_LAKE_MIN_DIST_FROM_SPAWN) {
      continue
    }
    if (baseTerrainHeightAt(candidate.x, candidate.z) < TERRAIN_WATER_LEVEL + 3) {
      continue
    }
    const centerCarvedY = carvedHeightForLakeCandidate(
      candidate.x,
      candidate.z,
      candidate.x,
      candidate.z,
      candidate.radius,
    )
    if (centerCarvedY > TERRAIN_WATER_LEVEL - TERRAIN_INLAND_LAKE_MIN_UNDERWATER_DEPTH) {
      continue
    }
    return {
      x: candidate.x,
      z: candidate.z,
      radius: candidate.radius,
      waterY: TERRAIN_WATER_LEVEL,
    }
  }

  return {
    x: 28,
    z: -24,
    radius: 9.5,
    waterY: TERRAIN_WATER_LEVEL,
  }
}

const inlandLake = generateInlandLake()

const isInInlandLake = (x: number, z: number) => {
  if (!inlandLake) {
    return false
  }
  return Math.hypot(x - inlandLake.x, z - inlandLake.z) <= inlandLake.radius * 0.98
}

const lakeDepthAt = (x: number, z: number) => {
  if (!inlandLake) {
    return 0
  }

  const dx = x - inlandLake.x
  const dz = z - inlandLake.z
  const distance = Math.hypot(dx, dz)
  const baseHeight = baseTerrainHeightAt(x, z)
  return lakeDepthFromDistance(distance, inlandLake.radius, baseHeight, inlandLake.waterY)
}

const terrainHeightAt = (x: number, z: number) => baseTerrainHeightAt(x, z) - lakeDepthAt(x, z)

const findLakeMonsterAnchor = (): LakeMonsterAnchor | null => {
  if (!inlandLake) {
    return null
  }

  let best: LakeMonsterAnchor | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  const samples = 80
  const maxRadius = Math.max(
    inlandLake.radius - LAKE_MONSTER_MIN_SHORE_CLEARANCE,
    inlandLake.radius * 0.35,
  )

  for (let i = 0; i < samples; i += 1) {
    const t = i / samples
    const angle = t * Math.PI * 2 + valueNoise2(t * 9.1, inlandLake.x * 0.07, TERRAIN_SEED + 777) * 0.45
    const radius = Math.sqrt((i + 1) / samples) * maxRadius
    const x = inlandLake.x + Math.cos(angle) * radius
    const z = inlandLake.z + Math.sin(angle) * radius
    const distance = Math.hypot(x - inlandLake.x, z - inlandLake.z)
    const shoreClearance = inlandLake.radius - distance
    if (shoreClearance < LAKE_MONSTER_MIN_SHORE_CLEARANCE * 0.55) {
      continue
    }

    const terrainY = terrainHeightAt(x, z)
    const submergence = inlandLake.waterY - terrainY
    const score = submergence * 1.2 + shoreClearance * 0.38
    if (score > bestScore) {
      bestScore = score
      best = { x, z }
    }
  }

  return best ?? { x: inlandLake.x, z: inlandLake.z }
}

const lakeMonsterAnchor = findLakeMonsterAnchor()

const terrainSlopeAt = (x: number, z: number) => {
  const step = 1.2
  const hL = terrainHeightAt(x - step, z)
  const hR = terrainHeightAt(x + step, z)
  const hD = terrainHeightAt(x, z - step)
  const hU = terrainHeightAt(x, z + step)
  const dx = (hR - hL) / (2 * step)
  const dz = (hU - hD) / (2 * step)
  return THREE.MathUtils.clamp(Math.hypot(dx, dz) / 2.2, 0, 1)
}

const biomeAt = (x: number, z: number): TerrainBiome => {
  const distNorm = Math.hypot(x, z) / TERRAIN_ISLAND_RADIUS
  if (distNorm >= 1) {
    return 'beach'
  }
  if (isInInlandLake(x, z)) {
    return 'beach'
  }

  const height = terrainHeightAt(x, z)
  const heightNorm = THREE.MathUtils.clamp(
    (height - TERRAIN_WATER_LEVEL) / Math.max(TERRAIN_MAX_HEIGHT, Number.EPSILON),
    0,
    1,
  )
  const slope = terrainSlopeAt(x, z)
  const shoreNoise = valueNoise2(x * 0.08, z * 0.08, TERRAIN_SEED + 2027)
  const forestNoise = valueNoise2(x * 0.06, z * 0.06, TERRAIN_SEED + 3029)
  const beachStart = TERRAIN_BIOME_BEACH_RADIUS_START - (shoreNoise - 0.5) * 0.05
  const lakeShoreFactor = inlandLake
    ? (() => {
        const d = Math.hypot(x - inlandLake.x, z - inlandLake.z)
        const delta = Math.abs(d - inlandLake.radius)
        const band = TERRAIN_INLAND_LAKE_RIM_WIDTH * (0.8 + TERRAIN_INLAND_LAKE_SHORE_BLEND)
        return 1 - smoothstep(THREE.MathUtils.clamp(delta / Math.max(band, Number.EPSILON), 0, 1))
      })()
    : 0

  if (
    (distNorm >= beachStart && slope <= TERRAIN_BIOME_BEACH_MAX_SLOPE && heightNorm <= 0.62) ||
    lakeShoreFactor > 0.28
  ) {
    return 'beach'
  }

  if (heightNorm >= TERRAIN_BIOME_SNOW_MIN_HEIGHT && slope <= TERRAIN_BIOME_SNOW_MAX_SLOPE) {
    return 'snow'
  }

  if (slope >= TERRAIN_BIOME_ROCK_MIN_SLOPE) {
    return 'rock'
  }

  if (
    heightNorm >= TERRAIN_BIOME_FOREST_MIN_HEIGHT &&
    heightNorm <= TERRAIN_BIOME_FOREST_MAX_HEIGHT &&
    slope <= TERRAIN_BIOME_FOREST_MAX_SLOPE &&
    forestNoise >= 0.43 &&
    distNorm <= 0.92
  ) {
    return 'forest'
  }

  return 'grass'
}

const BIOME_COLORS: Record<TerrainBiome, THREE.Color> = {
  beach: new THREE.Color(TERRAIN_COLOR_BEACH),
  grass: new THREE.Color(TERRAIN_COLOR_GRASS),
  forest: new THREE.Color(TERRAIN_COLOR_FOREST),
  rock: new THREE.Color(TERRAIN_COLOR_ROCK),
  snow: new THREE.Color(TERRAIN_COLOR_SNOW),
}

const colorFromBiome = (biome: TerrainBiome, variation: number, out: THREE.Color) => {
  const satShift = THREE.MathUtils.lerp(-0.07, 0.04, variation)
  const lightShift = THREE.MathUtils.lerp(-0.09, 0.08, variation)
  out.copy(BIOME_COLORS[biome])
  out.offsetHSL(0, satShift, lightShift)
  return out
}

const generateForestInstances = (): ForestInstance[] => {
  const rng = createRng(TERRAIN_SEED + 701)
  const maxRadius = Math.max(TERRAIN_ISLAND_RADIUS - TERRAIN_FOREST_EDGE_MARGIN, 10)
  const instances: ForestInstance[] = []
  const attempts = TERRAIN_FOREST_INSTANCE_COUNT * 36

  for (let i = 0; i < attempts && instances.length < TERRAIN_FOREST_INSTANCE_COUNT; i += 1) {
    const theta = rng() * Math.PI * 2
    const radius = Math.sqrt(rng()) * maxRadius
    const x = Math.cos(theta) * radius
    const z = Math.sin(theta) * radius

    if (Math.hypot(x - SPAWN_BASE_XZ.x, z - SPAWN_BASE_XZ.y) < TERRAIN_FOREST_SPAWN_EXCLUSION_RADIUS) {
      continue
    }
    if (isInInlandLake(x, z)) {
      continue
    }

    if (biomeAt(x, z) !== 'forest') {
      continue
    }

    const y = terrainHeightAt(x, z)
    if (y < SPAWN_MIN_GROUND_HEIGHT) {
      continue
    }

    const scale = THREE.MathUtils.lerp(TERRAIN_FOREST_SCALE_MIN, TERRAIN_FOREST_SCALE_MAX, rng())
    const minSpacing = TERRAIN_FOREST_MIN_SPACING * scale
    const overlaps = instances.some((instance) => {
      const required = (minSpacing + TERRAIN_FOREST_MIN_SPACING * instance.scale) * 0.5
      return (instance.x - x) ** 2 + (instance.z - z) ** 2 < required * required
    })
    if (overlaps) {
      continue
    }

    instances.push({
      x,
      y,
      z,
      scale,
      yaw: rng() * Math.PI * 2,
      type: Math.floor(rng() * 3),
    })
  }

  return instances
}

export const createProceduralIslandTerrain = (): TerrainData => {
  const geometry = new THREE.PlaneGeometry(
    TERRAIN_SIZE,
    TERRAIN_SIZE,
    TERRAIN_SEGMENTS,
    TERRAIN_SEGMENTS,
  )
  geometry.rotateX(-Math.PI / 2)

  const position = geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i)
    position.setY(i, terrainHeightAt(x, z))
  }

  geometry.attributes.position.needsUpdate = true
  const faceted = geometry.toNonIndexed()
  geometry.dispose()
  faceted.computeVertexNormals()
  const facetedPosition = faceted.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(facetedPosition.count * 3)
  const color = new THREE.Color()

  for (let i = 0; i < facetedPosition.count; i += 1) {
    const x = facetedPosition.getX(i)
    const z = facetedPosition.getZ(i)
    const biome = biomeAt(x, z)
    const variation = valueNoise2(x * 0.11, z * 0.11, TERRAIN_SEED + 4001)
    colorFromBiome(biome, variation, color)
    if (inlandLake) {
      const d = Math.hypot(x - inlandLake.x, z - inlandLake.z)
      const shoreBand = TERRAIN_INLAND_LAKE_RIM_WIDTH * (0.9 + TERRAIN_INLAND_LAKE_SHORE_BLEND)
      const shoreT = 1 - smoothstep(THREE.MathUtils.clamp(Math.abs(d - inlandLake.radius) / shoreBand, 0, 1))
      if (shoreT > 0.001) {
        color.lerp(BIOME_COLORS.beach, shoreT * 0.45)
      }
    }
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  faceted.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const forestInstances = generateForestInstances()

  return {
    geometry: faceted,
    getHeightAt: terrainHeightAt,
    biomeAt,
    inlandLake,
    isInInlandLake,
    lakeMonsterAnchor,
    forestInstances,
    islandRadius: TERRAIN_ISLAND_RADIUS,
  }
}
