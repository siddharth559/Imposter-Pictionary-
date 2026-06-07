import { initializeApp } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

initializeApp()

const db = getDatabase()
const MIN_PLAYERS = 4
const MAX_PLAYERS = 8
const DEFAULT_TURN_SECONDS = 60
const WORDS = [
  'ant',
  'ape',
  'arm',
  'bag',
  'bat',
  'bed',
  'bee',
  'bell',
  'bird',
  'boat',
  'book',
  'boot',
  'bowl',
  'bus',
  'cake',
  'camp',
  'cap',
  'car',
  'card',
  'cat',
  'coin',
  'comb',
  'crown',
  'cup',
  'desk',
  'dog',
  'door',
  'drum',
  'duck',
  'ear',
  'eye',
  'fan',
  'fish',
  'flag',
  'frog',
  'gift',
  'goat',
  'hat',
  'hen',
  'hill',
  'hook',
  'jar',
  'key',
  'kite',
  'lamp',
  'leaf',
  'lock',
  'moon',
  'mop',
  'nail',
  'nest',
  'nose',
  'pan',
  'pear',
  'pen',
  'pie',
  'pig',
  'ring',
  'road',
  'rock',
  'rope',
  'ship',
  'shoe',
  'snow',
  'sock',
  'star',
  'sun',
  'tent',
  'tree',
  'web',
  'wheel',
  'wing',
]
const callableOptions = {
  cors: true,
  invoker: 'public',
}

type RoomPlayer = {
  name: string
  actualScore: number
  publicScore: number
  joinedAt: number
  online: boolean
}

type Room = {
  status: 'lobby' | 'playing' | 'finished'
  hostId: string
  createdAt: number
  settings?: {
    cycles?: number
    turnSeconds?: number
    maxPlayers?: number
    wordCorpus?: string[]
    useOnlyCorpus?: boolean
  }
  players?: Record<string, RoomPlayer>
  currentArtistId?: string
  currentTurnIndex?: number
  currentCycle?: number
  turnStartedAt?: number
  turnEndsAt?: number
  roundId?: string
  accusationsUnlocked?: boolean
  caughtImposterRounds?: Record<string, true>
  nextTurnVotes?: Record<string, Record<string, true>>
}

type PrivateRoom = {
  imposterId?: string
  turnOrder?: string[]
  currentWord?: string
  correctGuessers?: Record<string, Record<string, true>>
  endedRounds?: Record<string, true>
  correctAccusations?: Record<string, string>
  usedWords?: Record<string, true>
}

function createChatMessageId(roomCode: string, roundId: string) {
  const messageId = db.ref(`rooms/${roomCode}/chat/${roundId}`).push().key
  if (!messageId) throw new HttpsError('internal', 'Could not create chat message.')
  return messageId
}

function drawingMessageUpdate(roomCode: string, roundId: string, artist: RoomPlayer) {
  return {
    [`rooms/${roomCode}/chat/${roundId}/${createChatMessageId(roomCode, roundId)}`]: {
      uid: 'system',
      playerName: 'System',
      kind: 'system',
      text: `${artist.name} is drawing`,
      createdAt: Date.now(),
    },
  }
}

function requireUid(auth?: { uid: string }) {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Anonymous sign-in is required.')
  return auth.uid
}

function normalizeRoomCode(roomCode: unknown) {
  const value = typeof roomCode === 'string' ? roomCode.trim().toUpperCase() : ''
  if (!/^[A-Z]{5}$/.test(value)) throw new HttpsError('invalid-argument', 'Room code must be 5 letters.')
  return value
}

async function getRoom(roomCode: string) {
  const snapshot = await db.ref(`rooms/${roomCode}`).get()
  if (!snapshot.exists()) throw new HttpsError('not-found', 'Room not found.')
  return snapshot.val() as Room
}

async function getPrivateRoom(roomCode: string) {
  const snapshot = await db.ref(`privateRooms/${roomCode}`).get()
  return (snapshot.val() ?? {}) as PrivateRoom
}

function sortedPlayerIds(room: Room) {
  return Object.entries(room.players ?? {})
    .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
    .map(([uid]) => uid)
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]]
  }
  return shuffled
}

function wordLength(word?: string | null) {
  return (word ?? '').length
}

