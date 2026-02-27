import { DEFAULT_THERMAL_SHADER_PRESET, THERMAL_SHADER_PRESETS } from './thermalShaderPresets'
import type { ThermalShaderConfig, ThermalShaderPresetId } from './types'

export const useThermalShaderDebug = (): {
  presetId: ThermalShaderPresetId
  shaderConfig: ThermalShaderConfig
} => {
  return {
    presetId: DEFAULT_THERMAL_SHADER_PRESET,
    shaderConfig: THERMAL_SHADER_PRESETS[DEFAULT_THERMAL_SHADER_PRESET],
  }
}
