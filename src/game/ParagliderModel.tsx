import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import * as THREE from 'three'
import {
  PARAGLIDER_ANIM_BRAKE_PULL,
  PARAGLIDER_ANIM_LEG_SPEEDBAR,
  PARAGLIDER_ANIM_STRAP_SWAY,
  PARAGLIDER_ARC,
  PARAGLIDER_CANOPY_Y,
  PARAGLIDER_CELL_COUNT,
  PARAGLIDER_CHORD,
  PARAGLIDER_HARNESS_Y,
  PARAGLIDER_PILOT_OFFSET_Y,
  PARAGLIDER_SPAN,
} from './constants'

interface ParagliderModelProps {
  bankRef: RefObject<number>
  speedbarRef: RefObject<boolean>
}

interface CellDescriptor {
  id: number
  x: number
  y: number
  z: number
  pitch: number
  yaw: number
  width: number
  depth: number
  color: string
  shade: string
}

const CANOPY_COLORS = ['#ff5f52', '#ffd86a', '#5cb7ff']
const HARNESS_COLOR = '#2b3138'
const HARNESS_SHADE = '#1f252d'
const FABRIC_DARK = '#20262e'
const FABRIC_MID = '#313a45'
const PILOT_SUIT = '#2e4f8c'
const PILOT_ACCENT = '#f29a4a'
const RISER_BASE_LEFT = new THREE.Vector3(-0.2, PARAGLIDER_HARNESS_Y + 0.18, 0.08)
const RISER_BASE_RIGHT = new THREE.Vector3(0.2, PARAGLIDER_HARNESS_Y + 0.18, 0.08)
const RISER_HEAD_LEFT = new THREE.Vector3(
  -0.17,
  PARAGLIDER_HARNESS_Y + PARAGLIDER_PILOT_OFFSET_Y + 0.4,
  0.02,
)
const RISER_HEAD_RIGHT = new THREE.Vector3(
  0.17,
  PARAGLIDER_HARNESS_Y + PARAGLIDER_PILOT_OFFSET_Y + 0.4,
  0.02,
)
const RISER_HEAD_CENTER = new THREE.Vector3(
  0,
  PARAGLIDER_HARNESS_Y + PARAGLIDER_PILOT_OFFSET_Y + 0.39,
  0.02,
)

const createCellDescriptors = (): CellDescriptor[] => {
  const halfSpan = PARAGLIDER_SPAN * 0.5
  const baseCellWidth = PARAGLIDER_SPAN / PARAGLIDER_CELL_COUNT

  return Array.from({ length: PARAGLIDER_CELL_COUNT }, (_, index) => {
    const x = -halfSpan + baseCellWidth * (index + 0.5)
    const sideT = Math.abs(x) / Math.max(halfSpan, Number.EPSILON)
    const y = Math.cos(sideT * Math.PI * 0.5) * PARAGLIDER_ARC
    const z = -0.1 - sideT * 0.34
    const pitch = -0.1 + sideT * 0.12
    const yaw = (x / Math.max(halfSpan, Number.EPSILON)) * 0.19
    const width = baseCellWidth * 0.96
    const depth = PARAGLIDER_CHORD * THREE.MathUtils.lerp(1, 0.76, sideT)
    const color = CANOPY_COLORS[index % CANOPY_COLORS.length]
    const shade = new THREE.Color(color).offsetHSL(0, -0.1, -0.14).getStyle()
    return { id: index, x, y, z, pitch, yaw, width, depth, color, shade }
  })
}

