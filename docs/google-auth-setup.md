# Google sign-in setup

Google sign-in is now implemented, but it needs Google Cloud credentials and a
development build. Expo Go cannot load the native Google sign-in module.

## What to create in Google Cloud

Create or select a Google Cloud project and configure the OAuth consent screen.
For early testing, choose External and add your own Google account as a test
user.

Create these OAuth client IDs:

1. **Web application client**
   - Used by the backend to verify ID tokens.
   - Put this value in `server/.env` as `GOOGLE_CLIENT_ID`.
   - Put the same value in the frontend `.env.local` as
     `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

2. **Android application client**
   - Package name: `com.amanuel.gymtracker`.
   - Add the SHA-1 certificate fingerprint of the development build.
   - Keep this value in `.env.local` as
     `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.

3. **iOS application client** (only when testing on iPhone)
   - Bundle ID: `com.amanuel.gymtracker`.
   - Put this value in `.env.local` as
     `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

The backend uses the Google account `sub` value as the permanent user ID. It
does not use the email address as the account identifier.

## Local files

Create `.env.local` in the project root:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:3000
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

Add the web client ID to `server/.env`:

```env
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

Restart the backend after changing `server/.env`.

## Build and test

Google sign-in needs a development build rather than Expo Go:

```bash
npx expo prebuild
npx expo run:android
```

Start the backend separately:

```bash
cd server
npm run dev
```

The temporary **Continue without an account** option remains available for
offline-only testing. Authenticated sync requests send the Google ID token to
the backend as a bearer token.
