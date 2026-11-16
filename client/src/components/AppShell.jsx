import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { cx, initials } from '../lib/format';
import { Logo } from './Logo';
import { RoleBadge } from './StatusPill';

const icons = {
  home: 'M3 10.5 12 3l9 7.5M5.25 9.75V20.25h4.5v-5.25h4.5v5.25h4.5V9.75',
  monitor: 'M3.75 4.5h16.5v11.25H3.75zM8.25 20.25h7.5M12 15.75v4.5',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 3v6M8 9v6M16 15v6',
  shield: 'M12 3l7.5 3v5.25c0 4.5-3 8.25-7.5 9.75-4.5-1.5-7.5-5.25-7.5-9.75V6L12 3z',
};

function NavIcon({ path, className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function navLinkClass({ isActive }) {
  return cx(
    'group inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-slate-900 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  );
}

export function AppShell({ children, maxWidth = 'max-w-7xl' }) {
  const { user, isAdmin, isSuperAdmin, signOut, mode } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  const links = [
    { to: '/app', label: 'Dashboard', icon: icons.home },
    { to: '/display', label: 'Display board', icon: icons.monitor },
  ];
  if (isAdmin) links.push({ to: '/admin', label: 'Admin console', icon: icons.sliders });
  if (isSuperAdmin) links.push({ to: '/admin/services', label: 'Services', icon: icons.shield });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-lg">
        <div className={cx('mx-auto flex h-16 items-center gap-3 px-4 sm:px-6', maxWidth)}>
          <Link to="/app" className="shrink-0" aria-label="CloudQueue home">
            <Logo withWordmark className="h-8 w-8" />
          </Link>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass} end={link.to === '/admin'}>
                <NavIcon path={link.icon} />
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {mode === 'demo' && (
              <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 sm:inline-flex">
                Demo mode
              </span>
            )}

            <button
              type="button"
              className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 pr-2 text-left transition hover:border-slate-300"
              onClick={() => setAccountOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-sky-500 text-xs font-bold text-white">
                {initials(user?.displayName || user?.email)}
              </span>
              <span className="hidden text-sm font-semibold text-slate-800 sm:block">
                {user?.displayName || 'Account'}
              </span>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-400">
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 lg:hidden"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <NavLink key={link.to} to={link.to} className={navLinkClass} end={link.to === '/admin'}>
                  <NavIcon path={link.icon} />
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}

        {accountOpen && (
          <div className="absolute right-4 top-[60px] w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift sm:right-6">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="truncate text-sm font-semibold text-slate-900">
                {user?.displayName || 'Signed in'}
              </p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <RoleBadge role={user?.role} />
                <span className="text-[11px] text-slate-400">
                  {mode === 'demo' ? 'demo session' : 'Firebase session'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5M10 5h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8"
                />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </header>

      <main className={cx('mx-auto px-4 py-6 sm:px-6 sm:py-8', maxWidth)}>{children}</main>

      <footer className="mt-8 border-t border-slate-200/80 py-6">
        <div className={cx('mx-auto flex flex-col gap-2 px-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6', maxWidth)}>
          <p>CloudQueue · campus queue management · React + Vercel + MongoDB Atlas + Firebase Auth</p>
          <div className="flex items-center gap-4">
            <Link to="/display" className="hover:text-slate-600">
              Display board
            </Link>
            <a href="/api/health" target="_blank" rel="noreferrer" className="hover:text-slate-600">
              API health
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
