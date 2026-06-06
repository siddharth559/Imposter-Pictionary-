import { Link, useParams } from 'react-router-dom'
import { Scoreboard } from '../components/Scoreboard'

export function ResultsPage() {
  const { roomCode = 'ROOM' } = useParams()

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="eyebrow">Results</p>
        <h1>{roomCode}</h1>
      </header>
      <Scoreboard />
      <Link className="button-link primary-button" to="/">
        New Game
      </Link>
    </main>
  )
}
