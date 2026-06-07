import { onValue, push, ref, remove, set } from 'firebase/database'
import { getFirebaseDatabase } from './client'
import type { CanvasStroke } from '../game/types'

function strokesPath(roomCode: string, roundId: string) {
  return `rooms/${roomCode}/strokes/${roundId}`
}

export function createStrokeId(roomCode: string, roundId: string) {
  return push(ref(getFirebaseDatabase(), strokesPath(roomCode, roundId))).key
}

export function saveStroke(roomCode: string, roundId: string, strokeId: string, stroke: CanvasStroke) {
  return set(ref(getFirebaseDatabase(), `${strokesPath(roomCode, roundId)}/${strokeId}`), stroke)
}

export function clearRoundStrokes(roomCode: string, roundId: string) {
  return remove(ref(getFirebaseDatabase(), strokesPath(roomCode, roundId)))
}

export function listenToRoundStrokes(
  roomCode: string,
  roundId: string,
  callback: (strokes: CanvasStroke[]) => void,
) {
  return onValue(ref(getFirebaseDatabase(), strokesPath(roomCode, roundId)), (snapshot) => {
    const value = snapshot.val() as Record<string, CanvasStroke> | null
    const strokes = Object.values(value ?? {})
      .filter((stroke) => stroke.kind === 'fill' || (Array.isArray(stroke.points) && stroke.points.length > 0))
      .sort((a, b) => a.createdAt - b.createdAt)

    callback(strokes)
  })
}
