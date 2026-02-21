import * as THREE from 'three'
import {
  TERRAIN_HEIGHT_BASE,
  TERRAIN_ISLAND_RADIUS,
  TERRAIN_MAX_HEIGHT,
  TERRAIN_NOISE_SCALE,
  TERRAIN_SEED,
  TERRAIN_SEGMENTS,
  TERRAIN_SIZE,
} from './constants'

export interface TerrainData {
  geometry: THREE.BufferGeometry
  getHeightAt: (x: number, z: number) => number
  islandRadius: number
}

const fract = (n: number) => n - Math.floor(n)

const hash2 = (x: number, z: number, seed: number) =>
  fract(Math.sin(x * 127.1 + z * 311.7 + seed * 17.13) * 43758.5453123)

const smoothstep = (t: number) => t * t * (3 - 2 * t)

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

const terrainHeightAt = (x: number, z: number) => {
  const mask = islandMask(x, z)
  if (mask <= 0) {
    return TERRAIN_HEIGHT_BASE - 2
  }

  const base = fractalNoise(x, z)
  const ridges = ridgeNoise(x, z)
  const mixed = base * 0.75 + ridges * 0.25
  return TERRAIN_HEIGHT_BASE + mixed * TERRAIN_MAX_HEIGHT * mask
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

  return {
    geometry: faceted,
    getHeightAt: terrainHeightAt,
    islandRadius: TERRAIN_ISLAND_RADIUS,
  }
}
