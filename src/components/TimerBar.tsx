type TimerBarProps = {
  secondsLeft?: number
  totalSeconds?: number
}

export function TimerBar({ secondsLeft = 60, totalSeconds = 60 }: TimerBarProps) {
  const progress = Math.max(0, Math.min(1, secondsLeft / totalSeconds))

  return (
    <section className="timer-bar" aria-label="Timer">
      <div>
        <span>{secondsLeft}s</span>
      </div>
      <div className="timer-track">
        <div className="timer-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </section>
  )
}
