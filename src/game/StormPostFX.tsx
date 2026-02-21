import { EffectComposer, Vignette } from '@react-three/postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import { BlendFunction, Effect } from 'postprocessing'
import type { RainPostFxConfig } from './RainPostFxDebug'

const FALLBACK_OVERLAY_DISTANCE = 0.12

const GLASS_RAIN_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uStorm;
uniform float uWetness;
uniform float uIntensity;
uniform float uImpactFrequency;
uniform float uImpactSharpness;
uniform float uDropDensity;
uniform float uDropSizeMin;
uniform float uDropSizeMax;
uniform float uDistortionStrength;
uniform float uHighlightStrength;
uniform float uBlurMix;
uniform vec3 uTintColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  float n = hash21(p);
  return vec2(n, hash21(p + n + 13.1));
}

float droplet(vec2 uv, vec2 center, float r, float stretch) {
  vec2 q = uv - center;
  q.y /= max(stretch, 0.001);
  float d = length(q);
  return 1.0 - smoothstep(r, r * 1.6, d);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float storm = clamp(uStorm * uIntensity, 0.0, 1.0);
  float wet = clamp(uWetness, 0.0, 1.0);
  if (max(storm, wet) <= 0.001) {
    outputColor = inputColor;
    return;
  }
  float stormFx = smoothstep(0.02, 1.0, max(storm, wet));
  // Sim space with Y growing upward from bottom, so gravity is stable visually.
  vec2 simUv = vec2(uv.x, 1.0 - uv.y);

  float density = max(20.0, uDropDensity);
  vec2 gridBig = vec2(density * 0.48, density * 0.28);
  vec2 gridSmall = vec2(density * 1.15, density * 0.72);
  float impactFreq = max(0.1, uImpactFrequency);
  float sharp = max(0.2, uImpactSharpness);

  vec2 bigCellUv = simUv * gridBig;
  vec2 bigCellId = floor(bigCellUv);
  vec2 bigLocal = fract(bigCellUv);
  vec2 bigSeed = hash22(bigCellId + 1.7);
  float phase = fract(uTime * impactFreq * (0.45 + bigSeed.y * 0.85) + bigSeed.x * 11.7);
  float spawnEnd = 0.045 / sharp;
  float holdEnd = 0.32;
  float fadeStart = holdEnd;
  float fadeEnd = 0.82;
  float lifeAlpha = step(phase, fadeEnd) * (1.0 - smoothstep(fadeStart, fadeEnd, phase));
  lifeAlpha = max(lifeAlpha, step(phase, spawnEnd));

  // Big static droplets (lens mode, no falling).
  vec2 bigCenter = vec2(
    mix(0.18, 0.82, bigSeed.x),
    mix(0.18, 0.82, bigSeed.y)
  );
  float bigRadius = mix(uDropSizeMin, uDropSizeMax, bigSeed.y) * 8.8;
  float wetBig = pow(wet, 1.55);
  float bigThreshold = mix(0.0, 0.38, wetBig);
  float bigActive = step(bigSeed.x, bigThreshold);
  float bigDrop = droplet(bigLocal, bigCenter, bigRadius, 0.72) * lifeAlpha * bigActive;

  // Small static droplets with quicker cycle.
  vec2 smallCellUv = simUv * gridSmall;
  vec2 smallCellId = floor(smallCellUv);
  vec2 smallLocal = fract(smallCellUv);
  vec2 smallSeed = hash22(smallCellId + 19.3);
  vec2 smallCenter = vec2(mix(0.2, 0.8, smallSeed.x), mix(0.2, 0.8, smallSeed.y));
  float smallPhase = fract(uTime * impactFreq * 1.9 * (0.6 + smallSeed.y) + smallSeed.x * 17.1);
  float smallLife = step(smallPhase, 0.68) * (1.0 - smoothstep(0.18, 0.68, smallPhase));
  float wetSmall = pow(wet, 1.9);
  float smallThreshold = mix(0.0, 0.18, wetSmall);
  float smallActive = step(smallSeed.x, smallThreshold) * smallLife;
  float smallRadius = mix(uDropSizeMin, uDropSizeMax, smallSeed.y) * 3.2;
  float smallDrop = droplet(smallLocal, smallCenter, smallRadius, 1.0) * smallActive;

  float waterMask = clamp(bigDrop + smallDrop * mix(0.12, 0.42, wetSmall), 0.0, 1.0);

  vec2 n = vec2(dFdx(waterMask), dFdy(waterMask));
  vec2 distortion = n * uDistortionStrength * (0.45 + stormFx * 1.6);
  vec2 uvDist = clamp(uv + distortion, 0.0, 1.0);

  vec3 sceneColor = texture(inputBuffer, uvDist).rgb;
  vec3 blurA = texture(inputBuffer, clamp(uvDist + vec2(0.0028, 0.002) * (0.7 + stormFx), 0.0, 1.0)).rgb;
  vec3 blurB = texture(inputBuffer, clamp(uvDist + vec2(-0.0022, 0.0018) * (0.6 + stormFx), 0.0, 1.0)).rgb;
  vec3 blurColor = (blurA + blurB) * 0.5;
  sceneColor = mix(sceneColor, blurColor, clamp(uBlurMix, 0.0, 1.0) * (0.5 + stormFx * 1.1));

  float highlight = smoothstep(0.12, 0.82, waterMask) * uHighlightStrength;
  vec3 wetTint = mix(sceneColor, sceneColor + uTintColor * 0.36, waterMask * stormFx * 0.95);
  vec3 finalColor = wetTint + vec3(highlight) * (0.24 + stormFx * 0.8);

  outputColor = vec4(finalColor, inputColor.a);
}
`

class GlassRainEffect extends Effect {
  private readonly uTime: THREE.Uniform<number>
  private readonly uStorm: THREE.Uniform<number>
  private readonly uWetness: THREE.Uniform<number>
  private readonly uIntensity: THREE.Uniform<number>
  private readonly uImpactFrequency: THREE.Uniform<number>
  private readonly uImpactSharpness: THREE.Uniform<number>
  private readonly uDropDensity: THREE.Uniform<number>
  private readonly uDropSizeMin: THREE.Uniform<number>
  private readonly uDropSizeMax: THREE.Uniform<number>
  private readonly uDistortionStrength: THREE.Uniform<number>
  private readonly uHighlightStrength: THREE.Uniform<number>
  private readonly uBlurMix: THREE.Uniform<number>
  private readonly uTintColor: THREE.Uniform<THREE.Color>

  constructor() {
    const uniforms = new Map<string, THREE.Uniform>([
      ['uTime', new THREE.Uniform(0)],
      ['uStorm', new THREE.Uniform(0)],
      ['uWetness', new THREE.Uniform(0)],
      ['uIntensity', new THREE.Uniform(1)],
      ['uImpactFrequency', new THREE.Uniform(1.45)],
      ['uImpactSharpness', new THREE.Uniform(0.9)],
      ['uDropDensity', new THREE.Uniform(120)],
      ['uDropSizeMin', new THREE.Uniform(0.008)],
      ['uDropSizeMax', new THREE.Uniform(0.028)],
      ['uDistortionStrength', new THREE.Uniform(0.03)],
      ['uHighlightStrength', new THREE.Uniform(0.45)],
      ['uBlurMix', new THREE.Uniform(0.12)],
      ['uTintColor', new THREE.Uniform(new THREE.Color('#d9ecff'))],
    ])

    super('GlassRainEffect', GLASS_RAIN_FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      uniforms,
    })

    this.uTime = uniforms.get('uTime') as THREE.Uniform<number>
    this.uStorm = uniforms.get('uStorm') as THREE.Uniform<number>
    this.uWetness = uniforms.get('uWetness') as THREE.Uniform<number>
    this.uIntensity = uniforms.get('uIntensity') as THREE.Uniform<number>
    this.uImpactFrequency = uniforms.get('uImpactFrequency') as THREE.Uniform<number>
    this.uImpactSharpness = uniforms.get('uImpactSharpness') as THREE.Uniform<number>
    this.uDropDensity = uniforms.get('uDropDensity') as THREE.Uniform<number>
    this.uDropSizeMin = uniforms.get('uDropSizeMin') as THREE.Uniform<number>
    this.uDropSizeMax = uniforms.get('uDropSizeMax') as THREE.Uniform<number>
    this.uDistortionStrength = uniforms.get('uDistortionStrength') as THREE.Uniform<number>
    this.uHighlightStrength = uniforms.get('uHighlightStrength') as THREE.Uniform<number>
    this.uBlurMix = uniforms.get('uBlurMix') as THREE.Uniform<number>
    this.uTintColor = uniforms.get('uTintColor') as THREE.Uniform<THREE.Color>
  }

  setValues(config: RainPostFxConfig, storm: number, wetness: number) {
    const wet = THREE.MathUtils.clamp(wetness, 0, 1)
    const wetActivation = THREE.MathUtils.clamp(
      wet * THREE.MathUtils.lerp(
        THREE.MathUtils.clamp(config.startDensityRatio, 0, 1),
        1,
        wet,
      ),
      0,
      1,
    )
    const distortionStrength = THREE.MathUtils.lerp(
      config.distortionStrength * 0.22,
      config.distortionStrength,
      wet,
    )
    const highlightStrength = THREE.MathUtils.lerp(
      config.highlightStrength * 0.35,
      config.highlightStrength,
      wet,
    )
    const blurMix = THREE.MathUtils.lerp(config.blurMix * 0.35, config.blurMix, wet)

    this.uStorm.value = storm
    this.uWetness.value = wetActivation
    this.uIntensity.value = config.intensityMultiplier
    this.uImpactFrequency.value = config.impactFrequency
    this.uImpactSharpness.value = config.impactSharpness
    this.uDropDensity.value = config.dropDensity
    this.uDropSizeMin.value = config.dropSizeMin
    this.uDropSizeMax.value = Math.max(config.dropSizeMax, config.dropSizeMin + 0.001)
    this.uDistortionStrength.value = distortionStrength
    this.uHighlightStrength.value = highlightStrength
    this.uBlurMix.value = blurMix
    this.uTintColor.value.set(config.tintColor)
  }

  tick(delta: number) {
    this.uTime.value += delta
  }
}

const makeFallbackGlassTexture = () => {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return null
  }

  ctx.clearRect(0, 0, size, size)
  for (let i = 0; i < 400; i += 1) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 1.5 + Math.random() * 5

    ctx.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.08})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 1)
  texture.needsUpdate = true
  return texture
}

interface StormPostFXProps {
  stormFactorRef: MutableRefObject<number>
  config: RainPostFxConfig
}

export const StormPostFX = ({ stormFactorRef, config }: StormPostFXProps) => {
  const { gl, camera } = useThree()
  const isWebGPU = Boolean((gl as { isWebGPURenderer?: boolean }).isWebGPURenderer)
  const useComposer = config.enabled && config.useComposer && !isWebGPU
  const fallbackMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const fallbackMeshRef = useRef<THREE.Mesh>(null)
  const wetnessRef = useRef(0)
  const fallbackTexture = useMemo(() => makeFallbackGlassTexture(), [])
  const rainEffect = useMemo(() => new GlassRainEffect(), [])

  useEffect(() => {
    return () => {
      rainEffect.dispose()
      if (fallbackTexture) {
        fallbackTexture.dispose()
      }
    }
  }, [fallbackTexture, rainEffect])

  useFrame((_, delta) => {
    const storm = stormFactorRef.current
    if (config.enabled && storm > 0.02) {
      wetnessRef.current += config.fillRate * storm * delta
    } else {
      wetnessRef.current -= config.dryRate * delta
    }
    wetnessRef.current = THREE.MathUtils.clamp(wetnessRef.current, 0, 1)
    const wetness = wetnessRef.current

    rainEffect.setValues(config, storm, wetness)
    rainEffect.tick(delta)

    if (!fallbackTexture || !fallbackMaterialRef.current) {
      return
    }

    const fade = config.enabled
      ? THREE.MathUtils.clamp(wetness * config.intensityMultiplier, 0, 1)
      : 0

    fallbackMaterialRef.current.color.set(config.tintColor)
    fallbackMaterialRef.current.opacity = fade * (0.12 + config.blurMix * 0.8)

    if (useComposer || !fallbackMeshRef.current) {
      return
    }

    const mesh = fallbackMeshRef.current
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    mesh.position.copy(camera.position).addScaledVector(forward, FALLBACK_OVERLAY_DISTANCE)
    mesh.quaternion.copy(camera.quaternion)

    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const perspective = camera as THREE.PerspectiveCamera
      const height =
        2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov * 0.5)) * FALLBACK_OVERLAY_DISTANCE
      const width = height * perspective.aspect
      mesh.scale.set(width, height, 1)
    } else {
      mesh.scale.set(2, 2, 1)
    }
  })

  if (useComposer) {
    return (
      <EffectComposer multisampling={0}>
        <primitive object={rainEffect} />
        <Vignette
          eskil={false}
          offset={0.18}
          darkness={config.enabled ? config.vignetteStrength : 0}
        />
      </EffectComposer>
    )
  }

  if (!config.enabled) {
    return null
  }

  return (
    <mesh ref={fallbackMeshRef} frustumCulled={false} renderOrder={9999}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={fallbackMaterialRef}
        color={config.tintColor}
        transparent
        opacity={0}
        map={fallbackTexture ?? null}
        side={THREE.DoubleSide}
        depthTest={false}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  )
}