const createLineGeometry = (cells: CellDescriptor[]) => {
  const brakeLeft = new THREE.Vector3(
    RISER_HEAD_LEFT.x - 0.09,
    RISER_HEAD_LEFT.y - 0.04,
    RISER_HEAD_LEFT.z + 0.08,
  )
  const brakeRight = new THREE.Vector3(
    RISER_HEAD_RIGHT.x + 0.09,
    RISER_HEAD_RIGHT.y - 0.04,
    RISER_HEAD_RIGHT.z + 0.08,
  )

  const positions: number[] = []

  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i]
    const t = i / Math.max(cells.length - 1, 1)
    const topFront = new THREE.Vector3(cell.x, PARAGLIDER_CANOPY_Y + cell.y - 0.06, cell.z + 0.1)
    const topRear = new THREE.Vector3(cell.x, PARAGLIDER_CANOPY_Y + cell.y - 0.09, cell.z - 0.18)

    const riserAnchor = cell.x < 0 ? RISER_HEAD_LEFT : RISER_HEAD_RIGHT

    positions.push(topFront.x, topFront.y, topFront.z)
    positions.push(riserAnchor.x, riserAnchor.y, riserAnchor.z)

    positions.push(topRear.x, topRear.y, topRear.z)
    positions.push(riserAnchor.x, riserAnchor.y, riserAnchor.z)

    if (i % 3 === 0) {
      const brakeAnchor = cell.x < 0 ? brakeLeft : brakeRight
      positions.push(topRear.x, topRear.y, topRear.z)
      positions.push(brakeAnchor.x, brakeAnchor.y, brakeAnchor.z)
    }

    if (t > 0.28 && t < 0.72 && i % 2 === 0) {
      positions.push(topFront.x, topFront.y, topFront.z)
      positions.push(RISER_HEAD_CENTER.x, RISER_HEAD_CENTER.y, RISER_HEAD_CENTER.z)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}

