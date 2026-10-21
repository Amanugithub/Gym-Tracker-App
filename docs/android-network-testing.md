# Android and network testing

The app is local-first, so each test should verify that the workout is still
available on the phone before checking the server. A failed sync must never
erase local data.

## One-time setup

From the repository root:

```bash
adb devices
```

The phone should appear as `device`, not `unauthorized`. Start PostgreSQL and
the API in separate terminals:

```bash
cd server
npm run db:migrate
npm run dev
```

Check the API from the computer:

```bash
curl http://127.0.0.1:3000/health
```

## USB test

With the phone connected over USB, forward the API port through ADB:

```bash
adb reverse tcp:3000 tcp:3000
```

Set the frontend environment to:

```text
EXPO_PUBLIC_API_URL=http://127.0.0.1:3000
```

Then build and launch the development client:

```bash
npx expo run:android
```

Use USB testing first. It avoids Wi‑Fi firewall and LAN-address problems.

## Wi-Fi test

Put the phone and computer on the same network. Find the computer's LAN
address, then set for example:

```text
EXPO_PUBLIC_API_URL=http://192.168.1.42:3000
```

Before opening the app, visit `http://192.168.1.42:3000/health` in the phone's
browser. If that does not load, the app cannot sync yet; check the computer's
firewall and PostgreSQL/API status.

## Required sync checks

1. Log a workout, finish it, and press Sync now. Confirm the API responds and
   the sync status shows a recent successful time.
2. Turn on airplane mode. Log another workout and finish it. The workout must
   remain visible in History, with a pending sync count in Settings.
3. Return to network coverage and revisit Settings. Automatic retry should run;
   pressing Sync now should also work. The pending count should reach zero.
4. Stop the API, create and finish one workout, restart the API, and retry. The
   same workout should upload once without creating a duplicate.
5. After a successful sync, reset or reinstall the app, sign in with the same
   development identity, and pull. The profile, bodyweight entries, custom
   templates, and completed/abandoned workouts should return. Built-in
   templates should be present even before the pull.
6. Open a completed workout and confirm performance sets cannot be edited or
   deleted. Notes may still be changed.

## Useful diagnostics

```bash
adb logcat -c
adb logcat | rg "Gym Tracker|Sync|ReactNativeJS|ERROR"
```

The API URL is compiled into the development client. After changing
`EXPO_PUBLIC_API_URL`, restart Expo or rebuild the client so the new value is
loaded.
