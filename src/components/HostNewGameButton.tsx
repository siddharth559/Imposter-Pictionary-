import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom, PLAYER_NAME_STORAGE_KEY } from '../firebase/rooms'

type HostNewGameButtonProps = {
  className?: string
  onError?: (message: string) => void
}

export function HostNewGameButton({ className = 'primary-button', onError }: HostNewGameButtonProps) {
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)

  async function handleNewGame() {
    setIsCreating(true)
    try {
      const playerName = localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? 'Player'
      const roomCode = await createRoom(playerName)
      navigate(`/lobby/${roomCode}`)
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Could not create a new game.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <button className={className} type="button" onClick={handleNewGame} disabled={isCreating}>
      {isCreating ? 'Creating...' : 'Host New Game'}
    </button>
  )
}
