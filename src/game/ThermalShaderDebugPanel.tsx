import { button, useControls } from 'leva'
import { useEffect } from 'react'
import { DEFAULT_THERMAL_SHADER_PRESET, THERMAL_SHADER_PRESETS } from './thermalShaderPresets'
import type { ThermalShaderConfig, ThermalShaderPresetId } from './types'

const PRESET_OPTIONS: Record<string, ThermalShaderPresetId> = {
  Cotton: 'cotton',
  Spiral: 'spiral',
  Plasma: 'plasma',
}

const SHADER_CONFIG_KEYS: Array<keyof ThermalShaderConfig> = [
  'opacityBase',
  'speedMin',
  'speedMax',
  'flowDirection',
  'ascentBoost',
  'noiseScale',
  'edgeSoftness',
  'bandCount',
  'colorLow',
  'colorHigh',
  'stripeFrequency',
  'stripeWidth',
  'stripeContrast',
  'wobbleFrequency',
  'wobbleAmplitude',
  'rimBoost',
  'alphaBoost',
]

export const useThermalShaderDebug = (): {
  presetId: ThermalShaderPresetId
  shaderConfig: ThermalShaderConfig
} => {
  const { presetId } = useControls('Thermal Preset', {
    presetId: {
      value: DEFAULT_THERMAL_SHADER_PRESET,
      options: PRESET_OPTIONS,
    },
  })

  const [controls, setControls, getControlValue] = useControls(
    'Thermal Shader',
    () => ({
      colorLow: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].colorLow },
      colorHigh: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].colorHigh },
      bandCount: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].bandCount, min: 3, max: 20, step: 1 },
      edgeSoftness: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].edgeSoftness, min: 0.05, max: 0.5, step: 0.01 },
      opacityBase: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].opacityBase, min: 0.05, max: 0.5, step: 0.01 },
      alphaBoost: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].alphaBoost, min: 0.05, max: 0.8, step: 0.01 },
      rimBoost: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].rimBoost, min: 0.05, max: 0.6, step: 0.01 },
      flowDirection: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].flowDirection, min: -1, max: 1, step: 2 },
      ascentBoost: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].ascentBoost, min: 0.5, max: 3, step: 0.01 },
      speedMin: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].speedMin, min: 0.1, max: 2.5, step: 0.01 },
      speedMax: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].speedMax, min: 0.2, max: 3.2, step: 0.01 },
      noiseScale: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].noiseScale, min: 1, max: 12, step: 0.1 },
      stripeFrequency: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].stripeFrequency, min: 8, max: 80, step: 1 },
      stripeWidth: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].stripeWidth, min: 0.03, max: 0.45, step: 0.01 },
      stripeContrast: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].stripeContrast, min: 0.1, max: 0.9, step: 0.01 },
      wobbleFrequency: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].wobbleFrequency, min: 2, max: 32, step: 0.5 },
      wobbleAmplitude: { value: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET].wobbleAmplitude, min: 0.05, max: 0.9, step: 0.01 },
    }),
  ) as unknown as [
    ThermalShaderConfig,
    (value: Partial<ThermalShaderConfig>) => void,
    (path: keyof ThermalShaderConfig) => unknown,
  ]
  useControls(
    'Thermal Export',
    () => ({
      copyPresetJson: button(async () => {
        const liveConfig = SHADER_CONFIG_KEYS.reduce((acc, key) => {
          acc[key] = getControlValue(key) as never
          return acc
        }, {} as ThermalShaderConfig)

        const exportPayload = {
          presetId: presetId as ThermalShaderPresetId,
          ...liveConfig,
        }
        const json = JSON.stringify(exportPayload, null, 2)

        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(json)
          } else {
            throw new Error('Clipboard API unavailable')
          }
        } catch {
          window.prompt('Copie ce preset JSON :', json)
        }
      }),
    }),
    [presetId, getControlValue],
  )

  useEffect(() => {
    setControls(THERMAL_SHADER_PRESETS[presetId as ThermalShaderPresetId])
  }, [presetId, setControls])

  return {
    presetId: presetId as ThermalShaderPresetId,
    shaderConfig: controls,
  }
}
