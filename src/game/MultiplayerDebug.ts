export type RemoteSmoothingMode = 'lerp' | 'hermite'

export interface MultiplayerDebugConfig {
  smoothingMode: RemoteSmoothingMode
  interpDelayMs: number
  maxExtrapolationMs: number
}

export const useMultiplayerDebug = (): MultiplayerDebugConfig => {
  return {
    smoothingMode: 'lerp',
    interpDelayMs: 80,
    maxExtrapolationMs: 20,
  }
}
