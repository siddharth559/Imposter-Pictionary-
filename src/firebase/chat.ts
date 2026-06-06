import { onValue, ref } from 'firebase/database'
import { getFirebaseDatabase } from './client'
import type { ChatMessage } from '../game/types'

export function listenToRoundChat(
  roomCode: string,
  roundId: string,
  callback: (messages: ChatMessage[]) => void,
) {
  return onValue(ref(getFirebaseDatabase(), `rooms/${roomCode}/chat/${roundId}`), (snapshot) => {
    const value = snapshot.val() as Record<string, Omit<ChatMessage, 'id'>> | null
    const messages = Object.entries(value ?? {})
      .map(([id, message]) => ({ ...message, id }))
      .sort((a, b) => a.createdAt - b.createdAt)

    callback(messages)
  })
}
