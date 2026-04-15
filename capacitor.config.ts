import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fourstash.app',
  appName: '4Stash',
  webDir: 'dist',
  server: {
    // Load from Firebase Hosting so the WebView origin is https://4stash.com.
    // This allows Instagram/Facebook/Reddit iframes to load (they reject
    // capacitor://localhost). Trade-off: requires network on launch (no offline).
    url: 'https://4stash.com',
    cleartext: false,
  },
  plugins: {
    FirebaseAuthentication: {
      // skipNativeAuth: true — the native plugin only runs the OS-level account
      // picker and returns the raw idToken/accessToken.  It does NOT sign into
      // the native Firebase SDK itself.  Our NativeAuthService.ts then calls
      // signInWithCredential() on the Firebase JS SDK so Firestore and
      // onAuthStateChanged work as normal.  This avoids a hang that occurs when
      // skipNativeAuth is false and the native Firebase SDK sign-in step blocks
      // indefinitely after the account picker returns.
      skipNativeAuth: true,
      providers: ['google.com', 'twitter.com'],
    },
  },
};

export default config;
