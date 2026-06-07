import { httpsCallable } from 'firebase/functions'
import { signInGuest } from './auth'
import { getFirebaseFunctions } from './client'

export async function submitFeedback(feedbackText: string, page: string, roomCode?: string) {
  await signInGuest()

  const submitFeedbackCallable = httpsCallable<
    {
      feedbackText: string
      page: string
      roomCode?: string
      userAgent: string
    },
    { ok: boolean; sent: boolean }
  >(getFirebaseFunctions(), 'submitFeedback')

  const { data } = await submitFeedbackCallable({
    feedbackText,
    page,
    roomCode,
    userAgent: navigator.userAgent,
  })

  return data
}
