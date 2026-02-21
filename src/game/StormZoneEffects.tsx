import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import * as THREE from 'three'
import {
  FOG_FAR,
  FOG_NEAR,
  STORM_START_RATIO,
  TERRAIN_HEIGHT_BASE,
  TERRAIN_ISLAND_RADIUS,
  TERRAIN_SIZE,
} from './constants'

interface StormZoneEffectsProps {
  targetRef: RefObject<THREE.Group | null>
  fogRef: RefObject<THREE.Fog | null>
  ambientLightRef: RefObject<THREE.AmbientLight | null>
  sunLightRef: RefObject<THREE.DirectionalLight | null>
  fillLightRef: RefObject<THREE.DirectionalLight | null>
}

const STORM_SKY_RADIUS = 260
const BASE_AMBIENT_INTENSITY = 0.5
const BASE_SUN_INTENSITY = 1.8
const BASE_FILL_INTENSITY = 0.85

const RAIN_PARTICLE_COUNT = 3600
const RAIN_RADIUS = 36
const RAIN_SPAN = 42
const WATER_LEVEL_OFFSET = 1.8
const RAIN_PLAYER_OFFSET_Y = 8

const RAIN_VERTEX_SHADER = /* glsl */ `
  uniform float uSize;
  uniform float uIntensity;
  varying float vSeed;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = max(1.0, -mvPosition.z);
    float baseSize = uSize * (1.0 + uIntensity * 0.45);
    gl_PointSize = min(baseSize * (320.0 / dist), 18.0);
    vSeed = fract(position.x * 12.9898 + position.z * 78.233);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const RAIN_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uWidth;
  uniform float uLength;
  varying float vSeed;

  void main() {
    vec2 uv = gl_PointCoord;
    float centerX = abs(uv.x - 0.5);
    float widthMask = 1.0 - smoothstep(uWidth, uWidth + 0.06, centerX);

    float top = clamp(1.0 - uLength, 0.0, 0.95);
    float head = smoothstep(top, top + 0.08, uv.y);
    float tail = 1.0 - smoothstep(0.9, 1.0, uv.y);
    float lengthMask = head * tail;

    float alpha = widthMask * lengthMask * uOpacity * (0.72 + vSeed * 0.45);
    if (alpha <= 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`

const randomRainXz = () => {
  const angle = Math.random() * Math.PI * 2
  const radius = Math.sqrt(Math.random()) * RAIN_RADIUS
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
  }
}

