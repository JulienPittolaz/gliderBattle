import * as THREE from 'three'

export interface ThermalCartoonMaterialOptions {
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
  colorLow: THREE.ColorRepresentation
  colorHigh: THREE.ColorRepresentation
}

export const createThermalCartoonMaterial = (
  options: ThermalCartoonMaterialOptions,
) => {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uStrengthNorm: { value: options.strengthNorm },
      uOpacityBase: { value: options.opacityBase },
      uSpeed: { value: options.speed },
      uFlowDir: { value: options.flowDirection },
      uAscentBoost: { value: options.ascentBoost },
      uNoiseScale: { value: options.noiseScale },
      uEdgeSoftness: { value: options.edgeSoftness },
      uBandCount: { value: options.bandCount },
      uStripeFrequency: { value: options.stripeFrequency },
      uStripeWidth: { value: options.stripeWidth },
      uStripeContrast: { value: options.stripeContrast },
      uWobbleFrequency: { value: options.wobbleFrequency },
      uWobbleAmplitude: { value: options.wobbleAmplitude },
      uRimBoost: { value: options.rimBoost },
      uAlphaBoost: { value: options.alphaBoost },
      uColorLow: { value: new THREE.Color(options.colorLow) },
      uColorHigh: { value: new THREE.Color(options.colorHigh) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vLocalPos;

      void main() {
        vUv = uv;
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vLocalPos;

      uniform float uTime;
      uniform float uStrengthNorm;
      uniform float uOpacityBase;
      uniform float uSpeed;
      uniform float uFlowDir;
      uniform float uAscentBoost;
      uniform float uNoiseScale;
      uniform float uEdgeSoftness;
      uniform float uBandCount;
      uniform float uStripeFrequency;
      uniform float uStripeWidth;
      uniform float uStripeContrast;
      uniform float uWobbleFrequency;
      uniform float uWobbleAmplitude;
      uniform float uRimBoost;
      uniform float uAlphaBoost;
      uniform vec3 uColorLow;
      uniform vec3 uColorHigh;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash(i + vec2(0.0, 0.0));
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      void main() {
        vec2 centered = vUv - vec2(0.5, 0.5);
        float radial = 1.0 - smoothstep(0.0, 0.52, length(centered));
        if (radial <= 0.001) discard;

        float flow = vUv.y + uFlowDir * uTime * uSpeed * uAscentBoost;
        float n1 = noise2(vec2(vUv.x * uNoiseScale + uTime * 0.55, flow * 2.8));
        float n2 = noise2(vec2(vUv.x * (uNoiseScale * 0.75) - uTime * 0.3, flow * 1.9 + 8.7));
        float stripe = sin(flow * uStripeFrequency + vUv.x * (uNoiseScale * 2.2));
        float stripeThreshold = 1.0 - clamp(uStripeWidth, 0.01, 0.95);
        float stripeBand = smoothstep(stripeThreshold, stripeThreshold + 0.08, stripe);
        float wobble = sin(vUv.x * uWobbleFrequency + uTime * uSpeed * 0.9) * 0.5 + 0.5;
        float upwardRamp = smoothstep(0.12, 1.0, vUv.y) * (0.2 + 0.25 * uAscentBoost);
        float flameMask = clamp(
          radial
          + (n1 - 0.5) * 0.42
          + (n2 - 0.5) * 0.3
          + (stripeBand - 0.5) * uStripeContrast
          + (wobble - 0.5) * uWobbleAmplitude
          + upwardRamp,
          0.0,
          1.0
        );

        float bandValue = floor(flameMask * uBandCount) / max(uBandCount - 1.0, 1.0);
        float colorMix = clamp(bandValue + uStrengthNorm * 0.14, 0.0, 1.0);
        vec3 baseColor = mix(uColorLow, uColorHigh, colorMix);

        float rim = smoothstep(0.35, 1.0, radial) * (0.3 + uStrengthNorm * 0.5);
        vec3 color = baseColor + rim * uRimBoost;

        float alpha = flameMask * (uOpacityBase + uStrengthNorm * uAlphaBoost);
        alpha *= smoothstep(0.0, uEdgeSoftness, radial);

        if (alpha <= 0.01) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
      }
    `,
  })

  return material
}
