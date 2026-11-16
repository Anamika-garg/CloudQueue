import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { cx } from '../lib/format';

const ToastContext = createContext(null);

const ICONS = {
  success: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M18 10A8 8 0 112 10a8 8 0 0116 0zm-8-4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M18 10A8 8 0 112 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.25v3h-.5a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-.25V9.75A.75.75 0 0010.25 9H9z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

const TONES = {
  success: 'border-emerald-200 bg-white text-emerald-700',
  error: 'border-rose-200 bg-white text-rose-700',
  info: 'border-slate-200 bg-white text-slate-700',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const item = { id, type: 'info', duration: 4500, ...toast };
      setToasts((current) => [...current.slice(-3), item]);
      if (item.duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), item.duration)
        );
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      push,
      dismiss,
      success: (title, description) => push({ type: 'success', title, description }),
      error: (title, description) => push({ type: 'error', title, description }),
      info: (title, description) => push({ type: 'info', title, description }),
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cx(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-lift animate-toast-in',
              TONES[toast.type] || TONES.info
            )}
          >
            <span className="mt-0.5 shrink-0">{ICONS[toast.type] || ICONS.info}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-sm text-slate-500">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Dismiss notification"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
