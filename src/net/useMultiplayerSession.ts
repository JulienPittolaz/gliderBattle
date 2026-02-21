import { useEffect, useMemo, useRef, useState } from 'react'
import { Client, Room } from 'colyseus.js'
import type { ThermalColumn } from '../game/thermals'
import type {
  LocalPoseMessage,
  MultiplayerSessionState,
  RemotePlayerSnapshot,
} from './types'

const DEFAULT_ENDPOINT = 'ws://localhost:2567'
const ROOM_NAME = 'world'
const SEND_INTERVAL_MS = 50

const asNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const toThermals = (state: unknown): ThermalColumn[] | null => {
  if (!state || typeof state !== 'object') {
    return null
  }
  const source = (state as { thermals?: unknown }).thermals
  if (!source || typeof source !== 'object') {
    return null
  }

  const output: ThermalColumn[] = []
  const values = Array.isArray(source)
    ? source
    : Array.from((source as { values?: () => Iterable<unknown> }).values?.() ?? [])

  for (const thermal of values) {
    if (!thermal || typeof thermal !== 'object') {
      continue
    }
    const t = thermal as Record<string, unknown>
    const id = typeof t.id === 'string' ? t.id : ''
    if (!id) {
      continue
    }
    const sizeClass = t.sizeClass === 'large' ? 'large' : 'small'
    output.push({
      id,
      sizeClass,
      activationAt: asNumber(t.activationAt, Date.now() * 0.001),
      groundY: asNumber(t.groundY, 0),
      x: asNumber(t.x),
      z: asNumber(t.z),
      radius: asNumber(t.radius, sizeClass === 'small' ? 6 : 14),
      baseHeight: asNumber(t.baseHeight, 30),
      heightAmplitude: asNumber(t.heightAmplitude, 10),
      strength: asNumber(t.strength, sizeClass === 'small' ? 12 : 9),
      phase: asNumber(t.phase),
    })
  }
  return output
}

const toRemotePlayers = (
  state: unknown,
  localSessionId: string | null,
  receivedAtMs: number,
): RemotePlayerSnapshot[] => {
  if (!state || typeof state !== 'object') {
    return []
  }
  const players = (state as { players?: unknown }).players
  if (!players || typeof players !== 'object') {
    return []
  }

  const entries = Array.from(
    (players as { entries?: () => Iterable<[string, unknown]> }).entries?.() ?? [],
  )
  const output: RemotePlayerSnapshot[] = []

  for (const [sessionId, player] of entries) {
    if (sessionId === localSessionId || !player || typeof player !== 'object') {
      continue
    }
    const p = player as Record<string, unknown>
    output.push({
      sessionId,
      nickname: typeof p.nickname === 'string' ? p.nickname : `Pilot-${sessionId.slice(0, 4)}`,
      x: asNumber(p.x),
      y: asNumber(p.y),
      z: asNumber(p.z),
      yaw: asNumber(p.yaw),
      bank: asNumber(p.bank),
      speedbar: Boolean(p.speedbar),
      updatedAtMs: receivedAtMs,
    })
  }

  return output
}

const randomNickname = () => `Pilot-${Math.floor(Math.random() * 9000 + 1000)}`

export const useMultiplayerSession = () => {
  const [session, setSession] = useState<MultiplayerSessionState>({
    connected: false,
    localSessionId: null,
    remotePlayers: [],
    thermals: null,
  })
  const roomRef = useRef<Room | null>(null)
  const pendingPoseRef = useRef<LocalPoseMessage | null>(null)

  useEffect(() => {
    let cancelled = false
    const endpoint = import.meta.env.VITE_COLYSEUS_URL ?? DEFAULT_ENDPOINT
    const client = new Client(endpoint)

    const connect = async () => {
      try {
        const room = await client.joinOrCreate(ROOM_NAME, {
          nickname: randomNickname(),
        })
        if (cancelled) {
          room.leave()
          return
        }
        roomRef.current = room
        setSession((prev) => ({
          ...prev,
          connected: true,
          localSessionId: room.sessionId,
        }))

        room.onStateChange((state) => {
          if (cancelled) {
            return
          }
          const receivedAtMs = performance.now()
          setSession({
            connected: true,
            localSessionId: room.sessionId,
            remotePlayers: toRemotePlayers(state, room.sessionId, receivedAtMs),
            thermals: toThermals(state),
          })
        })

        room.onLeave(() => {
          if (cancelled) {
            return
          }
          setSession({
            connected: false,
            localSessionId: null,
            remotePlayers: [],
            thermals: null,
          })
        })
      } catch (error) {
        console.warn('[multiplayer] disabled, could not connect to server.', error)
      }
    }

    void connect()

    const sendTimer = window.setInterval(() => {
      const room = roomRef.current
      const pose = pendingPoseRef.current
      if (!room || !pose) {
        return
      }
      room.send('pose', pose)
      pendingPoseRef.current = null
    }, SEND_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(sendTimer)
      const room = roomRef.current
      roomRef.current = null
      if (room) {
        room.leave()
      }
    }
  }, [])

  const setLocalPose = useMemo(
    () => (pose: LocalPoseMessage) => {
      pendingPoseRef.current = pose
    },
    [],
  )

  return {
    ...session,
    setLocalPose,
  }
}
