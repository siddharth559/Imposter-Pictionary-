import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { getFirebaseAuth } from './client'

export function signInGuest() {
  const auth = getFirebaseAuth()
  if (auth.currentUser) return Promise.resolve({ user: auth.currentUser })
  return signInAnonymously(auth)
}

export function watchAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback)
}
