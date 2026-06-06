import { useState } from 'react'
import { accuseCurrentArtist } from '../firebase/gameFunctions'

type AccuseButtonProps = {
  roomCode: string
  disabledReason?: string
  onError?: (message: string) => void
}

export function AccuseButton({ roomCode, disabledReason, onError }: AccuseButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const disabled = Boolean(disabledReason) || isSubmitting

  async function handleAccuse() {
    if (disabled) return

    setIsSubmitting(true)
    try {
      await accuseCurrentArtist(roomCode)
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Could not accuse the artist.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="accuse-control">
      <button className="danger-button" type="button" disabled={disabled} onClick={handleAccuse}>
        ACCUSE THE ARTIST
      </button>
      {disabledReason ? <p className="disabled-reason">{disabledReason}</p> : null}
    </div>
  )
}
