import { Link, useNavigate, useParams } from 'react-router-dom'
import { PlayerSlotList } from '../components/PlayerSlotList'
import { useAuthUser } from '../firebase/useAuthUser'
import { normalizeRoomCode } from '../firebase/rooms'
import { startGame } from '../firebase/gameFunctions'
import { useRoom } from '../game/useRoom'
import type { PlayerSlot } from '../game/types'
import { useEffect, useMemo, useState } from 'react'

export function LobbyPage() {
  const navigate = useNavigate()
  const { roomCode: roomCodeParam = '' } = useParams()
  const roomCode = normalizeRoomCode(roomCodeParam)
  const { user, isLoading: isAuthLoading } = useAuthUser()
  const { room, isLoading: isRoomLoading } = useRoom(roomCode)
  const [shareStatus, setShareStatus] = useState('')
  const [error, setError] = useState<string | null>(null)

  const players = useMemo<PlayerSlot[]>(() => {
    return Object.entries(room?.players ?? {})
      .map(([uid, player]) => ({
        id: uid,
        name: player.name,
        isHost: uid === room?.hostId,
        online: player.online,
        actualScore: player.actualScore,
        publicScore: player.publicScore,
      }))
      .sort((a, b) => Number(Boolean(b.isHost)) - Number(Boolean(a.isHost)) || a.name.localeCompare(b.name))
  }, [room])

  const isHost = Boolean(user && room?.hostId === user.uid)

  useEffect(() => {
    if (room?.status === 'playing') {
      navigate(`/game/${roomCode}`)
    }
  }, [navigate, room?.status, roomCode])

  async function handleShareRoom() {
    const shareUrl = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Imposter Pictionary room',
          text: `Room code: ${roomCode}`,
          url: shareUrl,
        })
        setShareStatus('Shared')
        return
      } catch {
        // Fall through to copy when native share is dismissed or unavailable.
      }
    }

    await navigator.clipboard.writeText(`${roomCode} ${shareUrl}`)
    setShareStatus('Copied')
  }

  async function handleStartRoom() {
    setError(null)
    try {
      await startGame(roomCode)
      navigate(`/game/${roomCode}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start room.')
    }
  }

  if (isAuthLoading || isRoomLoading) {
    return <main className="page-shell">Loading lobby...</main>
  }

  if (!room) {
    return (
      <main className="page-shell">
        <header className="page-header">
          <p className="eyebrow">Lobby</p>
          <h1>{roomCode || 'Room'}</h1>
        </header>
        <section className="panel">
          <p className="empty-state">Room not found.</p>
        </section>
        <Link className="button-link" to="/">
          Home
        </Link>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="eyebrow">Lobby</p>
        <h1>{roomCode}</h1>
      </header>

      <section className="room-card panel" aria-label="Room details">
        <div>
          <p className="section-label">Room code</p>
          <strong className="room-code">{roomCode}</strong>
        </div>
        <button type="button" onClick={handleShareRoom}>
          {shareStatus || 'Share / Copy'}
        </button>
      </section>

      <PlayerSlotList players={players} />

      <nav className="bottom-actions">
        {isHost ? (
          <button className="primary-button" type="button" onClick={handleStartRoom}>
            Start Game
          </button>
        ) : null}
        <Link className="button-link" to="/">
          Home
        </Link>
      </nav>

      {error ? <p className="form-error">{error}</p> : null}
    </main>
  )
}
