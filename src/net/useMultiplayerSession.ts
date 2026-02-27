import { useEffect, useMemo, useRef, useState } from 'react'
import { Client, Room } from 'colyseus.js'
import type { ThermalColumn } from '../game/thermals'
import type {
  LeaderboardEntry,
  LocalPoseMessage,
  MultiplayerSessionState,
  OrbSnapshot,
  PlayerSnapshot,
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

const toPlayers = (
  state: unknown,
): PlayerSnapshot[] => {
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
  const output: PlayerSnapshot[] = []

  for (const [sessionId, player] of entries) {
    if (!player || typeof player !== 'object') {
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
      currentOrbScore: asNumber(p.currentOrbScore, asNumber(p.score, 0)),
      bestOrbScore: asNumber(p.bestOrbScore, asNumber(p.score, 0)),
    })
  }

  return output
}

const toRemotePlayers = (
  players: PlayerSnapshot[],
  localSessionId: string | null,
  receivedAtMs: number,
): RemotePlayerSnapshot[] =>
  players
    .filter((player) => player.sessionId !== localSessionId)
    .map((player) => ({
      ...player,
      updatedAtMs: receivedAtMs,
    }))

const toOrb = (state: unknown): OrbSnapshot | null => {
  if (!state || typeof state !== 'object') {
    return null
  }
  const orb = (state as { orb?: unknown }).orb
  if (!orb || typeof orb !== 'object') {
    return null
  }

  const source = orb as Record<string, unknown>
  return {
    x: asNumber(source.x),
    y: asNumber(source.y),
    z: asNumber(source.z),
    holderSessionId: typeof source.holderSessionId === 'string' ? source.holderSessionId : '',
    lastTransferAtMs: asNumber(source.lastTransferAtMs),
  }
}

const toLeaderboard = (players: PlayerSnapshot[]): LeaderboardEntry[] =>
  [...players]
    .sort((a, b) => {
      if (b.bestOrbScore !== a.bestOrbScore) {
        return b.bestOrbScore - a.bestOrbScore
      }
      return a.nickname.localeCompare(b.nickname)
    })
    .slice(0, 3)
    .map((player) => ({
      sessionId: player.sessionId,
      nickname: player.nickname,
      score: player.bestOrbScore,
    }))

const toOrbActive = (state: unknown): boolean => {
  if (!state || typeof state !== 'object') {
    return false
  }
  return Boolean((state as { orbActive?: unknown }).orbActive)
}

const toOrbCountdownRemainingMs = (state: unknown): number => {
  if (!state || typeof state !== 'object') {
    return 0
  }
  return asNumber((state as { orbCountdownRemainingMs?: unknown }).orbCountdownRemainingMs, 0)
}

const randomNickname = () => `Pilot-${Math.floor(Math.random() * 9000 + 1000)}`

export const useMultiplayerSession = () => {
  const [session, setSession] = useState<MultiplayerSessionState>({
    connected: false,
    localSessionId: null,
    players: [],
    remotePlayers: [],
    thermals: null,
    orb: null,
    orbActive: false,
    orbCountdownRemainingMs: 0,
    leaderboard: [],
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
          const players = toPlayers(state)
          setSession({
            connected: true,
            localSessionId: room.sessionId,
            players,
            remotePlayers: toRemotePlayers(players, room.sessionId, receivedAtMs),
            thermals: toThermals(state),
            orb: toOrb(state),
            orbActive: toOrbActive(state),
            orbCountdownRemainingMs: toOrbCountdownRemainingMs(state),
            leaderboard: toLeaderboard(players),
          })
        })

        room.onLeave(() => {
          if (cancelled) {
            return
          }
          setSession({
            connected: false,
            localSessionId: null,
            players: [],
            remotePlayers: [],
            thermals: null,
            orb: null,
            orbActive: false,
            orbCountdownRemainingMs: 0,
            leaderboard: [],
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

  const sendCrash = useMemo(
    () => () => {
      const room = roomRef.current
      if (!room) {
        return
      }
      room.send('crash')
    },
    [],
  )

  return {
    ...session,
    setLocalPose,
    sendCrash,
  }
}
