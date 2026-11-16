import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { usePolling } from '../hooks/usePolling';
import { cx, formatMinutes, serviceColor } from '../lib/format';
import { Logo } from '../components/Logo';

function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-right">
      <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-white sm:text-4xl">
        {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        <span className="ml-1 text-base font-normal text-slate-500">
          {now.toLocaleTimeString(undefined, { second: '2-digit' }).replace(/\D/g, '')}
        </span>
      </p>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
        {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
    </div>
  );
}

/**
 * Public waiting-room screen. No authentication, polls every 5 seconds, and
 * deliberately shows only token numbers - never names or emails.
 */
export function Display() {
  const board = usePolling(() => api.get('/api/queue/board'), { intervalMs: 5000 });
  const services = board.data?.services || [];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute -left-40 top-[-20%] h-[520px] w-[520px] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 bottom-[-10%] h-[460px] w-[460px] rounded-full bg-sky-500/10 blur-[100px]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo dark className="h-11 w-11" />
            <div>
              <p className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">CloudQueue</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Campus waiting room
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 sm:inline-flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live
            </span>
            <Clock />
          </div>
        </header>

        {board.error && (
          <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            Display cannot reach the CloudQueue API. Retrying automatically…
          </div>
        )}

        <div className="mt-8 grid flex-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {services.map((service) => {
            const palette = serviceColor(service.color);
            const serving = Boolean(service.serving);
            return (
              <section
                key={service.id}
                className={cx(
                  'relative flex min-h-[230px] flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm sm:min-h-[280px]',
                  serving && 'ring-1 ring-white/15'
                )}
              >
                <div
                  className={cx(
                    'pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r',
                    palette.gradient
                  )}
                />

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      {service.code}
                    </p>
                    <h2 className="mt-0.5 truncate text-lg font-bold tracking-tight text-white">
                      {service.name}
                    </h2>
                  </div>
                  <span
                    className={cx(
                      'rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider',
                      serving ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/5 text-slate-400'
                    )}
                  >
                    {serving ? 'Serving' : 'Idle'}
                  </span>
                </div>

                <div className="my-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Now serving
                  </p>
                  <p
                    className={cx(
                      'mono-token mt-1 text-5xl font-extrabold leading-none tracking-tight sm:text-6xl',
                      serving ? 'text-white' : 'text-slate-600'
                    )}
                  >
                    {service.serving || '—'}
                  </p>
                </div>

                <div className="flex items-end justify-between gap-3 border-t border-white/5 pt-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Waiting</p>
                    <p className="text-xl font-bold text-white">{service.waitingCount}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Est. wait
                    </p>
                    <p className="text-sm font-semibold text-slate-300">
                      {formatMinutes(service.estimatedWaitMinutes)}
                    </p>
                  </div>
                </div>
              </section>
            );
          })}

          {!services.length && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] py-20 text-center">
              <p className="text-sm font-semibold text-slate-300">
                {board.loading ? 'Connecting to the live queue…' : 'No services are currently published'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                This screen refreshes automatically every 5 seconds.
              </p>
            </div>
          )}
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-5 text-[11px] text-slate-500">
          <p>
            Take a token at{' '}
            <Link to="/" className="text-slate-300 underline-offset-4 hover:underline">
              cloudqueue
            </Link>{' '}
            · one token per office per day
          </p>
          <p>
            {board.lastUpdated
              ? `Updated ${board.lastUpdated.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}`
              : 'Waiting for first update'}
          </p>
        </footer>
      </div>
    </div>
  );
}
