# Gainstracker

Mobile-first PWA for logging gym sessions, viewing history and strength trends, and coach roster management.

Live app: https://gainstracker-fd8c9.web.app

## Local development

```bat
cd C:\Users\steve\WorkoutTracker
copy .env.example .env
npm install
npm run dev
```

Fill `.env` with Firebase web app config from the [Firebase console](https://console.firebase.google.com/project/gainstracker-fd8c9/settings/general).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Production build |
| `npm run deploy:hosting` | Build + deploy hosting |
| `npm run deploy:firestore` | Deploy Firestore rules/indexes |
| `npm run import:workouts` | Import Excel history (see script help) |

## Roles

- **Coach** (`stevenfhulett@gmail.com`): roster, invites, athlete read-only views, starter library
- **Athletes**: sign up with invite code, log workouts, view own history/trends

## Invite flow

1. Coach opens **Roster** → copy invite link or code
2. Athlete opens link → sign up with email, password, and code
3. Athlete appears on coach roster automatically

See [docs/ONBOARDING.md](docs/ONBOARDING.md) for GitHub, CI, deploy, and export steps.

## Export / backup

- **Coach:** Roster → Export CSV (per athlete)
- **Athlete:** History → Export CSV

## Deploy

```bat
npm run deploy:hosting
firebase deploy --only firestore
```

Firestore rules must be deployed when security rules change.
