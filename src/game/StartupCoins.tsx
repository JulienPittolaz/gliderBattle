import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { StartupCoinSnapshot } from '../net/types'

interface StartupCoinsProps {
  coins: StartupCoinSnapshot[]
}

interface StartupCoinProps {
  coin: StartupCoinSnapshot
}

const TEXTURE_SIZE = 160

const formatBadgeText = (name: string) => {
  const compact = name.replace(/[^a-z0-9]/gi, '').toUpperCase()
  return compact.slice(0, 2) || '?'
}

const createFallbackTexture = (name: string) => {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE

  const context = canvas.getContext('2d')
  if (!context) {
    return new THREE.CanvasTexture(canvas)
  }

  const gradient = context.createLinearGradient(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
  gradient.addColorStop(0, '#fff2bb')
  gradient.addColorStop(1, '#e89d39')
  context.fillStyle = gradient
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)

  context.fillStyle = 'rgba(44, 23, 6, 0.18)'
  context.beginPath()
  context.arc(TEXTURE_SIZE * 0.52, TEXTURE_SIZE * 0.48, TEXTURE_SIZE * 0.32, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#3c2006'
  context.font = '700 58px ui-sans-serif, system-ui, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(formatBadgeText(name), TEXTURE_SIZE / 2, TEXTURE_SIZE / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

const useCoinTexture = (coin: StartupCoinSnapshot) => {
  const fallbackTexture = useMemo(() => createFallbackTexture(coin.name), [coin.name])
  const [texture, setTexture] = useState<THREE.Texture>(fallbackTexture)

  useEffect(() => {
    setTexture(fallbackTexture)
  }, [fallbackTexture])

  useEffect(() => {
    if (!coin.iconUrl) {
      return
    }

    let cancelled = false
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')

    loader.load(
      coin.iconUrl,
      (loaded) => {
        if (cancelled) {
          loaded.dispose()
          return
        }
        loaded.colorSpace = THREE.SRGBColorSpace
        setTexture(loaded)
      },
      undefined,
      () => {
        if (!cancelled) {
          setTexture(fallbackTexture)
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [coin.iconUrl, fallbackTexture])

  useEffect(() => {
    return () => {
      fallbackTexture.dispose()
      if (texture !== fallbackTexture) {
        texture.dispose()
      }
    }
  }, [fallbackTexture, texture])

  return texture
}

const StartupCoin = ({ coin }: StartupCoinProps) => {
  const rootRef = useRef<THREE.Group>(null)
  const elapsedRef = useRef(0)
  const texture = useCoinTexture(coin)

  useFrame((_, delta) => {
    const root = rootRef.current
    if (!root) {
      return
    }

    elapsedRef.current += delta
    const t = elapsedRef.current
    const bob = Math.sin(t * 2.2 + coin.spawnedAtMs * 0.001) * 0.22
    const target = new THREE.Vector3(coin.x, coin.y + bob, coin.z)
    const blend = 1 - Math.exp(-14 * delta)
    root.position.lerp(target, blend)
    root.rotation.y += delta * 1.9
    root.rotation.z = Math.sin(t * 1.4) * 0.06
  })

  return (
    <group ref={rootRef} position={[coin.x, coin.y, coin.z]}>
      <mesh>
        <circleGeometry args={[0.92, 40]} />
        <meshBasicMaterial
          map={texture}
          transparent
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

export const StartupCoins = ({ coins }: StartupCoinsProps) => {
  if (coins.length === 0) {
    return null
  }

  return (
    <>
      {coins.map((coin) => (
        <StartupCoin key={coin.id} coin={coin} />
      ))}
    </>
  )
}
