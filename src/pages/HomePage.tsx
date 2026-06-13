import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createRoom,
  joinRoom,
  normalizeCycles,
  normalizeMaxPlayers,
  normalizeRoomCode,
  normalizeWordCorpus,
  PLAYER_NAME_STORAGE_KEY,
} from '../firebase/rooms'
import { DEFAULT_CYCLES, MAX_CYCLES, MAX_PLAYERS, MIN_CYCLES, MIN_PLAYERS } from '../game/constants'

export function HomePage() {
  const navigate = useNavigate()
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? '',
  )
  const [roomCode, setRoomCode] = useState('')
  const [cycles, setCycles] = useState(DEFAULT_CYCLES)
  const [maxPlayers, setMaxPlayers] = useState(MAX_PLAYERS)
  const [wordCorpusText, setWordCorpusText] = useState('')
  const [useOnlyCorpus, setUseOnlyCorpus] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const validCustomWords = normalizeWordCorpus(wordCorpusText)

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      const nextRoomCode = await createRoom(playerName, {
        cycles,
        maxPlayers,
        wordCorpusText,
        useOnlyCorpus,
      })
      navigate(`/lobby/${nextRoomCode}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create room.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = normalizeRoomCode(roomCode)
    if (!code) return

    setIsSubmitting(true)
    setError(null)
    try {
      const joinedRoomCode = await joinRoom(code, playerName)
      navigate(`/lobby/${joinedRoomCode}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join room.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function openRulesPage() {
    window.open(`${import.meta.env.BASE_URL}rules.html`, '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="home-page">
      <section className="hero-panel">
        <p className="loaded-fallback">Imposter Pictionary loaded</p>
        <p className="eyebrow">Mystery Drawing Party Game</p>
        <h1>Imposter Pictionary</h1>
        <p>Draw the clue, spot the sabotage, and keep the word secret.</p>
        <button type="button" className="rules-link-button" onClick={openRulesPage}>
          Rules
        </button>
      </section>

      <section className="home-actions panel" aria-label="Create or join room">
        <label>
          Player name
          <input
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Your name"
            maxLength={18}
          />
        </label>

        <form className="stack" onSubmit={handleCreateRoom}>
          <label>
            Drawing rounds
            <input
              type="number"
              min={MIN_CYCLES}
              max={MAX_CYCLES}
              value={cycles}
              onChange={(event) => setCycles(normalizeCycles(Number(event.target.value)))}
            />
          </label>
          <label>
            Number of players
            <input
              type="number"
              min={MIN_PLAYERS}
              max={MAX_PLAYERS}
              value={maxPlayers}
              onChange={(event) => setMaxPlayers(normalizeMaxPlayers(Number(event.target.value)))}
            />
          </label>
          <label>
            Word corpus
            <textarea
              value={wordCorpusText}
              onChange={(event) => setWordCorpusText(event.target.value)}
              placeholder="cat, moon, ship, kite"
              rows={4}
            />
            <span className="field-hint">{validCustomWords.length} usable words, 3-5 letters only</span>
          </label>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={useOnlyCorpus}
              disabled={validCustomWords.length === 0}
              onChange={(event) => setUseOnlyCorpus(event.target.checked)}
            />
            Use only my words
          </label>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            Create Room
          </button>
        </form>

        <form className="stack" onSubmit={handleJoinRoom}>
          <label>
            Room code
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(normalizeRoomCode(event.target.value))}
              placeholder="ABCDE"
              maxLength={5}
            />
          </label>
          <button type="submit" disabled={isSubmitting || roomCode.length !== 5}>
            Join Room
          </button>
        </form>

        {error ? <p className="form-error">{error}</p> : null}
      </section>
    </main>
  )
}
