import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GamePage } from './pages/GamePage'
import { HomePage } from './pages/HomePage'
import { LobbyPage } from './pages/LobbyPage'
import { ResultsPage } from './pages/ResultsPage'
import { firebaseSetupError } from './firebase/client'

function App() {
  if (firebaseSetupError) {
    return (
      <main className="setup-error-screen">
        <section className="panel">
          <p className="eyebrow">Firebase Setup</p>
          <h1>Imposter Pictionary loaded</h1>
          <p>{firebaseSetupError}</p>
        </section>
      </main>
    )
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lobby/:roomCode" element={<LobbyPage />} />
        <Route path="/game/:roomCode" element={<GamePage />} />
        <Route path="/results/:roomCode" element={<ResultsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
