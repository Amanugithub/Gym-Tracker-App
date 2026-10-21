# Gym Tracker backend

This is the first Express/PostgreSQL foundation for the local-first sync plan.
Google token verification is intentionally not enabled yet. Development mode
uses the explicit `DEV_AUTH_USER_ID` from `.env` so the API can be exercised
locally without pretending that authentication is production-ready.

## Run locally

```bash
cd server
cp .env.example .env
npm install
docker compose up -d
npm run db:migrate
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

Development sync request authentication is automatic while `NODE_ENV` is not
`production`. The sync routes are:

```text
POST /v1/sync/push
GET  /v1/sync/pull?since=<server-cursor>
```

See [the sync design](../docs/sync-design.md) for ownership, terminal workout,
tombstone, and conflict rules.
