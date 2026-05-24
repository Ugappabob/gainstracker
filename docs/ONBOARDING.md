# Onboarding checklist

Use this when setting up Gainstracker for the first time or moving the project to a new machine.

## 1. GitHub + CI

The repo ships with `.github/workflows/ci.yml` (install, test, build). CI runs automatically once the project is on GitHub.

```bat
cd C:\Users\steve\WorkoutTracker
git remote add origin https://github.com/YOUR_USER/gainstracker.git
git push -u origin master
```

After the first push, open the **Actions** tab on GitHub to confirm the workflow passes.

## 2. Firebase

1. Copy `.env.example` to `.env` and fill in web app config from the [Firebase console](https://console.firebase.google.com/project/gainstracker-fd8c9/settings/general).
2. Deploy rules and hosting when you change security or ship a release:

```bat
npm run deploy:hosting
firebase deploy --only firestore
```

## 3. Coach setup (in the app)

1. Sign in as **stevenfhulett@gmail.com**.
2. Open **Roster** — complete the in-app checklist (stored in your browser).
3. Copy the **invite link** and send it to athletes.
4. On **Home**, run **Install starter library** if you want preset exercises and templates.
5. Open **Templates** to edit program templates before athletes log sessions.

## 4. Athlete sign-up

1. Athlete opens the invite link.
2. Creates account with email, password, and invite code.
3. They appear on your roster automatically.

## 5. Backup / export

- **Coach:** Roster → **Export CSV** per athlete (all sessions and sets).
- **Athlete:** History → **Export CSV** (own data only).

CSV columns: `date`, `status`, `location`, `title`, `exercise`, `set_num`, `weight`, `reps`, `warmup`.

## Roster features

| Feature | Description |
|---------|-------------|
| Last session | Most recent workout date per athlete |
| Coach notes | Private notes on each athlete (saved on blur) |
| Remove | Unlinks athlete from roster; their account and history remain |
| Export CSV | Full workout backup for that athlete |
