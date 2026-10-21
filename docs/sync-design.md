# Gym Tracker sync design

Status: backend foundation and local sync connection

## Ownership

The phone remains local-first. SQLite is written immediately, even when the
device is offline. The server is the durable backup and restore source after a
user signs in with Google.

## What syncs

- Profile, including optional height and current bodyweight
- Bodyweight measurements
- Completed and abandoned workouts
- Workout exercises
- Sets, including deleted-set tombstones
- Workout notes

Active workouts are intentionally not uploaded. When a workout becomes
completed or abandoned, the app places it in the sync queue. A manual Sync now
button retries failed uploads, while automatic retry can run when connectivity
returns.

## Terminal workout rule

The server accepts only `completed` and `abandoned` workouts. Once a workout is
terminal, its exercises and sets are immutable. Notes remain editable because
they do not change performance calculations.

Sets deleted while a workout is active are uploaded as tombstones with the
final workout snapshot. They remain deleted after restore and cannot reappear.

## Identity

Google authentication will provide the verified Google subject. The API uses a
stable user id on every row and never trusts a user id supplied in the request
body. The current development server has an explicit development-only user id
bridge; it must be replaced by Google ID-token verification before deployment.

## Conflict rules

- Client-generated ids make repeated uploads safe.
- Profile and bodyweight entries use the newest client update timestamp.
- Workout performance data is accepted once; later uploads may update only the note.
- Deleted bodyweight entries remain deleted when a newer tombstone is received.
- Pull uses a server cursor so clock differences on phones do not control pagination.

## API foundation

```text
GET  /health
POST /v1/sync/push
GET  /v1/sync/pull?since=<server-cursor>
```

The push request is a batch containing one profile, bodyweight entries, and
terminal workout snapshots. Pull returns normalized profile, measurements,
workouts, workout exercises, and sets. A missing cursor requests a full restore.

## Next backend slice

1. Add durable pending-sync status and automatic retry.
2. Test reinstall restore and duplicate/retry uploads.
3. Configure Google ID-token verification when account auth is resumed.
