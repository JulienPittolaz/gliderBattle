import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  FOG_COLOR,
  FOG_FAR,
  FOG_NEAR,
  SKY_HORIZON_COLOR,
  SKY_TOP_COLOR,
  TERRAIN_INLAND_LAKE_WATER_COLOR,
  TERRAIN_SIZE,
  TERRAIN_WATER_LEVEL,
  THERMAL_COUNT,
  THERMAL_DESPAWN_DELAY_MAX_SECONDS,
  THERMAL_FADE_OUT_SECONDS,
  THERMAL_RESEED_SECONDS,
} from './constants'
import { FollowCamera } from './FollowCamera'
import { useGameSpeedDebug } from './GameSpeedDebug'
import { useRainPostFxDebug } from './RainPostFxDebug'
import { StormPostFX } from './StormPostFX'
import { StormZoneEffects } from './StormZoneEffects'
import { ThermalCloudField } from './ThermalCloudField'
import { useThermalShaderDebug } from './ThermalShaderDebugPanel'
import { useMultiplayerDebug } from './MultiplayerDebug'
import { Player } from './Player'
import { RemotePlayers } from './RemotePlayers'
import { ThermalField } from './ThermalField'
import { TerrainForest } from './TerrainForest'
import { createProceduralIslandTerrain } from './terrain'
import { generateThermals } from './thermals'
import type { ThermalVisualEntry } from './thermals'
import { useMultiplayerSession } from '../net/useMultiplayerSession'

const SKY_RADIUS = 260
const hashToUnit = (value: string) => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

const SkyDome = () => {
  const geometry = useMemo(() => {
    const sphere = new THREE.SphereGeometry(SKY_RADIUS, 40, 24)
    const position = sphere.attributes.position as THREE.BufferAttribute

    const top = new THREE.Color(SKY_TOP_COLOR)
    const horizon = new THREE.Color(SKY_HORIZON_COLOR)
    const mixed = new THREE.Color()
    const colors: number[] = []

    for (let i = 0; i < position.count; i += 1) {
      const y = position.getY(i)
      const t = THREE.MathUtils.clamp((y + SKY_RADIUS) / (2 * SKY_RADIUS), 0, 1)
      mixed.copy(horizon).lerp(top, t)
      colors.push(mixed.r, mixed.g, mixed.b)
    }

    sphere.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return sphere
  }, [])

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial side={THREE.BackSide} vertexColors depthWrite={false} fog={false} />
    </mesh>
  )
}

