import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getDatabase, type Database } from 'firebase/database'
import { getFunctions, type Functions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
} satisfies FirebaseOptions

const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const

const missingEnvVars = requiredEnvVars.filter((key) => !import.meta.env[key])

export const firebaseSetupError =
  missingEnvVars.length > 0
    ? `Missing Firebase environment variables: ${missingEnvVars.join(', ')}. Create a .env file from .env.example and restart npm run dev.`
    : null

let appInstance: FirebaseApp | null = null
let authInstance: Auth | null = null
let databaseInstance: Database | null = null
let functionsInstance: Functions | null = null

export function getFirebaseApp() {
  assertFirebaseConfigured()
  appInstance ??= initializeApp(firebaseConfig)
  return appInstance
}

export function getFirebaseAuth() {
  authInstance ??= getAuth(getFirebaseApp())
  return authInstance
}

export function getFirebaseDatabase() {
  databaseInstance ??= getDatabase(getFirebaseApp())
  return databaseInstance
}

export function getFirebaseFunctions() {
  functionsInstance ??= getFunctions(getFirebaseApp())
  return functionsInstance
}

function assertFirebaseConfigured() {
  if (firebaseSetupError) {
    throw new Error(firebaseSetupError)
  }
}
