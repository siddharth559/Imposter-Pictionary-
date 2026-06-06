import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AccuseButton } from '../components/AccuseButton'
import { ActualPointsCard } from '../components/ActualPointsCard'
import { CanvasBoard } from '../components/CanvasBoard'
import { ChatBox } from '../components/ChatBox'
import { GuessInput } from '../components/GuessInput'
import { PlayerSlotList } from '../components/PlayerSlotList'
import { RulesModal } from '../components/RulesModal'
import { Scoreboard } from '../components/Scoreboard'
import { TimerBar } from '../components/TimerBar'
import { endCurrentTurn } from '../firebase/gameFunctions'
import { useAuthUser } from '../firebase/useAuthUser'
import { normalizeRoomCode } from '../firebase/rooms'
import { getAccusationThreshold } from '../game/rules'
import { useCurrentWord } from '../game/useCurrentWord'
import { usePlayerSecret } from '../game/usePlayerSecret'
import { useRoom } from '../game/useRoom'
import type { PlayerSlot } from '../game/types'

const placeholderPlayers: PlayerSlot[] = [
  { id: '1', name: 'Avery', isHost: true, online: true, publicScore: 30 },
  { id: '2', name: 'Blair', online: true, publicScore: 20 },
  { id: '3', name: 'Casey', online: true, publicScore: 10 },
  { id: '4', name: 'Dev', online: false, publicScore: 0 },
]

