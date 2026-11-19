import { cx, formatMinutes, formatTime, serviceColor } from '../lib/format';
import { Spinner } from './Spinner';

/**
 * The user's live ticket. Everything here is refreshed by the polling layer,
 * so the position and ETA count down without a page reload.
 */
export function ActiveTokenCard({ token, service, onCancel, busy }) {
  const color = serviceColor(service?.color);
  const isServing = token.status === 'serving';
  const ahead = token.ahead || [];

  return (
    <section
      className={cx(
        'relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-lift sm:p-6',
        color.gradient
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-black/10" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            Your token · {service?.name}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2 sm:gap-3">
            <span className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
              {token.tokenNumber}
            </span>
            <span
              className={cx(
                'rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
                isServing ? 'bg-white text-emerald-700 animate-pulse-ring' : 'bg-white/20 text-white'
              )}
            >
              {isServing ? 'Now serving' : 'Waiting'}
            </span>
          </div>
          <p className="mt-2 text-sm text-white/75">
            Issued {formatTime(token.issuedAt)}
            {service?.location ? ` · ${service.location}` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onCancel(token)}
          disabled={busy || isServing}
          className="relative rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-40"
          title={isServing ? 'You are being served - cannot cancel' : 'Cancel this token'}
        >
          {busy ? <Spinner className="h-4 w-4" /> : 'Cancel'}
        </button>
      </div>

      <div className="relative mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl bg-white/10 px-2 py-3 backdrop-blur sm:px-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Position</p>
          <p className="mt-1 text-lg font-bold sm:text-2xl">
            {isServing ? 'Now' : token.position ?? '—'}
            {!isServing && token.position > 1 && <span className="text-sm font-medium text-white/60"> in line</span>}
          </p>
        </div>
        <div className="rounded-xl bg-white/10 px-2 py-3 backdrop-blur sm:px-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Est. wait</p>
          <p className="mt-1 text-lg font-bold sm:text-2xl">{isServing ? '0 min' : formatMinutes(token.estimatedWaitMinutes)}</p>
        </div>
        <div className="rounded-xl bg-white/10 px-2 py-3 backdrop-blur sm:px-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Now serving</p>
          <p className="mono-token mt-1 text-lg font-bold sm:text-2xl">{token.currentServingToken || '—'}</p>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Ahead of you</span>
        {ahead.length === 0 ? (
          <span className="rounded-lg bg-white/15 px-2 py-1 text-xs font-medium">
            {isServing ? 'You are at the counter' : 'You are next'}
          </span>
        ) : (
          ahead.slice(0, 8).map((number) => (
            <span key={number} className="mono-token rounded-lg bg-white/15 px-2 py-1 text-xs">
              {number}
            </span>
          ))
        )}
        {ahead.length > 8 && (
          <span className="text-xs text-white/70">+{ahead.length - 8} more</span>
        )}
      </div>
    </section>
  );
}
