import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { AppShell } from '../components/AppShell';
import { Logo } from '../components/Logo';

export function AccessDenied() {
  return (
    <AppShell>
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-soft">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
            />
          </svg>
        </span>
        <h1 className="mt-4 text-lg font-bold text-slate-900">Administrator access required</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your account does not have the admin role. Ask a system administrator to upgrade your role in
          <span className="font-medium text-slate-700"> Services &amp; access</span>.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/app" className="btn-primary btn-xs">
            Back to dashboard
          </Link>
          <Link to="/display" className="btn-ghost btn-xs">
            Display board
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

export function NotFound() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <Logo className="h-12 w-12" />
      <p className="mt-6 font-mono text-xs font-bold uppercase tracking-[0.3em] text-indigo-500">
        Error 404
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900">
        This counter does not exist
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        The page you asked for is not part of CloudQueue. Check the link or head back to a live queue.
      </p>
      <div className="mt-6 flex gap-2">
        <Link to={isAuthenticated ? '/app' : '/'} className="btn-primary btn-xs">
          {isAuthenticated ? 'Dashboard' : 'Home'}
        </Link>
        <Link to="/display" className="btn-ghost btn-xs">
          Display board
        </Link>
      </div>
    </div>
  );
}
