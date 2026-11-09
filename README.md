# ToDo app (full stack)

A single-user ToDo list. It has an **Express + SQLite API** in [`server/`](server) and a **React + Tailwind UI** in [`web/`](web), connected through the Vite dev proxy.

- Design spec, including the decision log: [`docs/superpowers/specs/2026-11-09-todo-app-design.md`](docs/superpowers/specs/2026-11-09-todo-app-design.md)
- Implementation plan (the AI-facing prompt), including plan revisions: [`docs/superpowers/plans/2026-11-09-todo-app.md`](docs/superpowers/plans/2026-11-09-todo-app.md)

## Run it

Requirements: **Node 20.19+** (developed on v20.19.4) and npm 10. No other setup is needed: no `.env` file, no database server.

```bash
# terminal 1 – API on http://127.0.0.1:3001 (creates server/data/todos.db on first run)
cd server && npm install && npm run dev

# terminal 2 – UI on http://localhost:5173 (proxies /api to the API)
cd web && npm install && npm run dev
```

Open http://localhost:5173. Start the API first. If it isn't running, the UI shows "Can't reach the server" with a Retry button.

| Command (run in `server/` or `web/`) | What it does |
|---|---|
| `npm test` | Runs the test suite (Vitest) |
| `npm run typecheck` | Type-checks the source **and** the tests |
| `npm run build` | Production build (`server`: `dist/`, run it with `npm start`; `web`: `dist/`) |

Optional overrides, only needed if a port is taken: `HOST` (default `127.0.0.1`), `PORT` (`3001`) and `DB_PATH` (`data/todos.db`) for the server; `API_URL` (`http://127.0.0.1:3001`) for the web dev proxy. For example, `PORT=4000 npm run dev` and `API_URL=http://127.0.0.1:4000 npm run dev`.

## API

All routes are under `/api` and use JSON. Every endpoint maps to a behaviour in the brief.

| Method and path | Body | Success | Errors |
|---|---|---|---|
| `GET /api/todos?includeCompleted=true` | `includeCompleted` is optional: `true` or `false` (default `false`, so completed todos are hidden) | `200` `Todo[]` sorted by `ordinal` | `400` |
| `POST /api/todos` | `{ title, description?, dueAt? }` | `201` `Todo` | `400`, `413`, `415` |
| `PATCH /api/todos/:id` | At least one of `{ title, description, dueAt, completed }`. `dueAt: null` clears the date. | `200` `Todo` | `400`, `404`, `413`, `415` |
| `DELETE /api/todos/:id` | – | `204` | `404` |

`Todo` is `{ id, title, description, dueAt, ordinal, completed }`. Every error has the same shape: `{ "error": { "code", "message", "details?" } }`.

```bash
curl -X POST localhost:3001/api/todos -H 'Content-Type: application/json' \
  -d '{"title":"Write README","dueAt":"2026-11-10T17:00:00+01:00"}'
# 201 {"id":"2526875a-…","title":"Write README","description":"","dueAt":"2026-11-10T16:00:00.000Z","ordinal":6,"completed":false}

curl localhost:3001/api/todos                          # open todos only
curl 'localhost:3001/api/todos?includeCompleted=true'  # all todos
curl -X PATCH localhost:3001/api/todos/<id> -H 'Content-Type: application/json' -d '{"title":"Write the README","dueAt":null}'
curl -X PATCH localhost:3001/api/todos/<id> -H 'Content-Type: application/json' -d '{"completed":true}'   # or false to undo
curl -X DELETE localhost:3001/api/todos/<id>           # 204

curl -X POST localhost:3001/api/todos -H 'Content-Type: application/json' -d '{"title":"  ","dueAt":"2026-12-01T09:00:00","id":"x"}'
# 400 {"error":{"code":"VALIDATION_ERROR","message":"Invalid request","details":[
#   {"field":"title","message":"Title is required"},
#   {"field":"dueAt","message":"Due date must be ISO 8601 with a timezone"},
#   {"field":"id","message":"Unknown field"}]}}
```

Other error codes: `INVALID_JSON` (400), `UNSUPPORTED_MEDIA_TYPE` (415), `PAYLOAD_TOO_LARGE` (413, body over 10 KB), `NOT_FOUND` (404, also returned for ids that are not UUIDs), and `INTERNAL_ERROR` (500, with a generic message; details are logged on the server only).

## Design

**Server** (`routes → service → repository`):
- `todo.routes.ts` handles HTTP only: it parses input with Zod, calls the service and picks the status code.
- `TodoService` holds the domain rules: defaults, UTC normalisation, not-found.
- `TodoRepository` is an interface, implemented with `better-sqlite3`, prepared statements and an explicit row mapper.
- `createApp(repo)` takes its dependencies as a parameter and doesn't call `listen`, so tests inject a `:memory:` database or a repository that throws. `index.ts` is the only file that wires SQLite and Express together.
- One error middleware turns every failure into the error shape above.

