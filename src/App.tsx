import { Canvas } from '@react-three/fiber'
import { Leva } from 'leva'
import { useCallback, useState } from 'react'
import * as THREE from 'three'
import './App.css'
import { GameScene } from './game/GameScene'
import type { RendererBackend } from './three/types'

type CanvasDefaults = {
  canvas: HTMLCanvasElement
  powerPreference: WebGLPowerPreference
  antialias: boolean
  alpha: boolean
}

function App() {
  const [backend, setBackend] = useState<RendererBackend | null>(null)

  const createR3FRenderer = useCallback(async (defaults: CanvasDefaults) => {
    if ('gpu' in navigator) {
      try {
        const webgpu = await import('three/webgpu')
        const { canvas, antialias, alpha } = defaults
        const renderer = new webgpu.WebGPURenderer({
          canvas,
          antialias,
          alpha,
          powerPreference: 'high-performance',
        }) as unknown as THREE.WebGLRenderer & { init: () => Promise<unknown> }
        await renderer.init()
        setBackend('webgpu')
        return renderer
      } catch (error) {
        console.warn('WebGPU renderer init failed, falling back to WebGL.', error)
      }
    }

    setBackend('webgl')
    return new THREE.WebGLRenderer({
      ...defaults,
    })
  }, [])

  return (
    <main className="app-shell">
      <div className="scene-mount">
        <Canvas
          camera={{ fov: 60, near: 0.1, far: 500, position: [4, 2.4, 7] }}
          dpr={[1, 2]}
          gl={createR3FRenderer as unknown as never}
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace
            gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))
          }}
        >
          <GameScene />
        </Canvas>
      </div>
      <div className="backend-pill">
        Renderer: {backend === null ? 'initializing...' : backend}
      </div>
      <Leva collapsed={false} oneLineLabels />
    </main>
  )
}

export default App
