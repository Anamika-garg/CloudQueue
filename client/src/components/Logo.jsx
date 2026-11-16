export function Logo({ className = 'h-9 w-9', withWordmark = false, dark = false }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="cq-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4f46e5" />
            <stop offset="1" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#cq-logo)" />
        <path
          d="M22 18h13a11 11 0 0 1 0 22h-6l9 9"
          fill="none"
          stroke="#fff"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="22" cy="46" r="4" fill="#fff" />
      </svg>
      {withWordmark && (
        <span
          className={`font-display text-lg font-extrabold tracking-tight ${
            dark ? 'text-white' : 'text-slate-900'
          }`}
        >
          CloudQueue
        </span>
      )}
    </span>
  );
}
