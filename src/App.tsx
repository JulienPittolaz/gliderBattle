import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import './App.css'
import { GameScene, type GameHudState } from './game/GameScene'
import { TagChaseHud } from './game/TagChaseHud'
import { useVarioAudio } from './game/useVarioAudio'

type CanvasDefaults = {
  canvas: HTMLCanvasElement
  powerPreference: WebGLPowerPreference
  antialias: boolean
  alpha: boolean
}

function App() {
  const PLAYER_JOINED_BANNER_MS = 1200
  const [helpOpen, setHelpOpen] = useState(false)
  const [speedFxAmount, setSpeedFxAmount] = useState(0)
  const [playerJoinedBannerVisible, setPlayerJoinedBannerVisible] = useState(false)
  const playerJoinedTimeoutRef = useRef<number | null>(null)
  const previousCountdownRef = useRef(0)
  const [hudState, setHudState] = useState<GameHudState>({
    username: 'Guest',
    holderLabel: 'Nobody',
    localScore: 0,
    leaderboard: [],
    orbCountdownRemainingMs: 0,
    waitingForSecondPlayer: false,
  })
  const {
    enabled: varioEnabled,
    toggleEnabled: toggleVario,
    setVerticalSpeed,
    setAirspeed,
  } = useVarioAudio()

  useEffect(() => {
    if (!import.meta.env.PROD) {
      return
    }

    const GA_ID = 'G-CZGSF09Y67'
    const existing = document.querySelector(`script[data-ga-id="${GA_ID}"]`)
    if (existing) {
      return
    }

    const w = window as Window & {
      dataLayer?: unknown[]
      gtag?: (...args: unknown[]) => void
    }
    w.dataLayer = w.dataLayer ?? []
    w.gtag = w.gtag ?? ((...args: unknown[]) => {
      w.dataLayer?.push(args)
    })
    w.gtag('js', new Date())
    w.gtag('config', GA_ID)

    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
    script.dataset.gaId = GA_ID
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!helpOpen) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHelpOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [helpOpen])

  useEffect(() => {
    const previousCountdown = previousCountdownRef.current
    const currentCountdown = hudState.orbCountdownRemainingMs
    const countdownStarted = previousCountdown <= 0 && currentCountdown > 0
    previousCountdownRef.current = currentCountdown

    if (!countdownStarted) {
      return
    }

    setPlayerJoinedBannerVisible(true)
    if (playerJoinedTimeoutRef.current !== null) {
      window.clearTimeout(playerJoinedTimeoutRef.current)
    }
    playerJoinedTimeoutRef.current = window.setTimeout(() => {
      setPlayerJoinedBannerVisible(false)
      playerJoinedTimeoutRef.current = null
    }, PLAYER_JOINED_BANNER_MS)
  }, [hudState.orbCountdownRemainingMs])

  useEffect(() => {
    return () => {
      if (playerJoinedTimeoutRef.current !== null) {
        window.clearTimeout(playerJoinedTimeoutRef.current)
      }
    }
  }, [])

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
        return renderer
      } catch (error) {
        console.warn('WebGPU renderer init failed, falling back to WebGL.', error)
      }
    }

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
          <GameScene
            onVerticalSpeed={setVerticalSpeed}
            onAirspeed={setAirspeed}
            onHudStateChange={setHudState}
            onSpeedFxAmountChange={setSpeedFxAmount}
          />
        </Canvas>
      </div>
      <div
        className="speed-vignette-blur"
        style={{ '--speedfx': String(speedFxAmount) } as { [key: string]: string }}
      />
      <button
        type="button"
        className="help-toggle"
        aria-label="Open help"
        onClick={() => setHelpOpen(true)}
      >
        ?
      </button>
      {helpOpen ? (
        <div className="help-overlay" onClick={() => setHelpOpen(false)}>
          <section
            className="help-panel"
            onClick={(event) => event.stopPropagation()}
            aria-label="Rules and controls"
          >
            <button
              type="button"
              className="help-panel__close"
              aria-label="Close help"
              onClick={() => setHelpOpen(false)}
            >
              ×
            </button>
            <h2 className="help-panel__title">Help</h2>
            <div className="help-panel__section">
              <h3>Rules</h3>
              <p>The orb appears when at least 2 players are connected, after a 10-second countdown.</p>
              <p>The holder gains 1 point per second.</p>
              <p>Touching the holder steals the orb.</p>
              <p>If the holder crashes, the orb respawns somewhere else.</p>
            </div>
            <div className="help-panel__section">
              <h3>Controls</h3>
              <p><strong>A</strong> / <strong>←</strong>: turn left</p>
              <p><strong>D</strong> / <strong>→</strong>: turn right</p>
              <p><strong>Space</strong>: speedbar</p>
            </div>
          </section>
        </div>
      ) : null}
      <TagChaseHud
        username={hudState.username}
        holderLabel={hudState.holderLabel}
        localScore={hudState.localScore}
        leaderboard={hudState.leaderboard}
        soundEnabled={varioEnabled}
        onToggleSound={toggleVario}
      />
      {playerJoinedBannerVisible ? (
        <div className="orb-countdown orb-join-notice">Player joined</div>
      ) : null}
      {!playerJoinedBannerVisible && hudState.orbCountdownRemainingMs > 0 ? (
        <div className="orb-countdown">
          Orb in {Math.max(1, Math.ceil(hudState.orbCountdownRemainingMs / 1000))}s
        </div>
      ) : null}
      {hudState.waitingForSecondPlayer ? (
        <div className="waiting-player-hint">
          Orb match will start when another player joins.
        </div>
      ) : null}
    </main>
  )
}

export default App