export const StormZoneEffects = ({
  targetRef,
  fogRef,
  ambientLightRef,
  sunLightRef,
  fillLightRef,
}: StormZoneEffectsProps) => {
  const { gl } = useThree()
  const useShaderRain = !(gl as { isWebGPURenderer?: boolean }).isWebGPURenderer
  const overlayMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const lightningRef = useRef<THREE.DirectionalLight>(null)
  const rainPointsRef = useRef<THREE.Points>(null)
  const rainLinesRef = useRef<THREE.LineSegments>(null)
  const rainGeometryRef = useRef<THREE.BufferGeometry>(null)
  const rainLineGeometryRef = useRef<THREE.BufferGeometry>(null)
  const rainMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const rainLineMaterialRef = useRef<THREE.LineBasicMaterial>(null)

  const stormFactorRef = useRef(0)
  const flashTimeRef = useRef(0)
  const flashDurationRef = useRef(0)
  const flashPeakRef = useRef(0)

  const rainPositionsRef = useRef(new Float32Array(RAIN_PARTICLE_COUNT * 3))
  const rainSpeedsRef = useRef(new Float32Array(RAIN_PARTICLE_COUNT))
  const rainDriftRef = useRef(new Float32Array(RAIN_PARTICLE_COUNT * 2))
  const rainInitializedRef = useRef(false)

  const baseFogColor = useMemo(() => new THREE.Color('#8abdf0'), [])
  const stormFogColor = useMemo(() => new THREE.Color('#465462'), [])
  const rainUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#e8f2ff') },
      uOpacity: { value: 0 },
      uSize: { value: 14 },
      uWidth: { value: 0.1 },
      uLength: { value: 0.9 },
      uIntensity: { value: 0 },
    }),
    [],
  )
  const waterRadius = TERRAIN_SIZE * 0.9
  const sinkStartRadius =
    TERRAIN_ISLAND_RADIUS + (waterRadius - TERRAIN_ISLAND_RADIUS) * STORM_START_RATIO

  useFrame((_, delta) => {
    const target = targetRef.current
    const rainGeometry = rainGeometryRef.current
    const rainLineGeometry = rainLineGeometryRef.current
    if (!target) {
      return
    }
    if (useShaderRain && !rainGeometry) {
      return
    }
    if (!useShaderRain && !rainLineGeometry) {
      return
    }

    if (!rainInitializedRef.current) {
      const positions = rainPositionsRef.current
      const speeds = rainSpeedsRef.current
      const drift = rainDriftRef.current
      const linePositions = new Float32Array(RAIN_PARTICLE_COUNT * 2 * 3)

      for (let i = 0; i < RAIN_PARTICLE_COUNT; i += 1) {
        const p = randomRainXz()
        const idx = i * 3
        const didx = i * 2
        positions[idx] = p.x
        positions[idx + 1] = Math.random() * RAIN_SPAN
        positions[idx + 2] = p.z
        speeds[i] = 20 + Math.random() * 34
        drift[didx] = (Math.random() - 0.5) * 0.28
        drift[didx + 1] = (Math.random() - 0.5) * 0.28
      }

      rainGeometry?.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      rainLineGeometry?.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
      rainInitializedRef.current = true
    }

    const distance = Math.hypot(target.position.x, target.position.z)
    const zoneFactor = THREE.MathUtils.clamp(
      (distance - sinkStartRadius) / Math.max(waterRadius - sinkStartRadius, 1),
      0,
      1,
    )
    stormFactorRef.current = THREE.MathUtils.lerp(
      stormFactorRef.current,
      zoneFactor,
      1 - Math.exp(-3.6 * delta),
    )
    const storm = stormFactorRef.current
    const stormVisual = zoneFactor > 0 ? Math.max(Math.sqrt(storm), 0.25) : 0
    const rainCountFactor = THREE.MathUtils.clamp(storm, 0, 1)
    const visibleDrops = Math.floor(RAIN_PARTICLE_COUNT * rainCountFactor)

    if (fogRef.current) {
      fogRef.current.color.lerpColors(baseFogColor, stormFogColor, storm * 0.95)
      fogRef.current.near = THREE.MathUtils.lerp(FOG_NEAR, FOG_NEAR * 0.7, storm)
      fogRef.current.far = THREE.MathUtils.lerp(FOG_FAR, FOG_FAR * 0.52, storm)
    }

    if (overlayMaterialRef.current) {
      overlayMaterialRef.current.opacity = stormVisual * 0.62
    }
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = THREE.MathUtils.lerp(
        BASE_AMBIENT_INTENSITY,
        0.18,
        stormVisual,
      )
    }
    if (sunLightRef.current) {
      sunLightRef.current.intensity = THREE.MathUtils.lerp(BASE_SUN_INTENSITY, 0.55, stormVisual)
    }
    if (fillLightRef.current) {
      fillLightRef.current.intensity = THREE.MathUtils.lerp(BASE_FILL_INTENSITY, 0.3, stormVisual)
    }

    if (storm > 0.2 && flashTimeRef.current <= 0) {
      const flashChancePerSecond = THREE.MathUtils.lerp(0.15, 1.7, storm)
      if (Math.random() < flashChancePerSecond * delta) {
        flashTimeRef.current = 0.08 + Math.random() * 0.12
        flashDurationRef.current = flashTimeRef.current
        flashPeakRef.current = THREE.MathUtils.lerp(1.8, 4.6, storm) * (0.75 + Math.random() * 0.5)
      }
    }

    let flashIntensity = 0
    if (flashTimeRef.current > 0) {
      flashTimeRef.current = Math.max(0, flashTimeRef.current - delta)
      const flashT = 1 - flashTimeRef.current / Math.max(flashDurationRef.current, Number.EPSILON)
      const pulse = 1 - Math.abs(flashT * 2 - 1)
      flashIntensity = flashPeakRef.current * pulse
    }
    if (lightningRef.current) {
      lightningRef.current.intensity = flashIntensity
    }

    const waterLevel = TERRAIN_HEIGHT_BASE - WATER_LEVEL_OFFSET
    const rainTopWorldY = Math.max(
      waterLevel + RAIN_SPAN,
      (target.position.y + RAIN_PLAYER_OFFSET_Y),
    )
    const rainTopLocalY = rainTopWorldY - waterLevel
    if (rainPointsRef.current) {
      rainPointsRef.current.position.copy(target.position)
      rainPointsRef.current.position.y = waterLevel
      rainPointsRef.current.geometry.setDrawRange(0, visibleDrops)
    }
    if (rainLinesRef.current) {
      rainLinesRef.current.position.copy(target.position)
      rainLinesRef.current.position.y = waterLevel
      rainLinesRef.current.geometry.setDrawRange(0, visibleDrops * 2)
    }
    if (useShaderRain && rainMaterialRef.current) {
      rainMaterialRef.current.uniforms.uOpacity.value = stormVisual * 0.9
      rainMaterialRef.current.uniforms.uIntensity.value = stormVisual
      rainMaterialRef.current.uniforms.uSize.value = THREE.MathUtils.lerp(11, 16, stormVisual)
      rainMaterialRef.current.uniforms.uWidth.value = THREE.MathUtils.lerp(0.12, 0.08, stormVisual)
      rainMaterialRef.current.uniforms.uLength.value = THREE.MathUtils.lerp(0.82, 0.95, stormVisual)
    }
    if (!useShaderRain && rainLineMaterialRef.current) {
      rainLineMaterialRef.current.opacity = stormVisual * 0.95
    }

    const positions = rainPositionsRef.current
    const speeds = rainSpeedsRef.current
    const drift = rainDriftRef.current
    const rainSpeedFactor = THREE.MathUtils.lerp(0.6, 1.35, stormVisual)
    const lineLength = THREE.MathUtils.lerp(0.7, 1.9, stormVisual)
    const linePositions = !useShaderRain
      ? ((rainLineGeometry?.attributes.position as THREE.BufferAttribute).array as Float32Array)
      : null

    for (let i = 0; i < RAIN_PARTICLE_COUNT; i += 1) {
      const idx = i * 3
      const didx = i * 2
      positions[idx + 1] -= speeds[i] * rainSpeedFactor * delta

      const worldY =
        (rainPointsRef.current?.position.y ?? 0) + positions[idx + 1]
      if (worldY <= waterLevel) {
        const p = randomRainXz()
        positions[idx] = p.x
        positions[idx + 1] = rainTopLocalY
        positions[idx + 2] = p.z
        speeds[i] = 20 + Math.random() * 34
        drift[didx] = (Math.random() - 0.5) * 0.28
        drift[didx + 1] = (Math.random() - 0.5) * 0.28
      }

      if (!useShaderRain && linePositions) {
        const lidx = i * 6
        const headX = positions[idx]
        const headY = positions[idx + 1]
        const headZ = positions[idx + 2]
        const tailX = headX
        const tailY = headY + lineLength * (0.85 + (i % 7) * 0.03)
        const tailZ = headZ
        linePositions[lidx] = headX
        linePositions[lidx + 1] = headY
        linePositions[lidx + 2] = headZ
        linePositions[lidx + 3] = tailX
        linePositions[lidx + 4] = tailY
        linePositions[lidx + 5] = tailZ
      }
    }

    if (useShaderRain) {
      const positionAttribute = rainGeometry?.attributes.position as THREE.BufferAttribute
      positionAttribute.needsUpdate = true
    } else {
      const linePositionAttribute = rainLineGeometry?.attributes.position as THREE.BufferAttribute
      linePositionAttribute.needsUpdate = true
    }
  })

  return (
    <>
      <mesh frustumCulled={false}>
        <sphereGeometry args={[STORM_SKY_RADIUS, 40, 24]} />
        <meshBasicMaterial
          ref={overlayMaterialRef}
          color="#1b2433"
          side={THREE.BackSide}
          transparent
          opacity={0}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      <directionalLight ref={lightningRef} color="#d8e7ff" intensity={0} position={[6, 11, 4]} />

      {useShaderRain ? (
        <points ref={rainPointsRef} frustumCulled={false}>
          <bufferGeometry ref={rainGeometryRef} />
          <shaderMaterial
            ref={rainMaterialRef}
            uniforms={rainUniforms}
            vertexShader={RAIN_VERTEX_SHADER}
            fragmentShader={RAIN_FRAGMENT_SHADER}
            transparent
            blending={THREE.AdditiveBlending}
            depthTest={false}
            depthWrite={false}
          />
        </points>
      ) : (
        <lineSegments ref={rainLinesRef} frustumCulled={false}>
          <bufferGeometry ref={rainLineGeometryRef} />
          <lineBasicMaterial
            ref={rainLineMaterialRef}
            color="#e8f2ff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthTest={false}
            depthWrite={false}
          />
        </lineSegments>
      )}
    </>
  )
}
