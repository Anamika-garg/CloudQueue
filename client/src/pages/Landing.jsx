import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { friendlyFirebaseError } from '../lib/firebase';
import { cx } from '../lib/format';
import { Logo } from '../components/Logo';
import { Spinner } from '../components/Spinner';

const ROLE_LABELS = { user: 'Student', admin: 'Office admin', super_admin: 'System admin' };

const FALLBACK_ACCOUNTS = [
  { email: 'student@campus.edu', displayName: 'Aarav Sharma', role: 'user' },
  { email: 'admin@campus.edu', displayName: 'Priya Nair', role: 'admin' },
  { email: 'super@campus.edu', displayName: 'Daniel Osei', role: 'super_admin' },
];

const FEATURES = [
  {
    title: 'Digital tokens, zero paper',
    body: 'Generate a token from any device. The number is reserved atomically, so two students tapping at once never collide.',
    icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2',
  },
  {
    title: 'Live position and ETA',
    body: 'Polling refreshes the queue every 8 seconds. Your position and wait estimate update without refreshing the page.',
    icon: 'M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
  },
  {
    title: 'Analytics that matter',
    body: 'Admins see tokens per hour, peak demand, average wait and no-show rates, then export the day for reporting.',
    icon: 'M4 19V5m0 14h16M8 15v-4m4 4V7m4 8v-6',
  },
];

const STEPS = [
  { title: 'Pick an office', body: 'Registrar, clinic, library or bursary — each has its own live queue.' },
  { title: 'Take a token', body: 'You get a number, your position and a wait estimate based on today’s service rate.' },
  { title: 'Arrive when it’s your turn', body: 'Watch the live status from anywhere. The counter calls your number.' },
];

