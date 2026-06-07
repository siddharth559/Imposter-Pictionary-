import { get, onDisconnect, onValue, ref, set, update } from 'firebase/database'
import type { User } from 'firebase/auth'
import { getFirebaseDatabase } from './client'
import { signInGuest } from './auth'
import {
  DEFAULT_CYCLES,
  DEFAULT_TURN_SECONDS,
  MAX_CUSTOM_WORDS,
  MAX_CYCLES,
  MAX_PLAYERS,
  MIN_CYCLES,
  MIN_PLAYERS,
} from '../game/constants'
import type { Room } from '../game/types'

const ROOM_CODE_LENGTH = 5
const ROOM_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const PLAYER_NAME_STORAGE_KEY = 'imposter-pictionary-player-name'

export type CreateRoomSettingsInput = {
  cycles?: number
  maxPlayers?: number
  wordCorpusText?: string
  useOnlyCorpus?: boolean
}

export function normalizeRoomCode(roomCode: string) {
  return roomCode.replace(/[^a-z]/gi, '').toUpperCase().slice(0, ROOM_CODE_LENGTH)
}

export function normalizePlayerName(playerName: string) {
  return playerName.trim().slice(0, 18) || 'Player'
}

export function normalizeCycles(cycles: number) {
  if (!Number.isFinite(cycles)) return DEFAULT_CYCLES
  return Math.max(MIN_CYCLES, Math.min(MAX_CYCLES, Math.round(cycles)))
}

export function normalizeMaxPlayers(maxPlayers: number) {
  if (!Number.isFinite(maxPlayers)) return MAX_PLAYERS
  return Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Math.round(maxPlayers)))
}

export function normalizeWordCorpus(wordCorpusText: string) {
  return Array.from(
    new Set(
      wordCorpusText
        .split(/[^a-zA-Z]+/)
        .map((word) => word.toLowerCase().replace(/[^a-z]/g, ''))
        .filter((word) => word.length >= 3 && word.length <= 5),
    ),
  ).slice(0, MAX_CUSTOM_WORDS)
}

export function generateRoomCode() {
  let code = ''
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}

async function ensureGuestUser(): Promise<User> {
  const result = await signInGuest()
  return result.user
}

async function setupPresence(roomCode: string, uid: string) {
  const database = getFirebaseDatabase()
  const onlineRef = ref(database, `rooms/${roomCode}/players/${uid}/online`)
  await set(onlineRef, true)
  await onDisconnect(onlineRef).set(false)
}

async function getAvailableRoomCode() {
  const database = getFirebaseDatabase()
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const roomCode = generateRoomCode()
    const snapshot = await get(ref(database, `rooms/${roomCode}`))
    if (!snapshot.exists()) return roomCode
  }

  throw new Error('Could not generate a unique room code. Please try again.')
}

export async function createRoom(playerNameInput: string, settingsInput: CreateRoomSettingsInput = {}) {
  const playerName = normalizePlayerName(playerNameInput)
  const cycles = normalizeCycles(settingsInput.cycles ?? DEFAULT_CYCLES)
  const maxPlayers = normalizeMaxPlayers(settingsInput.maxPlayers ?? MAX_PLAYERS)
  const wordCorpus = normalizeWordCorpus(settingsInput.wordCorpusText ?? '')
  const user = await ensureGuestUser()
  const roomCode = await getAvailableRoomCode()
  const database = getFirebaseDatabase()
  const now = Date.now()

  localStorage.setItem(PLAYER_NAME_STORAGE_KEY, playerName)

  const room: Room = {
    status: 'lobby',
    hostId: user.uid,
    createdAt: now,
    settings: {
      cycles,
      turnSeconds: DEFAULT_TURN_SECONDS,
      maxPlayers,
      wordCorpus,
      useOnlyCorpus: Boolean(settingsInput.useOnlyCorpus && wordCorpus.length > 0),
    },
    players: {
      [user.uid]: {
        name: playerName,
        actualScore: 0,
        publicScore: 0,
        joinedAt: now,
        online: true,
      },
    },
  }

  await set(ref(database, `rooms/${roomCode}`), room)
  await setupPresence(roomCode, user.uid)
  return roomCode
}

export async function joinRoom(roomCodeInput: string, playerNameInput: string) {
  const roomCode = normalizeRoomCode(roomCodeInput)
  const playerName = normalizePlayerName(playerNameInput)
  const user = await ensureGuestUser()
  const database = getFirebaseDatabase()
  const roomRef = ref(database, `rooms/${roomCode}`)
  const snapshot = await get(roomRef)

  if (!snapshot.exists()) throw new Error('Room not found.')

  const room = snapshot.val() as Room
  if (room.status !== 'lobby') throw new Error('That room has already started.')

  const playerCount = Object.keys(room.players ?? {}).length
  const isAlreadyInRoom = Boolean(room.players?.[user.uid])
  if (!isAlreadyInRoom && playerCount >= room.settings.maxPlayers) {
    throw new Error('That room is full.')
  }

  localStorage.setItem(PLAYER_NAME_STORAGE_KEY, playerName)

  await update(ref(database, `rooms/${roomCode}/players/${user.uid}`), {
    name: playerName,
    actualScore: room.players?.[user.uid]?.actualScore ?? 0,
    publicScore: room.players?.[user.uid]?.publicScore ?? 0,
    joinedAt: room.players?.[user.uid]?.joinedAt ?? Date.now(),
    online: true,
  })
  await setupPresence(roomCode, user.uid)

  return roomCode
}

export function listenToRoom(roomCodeInput: string, callback: (room: Room | null) => void) {
  const roomCode = normalizeRoomCode(roomCodeInput)
  return onValue(ref(getFirebaseDatabase(), `rooms/${roomCode}`), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as Room) : null)
  })
}
