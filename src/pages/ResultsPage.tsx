import { Link, useParams } from 'react-router-dom'
import { HostNewGameButton } from '../components/HostNewGameButton'
import { Scoreboard } from '../components/Scoreboard'
import { normalizeRoomCode } from '../firebase/rooms'
import { useRoom } from '../game/useRoom'
import type { PlayerSlot } from '../game/types'

export function ResultsPage() {
  const { roomCode: roomCodeParam = 'ROOM' } = useParams()
  const roomCode = normalizeRoomCode(roomCodeParam)
  const { room } = useRoom(roomCode)
  const players = room?.players
    ? Object.entries(room.players).map<PlayerSlot>(([uid, player]) => ({
        id: uid,
        name: player.name,
        isHost: uid === room.hostId,
        online: player.online,
        actualScore: player.actualScore,
        publicScore: player.publicScore,
      }))
    : []

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="eyebrow">Game Ended</p>
        <h1>{roomCode}</h1>
      </header>
      <Scoreboard players={players} />
      <HostNewGameButton />
      <Link className="button-link" to="/">
        Home
      </Link>
    </main>
  )
}
