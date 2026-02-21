import type * as THREE from 'three'

export interface PlayerInput {
  yawLeft: boolean
  yawRight: boolean
  speedbar: boolean
}

export interface PlayerState {
  position: THREE.Vector3
  yaw: number
}

export type ThermalShaderPresetId = 'cotton' | 'spiral' | 'plasma'

export interface ThermalShaderConfig {
  opacityBase: number
  speedMin: number
  speedMax: number
  flowDirection: number
  ascentBoost: number
  noiseScale: number
  edgeSoftness: number
  bandCount: number
  colorLow: string
  colorHigh: string
  stripeFrequency: number
  stripeWidth: number
  stripeContrast: number
  wobbleFrequency: number
  wobbleAmplitude: number
  rimBoost: number
  alphaBoost: number
}
