import { Component } from 'react';
import { Logo } from './Logo';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[cloudqueue] UI error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
            <Logo className="h-10 w-10" />
            <h1 className="mt-5 text-lg font-bold text-slate-900">Something broke in the interface</h1>
            <p className="mt-2 text-sm text-slate-500">
              The API is probably fine — this is a rendering error. Reload the page; if it persists,
              clear the session and sign in again.
            </p>
            <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-200">
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <div className="mt-5 flex gap-2">
              <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
                Reload
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  sessionStorage.clear();
                  window.location.href = '/';
                }}
              >
                Reset session
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
