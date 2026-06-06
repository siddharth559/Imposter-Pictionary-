import type { PlayerSlot } from '../game/types'

type PlayerSlotListProps = {
  players?: PlayerSlot[]
}

export function PlayerSlotList({ players = [] }: PlayerSlotListProps) {
  return (
    <section className="panel" aria-label="Players">
      <div className="panel-heading">
        <p className="section-label">Players</p>
        <strong>{players.length}</strong>
      </div>
      <div className="stack">
        {players.length ? (
          players.map((player) => (
            <div className="player-slot" key={player.id}>
              <span>
                <span className={player.online ? 'presence-dot presence-dot--online' : 'presence-dot'} />
                {player.name}
              </span>
              <span className="slot-meta">
                {player.isHost ? <strong>Host</strong> : null}
                <small>{player.publicScore ?? 0} pts</small>
              </span>
            </div>
          ))
        ) : (
          <p className="empty-state">Waiting for players.</p>
        )}
      </div>
    </section>
  )
}
