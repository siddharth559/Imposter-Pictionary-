import { useEffect, useState } from 'react'
import { getWordHint } from '../firebase/gameFunctions'
import type { Room } from '../game/types'

type WordHintProps = {
  roomCode: string
  room: Room | null
  now: number
}

export function WordHint({ roomCode, room, now }: WordHintProps) {
  const [letters, setLetters] = useState<string[]>([])
  const length = room?.wordLength ?? letters.length
  const elapsedSeconds = room?.turnStartedAt ? Math.floor((now - room.turnStartedAt) / 1000) : 0

  useEffect(() => {
    if (room?.status !== 'playing' || !room.roundId || !length) {
      setLetters([])
      return undefined
    }

    let cancelled = false
    getWordHint(roomCode)
      .then((nextLetters) => {
        if (!cancelled) setLetters(nextLetters)
      })
      .catch(() => {
        if (!cancelled) setLetters(Array.from({ length }, () => ''))
      })

    return () => {
      cancelled = true
    }
  }, [roomCode, room?.roundId, room?.status, length, elapsedSeconds >= 20, elapsedSeconds >= 40])

  if (!length) return null

  return (
    <section className="word-hint" aria-label="Word hint">
      <div>
        <p className="section-label">Hint</p>
        <div className="word-hint-boxes">
          {Array.from({ length }, (_, index) => (
            <span className="word-hint-box" key={`${room?.roundId ?? 'round'}-${index}`}>
              {letters[index] || ''}
            </span>
          ))}
        </div>
      </div>
      <small>{elapsedSeconds >= 40 ? 'Last letter revealed' : elapsedSeconds >= 20 ? 'First letter revealed' : 'Letters unlock soon'}</small>
    </section>
  )
}
