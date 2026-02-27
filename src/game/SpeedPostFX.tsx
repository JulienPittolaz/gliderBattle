import { EffectComposer } from '@react-three/postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import { BlendFunction, Effect } from 'postprocessing'
import type { SpeedPostFxConfig } from './SpeedPostFxDebug'

const FALLBACK_OVERLAY_DISTANCE = 0.2
const FALLBACK_TEXTURE_SIZE = 1024

const SPEED_FRAGMENT = /* glsl */ `
uniform float uAmount;
uniform float uBlurStrength;
uniform float uCenterX;
uniform float uCenterY;
uniform float uChromaticBoost;
uniform float uVignetteBoost;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float amount = clamp(uAmount, 0.0, 1.0);
  if (amount <= 0.001) {
    outputColor = inputColor;
    return;
  }

  vec2 center = vec2(uCenterX, uCenterY);
  vec2 toCenter = center - uv;
  float dist = length(toCenter);
  vec2 dir = dist > 0.0001 ? normalize(toCenter) : vec2(0.0);
  float blurScale = uBlurStrength * amount;

  vec3 accum = vec3(0.0);
  accum += texture(inputBuffer, clamp(uv, 0.0, 1.0)).rgb * 0.2;
  accum += texture(inputBuffer, clamp(uv + dir * blurScale * 0.06, 0.0, 1.0)).rgb * 0.16;
  accum += texture(inputBuffer, clamp(uv + dir * blurScale * 0.12, 0.0, 1.0)).rgb * 0.15;
  accum += texture(inputBuffer, clamp(uv + dir * blurScale * 0.18, 0.0, 1.0)).rgb * 0.14;
  accum += texture(inputBuffer, clamp(uv + dir * blurScale * 0.24, 0.0, 1.0)).rgb * 0.13;
  accum += texture(inputBuffer, clamp(uv + dir * blurScale * 0.3, 0.0, 1.0)).rgb * 0.11;
  accum += texture(inputBuffer, clamp(uv + dir * blurScale * 0.36, 0.0, 1.0)).rgb * 0.11;

  float chromaOffset = amount * uChromaticBoost * 0.008;
  vec3 chroma;
  chroma.r = texture(inputBuffer, clamp(uv + dir * chromaOffset, 0.0, 1.0)).r;
  chroma.g = texture(inputBuffer, clamp(uv, 0.0, 1.0)).g;
  chroma.b = texture(inputBuffer, clamp(uv - dir * chromaOffset, 0.0, 1.0)).b;

  vec3 mixed = mix(inputColor.rgb, accum, clamp(amount * 0.92, 0.0, 1.0));
  mixed = mix(mixed, chroma, clamp(amount * 0.38, 0.0, 1.0));
  float vignette = smoothstep(1.05, 0.12, length((uv - center) * vec2(1.0, 0.8)));
  mixed *= mix(1.0 - amount * uVignetteBoost, 1.0, vignette);

  outputColor = vec4(mixed, inputColor.a);
}
`

class SpeedZoomEffect extends Effect {
  private readonly uAmount: THREE.Uniform<number>
  private readonly uBlurStrength: THREE.Uniform<number>
  private readonly uCenterX: THREE.Uniform<number>
  private readonly uCenterY: THREE.Uniform<number>
  private readonly uChromaticBoost: THREE.Uniform<number>
  private readonly uVignetteBoost: THREE.Uniform<number>

  constructor() {
    const uniforms = new Map<string, THREE.Uniform>([
      ['uAmount', new THREE.Uniform(0)],
      ['uBlurStrength', new THREE.Uniform(0.6)],
      ['uCenterX', new THREE.Uniform(0.5)],
      ['uCenterY', new THREE.Uniform(0.5)],
      ['uChromaticBoost', new THREE.Uniform(0.18)],
      ['uVignetteBoost', new THREE.Uniform(0.26)],
    ])
    super('SpeedZoomEffect', SPEED_FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      uniforms,
    })
    this.uAmount = uniforms.get('uAmount') as THREE.Uniform<number>
    this.uBlurStrength = uniforms.get('uBlurStrength') as THREE.Uniform<number>
    this.uCenterX = uniforms.get('uCenterX') as THREE.Uniform<number>
    this.uCenterY = uniforms.get('uCenterY') as THREE.Uniform<number>
    this.uChromaticBoost = uniforms.get('uChromaticBoost') as THREE.Uniform<number>
    this.uVignetteBoost = uniforms.get('uVignetteBoost') as THREE.Uniform<number>
  }

  setValues(amount: number, config: SpeedPostFxConfig) {
    const clampedAmount = THREE.MathUtils.clamp(amount, 0, 1)
    this.uAmount.value = clampedAmount * THREE.MathUtils.clamp(config.intensity, 0, 2)
    this.uBlurStrength.value = THREE.MathUtils.clamp(config.blurStrength, 0, 2)
    this.uCenterX.value = THREE.MathUtils.clamp(config.centerX, 0.2, 0.8)
    this.uCenterY.value = THREE.MathUtils.clamp(config.centerY, 0.2, 0.8)
    this.uChromaticBoost.value = THREE.MathUtils.clamp(config.chromaticBoost, 0, 1)
    this.uVignetteBoost.value = THREE.MathUtils.clamp(config.vignetteBoost, 0, 1)
  }
}

