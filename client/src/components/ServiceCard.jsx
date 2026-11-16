import { cx, formatMinutes, serviceColor } from '../lib/format';
import { Spinner } from './Spinner';

export function ServiceCard({ service, status, activeToken, onGetToken, busy }) {
  const color = serviceColor(service.color);
  const serving = status?.serving?.tokenNumber;
  const waitingCount = status?.waitingCount;
  const eta = status?.estimatedWaitMinutes;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className={cx('h-1.5 w-full bg-gradient-to-r', color.gradient)} />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={cx('badge', color.soft, color.text)}>{service.code}</span>
            <h3 className="mt-2 truncate text-base font-bold text-slate-900">{service.name}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{service.description}</p>
          </div>
          <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', color.soft, color.text)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 7h6m-6 4h4" />
            </svg>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Serving</p>
            <p className="mono-token mt-0.5 text-sm text-slate-900">{serving || '—'}</p>
          </div>
          <div className="border-x border-slate-200">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Waiting</p>
            <p className="mono-token mt-0.5 text-sm text-slate-900">
              {waitingCount === undefined ? '—' : waitingCount}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Wait</p>
            <p className="mono-token mt-0.5 text-sm text-slate-900">
              {eta === undefined ? '—' : formatMinutes(eta)}
            </p>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" />
            </svg>
            ~{service.averageServiceMinutes} min / person
            {service.location && <span className="hidden text-slate-300 sm:inline">·</span>}
            {service.location && <span className="hidden truncate sm:inline">{service.location}</span>}
          </div>

          {activeToken ? (
            <span className={cx('badge shrink-0', color.soft, color.text)}>Token {activeToken.tokenNumber}</span>
          ) : (
            <button
              type="button"
              onClick={() => onGetToken(service)}
              disabled={busy || !service.isActive}
              className="btn-brand btn-xs shrink-0"
            >
              {busy ? <Spinner className="h-3.5 w-3.5" /> : 'Get token'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
