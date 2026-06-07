import { useState } from 'react'
import { voteNextArtist } from '../firebase/gameFunctions'

type VoteNextArtistButtonProps = {
  roomCode: string
  disabledReason?: string
  voteCount: number
  requiredVotes: number
  onError?: (message: string) => void
}

export function VoteNextArtistButton({
  roomCode,
  disabledReason,
  voteCount,
  requiredVotes,
  onError,
}: VoteNextArtistButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const disabled = Boolean(disabledReason) || isSubmitting

  async function handleVote() {
    if (disabled) return

    setIsSubmitting(true)
    try {
      await voteNextArtist(roomCode)
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Could not vote for the next artist.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="vote-next-control">
      <button type="button" disabled={disabled} onClick={handleVote}>
        Vote Next Artist
      </button>
      <p className="disabled-reason">
        {disabledReason ?? `${voteCount}/${requiredVotes} votes`}
      </p>
    </div>
  )
}
