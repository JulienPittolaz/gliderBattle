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

export const useRainPostFxDebug = (): RainPostFxConfig => {
  return {
    enabled: true,
    useComposer: true,
    intensityMultiplier: 1.35,
    fillRate: 0.1,
    dryRate: 0.1,
    startDensityRatio: 0.02,
    impactFrequency: 1.2,
    impactSharpness: 0.9,
    dropDensity: 38,
    dropSizeMin: 0.012,
    dropSizeMax: 0.046,
    distortionStrength: 0.072,
    highlightStrength: 0.82,
    blurMix: 0.32,
    vignetteStrength: 0.46,
    tintColor: '#d9ecff',
    mix3DRain: 0.16,
  }
}