**Web:**
- `todosApi.ts` is the only module that talks to the network. It has a 10 s timeout, and every failure becomes an `ApiError` with a `kind`.
- `useTodos` (`useReducer`) owns all list state. It's used instead of `useState` because several fields change together after async calls, and the transitions are pure and unit-tested. There's no state library, because there's one list and one data source.
- The components (`TodoForm` for both create and edit, `TodoItem`, `TodoList`, `ErrorBanner`) only render and raise events.
- Validation rules live in a pure `validateTodoForm`.

**Principles:**
- **Single responsibility:** one job per module, as listed above.
- **Dependency inversion and Liskov substitution:** the service depends on the repository interface, and the test doubles substitute for it.
- **Open/closed:** a new error type is a new `AppError` subclass; the handler doesn't change.
- **Interface segregation:** the repository exposes only the 4 operations that are used.
- **YAGNI:** nothing outside the brief.

**Key decisions and trade-offs:**
- **Ordinal = `max(ordinal) + 1`**, computed inside the single `INSERT`. Every write is one atomic SQL statement, so there are no explicit transactions. Deletes leave gaps, which is harmless because only relative order matters. A future reorder would need a transaction with a two-step shift, because SQLite checks `UNIQUE(ordinal)` row by row; gaps (for example +100) would avoid that, but reordering isn't required.
- **Dates:** the API accepts ISO 8601 **with an offset**, because a date without one is ambiguous, and stores and returns UTC. The UI sends `datetime-local` values as UTC and displays them in the browser's timezone.
- **Completed todos** are filtered **in SQL** (an index on `(completed, ordinal)` supports it). When shown, they keep their position with a struck-through title. The toggle isn't persisted.
- **No optimistic updates:** the UI applies a change only after the server confirms it, so it never shows a write that failed, and your input is kept on any failure.
- **Validation is server-authoritative.** The web app mirrors the user-facing rules for instant feedback. The types and limits are duplicated by hand, and tests on both sides keep them aligned; a shared schema package would be the next step if the contract grew.
- **Simplification:** the service throws `NotFoundError`, which lives in `http/errors.ts`, so the domain layer touches an HTTP-flavoured file. This keeps one simple error handler and avoids a separate mapping layer.

## Validation rules and assumptions

| Field | Required on create | Default | Rule |
|---|---|---|---|
| `title` | **yes** | – | Trimmed, 1–200 characters. Whitespace only counts as empty, also on PATCH. |
| `description` | no | `""` | Trimmed, at most 2000 characters |
| `dueAt` | no | `null` | ISO 8601 with `Z` or `±hh:mm`; real calendar dates only (`2026-02-30` is rejected). **Past dates are allowed**, so you can record an overdue item. |
| `completed` | not accepted on create | `false` | Boolean, changed with PATCH |
| `id`, `ordinal` | **rejected** if sent | set by the server | `id` is a UUID v4 (`crypto.randomUUID`) |

- Request bodies are strict: unknown keys get `400`, which prevents mass assignment.
- The length limits are safety caps, not targets. The largest valid body (about 8.8 KB even if every character is a 4-byte emoji) fits under the 10 KB body cap.
- Both sides count characters with JS `.length`, so the client and the server always agree.
- The form has no `maxLength`, because it silently truncates pasted text. Instead, the description shows a live `n/2000` counter and an inline error.

## Security, performance and limitations

- **Security** (scaled to one local user, using the OWASP API Top 10 as a checklist):
  - Parameterised SQL only.
  - Strict schemas.
  - 10 KB body cap.
  - `helmet()`. For a JSON API the headers that matter are `nosniff` and `Cross-Origin-Resource-Policy`; it also removes `X-Powered-By`.
  - The server binds to `127.0.0.1` by default.
  - No stack traces in responses.
  - React escaping, with no `dangerouslySetInnerHTML`.
  - Same-origin requests through the dev proxy, so no CORS.
  - The UI never shows the server's developer-facing messages.
- **Deliberately not done:** auth, rate limiting, HTTPS, pagination. Each is the first thing to add if this were exposed or the lists grew.
- **Performance:** profiled with React `<Profiler>` at 500 todos:
  - A keystroke takes 0.24 ms, because only the form re-renders.
  - Toggling one todo took 54.8 ms. After memoising `TodoItem` it takes 1.8 ms.
- **Storage:** SQLite file at `server/data/todos.db` (git-ignored). Data survives restarts; tests use `:memory:`. It's single-process, and edits from multiple tabs are **last write wins**.
- **Browser support:** Chrome 111+, Firefox 128+, Safari 16.4+ (Tailwind v4). The `datetime-local` picker popup looks different in each browser.
- **Development only:** the proxy exists only in `npm run dev`. In production the web build and the API would be served from one origin behind a reverse proxy. If that proxy can't reach the API, the UI shows "Can't reach the server".

## Testing

