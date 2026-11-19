/**
 * Firebase client wrapper.
 *
 * Firebase is loaded lazily (dynamic import) so demo deployments never download
 * the SDK, and so the app still boots when the VITE_FIREBASE_* variables are
 * absent. In demo mode the server issues its own HMAC session token instead.
 */

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};
export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.authDomain
);

let sdkPromise = null;

function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = Promise.all([import('firebase/app'), import('firebase/auth')]).then(
      ([appModule, authModule]) => ({
        appModule,
        authModule,
      })
    );
  }
  return sdkPromise;
}

let authInstance = null;

export async function getFirebaseAuth() {
  if (!firebaseConfigured) {
    throw new Error('Firebase is not configured. Add VITE_FIREBASE_* variables to client/.env');
  }
  const { appModule, authModule } = await loadSdk();
  if (!authInstance) {
    const app = appModule.getApps().length
      ? appModule.getApp()
      : appModule.initializeApp(firebaseConfig);
    authInstance = authModule.getAuth(app);
    try {
      await authModule.setPersistence(authInstance, authModule.browserSessionPersistence);
    } catch {
      // Persistence choice is best-effort; the session still works in-memory.
    }
  }
  return { auth: authInstance, authModule };
}

export async function signInWithEmail(email, password) {
  const { auth, authModule } = await getFirebaseAuth();
  const credential = await authModule.signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signUpWithEmail(email, password, displayName) {
  const { auth, authModule } = await getFirebaseAuth();
  const credential = await authModule.createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await authModule.updateProfile(credential.user, { displayName });
  }
  return credential.user;
}

export async function signInWithGoogle() {
  const { auth, authModule } = await getFirebaseAuth();
  const provider = new authModule.GoogleAuthProvider();
  const credential = await authModule.signInWithPopup(auth, provider);
  return credential.user;
}

export async function signInWithGoogleRedirect() {
  const { auth, authModule } = await getFirebaseAuth();
  const provider = new authModule.GoogleAuthProvider();
  await authModule.signInWithRedirect(auth, provider);
}

export async function getRedirectResult() {
  if (!firebaseConfigured) return null;
  const { auth, authModule } = await getFirebaseAuth();
  const result = await authModule.getRedirectResult(auth);
  return result ? result.user : null;
}

export async function signOutFirebase() {
  if (!authInstance) return;
  const { authModule } = await loadSdk();
  await authModule.signOut(authInstance);
}

export async function onAuthChange(callback) {
  const { auth, authModule } = await getFirebaseAuth();
  return authModule.onAuthStateChanged(auth, callback);
}

export async function getIdToken(forceRefresh = false) {
  if (!authInstance) return null;
  if (!authInstance.currentUser) return null;
  return authInstance.currentUser.getIdToken(forceRefresh);
}

export function friendlyFirebaseError(error) {
  const code = (error && error.code) || '';
  const map = {
    'auth/invalid-email': 'That email address is not valid.',
    'auth/user-not-found': 'No account exists for that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with that email already exists.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a minute and try again.',
    'auth/popup-closed-by-user': 'The Google sign-in window was closed.',
    'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups and retry.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Console.',
    'auth/unauthorized-domain': 'This domain is not authorised in Firebase Console.',
  };
  return map[code] || (error && error.message) || 'Sign-in failed. Please try again.';
}
