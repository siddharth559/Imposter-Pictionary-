import { FormEvent, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { submitFeedback } from '../firebase/feedback'
import { normalizeRoomCode } from '../firebase/rooms'

export function FeedbackButton() {
  const location = useLocation()
  const roomCodeMatch = location.pathname.match(/\/(?:lobby|game|results)\/([A-Z]{5})/i)
  const roomCode = roomCodeMatch ? normalizeRoomCode(roomCodeMatch[1]) : undefined
  const [isOpen, setIsOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus(null)
    setError(null)

    try {
      const result = await submitFeedback(feedbackText, location.pathname, roomCode)
      setFeedbackText('')
      setStatus(result.sent ? 'Thanks, feedback sent.' : 'Thanks, feedback saved for review.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button type="button" className="feedback-launcher" onClick={() => setIsOpen(true)}>
        Report bug / feedback
      </button>

      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="feedback-modal" role="dialog" aria-modal="true" aria-label="Report bug or feedback">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Feedback</p>
                <h2>Report Bug</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setIsOpen(false)} aria-label="Close feedback">
                X
              </button>
            </div>
            <form className="stack" onSubmit={handleSubmit}>
              <label>
                What happened?
                <textarea
                  value={feedbackText}
                  onChange={(event) => setFeedbackText(event.target.value)}
                  placeholder="Tell me what broke or what would make the game better"
                  rows={5}
                  maxLength={1200}
                />
              </label>
              <button className="primary-button" type="submit" disabled={isSubmitting || feedbackText.trim().length < 5}>
                Send Feedback
              </button>
              {status ? <p className="feedback-status">{status}</p> : null}
              {error ? <p className="form-error">{error}</p> : null}
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}
