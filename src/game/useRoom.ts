import { useEffect, useState } from 'react'
import { listenToRoom } from '../firebase/rooms'
import type { Room } from './types'

export function useRoom(roomCode?: string) {
  const [room, setRoom] = useState<Room | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(roomCode))

  useEffect(() => {
    if (!roomCode) {
      setRoom(null)
      setIsLoading(false)
      return undefined
    }

    setIsLoading(true)
    const unsubscribe = listenToRoom(roomCode, (nextRoom) => {
      setRoom(nextRoom)
      setIsLoading(false)
    })

    return unsubscribe
  }, [roomCode])

  return { room, isLoading }
}
