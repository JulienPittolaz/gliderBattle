import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PlayerInput } from './types'

interface MobileControlsOverlayProps {
  enabled: boolean
  onInputChange: (input: PlayerInput) => void
}

const EMPTY_INPUT: PlayerInput = {
  yawLeft: false,
  yawRight: false,
  speedbar: false,
}

const VISUAL_AID_MS = 3800

export const MobileControlsOverlay = ({ enabled, onInputChange }: MobileControlsOverlayProps) => {
  const leftPointersRef = useRef<Set<number>>(new Set())
  const rightPointersRef = useRef<Set<number>>(new Set())
  const speedPointersRef = useRef<Set<number>>(new Set())
  const visualAidTimeoutRef = useRef<number | null>(null)
  const [leftActive, setLeftActive] = useState(false)
  const [rightActive, setRightActive] = useState(false)
  const [speedActive, setSpeedActive] = useState(false)
  const [showVisualAid, setShowVisualAid] = useState(true)

  const emitInput = useCallback(
    (leftCount: number, rightCount: number, speedCount: number) => {
      onInputChange({
        yawLeft: leftCount > 0,
        yawRight: rightCount > 0,
        speedbar: speedCount > 0,
      })
    },
    [onInputChange],
  )

  const resetAll = useCallback(() => {
    leftPointersRef.current.clear()
    rightPointersRef.current.clear()
    speedPointersRef.current.clear()
    setLeftActive(false)
    setRightActive(false)
    setSpeedActive(false)
    onInputChange(EMPTY_INPUT)
  }, [onInputChange])

  useEffect(() => {
    if (!enabled) {
      resetAll()
      setShowVisualAid(true)
      if (visualAidTimeoutRef.current !== null) {
        window.clearTimeout(visualAidTimeoutRef.current)
        visualAidTimeoutRef.current = null
      }
      return
    }

    setShowVisualAid(true)
    if (visualAidTimeoutRef.current !== null) {
      window.clearTimeout(visualAidTimeoutRef.current)
    }
    visualAidTimeoutRef.current = window.setTimeout(() => {
      setShowVisualAid(false)
      visualAidTimeoutRef.current = null
    }, VISUAL_AID_MS)

    return () => {
      if (visualAidTimeoutRef.current !== null) {
        window.clearTimeout(visualAidTimeoutRef.current)
        visualAidTimeoutRef.current = null
      }
    }
  }, [enabled, resetAll])

  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }
  }

  const onDown = (
    target: 'left' | 'right' | 'speed',
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (!enabled) {
      return
    }
    event.preventDefault()
    triggerHaptic()
    event.currentTarget.setPointerCapture(event.pointerId)
    if (target === 'left') {
      leftPointersRef.current.add(event.pointerId)
      setLeftActive(true)
    } else if (target === 'right') {
      rightPointersRef.current.add(event.pointerId)
      setRightActive(true)
    } else {
      speedPointersRef.current.add(event.pointerId)
      setSpeedActive(true)
    }
    emitInput(
      leftPointersRef.current.size,
      rightPointersRef.current.size,
      speedPointersRef.current.size,
    )
  }

  const onUp = (
    target: 'left' | 'right' | 'speed',
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    event.preventDefault()
    if (target === 'left') {
      leftPointersRef.current.delete(event.pointerId)
      setLeftActive(leftPointersRef.current.size > 0)
    } else if (target === 'right') {
      rightPointersRef.current.delete(event.pointerId)
      setRightActive(rightPointersRef.current.size > 0)
    } else {
      speedPointersRef.current.delete(event.pointerId)
      setSpeedActive(speedPointersRef.current.size > 0)
    }
    emitInput(
      leftPointersRef.current.size,
      rightPointersRef.current.size,
      speedPointersRef.current.size,
    )
  }

  if (!enabled) {
    return null
  }

  return (
    <div className={`mobile-controls${showVisualAid ? '' : ' mobile-controls--visual-hidden'}`}>
      <div
        className={`mobile-controls__steer mobile-controls__steer--left${leftActive ? ' mobile-controls__steer--active' : ''}`}
        onPointerDown={(event) => onDown('left', event)}
        onPointerUp={(event) => onUp('left', event)}
        onPointerCancel={(event) => onUp('left', event)}
      >
        <div className="mobile-controls__steer-pad" aria-hidden="true">
          <span className="mobile-controls__steer-icon">◀</span>
          <span className="mobile-controls__steer-label">TURN LEFT</span>
        </div>
      </div>
      <div
        className={`mobile-controls__steer mobile-controls__steer--right${rightActive ? ' mobile-controls__steer--active' : ''}`}
        onPointerDown={(event) => onDown('right', event)}
        onPointerUp={(event) => onUp('right', event)}
        onPointerCancel={(event) => onUp('right', event)}
      >
        <div className="mobile-controls__steer-pad" aria-hidden="true">
          <span className="mobile-controls__steer-icon">▶</span>
          <span className="mobile-controls__steer-label">TURN RIGHT</span>
        </div>
      </div>
      <button
        type="button"
        className={`mobile-controls__speedbar${speedActive ? ' mobile-controls__speedbar--active' : ''}`}
        onPointerDown={(event) => onDown('speed', event)}
        onPointerUp={(event) => onUp('speed', event)}
        onPointerCancel={(event) => onUp('speed', event)}
        aria-label="Hold speedbar"
      >
        <span className="mobile-controls__speedbar-label">SPEEDBAR</span>
        <span className="mobile-controls__speedbar-hint">HOLD</span>
      </button>
    </div>
  )
}
