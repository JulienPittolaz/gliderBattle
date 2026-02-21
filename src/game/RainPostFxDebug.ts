import { button, useControls } from 'leva'

export interface RainPostFxConfig {
  enabled: boolean
  useComposer: boolean
  intensityMultiplier: number
  fillRate: number
  dryRate: number
  startDensityRatio: number
  impactFrequency: number
  impactSharpness: number
  dropDensity: number
  dropSizeMin: number
  dropSizeMax: number
  distortionStrength: number
  highlightStrength: number
  blurMix: number
  vignetteStrength: number
  tintColor: string
  mix3DRain: number
}

const CONFIG_KEYS: Array<keyof RainPostFxConfig> = [
  'enabled',
  'useComposer',
  'intensityMultiplier',
  'fillRate',
  'dryRate',
  'startDensityRatio',
  'impactFrequency',
  'impactSharpness',
  'dropDensity',
  'dropSizeMin',
  'dropSizeMax',
  'distortionStrength',
  'highlightStrength',
  'blurMix',
  'vignetteStrength',
  'tintColor',
  'mix3DRain',
]

export const useRainPostFxDebug = (): RainPostFxConfig => {
  const [controls, , getControlValue] = useControls(
    'Rain PostFX',
    () => ({
      enabled: { value: true },
      useComposer: { value: true },
      intensityMultiplier: { value: 1.35, min: 0, max: 2.5, step: 0.01 },
      fillRate: { value: 0.1, min: 0.02, max: 1, step: 0.01 },
      dryRate: { value: 0.1, min: 0.01, max: 0.8, step: 0.01 },
      startDensityRatio: { value: 0.02, min: 0, max: 0.6, step: 0.01 },
      impactFrequency: { value: 1.2, min: 0.2, max: 4, step: 0.01 },
      impactSharpness: { value: 0.9, min: 0.1, max: 1.5, step: 0.01 },
      dropDensity: { value: 38, min: 20, max: 260, step: 1 },
      dropSizeMin: { value: 0.012, min: 0.002, max: 0.035, step: 0.001 },
      dropSizeMax: { value: 0.046, min: 0.005, max: 0.08, step: 0.001 },
      distortionStrength: { value: 0.072, min: 0, max: 0.12, step: 0.001 },
      highlightStrength: { value: 0.82, min: 0, max: 1, step: 0.01 },
      blurMix: { value: 0.32, min: 0, max: 0.5, step: 0.01 },
      vignetteStrength: { value: 0.46, min: 0, max: 1, step: 0.01 },
      tintColor: { value: '#d9ecff' },
      mix3DRain: { value: 0.16, min: 0, max: 1, step: 0.01 },
    }),
  ) as unknown as [
    RainPostFxConfig,
    (value: Partial<RainPostFxConfig>) => void,
    (path: keyof RainPostFxConfig) => unknown,
  ]

  useControls(
    'Rain PostFX Export',
    () => ({
      copyPresetJson: button(async () => {
        const payload = CONFIG_KEYS.reduce((acc, key) => {
          acc[key] = getControlValue(key) as never
          return acc
        }, {} as RainPostFxConfig)
        const json = JSON.stringify(payload, null, 2)

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
    [getControlValue],
  )

  return controls
}
