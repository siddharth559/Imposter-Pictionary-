import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { signInGuest, watchAuthState } from './auth'

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = watchAuthState((nextUser) => {
      setUser(nextUser)
      setIsLoading(false)
    })

    signInGuest().catch(() => setIsLoading(false))

    return unsubscribe
  }, [])

  return { user, isLoading }
}
