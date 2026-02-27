export interface SpeedPostFxConfig {
  enabled: boolean
  useComposer: boolean
  intensity: number
  attack: number
  release: number
  radialSamples: number
  blurStrength: number
  centerX: number
  centerY: number
  vignetteBoost: number
  chromaticBoost: number
  fallbackSmearDensity: number
  fallbackSmearRadiusMin: number
  fallbackSmearRadiusMax: number
}

const SPEED_POST_FX_DEFAULTS: SpeedPostFxConfig = {
  enabled: true,
  useComposer: true,
  intensity: 1.05,
  attack: 0.12,
  release: 0.2,
  radialSamples: 10,
  blurStrength: 0.95,
  centerX: 0.5,
  centerY: 0.5,
  vignetteBoost: 0.46,
  chromaticBoost: 0.28,
  fallbackSmearDensity: 160,
  fallbackSmearRadiusMin: 0.58,
  fallbackSmearRadiusMax: 0.98,
}

export const useSpeedPostFxDebug = (): SpeedPostFxConfig => {
  return SPEED_POST_FX_DEFAULTS
}