export const ParagliderModel = ({ bankRef, speedbarRef }: ParagliderModelProps) => {
  const rigRef = useRef<THREE.Group>(null)
  const elapsedRef = useRef(0)
  const bankSmoothRef = useRef(0)
  const speedbarSmoothRef = useRef(0)
  const leftArmRef = useRef<THREE.Group>(null)
  const rightArmRef = useRef<THREE.Group>(null)
  const legsRef = useRef<THREE.Group>(null)
  const leftBrakeRef = useRef<THREE.Group>(null)
  const rightBrakeRef = useRef<THREE.Group>(null)
  const leftStrapRef = useRef<THREE.Group>(null)
  const rightStrapRef = useRef<THREE.Group>(null)

  const cells = useMemo(() => createCellDescriptors(), [])
  const lineGeometry = useMemo(() => createLineGeometry(cells), [cells])

  useFrame((_, delta) => {
    const rig = rigRef.current
    if (!rig) {
      return
    }
    elapsedRef.current += delta

    const targetBank = THREE.MathUtils.clamp(bankRef.current ?? 0, -1, 1)
    bankSmoothRef.current = THREE.MathUtils.lerp(
      bankSmoothRef.current,
      targetBank,
      1 - Math.exp(-8 * delta),
    )

    const targetSpeedbar = speedbarRef.current ? 1 : 0
    speedbarSmoothRef.current = THREE.MathUtils.lerp(
      speedbarSmoothRef.current,
      targetSpeedbar,
      1 - Math.exp(-6 * delta),
    )

    const t = elapsedRef.current
    const flap = Math.sin(t * 2.1) * 0.018
    const bank = bankSmoothRef.current
    const speed = speedbarSmoothRef.current

    rig.rotation.z = bank * 0.34
    rig.rotation.x = -0.04 + flap + speed * 0.08
    rig.position.y = Math.sin(t * 1.35) * 0.03
    rig.position.z = speed * 0.06

    const leftArm = leftArmRef.current
    const rightArm = rightArmRef.current
    const legs = legsRef.current
    const leftBrake = leftBrakeRef.current
    const rightBrake = rightBrakeRef.current
    const leftStrap = leftStrapRef.current
    const rightStrap = rightStrapRef.current

    if (leftArm) {
      leftArm.rotation.x = -0.42 + Math.max(0, bank) * PARAGLIDER_ANIM_BRAKE_PULL + speed * 0.04
      leftArm.rotation.z = -0.18 - bank * 0.14
    }
    if (rightArm) {
      rightArm.rotation.x = -0.42 + Math.max(0, -bank) * PARAGLIDER_ANIM_BRAKE_PULL + speed * 0.04
      rightArm.rotation.z = 0.18 - bank * 0.14
    }
    if (legs) {
      legs.rotation.x = 0.18 + speed * PARAGLIDER_ANIM_LEG_SPEEDBAR
      legs.position.z = 0.22 + speed * 0.05
    }
    if (leftBrake) {
      leftBrake.rotation.x = 0.2 + Math.max(0, bank) * 0.28
    }
    if (rightBrake) {
      rightBrake.rotation.x = 0.2 + Math.max(0, -bank) * 0.28
    }
    if (leftStrap) {
      leftStrap.rotation.z = -0.08 + bank * PARAGLIDER_ANIM_STRAP_SWAY
    }
    if (rightStrap) {
      rightStrap.rotation.z = 0.08 + bank * PARAGLIDER_ANIM_STRAP_SWAY
    }
  })

  return (
    <group ref={rigRef} rotation={[0, Math.PI, 0]}>
      <group position={[0, PARAGLIDER_CANOPY_Y, 0]}>
        {cells.map((cell) => (
          <group
            key={`canopy-cell-${cell.id}`}
            position={[cell.x, cell.y, cell.z]}
            rotation={[cell.pitch, cell.yaw, 0]}
          >
            <mesh castShadow>
              <boxGeometry args={[cell.width, 0.16, cell.depth]} />
              <meshStandardMaterial color={cell.color} roughness={0.86} metalness={0.03} flatShading />
            </mesh>
            <mesh castShadow position={[0, -0.08, cell.depth * 0.42]}>
              <boxGeometry args={[cell.width * 0.76, 0.055, cell.depth * 0.2]} />
              <meshStandardMaterial color={cell.shade} roughness={0.92} metalness={0} flatShading />
            </mesh>
            <mesh castShadow position={[-cell.width * 0.45, 0, 0]}>
              <boxGeometry args={[cell.width * 0.075, 0.14, cell.depth * 0.9]} />
              <meshStandardMaterial color={cell.shade} roughness={0.92} metalness={0} flatShading />
            </mesh>
            <mesh castShadow position={[cell.width * 0.45, 0, 0]}>
              <boxGeometry args={[cell.width * 0.075, 0.14, cell.depth * 0.9]} />
              <meshStandardMaterial color={cell.shade} roughness={0.92} metalness={0} flatShading />
            </mesh>
          </group>
        ))}
      </group>

      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color="#d8e4f5" transparent opacity={0.78} />
      </lineSegments>

      <group>
        <mesh castShadow position={[-0.185, (RISER_BASE_LEFT.y + RISER_HEAD_LEFT.y) * 0.5, 0.05]} rotation={[0.15, 0.08, -0.1]}>
          <boxGeometry args={[0.045, 0.5, 0.03]} />
          <meshStandardMaterial color="#d9dfe8" roughness={0.76} metalness={0.05} flatShading />
        </mesh>
        <mesh castShadow position={[0.185, (RISER_BASE_RIGHT.y + RISER_HEAD_RIGHT.y) * 0.5, 0.05]} rotation={[0.15, -0.08, 0.1]}>
          <boxGeometry args={[0.045, 0.5, 0.03]} />
          <meshStandardMaterial color="#d9dfe8" roughness={0.76} metalness={0.05} flatShading />
        </mesh>
        <mesh castShadow position={[RISER_BASE_LEFT.x, RISER_BASE_LEFT.y, RISER_BASE_LEFT.z]} rotation={[Math.PI * 0.5, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.06, 6]} />
          <meshStandardMaterial color="#f0f2f6" roughness={0.52} metalness={0.18} flatShading />
        </mesh>
        <mesh castShadow position={[RISER_BASE_RIGHT.x, RISER_BASE_RIGHT.y, RISER_BASE_RIGHT.z]} rotation={[Math.PI * 0.5, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.06, 6]} />
          <meshStandardMaterial color="#f0f2f6" roughness={0.52} metalness={0.18} flatShading />
        </mesh>
        <mesh castShadow position={[RISER_HEAD_LEFT.x, RISER_HEAD_LEFT.y, RISER_HEAD_LEFT.z]} rotation={[Math.PI * 0.5, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.065, 6]} />
          <meshStandardMaterial color="#f0f2f6" roughness={0.52} metalness={0.18} flatShading />
        </mesh>
        <mesh castShadow position={[RISER_HEAD_RIGHT.x, RISER_HEAD_RIGHT.y, RISER_HEAD_RIGHT.z]} rotation={[Math.PI * 0.5, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.065, 6]} />
          <meshStandardMaterial color="#f0f2f6" roughness={0.52} metalness={0.18} flatShading />
        </mesh>
      </group>

      <group position={[0, PARAGLIDER_HARNESS_Y, 0.05]}>
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.24, 0.5]} />
            <meshStandardMaterial color={HARNESS_COLOR} roughness={0.88} metalness={0.04} flatShading />
          </mesh>
          <mesh castShadow position={[0, 0.23, -0.22]}>
            <boxGeometry args={[0.42, 0.32, 0.26]} />
            <meshStandardMaterial color={FABRIC_MID} roughness={0.86} metalness={0.04} flatShading />
          </mesh>
          <mesh castShadow position={[0, -0.1, 0.14]}>
            <boxGeometry args={[0.46, 0.09, 0.24]} />
            <meshStandardMaterial color={HARNESS_SHADE} roughness={0.93} metalness={0.02} flatShading />
          </mesh>

          <mesh castShadow position={[0, 0.0, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.15, 0.21, 0.42, 6, 1]} />
            <meshStandardMaterial color={FABRIC_DARK} roughness={0.9} metalness={0.02} flatShading />
          </mesh>
          <mesh castShadow position={[0, 0.0, 0.53]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.14, 0.15, 6, 1]} />
            <meshStandardMaterial color={FABRIC_DARK} roughness={0.9} metalness={0.02} flatShading />
          </mesh>

          <mesh castShadow position={[0, 0.15, 0.42]}>
            <boxGeometry args={[0.36, 0.09, 0.2]} />
            <meshStandardMaterial color="#3a454f" roughness={0.85} metalness={0.03} flatShading />
          </mesh>
          <mesh castShadow position={[0, 0.18, 0.45]}>
            <boxGeometry args={[0.24, 0.045, 0.08]} />
            <meshStandardMaterial color="#7f93aa" roughness={0.65} metalness={0.08} flatShading />
          </mesh>

          <mesh castShadow position={[-0.28, 0.14, -0.02]}>
            <boxGeometry args={[0.16, 0.16, 0.25]} />
            <meshStandardMaterial color="#c74f4f" roughness={0.85} metalness={0.03} flatShading />
          </mesh>
          <mesh castShadow position={[-0.35, 0.15, -0.02]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.018, 0.018, 0.12, 6]} />
            <meshStandardMaterial color="#f2f4f8" roughness={0.45} metalness={0.18} flatShading />
          </mesh>

          <group ref={leftStrapRef} position={[-0.2, 0.32, 0.08]}>
            <mesh castShadow>
              <boxGeometry args={[0.07, 0.34, 0.045]} />
              <meshStandardMaterial color="#1a2028" roughness={0.93} metalness={0.01} flatShading />
            </mesh>
          </group>
          <group ref={rightStrapRef} position={[0.2, 0.32, 0.08]}>
            <mesh castShadow>
              <boxGeometry args={[0.07, 0.34, 0.045]} />
              <meshStandardMaterial color="#1a2028" roughness={0.93} metalness={0.01} flatShading />
            </mesh>
          </group>

          <mesh castShadow position={[-0.26, 0.17, 0.11]} rotation={[0, 0, 0.2]}>
            <boxGeometry args={[0.12, 0.09, 0.2]} />
            <meshStandardMaterial color="#2a3038" roughness={0.9} metalness={0.02} flatShading />
          </mesh>
          <mesh castShadow position={[0.26, 0.17, 0.11]} rotation={[0, 0, -0.2]}>
            <boxGeometry args={[0.12, 0.09, 0.2]} />
            <meshStandardMaterial color="#2a3038" roughness={0.9} metalness={0.02} flatShading />
          </mesh>
        </group>

        <group position={[0, PARAGLIDER_PILOT_OFFSET_Y, -0.04]}>
          <mesh castShadow position={[0, 0.06, -0.12]}>
            <boxGeometry args={[0.32, 0.42, 0.22]} />
            <meshStandardMaterial color={PILOT_SUIT} roughness={0.84} metalness={0.03} flatShading />
          </mesh>
          <mesh castShadow position={[0, 0.23, -0.15]}>
            <boxGeometry args={[0.26, 0.14, 0.11]} />
            <meshStandardMaterial color={PILOT_ACCENT} roughness={0.78} metalness={0.03} flatShading />
          </mesh>

          <mesh castShadow position={[0, 0.42, -0.17]}>
            <icosahedronGeometry args={[0.12, 0]} />
            <meshStandardMaterial color="#d9e2ec" roughness={0.74} metalness={0.04} flatShading />
          </mesh>
          <mesh castShadow position={[0, 0.39, -0.06]}>
            <boxGeometry args={[0.19, 0.07, 0.06]} />
            <meshStandardMaterial color="#262d35" roughness={0.58} metalness={0.16} flatShading />
          </mesh>

          <group ref={leftArmRef} position={[-0.22, 0.16, -0.1]}>
            <mesh castShadow position={[0, -0.09, 0]}>
              <boxGeometry args={[0.09, 0.24, 0.09]} />
              <meshStandardMaterial color={PILOT_SUIT} roughness={0.84} metalness={0.03} flatShading />
            </mesh>
            <mesh castShadow position={[0, -0.27, 0.04]}>
              <boxGeometry args={[0.08, 0.2, 0.08]} />
              <meshStandardMaterial color="#4f5f74" roughness={0.86} metalness={0.02} flatShading />
            </mesh>
            <group ref={leftBrakeRef} position={[0, -0.38, 0.08]}>
              <mesh castShadow rotation={[0, 0, Math.PI * 0.5]}>
                <cylinderGeometry args={[0.014, 0.014, 0.1, 6]} />
                <meshStandardMaterial color="#f29a4a" roughness={0.68} metalness={0.06} flatShading />
              </mesh>
            </group>
          </group>

          <group ref={rightArmRef} position={[0.22, 0.16, -0.1]}>
            <mesh castShadow position={[0, -0.09, 0]}>
              <boxGeometry args={[0.09, 0.24, 0.09]} />
              <meshStandardMaterial color={PILOT_SUIT} roughness={0.84} metalness={0.03} flatShading />
            </mesh>
            <mesh castShadow position={[0, -0.27, 0.04]}>
              <boxGeometry args={[0.08, 0.2, 0.08]} />
              <meshStandardMaterial color="#4f5f74" roughness={0.86} metalness={0.02} flatShading />
            </mesh>
            <group ref={rightBrakeRef} position={[0, -0.38, 0.08]}>
              <mesh castShadow rotation={[0, 0, Math.PI * 0.5]}>
                <cylinderGeometry args={[0.014, 0.014, 0.1, 6]} />
                <meshStandardMaterial color="#f29a4a" roughness={0.68} metalness={0.06} flatShading />
              </mesh>
            </group>
          </group>

          <group ref={legsRef} position={[0, -0.15, 0.22]}>
            <mesh castShadow position={[-0.09, -0.11, 0.02]}>
              <boxGeometry args={[0.12, 0.24, 0.14]} />
              <meshStandardMaterial color="#2f4b7e" roughness={0.88} metalness={0.02} flatShading />
            </mesh>
            <mesh castShadow position={[0.09, -0.11, 0.02]}>
              <boxGeometry args={[0.12, 0.24, 0.14]} />
              <meshStandardMaterial color="#2f4b7e" roughness={0.88} metalness={0.02} flatShading />
            </mesh>
            <mesh castShadow position={[-0.09, -0.22, 0.16]}>
              <boxGeometry args={[0.11, 0.12, 0.22]} />
              <meshStandardMaterial color="#2a3442" roughness={0.86} metalness={0.03} flatShading />
            </mesh>
            <mesh castShadow position={[0.09, -0.22, 0.16]}>
              <boxGeometry args={[0.11, 0.12, 0.22]} />
              <meshStandardMaterial color="#2a3442" roughness={0.86} metalness={0.03} flatShading />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
