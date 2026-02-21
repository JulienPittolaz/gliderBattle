import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  THERMAL_FADE_IN_SECONDS,
  THERMAL_FADE_OUT_SECONDS,
  THERMAL_CLOUD_COVERAGE_RATIO,
  THERMAL_CLOUD_COLOR,
  THERMAL_CLOUD_INNER_RATIO,
  THERMAL_CLOUD_PART_BASE_AREA,
  THERMAL_CLOUD_PARTS_MAX,
  THERMAL_CLOUD_PARTS_MIN,
  THERMAL_CLOUD_SCALE_LARGE_MAX,
  THERMAL_CLOUD_SCALE_LARGE_MIN,
  THERMAL_CLOUD_SCALE_SMALL_MAX,
  THERMAL_CLOUD_SCALE_SMALL_MIN,
  THERMAL_CLOUD_TOP_OFFSET,
} from './constants'
import type { ThermalColumn, ThermalVisualEntry } from './thermals'
import { getThermalTopY } from './thermals'

interface ThermalCloudFieldProps {
  thermals: ThermalVisualEntry[]
}

interface ThermalCloudProps {
  thermalEntry: ThermalVisualEntry
}

interface CloudPart {
  offset: THREE.Vector3
  rotation: THREE.Euler
  scale: number
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

const hashString = (value: string) => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const makeCloudParts = (thermal: ThermalColumn): CloudPart[] => {
  const rng = createRng(hashString(thermal.id))
  const baseScale =
    thermal.sizeClass === 'small'
      ? THREE.MathUtils.lerp(THERMAL_CLOUD_SCALE_SMALL_MIN, THERMAL_CLOUD_SCALE_SMALL_MAX, rng())
      : THREE.MathUtils.lerp(THERMAL_CLOUD_SCALE_LARGE_MIN, THERMAL_CLOUD_SCALE_LARGE_MAX, rng())

  const thermalArea = Math.PI * thermal.radius * thermal.radius
  const areaFactor = thermalArea / THERMAL_CLOUD_PART_BASE_AREA
  const partCount = THREE.MathUtils.clamp(
    Math.round(areaFactor * 2.1),
    THERMAL_CLOUD_PARTS_MIN,
    THERMAL_CLOUD_PARTS_MAX,
  )

  const innerRadius = thermal.radius * THERMAL_CLOUD_INNER_RATIO
  const outerRadius = thermal.radius * THERMAL_CLOUD_COVERAGE_RATIO

  const parts = Array.from({ length: partCount }, (_, index) => {
    const angle = rng() * Math.PI * 2
    const radialT = Math.sqrt(rng())
    const spread = THREE.MathUtils.lerp(innerRadius, outerRadius, radialT)
    const yLift = baseScale * (index === 0 ? 0.25 : 0.05 + rng() * 0.8)
    const tilt = (rng() - 0.5) * 0.85
    const yaw = rng() * Math.PI * 2
    const roll = (rng() - 0.5) * 0.85
    return {
      offset: new THREE.Vector3(
        Math.cos(angle) * spread,
        yLift,
        Math.sin(angle) * spread,
      ),
      rotation: new THREE.Euler(tilt, yaw, roll),
      scale: baseScale * (0.65 + rng() * 0.7),
    }
  })

  let maxDistance = 0
  for (const part of parts) {
    const distance = Math.hypot(part.offset.x, part.offset.z)
    if (distance > maxDistance) {
      maxDistance = distance
    }
  }

  if (maxDistance < thermal.radius * 0.9) {
    const edgeParts = 3
    for (let i = 0; i < edgeParts; i += 1) {
      const angle = (i / edgeParts) * Math.PI * 2 + rng() * 0.3
      const spread = thermal.radius * (0.9 + rng() * 0.08)
      parts.push({
        offset: new THREE.Vector3(
          Math.cos(angle) * spread,
          baseScale * (0.1 + rng() * 0.35),
          Math.sin(angle) * spread,
        ),
        rotation: new THREE.Euler(
          (rng() - 0.5) * 0.85,
          rng() * Math.PI * 2,
          (rng() - 0.5) * 0.85,
        ),
        scale: baseScale * (0.55 + rng() * 0.45),
      })
    }
  }

  return parts
}

const ThermalCloud = ({ thermalEntry }: ThermalCloudProps) => {
  const groupRef = useRef<THREE.Group>(null)
  const thermal = thermalEntry.thermal
  const parts = useMemo(() => makeCloudParts(thermal), [thermal])

  useFrame(() => {
    const group = groupRef.current
    if (!group) {
      return
    }

    const topY = getThermalTopY(thermal)
    group.position.set(thermal.x, topY + THERMAL_CLOUD_TOP_OFFSET, thermal.z)

    const now = performance.now() * 0.001
    const fadeIn = THREE.MathUtils.clamp(
      (now - thermalEntry.appearAt) / THERMAL_FADE_IN_SECONDS,
      0,
      1,
    )
    const fadeOut =
      thermalEntry.disappearAt === null
        ? 1
        : 1 -
          THREE.MathUtils.clamp(
            (now - thermalEntry.disappearAt) / THERMAL_FADE_OUT_SECONDS,
            0,
            1,
          )
    group.visible = fadeIn > 0.001 && fadeOut > 0.001
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) {
        return
      }
      const material = mesh.material as THREE.MeshStandardMaterial
      material.transparent = true
      material.opacity = Math.min(fadeIn, fadeOut)
      material.depthWrite = material.opacity >= 0.98
    })
  })

  return (
    <group ref={groupRef}>
      {parts.map((part, index) => (
        <mesh
          key={`${thermal.id}-cloud-part-${index}`}
          position={part.offset}
          rotation={part.rotation}
        >
          <icosahedronGeometry args={[part.scale, 0]} />
          <meshStandardMaterial
            color={THERMAL_CLOUD_COLOR}
            roughness={0.95}
            metalness={0}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}

export const ThermalCloudField = ({ thermals }: ThermalCloudFieldProps) => (
  <>
    {thermals.map((thermalEntry) => (
      <ThermalCloud key={`${thermalEntry.id}-cloud`} thermalEntry={thermalEntry} />
    ))}
  </>
)
