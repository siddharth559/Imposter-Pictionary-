import { useEffect, useState } from 'react'
import { listenToRoundChat } from '../firebase/chat'
import type { ChatMessage } from '../game/types'

type ChatBoxProps = {
  roomCode: string
  roundId: string
}

export function ChatBox({ roomCode, roundId }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    if (!roomCode || !roundId) {
      setMessages([])
      return undefined
    }

    return listenToRoundChat(roomCode, roundId, setMessages)
  }, [roomCode, roundId])

  return (
    <section className="panel chat-box" aria-label="Guess chat">
      <p className="section-label">Chat</p>
      <div className="chat-message-list">
        {messages.length ? (
          messages.map((message) => (
            <p className={`chat-message chat-message--${message.kind}`} key={message.id}>
              {message.text}
            </p>
          ))
        ) : (
          <p className="empty-state">Guesses will appear here.</p>
        )}
      </div>
    </section>
  )
}
