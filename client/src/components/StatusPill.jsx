import { statusMeta, cx, relativeTime } from '../lib/format';

export function StatusPill({ status, className = '' }) {
  const meta = statusMeta(status);
  return <span className={cx('badge', meta.tone, className)}>{meta.label}</span>;
}

/** "Live" indicator that doubles as the polling heartbeat. */
export function LiveBadge({ isRefreshing, lastUpdated, intervalMs = 8000, className = '' }) {
  return (
    <span
      className={cx('inline-flex items-center gap-2 text-xs font-medium text-slate-500', className)}
      title={lastUpdated ? `Updated ${relativeTime(lastUpdated)}` : 'Waiting for first update'}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cx(
            'absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75',
            isRefreshing && 'animate-ping'
          )}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Live · every {Math.round(intervalMs / 1000)}s
    </span>
  );
}

export function RoleBadge({ role }) {
  const tone =
    role === 'super_admin'
      ? 'bg-violet-100 text-violet-700'
      : role === 'admin'
        ? 'bg-indigo-100 text-indigo-700'
        : 'bg-slate-100 text-slate-600';
  const label = role === 'super_admin' ? 'Super admin' : role === 'admin' ? 'Admin' : 'Student';
  return <span className={cx('badge', tone)}>{label}</span>;
}
