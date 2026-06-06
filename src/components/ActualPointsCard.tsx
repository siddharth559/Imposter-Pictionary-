type ActualPointsCardProps = {
  points?: number
}

export function ActualPointsCard({ points = 0 }: ActualPointsCardProps) {
  return (
    <section className="actual-points-card" aria-label="Actual points">
      <span>Actual points</span>
      <strong>{points}</strong>
    </section>
  )
}
