import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  cx,
  serviceColor,
  SERVICE_COLOR_OPTIONS,
} from '../lib/format';
import { AppShell } from '../components/AppShell';
import { Modal } from '../components/Modal';
import { EmptyState, Spinner } from '../components/Spinner';
import { RoleBadge } from '../components/StatusPill';
import { useToast } from '../components/Toast';

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  location: '',
  averageServiceMinutes: 5,
  color: 'indigo',
  isActive: true,
};

export function ServiceAdmin() {
  const { user } = useAuth();
  const toast = useToast();

  const [services, setServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [roleBusy, setRoleBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [serviceData, userData] = await Promise.all([
        api.get('/api/admin/services'),
        api.get('/api/admin/users').catch(() => ({ users: [] })),
      ]);
      setServices(serviceData.services);
      const ROLE_ORDER = { super_admin: 0, admin: 1, user: 2 };
      const label = (account) => account.displayName || account.email || account.id || '';
      setUsers(
        (userData.users || [])
          .filter((account) => Boolean(account.email))
          .slice()
          .sort(
            (a, b) =>
              (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
              label(a).localeCompare(label(b))
          )
      );
    } catch (error) {
      toast.error('Could not load services', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (service) => {
    setEditing(service);
    setForm({
      code: service.code,
      name: service.name,
      description: service.description || '',
      location: service.location || '',
      averageServiceMinutes: service.averageServiceMinutes,
      color: service.color || 'indigo',
      isActive: service.isActive,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        averageServiceMinutes: Number(form.averageServiceMinutes),
      };
      if (editing) {
        await api.patch(`/api/services/${editing.id}`, payload);
        toast.success(`${payload.code} updated`);
      } else {
        await api.post('/api/services', payload);
        toast.success(`${payload.code} created`);
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (service) => {
    try {
      await api.patch(`/api/services/${service.id}`, { isActive: !service.isActive });
      toast.success(`${service.code} ${service.isActive ? 'deactivated' : 'activated'}`);
      await load();
    } catch (error) {
      toast.error('Could not update service', error.message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await api.delete(`/api/services/${deleteTarget.id}`);
      toast.success(result.deleted ? 'Service deleted' : 'Service deactivated', result.message);
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error('Could not delete service', error.message);
    } finally {
      setDeleting(false);
    }
  };

  const changeRole = async (target, role) => {
    if (role === target.role) return;
    setRoleBusy(target.id);
    try {
      await api.patch(`/api/admin/users/${target.id}/role`, { role });
      toast.success(`${target.email} is now ${role.replace('_', ' ')}`);
      await load();
    } catch (error) {
      toast.error('Could not change role', error.message);
    } finally {
      setRoleBusy(null);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Super administrator
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Services & access
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure campus offices, service rates and staff roles.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin" className="btn-ghost btn-xs">
            ← Back to console
          </Link>
          <button type="button" className="btn-brand btn-xs" onClick={openCreate}>
            New service
          </button>
        </div>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-base font-bold text-slate-900">Campus services</h2>
          <span className="text-xs text-slate-400">{services.length} configured</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => {
            const palette = serviceColor(service.color);
            return (
              <article key={service.id} className="card overflow-hidden">
                <div className={cx('h-1 w-full bg-gradient-to-r', palette.gradient)} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cx('badge', palette.soft, palette.text)}>{service.code}</span>
                        <span
                          className={cx(
                            'badge',
                            service.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          )}
                        >
                          {service.isActive ? 'Open' : 'Closed'}
                        </span>
                      </div>
                      <h3 className="mt-2 truncate text-base font-bold text-slate-900">{service.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{service.description}</p>
                    </div>
                    <span className="mono-token shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {service.averageServiceMinutes} min
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-slate-400">
                    {service.location || 'No location set'}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="button" className="btn-ghost btn-xs" onClick={() => openEdit(service)}>
                      Edit
                    </button>
                    <button type="button" className="btn-ghost btn-xs" onClick={() => toggleActive(service)}>
                      {service.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="btn-danger btn-xs"
                      onClick={() => setDeleteTarget(service)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {!services.length && !loading && (
            <EmptyState
              title="No services yet"
              description="Create the first campus office to start issuing tokens."
              className="md:col-span-2"
              action={
                <button type="button" className="btn-brand btn-xs" onClick={openCreate}>
                  Create service
                </button>
              }
            />
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Staff & roles</h2>
            <p className="text-xs text-slate-500">
              Roles are stored in MongoDB and enforced on every protected endpoint.
            </p>
          </div>
          <span className="text-xs text-slate-400">{users.length} accounts</span>
        </div>

        <div className="card overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {users.map((account) => (
              <li
                key={account.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {account.displayName || account.email}
                    {account.id === user?.id && <span className="ml-2 text-[11px] text-indigo-500">you</span>}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">{account.email}</p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <RoleBadge role={account.role} />
                  <div className="flex items-center gap-2">
                    {roleBusy === account.id && <Spinner className="h-3.5 w-3.5 text-indigo-600" />}
                    <select
                      className="input w-auto py-1.5 text-xs"
                      value={account.role}
                      disabled={roleBusy === account.id || account.id === user?.id}
                      onChange={(event) => changeRole(account, event.target.value)}
                      title={account.id === user?.id ? 'You cannot change your own role' : undefined}
                      aria-label={`Role for ${account.email}`}
                    >
                      <option value="user">Student</option>
                      <option value="admin">Office admin</option>
                      <option value="super_admin">Super admin</option>
                    </select>
                  </div>
                </div>
              </li>
            ))}
            {!users.length && (
              <li>
                <EmptyState
                  title={loading ? 'Loading accounts…' : 'No accounts yet'}
                  description={loading ? undefined : 'Accounts appear after their first sign-in.'}
                />
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* Create / edit service */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.code}` : 'New service'}
        description={
          editing
            ? 'Changes apply to new tokens immediately; running queues are untouched.'
            : 'A service is an office counter that issues its own daily token sequence.'
        }
        footer={
          <>
            <button type="button" className="btn-ghost btn-xs" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="service-form" className="btn-brand btn-xs" disabled={saving}>
              {saving ? <Spinner className="h-3.5 w-3.5" /> : null}
              {editing ? 'Save changes' : 'Create service'}
            </button>
          </>
        }
      >
        <form id="service-form" onSubmit={submit} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <div>
              <label className="label" htmlFor="service-code">
                Code
              </label>
              <input
                id="service-code"
                className="input mono-token uppercase"
                value={form.code}
                maxLength={5}
                required
                placeholder="REG"
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
              />
              <p className="mt-1 text-[11px] text-slate-400">2–5 letters</p>
            </div>
            <div>
              <label className="label" htmlFor="service-name">
                Name
              </label>
              <input
                id="service-name"
                className="input"
                value={form.name}
                required
                maxLength={120}
                placeholder="Registrar"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="service-description">
              Description
            </label>
            <textarea
              id="service-description"
              className="input min-h-[72px] resize-y"
              value={form.description}
              maxLength={500}
              placeholder="What students come here for"
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="service-location">
                Location
              </label>
              <input
                id="service-location"
                className="input"
                value={form.location}
                maxLength={160}
                placeholder="Admin Block, Room 104"
                onChange={(event) => setForm({ ...form, location: event.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="service-avg">
                Average service minutes
              </label>
              <input
                id="service-avg"
                type="number"
                min={1}
                max={180}
                className="input"
                value={form.averageServiceMinutes}
                onChange={(event) =>
                  setForm({ ...form, averageServiceMinutes: event.target.value })
                }
              />
            </div>
          </div>

          <div>
            <span className="label">Accent colour</span>
            <div className="flex flex-wrap gap-2">
              {SERVICE_COLOR_OPTIONS.map((color) => {
                const palette = serviceColor(color);
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={cx(
                      'h-8 w-8 rounded-lg transition',
                      palette.solid,
                      form.color === color
                        ? 'ring-2 ring-slate-900 ring-offset-2'
                        : 'opacity-70 hover:opacity-100'
                    )}
                    aria-label={color}
                    title={color}
                  />
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            <span className="text-sm text-slate-700">
              Accepting new tokens
              <span className="block text-[11px] text-slate-400">
                Closed services keep their history but reject new tokens.
              </span>
            </span>
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.code}?`}
        description="Services with historical tokens are deactivated instead of removed."
        size="sm"
        footer={
          <>
            <button type="button" className="btn-ghost btn-xs" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button type="button" className="btn-danger btn-xs" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Spinner className="h-3.5 w-3.5" /> : null}
              Delete service
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          You are about to delete <span className="font-semibold">{deleteTarget?.name}</span>. If any token
          has ever been issued for this office, CloudQueue will keep the data and mark the service as closed
          instead — reporting stays intact.
        </p>
      </Modal>
    </AppShell>
  );
}
