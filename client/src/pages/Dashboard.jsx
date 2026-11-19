import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  cx,
  formatDate,
  formatMinutes,
  formatTime,
  serviceColor,
  statusMeta,
} from '../lib/format';
import { usePolling } from '../hooks/usePolling';
import { AppShell } from '../components/AppShell';
import { ActiveTokenCard } from '../components/ActiveTokenCard';
import { ServiceCard } from '../components/ServiceCard';
import { QueueList } from '../components/QueueList';
import { EmptyState, Skeleton, Spinner } from '../components/Spinner';
import { LiveBadge, StatusPill } from '../components/StatusPill';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

const POLL_MS = 8000;

function EmptyTicket({ services, onSelect }) {
  return (
    <section className="flex flex-col rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6">
      <div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
          </svg>
        </span>
        <h2 className="mt-4 text-base font-bold text-slate-900">No active token</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Pick an office below to generate a token. Your position and wait estimate appear here
          and refresh every {POLL_MS / 1000} seconds.
        </p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {services.slice(0, 4).map((service) => (
          <button
            key={service.id}
            type="button"
            onClick={() => onSelect(service)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
          >
            {service.code} · {service.name}
          </button>
        ))}
        {!services.length && <span className="text-xs text-slate-400">Loading services…</span>}
      </div>
    </section>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState(null);
  const [busyService, setBusyService] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const overview = usePolling(() => api.get('/api/tokens/my'), { intervalMs: POLL_MS });
  const servicesPoll = usePolling(() => api.get('/api/services'), { intervalMs: 60000 });
  const board = usePolling(() => api.get('/api/queue/board'), { intervalMs: 10000 });

  const services = servicesPoll.data?.services || [];
  const active = overview.data?.active || [];
  const history = overview.data?.history || [];

  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const boardByCode = useMemo(
    () => new Map((board.data?.services || []).map((row) => [row.code, row])),
    [board.data]
  );

  /** Compact live summary for the service cards (from the public board feed). */
  const cardStatus = (service) => {
    const row = boardByCode.get(service.code);
    if (!row) return undefined;
    return {
      serving: row.serving ? { tokenNumber: row.serving } : null,
      waitingCount: row.waitingCount,
      estimatedWaitMinutes: row.estimatedWaitMinutes,
    };
  };

  useEffect(() => {
    if (!selectedId && services.length) setSelectedId(services[0].id);
  }, [services, selectedId]);

  // Follow the user's own token if they have one and haven't chosen a queue.
  const followedRef = useRef(false);
  useEffect(() => {
    if (!followedRef.current && active.length) {
      setSelectedId(active[0].serviceId);
      followedRef.current = true;
    }
  }, [active]);

  const activeForSelected = active.find((token) => token.serviceId === selectedId);

  const status = usePolling(
    () => (selectedId ? api.get(`/api/queue/status?serviceId=${selectedId}`) : Promise.resolve(null)),
    { intervalMs: POLL_MS, enabled: Boolean(selectedId), deps: [selectedId] }
  );

  // Notify when one of the user's tokens starts being served.
  const previousStatuses = useRef(new Map());
  useEffect(() => {
    for (const token of active) {
      const previous = previousStatuses.current.get(token.id);
      if (previous && previous !== token.status && token.status === 'serving') {
        toast.info(
          `It's your turn — ${token.tokenNumber}`,
          `${token.serviceName} is calling your token now.`
        );
      }
      previousStatuses.current.set(token.id, token.status);
    }
  }, [active, toast]);

  const handleGetToken = async (service) => {
    setBusyService(service.id);
    try {
      const result = await api.post('/api/tokens', { serviceId: service.id });
      toast.success(
        `Token ${result.token.tokenNumber} issued`,
        `Position ${result.token.position} · about ${formatMinutes(result.token.estimatedWaitMinutes)} wait.`
      );
      setSelectedId(service.id);
      await Promise.all([overview.refresh(), status.refresh(), board.refresh()]);
    } catch (error) {
      if (error.code === 'active_token_exists') {
        toast.info('You already hold a token', error.message);
      } else if (error.code === 'service_inactive') {
        toast.error('This office is closed', error.message);
      } else {
        toast.error('Could not issue a token', error.message);
      }
    } finally {
      setBusyService(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.delete(`/api/tokens/${cancelTarget.id}`);
      toast.success(`Token ${cancelTarget.tokenNumber} cancelled`);
      setCancelTarget(null);
      await Promise.all([overview.refresh(), status.refresh(), board.refresh()]);
    } catch (error) {
      toast.error('Could not cancel token', error.message);
    } finally {
      setCancelling(false);
    }
  };

  const queueService = status.data?.service || activeForSelected?.service || serviceById.get(selectedId);
  const queueColor = serviceColor(queueService?.color);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            {formatDate(new Date())}
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Hello, {(user?.displayName || 'there').split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your digital tickets and the live queue for every campus office.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveBadge
            isRefreshing={overview.isRefreshing}
            lastUpdated={overview.lastUpdated}
            intervalMs={POLL_MS}
          />
          <button
            type="button"
            onClick={() => {
              overview.refresh();
              status.refresh();
              board.refresh();
            }}
            className="btn-ghost btn-xs"
          >
            Refresh
          </button>
        </div>
      </div>

      {overview.error && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="mt-0.5">⚠</span>
          <div>
            <p className="font-semibold">Could not load your tokens</p>
            <p className="text-xs">{overview.error.message}</p>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {overview.loading && !overview.data ? (
            <div className="space-y-4">
              <Skeleton className="h-56 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          ) : active.length ? (
            active.map((token) => (
              <ActiveTokenCard
                key={token.id}
                token={token}
                service={token.service || serviceById.get(token.serviceId)}
                busy={cancelling && cancelTarget?.id === token.id}
                onCancel={(target) => setCancelTarget(target)}
              />
            ))
          ) : (
            <EmptyTicket
              services={services}
              onSelect={(service) => {
                setSelectedId(service.id);
                handleGetToken(service);
              }}
            />
          )}

          <div>
            <div className="mb-3">
              <h2 className="text-base font-bold text-slate-900">Available services</h2>
              <p className="text-xs text-slate-500">One token per office per day.</p>
            </div>

            {servicesPoll.loading && !services.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((key) => (
                  <Skeleton key={key} className="h-56 w-full rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {services.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    status={cardStatus(service)}
                    activeToken={active.find((token) => token.serviceId === service.id)}
                    busy={busyService === service.id}
                    onGetToken={(target) => {
                      setSelectedId(target.id);
                      handleGetToken(target);
                    }}
                  />
                ))}
                {!services.length && (
                  <EmptyState
                    title="No services available"
                    description="A super administrator needs to configure campus services."
                    className="sm:col-span-2"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900">Live queue</h2>
                <LiveBadge
                  isRefreshing={status.isRefreshing}
                  lastUpdated={status.lastUpdated}
                  intervalMs={POLL_MS}
                  className="text-[10px]"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setSelectedId(service.id)}
                    className={cx(
                      'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                      selectedId === service.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    {service.code}
                  </button>
                ))}
              </div>
            </div>

            <div className={cx('px-5 py-4', queueColor.soft)}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Now serving · {queueService?.name || 'Select a service'}
              </p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <span className="mono-token text-4xl font-extrabold text-slate-900">
                  {status.data?.serving?.tokenNumber || '—'}
                </span>
                <div className="text-right text-xs text-slate-500">
                  <p>
                    <span className="font-bold text-slate-900">{status.data?.waitingCount ?? 0}</span> waiting
                  </p>
                  <p className="mt-0.5">
                    new token ≈{' '}
                    <span className="font-semibold text-slate-700">
                      {formatMinutes(status.data?.estimatedWaitMinutes)}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-3">
              {status.loading && !status.data ? (
                <div className="space-y-2 py-2">
                  {[0, 1, 2].map((key) => (
                    <Skeleton key={key} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <QueueList
                  entries={status.data?.waiting || []}
                  serving={status.data?.serving?.tokenNumber}
                  limit={8}
                  compact
                />
              )}
            </div>

            <div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
              Average service time {formatMinutes(status.data?.averageServiceMinutes ?? queueService?.averageServiceMinutes)} ·
              updated {formatTime(status.lastUpdated)}
            </div>
          </section>

          <section className="card p-4">
            <p className="text-xs leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-700">How the estimate works:</span> people
              ahead (plus the person at the counter) × the office&apos;s recent service rate.
            </p>
          </section>
        </aside>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Your recent tokens</h2>
            <p className="text-xs text-slate-500">Last {history.length} records across all services.</p>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="table-head">Token</th>
                  <th className="table-head hidden sm:table-cell">Service</th>
                  <th className="table-head hidden sm:table-cell">Issued</th>
                  <th className="table-head hidden sm:table-cell">Called</th>
                  <th className="table-head">Waited</th>
                  <th className="table-head">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((token) => (
                  <tr key={token.id} className="transition hover:bg-slate-50/60">
                    <td className="table-cell mono-token">{token.tokenNumber}</td>
                    <td className="table-cell hidden sm:table-cell">
                      <span className="font-medium text-slate-800">{token.serviceName}</span>
                      <span className="ml-2 text-xs text-slate-400">{token.serviceCode}</span>
                    </td>
                    <td className="table-cell hidden text-slate-500 sm:table-cell">{formatTime(token.issuedAt)}</td>
                    <td className="table-cell hidden text-slate-500 sm:table-cell">{formatTime(token.calledAt)}</td>
                    <td className="table-cell text-slate-500">{formatMinutes(token.waitMinutes)}</td>
                    <td className="table-cell">
                      <span className={cx('badge', statusMeta(token.status).tone)}>
                        {statusMeta(token.status).label}
                      </span>
                    </td>
                  </tr>
                ))}
                {!history.length && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        title="No tokens yet"
                        description="Your token history will appear here after your first visit to an office."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={`Cancel ${cancelTarget?.tokenNumber || 'token'}?`}
        description="The token is released immediately and cannot be restored."
        size="sm"
        footer={
          <>
            <button type="button" className="btn-ghost btn-xs" onClick={() => setCancelTarget(null)}>
              Keep token
            </button>
            <button type="button" className="btn-danger btn-xs" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <Spinner className="h-3.5 w-3.5" /> : null}
              Cancel token
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          If you cancel {cancelTarget?.tokenNumber}, you will lose your place in the {cancelTarget?.serviceName}{' '}
          queue and your wait estimate will no longer be tracked. You can take a new token afterwards.
        </p>
      </Modal>
    </AppShell>
  );
}
