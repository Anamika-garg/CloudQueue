import { cx, formatMinutes, formatTime, relativeTime } from '../lib/format';
import { EmptyState } from './Spinner';

/**
 * Read-only waiting list. Only token numbers and timing are exposed - no names
 * or emails - so this component is safe for the public display board too.
 */
export function QueueList({ entries = [], serving, limit = 8, compact = false }) {
  if (!entries.length) {
    return (
      <EmptyState
        title="No one is waiting"
        description="The queue is empty. Generate a token and you will be called straight away."
        className={compact ? 'py-6' : undefined}
      />
    );
  }

  return (
    <ol className="divide-y divide-slate-100">
      {entries.slice(0, limit).map((entry) => (
        <li key={entry.tokenNumber} className="flex items-center gap-3 py-2.5">
          <span
            className={cx(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
              entry.tokenNumber === serving
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            )}
          >
            {entry.position}
          </span>
          <span className="mono-token text-sm text-slate-900">{entry.tokenNumber}</span>
          <span className="ml-auto text-xs text-slate-400">
            {entry.waitingMinutes !== undefined
              ? `${formatMinutes(entry.waitingMinutes)} waiting`
              : relativeTime(entry.issuedAt)}
          </span>
        </li>
      ))}
      {entries.length > limit && (
        <li className="py-2.5 text-center text-xs font-medium text-slate-400">
          +{entries.length - limit} more in line
        </li>
      )}
    </ol>
  );
}

export function ServingBanner({ serving, service, waitingCount, lastUpdated }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.5 20.25a7.5 7.5 0 1 1 15 0v.75H4.5v-.75z" />
          </svg>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Now serving · {service?.name || 'Queue'}
          </p>
          <p className="mono-token text-2xl font-bold text-slate-900">{serving || '—'}</p>
        </div>
      </div>
      <div className="flex items-center gap-6 text-right">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Waiting</p>
          <p className="text-xl font-bold text-slate-900">{waitingCount ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Updated</p>
          <p className="text-sm font-medium text-slate-600">{formatTime(lastUpdated)}</p>
        </div>
      </div>
    </div>
  );
}