function normalizeWord(value: unknown) {
  return typeof value === 'string' ? value.toLowerCase().replace(/[^a-z]/g, '') : ''
}

function uniqueValidWords(words: unknown[] = []) {
  return Array.from(
    new Set(
      words
        .map(normalizeWord)
        .filter((word) => word.length >= 3 && word.length <= 5),
    ),
  )
}

function wordPool(room: Room) {
  const customWords = uniqueValidWords(room.settings?.wordCorpus ?? [])
  if (room.settings?.useOnlyCorpus && customWords.length > 0) return customWords
  return uniqueValidWords([...customWords, ...WORDS])
}

function selectNextWord(room: Room, privateRoom: PrivateRoom) {
  const pool = wordPool(room)
  const usedWords = privateRoom.usedWords ?? {}
  const availableWords = pool.filter((word) => !usedWords[word])

  if (availableWords.length === 0) {
    throw new HttpsError('failed-precondition', 'The word pool is exhausted. Add more 3-5 letter words.')
  }

  return availableWords[Math.floor(Math.random() * availableWords.length)]
}

function cleanGuess(guessText: unknown) {
  const value = typeof guessText === 'string' ? guessText.trim().slice(0, 42) : ''
  if (!value) throw new HttpsError('invalid-argument', 'Guess cannot be empty.')
  return value
}

