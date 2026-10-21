# Gym Tracker v0 implementation plan

Status: local v0 implementation complete  
Scope: local-only Android-first Expo app  
Source of truth: raw SQLite workouts and sets

## v0 objective

Deliver one reliable local workout loop:

```text
Open app
  -> configure profile
  -> start an empty workout
  -> add exercises whenever needed
  -> log warm-up and working sets
  -> finish workout
  -> view history
  -> edit or delete a set
  -> see recalculated PRs and progress
```

Authentication, API synchronization, leaderboards, templates, and nutrition are not part of v0.

## Locked product rules

- Only `completed` workouts count toward progress and consistency.
- An `active` workout can be resumed.
- An `abandoned` workout remains stored but contributes to no calculations.
- A completed workout may be edited later.
- A workout may start with no exercises selected.
- Exercises can be added at any point while a workout is active.
- A workout must contain at least one set before it can be completed.
- A qualifying workout contains at least three non-deleted working sets.
- Warm-up sets never count toward PRs, e1RM, volume, or qualification.
- A reps PR compares only against earlier working sets at the same or heavier load.
- Bodyweight exercise `weight_kg` means added weight; zero means bodyweight only.
- Bodyweight exercises do not produce e1RM or leaderboard results.
- All weights are stored in kilograms; unit conversion happens only at the UI boundary.
- All timestamps are UTC ISO strings.
- `local_date` and `timezone_id` are captured when the set is logged and never recomputed later.
- Soft-deleted records are excluded from display and calculations.
- PRs are recomputed from raw history after edits and deletions.
- The first valid e1RM after only high-rep sets is a baseline, not a PR.

## Application boundaries

```text
Screen
  -> feature hook / use case
    -> repository interface
      -> SQLite adapter

PR and progress calculations are pure local domain code. Their PR rules are covered by
the same cases as the standalone `gym-core` test package.
```

Screens must not contain SQL. Repositories must not contain React components. `gym-core` must remain independent of SQLite, React Native, and the network.

## v0 screen map

```text
app/
├── onboarding
├── (tabs)/
│   ├── index             # Home
│   ├── train             # Start/resume workout
│   ├── progress          # Lift history and charts
│   └── profile           # Profile and preferences
├── active-workout
├── exercise-picker
├── workout-summary
├── workout-history
└── exercise-detail
```

The first usable build only needs onboarding, Home, Train, active workout, and history. Progress can begin as a data-first screen with no visual polish.

## Repository contracts

The first implementation should expose these use cases:

```text
ProfileRepository
  getProfile()
  saveProfile(profile)

ExerciseRepository
  listActiveExercises(locale)
  getExercise(id, locale)

WorkoutRepository
  createWorkout(input)
  getActiveWorkout()
  getWorkout(workoutId)
  addSet(input)
  finishWorkout(workoutId, endedAt)
  abandonWorkout(workoutId, endedAt)
  listCompletedWorkouts(limit, offset)
  getWorkout(workoutId)

SetRepository
  addSet(input)
  updateSet(setId, input)
  deleteSet(setId, deletedAt)
  listWorkoutSets(workoutId)
  listExerciseSets(exerciseId)

CalculationService
  getWorkoutPRs(workoutId)
  getExerciseProgress(exerciseId)
  getConsistencySummary(range)
```

The repository layer should return domain objects, not raw SQLite row shapes. Database row mapping belongs in the SQLite adapter.

## Active workout behavior

1. On launch, check for an active workout.
2. If one exists, offer Resume or Abandon.
3. Starting a new workout creates an empty workout and snapshots timezone and current bodyweight.
4. The user adds exercises from inside the active workout.
5. Adding a set writes to SQLite immediately.
6. The UI recalculates PR feedback from current local history.
7. Finish requires at least one set and writes `ended_at` plus `status = 'completed'`.
8. Any later edit or deletion recalculates derived results from all remaining raw sets.

## Validation rules

Client validation should happen before the database write:

- exercise must exist and be active;
- reps must be an integer greater than or equal to 1;
- weight must be finite and non-negative;
- RPE, when present, must be between 1 and 10;
- `performed_at` must be a valid UTC timestamp;
- `local_date` must match the captured timezone at logging time;
- a large increase over the recent best should require confirmation, not be silently rejected.

The database constraints remain the final local safety net.

## Acceptance criteria for v0

- The app starts with an empty-state home screen.
- A profile can be saved locally and survives restart.
- The exercise library is available in English and supports Amharic fallback behavior.
- A user can create, resume, complete, and abandon a workout.
- A user can log, edit, and soft-delete sets while offline.
- A deleted set disappears from history and calculations.
- PR results match the shared `gym-core` tests, including the heavier-load rep-PR case.
- Three working sets on a completed workout create one qualifying local date.
- Multiple workouts on the same local date create one heatmap day.
- The app handles a timezone midnight boundary using stored `timezone_id` and `local_date`.
- The app has no dependency on an API or login to complete the local workout loop.

## Implementation order

### Slice 1: foundations

- Done: add the SQLite migrations and migration runner.
- Done: add typed profile and exercise seed data.
- Done: add database row/domain mapping.
- Done: add profile and exercise repositories.
- Done: add workout selection and workout repositories.
- Done: add tests for migrations, timezones, seed data, and repositories.

### Slice 2: workout loop

- Done: build onboarding and profile persistence.
- Done: build exercise picker.
- Done: build active workout and set-row input.
- Done: add resume, finish, and abandon behavior.
- Remaining: replace the temporary tab routes with the final v0 route map.

### Slice 3: history and calculations

- Done: build workout history and set editing.
- Done: add soft deletion and recalculate from remaining raw sets.
- Done: fix and expand `gym-core` PR tests, including heavier-load rep PRs.
- Done: add e1RM, personal records, exercise progress, qualification, and consistency calculations.

### Slice 4: quality pass

- Done: add loading, empty, and error states across the main local workflow.
- Partial: the exercise library has English/Amharic data support; full UI translation is deferred.
- Remaining: design polish and low-end Android device testing.
- Done: add lint, typecheck, and test commands.

## Explicitly deferred

- Google authentication and server sessions
- Express API and PostgreSQL
- Sync outbox
- Templates
- Leaderboards
- Nutrition guidance
- AI coaching
- XP, levels, seasons, and gamification

The server phase starts only after the local workout loop is dependable.
