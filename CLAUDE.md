# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deploy

```bash
vercel deploy --prod   # deploy to production
git push               # also triggers Vercel auto-deploy via GitHub
```

To apply a new Supabase migration:
```bash
supabase db push
```

## Architecture

This is a **static frontend + Vercel serverless functions** app with no framework or build system beyond a single script.

### How Supabase credentials reach the browser

`build.js` runs at Vercel deploy time, reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from env, and writes them into `config.js` as globals (`window.SUPABASE_URL`, `window.SUPABASE_ANON_KEY`). `config.js` is gitignored and must exist locally for the `file://` preview to work. `index.html` loads `config.js` before `app.js`.

### Data split: localStorage vs Supabase

- **Tasks and categories** — stored entirely in `localStorage` via `app.js`. No database involved.
- **Notes** — stored in Supabase (`notes` table). Read and written directly from `app.js` using the Supabase JS client loaded from CDN.
- **Email activity** — stored in Supabase (`email_events` table), written only by serverless functions (never from the browser).

### Serverless functions (`api/`)

- `api/share.js` — called by the browser when a user clicks "Share via email". Sends email via Resend from `noreply@ariellebrown.com` and inserts a `sent` row into `email_events`. Uses `RESEND_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
- `api/resend-webhook.js` — receives POST events from Resend (`email.delivered`, `email.opened`, `email.clicked`, `email.bounced`). Verifies the request signature using `RESEND_WEBHOOK_SECRET`, looks up the `note_id` by `message_id`, and inserts an event row. Uses `SUPABASE_SERVICE_ROLE_KEY` (not the anon key) to bypass RLS.

### Environment variables

| Variable | Where used |
|---|---|
| `SUPABASE_URL` | `build.js` (injected into `config.js`) and serverless functions |
| `SUPABASE_ANON_KEY` | `build.js` (injected into `config.js`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Serverless functions only — bypasses RLS |
| `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD` | Supabase CLI (`supabase db push`) |
| `RESEND_API_KEY` | `api/share.js` |
| `RESEND_WEBHOOK_SECRET` | `api/resend-webhook.js` — rejects unsigned requests with 401 |

All variables must be set in both `.env` (local) and Vercel project env vars (production).

### Live URLs

- **App:** https://task-manager-kappa-tawny.vercel.app
- **Resend webhook endpoint:** https://task-manager-kappa-tawny.vercel.app/api/resend-webhook
- **GitHub:** https://github.com/mythic-makings/task-manager
