import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { initAnalytics, trackPageView } from './analytics/ga'
import './App.css'
import { GameScene, type GameHudState } from './game/GameScene'
import { MobileControlsOverlay } from './game/MobileControlsOverlay'
import { TagChaseHud } from './game/TagChaseHud'
import type { PlayerInput } from './game/types'
import { useVarioAudio } from './game/useVarioAudio'

type CanvasDefaults = {
  canvas: HTMLCanvasElement
  powerPreference: WebGLPowerPreference
  antialias: boolean
  alpha: boolean
}

type PickupToast = {
  seq: number
  growthPct: number
  startupName: string
}

type MapCoinToast = {
  id: string
  startupName: string
  growthPct: number
}

const EMPTY_INPUT: PlayerInput = { yawLeft: false, yawRight: false, speedbar: false }

const formatSignedPercent = (value: number) => {
  const rounded = Math.round(value * 100) / 100
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2)
  return `${rounded > 0 ? '+' : ''}${formatted}%`
}

function App() {
  const PLAYER_JOINED_BANNER_MS = 1200
  const MOBILE_HINT_MS = 4200
  const MAP_COIN_TOAST_MS = 3200
  const [helpOpen, setHelpOpen] = useState(false)
  const [speedFxAmount, setSpeedFxAmount] = useState(0)
  const [touchDevice, setTouchDevice] = useState(false)
  const [landscape, setLandscape] = useState(true)
  const [mobileInput, setMobileInput] = useState<PlayerInput>(EMPTY_INPUT)
  const [mobileHintVisible, setMobileHintVisible] = useState(false)
  const [playerJoinedBannerVisible, setPlayerJoinedBannerVisible] = useState(false)
  const [pickupToast, setPickupToast] = useState<PickupToast | null>(null)
  const [mapCoinToast, setMapCoinToast] = useState<MapCoinToast | null>(null)
  const playerJoinedTimeoutRef = useRef<number | null>(null)
  const mobileHintTimeoutRef = useRef<number | null>(null)
  const pickupToastTimeoutRef = useRef<number | null>(null)
  const mapCoinToastTimeoutRef = useRef<number | null>(null)
  const previousCountdownRef = useRef(0)
  const [hudState, setHudState] = useState<GameHudState>({
    username: 'Guest',
    holderLabel: 'Nobody',
    localScore: 0,
    leaderboard: [],
    orbCountdownRemainingMs: 0,
    waitingForSecondPlayer: false,
    mapCoinNotification: null,
    pickupNotification: null,
  })
  const {
    enabled: varioEnabled,
    toggleEnabled: toggleVario,
    setVerticalSpeed,
    setAirspeed,
  } = useVarioAudio()

  const mobileControlsEnabled = touchDevice && landscape && !helpOpen

  useEffect(() => {
    const updateMobileState = () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches
      const touchCapable = coarse || 'ontouchstart' in window || navigator.maxTouchPoints > 0
      setTouchDevice(touchCapable)
      setLandscape(window.innerWidth >= window.innerHeight)
    }

    updateMobileState()
    window.addEventListener('resize', updateMobileState)
    window.addEventListener('orientationchange', updateMobileState)
    return () => {
      window.removeEventListener('resize', updateMobileState)
      window.removeEventListener('orientationchange', updateMobileState)
    }
  }, [])

  useEffect(() => {
    if (!mobileControlsEnabled) {
      setMobileInput(EMPTY_INPUT)
    }
  }, [mobileControlsEnabled])

  useEffect(() => {
    if (!mobileControlsEnabled) {
      setMobileHintVisible(false)
      if (mobileHintTimeoutRef.current !== null) {
        window.clearTimeout(mobileHintTimeoutRef.current)
        mobileHintTimeoutRef.current = null
      }
      return
    }

    setMobileHintVisible(true)
    if (mobileHintTimeoutRef.current !== null) {
      window.clearTimeout(mobileHintTimeoutRef.current)
    }
    mobileHintTimeoutRef.current = window.setTimeout(() => {
      setMobileHintVisible(false)
      mobileHintTimeoutRef.current = null
    }, MOBILE_HINT_MS)
  }, [mobileControlsEnabled])

  useEffect(() => {
    if (!initAnalytics()) {
      return
    }
    trackPageView()
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
    const mapCoin = hudState.mapCoinNotification
    if (!mapCoin) {
      return
    }

    setMapCoinToast(mapCoin)
    if (mapCoinToastTimeoutRef.current !== null) {
      window.clearTimeout(mapCoinToastTimeoutRef.current)
    }
    mapCoinToastTimeoutRef.current = window.setTimeout(() => {
      setMapCoinToast((current) => (current?.id === mapCoin.id ? null : current))
      mapCoinToastTimeoutRef.current = null
    }, MAP_COIN_TOAST_MS)
  }, [MAP_COIN_TOAST_MS, hudState.mapCoinNotification])

  useEffect(() => {
    const pickup = hudState.pickupNotification
    if (!pickup) {
      return
    }

    setPickupToast({
      seq: pickup.seq,
      growthPct: pickup.growthPct,
      startupName: pickup.startupName,
    })

    if (pickupToastTimeoutRef.current !== null) {
      window.clearTimeout(pickupToastTimeoutRef.current)
    }

    pickupToastTimeoutRef.current = window.setTimeout(() => {
      setPickupToast((current) => (current?.seq === pickup.seq ? null : current))
      pickupToastTimeoutRef.current = null
    }, Math.max(0, pickup.endsAtMs - Date.now()))
  }, [hudState.pickupNotification])

  useEffect(() => {
    return () => {
      if (playerJoinedTimeoutRef.current !== null) {
        window.clearTimeout(playerJoinedTimeoutRef.current)
      }
      if (mobileHintTimeoutRef.current !== null) {
        window.clearTimeout(mobileHintTimeoutRef.current)
      }
      if (pickupToastTimeoutRef.current !== null) {
        window.clearTimeout(pickupToastTimeoutRef.current)
      }
      if (mapCoinToastTimeoutRef.current !== null) {
        window.clearTimeout(mapCoinToastTimeoutRef.current)
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
            mobileInput={mobileControlsEnabled ? mobileInput : null}
          />
        </Canvas>
      </div>
      <div
        className="speed-vignette-blur"
        style={{ '--speedfx': String(speedFxAmount) } as { [key: string]: string }}
      />
      <div className="trustmrr-credit">
        Booster coins are provided by{' '}
        <a
          href="https://trustmrr.com/"
          target="_blank"
          rel="noreferrer"
          className="trustmrr-credit__link"
        >
          TrustMRR
        </a>
      </div>
      <div className="hud-actions">
        <button
          type="button"
          className="hud-action-btn help-toggle"
          aria-label="Open help"
          onClick={() => setHelpOpen(true)}
        >
          ?
        </button>
        <button
          type="button"
          className="hud-action-btn sound-toggle"
          aria-label={varioEnabled ? 'Disable sound' : 'Enable sound'}
          title={varioEnabled ? 'Disable sound' : 'Enable sound'}
          onClick={toggleVario}
        >
          <svg
            className="sound-toggle__icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M4 10h4.6L13 6v12l-4.4-4H4z" />
            {varioEnabled ? (
              <>
                <path d="M16 9.5c1 .8 1.5 1.6 1.5 2.5s-.5 1.7-1.5 2.5" />
                <path d="M18.6 7.2c1.6 1.3 2.4 2.9 2.4 4.8s-.8 3.5-2.4 4.8" />
              </>
            ) : (
              <path d="M5.3 5.3L18.7 18.7" />
            )}
          </svg>
        </button>
      </div>
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
              <p>Startup coins spawn around the island every 5 seconds and give a 3-second speed bonus or malus.</p>
            </div>
            <div className="help-panel__section">
              <h3>Controls</h3>
              <p><strong>A</strong> / <strong>←</strong>: turn left</p>
              <p><strong>D</strong> / <strong>→</strong>: turn right</p>
              <p><strong>Space</strong>: speedbar</p>
              <p><strong>Mobile:</strong> hold left/right side to turn, hold SPEEDBAR button to accelerate.</p>
            </div>
          </section>
        </div>
      ) : null}
      <TagChaseHud
        username={hudState.username}
        holderLabel={hudState.holderLabel}
        localScore={hudState.localScore}
        leaderboard={hudState.leaderboard}
        compact={touchDevice}
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
      {mapCoinToast ? (
        <div className="map-coin-toast">
          {mapCoinToast.startupName} ({formatSignedPercent(mapCoinToast.growthPct)} this month)
          {' '}spawned on the map
        </div>
      ) : null}
      {mobileControlsEnabled && mobileHintVisible ? (
        <div className="mobile-controls-hint">
          Hold LEFT/RIGHT to steer and hold SPEEDBAR to accelerate.
        </div>
      ) : null}
      {pickupToast ? (
        <div
          className={`pickup-toast${pickupToast.growthPct > 0 ? ' pickup-toast--positive' : ''}${pickupToast.growthPct < 0 ? ' pickup-toast--negative' : ''}`}
        >
          {formatSignedPercent(pickupToast.growthPct)} by {pickupToast.startupName || 'Unknown'}
        </div>
      ) : null}
      <MobileControlsOverlay enabled={mobileControlsEnabled} onInputChange={setMobileInput} />
      {touchDevice && !landscape ? (
        <div className="mobile-rotate-hint">Rotate your device to landscape to play.</div>
      ) : null}
    </main>
  )
}

export default App
