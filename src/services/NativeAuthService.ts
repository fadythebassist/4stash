/**
 * NativeAuthService
 *
 * Wraps @capacitor-firebase/authentication to perform OAuth sign-in via the
 * device's native Google / Twitter SDKs instead of a web popup/redirect.
 *
 * On the web (PWA) this module is never called — FirebaseStorageService falls
 * back to the standard signInWithPopup path.  On Android/iOS the native SDK
 * produces a credential which is then handed to Firebase JS SDK so that
 * Firestore, onAuthStateChanged, and the rest of the app work exactly as
 * before — no other code needs changing.
 *
 * Required Android setup (done once, outside of code):
 *  1. Add google-services.json to android/app/
 *  2. Register the app's SHA-1 in Firebase Console → Project Settings → Android app
 *  3. Enable Google (and Twitter) sign-in in Firebase Console → Authentication
 *  4. For Twitter: set API key + secret in Firebase Console
 */

import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  getAuth,
  GoogleAuthProvider,
  TwitterAuthProvider,
  OAuthProvider,
  signInWithCredential,
  type UserCredential,
} from "firebase/auth";

/**
 * Sign in with Google using the native Android/iOS Google Sign-In SDK.
 * Returns a Firebase UserCredential identical to what signInWithPopup returns.
 */
export async function nativeSignInWithGoogle(): Promise<UserCredential> {
  // Step 1 — invoke the native Google Sign-In sheet via Credential Manager.
  // The plugin's getCredentialAsync() call is patched to use Activity context
  // instead of Application context (node_modules patch in GoogleAuthProviderHandler.java).
  const result = await FirebaseAuthentication.signInWithGoogle();

  if (!result.credential?.idToken) {
    throw new Error("Google sign-in did not return an ID token");
  }

  // Step 2 — build a Firebase credential from the native token
  const credential = GoogleAuthProvider.credential(
    result.credential.idToken,
    result.credential.accessToken ?? undefined,
  );

  // Step 3 — sign into Firebase JS SDK so Firestore & onAuthStateChanged work
  return signInWithCredential(getAuth(), credential);
}

/**
 * Sign in with Twitter/X using the native OAuth flow.
 * Returns a Firebase UserCredential.
 */
export async function nativeSignInWithTwitter(): Promise<UserCredential> {
  const result = await FirebaseAuthentication.signInWithTwitter();

  if (!result.credential?.secret || !result.credential?.accessToken) {
    throw new Error("Twitter sign-in did not return OAuth tokens");
  }

  const credential = TwitterAuthProvider.credential(
    result.credential.accessToken,
    result.credential.secret,
  );

  return signInWithCredential(getAuth(), credential);
}

/**
 * Sign in with Apple using the native Sign-In with Apple sheet.
 * Required for iOS App Store submissions when any other social sign-in is present.
 * Included here so the Android build has the import available; the UI can
 * surface this button on iOS only.
 */
export async function nativeSignInWithApple(): Promise<UserCredential> {
  const result = await FirebaseAuthentication.signInWithApple();

  if (!result.credential?.idToken) {
    throw new Error("Apple sign-in did not return an ID token");
  }

  const provider = new OAuthProvider("apple.com");
  const credential = provider.credential({
    idToken: result.credential.idToken,
    rawNonce: result.credential.nonce ?? undefined,
  });

  return signInWithCredential(getAuth(), credential);
}
