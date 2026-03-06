import type { ThermalColumn } from '../game/thermals'

export interface LocalPoseMessage {
  x: number
  y: number
  z: number
  yaw: number
  bank: number
  speedbar: boolean
}

export interface PickupNotificationSnapshot {
  seq: number
  growthPct: number
  pickedAtMs: number
  startupName: string
}

export interface PlayerEffectSnapshot {
  active: boolean
  speedPct: number
  endsAtMs: number
  pickup: PickupNotificationSnapshot | null
}

export interface RemotePlayerSnapshot {
  sessionId: string
  nickname: string
  x: number
  y: number
  z: number
  yaw: number
  bank: number
  speedbar: boolean
  currentOrbScore: number
  bestOrbScore: number
  effect: PlayerEffectSnapshot
  updatedAtMs: number
}

export interface PlayerSnapshot {
  sessionId: string
  nickname: string
  x: number
  y: number
  z: number
  yaw: number
  bank: number
  speedbar: boolean
  currentOrbScore: number
  bestOrbScore: number
  effect: PlayerEffectSnapshot
}

export interface OrbSnapshot {
  x: number
  y: number
  z: number
  holderSessionId: string
  lastTransferAtMs: number
}

export interface StartupCoinSnapshot {
  id: string
  startupId: string
  name: string
  iconUrl: string
  growth30d: number
  x: number
  y: number
  z: number
  spawnedAtMs: number
  expiresAtMs: number
}

export interface LeaderboardEntry {
  sessionId: string
  nickname: string
  score: number
}

export interface MultiplayerSessionState {
  connected: boolean
  localSessionId: string | null
  players: PlayerSnapshot[]
  remotePlayers: RemotePlayerSnapshot[]
  thermals: ThermalColumn[] | null
  orb: OrbSnapshot | null
  coins: StartupCoinSnapshot[]
  orbActive: boolean
  orbCountdownRemainingMs: number
  leaderboard: LeaderboardEntry[]
}
