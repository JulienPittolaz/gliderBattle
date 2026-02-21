import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ParagliderModel } from './ParagliderModel'
import type { RemotePlayerSnapshot } from '../net/types'
import type { RemoteSmoothingMode } from './MultiplayerDebug'

interface RemotePlayersProps {
  players: RemotePlayerSnapshot[]
  smoothingMode?: RemoteSmoothingMode
  interpDelayMs?: number
  maxExtrapolationMs?: number
}

const DEFAULT_INTERP_DELAY_MS = 190
const DEFAULT_MAX_EXTRAPOLATION_MS = 110
const MAX_SNAPSHOTS = 28

interface PoseSnapshot {
  t: number
  x: number
  y: number
  z: number
  yaw: number
  bank: number
  speedbar: boolean
}

interface VelocitySample {
  vx: number
  vy: number
  vz: number
}

const lerpAngle = (a: number, b: number, t: number) => {
  let delta = (b - a) % (Math.PI * 2)
  if (delta > Math.PI) {
    delta -= Math.PI * 2
  } else if (delta < -Math.PI) {
    delta += Math.PI * 2
  }
  return a + delta * t
}

const zeroVelocity: VelocitySample = { vx: 0, vy: 0, vz: 0 }

const estimateVelocity = (samples: PoseSnapshot[], index: number): VelocitySample => {
  const current = samples[index]
  const prev = index > 0 ? samples[index - 1] : null
  const next = index < samples.length - 1 ? samples[index + 1] : null

  if (prev && next) {
    const dt = Math.max(next.t - prev.t, 1)
    return {
      vx: (next.x - prev.x) / dt,
      vy: (next.y - prev.y) / dt,
      vz: (next.z - prev.z) / dt,
    }
  }
  if (next) {
    const dt = Math.max(next.t - current.t, 1)
    return {
      vx: (next.x - current.x) / dt,
      vy: (next.y - current.y) / dt,
      vz: (next.z - current.z) / dt,
    }
  }
  if (prev) {
    const dt = Math.max(current.t - prev.t, 1)
    return {
      vx: (current.x - prev.x) / dt,
      vy: (current.y - prev.y) / dt,
      vz: (current.z - prev.z) / dt,
    }
  }
  return zeroVelocity
}

const hermitePosition = (
  p0: number,
  p1: number,
  v0: number,
  v1: number,
  tNorm: number,
  dtMs: number,
) => {
  const t2 = tNorm * tNorm
  const t3 = t2 * tNorm
  const m0 = v0 * dtMs
  const m1 = v1 * dtMs
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + tNorm
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2
  return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1
}

interface RemoteGliderProps {
  snapshot: RemotePlayerSnapshot
  smoothingMode: RemoteSmoothingMode
  interpDelayMs: number
  maxExtrapolationMs: number
}

