import { useEffect, useState } from 'react'
import type { PlayerInput } from './types'

const KEY_MAPPINGS: Record<string, keyof PlayerInput> = {
  a: 'yawLeft',
  arrowleft: 'yawLeft',
  d: 'yawRight',
  arrowright: 'yawRight',
  ' ': 'speedbar',
  space: 'speedbar',
  spacebar: 'speedbar',
}

const INITIAL_INPUT: PlayerInput = {
  yawLeft: false,
  yawRight: false,
  speedbar: false,
}

export const useKeyboard = () => {
  const [input, setInput] = useState<PlayerInput>(INITIAL_INPUT)

  useEffect(() => {
    const onKey = (pressed: boolean) => (event: KeyboardEvent) => {
      const mapped = KEY_MAPPINGS[event.key.toLowerCase()]
      if (!mapped) {
        return
      }

      event.preventDefault()
      setInput((current) =>
        current[mapped] === pressed ? current : { ...current, [mapped]: pressed },
      )
    }

    const onBlur = () => setInput(INITIAL_INPUT)

    const onKeyDown = onKey(true)
    const onKeyUp = onKey(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return input
}
