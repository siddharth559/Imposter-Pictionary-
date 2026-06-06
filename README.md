# Imposter Pictionary

Initial Vite + React + TypeScript app scaffold for the mobile-first multiplayer
game.

## Structure

```text
src/
  components/
  pages/
  firebase/
  game/
  styles/
```

## Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in the Firebase web app values:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Checks

```bash
npm run lint
npm run build
```

This scaffold includes React Router, Firebase client initialization, and an
anonymous auth helper. Full Firebase gameplay logic is intentionally not
implemented yet.
