import { useControls } from 'leva'

export type RemoteSmoothingMode = 'lerp' | 'hermite'

export interface MultiplayerDebugConfig {
  smoothingMode: RemoteSmoothingMode
  interpDelayMs: number
  maxExtrapolationMs: number
}

export const useMultiplayerDebug = (): MultiplayerDebugConfig => {
  const { smoothingMode, interpDelayMs, maxExtrapolationMs } = useControls('Multiplayer', {
    smoothingMode: {
      options: {
        Hermite: 'hermite',
        Lerp: 'lerp',
      },
      value: 'lerp',
    },
    interpDelayMs: {
      value: 80,
      min: 80,
      max: 320,
      step: 1,
    },
    maxExtrapolationMs: {
      value: 20,
      min: 20,
      max: 240,
      step: 1,
    },
  })

  return {
    smoothingMode: smoothingMode as RemoteSmoothingMode,
    interpDelayMs,
    maxExtrapolationMs,
  }
}
