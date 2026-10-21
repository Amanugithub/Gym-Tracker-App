# Workout template design

Status: local data and server sync foundation complete; UI is next

Templates are optional starting points. A user can still start a completely
blank workout and choose exercises during the session.

## Template rules

- Built-in templates are seeded locally: Push Day, Pull Day, Legs Day, Upper
  Body, and Full Body.
- Built-in templates are read-only. A user can copy the idea into a custom
  template later.
- Custom templates have a user-provided name and an ordered list of exercises.
- A custom template must contain at least one active exercise.
- Starting from a template copies its exercise list into the new workout.
- Adding, removing, or reordering exercises in a workout never changes the
  template.
- Editing or deleting a template never changes old or active workouts that
  were created from it.
- The first template version does not prescribe sets, reps, weights, or rest
  times. This keeps templates compatible with flexible, changing sessions.

## Storage and restore

The local database stores templates separately from workout history. Resetting
local data removes custom templates but keeps the built-in templates. Custom
templates are included in the sync outbox and server snapshot, including
deletions, so a full pull after reinstall restores them. Built-in templates are
recreated by local seeding and are never duplicated by sync.

## Active workout recovery

Starting a workout writes an `active` row immediately. Closing the app,
backgrounding it, or having the operating system remove the app process does
not change that row. The next launch can resume it. There is no automatic
timeout or abandonment because that could discard a real session.

Uninstalling the app, clearing its storage, or using Reset local data removes
the local active workout. Active workouts are not sent to the server until the
user finishes or abandons them.
