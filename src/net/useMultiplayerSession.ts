import { useEffect, useMemo, useRef, useState } from 'react'
import { Client, Room } from 'colyseus.js'
import type { ThermalColumn } from '../game/thermals'
import type {
  LeaderboardEntry,
  LocalPoseMessage,
  MultiplayerSessionState,
  OrbSnapshot,
  PickupNotificationSnapshot,
  PlayerSnapshot,
  PlayerEffectSnapshot,
  RemotePlayerSnapshot,
  StartupCoinSnapshot,
} from './types'

const ROOM_NAME = 'world'
const SEND_INTERVAL_MS = 50
const LOCAL_COLYSEUS_PORT = '2567'
const PLAYER_ID_STORAGE_KEY = 'gliderBattle.playerId'
const PLAYER_NICKNAME_STORAGE_KEY = 'gliderBattle.nickname'

const asNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const toPickupNotification = (state: unknown): PickupNotificationSnapshot | null => {
  if (!state || typeof state !== 'object') {
    return null
  }

  const source = state as Record<string, unknown>
  const seq = asNumber(source.lastCoinPickupSeq)
  if (seq <= 0) {
    return null
  }

  return {
    seq,
    growthPct: asNumber(source.lastCoinPickupPct),
    pickedAtMs: asNumber(source.lastCoinPickupAtMs),
    startupName: typeof source.lastCoinPickupStartupName === 'string' ? source.lastCoinPickupStartupName : '',
  }
}

const toPlayerEffect = (state: unknown): PlayerEffectSnapshot => ({
  active: Boolean((state as { speedEffectActive?: unknown })?.speedEffectActive),
  speedPct: asNumber((state as { speedEffectPct?: unknown })?.speedEffectPct),
  endsAtMs: asNumber((state as { speedEffectEndsAtMs?: unknown })?.speedEffectEndsAtMs),
  pickup: toPickupNotification(state),
})

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
      effect: toPlayerEffect(p),
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

const toCoins = (state: unknown): StartupCoinSnapshot[] => {
  if (!state || typeof state !== 'object') {
    return []
  }

  const source = (state as { coins?: unknown }).coins
  if (!source || typeof source !== 'object') {
    return []
  }

  const values = Array.isArray(source)
    ? source
    : Array.from((source as { values?: () => Iterable<unknown> }).values?.() ?? [])

  const output: StartupCoinSnapshot[] = []
  for (const coin of values) {
    if (!coin || typeof coin !== 'object') {
      continue
    }
    const c = coin as Record<string, unknown>
    const id = typeof c.id === 'string' ? c.id : ''
    const startupId = typeof c.startupId === 'string' ? c.startupId : ''
    if (!id || !startupId) {
      continue
    }
    output.push({
      id,
      startupId,
      name: typeof c.name === 'string' ? c.name : startupId,
      iconUrl: typeof c.iconUrl === 'string' ? c.iconUrl : '',
      growth30d: asNumber(c.growth30d),
      x: asNumber(c.x),
      y: asNumber(c.y),
      z: asNumber(c.z),
      spawnedAtMs: asNumber(c.spawnedAtMs),
      expiresAtMs: asNumber(c.expiresAtMs),
    })
  }

  return output
}

const toLeaderboard = (state: unknown): LeaderboardEntry[] => {
  if (!state || typeof state !== 'object') {
    return []
  }

  const source = (state as { leaderboard?: unknown }).leaderboard
  if (!source || typeof source !== 'object') {
    return []
  }

  const values = Array.isArray(source)
    ? source
    : Array.from((source as { values?: () => Iterable<unknown> }).values?.() ?? [])

  const output: LeaderboardEntry[] = []
  for (const entry of values) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const value = entry as Record<string, unknown>
    const sessionId = typeof value.sessionId === 'string' ? value.sessionId : ''
    if (!sessionId) {
      continue
    }
    output.push({
      sessionId,
      nickname: typeof value.nickname === 'string' ? value.nickname : `Pilot-${sessionId.slice(0, 4)}`,
      score: asNumber(value.score),
    })
  }

  return output
}

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

const createPlayerId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `player${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`
}

const getPersistentPlayerIdentity = () => {
  try {
    let playerId = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY)?.trim() ?? ''
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(playerId)) {
      playerId = createPlayerId()
      window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId)
    }

    let nickname = window.localStorage.getItem(PLAYER_NICKNAME_STORAGE_KEY)?.trim() ?? ''
    if (!nickname) {
      nickname = randomNickname()
      window.localStorage.setItem(PLAYER_NICKNAME_STORAGE_KEY, nickname)
    }

    return { playerId, nickname: nickname.slice(0, 24) }
  } catch {
    return {
      playerId: createPlayerId(),
      nickname: randomNickname(),
    }
  }
}

const getSameOriginEndpoint = () => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${window.location.host}`
}

const getLocalDevEndpoint = () => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${window.location.hostname}:${LOCAL_COLYSEUS_PORT}`
}

const isLocalHostname = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'

const resolveColyseusEndpoint = () => {
  const configuredEndpoint = import.meta.env.VITE_COLYSEUS_URL?.trim()
  if (configuredEndpoint) {
    try {
      const parsed = new URL(configuredEndpoint)
      if (import.meta.env.PROD && isLocalHostname(parsed.hostname)) {
        console.warn(
          `[multiplayer] ignoring localhost VITE_COLYSEUS_URL in production: ${configuredEndpoint}`,
        )
        return getSameOriginEndpoint()
      }
    } catch {
      // Keep configured endpoint as-is if URL parsing fails.
    }
    return configuredEndpoint
  }
  if (import.meta.env.DEV && isLocalHostname(window.location.hostname) && window.location.port !== LOCAL_COLYSEUS_PORT) {
    return getLocalDevEndpoint()
  }
  return getSameOriginEndpoint()
}

export const useMultiplayerSession = () => {
  const [session, setSession] = useState<MultiplayerSessionState>({
    connected: false,
    localSessionId: null,
    players: [],
    remotePlayers: [],
    thermals: null,
    orb: null,
    coins: [],
    orbActive: false,
    orbCountdownRemainingMs: 0,
    leaderboard: [],
  })
  const roomRef = useRef<Room | null>(null)
  const pendingPoseRef = useRef<LocalPoseMessage | null>(null)

  useEffect(() => {
    let cancelled = false
    const endpoint = resolveColyseusEndpoint()
    const client = new Client(endpoint)
    const identity = getPersistentPlayerIdentity()

    const connect = async () => {
      try {
        const room = await client.joinOrCreate(ROOM_NAME, {
          nickname: identity.nickname,
          playerId: identity.playerId,
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
            coins: toCoins(state),
            orbActive: toOrbActive(state),
            orbCountdownRemainingMs: toOrbCountdownRemainingMs(state),
            leaderboard: toLeaderboard(state),
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
            coins: [],
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
