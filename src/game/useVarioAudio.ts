import { useCallback, useEffect, useRef, useState } from 'react'
import {
  VARIO_CLIMB_START_THRESHOLD,
  VARIO_CLIMB_STOP_THRESHOLD,
  VARIO_SINK_START_THRESHOLD,
  VARIO_SINK_STOP_THRESHOLD,
} from './constants'

const STORAGE_KEY = 'varioEnabled'

interface AudioState {
  context: AudioContext
  gain: GainNode
  oscillator: OscillatorNode
  windSource: AudioBufferSourceNode
  windFilter: BiquadFilterNode
  windGain: GainNode
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const piecewise = (
  value: number,
  points: Array<{ x: number; y: number }>,
) => {
  if (points.length === 0) {
    return 0
  }
  if (value <= points[0].x) {
    return points[0].y
  }
  for (let i = 1; i < points.length; i += 1) {
    const left = points[i - 1]
    const right = points[i]
    if (value <= right.x) {
      const t = (value - left.x) / Math.max(right.x - left.x, Number.EPSILON)
      return lerp(left.y, right.y, t)
    }
  }
  return points[points.length - 1].y
}

export const useVarioAudio = () => {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  })
  const verticalSpeedRef = useRef(0)
  const airspeedRef = useRef(6)
  const audioRef = useRef<AudioState | null>(null)
  const nextBeepAtMsRef = useRef(0)
  const beepOffAtMsRef = useRef(0)
  const beepActiveRef = useRef(false)
  const climbToneActiveRef = useRef(false)
  const sinkToneActiveRef = useRef(false)

  const setVerticalSpeed = useCallback((value: number) => {
    verticalSpeedRef.current = Number.isFinite(value) ? value : 0
  }, [])

  const setAirspeed = useCallback((value: number) => {
    airspeedRef.current = Number.isFinite(value) ? value : 6
  }, [])

  const ensureAudio = useCallback(async () => {
    let audio = audioRef.current
    if (!audio) {
      const context = new AudioContext()
      const gain = context.createGain()
      gain.gain.value = 0
      gain.connect(context.destination)

      const oscillator = context.createOscillator()
      oscillator.type = 'square'
      oscillator.frequency.value = 980
      oscillator.connect(gain)
      oscillator.start()

      const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
      const noiseData = noiseBuffer.getChannelData(0)
      for (let i = 0; i < noiseData.length; i += 1) {
        noiseData[i] = Math.random() * 2 - 1
      }

      const windSource = context.createBufferSource()
      windSource.buffer = noiseBuffer
      windSource.loop = true

      const windFilter = context.createBiquadFilter()
      windFilter.type = 'bandpass'
      windFilter.frequency.value = 850
      windFilter.Q.value = 0.7

      const windGain = context.createGain()
      windGain.gain.value = 0

      windSource.connect(windFilter)
      windFilter.connect(windGain)
      windGain.connect(context.destination)
      windSource.start()

      audio = { context, gain, oscillator, windSource, windFilter, windGain }
      audioRef.current = audio
    }
    if (audio.context.state === 'suspended') {
      await audio.context.resume()
    }
  }, [])

  const toggleEnabled = useCallback(async () => {
    const next = !enabled
    setEnabled(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    }
    if (next) {
      try {
        await ensureAudio()
      } catch {
        setEnabled(false)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, '0')
        }
      }
    }
  }, [enabled, ensureAudio])

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    const run = async () => {
      if (enabled) {
        try {
          await ensureAudio()
        } catch {
          if (!cancelled) {
            setEnabled(false)
          }
          return
        }
      }

      timer = window.setInterval(() => {
        const audio = audioRef.current
        if (!audio) {
          return
        }
        const now = audio.context.currentTime
        const nowMs = performance.now()
        const verticalSpeed = verticalSpeedRef.current
        const airspeed = airspeedRef.current

        if (!enabled) {
          audio.gain.gain.linearRampToValueAtTime(0, now + 0.06)
          audio.windGain.gain.linearRampToValueAtTime(0, now + 0.08)
          beepActiveRef.current = false
          nextBeepAtMsRef.current = 0
          beepOffAtMsRef.current = 0
          climbToneActiveRef.current = false
          sinkToneActiveRef.current = false
          return
        }

        const speedNorm = clamp((airspeed - 5) / 3, 0, 1.2)
        const verticalNorm = clamp(Math.abs(verticalSpeed) / 6, 0, 1)
        const windLevel = clamp(0.012 + speedNorm * 0.03 + verticalNorm * 0.008, 0, 0.06)
        const windFreq = 520 + speedNorm * 880 + verticalNorm * 220
        audio.windFilter.frequency.linearRampToValueAtTime(windFreq, now + 0.06)
        audio.windGain.gain.linearRampToValueAtTime(windLevel, now + 0.06)

        let frequency = 980
        let gain = 0
        if (!climbToneActiveRef.current && verticalSpeed >= VARIO_CLIMB_START_THRESHOLD) {
          climbToneActiveRef.current = true
        } else if (climbToneActiveRef.current && verticalSpeed <= VARIO_CLIMB_STOP_THRESHOLD) {
          climbToneActiveRef.current = false
        }
        if (!sinkToneActiveRef.current && verticalSpeed <= VARIO_SINK_START_THRESHOLD) {
          sinkToneActiveRef.current = true
        } else if (sinkToneActiveRef.current && verticalSpeed >= VARIO_SINK_STOP_THRESHOLD) {
          sinkToneActiveRef.current = false
        }

        if (climbToneActiveRef.current) {
          const climb = clamp(verticalSpeed, 0, 8)
          const periodMs = piecewise(climb, [
            { x: 0, y: 560 },
            { x: 0.5, y: 410 },
            { x: 1, y: 320 },
            { x: 2, y: 230 },
            { x: 4, y: 150 },
            { x: 8, y: 95 },
          ])
          const beepDurationMs = piecewise(climb, [
            { x: 0, y: 34 },
            { x: 1, y: 40 },
            { x: 2, y: 48 },
            { x: 4, y: 56 },
            { x: 8, y: 66 },
          ])

          if (nextBeepAtMsRef.current === 0) {
            nextBeepAtMsRef.current = nowMs
          }
          if (nowMs >= nextBeepAtMsRef.current) {
            beepActiveRef.current = true
            beepOffAtMsRef.current = nowMs + beepDurationMs
            nextBeepAtMsRef.current = nowMs + periodMs
          }
          if (beepActiveRef.current && nowMs >= beepOffAtMsRef.current) {
            beepActiveRef.current = false
          }

          frequency = piecewise(climb, [
            { x: 0, y: 980 },
            { x: 1, y: 1180 },
            { x: 2, y: 1370 },
            { x: 4, y: 1610 },
            { x: 8, y: 1950 },
          ])
          gain = beepActiveRef.current
            ? piecewise(climb, [
                { x: 0, y: 0.03 },
                { x: 2, y: 0.05 },
                { x: 4, y: 0.07 },
                { x: 8, y: 0.095 },
              ])
            : 0
        } else if (sinkToneActiveRef.current) {
          const sink = clamp(-verticalSpeed, 0, 8)
          const periodMs = 820
          const beepDurationMs = 180

          if (nextBeepAtMsRef.current === 0) {
            nextBeepAtMsRef.current = nowMs
          }
          if (nowMs >= nextBeepAtMsRef.current) {
            beepActiveRef.current = true
            beepOffAtMsRef.current = nowMs + beepDurationMs
            nextBeepAtMsRef.current = nowMs + periodMs
          }
          if (beepActiveRef.current && nowMs >= beepOffAtMsRef.current) {
            beepActiveRef.current = false
          }

          frequency = piecewise(sink, [
            { x: 2, y: 470 },
            { x: 4, y: 410 },
            { x: 6, y: 365 },
            { x: 8, y: 330 },
          ])
          gain = beepActiveRef.current ? 0.038 : 0
        } else {
          beepActiveRef.current = false
          nextBeepAtMsRef.current = 0
          beepOffAtMsRef.current = 0
        }

        audio.oscillator.frequency.linearRampToValueAtTime(frequency, now + 0.03)
        audio.gain.gain.linearRampToValueAtTime(gain, now + 0.03)
      }, 22)
    }

    void run()

    return () => {
      cancelled = true
      if (timer !== null) {
        window.clearInterval(timer)
      }
    }
  }, [enabled, ensureAudio])

  useEffect(
    () => () => {
      const audio = audioRef.current
      if (!audio) {
        return
      }
      audio.gain.gain.value = 0
      audio.windGain.gain.value = 0
      audio.oscillator.stop()
      audio.windSource.stop()
      void audio.context.close()
      audioRef.current = null
    },
    [],
  )

  return {
    enabled,
    toggleEnabled,
    setVerticalSpeed,
    setAirspeed,
  }
}
