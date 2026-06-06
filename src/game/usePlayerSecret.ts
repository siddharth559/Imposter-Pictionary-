import { useEffect, useState } from 'react'
import { getPlayerSecret } from '../firebase/gameFunctions'
import type { Room } from './types'

export function usePlayerSecret(roomCode: string, room: Room | null, userId?: string) {
  const [isImposter, setIsImposter] = useState(false)

  useEffect(() => {
    if (!roomCode || !userId || room?.status !== 'playing') {
      setIsImposter(false)
      return undefined
    }

    let cancelled = false
    getPlayerSecret(roomCode)
      .then((secret) => {
        if (!cancelled) setIsImposter(secret.isImposter)
      })
      .catch(() => {
        if (!cancelled) setIsImposter(false)
      })

    return () => {
      cancelled = true
    }
  }, [roomCode, room?.roundId, room?.status, userId])

  return { isImposter }
}
