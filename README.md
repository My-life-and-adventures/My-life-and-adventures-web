# My Life and Adventures — Web

React app for story **viewers** (email link + OTP) and future **admin** dashboard.

Backend API lives in a separate repo.

## Setup

```bash
npm install
cp .env.example .env
```

## Local dev

Run the backend API first, then:

```bash
npm run dev
```

Open `http://localhost:5173/viewer`.

The Vite dev server proxies `/api` to `http://localhost:3000` (see `vite.config.ts`).

## Environment

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | `/api/v1` locally (proxy). Full URL in production, e.g. `https://api.example.com/api/v1` |

## Deploy (Vercel)

1. Import this repo as a new Vercel project (root directory `./`).
2. Set `VITE_API_BASE_URL` to your production backend URL.
3. On the backend, set `APP_VIEWER_BASE_URL` and `WEB_APP_ORIGINS` to your Vercel URL.

## Routes

- `/viewer` — viewer sign-in and stories
- `/admin/*` — admin dashboard (placeholder)