interface SpeedPostFXProps {
  amountRef: MutableRefObject<number>
  config: SpeedPostFxConfig
}

export const SpeedPostFX = ({ amountRef, config }: SpeedPostFXProps) => {
  const { gl, camera } = useThree()
  const isWebGPU = Boolean((gl as { isWebGPURenderer?: boolean }).isWebGPURenderer)
  const useComposer = config.enabled && config.useComposer && !isWebGPU
  const effect = useMemo(() => new SpeedZoomEffect(), [])
  const fallbackVignetteTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = FALLBACK_TEXTURE_SIZE
    canvas.height = FALLBACK_TEXTURE_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return null
    }
    const cx = canvas.width * 0.5
    const cy = canvas.height * 0.5
    const maxR = Math.min(cx, cy)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const vignette = ctx.createRadialGradient(cx, cy, maxR * 0.24, cx, cy, maxR)
    vignette.addColorStop(0, 'rgba(255,255,255,0.0)')
    vignette.addColorStop(0.5, 'rgba(255,255,255,0.0)')
    vignette.addColorStop(0.76, 'rgba(255,255,255,0.1)')
    vignette.addColorStop(1, 'rgba(255,255,255,0.34)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const smearCount = Math.max(40, Math.round(config.fallbackSmearDensity))
    const rMin = THREE.MathUtils.clamp(config.fallbackSmearRadiusMin, 0.3, 0.95)
    const rMax = THREE.MathUtils.clamp(config.fallbackSmearRadiusMax, rMin + 0.01, 1.2)
    for (let i = 0; i < smearCount; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const radius = maxR * (rMin + Math.random() * (rMax - rMin))
      const x = cx + Math.cos(angle) * radius
      const y = cy + Math.sin(angle) * radius
      const rx = 7 + Math.random() * 30
      const ry = rx * (0.45 + Math.random() * 0.9)
      const rot = angle + (Math.random() - 0.5) * 0.8
      const alpha = 0.012 + Math.random() * 0.03

      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rot)
      const g = ctx.createRadialGradient(0, 0, rx * 0.08, 0, 0, rx)
      g.addColorStop(0, `rgba(255,255,255,${alpha})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.needsUpdate = true
    return texture
  }, [config.fallbackSmearDensity, config.fallbackSmearRadiusMax, config.fallbackSmearRadiusMin])
  const fallbackVignetteMeshRef = useRef<THREE.Mesh>(null)
  const fallbackVignetteMaterialRef = useRef<THREE.MeshBasicMaterial>(null)

  useEffect(() => {
    return () => {
      effect.dispose()
      if (fallbackVignetteTexture) {
        fallbackVignetteTexture.dispose()
      }
    }
  }, [effect, fallbackVignetteTexture])

  useFrame(() => {
    const amount = config.enabled ? THREE.MathUtils.clamp(amountRef.current, 0, 1) : 0
    effect.setValues(amount, config)

    const intensity = amount * THREE.MathUtils.clamp(config.intensity, 0, 2)
    if (fallbackVignetteMaterialRef.current) {
      fallbackVignetteMaterialRef.current.opacity =
        THREE.MathUtils.clamp(
          intensity * THREE.MathUtils.clamp(config.vignetteBoost, 0, 1) * 0.64,
          0,
          0.6,
        )
      fallbackVignetteMaterialRef.current.color.set('#ffffff')
    }

    if (useComposer || !fallbackVignetteMeshRef.current) {
      return
    }

    const mesh = fallbackVignetteMeshRef.current
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    mesh.position.copy(camera.position).addScaledVector(forward, FALLBACK_OVERLAY_DISTANCE)
    mesh.quaternion.copy(camera.quaternion)

    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const perspective = camera as THREE.PerspectiveCamera
      const height =
        2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov * 0.5)) * FALLBACK_OVERLAY_DISTANCE
      const width = height * perspective.aspect
      const scale = 1 + intensity * 0.08
      mesh.scale.set(width * scale, height * scale, 1)
    } else {
      mesh.scale.set(2, 2, 1)
    }
  })

  if (!config.enabled) {
    return null
  }

  if (isWebGPU) {
    return null
  }

  if (useComposer) {
    return (
      <EffectComposer multisampling={0}>
        <primitive object={effect} />
      </EffectComposer>
    )
  }

  return (
    <mesh ref={fallbackVignetteMeshRef} frustumCulled={false} renderOrder={12000}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={fallbackVignetteMaterialRef}
        transparent
        opacity={0}
        map={fallbackVignetteTexture ?? null}
        blending={THREE.NormalBlending}
        side={THREE.DoubleSide}
        depthTest={false}
        depthWrite={false}
        fog={false}
        toneMapped={false}
      />
    </mesh>
  )
}
