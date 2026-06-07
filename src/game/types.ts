export type PlayerSlot = {
  id: string
  name: string
  isHost?: boolean
  isReady?: boolean
  online?: boolean
  actualScore?: number
  publicScore?: number
}

export type RoomSummary = {
  roomCode: string
  playerCount: number
  maxPlayers: number
}

export type RoomPlayer = {
  name: string
  actualScore: number
  publicScore: number
  joinedAt: number
  online: boolean
}

export type Room = {
  status: 'lobby' | 'playing' | 'finished'
  hostId: string
  createdAt: number
  settings: {
    cycles: number
    turnSeconds: number
    maxPlayers: number
  }
  players?: Record<string, RoomPlayer>
  currentArtistId?: string
  currentTurnIndex?: number
  currentCycle?: number
  turnStartedAt?: number
  turnEndsAt?: number
  roundId?: string
  wordLength?: number
  accusationsUnlocked?: boolean
  accusations?: Record<string, Record<string, true>>
  nextTurnVotes?: Record<string, Record<string, true>>
}

export type StrokePoint = {
  x: number
  y: number
}

export type CanvasStroke = {
  uid: string
  points: StrokePoint[]
  color: string
  width: number
  createdAt: number
}

export type ChatMessageKind = 'correct' | 'wrong' | 'system'

export type ChatMessage = {
  id: string
  uid: string
  playerName: string
  kind: ChatMessageKind
  text: string
  createdAt: number
}
