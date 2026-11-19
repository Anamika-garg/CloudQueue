import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  csvCell,
  cx,
  formatDate,
  formatMinutes,
  formatTime,
  relativeTime,
  serviceColor,
  statusMeta,
  todayKey,
} from '../lib/format';
import { usePolling } from '../hooks/usePolling';
import { AppShell } from '../components/AppShell';
import { StatCard, statIcons } from '../components/StatCard';
import { ChartCard, TokensPerHourChart, WaitTimeChart } from '../components/Charts';
import { EmptyState, Skeleton, Spinner } from '../components/Spinner';
import { LiveBadge, StatusPill } from '../components/StatusPill';
import { useToast } from '../components/Toast';

const QUEUE_POLL = 5000;

export function Admin() {
  const { user, isSuperAdmin } = useAuth();
  const toast = useToast();

  const [serviceId, setServiceId] = useState(null);
  const [date, setDate] = useState(todayKey());
  const [page, setPage] = useState(1);
  const [calling, setCalling] = useState(false);
  const [rowBusy, setRowBusy] = useState(null);
  const [exporting, setExporting] = useState(false);

  const servicesPoll = usePolling(() => api.get('/api/admin/services'), { intervalMs: 60000 });
  const services = servicesPoll.data?.services || [];

  useEffect(() => {
    if (!serviceId && services.length) {
      setServiceId((services.find((service) => service.isActive) || services[0]).id);
    }
  }, [services, serviceId]);

  useEffect(() => {
    setPage(1);
  }, [serviceId, date]);

  const queue = usePolling(
    () => (serviceId ? api.get(`/api/admin/queue?serviceId=${serviceId}&date=${date}`) : Promise.resolve(null)),
    { intervalMs: QUEUE_POLL, enabled: Boolean(serviceId), deps: [serviceId, date] }
  );

  const stats = usePolling(
    () => (serviceId ? api.get(`/api/admin/stats?serviceId=${serviceId}&date=${date}`) : Promise.resolve(null)),
    { intervalMs: 15000, enabled: Boolean(serviceId), deps: [serviceId, date] }
  );

  const history = usePolling(
    () =>
      serviceId
        ? api.get(`/api/admin/history?serviceId=${serviceId}&date=${date}&page=${page}&limit=15`)
        : Promise.resolve(null),
    { intervalMs: 20000, enabled: Boolean(serviceId), deps: [serviceId, date, page] }
  );

  const audit = usePolling(() => api.get('/api/admin/audit?limit=8'), { intervalMs: 30000 });

  const service = queue.data?.service || services.find((item) => item.id === serviceId);
  const color = serviceColor(service?.color);
  const dailyStats = stats.data?.stats;

  const queueRows = useMemo(() => {
    const tokens = queue.data?.tokens || [];
    return tokens
      .filter((token) => ['serving', 'waiting'].includes(token.status))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'serving' ? -1 : 1;
        return a.issuedSequence - b.issuedSequence;
      });
  }, [queue.data]);

  const refreshAll = async () => {
    await Promise.all([queue.refresh(), stats.refresh(), history.refresh(), audit.refresh()]);
  };

  const handleCallNext = async () => {
    if (!serviceId) return;
    setCalling(true);
    try {
      const result = await api.post('/api/admin/call-next', { serviceId, dateKey: date });
      if (result.serving) {
        toast.success(`Now serving ${result.serving.tokenNumber}`, result.message);
      } else {
        toast.info('Queue is empty', result.message);
      }
      await refreshAll();
    } catch (error) {
      toast.error('Could not call the next token', error.message);
    } finally {
      setCalling(false);
    }
  };

  const handleComplete = async (token, action) => {
    setRowBusy(`${token.id}:${action}`);
    try {
      const result = await api.post(`/api/admin/mark-served/${token.id}`, { action });
      toast.success(result.message);
      await refreshAll();
    } catch (error) {
      toast.error('Could not update the token', error.message);
    } finally {
      setRowBusy(null);
    }
  };

  const handleExport = async () => {
    if (!serviceId) return;
    setExporting(true);
    try {
      const rows = [];
      let currentPage = 1;
      let pages = 1;
      do {
        const data = await api.get(
          `/api/admin/history?serviceId=${serviceId}&date=${date}&page=${currentPage}&limit=100`
        );
        rows.push(...data.history);
        pages = data.pagination.pages;
        currentPage += 1;
      } while (currentPage <= pages && currentPage <= 20);

      const header = [
        'Token',
        'Service',
        'Status',
        'Student',
        'Email',
        'Issued at',
        'Called at',
        'Served at',
        'Wait (min)',
        'Service (min)',
      ];
      const csv = [
        header.join(','),
        ...rows.map((row) =>
          [
            row.tokenNumber,
            row.serviceName,
            row.status,
            row.userDisplayName,
            row.userEmail,
            row.issuedAt,
            row.calledAt,
            row.servedAt,
            row.waitMinutes,
            row.serviceMinutes,
          ]
            .map(csvCell)
            .join(',')
        ),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `cloudqueue-${service?.code || 'service'}-${date}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Export ready', `${rows.length} rows written to CSV.`);
    } catch (error) {
      toast.error('Export failed', error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Admin console · {user?.role === 'super_admin' ? 'system administrator' : 'office administrator'}
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Queue control
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Call tokens, mark them served and review today&apos;s demand.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <span className="hidden sm:inline-flex">
            <LiveBadge isRefreshing={queue.isRefreshing} lastUpdated={queue.lastUpdated} intervalMs={QUEUE_POLL} />
          </span>
          <label className="sr-only" htmlFor="admin-date">
            Date
          </label>
          <input
            id="admin-date"
            type="date"
            className="input w-auto py-2 text-sm"
            value={date}
            max={todayKey()}
            onChange={(event) => setDate(event.target.value || todayKey())}
          />
          {isSuperAdmin && (
            <Link to="/admin/services" className="btn-ghost btn-xs">
              Manage services
            </Link>
          )}
        </div>
      </div>

      {/* Service selector */}
      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
        {services.map((item) => {
          const palette = serviceColor(item.color);
          const selected = item.id === serviceId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setServiceId(item.id)}
              className={cx(
                'flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition',
                selected
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              )}
            >
              <span
                className={cx(
                  'flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold',
                  selected ? 'bg-white/15 text-white' : cx(palette.soft, palette.text)
                )}
              >
                {item.code}
              </span>
              {item.name}
              {!item.isActive && (
                <span
                  className={cx(
                    'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                    selected ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'
                  )}
                >
                  closed
                </span>
              )}
            </button>
          );
        })}
        {!services.length && !servicesPoll.loading && (
          <p className="text-sm text-slate-400">No services configured yet.</p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Queue control */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <section className={cx('min-w-0 overflow-hidden rounded-2xl border bg-white shadow-soft', color.border)}>
            <div className={cx('flex flex-wrap items-center justify-between gap-4 px-5 py-4', color.soft)}>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Now serving · {service?.name || '—'}
                </p>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="mono-token text-4xl font-extrabold text-slate-900">
                    {queue.data?.serving?.tokenNumber || '—'}
                  </span>
                  {queue.data?.serving?.calledAt && (
                    <span className="text-xs text-slate-500">
                      called {formatTime(queue.data.serving.calledAt)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {queue.data?.waitingCount ?? 0} waiting · avg service{' '}
                  {formatMinutes(queue.data?.averageServiceMinutes)} · new arrival ≈{' '}
                  {formatMinutes(queue.data?.estimatedWaitMinutes)}
                </p>              </div>

              <button
                type="button"
                onClick={handleCallNext}
                disabled={calling || !serviceId}
                className="btn-primary relative shrink-0 shadow-lift"
              >
                {calling ? <Spinner className="h-4 w-4" /> : null}
                Call next token
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5-5m5 5-5 5" />
                </svg>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="table-head w-12">#</th>
                    <th className="table-head">Token</th>
                    <th className="table-head">Student</th>
                    <th className="table-head hidden md:table-cell">Issued</th>
                    <th className="table-head hidden md:table-cell">Waited</th>
                    <th className="table-head">Status</th>
                    <th className="table-head text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queueRows.map((token, index) => (
                    <tr
                      key={token.id}
                      className={cx('transition hover:bg-slate-50/60', token.status === 'serving' && 'bg-emerald-50/40')}
                    >
                      <td className="table-cell text-xs text-slate-400">{index + 1}</td>
                      <td className="table-cell mono-token">{token.tokenNumber}</td>
                      <td className="table-cell">
                        <span className="font-medium text-slate-800">{token.userDisplayName}</span>
                        <span className="block text-[11px] text-slate-400">{token.userEmail}</span>
                      </td>
                      <td className="table-cell hidden text-slate-500 md:table-cell">{formatTime(token.issuedAt)}</td>
                      <td className="table-cell hidden text-slate-500 md:table-cell">
                        {token.waitMinutes !== null && token.waitMinutes !== undefined
                          ? formatMinutes(token.waitMinutes)
                          : relativeTime(token.issuedAt).replace(' ago', '')}
                      </td>
                      <td className="table-cell">
                        <StatusPill status={token.status} />
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1.5">
                          {token.status === 'serving' ? (
                            <>
                              <button
                                type="button"
                                className="btn-primary btn-xs"
                                disabled={Boolean(rowBusy)}
                                onClick={() => handleComplete(token, 'served')}
                              >
                                {rowBusy === `${token.id}:served` ? <Spinner className="h-3 w-3" /> : null}
                                Mark served
                              </button>
                              <button
                                type="button"
                                className="btn-danger btn-xs"
                                disabled={Boolean(rowBusy)}
                                onClick={() => handleComplete(token, 'no_show')}
                              >
                                No-show
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn-ghost btn-xs"
                              disabled={Boolean(rowBusy)}
                              onClick={() => handleComplete(token, 'no_show')}
                            >
                              {rowBusy === `${token.id}:no_show` ? <Spinner className="h-3 w-3" /> : null}
                              No-show
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!queueRows.length && (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState
                          icon={
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M9 8h6M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                            </svg>
                          }
                          title={queue.loading ? 'Loading queue…' : 'No one is waiting'}
                          description={
                            queue.loading
                              ? undefined
                              : 'Call next will return nothing until a student generates a token for this office.'
                          }
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              label="Issued"
              value={dailyStats ? dailyStats.totalIssued : '—'}
              hint={`for ${formatDate(date)}`}
              tone="indigo"
              icon={statIcons.ticket}
            />
            <StatCard
              label="Served"
              value={dailyStats ? dailyStats.totalServed : '—'}
              hint={dailyStats ? `${dailyStats.totalWaiting} still open` : undefined}
              tone="emerald"
              icon={statIcons.check}
            />
            <StatCard
              label="Avg wait"
              value={dailyStats ? formatMinutes(dailyStats.averageWaitMinutes) : '—'}
              hint={dailyStats ? `avg service ${formatMinutes(dailyStats.averageServiceMinutes)}` : undefined}
              tone="amber"
              icon={statIcons.clock}
            />
            <StatCard
              label="No-shows"
              value={dailyStats ? dailyStats.totalNoShow : '—'}
              hint={dailyStats ? `${dailyStats.totalCancelled} cancelled` : undefined}
              tone="rose"
              icon={statIcons.alert}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard
              title="Tokens per hour"
              subtitle="Issued vs served, campus-local time"
              action={<span className="badge bg-slate-100 text-slate-500">{date}</span>}
            >
              {dailyStats ? (
                <TokensPerHourChart hourly={dailyStats.hourlyBreakdown} color={service?.color} />
              ) : (
                <Skeleton className="h-[240px] w-full" />
              )}
            </ChartCard>

            <ChartCard title="Average wait by hour" subtitle="Minutes between issue and call">
              {dailyStats ? (
                <WaitTimeChart hourly={dailyStats.hourlyBreakdown} />
              ) : (
                <Skeleton className="h-[240px] w-full" />
              )}
            </ChartCard>
          </div>
        </div>

        {/* Right rail */}
        <aside className="min-w-0 space-y-4">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Service settings</h2>
              {isSuperAdmin && (
                <Link to="/admin/services" className="text-xs font-semibold text-indigo-600 hover:underline">
                  Edit →
                </Link>
              )}
            </div>
            <dl className="mt-3 space-y-2.5 text-sm">
              {[
                ['Code', service?.code || '—'],
                ['Office', service?.name || '—'],
                ['Location', service?.location || 'Not set'],
                ['Avg service time', formatMinutes(service?.averageServiceMinutes)],
                ['Status', service?.isActive ? 'Open' : 'Closed'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-right text-xs font-semibold text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-bold text-slate-900">Audit log</h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                last {audit.data?.entries?.length || 0}
              </span>
            </div>
            <ol className="divide-y divide-slate-100">
              {(audit.data?.entries || []).map((entry) => {
                const actor = entry.performedBy?.email || 'system';
                const target =
                  entry.target?.label && entry.target.label !== actor
                    ? ` · ${entry.target.label}`
                    : '';
                return (
                  <li key={entry.id} className="px-5 py-3">
                    <p className="text-xs font-semibold capitalize text-slate-800">
                      {entry.action.replace(/[._]/g, ' ')}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {actor}
                      {target}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{relativeTime(entry.createdAt)}</p>
                  </li>
                );
              })}
              {!audit.data?.entries?.length && (
                <li className="px-5 py-6 text-center text-xs text-slate-400">
                  No privileged actions recorded yet.
                </li>
              )}
            </ol>
          </section>
        </aside>
      </div>

      {/* Daily history */}
      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Daily history</h2>
            <p className="text-xs text-slate-500">
              {formatDate(date)} · {history.data?.pagination?.total ?? 0} tokens
              {service ? ` for ${service.name}` : ''}
            </p>
          </div>
          <button type="button" className="btn-ghost btn-xs" onClick={handleExport} disabled={exporting}>
            {exporting ? <Spinner className="h-3.5 w-3.5" /> : null}
            Export CSV
          </button>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="table-head">Token</th>
                  <th className="table-head">Student</th>
                  <th className="table-head hidden sm:table-cell">Issued</th>
                  <th className="table-head hidden lg:table-cell">Called</th>
                  <th className="table-head hidden lg:table-cell">Served</th>
                  <th className="table-head hidden sm:table-cell">Wait</th>
                  <th className="table-head hidden xl:table-cell">Service</th>
                  <th className="table-head">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(history.data?.history || []).map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50/60">
                    <td className="table-cell mono-token">{row.tokenNumber}</td>
                    <td className="table-cell">
                      <span className="font-medium text-slate-800">{row.userDisplayName}</span>
                      <span className="block text-[11px] text-slate-400">{row.userEmail}</span>
                    </td>
                    <td className="table-cell hidden text-slate-500 sm:table-cell">{formatTime(row.issuedAt)}</td>
                    <td className="table-cell hidden text-slate-500 lg:table-cell">{formatTime(row.calledAt)}</td>
                    <td className="table-cell hidden text-slate-500 lg:table-cell">{formatTime(row.servedAt)}</td>
                    <td className="table-cell hidden text-slate-500 sm:table-cell">{formatMinutes(row.waitMinutes)}</td>
                    <td className="table-cell hidden text-slate-500 xl:table-cell">{formatMinutes(row.serviceMinutes)}</td>
                    <td className="table-cell">
                      <span className={cx('badge', statusMeta(row.status).tone)}>
                        {statusMeta(row.status).label}
                      </span>
                    </td>
                  </tr>
                ))}
                {!history.data?.history?.length && (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        title={history.loading ? 'Loading history…' : 'No tokens on this date'}
                        description={
                          history.loading ? undefined : 'Try another date or a different office.'
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>
              Page {history.data?.pagination?.page ?? 1} of {history.data?.pagination?.pages ?? 1}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost btn-xs"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-ghost btn-xs"
                disabled={page >= (history.data?.pagination?.pages ?? 1)}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
