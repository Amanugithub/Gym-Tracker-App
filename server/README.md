# Gym Tracker backend

This is the first Express/PostgreSQL foundation for the local-first sync plan.
The API verifies Google ID tokens when `GOOGLE_CLIENT_ID` is configured.
Development mode can still use the explicit `DEV_AUTH_USER_ID` from `.env` when
no bearer token is supplied, so local sync remains testable before Google Cloud
setup is complete.

## Run locally

```bash
cd server
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

The development setup expects PostgreSQL to be running locally at the host and
port in `DATABASE_URL`. Docker is not required.

Health check:

```bash
curl http://localhost:3000/health
```

The response should contain `{"ok":true,"database":"ok"}`. A database failure
returns HTTP 503 instead of a misleading healthy response. In production, set
`CORS_ORIGINS` to a comma-separated browser-origin allowlist. Native mobile
requests normally do not need a CORS entry.

Development sync request authentication is automatic while `NODE_ENV` is not
`production` and no bearer token is supplied. With Google configured, mobile
requests send the Google ID token as a bearer token. The sync routes are:

```text
POST /v1/sync/push
GET  /v1/sync/pull?since=<server-cursor>
```

Custom templates are included in push and pull, including their ordered
exercises and deletion tombstones. See [the sync design](../docs/sync-design.md)
for ownership, terminal workout, tombstone, and conflict rules.
