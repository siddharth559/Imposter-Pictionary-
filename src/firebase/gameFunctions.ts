import { httpsCallable } from 'firebase/functions'
import { getFirebaseFunctions } from './client'
import { normalizeRoomCode } from './rooms'

export async function startGame(roomCodeInput: string) {
  const roomCode = normalizeRoomCode(roomCodeInput)
  const startGameCallable = httpsCallable<{ roomCode: string }, { roundId: string; currentArtistId: string }>(
    getFirebaseFunctions(),
    'startGame',
  )
  const { data } = await startGameCallable({ roomCode })
  return data
}

export async function startNextTurn(roomCodeInput: string) {
  const roomCode = normalizeRoomCode(roomCodeInput)
  const startNextTurnCallable = httpsCallable<{ roomCode: string }, { roundId: string; currentArtistId: string }>(
    getFirebaseFunctions(),
    'startNextTurn',
  )
  const { data } = await startNextTurnCallable({ roomCode })
  return data
}

export async function endCurrentTurn(roomCodeInput: string) {
  const roomCode = normalizeRoomCode(roomCodeInput)
  const endCurrentTurnCallable = httpsCallable<
    { roomCode: string },
    {
      status?: 'playing' | 'finished'
      correctGuessers?: number
      failedGuessers?: number
      artistActualGain?: number
      artistPublicGain?: number
      nextArtistId?: string | null
      alreadyEnded?: boolean
    }
  >(getFirebaseFunctions(), 'endCurrentTurn')
  const { data } = await endCurrentTurnCallable({ roomCode })
  return data
}

export async function getCurrentWord(roomCodeInput: string) {
  const roomCode = normalizeRoomCode(roomCodeInput)
  const getCurrentWordCallable = httpsCallable<{ roomCode: string }, { word: string | null }>(
    getFirebaseFunctions(),
    'getCurrentWord',
  )
  const { data } = await getCurrentWordCallable({ roomCode })
  return data.word
}

export async function getPlayerSecret(roomCodeInput: string) {
  const roomCode = normalizeRoomCode(roomCodeInput)
  const getPlayerSecretCallable = httpsCallable<{ roomCode: string }, { isImposter: boolean }>(
    getFirebaseFunctions(),
    'getPlayerSecret',
  )
  const { data } = await getPlayerSecretCallable({ roomCode })
  return data
}

export async function getWordHint(roomCodeInput: string) {
  const roomCode = normalizeRoomCode(roomCodeInput)
  const getWordHintCallable = httpsCallable<{ roomCode: string }, { letters: string[] }>(
    getFirebaseFunctions(),
    'getWordHint',
  )
  const { data } = await getWordHintCallable({ roomCode })
  return data.letters
}

export async function submitGuess(roomCodeInput: string, guessText: string) {
  const roomCode = normalizeRoomCode(roomCodeInput)
  const submitGuessCallable = httpsCallable<
    { roomCode: string; guessText: string },
    { correct: boolean; points: number; alreadyCounted?: boolean }
  >(getFirebaseFunctions(), 'submitGuess')
  const { data } = await submitGuessCallable({ roomCode, guessText })
  return data
}

export async function accuseCurrentArtist(roomCodeInput: string) {
  const roomCode = normalizeRoomCode(roomCodeInput)
  const accuseCurrentArtistCallable = httpsCallable<
    { roomCode: string },
    { correct: boolean; stolen?: number; penalty?: number; alreadyResolved?: boolean }
  >(getFirebaseFunctions(), 'accuseCurrentArtist')
  const { data } = await accuseCurrentArtistCallable({ roomCode })
  return data
}

export async function voteNextArtist(roomCodeInput: string) {
  const roomCode = normalizeRoomCode(roomCodeInput)
  const voteNextArtistCallable = httpsCallable<
    { roomCode: string },
    { alreadyVoted?: boolean; advanced: boolean; voteCount?: number; requiredVotes?: number }
  >(getFirebaseFunctions(), 'voteNextArtist')
  const { data } = await voteNextArtistCallable({ roomCode })
  return data
}
