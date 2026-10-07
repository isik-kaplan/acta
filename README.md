# acta

A small personal kanban board: boards, columns, cards you drag between them, labels to sort and filter
them by, and push reminders before a card comes due. Installable as a PWA on phone and desktop.

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

A card with a due date can have any number of reminders, each some number of minutes, hours, days or
weeks before its due time (0 is at the due time). Every `REMINDER_INTERVAL_SECONDS` (default 60) the backend looks
for reminders whose time has come and that haven't gone out yet, pushes a notification to every
device the card's owner turned notifications on for (Settings > Notifications), and marks that
reminder sent. Changing or clearing a card's due date re-arms all of them. A device the push service
reports gone (404/410) is dropped.

The VAPID key pair is generated on first start and kept beside the database as `vapid.json`, so it
survives restarts and redeploys as long as the data directory does - every subscription is tied to
it. Set `VAPID_PRIVATE_KEY`/`VAPID_PUBLIC_KEY` to pin a pair instead.

Push needs a secure context: `https://`, or `http://localhost`. On iPhone and iPad it works only
once acta is added to the Home Screen and opened from there.

## Labels

Labels belong to a board; a card can carry any of its board's labels, and a card moved to another
board leaves them behind. Names are unique per board, ignoring case. A label made without a colour
gets the one its board has used least, walking `LABEL_COLORS` (`backend/app/schemas.py`) in an order
that keeps neighbouring hues apart. Each colour is a name, not a value: `frontend/src/styles/labels.css`
gives it a light and a dark pair, and `tests/styles/labels.test.ts` checks every pair stays at WCAG AA
contrast and that the frontend, the stylesheet and the server agree on the list.

The filter above the lanes shows cards with any of the chosen labels, or with all of them once two or
more are on. It lives in the URL (`?labels=<ids>&match=all`), so a filtered board can be bookmarked.

## Security

- **Sessions**: an encrypted, `HttpOnly`, `SameSite=Lax` cookie (`Secure` unless
  `SESSION_COOKIE_SECURE=False`), 30 days. Each carries the user's `session_version`, which a
  password change bumps - every other device's cookie stops counting.
- **Cross-site requests**: `app/csrf.py` refuses any write whose `Sec-Fetch-Site` isn't
  `same-origin`/`none`, or, from a browser without fetch metadata, whose `Origin` isn't this host.
  `SameSite=Lax` alone would still let a sibling subdomain through. Origins in
  `CORS_ALLOW_ORIGINS` are let through.
- **Ownership**: every board, column, card and label is looked up through its owner; someone else's
  answers exactly like a missing one (404).
- **Push**: subscription endpoints must be `https` on a browser push service
  (`PUSH_SERVICE_DOMAINS`), since the server POSTs to them.
- **Headers** (nginx): CSP allowing only acta itself plus the two font services, `X-Frame-Options:
  DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. HSTS belongs on the TLS terminator.
- **Not here yet**: login rate limiting, which depends on which proxy's client IP to trust.

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

## Pre-commit

```sh
pip install pre-commit  # or: brew install pre-commit
pre-commit install
```

Runs ruff (backend) and eslint/prettier/tsc (frontend) on staged files, plus the usual
whitespace/large-file hygiene checks. `pre-commit run --all-files` runs everything once.

## Configuration

All configuration is environment variables, read via `isik.common.config` in
`backend/app/config.py`. Copy `example.env` to `.env` (already gitignored) and fill it in -
`SECRET_KEY` is the only required value; everything else has a documented default.

## Docker / Coolify

```sh
docker build -t acta .
docker run -p 8080:80 -e SECRET_KEY=... -e SESSION_COOKIE_SECURE=False -v acta-data:/app/data acta
```

Then open http://localhost:8080. Behind HTTPS leave `SESSION_COOKIE_SECURE` at its default (True).

On Coolify: point it at this repo, it'll detect the Dockerfile. Set `SECRET_KEY` (and any other
overrides from `example.env`) as environment variables, and mount a persistent volume at
`/app/data` - it holds both the SQLite database and the VAPID keys, so subscriptions survive
redeploys. The image exposes port 80 and ships a `/health` endpoint the platform's healthcheck can
use.

## Layout

```
backend/    Litestar API - app/controllers, app/models.py, app/csrf.py, app/services (boards, labels, push, reminders, vapid)
frontend/   React SPA - src/pages, src/components, src/sw.ts + src/sw/handlers.ts, src/styles/tokens.css
Dockerfile  multi-stage build, single image for both
```
