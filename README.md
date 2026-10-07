# GemTrack API

Small REST API for the GemTrack frontend practice project.
Express 5 + TypeScript, JWT auth, zod validation. Data is stored in
`data/gems.json` (created from `data/gems.seed.json` on first run).

## Run

```bash
npm install
npm run dev        # http://localhost:3001
```

Optional environment variables: `PORT` (3001), `JWT_SECRET`,
`CLIENT_ORIGIN` (http://localhost:5173), `DELAY_MS` (artificial latency).

To reset the data, stop the server and delete `data/gems.json`.

## Demo users (POST /api/v1/auth/login)

| Email | Password | inventory permission |
|---|---|---|
| admin@gemtrack.dev | Admin@123 | 4 (write) |
| viewer@gemtrack.dev | Viewer@123 | 2 (read) |
| guest@gemtrack.dev | Guest@123 | 0 (none) |

Login returns `{ "token": "<JWT>" }`. Send it as `Authorization: Bearer <token>`.
The JWT payload holds `name, role, tenantId, currency, permissions`.

## Endpoints (all under /api/v1)

| Method | Path | Needs | Notes |
|---|---|---|---|
| POST | /auth/login | none | body `{ email, password }` |
| GET | /gems | read (2) | query: `page, limit, q, status, ownership, stockType, minPrice, maxPrice, sort` |
| GET | /gems/:id | read (2) | |
| POST | /gems | write (4) | body: all fields except `id` (including `ownership`, `stockType`) |
| PATCH | /gems/:id | write (4) | body: any subset of fields |
| DELETE | /gems/:id | write (4) | 204 on success |

`GET /gems` returns `{ data, total, page, limit, totalPages }`.
Defaults: `page=1`, `limit=10` (max 100), `sort=sku:asc`.
`ownership`: `owned | memo_in | partner`. `stockType`: `parcel | single | set | pair`.
Sortable fields: `sku, name, caratWeight, cost, price, status`
(for example `sort=price:desc`).

## Errors

Every error is `{ message, errors?, requestId }`.

| Status | Meaning |
|---|---|
| 400 | malformed JSON |
| 401 | missing, invalid or expired token (frontend should go to login) |
| 403 | logged in but not allowed |
| 404 | gem or route not found |
| 409 | duplicate SKU |
| 422 | validation failed, field messages in `errors: [{ path, message }]` |

Every response carries an `X-Request-Id` header (your own is echoed back
if the request sends one).