function normalizeGuess(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getGuessPoints(elapsedSeconds: number) {
  if (elapsedSeconds <= 20) return 30
  if (elapsedSeconds <= 40) return 20
  if (elapsedSeconds <= 60) return 10
  return 0
}

function getAccusationThreshold(playerCount: number, cycles: number) {
  const multiplier = cycles <= 2 ? 0.75 : cycles <= 4 ? 1 : 1.25
  return Math.round((20 * (playerCount - 1) * multiplier) / 10) * 10
}

function createRoundId(cycle: number, turnIndex: number) {
  return `cycle-${cycle}-turn-${turnIndex + 1}-${Date.now()}`
}

function turnTiming(room: Room) {
  const turnSeconds = room.settings?.turnSeconds ?? DEFAULT_TURN_SECONDS
  const turnStartedAt = Date.now()
  const turnEndsAt = turnStartedAt + turnSeconds * 1000
  return { turnStartedAt, turnEndsAt }
}

async function finishTurn(roomCode: string, room: Room, privateRoom: PrivateRoom, allowEarlyEnd = false) {
  if (room.status !== 'playing') throw new HttpsError('failed-precondition', 'Game is not currently playing.')
  if (!room.roundId || !room.turnStartedAt || !room.turnEndsAt) {
    throw new HttpsError('failed-precondition', 'No active turn.')
  }

  const now = Date.now()
  if (!allowEarlyEnd && now < room.turnEndsAt) {
    throw new HttpsError('failed-precondition', 'Turn timer is still running.')
  }

  const roundId = room.roundId
  const endedRoundRef = db.ref(`privateRooms/${roomCode}/endedRounds/${roundId}`)
  const endedRoundTransaction = await endedRoundRef.transaction((currentValue) => {
    if (currentValue) return
    return true
  })

  if (!endedRoundTransaction.committed) {
    return { alreadyEnded: true }
  }

  const turnOrder = privateRoom.turnOrder?.length ? privateRoom.turnOrder : sortedPlayerIds(room)
  if (turnOrder.length < MIN_PLAYERS) throw new HttpsError('failed-precondition', 'Need at least 4 players.')
  if (turnOrder.length > MAX_PLAYERS) throw new HttpsError('failed-precondition', 'Maximum 8 players.')

  const artistId = room.currentArtistId ?? turnOrder[room.currentTurnIndex ?? 0]
  const artist = room.players?.[artistId]
  if (!artist) throw new HttpsError('failed-precondition', 'Current artist is missing.')

  const guesserIds = turnOrder.filter((playerId) => playerId !== artistId)
  const correctGuesserSet = privateRoom.correctGuessers?.[roundId] ?? {}
  const correctGuessers = guesserIds.filter((playerId) => correctGuesserSet[playerId]).length
  const failedGuessers = Math.max(0, guesserIds.length - correctGuessers)
  const isImposterArtist = privateRoom.imposterId === artistId
  const artistActualGain = isImposterArtist ? failedGuessers * 20 : correctGuessers * 10
  const artistPublicGain = correctGuessers * 10
  const selectedCycles = room.settings?.cycles ?? 3
  const { nextTurnIndex, nextCycle, nextArtistId } = nextTurnState(room, turnOrder)
  const gameFinished = nextCycle > selectedCycles

  const updates: Record<string, unknown> = {
    [`rooms/${roomCode}/players/${artistId}/actualScore`]: (artist.actualScore ?? 0) + artistActualGain,
    [`rooms/${roomCode}/players/${artistId}/publicScore`]: (artist.publicScore ?? 0) + artistPublicGain,
    [`privateRooms/${roomCode}/turnOrder`]: turnOrder,
  }

  if (gameFinished) {
    updates[`rooms/${roomCode}/status`] = 'finished'
    updates[`rooms/${roomCode}/turnEndsAt`] = now
    updates[`rooms/${roomCode}/wordLength`] = null
    updates[`rooms/${roomCode}/accusationsUnlocked`] = false
    updates[`privateRooms/${roomCode}/currentWord`] = null
  } else {
    const { turnStartedAt, turnEndsAt } = turnTiming(room)
    const nextRoundId = createRoundId(nextCycle, nextTurnIndex)
    const nextArtist = room.players?.[nextArtistId]
    if (!nextArtist) throw new HttpsError('failed-precondition', 'Next artist is missing.')
    const nextWord = selectNextWord(room, privateRoom)
    updates[`rooms/${roomCode}/currentArtistId`] = nextArtistId
    updates[`rooms/${roomCode}/currentTurnIndex`] = nextTurnIndex
    updates[`rooms/${roomCode}/currentCycle`] = nextCycle
    updates[`rooms/${roomCode}/turnStartedAt`] = turnStartedAt
    updates[`rooms/${roomCode}/turnEndsAt`] = turnEndsAt
    updates[`rooms/${roomCode}/roundId`] = nextRoundId
    updates[`rooms/${roomCode}/wordLength`] = wordLength(nextWord)
    updates[`rooms/${roomCode}/accusationsUnlocked`] = nextCycle > 1
    updates[`privateRooms/${roomCode}/currentWord`] = nextWord
    updates[`privateRooms/${roomCode}/usedWords/${nextWord}`] = true
    Object.assign(updates, drawingMessageUpdate(roomCode, nextRoundId, nextArtist))
  }

  await db.ref().update(updates)

  return {
    status: gameFinished ? 'finished' : 'playing',
    correctGuessers,
    failedGuessers,
    artistActualGain,
    artistPublicGain,
    nextArtistId: gameFinished ? null : nextArtistId,
  }
}

function nextTurnState(room: Room, turnOrder: string[]) {
  const currentTurnIndex = room.currentTurnIndex ?? 0
  const currentCycle = room.currentCycle ?? 1
  const nextTurnIndex = (currentTurnIndex + 1) % turnOrder.length
  const nextCycle = nextTurnIndex === 0 ? currentCycle + 1 : currentCycle
  return {
    nextTurnIndex,
    nextCycle,
    nextArtistId: turnOrder[nextTurnIndex],
  }
}

function validateStartRoom(uid: string, room: Room) {
  if (room.hostId !== uid) throw new HttpsError('permission-denied', 'Only the host can start the game.')
  if (room.status !== 'lobby') throw new HttpsError('failed-precondition', 'Room is not in the lobby.')

  const playerCount = Object.keys(room.players ?? {}).length
  if (playerCount < MIN_PLAYERS) throw new HttpsError('failed-precondition', 'Need at least 4 players.')
  if (playerCount > MAX_PLAYERS) throw new HttpsError('failed-precondition', 'Maximum 8 players.')
  if (playerCount > (room.settings?.maxPlayers ?? MAX_PLAYERS)) {
    throw new HttpsError('failed-precondition', 'This room is already above its player limit.')
  }

  const selectedCycles = room.settings?.cycles ?? 3
  const requiredWords = playerCount * selectedCycles
  const availableWords = wordPool(room).length
  if (availableWords < requiredWords) {
    throw new HttpsError(
      'failed-precondition',
      `Need at least ${requiredWords} unique 3-5 letter words for this game. Current pool has ${availableWords}.`,
    )
  }
}

export const startGame = onCall(callableOptions, async (request) => {
  const uid = requireUid(request.auth)
  const roomCode = normalizeRoomCode(request.data?.roomCode)
  const room = await getRoom(roomCode)
  validateStartRoom(uid, room)

  const playerIds = sortedPlayerIds(room)
  const turnOrder = shuffle(playerIds)
  const imposterId = turnOrder[Math.floor(Math.random() * turnOrder.length)]
  const currentTurnIndex = 0
  const currentCycle = 1
  const currentArtistId = turnOrder[currentTurnIndex]
  const currentArtist = room.players?.[currentArtistId]
  if (!currentArtist) throw new HttpsError('failed-precondition', 'Current artist is missing.')
  const currentWord = selectNextWord(room, {})
  const { turnStartedAt, turnEndsAt } = turnTiming(room)
  const roundId = createRoundId(currentCycle, currentTurnIndex)

  await db.ref().update({
    [`rooms/${roomCode}/status`]: 'playing',
    [`rooms/${roomCode}/currentArtistId`]: currentArtistId,
    [`rooms/${roomCode}/currentTurnIndex`]: currentTurnIndex,
    [`rooms/${roomCode}/currentCycle`]: currentCycle,
    [`rooms/${roomCode}/turnStartedAt`]: turnStartedAt,
    [`rooms/${roomCode}/turnEndsAt`]: turnEndsAt,
    [`rooms/${roomCode}/roundId`]: roundId,
    [`rooms/${roomCode}/wordLength`]: wordLength(currentWord),
    [`rooms/${roomCode}/accusationsUnlocked`]: false,
    [`rooms/${roomCode}/caughtImposterRounds`]: null,
    [`privateRooms/${roomCode}`]: {
      imposterId,
      turnOrder,
      currentWord,
      usedWords: {
        [currentWord]: true,
      },
      createdAt: Date.now(),
    },
    ...drawingMessageUpdate(roomCode, roundId, currentArtist),
  })

  return { roundId, currentArtistId }
})

export const startNextTurn = onCall(callableOptions, async (request) => {
  const uid = requireUid(request.auth)
  const roomCode = normalizeRoomCode(request.data?.roomCode)
  const [room, privateRoom] = await Promise.all([getRoom(roomCode), getPrivateRoom(roomCode)])

  if (room.hostId !== uid) throw new HttpsError('permission-denied', 'Only the host can advance turns.')
  if (room.status !== 'playing') throw new HttpsError('failed-precondition', 'Game is not currently playing.')

  const turnOrder = privateRoom.turnOrder?.length ? privateRoom.turnOrder : sortedPlayerIds(room)
  if (turnOrder.length < MIN_PLAYERS) throw new HttpsError('failed-precondition', 'Need at least 4 players.')
  if (turnOrder.length > MAX_PLAYERS) throw new HttpsError('failed-precondition', 'Maximum 8 players.')

  const { nextTurnIndex, nextCycle, nextArtistId } = nextTurnState(room, turnOrder)
  const nextArtist = room.players?.[nextArtistId]
  if (!nextArtist) throw new HttpsError('failed-precondition', 'Next artist is missing.')
  const currentWord = selectNextWord(room, privateRoom)
  const { turnStartedAt, turnEndsAt } = turnTiming(room)
  const roundId = createRoundId(nextCycle, nextTurnIndex)

  await db.ref().update({
    [`rooms/${roomCode}/currentArtistId`]: nextArtistId,
    [`rooms/${roomCode}/currentTurnIndex`]: nextTurnIndex,
    [`rooms/${roomCode}/currentCycle`]: nextCycle,
    [`rooms/${roomCode}/turnStartedAt`]: turnStartedAt,
    [`rooms/${roomCode}/turnEndsAt`]: turnEndsAt,
    [`rooms/${roomCode}/roundId`]: roundId,
    [`rooms/${roomCode}/wordLength`]: wordLength(currentWord),
    [`rooms/${roomCode}/accusationsUnlocked`]: nextCycle > 1,
    [`privateRooms/${roomCode}/turnOrder`]: turnOrder,
    [`privateRooms/${roomCode}/currentWord`]: currentWord,
    [`privateRooms/${roomCode}/usedWords/${currentWord}`]: true,
    ...drawingMessageUpdate(roomCode, roundId, nextArtist),
  })

  return { roundId, currentArtistId: nextArtistId }
})

export const endCurrentTurn = onCall(callableOptions, async (request) => {
  const uid = requireUid(request.auth)
  const roomCode = normalizeRoomCode(request.data?.roomCode)
  const [room, privateRoom] = await Promise.all([getRoom(roomCode), getPrivateRoom(roomCode)])

  if (!room.players?.[uid]) throw new HttpsError('permission-denied', 'Join the room before ending a turn.')
  return finishTurn(roomCode, room, privateRoom)
})

export const getCurrentWord = onCall(callableOptions, async (request) => {
  const uid = requireUid(request.auth)
  const roomCode = normalizeRoomCode(request.data?.roomCode)
  const [room, privateRoom] = await Promise.all([getRoom(roomCode), getPrivateRoom(roomCode)])

  if (room.status !== 'playing') throw new HttpsError('failed-precondition', 'Game is not currently playing.')
  if (room.currentArtistId !== uid) {
    return { word: null }
  }

  return { word: privateRoom.currentWord ?? null }
})

export const getPlayerSecret = onCall(callableOptions, async (request) => {
  const uid = requireUid(request.auth)
  const roomCode = normalizeRoomCode(request.data?.roomCode)
  const [room, privateRoom] = await Promise.all([getRoom(roomCode), getPrivateRoom(roomCode)])

  if (!room.players?.[uid]) throw new HttpsError('permission-denied', 'Join the room before requesting role details.')
  if (room.status !== 'playing') return { isImposter: false }

  return {
    isImposter: privateRoom.imposterId === uid,
  }
})

export const getWordHint = onCall(callableOptions, async (request) => {
  requireUid(request.auth)
  const roomCode = normalizeRoomCode(request.data?.roomCode)
  const [room, privateRoom] = await Promise.all([getRoom(roomCode), getPrivateRoom(roomCode)])

  if (room.status !== 'playing' || !room.turnStartedAt) return { letters: [] }

  const word = privateRoom.currentWord ?? ''
  const elapsedSeconds = (Date.now() - room.turnStartedAt) / 1000
  const letters = Array.from({ length: word.length }, () => '')
  if (word.length && elapsedSeconds >= 20) letters[0] = word[0].toUpperCase()
  if (word.length > 1 && elapsedSeconds >= 40) letters[word.length - 1] = word[word.length - 1].toUpperCase()

  return { letters }
})

export const voteNextArtist = onCall(callableOptions, async (request) => {
  const uid = requireUid(request.auth)
  const roomCode = normalizeRoomCode(request.data?.roomCode)
  const [room, privateRoom] = await Promise.all([getRoom(roomCode), getPrivateRoom(roomCode)])

  if (room.status !== 'playing') throw new HttpsError('failed-precondition', 'Game is not currently playing.')
  if (!room.roundId || !room.turnStartedAt || !room.turnEndsAt || !room.currentArtistId) {
    throw new HttpsError('failed-precondition', 'No active turn.')
  }
  if (!room.players?.[uid]) throw new HttpsError('permission-denied', 'Join the room before voting.')
  if (room.currentArtistId === uid) throw new HttpsError('failed-precondition', 'The artist cannot vote to skip themself.')

  const now = Date.now()
  if (now < room.turnStartedAt || now > room.turnEndsAt) {
    throw new HttpsError('deadline-exceeded', 'Voting is closed for this turn.')
  }

  const roundId = room.roundId
  const voteRef = db.ref(`rooms/${roomCode}/nextTurnVotes/${roundId}/${uid}`)
  const voteTransaction = await voteRef.transaction((currentValue) => {
    if (currentValue) return
    return true
  })

  if (!voteTransaction.committed) return { alreadyVoted: true, advanced: false }

  const player = room.players[uid]
  const messageId = createChatMessageId(roomCode, roundId)
  const updates: Record<string, unknown> = {
    [`rooms/${roomCode}/chat/${roundId}/${messageId}`]: {
      uid,
      playerName: player.name,
      kind: 'system',
      text: `${player.name} voted for next artist`,
      createdAt: now,
    },
  }

  const turnOrder = privateRoom.turnOrder?.length ? privateRoom.turnOrder : sortedPlayerIds(room)
  const eligibleVoters = turnOrder.filter((playerId) => playerId !== room.currentArtistId && room.players?.[playerId])
  const previousVotes = room.nextTurnVotes?.[roundId] ?? {}
  const voteCount = new Set([...Object.keys(previousVotes), uid]).size
  const shouldAdvance = eligibleVoters.length > 0 && voteCount >= eligibleVoters.length

  await db.ref().update(updates)
  if (!shouldAdvance) return { alreadyVoted: false, advanced: false, voteCount, requiredVotes: eligibleVoters.length }

  const result = await finishTurn(roomCode, room, privateRoom, true)
  return { alreadyVoted: false, advanced: true, voteCount, requiredVotes: eligibleVoters.length, ...result }
})

export const submitGuess = onCall(callableOptions, async (request) => {
  const uid = requireUid(request.auth)
  const roomCode = normalizeRoomCode(request.data?.roomCode)
  const guessText = cleanGuess(request.data?.guessText)
  const [room, privateRoom] = await Promise.all([getRoom(roomCode), getPrivateRoom(roomCode)])

  if (room.status !== 'playing') throw new HttpsError('failed-precondition', 'Game is not currently playing.')
  if (!room.roundId || !room.turnStartedAt || !room.turnEndsAt) {
    throw new HttpsError('failed-precondition', 'No active turn.')
  }
  if (room.currentArtistId === uid) throw new HttpsError('failed-precondition', 'Artist cannot guess.')

  const player = room.players?.[uid]
  if (!player) throw new HttpsError('permission-denied', 'Join the room before guessing.')

  const now = Date.now()
  if (now < room.turnStartedAt || now > room.turnEndsAt) {
    throw new HttpsError('deadline-exceeded', 'Guessing is closed for this turn.')
  }

  const roundId = room.roundId
  const isCorrect = normalizeGuess(guessText) === normalizeGuess(privateRoom.currentWord ?? '')
  const messageRef = db.ref(`rooms/${roomCode}/chat/${roundId}`).push()
  const messageId = messageRef.key
  if (!messageId) throw new HttpsError('internal', 'Could not create chat message.')

  if (!isCorrect) {
    await db.ref(`rooms/${roomCode}/chat/${roundId}/${messageId}`).set({
      uid,
      playerName: player.name,
      kind: 'wrong',
      text: `${player.name} guesses it is ${guessText}`,
      createdAt: now,
    })
    return { correct: false, points: 0 }
  }

  const correctGuessRef = db.ref(`privateRooms/${roomCode}/correctGuessers/${roundId}/${uid}`)
  const transaction = await correctGuessRef.transaction((currentValue) => {
    if (currentValue) return
    return true
  })

  if (!transaction.committed) {
    return { correct: true, points: 0, alreadyCounted: true }
  }

  const points = getGuessPoints((now - room.turnStartedAt) / 1000)
  const nextActualScore = (player.actualScore ?? 0) + points
  const nextPublicScore = (player.publicScore ?? 0) + points

  await db.ref().update({
    [`rooms/${roomCode}/players/${uid}/actualScore`]: nextActualScore,
    [`rooms/${roomCode}/players/${uid}/publicScore`]: nextPublicScore,
    [`rooms/${roomCode}/chat/${roundId}/${messageId}`]: {
      uid,
      playerName: player.name,
      kind: 'correct',
      text: `${player.name} predicted the word`,
      createdAt: now,
    },
  })

  return { correct: true, points }
})

export const accuseCurrentArtist = onCall(callableOptions, async (request) => {
  const uid = requireUid(request.auth)
  const roomCode = normalizeRoomCode(request.data?.roomCode)
  const [room, privateRoom] = await Promise.all([getRoom(roomCode), getPrivateRoom(roomCode)])

  if (room.status !== 'playing') throw new HttpsError('failed-precondition', 'Game is not currently playing.')
  if (!room.roundId || !room.turnStartedAt || !room.turnEndsAt || !room.currentArtistId) {
    throw new HttpsError('failed-precondition', 'No active turn.')
  }
  if (!room.accusationsUnlocked || (room.currentCycle ?? 1) <= 1) {
    throw new HttpsError('failed-precondition', 'Accusations unlock after the first cycle.')
  }
  if (room.caughtImposterRounds?.[room.roundId]) {
    throw new HttpsError('failed-precondition', 'The artist has already been caught this turn.')
  }
  if (room.currentArtistId === uid) throw new HttpsError('failed-precondition', 'Artist cannot accuse themself.')

  const now = Date.now()
  if (now < room.turnStartedAt || now > room.turnEndsAt) {
    throw new HttpsError('deadline-exceeded', 'Accusations are closed for this turn.')
  }

  const accuser = room.players?.[uid]
  const artist = room.players?.[room.currentArtistId]
  if (!accuser || !artist) throw new HttpsError('permission-denied', 'Player is missing from this room.')

  const playerIds = Object.keys(room.players ?? {})
  const threshold = getAccusationThreshold(playerIds.length, room.settings?.cycles ?? 3)
  if ((accuser.actualScore ?? 0) < threshold) {
    throw new HttpsError('failed-precondition', `You need ${threshold} actual points to accuse.`)
  }

  const roundId = room.roundId
  const accusedRef = db.ref(`rooms/${roomCode}/accusations/${roundId}/${uid}`)
  const accusedTransaction = await accusedRef.transaction((currentValue) => {
    if (currentValue) return
    return true
  })

  if (!accusedTransaction.committed) {
    throw new HttpsError('already-exists', 'You already accused this turn.')
  }

  const messageRef = db.ref(`rooms/${roomCode}/chat/${roundId}`).push()
  const messageId = messageRef.key
  if (!messageId) throw new HttpsError('internal', 'Could not create accusation message.')

  const artistIsImposter = privateRoom.imposterId === room.currentArtistId

  if (artistIsImposter) {
    const correctAccusationRef = db.ref(`privateRooms/${roomCode}/correctAccusations/${roundId}`)
    const correctTransaction = await correctAccusationRef.transaction((currentValue) => {
      if (currentValue) return
      return uid
    })

    if (!correctTransaction.committed) {
      await db.ref(`rooms/${roomCode}/chat/${roundId}/${messageId}`).set({
        uid,
        playerName: accuser.name,
        kind: 'system',
        text: `${accuser.name} accused the artist after the Imposter was already caught`,
        createdAt: now,
      })
      return { correct: true, alreadyResolved: true, stolen: 0 }
    }

    const stolen = Math.floor((artist.actualScore ?? 0) * 0.5)
    const nextAccuserActualScore = (accuser.actualScore ?? 0) + stolen
    const nextArtistActualScore = (artist.actualScore ?? 0) - stolen
    const nextImposterCandidates = playerIds.filter((playerId) => playerId !== room.currentArtistId)
    const nextImposterId =
      nextImposterCandidates[Math.floor(Math.random() * nextImposterCandidates.length)] ?? room.currentArtistId

    await db.ref().update({
      [`rooms/${roomCode}/players/${uid}/actualScore`]: nextAccuserActualScore,
      [`rooms/${roomCode}/players/${uid}/publicScore`]: nextAccuserActualScore,
      [`rooms/${roomCode}/players/${room.currentArtistId}/actualScore`]: nextArtistActualScore,
      [`rooms/${roomCode}/players/${room.currentArtistId}/publicScore`]: nextArtistActualScore,
      [`rooms/${roomCode}/caughtImposterRounds/${roundId}`]: true,
      [`rooms/${roomCode}/chat/${roundId}/${messageId}`]: {
        uid,
        playerName: accuser.name,
        kind: 'system',
        text: `${accuser.name} correctly accused the artist and stole 50% of points`,
        createdAt: now,
      },
      [`privateRooms/${roomCode}/imposterId`]: nextImposterId,
    })

    return { correct: true, stolen }
  }

  const penalty = Math.floor((accuser.actualScore ?? 0) * 0.5)
  const publicPenalty = Math.floor((accuser.publicScore ?? 0) * 0.5)

  await db.ref().update({
    [`rooms/${roomCode}/players/${uid}/actualScore`]: (accuser.actualScore ?? 0) - penalty,
    [`rooms/${roomCode}/players/${uid}/publicScore`]: (accuser.publicScore ?? 0) - publicPenalty,
    [`rooms/${roomCode}/chat/${roundId}/${messageId}`]: {
      uid,
      playerName: accuser.name,
      kind: 'system',
      text: `${accuser.name} wrongly accused the artist and lost 50% of points`,
      createdAt: now,
    },
  })

  return { correct: false, penalty }
})
