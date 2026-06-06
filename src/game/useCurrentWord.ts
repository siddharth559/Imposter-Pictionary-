import { useEffect, useState } from 'react'
import { getCurrentWord } from '../firebase/gameFunctions'
import type { Room } from './types'

export function useCurrentWord(roomCode: string, room: Room | null, userId?: string) {
  const [word, setWord] = useState<string | null>(null)
  const isCurrentArtist = Boolean(userId && room?.currentArtistId === userId)

  useEffect(() => {
    if (!roomCode || room?.status !== 'playing' || !isCurrentArtist) {
      setWord(null)
      return undefined
    }

    let cancelled = false
    getCurrentWord(roomCode)
      .then((nextWord) => {
        if (!cancelled) setWord(nextWord)
      })
      .catch(() => {
        if (!cancelled) setWord(null)
      })

    return () => {
      cancelled = true
    }
  }, [roomCode, room?.roundId, room?.status, isCurrentArtist])

  return word
}