export const GameScene = () => {
  const playerRef = useRef<THREE.Group>(null)
  const fogRef = useRef<THREE.Fog>(null)
  const ambientLightRef = useRef<THREE.AmbientLight>(null)
  const sunLightRef = useRef<THREE.DirectionalLight>(null)
  const fillLightRef = useRef<THREE.DirectionalLight>(null)
  const stormFactorRef = useRef(0)
  const terrain = useMemo(() => createProceduralIslandTerrain(), [])
  const gameSpeed = useGameSpeedDebug()
  const multiplayerDebug = useMultiplayerDebug()
  const rainPostFxConfig = useRainPostFxDebug()
  const { shaderConfig } = useThermalShaderDebug()
  const multiplayer = useMultiplayerSession()
  const [thermalSeedStep, setThermalSeedStep] = useState(0)
  const localThermals = useMemo(
    () =>
      generateThermals(
        THERMAL_COUNT,
        terrain.getHeightAt,
        terrain.islandRadius,
        5000 + thermalSeedStep * 131,
      ),
    [terrain, thermalSeedStep],
  )
  const thermals = multiplayer.thermals ?? localThermals
  const [thermalVisuals, setThermalVisuals] = useState<ThermalVisualEntry[]>(() => {
    return thermals.map((thermal) => ({
      id: thermal.id,
      thermal,
      appearAt: thermal.activationAt,
      disappearAt: null,
    }))
  })

  useEffect(() => {
    const now = Date.now() * 0.001

    setThermalVisuals((previous) => {
      const previousById = new Map(previous.map((entry) => [entry.id, entry]))
      const thermalById = new Map(thermals.map((thermal) => [thermal.id, thermal]))
      const nextIds = new Set(thermals.map((thermal) => thermal.id))

      const persistedOrFading = previous
        .map((entry) => {
          if (nextIds.has(entry.id)) {
            return {
              ...entry,
              thermal: thermalById.get(entry.id) ?? entry.thermal,
            }
          }

          if (entry.disappearAt === null) {
            const despawnDelay = hashToUnit(entry.id) * THERMAL_DESPAWN_DELAY_MAX_SECONDS
            return { ...entry, disappearAt: now + despawnDelay }
          }

          return entry
        })
        .filter(
          (entry) =>
            entry.disappearAt === null || now - entry.disappearAt <= THERMAL_FADE_OUT_SECONDS,
        )

      const newEntries = thermals
        .filter((thermal) => !previousById.has(thermal.id))
        .map((thermal) => ({
          id: thermal.id,
          thermal,
          appearAt: thermal.activationAt,
          disappearAt: null,
        }))

      return [...persistedOrFading, ...newEntries]
    })
  }, [thermals])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now() * 0.001
      setThermalVisuals((previous) =>
        previous.filter(
          (entry) =>
            entry.disappearAt === null || now - entry.disappearAt <= THERMAL_FADE_OUT_SECONDS,
        ),
      )
    }, 400)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setThermalSeedStep((step) => step + 1)
    }, THERMAL_RESEED_SECONDS * 1000)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <>
      <color attach="background" args={[SKY_HORIZON_COLOR]} />
      <fog ref={fogRef} attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />
      <SkyDome />

      <ambientLight ref={ambientLightRef} color="#b8cdfc" intensity={0.5} />
      <directionalLight ref={sunLightRef} color="#fff2c1" intensity={1.8} position={[5, 8, 3]} />
      <directionalLight ref={fillLightRef} color="#84a9ff" intensity={0.85} position={[-4, 3, -6]} />
      <StormZoneEffects
        targetRef={playerRef}
        fogRef={fogRef}
        ambientLightRef={ambientLightRef}
        sunLightRef={sunLightRef}
        fillLightRef={fillLightRef}
        stormFactorRef={stormFactorRef}
        rain3DMultiplier={
          rainPostFxConfig.enabled
            ? THREE.MathUtils.clamp(rainPostFxConfig.mix3DRain, 0, 0.3)
            : 1
        }
      />
      <StormPostFX stormFactorRef={stormFactorRef} config={rainPostFxConfig} />

      <Player
        playerRef={playerRef}
        terrainHeightAt={terrain.getHeightAt}
        thermals={thermals}
        gameSpeed={gameSpeed}
        onPose={multiplayer.setLocalPose}
      />
      <RemotePlayers
        players={multiplayer.remotePlayers}
        smoothingMode={multiplayerDebug.smoothingMode}
        interpDelayMs={multiplayerDebug.interpDelayMs}
        maxExtrapolationMs={multiplayerDebug.maxExtrapolationMs}
      />
      <FollowCamera targetRef={playerRef} gameSpeed={gameSpeed} />
      <ThermalField thermals={thermalVisuals} shaderConfig={shaderConfig} gameSpeed={gameSpeed} />
      <ThermalCloudField thermals={thermalVisuals} />

      <mesh geometry={terrain.geometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0.02} flatShading />
      </mesh>
      <TerrainForest instances={terrain.forestInstances} />
      {terrain.inlandLake ? (
        <>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[terrain.inlandLake.x, terrain.inlandLake.waterY + 0.02, terrain.inlandLake.z]}
            scale={[1.08, 1, 0.92]}
            receiveShadow
          >
            <circleGeometry args={[terrain.inlandLake.radius, 40]} />
            <meshStandardMaterial
              color={TERRAIN_INLAND_LAKE_WATER_COLOR}
              roughness={0.38}
              metalness={0.04}
              transparent
              opacity={0.92}
            />
          </mesh>
        </>
      ) : null}

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, TERRAIN_WATER_LEVEL, 0]}
        receiveShadow
      >
        <circleGeometry args={[TERRAIN_SIZE * 0.9, 96]} />
        <meshStandardMaterial color="#6aa6d9" roughness={0.7} metalness={0.05} />
      </mesh>
    </>
  )
}