const RemoteGlider = ({
  snapshot,
  smoothingMode,
  interpDelayMs,
  maxExtrapolationMs,
}: RemoteGliderProps) => {
  const groupRef = useRef<THREE.Group>(null)
  const bankRef = useRef(snapshot.bank)
  const speedbarRef = useRef(snapshot.speedbar)
  const snapshotsRef = useRef<PoseSnapshot[]>([])
  const targetPositionRef = useRef(new THREE.Vector3(snapshot.x, snapshot.y, snapshot.z))
  const targetYawRef = useRef(snapshot.yaw)

  useEffect(() => {
    const entry: PoseSnapshot = {
      t: snapshot.updatedAtMs,
      x: snapshot.x,
      y: snapshot.y,
      z: snapshot.z,
      yaw: snapshot.yaw,
      bank: snapshot.bank,
      speedbar: snapshot.speedbar,
    }
    const snapshots = snapshotsRef.current
    const last = snapshots[snapshots.length - 1]
    if (!last || entry.t >= last.t) {
      snapshots.push(entry)
      if (snapshots.length > MAX_SNAPSHOTS) {
        snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS)
      }
    }
  }, [snapshot])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) {
      return
    }

    const snapshots = snapshotsRef.current
    if (snapshots.length === 0) {
      return
    }

    const now = performance.now()
    const renderTime = now - interpDelayMs

    const oldestUseful = now - 2000
    while (snapshots.length > 2 && snapshots[1].t < oldestUseful) {
      snapshots.shift()
    }
    let prevIndex = 0
    let nextIndex = -1

    for (let i = 0; i < snapshots.length; i += 1) {
      const candidate = snapshots[i]
      if (candidate.t <= renderTime) {
        prevIndex = i
      }
      if (candidate.t >= renderTime) {
        nextIndex = i
        break
      }
    }

    const prev = snapshots[prevIndex]
    const next = nextIndex >= 0 ? snapshots[nextIndex] : null

    let x = prev.x
    let y = prev.y
    let z = prev.z
    let yaw = prev.yaw
    let bank = prev.bank
    let speedbar = prev.speedbar

    if (next && next.t > prev.t) {
      const dt = Math.max(next.t - prev.t, 1)
      const alpha = THREE.MathUtils.clamp((renderTime - prev.t) / dt, 0, 1)
      const vPrev = estimateVelocity(snapshots, prevIndex)
      const vNext = estimateVelocity(snapshots, nextIndex)
      if (smoothingMode === 'hermite') {
        x = hermitePosition(prev.x, next.x, vPrev.vx, vNext.vx, alpha, dt)
        y = hermitePosition(prev.y, next.y, vPrev.vy, vNext.vy, alpha, dt)
        z = hermitePosition(prev.z, next.z, vPrev.vz, vNext.vz, alpha, dt)
      } else {
        x = THREE.MathUtils.lerp(prev.x, next.x, alpha)
        y = THREE.MathUtils.lerp(prev.y, next.y, alpha)
        z = THREE.MathUtils.lerp(prev.z, next.z, alpha)
      }
      yaw = lerpAngle(prev.yaw, next.yaw, alpha)
      bank = THREE.MathUtils.lerp(prev.bank, next.bank, alpha)
      speedbar = alpha < 0.5 ? prev.speedbar : next.speedbar
    } else if (snapshots.length >= 2) {
      const last = snapshots[snapshots.length - 1]
      const beforeLast = snapshots[snapshots.length - 2]
      const dt = Math.max(last.t - beforeLast.t, 1)
      const ext = Math.min(Math.max(renderTime - last.t, 0), maxExtrapolationMs)
      const vx = (last.x - beforeLast.x) / dt
      const vy = (last.y - beforeLast.y) / dt
      const vz = (last.z - beforeLast.z) / dt
      x = last.x + vx * ext
      y = last.y + vy * ext
      z = last.z + vz * ext
      yaw = last.yaw
      bank = last.bank
      speedbar = last.speedbar
    }

    targetPositionRef.current.set(x, y, z)
    targetYawRef.current = yaw
    bankRef.current = bank
    speedbarRef.current = speedbar

    const blend = 1 - Math.exp(-14 * delta)
    group.position.lerp(targetPositionRef.current, blend)
    group.rotation.y = lerpAngle(group.rotation.y, targetYawRef.current, blend)
  })

  return (
    <group ref={groupRef} position={[snapshot.x, snapshot.y, snapshot.z]} rotation={[0, snapshot.yaw, 0]}>
      <group scale={0.58}>
        <ParagliderModel bankRef={bankRef} speedbarRef={speedbarRef} />
      </group>
    </group>
  )
}

export const RemotePlayers = ({
  players,
  smoothingMode = 'hermite',
  interpDelayMs = DEFAULT_INTERP_DELAY_MS,
  maxExtrapolationMs = DEFAULT_MAX_EXTRAPOLATION_MS,
}: RemotePlayersProps) => (
  <>
    {players.map((snapshot) => (
      <RemoteGlider
        key={snapshot.sessionId}
        snapshot={snapshot}
        smoothingMode={smoothingMode}
        interpDelayMs={interpDelayMs}
        maxExtrapolationMs={maxExtrapolationMs}
      />
    ))}
  </>
)
