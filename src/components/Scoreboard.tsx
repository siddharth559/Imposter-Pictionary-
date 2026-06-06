import type { PlayerSlot } from '../game/types'

type ScoreboardProps = {
  players?: PlayerSlot[]
}

export function Scoreboard({ players = [] }: ScoreboardProps) {
  return (
    <section className="panel" aria-label="Scoreboard">
      <div className="panel-heading">
        <p className="section-label">Scoreboard</p>
        <strong>{players.length}</strong>
      </div>
      <div className="stack">
        {players.length ? (
          players.map((player) => (
            <div className="score-row" key={player.id}>
              <span>{player.name}</span>
              <strong>0</strong>
            </div>
          ))
        ) : (
          <p className="empty-state">No players yet.</p>
        )}
      </div>
    </section>
  )
}
