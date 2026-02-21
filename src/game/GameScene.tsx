import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  FOG_COLOR,
  FOG_FAR,
  FOG_NEAR,
  SKY_HORIZON_COLOR,
  SKY_TOP_COLOR,
  TERRAIN_HEIGHT_BASE,
  TERRAIN_SIZE,
  THERMAL_COUNT,
  THERMAL_RESEED_SECONDS,
} from './constants'
import { FollowCamera } from './FollowCamera'
import { useGameSpeedDebug } from './GameSpeedDebug'
import { StormZoneEffects } from './StormZoneEffects'
import { ThermalCloudField } from './ThermalCloudField'
import { useThermalShaderDebug } from './ThermalShaderDebugPanel'
import { Player } from './Player'
import { ThermalField } from './ThermalField'
import { createProceduralIslandTerrain } from './terrain'
import { generateThermals } from './thermals'

const SKY_RADIUS = 260

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
  const terrain = useMemo(() => createProceduralIslandTerrain(), [])
  const gameSpeed = useGameSpeedDebug()
  const { shaderConfig } = useThermalShaderDebug()
  const [thermalSeedStep, setThermalSeedStep] = useState(0)
  const thermals = useMemo(
    () =>
      generateThermals(
        THERMAL_COUNT,
        terrain.getHeightAt,
        terrain.islandRadius,
        5000 + thermalSeedStep * 131,
      ),
    [terrain, thermalSeedStep],
  )

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
      />

      <Player
        playerRef={playerRef}
        terrainHeightAt={terrain.getHeightAt}
        thermals={thermals}
        gameSpeed={gameSpeed}
      />
      <FollowCamera targetRef={playerRef} gameSpeed={gameSpeed} />
      <ThermalField thermals={thermals} shaderConfig={shaderConfig} gameSpeed={gameSpeed} />
      <ThermalCloudField thermals={thermals} />

      <mesh geometry={terrain.geometry} receiveShadow>
        <meshStandardMaterial color="#5f7d5d" roughness={0.95} metalness={0.02} flatShading />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, TERRAIN_HEIGHT_BASE - 1.8, 0]}
        receiveShadow
      >
        <circleGeometry args={[TERRAIN_SIZE * 0.9, 96]} />
        <meshStandardMaterial color="#6aa6d9" roughness={0.7} metalness={0.05} />
      </mesh>
    </>
  )
}