function SignInCard() {
  const {
    mode,
    demoAccounts,
    demoLoginEnabled,
    signInDemo,
    signInEmail,
    registerEmail,
    signInGoogle,
    firebaseConfigured,
    notice,
    clearNotice,
  } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const quickAccounts = useMemo(() => {
    const source = demoAccounts && demoAccounts.length ? demoAccounts : FALLBACK_ACCOUNTS;
    return ['user', 'admin', 'super_admin']
      .map((role) => source.find((account) => account.role === role))
      .filter(Boolean);
  }, [demoAccounts]);

  const showDemoAccounts = mode === 'demo' || demoLoginEnabled;

  const go = (user) => {
    navigate(user && ['admin', 'super_admin'].includes(user.role) ? '/admin' : '/app', {
      replace: true,
    });
  };

  const handleDemo = async (account) => {
    setError(null);
    clearNotice();
    setBusy(account.email);
    try {
      const user = await signInDemo(account.email);
      go(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    clearNotice();
    setBusy('form');
    try {
      if (mode === 'demo') {
        const user = await signInDemo(email.trim());
        go(user);
      } else if (tab === 'register') {
        const user = await registerEmail(email.trim(), password, displayName.trim());
        go(user);
      } else {
        const user = await signInEmail(email.trim(), password);
        go(user);
      }
    } catch (err) {
      setError(err.code ? err.message : friendlyFirebaseError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative w-full min-w-0 max-w-md">
      <div className="absolute -inset-3 -z-10 rounded-[28px] bg-gradient-to-br from-indigo-500/15 via-sky-400/10 to-transparent blur-xl" />
      <div className="rounded-3xl border border-white/60 bg-white/95 p-6 shadow-lift backdrop-blur sm:p-7">
        <div className="flex items-center justify-between">
          <Logo withWordmark className="h-8 w-8" />
          <span
            className={cx(
              'badge',
              mode === 'demo' || demoLoginEnabled
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
            )}
          >
            {mode === 'demo' ? 'Demo' : demoLoginEnabled ? 'Demo + Live' : mode === 'firebase' ? 'Live' : '…'}
          </span>
        </div>

        <h2 className="mt-5 font-display text-xl font-extrabold tracking-tight text-slate-900">
          {mode === 'demo'
            ? 'Enter the demo campus'
            : demoLoginEnabled
              ? 'Try the demo campus'
              : 'Sign in to CloudQueue'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'demo'
            ? 'Choose a persona to explore both sides of the queue. No password required in demo mode.'
            : demoLoginEnabled
              ? 'Pick a demo persona to explore instantly, or sign in with a real campus account.'
              : 'Use your campus email or Google account. Roles are assigned by the administrator.'}
        </p>

        {notice && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
            {notice.message}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
            {error}
          </div>
        )}

        {showDemoAccounts && (
          <div className="mt-5 space-y-2">
            {quickAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => handleDemo(account)}
                disabled={Boolean(busy)}
                className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-60"
              >
                <span
                  className={cx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
                    account.role === 'super_admin'
                      ? 'bg-violet-100 text-violet-700'
                      : account.role === 'admin'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {account.displayName
                    ?.split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {account.displayName || account.email}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {ROLE_LABELS[account.role]} · {account.email}
                  </span>
                </span>
                {busy === account.email ? (
                  <Spinner className="h-4 w-4 text-indigo-600" />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-4 w-4 text-slate-300 transition group-hover:text-indigo-500"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5-5m5 5-5 5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}

        {mode === 'demo' ? (
          <>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                or any email
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label" htmlFor="demo-email">
                  Campus email
                </label>
                <input
                  id="demo-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@campus.edu"
                  className="input"
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="btn-brand w-full" disabled={Boolean(busy)}>
                {busy === 'form' ? <Spinner className="h-4 w-4" /> : null}
                Continue
              </button>
              <p className="text-center text-[11px] text-slate-400">
                Demo sessions use a signed HMAC token from the API, not Firebase.
              </p>
            </form>
          </>
        ) : (
          <>
            {showDemoAccounts && (
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  or use a campus account
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            )}
            <div
              className={cx(
                'grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1',
                showDemoAccounts ? '' : 'mt-5'
              )}
            >
              <button
                type="button"
                onClick={() => setTab('signin')}
                className={cx(
                  'rounded-lg py-2 text-xs font-semibold transition',
                  tab === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                )}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setTab('register')}
                className={cx(
                  'rounded-lg py-2 text-xs font-semibold transition',
                  tab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                )}
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              {tab === 'register' && (
                <div>
                  <label className="label" htmlFor="name">
                    Full name
                  </label>
                  <input
                    id="name"
                    className="input"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Aarav Sharma"
                    autoComplete="name"
                  />
                </div>
              )}
              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  className="input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@campus.edu"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  className="input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                />
              </div>
              <button type="submit" className="btn-brand w-full" disabled={Boolean(busy)}>
                {busy === 'form' ? <Spinner className="h-4 w-4" /> : null}
                {tab === 'register' ? 'Create account' : 'Sign in'}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">or</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              className="btn-ghost w-full"
              disabled={Boolean(busy) || !firebaseConfigured}
              onClick={async () => {
                setError(null);
                setBusy('google');
                try {
                  const user = await signInGoogle();
                  go(user);
                } catch (err) {
                  setError(friendlyFirebaseError(err));
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === 'google' ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.6 5.6 0 0 1-2.4 3.6v3h3.8c2.2-2 3.7-5 3.7-8.8z" />
                  <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.8-2.9l-3.8-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.5v3.1A12 12 0 0 0 12 24z" />
                  <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.5a12 12 0 0 0 0 10.8l3.9-3.1z" />
                  <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.5 6.6l3.9 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
                </svg>
              )}
              Continue with Google
            </button>

            {!firebaseConfigured && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                Firebase client keys are missing from this build. Add VITE_FIREBASE_* variables and
                rebuild, or use demo mode.
              </p>
            )}
          </>
        )}

        <p className="mt-6 border-t border-slate-100 pt-4 text-center text-[11px] leading-relaxed text-slate-400">
          By continuing you agree to the campus acceptable-use policy. Tokens reset daily at
          midnight campus time.
        </p>
      </div>
    </div>
  );
}

export function Landing() {
  const { isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate(isAdmin ? '/admin' : '/app', { replace: true });
  }, [isAuthenticated, isAdmin, navigate]);

  return (
    <div className="min-h-screen overflow-hidden bg-white">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-gradient-to-b from-indigo-50 via-sky-50/50 to-white" />
      <div className="grid-dots pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] opacity-60" />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo withWordmark />
        <div className="flex items-center gap-2">
          <Link to="/display" className="btn-ghost btn-xs hidden sm:inline-flex">
            Waiting-room display
          </Link>
          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost btn-xs hidden md:inline-flex"
          >
            API health
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <section className="grid grid-cols-1 items-center gap-12 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-14">
          <div className="min-w-0 animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-600" />
              </span>
              Cloud-based campus queue management
            </span>

            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Skip the queue.
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500 bg-clip-text text-transparent">
                Not the service.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              CloudQueue replaces the corridor line outside the registrar, clinic, library and bursary
              with a digital token. See the current number, your position and a realistic wait time —
              from any device, refreshed every few seconds.
            </p>

            <ul className="mt-6 grid gap-2.5 text-sm text-slate-600 sm:grid-cols-2">
              {[
                'One shared queue across every device',
                'Role-based access for staff',
                'Live ETA based on today’s service rate',
                'Daily analytics and CSV export',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500">
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-slate-400">Runs on</span>
              <span className="font-semibold text-slate-600">Vercel</span>
              <span className="font-semibold text-slate-600">MongoDB Atlas</span>
              <span className="font-semibold text-slate-600">Firebase Auth</span>
              <span className="font-semibold text-slate-600">Chart.js</span>
            </div>
          </div>

          <div className="flex min-w-0 justify-center lg:justify-end">
            <SignInCard />
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                </svg>
              </span>
              <h3 className="mt-4 text-sm font-bold text-slate-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{feature.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">How it works</p>
              <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Three taps from the corridor to the counter
              </h2>
            </div>
            <Link to="/display" className="btn-ghost">
              Open the display board
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5-5m5 5-5 5" />
              </svg>
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft">
                <span className="font-mono text-xs font-bold text-indigo-500">0{index + 1}</span>
                <h3 className="mt-2 text-sm font-bold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 overflow-hidden rounded-3xl bg-slate-900 p-6 text-white sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
                Cloud architecture
              </p>
              <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                One source of truth, served from the edge
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-300">
                The React SPA is static, the API is stateless serverless compute, and queue state lives in
                MongoDB Atlas. Every client polls the same endpoints, so the number on your phone is the
                number on the waiting-room screen.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                {['Serverless Express', 'Firebase ID tokens', 'Atomic $inc', 'RBAC middleware', 'Audit log'].map(
                  (chip) => (
                    <span key={chip} className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 font-medium text-slate-200">
                      {chip}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="grid gap-2 font-mono text-[11px] leading-relaxed text-slate-300 sm:text-xs">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-slate-500">01</span> React SPA on Vercel CDN
              </div>
              <div className="ml-4 h-4 w-px bg-gradient-to-b from-indigo-400 to-sky-400" />
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-slate-500">02</span> HTTPS + Bearer ID token
              </div>
              <div className="ml-4 h-4 w-px bg-gradient-to-b from-indigo-400 to-sky-400" />
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-slate-500">03</span> Vercel serverless Express API · RBAC
              </div>
              <div className="ml-4 h-4 w-px bg-gradient-to-b from-indigo-400 to-sky-400" />
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-slate-500">04</span> MongoDB Atlas replica set
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>CloudQueue · CCSA cloud computing project · {new Date().getFullYear()}</p>
          <div className="flex gap-4">
            <Link to="/display" className="hover:text-slate-600">
              Display board
            </Link>
            <a href="/api" target="_blank" rel="noreferrer" className="hover:text-slate-600">
              API index
            </a>
            <a href="/api/health" target="_blank" rel="noreferrer" className="hover:text-slate-600">
              Health
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
