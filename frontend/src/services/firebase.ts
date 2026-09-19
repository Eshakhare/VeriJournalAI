import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyMockKeyForDevOnly_VeriJournal',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'verijournal-dev.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'verijournal-dev',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'verijournal-dev.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '100000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:100000000000:web:mockappid000000000000',
};

export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
    !import.meta.env.VITE_FIREBASE_API_KEY.includes('placeholder')
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
} catch (err) {
  console.warn('Firebase client SDK initialization deferred or failed:', err);
}

export { auth, app };

export interface AuthPrincipal {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  isMock: boolean;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export interface UserAuthResult {
  principal: AuthPrincipal;
  rawUser: User;
}

/**
 * Sign in using Google OAuth popup via Firebase Auth SDK
 */
export async function signInWithGoogle(): Promise<UserAuthResult> {
  if (!auth || !isFirebaseConfigured) {
    const mock = signInDevMockUser('auditor_demo@verijournal.dev', 'Lead Evidence Auditor');
    return { principal: mock, rawUser: null as unknown as User };
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    return {
      principal: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Authenticated Researcher',
        photoURL: user.photoURL,
        isAnonymous: user.isAnonymous,
        isMock: false,
      },
      rawUser: user,
    };
  } catch (err: unknown) {
    console.error('Firebase signInWithPopup error:', err);
    throw err;
  }
}

/**
 * Sign in using Google OAuth full page redirect (best fallback when browser popups or third-party cookies are blocked)
 */
export async function signInWithGoogleRedirect(): Promise<void> {
  if (!auth || !isFirebaseConfigured) {
    return;
  }
  await signInWithRedirect(auth, googleProvider);
}

/**
 * Check if the page was loaded from a redirect sign-in flow
 */
export async function checkRedirectResult(): Promise<UserAuthResult | null> {
  if (!auth || !isFirebaseConfigured) {
    return null;
  }
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      const user = result.user;
      return {
        principal: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Authenticated Researcher',
          photoURL: user.photoURL,
          isAnonymous: user.isAnonymous,
          isMock: false,
        },
        rawUser: user,
      };
    }
    return null;
  } catch (err) {
    console.error('Firebase getRedirectResult error:', err);
    throw err;
  }
}

/**
 * Dev-only simulated user for preview and contract verification before live GCP deployment
 */
export function signInDevMockUser(
  email = 'researcher@verijournal.org',
  name = 'Integrity Analyst (Dev Session)'
): AuthPrincipal {
  const mockUser: AuthPrincipal = {
    uid: 'usr_dev_auditor_99182',
    email,
    displayName: name,
    photoURL: null,
    isAnonymous: false,
    isMock: true,
  };
  return mockUser;
}

/**
 * Sign out of Firebase Auth
 */
export async function signOutUser(): Promise<void> {
  if (auth && isFirebaseConfigured) {
    await firebaseSignOut(auth);
  }
}

/**
 * Get the current fresh Firebase ID Token.
 * Never stores tokens in localStorage, query strings, or logs.
 */
export async function getFreshIdToken(
  user: User | null,
  isMock = false,
  forceRefresh = false
): Promise<string> {
  if (isMock || !user) {
    // For dev mock adapter or simulated mode, return deterministic test bearer token
    return 'dev-mock-id-token-verijournal-canonical-v1';
  }

  // Obtain real token via Firebase SDK with optional force refresh
  return await user.getIdToken(forceRefresh);
}

/**
 * Listen to Firebase Auth state changes
 */
export function subscribeToAuthState(
  callback: (principal: AuthPrincipal | null, rawUser: User | null) => void
): () => void {
  if (!auth || !isFirebaseConfigured) {
    return () => {};
  }

  return onAuthStateChanged(auth, (user) => {
    if (user) {
      callback(
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Research User',
          photoURL: user.photoURL,
          isAnonymous: user.isAnonymous,
          isMock: false,
        },
        user
      );
    } else {
      callback(null, null);
    }
  });
}
