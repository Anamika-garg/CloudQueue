import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiFetch, setTokenProvider } from './api';
import * as fb from './firebase';

const DEMO_TOKEN_KEY = 'cloudqueue.demoToken';
const AuthContext = createContext(null);

/**
 * Authentication provider.
 *
 * - Asks the API whether this deployment is in `firebase` or `demo` auth mode
 *   (single source of truth: the server decides, the client follows).
 * - Firebase: the SDK owns the session; the ID token is fetched per request and
 *   never persisted by our code (Firebase keeps it in sessionStorage itself).
 * - Demo: the API returns an HMAC token which we keep in sessionStorage only.
 */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null);
  const [demoLoginEnabled, setDemoLoginEnabled] = useState(false);
  const [notice, setNotice] = useState(null);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [demoCredentials, setDemoCredentials] = useState([]);

  const modeRef = useRef(null);
  const authUnsubscribe = useRef(null);

  useEffect(() => {
    setTokenProvider(async () => {
      // A demo session takes precedence in hybrid deployments too.
      const demoToken = sessionStorage.getItem(DEMO_TOKEN_KEY);
      if (demoToken) return demoToken;
      if (modeRef.current === 'demo') return null;
      try {
        return await fb.getIdToken();
      } catch {
        return null;
      }
    });
  }, []);

  const applyUser = useCallback((nextUser) => {
    setUser(nextUser);
    setStatus(nextUser ? 'authenticated' : 'signed-out');
  }, []);

  const syncWithServer = useCallback(async () => {
    const data = await apiFetch('/api/auth/sync', { method: 'POST' });
    applyUser(data.user);
    return data.user;
  }, [applyUser]);

  // ---------------------------------------------------------------------
  // Boot: detect auth mode, restore demo session or subscribe to Firebase.
  // ---------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      let serverMode = fb.firebaseConfigured ? 'firebase' : 'demo';
      let serverDemoLogin = false;

      try {
        const health = await apiFetch('/api/health', { auth: false });
        serverMode = health.authMode === 'firebase' ? 'firebase' : 'demo';
        serverDemoLogin = Boolean(health.demoLogin) || serverMode === 'demo';
      } catch (error) {
        if (cancelled) return;
        setNotice({
          type: 'error',
          message:
            'Cannot reach the CloudQueue API. Start the backend with `npm run dev` and refresh.',
        });
        setStatus('offline');
        return;
      }

      if (cancelled) return;
      modeRef.current = serverMode;
      setMode(serverMode);
      setDemoLoginEnabled(serverDemoLogin);

      if (serverMode === 'demo') {
        const token = sessionStorage.getItem(DEMO_TOKEN_KEY);
        if (!token) {
          setStatus('signed-out');
        } else {
          try {
            const data = await apiFetch('/api/auth/me');
            if (!cancelled) applyUser(data.user);
          } catch {
            sessionStorage.removeItem(DEMO_TOKEN_KEY);
            if (!cancelled) setStatus('signed-out');
          }
        }

        try {
          const data = await apiFetch('/api/auth/demo-accounts', { auth: false });
          if (!cancelled) {
            setDemoAccounts(data.accounts || []);
            setDemoCredentials(data.credentials || []);
          }
        } catch {
          /* non fatal */
        }
        return;
      }

      // Firebase mode -----------------------------------------------------
      // Hybrid deployments (ALLOW_DEMO_LOGIN=true) also offer the seeded
      // personas. A stored demo session wins over Firebase until sign-out.
      const demoToken = sessionStorage.getItem(DEMO_TOKEN_KEY);
      if (serverDemoLogin && demoToken) {
        try {
          const data = await apiFetch('/api/auth/me');
          if (!cancelled) applyUser(data.user);
          return;
        } catch {
          sessionStorage.removeItem(DEMO_TOKEN_KEY);
        }
      }

      if (serverDemoLogin) {
        try {
          const data = await apiFetch('/api/auth/demo-accounts', { auth: false });
          if (!cancelled) {
            setDemoAccounts(data.accounts || []);
            setDemoCredentials(data.credentials || []);
          }
        } catch {
          /* non fatal */
        }
      }

      if (!fb.firebaseConfigured) {
        setStatus('configuration_error');
        setNotice({
          type: 'error',
          message:
            'This deployment uses Firebase Authentication but the VITE_FIREBASE_* variables are missing in the client build.',
        });
        return;
      }

      try {
        await fb.getRedirectResult();
        const unsubscribe = await fb.onAuthChange(async (firebaseUser) => {
          if (cancelled) return;
          // An active demo session takes precedence over Firebase callbacks.
          if (sessionStorage.getItem(DEMO_TOKEN_KEY)) return;
          if (!firebaseUser) {
            applyUser(null);
            return;
          }
          try {
            await syncWithServer();
          } catch (error) {
            setNotice({ type: 'error', message: error.message });
            applyUser(null);
          }
        });
        authUnsubscribe.current = unsubscribe;
      } catch (error) {
        setStatus('configuration_error');
        setNotice({ type: 'error', message: fb.friendlyFirebaseError(error) });
      }
    };

    boot();

    return () => {
      cancelled = true;
      if (authUnsubscribe.current) authUnsubscribe.current();
    };
  }, [applyUser, syncWithServer]);

  // Global 401 handling: the token expired or was revoked.
  useEffect(() => {
    const onUnauthorized = () => {
      sessionStorage.removeItem(DEMO_TOKEN_KEY);
      applyUser(null);
      setNotice({ type: 'error', message: 'Your session expired. Please sign in again.' });
    };
    window.addEventListener('cloudqueue:unauthorized', onUnauthorized);
    return () => window.removeEventListener('cloudqueue:unauthorized', onUnauthorized);
  }, [applyUser]);

  // ---------------------------------------------------------------------
  // Sign-in actions
  // ---------------------------------------------------------------------
  const signInDemo = useCallback(
    async (email, password) => {
      const data = await apiFetch('/api/auth/demo-login', {
        method: 'POST',
        auth: false,
        body: { email, password },
      });
      sessionStorage.setItem(DEMO_TOKEN_KEY, data.token);
      applyUser(data.user);
      return data.user;
    },
    [applyUser]
  );

  const signInEmail = useCallback(
    async (email, password) => {
      sessionStorage.removeItem(DEMO_TOKEN_KEY);
      const firebaseUser = await fb.signInWithEmail(email, password);
      if (firebaseUser) return syncWithServer();
      return null;
    },
    [syncWithServer]
  );

  const registerEmail = useCallback(
    async (email, password, displayName) => {
      sessionStorage.removeItem(DEMO_TOKEN_KEY);
      const firebaseUser = await fb.signUpWithEmail(email, password, displayName);
      if (firebaseUser) return syncWithServer();
      return null;
    },
    [syncWithServer]
  );

  const signInGoogle = useCallback(async () => {
    sessionStorage.removeItem(DEMO_TOKEN_KEY);
    const firebaseUser = await fb.signInWithGoogle();
    if (firebaseUser) return syncWithServer();
    return null;
  }, [syncWithServer]);

  const signOut = useCallback(async () => {
    sessionStorage.removeItem(DEMO_TOKEN_KEY);
    if (modeRef.current === 'firebase') {
      try {
        await fb.signOutFirebase();
      } catch {
        /* ignore */
      }
    }
    setUser(null);
    setStatus('signed-out');
  }, []);

  const refreshProfile = useCallback(async () => {
    const data = await apiFetch('/api/auth/me');
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      role: user ? user.role : null,
      isAuthenticated: status === 'authenticated' && Boolean(user),
      isAdmin: Boolean(user && ['admin', 'super_admin'].includes(user.role)),
      isSuperAdmin: Boolean(user && user.role === 'super_admin'),
      mode,
      notice,
      clearNotice: () => setNotice(null),
      demoAccounts,
      demoCredentials,
      demoLoginEnabled,
      signInDemo,
      signInEmail,
      registerEmail,
      signInGoogle,
      signOut,
      refreshProfile,
      firebaseConfigured: fb.firebaseConfigured,
    }),
    [
      status,
      user,
      mode,
      notice,
      demoAccounts,
      demoCredentials,
      demoLoginEnabled,
      signInDemo,
      signInEmail,
      registerEmail,
      signInGoogle,
      signOut,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
