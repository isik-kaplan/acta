# acta

A small personal kanban board: boards, columns, cards you drag between them, and a push notification
when a card comes due. Installable as a PWA on phone and desktop.

- **Backend**: Litestar + SQLAlchemy (async) + SQLite, session-cookie auth, `isik` for env config,
  Web Push via `pywebpush` with a reminder loop running inside the app process.
- **Frontend**: Vite + React + TypeScript + react-router, `@dnd-kit/core` for drag and drop,
  `vite-plugin-pwa` (injectManifest) with a service worker that shows the reminders.
- **Deploy**: one Dockerfile (multi-stage: build frontend, install backend deps, slim runtime with
  nginx in front of uvicorn).

## Local development

Backend (needs [uv](https://docs.astral.sh/uv/)):

```sh
cp example.env .env   # then set SECRET_KEY, and for plain http: SESSION_COOKIE_SECURE=False
cd backend
uv sync
uv run litestar --app app.main:app run --reload
```

Frontend (separate terminal):

```sh
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:8000`. Turn `REGISTRATION_ENABLED=True` on
to create your account, then off again.

## Reminders

Every `REMINDER_INTERVAL_SECONDS` (default 60) the backend looks for cards whose due time has passed
and that haven't been reminded yet, pushes a notification to every device the card's owner turned
notifications on for (Settings > Notifications), and marks the card reminded. Changing or clearing a
card's due date re-arms it. A device the push service reports gone (404/410) is dropped.

The VAPID key pair is generated on first start and kept beside the database as `vapid.json`, so it
survives restarts and redeploys as long as the data directory does - every subscription is tied to
it. Set `VAPID_PRIVATE_KEY`/`VAPID_PUBLIC_KEY` to pin a pair instead.

Push needs a secure context: `https://`, or `http://localhost`. On iPhone and iPad it works only
once acta is added to the Home Screen and opened from there.

## Testing

Backend (pytest + hypothesis, 100% branch coverage enforced):

```sh
cd backend
uv run pytest --cov --cov-report=term-missing
```

Frontend (vitest + fast-check, 100% coverage enforced):

```sh
cd frontend
npm run test:coverage
```

### Mutation testing

Coverage only proves a line ran; mutation testing proves a test would notice if it were wrong. Every
mutant has to be killed by a test, or exempted with a reason why nothing the app does can differ.

Backend (mutmut). `mutmut run` itself exits 0 whatever survives - `check_mutants.py` re-runs each
survivor against the whole suite and fails on anything still alive:

```sh
cd backend
rm -rf mutants && uv run mutmut run && uv run python scripts/check_mutants.py
```

Exemptions live in `backend/mutation-exemptions.toml`, keyed by mutant and pinned to a hash of its
function, so editing the function forces the entry to be re-read.

Frontend (Stryker, fails below a 100% score):

```sh
cd frontend
npm run test:mutation              # incremental; report: reports/mutation/index.html
npx stryker run --force            # every mutant, ignoring the cache
```

A frontend exemption is a `// Stryker disable next-line <mutator>: <reason>` comment directly above
the code it covers. `stryker-plugins/ignore-equivalent.mjs` ignores two classes outright: fixed
`className`/`style` values (jsdom lays nothing out) and empty hook dependency lists.

Both also run in CI - by hand, and weekly - via `.github/workflows/mutation.yml`.

## Docker

```sh
docker build -t acta .
docker run -p 8080:80 -e SECRET_KEY=... -e SESSION_COOKIE_SECURE=False -v acta-data:/app/data acta
```

Then open http://localhost:8080. Behind HTTPS leave `SESSION_COOKIE_SECURE` at its default (True).
Mount a persistent volume at `/app/data` - it holds both the SQLite database and the VAPID keys.
The image ships a `/health` endpoint for the platform's healthcheck.

## Layout

```
backend/    Litestar API - app/controllers, app/models.py, app/services (boards, push, reminders, vapid)
frontend/   React SPA - src/pages, src/components, src/sw.ts + src/sw/handlers.ts, src/styles/tokens.css
Dockerfile  multi-stage build, single image for both
```