| Suite | Count | Scope |
|---|---|---|
| `server` unit | 29 | Zod schemas (limits, trimming, offsets, impossible dates, unknown keys, empty PATCH, repeated query params), service rules, repository against `:memory:` (max + 1 after delete, filtering, partial update), config |
| `server` API | 21 | Supertest through `createApp` with a `:memory:` DB: every endpoint, every error code, non-object JSON bodies, `helmet` headers, and a generic `500` with no leaked internals (via a repository that throws) |
| `web` unit | 24 | API client error mapping (including the proxy's plain-text `500` and the timeout), form validation, date round-trip, reducer rules, memoised re-render |
| `web` UI flows | 13 | React Testing Library through the real hook and API client, with only `fetch` stubbed: every target behaviour, inline validation, the stale-response race, and the failure flows (`500`, network, proxy `500`, server `400`, load + Retry, `404`) |

Tests use real collaborators wherever possible (`:memory:` SQLite rather than mocks). A test double is used only to inject failures.

## Verification

**Checks I ran, with results:**
- `npm test`: **server 50/50, web 37/37**. Both typechecks (source and tests) and both production builds are clean. `npm audit` reports **0 vulnerabilities** in both packages.
- Built-server smoke test with `curl`:
  - create, list, edit, complete, uncomplete and delete all work;
  - `400`, `404` and `415` bodies are as documented;
  - the server isn't reachable from the LAN IP;
  - Ctrl+C or SIGTERM exits with code 0, and the data survives a restart;
  - a bad `DB_PATH` or `PORT` exits with code 1.
- Real Vite proxy checks:
  - With `API_URL` pointing at an API on port 4000, requests went through the proxy correctly.
  - With the API down, the response is classified as "can't reach".
- The date round-trip test passes under `TZ=America/Los_Angeles`, `Asia/Kolkata` and `Pacific/Chatham`.
- **Mutation checks:** each failure-flow behaviour was broken deliberately (no reload after `404`, form cleared on failure, proxy `500` treated as a server error, field errors dropped, load failure showing the list, banner not dismissable). Each break was caught by its test.
- The developer used the UI in Chrome on the dev servers (adding and deleting todos).

**Planned but not run:**
- A side-by-side visual check in Firefox and Safari.
- Accessibility auditing beyond labels, roles and focus rings, for example with a screen reader.

## AI usage

**Tool:** Claude Code (Opus) with the *superpowers* skills. The process was brainstorming, then the spec, then the plan, then test-driven execution task by task.

**How the work was directed:**
- I approved each design section, the written spec and the plan before any code was written.
- Implementation ran one task at a time on `main`. After each commit the AI stopped, and I reviewed the diff before the next task started.
- Every change I asked for landed as its own `(review feedback)` commit, so the corrections are visible in `git log`.

**Corrections and decisions I made:**
- **Spec stage:**
  - Ordinal step changed from +1000 gaps to max + 1.
  - Required frontend length validation.
  - Asked how server failures are handled, which led to §5a in the spec.
  - Asked for a backend standards check.
  - Removed rate limiting and other unnecessary extras (`x-powered-by` line, WAL pragmas, crash handlers).
  - Questioned the UUID and the length limits (both kept, with reasons).
  - Asked for the 3-column grid.
  - Chose commit-then-review so corrections stay visible.
- **Implementation:**
  - `npm audit` caught a high-severity Zod 3 advisory, so I upgraded to Zod 4 and Vitest 4 before writing code.
  - Shortened the `dueAt` message.
  - Kept a real DB in the service tests and fixed an unclosed DB handle.
  - **Removed an unnecessary transaction** (a single `INSERT … SELECT` instead).
  - **Removed `GET /api/todos/:id`** and everything only it used.
  - Kept `helmet`.
  - Shortened the UI error copy and stopped showing server messages to users.
  - **Made the proxy target configurable.** Checking it found a real bug: with the API down, the proxy's plain-text `500` showed "not saved" instead of "can't reach". The mocked tests couldn't have caught it, and it's now fixed.
  - Asked for a performance check, which led to profiling and `React.memo`.
- **Found by the AI while verifying**, and fixed with my approval:
  - Test files weren't being type-checked.
  - The `INVALID_JSON` message was misleading for valid-but-non-object JSON.
- Every AI-written change was reviewed by me before the next step. Where tests passed on first run, they were proven by deliberately breaking the behaviour (mutation checks).

## Time, status and next steps

- **Time:** about 2.5 hours, from the first spec commit to the README, including planning and review.
- **Status:** every behaviour in the brief is implemented and tested. Nothing in scope is incomplete.
- **Next steps if this were taken further:**
  - A shared schema package (so the client and server can't drift).
  - Pagination.
  - Reordering (a two-step shift in a transaction, or gaps).
  - Optimistic concurrency, for example with `updatedAt`.
  - Rate limiting and auth before exposing it beyond localhost.
  - Cross-browser visual checks.
