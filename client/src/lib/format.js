/** Small formatting / styling helpers shared across the UI. */

export const cx = (...classes) => classes.filter(Boolean).join(' ');

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const formatTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDate = (value) => {
  if (!value) return '—';
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

export const todayKey = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
};

export const relativeTime = (value) => {
  if (!value) return '—';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export const formatMinutes = (value) => {
  if (value === null || value === undefined) return '—';
  if (value <= 0) return 'now';
  if (value < 1) return '<1 min';
  if (value < 60) return `${Math.round(value)} min`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

export const statusMeta = (status) => {
  switch (status) {
    case 'serving':
      return { label: 'Now serving', tone: 'bg-emerald-100 text-emerald-700' };
    case 'waiting':
      return { label: 'Waiting', tone: 'bg-amber-100 text-amber-700' };
    case 'served':
      return { label: 'Served', tone: 'bg-slate-100 text-slate-600' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'bg-slate-100 text-slate-500' };
    case 'no_show':
      return { label: 'No-show', tone: 'bg-rose-100 text-rose-700' };
    default:
      return { label: status || 'Unknown', tone: 'bg-slate-100 text-slate-500' };
  }
};

const SERVICE_COLORS = {
  indigo: {
    soft: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    solid: 'bg-indigo-600',
    ring: 'ring-indigo-500/20',
    dot: 'bg-indigo-500',
    gradient: 'from-indigo-600 to-indigo-500',
    chart: '#4f46e5',
  },
  emerald: {
    soft: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    solid: 'bg-emerald-600',
    ring: 'ring-emerald-500/20',
    dot: 'bg-emerald-500',
    gradient: 'from-emerald-600 to-teal-500',
    chart: '#059669',
  },
  amber: {
    soft: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    solid: 'bg-amber-500',
    ring: 'ring-amber-500/20',
    dot: 'bg-amber-500',
    gradient: 'from-amber-500 to-orange-500',
    chart: '#d97706',
  },
  rose: {
    soft: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    solid: 'bg-rose-600',
    ring: 'ring-rose-500/20',
    dot: 'bg-rose-500',
    gradient: 'from-rose-600 to-pink-500',
    chart: '#e11d48',
  },
  sky: {
    soft: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    solid: 'bg-sky-600',
    ring: 'ring-sky-500/20',
    dot: 'bg-sky-500',
    gradient: 'from-sky-600 to-cyan-500',
    chart: '#0284c7',
  },
  violet: {
    soft: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    solid: 'bg-violet-600',
    ring: 'ring-violet-500/20',
    dot: 'bg-violet-500',
    gradient: 'from-violet-600 to-purple-500',
    chart: '#7c3aed',
  },
  teal: {
    soft: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    solid: 'bg-teal-600',
    ring: 'ring-teal-500/20',
    dot: 'bg-teal-500',
    gradient: 'from-teal-600 to-emerald-500',
    chart: '#0d9488',
  },
  orange: {
    soft: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    solid: 'bg-orange-500',
    ring: 'ring-orange-500/20',
    dot: 'bg-orange-500',
    gradient: 'from-orange-500 to-amber-500',
    chart: '#ea580c',
  },
};

export const serviceColor = (color) => SERVICE_COLORS[color] || SERVICE_COLORS.indigo;

export const SERVICE_COLOR_OPTIONS = Object.keys(SERVICE_COLORS);

/** Escape a value for a CSV cell. */
export const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
