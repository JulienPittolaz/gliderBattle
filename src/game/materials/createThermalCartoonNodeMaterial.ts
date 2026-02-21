import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { color, float, floor, length, mix, sin, smoothstep, time, uniform, uv, vec2 } from 'three/tsl'

export interface ThermalCartoonNodeMaterialOptions {
  opacityBase: number
  speed: number
  flowDirection: number
  ascentBoost: number
  noiseScale: number
  edgeSoftness: number
  bandCount: number
  stripeFrequency: number
  stripeWidth: number
  stripeContrast: number
  wobbleFrequency: number
  wobbleAmplitude: number
  rimBoost: number
  alphaBoost: number
  strengthNorm: number
  colorLow: string
  colorHigh: string
}

export const createThermalCartoonNodeMaterial = (
  options: ThermalCartoonNodeMaterialOptions,
) => {
  const material = new MeshBasicNodeMaterial()
  material.transparent = true
  material.depthWrite = false
  material.side = THREE.DoubleSide

  const uvNode = uv()
  const centered = uvNode.sub(vec2(0.5, 0.5))
  const radial = float(1).sub(length(centered).mul(2)).clamp()

  const speedNode = uniform(options.speed)
  const flow = uvNode.y.add(
    time.mul(speedNode).mul(uniform(options.flowDirection)).mul(uniform(options.ascentBoost)),
  )
  const noiseScaleNode = uniform(options.noiseScale)
  const strengthNode = uniform(options.strengthNorm)

  const stripeFrequencyNode = uniform(options.stripeFrequency)
  const stripeWidthNode = uniform(options.stripeWidth)
  const stripeContrastNode = uniform(options.stripeContrast)
  const wobbleFrequencyNode = uniform(options.wobbleFrequency)
  const wobbleAmplitudeNode = uniform(options.wobbleAmplitude)

  const stripe = sin(flow.mul(stripeFrequencyNode).add(uvNode.x.mul(noiseScaleNode.mul(2.2))))
    .mul(0.5)
    .add(0.5)
  const stripeThreshold = float(1).sub(stripeWidthNode.clamp(0.01, 0.95))
  const stripeBand = smoothstep(stripeThreshold, stripeThreshold.add(0.08), stripe)

  const wobble = sin(uvNode.x.mul(wobbleFrequencyNode).add(time.mul(speedNode.mul(0.9))))
    .mul(0.5)
    .add(0.5)
  const upwardRamp = smoothstep(0.12, 1, uvNode.y).mul(
    uniform(0.2).add(uniform(options.ascentBoost).mul(0.25)),
  )

  const flameMask = radial
    .add(stripeBand.sub(0.5).mul(stripeContrastNode))
    .add(wobble.sub(0.5).mul(wobbleAmplitudeNode))
    .add(upwardRamp)
    .clamp()

  const bandCountSafe = Math.max(options.bandCount, 2)
  const bandNode = floor(flameMask.mul(bandCountSafe)).div(bandCountSafe - 1)
  const toonMix = bandNode.add(strengthNode.mul(0.14)).clamp()
  const baseColorNode = mix(color(options.colorLow), color(options.colorHigh), toonMix)
  const rimNode = smoothstep(0.35, 1, radial).mul(strengthNode.mul(0.5).add(0.3))
  const colorNode = baseColorNode.add(rimNode.mul(uniform(options.rimBoost)))

  const alpha = flameMask
    .mul(uniform(options.opacityBase).add(strengthNode.mul(uniform(options.alphaBoost))))
    .mul(smoothstep(0, options.edgeSoftness, radial))
    .clamp()

  material.colorNode = colorNode
  material.opacityNode = alpha

  return material
}
