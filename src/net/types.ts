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
  updatedAtMs: number
}

export interface MultiplayerSessionState {
  connected: boolean
  localSessionId: string | null
  remotePlayers: RemotePlayerSnapshot[]
  thermals: ThermalColumn[] | null
}
