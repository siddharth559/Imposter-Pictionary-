import { FormEvent, useState } from 'react'
import { submitGuess } from '../firebase/gameFunctions'

type GuessInputProps = {
  roomCode: string
  disabled?: boolean
}

export function GuessInput({ roomCode, disabled = false }: GuessInputProps) {
  const [guessText, setGuessText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const guess = guessText.trim()
    if (!guess || disabled) return

    setIsSubmitting(true)
    setError(null)
    try {
      await submitGuess(roomCode, guess)
      setGuessText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit guess.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="guess-input" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder={disabled ? 'Guessing unavailable' : 'Type a guess'}
        aria-label="Guess"
        value={guessText}
        onChange={(event) => setGuessText(event.target.value)}
        disabled={disabled || isSubmitting}
        maxLength={42}
      />
      <button type="submit" disabled={disabled || isSubmitting || !guessText.trim()}>
        Submit
      </button>
      {error ? <p className="guess-error">{error}</p> : null}
    </form>
  )
}
