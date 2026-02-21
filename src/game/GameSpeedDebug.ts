import { useControls } from 'leva'

export const useGameSpeedDebug = () => {
  const { gameSpeed } = useControls('Game Speed', {
    gameSpeed: {
      value: 2,
      min: 0.25,
      max: 3,
      step: 0.05,
    },
  })

  return gameSpeed
}