export function GamePage() {
  const { roomCode: roomCodeParam = 'ROOM' } = useParams()
  const roomCode = normalizeRoomCode(roomCodeParam)
  const [rulesOpen, setRulesOpen] = useState(false)
  const { user } = useAuthUser()
  const { room } = useRoom(roomCode)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const endingRoundRef = useRef<string | null>(null)
  const roundId = room?.roundId ?? 'round-1'
  const currentArtistId = room?.currentArtistId
  const currentWord = useCurrentWord(roomCode, room, user?.uid)
  const { isImposter } = usePlayerSecret(roomCode, room, user?.uid)
  const currentPlayer = user ? room?.players?.[user.uid] : undefined
  const actualScore = currentPlayer?.actualScore ?? 0
  const isHost = Boolean(user && room?.hostId === user.uid)
  const isCurrentArtist = Boolean(user && currentArtistId === user.uid)
  const currentArtistName = currentArtistId ? room?.players?.[currentArtistId]?.name : undefined
  const canGuess = Boolean(room?.status === 'playing' && user && !isCurrentArtist)
  const totalSeconds = room?.settings.turnSeconds ?? 60
  const secondsLeft =
    room?.turnEndsAt && room.status === 'playing' ? Math.max(0, Math.ceil((room.turnEndsAt - now) / 1000)) : totalSeconds
  const players = room?.players
    ? Object.entries(room.players).map<PlayerSlot>(([uid, player]) => ({
        id: uid,
        name: player.name,
        isHost: uid === room.hostId,
        online: player.online,
        actualScore: player.actualScore,
        publicScore: player.publicScore,
    }))
    : placeholderPlayers
  const accusationThreshold = getAccusationThreshold(
    Object.keys(room?.players ?? {}).length || placeholderPlayers.length,
    room?.settings.cycles ?? 3,
  )
  const turnIsActive = Boolean(
    room?.status === 'playing' &&
      room.turnStartedAt &&
      room.turnEndsAt &&
      now >= room.turnStartedAt &&
      now <= room.turnEndsAt,
  )
  const alreadyAccused = Boolean(user && room?.roundId && room.accusations?.[room.roundId]?.[user.uid])
  const accusationDisabledReason = getAccusationDisabledReason({
    accusationsUnlocked: Boolean(room?.accusationsUnlocked),
    actualScore,
    alreadyAccused,
    isCurrentArtist,
    threshold: accusationThreshold,
    turnIsActive,
    userReady: Boolean(user && room),
  })

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (room?.status !== 'playing' || !room.roundId || !room.turnEndsAt || now < room.turnEndsAt) return
    if (endingRoundRef.current === room.roundId) return

    endingRoundRef.current = room.roundId
    endCurrentTurn(roomCode).catch((err) => {
      setError(err instanceof Error ? err.message : 'Could not advance to the next artist.')
    })
  }, [now, room?.roundId, room?.status, room?.turnEndsAt, roomCode])

  async function handleNextTurn() {
    setError(null)
    try {
      await endCurrentTurn(roomCode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end current turn.')
    }
  }

  const rulesButton = (
    <button type="button" onClick={() => setRulesOpen(true)}>
      Rules
    </button>
  )

  return (
    <main className={isImposter ? 'game-page game-page--imposter' : 'game-page'}>
      <header className="game-mobile-topbar">
        {rulesButton}
        <ActualPointsCard points={actualScore} />
      </header>

      <aside className="game-left-column">
        <PlayerSlotList players={players} />
        <Scoreboard players={players} />
        {rulesButton}
      </aside>

      <section className="game-center-column" aria-label="Drawing and chat area">
        {isImposter ? (
          <section className="imposter-alert" aria-label="Your secret role">
            <span>!</span>
            <div>
              <p className="section-label">Secret Role</p>
              <strong>You are the Imposter</strong>
            </div>
          </section>
        ) : null}
        <section className={isCurrentArtist ? 'turn-status turn-status--artist' : 'turn-status'} aria-label="Current artist">
          <div>
            <p className="section-label">Now Drawing</p>
            <strong>{currentArtistName ?? 'Waiting for artist'}</strong>
          </div>
          {isCurrentArtist ? <span>Your canvas is active</span> : null}
        </section>
        {room?.status === 'playing' ? <TimerBar secondsLeft={secondsLeft} totalSeconds={totalSeconds} /> : null}
        <section className="word-panel" aria-label="Artist word">
          <p className="section-label">Word</p>
          <strong>{currentWord ?? 'Hidden until your drawing turn'}</strong>
        </section>
        <CanvasBoard
          roomCode={roomCode}
          roundId={roundId}
          currentArtistId={currentArtistId}
          currentUserId={user?.uid}
        />
        <div className="chat-stack">
          <ChatBox roomCode={roomCode} roundId={roundId} />
          <div className="mobile-only">
            <GuessInput roomCode={roomCode} disabled={!canGuess} />
          </div>
        </div>
      </section>

      <aside className="game-right-column">
        <ActualPointsCard points={actualScore} />
        <AccuseButton roomCode={roomCode} disabledReason={accusationDisabledReason} onError={setError} />
        <GuessInput roomCode={roomCode} disabled={!canGuess} />
      </aside>

      <div className="mobile-accuse-row">
        <AccuseButton roomCode={roomCode} disabledReason={accusationDisabledReason} onError={setError} />
      </div>

      <div className="mobile-scoreboard">
        <Scoreboard players={players} />
      </div>

      <nav className="game-bottom-actions" aria-label="Game actions">
        <Link className="button-link" to={`/lobby/${roomCode}`}>
          Lobby
        </Link>
        <button type="button" onClick={handleNextTurn} disabled={!isHost || room?.status !== 'playing'}>
          Next
        </button>
        <Link className="button-link" to={`/results/${roomCode}`}>
          Results
        </Link>
      </nav>

      {error ? <p className="form-error">{error}</p> : null}
      <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />
    </main>
  )
}

type AccusationReasonInput = {
  accusationsUnlocked: boolean
  actualScore: number
  alreadyAccused: boolean
  isCurrentArtist: boolean
  threshold: number
  turnIsActive: boolean
  userReady: boolean
}

function getAccusationDisabledReason({
  accusationsUnlocked,
  actualScore,
  alreadyAccused,
  isCurrentArtist,
  threshold,
  turnIsActive,
  userReady,
}: AccusationReasonInput) {
  if (!userReady) return 'Join the room to accuse.'
  if (!turnIsActive) return 'Accusations are only open during an active turn.'
  if (!accusationsUnlocked) return 'Accusations unlock after the first cycle.'
  if (isCurrentArtist) return 'The artist cannot accuse themself.'
  if (actualScore < threshold) return `Need ${threshold} actual points to accuse.`
  if (alreadyAccused) return 'You already accused this turn.'
  return undefined
}
