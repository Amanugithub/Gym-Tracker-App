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
docker compose up -d
npm run db:migrate
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

Development sync request authentication is automatic while `NODE_ENV` is not
`production` and no bearer token is supplied. With Google configured, mobile
requests send the Google ID token as a bearer token. The sync routes are:

```text
POST /v1/sync/push
GET  /v1/sync/pull?since=<server-cursor>
```

See [the sync design](../docs/sync-design.md) for ownership, terminal workout,
tombstone, and conflict rules.
