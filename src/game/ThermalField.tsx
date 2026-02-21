import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { THERMAL_BASE_Y, THERMAL_FADE_IN_SECONDS, THERMAL_FADE_OUT_SECONDS } from './constants'
import { createThermalCartoonMaterial } from './materials/createThermalCartoonMaterial'
import { createThermalCartoonNodeMaterial } from './materials/createThermalCartoonNodeMaterial'
import { DEFAULT_THERMAL_SHADER_PRESET, THERMAL_SHADER_PRESETS } from './thermalShaderPresets'
import type { ThermalShaderConfig } from './types'
import type { ThermalVisualEntry } from './thermals'
import { getThermalHeight, getThermalStrengthNormalized } from './thermals'

interface ThermalFieldProps {
  thermals: ThermalVisualEntry[]
  shaderConfig: ThermalShaderConfig
  gameSpeed?: number
}

interface ThermalVisualProps {
  thermalEntry: ThermalVisualEntry
  shaderConfig: ThermalShaderConfig
  gameSpeed: number
}

const FALLBACK_SHADER_CONFIG = THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET]

const asFinite = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const asColorString = (value: unknown, fallback: string) => {
  try {
    return `#${new THREE.Color(value as THREE.ColorRepresentation).getHexString()}`
  } catch {
    return fallback
  }
}

const ThermalVisual = ({ thermalEntry, shaderConfig, gameSpeed }: ThermalVisualProps) => {
  const { gl } = useThree()
  const meshRef = useRef<THREE.Mesh>(null)
  const shaderMaterialRef = useRef<THREE.ShaderMaterial | null>(null)
  const thermal = thermalEntry.thermal
  const strengthNorm = useMemo(
    () => getThermalStrengthNormalized(thermal),
    [thermalEntry],
  )
  const safeConfig = useMemo<ThermalShaderConfig>(
    () => ({
      opacityBase: asFinite(shaderConfig.opacityBase, FALLBACK_SHADER_CONFIG.opacityBase),
      speedMin: asFinite(shaderConfig.speedMin, FALLBACK_SHADER_CONFIG.speedMin),
      speedMax: asFinite(shaderConfig.speedMax, FALLBACK_SHADER_CONFIG.speedMax),
      flowDirection: asFinite(shaderConfig.flowDirection, FALLBACK_SHADER_CONFIG.flowDirection),
      ascentBoost: asFinite(shaderConfig.ascentBoost, FALLBACK_SHADER_CONFIG.ascentBoost),
      noiseScale: asFinite(shaderConfig.noiseScale, FALLBACK_SHADER_CONFIG.noiseScale),
      edgeSoftness: asFinite(shaderConfig.edgeSoftness, FALLBACK_SHADER_CONFIG.edgeSoftness),
      bandCount: asFinite(shaderConfig.bandCount, FALLBACK_SHADER_CONFIG.bandCount),
      colorLow: asColorString(shaderConfig.colorLow, FALLBACK_SHADER_CONFIG.colorLow),
      colorHigh: asColorString(shaderConfig.colorHigh, FALLBACK_SHADER_CONFIG.colorHigh),
      stripeFrequency: asFinite(
        shaderConfig.stripeFrequency,
        FALLBACK_SHADER_CONFIG.stripeFrequency,
      ),
      stripeWidth: asFinite(shaderConfig.stripeWidth, FALLBACK_SHADER_CONFIG.stripeWidth),
      stripeContrast: asFinite(shaderConfig.stripeContrast, FALLBACK_SHADER_CONFIG.stripeContrast),
      wobbleFrequency: asFinite(
        shaderConfig.wobbleFrequency,
        FALLBACK_SHADER_CONFIG.wobbleFrequency,
      ),
      wobbleAmplitude: asFinite(
        shaderConfig.wobbleAmplitude,
        FALLBACK_SHADER_CONFIG.wobbleAmplitude,
      ),
      rimBoost: asFinite(shaderConfig.rimBoost, FALLBACK_SHADER_CONFIG.rimBoost),
      alphaBoost: asFinite(shaderConfig.alphaBoost, FALLBACK_SHADER_CONFIG.alphaBoost),
    }),
    [shaderConfig],
  )
  const useShaderMaterial = !(gl as { isWebGPURenderer?: boolean }).isWebGPURenderer
  const material = useMemo(
    () => {
      const speed = THREE.MathUtils.lerp(
        safeConfig.speedMin,
        safeConfig.speedMax,
        strengthNorm,
      ) * gameSpeed

      if (!useShaderMaterial) {
        return createThermalCartoonNodeMaterial({
          opacityBase: safeConfig.opacityBase,
          speed,
          flowDirection: safeConfig.flowDirection,
          ascentBoost: safeConfig.ascentBoost,
          noiseScale: safeConfig.noiseScale,
          edgeSoftness: safeConfig.edgeSoftness,
          bandCount: safeConfig.bandCount,
          stripeFrequency: safeConfig.stripeFrequency,
          stripeWidth: safeConfig.stripeWidth,
          stripeContrast: safeConfig.stripeContrast,
          wobbleFrequency: safeConfig.wobbleFrequency,
          wobbleAmplitude: safeConfig.wobbleAmplitude,
          rimBoost: safeConfig.rimBoost,
          alphaBoost: safeConfig.alphaBoost,
          strengthNorm,
          colorLow: safeConfig.colorLow,
          colorHigh: safeConfig.colorHigh,
        })
      }

      return createThermalCartoonMaterial({
        opacityBase: safeConfig.opacityBase,
        speed,
        flowDirection: safeConfig.flowDirection,
        ascentBoost: safeConfig.ascentBoost,
        noiseScale: safeConfig.noiseScale,
        edgeSoftness: safeConfig.edgeSoftness,
        bandCount: safeConfig.bandCount,
        stripeFrequency: safeConfig.stripeFrequency,
        stripeWidth: safeConfig.stripeWidth,
        stripeContrast: safeConfig.stripeContrast,
        wobbleFrequency: safeConfig.wobbleFrequency,
        wobbleAmplitude: safeConfig.wobbleAmplitude,
        rimBoost: safeConfig.rimBoost,
        alphaBoost: safeConfig.alphaBoost,
        strengthNorm,
        colorLow: safeConfig.colorLow,
        colorHigh: safeConfig.colorHigh,
      })
    },
    [gameSpeed, safeConfig, strengthNorm, useShaderMaterial],
  )

  useEffect(() => {
    shaderMaterialRef.current = material instanceof THREE.ShaderMaterial ? material : null
    return () => {
      material.dispose()
      shaderMaterialRef.current = null
    }
  }, [material])

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    if (!mesh) {
      return
    }

    const height = getThermalHeight(thermal)
    const centerY = THERMAL_BASE_Y + height / 2
    mesh.position.set(thermal.x, centerY, thermal.z)
    mesh.scale.set(1, height, 1)

    if (shaderMaterialRef.current) {
      shaderMaterialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }

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
    const fade = Math.min(fadeIn, fadeOut)
    ;(mesh.material as THREE.Material).opacity = fade
  })

  return (
    <mesh ref={meshRef} material={material}>
      <cylinderGeometry args={[thermal.radius, thermal.radius, 1, 32, 1, true]} />
    </mesh>
  )
}

export const ThermalField = ({ thermals, shaderConfig, gameSpeed = 1 }: ThermalFieldProps) => (
  <>
    {thermals.map((thermalEntry) => (
      <ThermalVisual
        key={thermalEntry.id}
        thermalEntry={thermalEntry}
        shaderConfig={shaderConfig}
        gameSpeed={gameSpeed}
      />
    ))}
  </>
)
