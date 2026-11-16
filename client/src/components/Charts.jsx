import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { serviceColor } from '../lib/format';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

ChartJS.defaults.font.family =
  'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
ChartJS.defaults.color = '#94a3b8';
ChartJS.defaults.font.size = 11;

const GRID = 'rgba(148, 163, 184, 0.18)';

const baseOptions = (yTitle) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      align: 'end',
      labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 16 },
    },
    tooltip: {
      backgroundColor: '#0f172a',
      padding: 10,
      cornerRadius: 10,
      titleFont: { size: 11, weight: '600' },
      bodyFont: { size: 11 },
      displayColors: true,
      boxWidth: 8,
      boxHeight: 8,
      usePointStyle: true,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { maxRotation: 0, autoSkipPadding: 12 },
    },
    y: {
      beginAtZero: true,
      title: yTitle ? { display: true, text: yTitle, color: '#94a3b8', font: { size: 10 } } : undefined,
      grid: { color: GRID, drawTicks: false },
      border: { display: false },
      ticks: { precision: 0, padding: 6 },
    },
  },
});

/** 07:00 - 19:00 by default; expands if the data lived outside office hours. */
function officeHours(hourly = []) {
  if (!hourly.length) return [];
  const firstActivity = hourly.findIndex((bucket) => bucket.issued > 0 || bucket.served > 0);
  const lastActivity = hourly.reduce((last, bucket, index) => {
    return bucket.issued > 0 || bucket.served > 0 ? index : last;
  }, -1);

  let start = 6;
  let end = 20;
  if (firstActivity !== -1) start = Math.min(start, firstActivity);
  if (lastActivity !== -1) end = Math.max(end, Math.min(23, lastActivity + 1));
  return hourly.slice(start, end + 1);
}

export function TokensPerHourChart({ hourly, color = 'indigo', height = 240 }) {
  const buckets = officeHours(hourly);
  const palette = serviceColor(color);

  const data = {
    labels: buckets.map((bucket) => `${String(bucket.hour).padStart(2, '0')}:00`),
    datasets: [
      {
        label: 'Issued',
        data: buckets.map((bucket) => bucket.issued),
        backgroundColor: palette.chart,
        borderRadius: 5,
        maxBarThickness: 22,
      },
      {
        label: 'Served',
        data: buckets.map((bucket) => bucket.served),
        backgroundColor: 'rgba(148, 163, 184, 0.45)',
        borderRadius: 5,
        maxBarThickness: 22,
      },
    ],
  };

  return (
    <div style={{ height }}>
      <Bar data={data} options={baseOptions('Tokens')} />
    </div>
  );
}

export function WaitTimeChart({ hourly, height = 240 }) {
  const buckets = officeHours(hourly);

  const data = {
    labels: buckets.map((bucket) => `${String(bucket.hour).padStart(2, '0')}:00`),
    datasets: [
      {
        label: 'Average wait (min)',
        data: buckets.map((bucket) => bucket.avgWaitMinutes || 0),
        borderColor: '#d97706',
        backgroundColor: (context) => {
          const { ctx, chartArea } = context.chart;
          if (!chartArea) return 'rgba(217, 119, 6, 0.12)';
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(217, 119, 6, 0.28)');
          gradient.addColorStop(1, 'rgba(217, 119, 6, 0.02)');
          return gradient;
        },
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        pointBackgroundColor: '#d97706',
      },
    ],
  };

  return (
    <div style={{ height }}>
      <Line data={data} options={baseOptions('Minutes')} />
    </div>
  );
}

export function ChartCard({ title, subtitle, action, children }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
