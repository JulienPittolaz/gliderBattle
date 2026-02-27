import type { ThermalColumn } from '../game/thermals'

export interface LocalPoseMessage {
  x: number
  y: number
  z: number
  yaw: number
  bank: number
  speedbar: boolean
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
}

export interface OrbSnapshot {
  x: number
  y: number
  z: number
  holderSessionId: string
  lastTransferAtMs: number
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
  orbActive: boolean
  orbCountdownRemainingMs: number
  leaderboard: LeaderboardEntry[]
}
