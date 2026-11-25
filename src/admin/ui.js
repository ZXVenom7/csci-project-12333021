import { useCallback, useEffect, useRef, useState } from 'react';

/** Loads data with `loader`, re-running whenever `deps` change. */
export function useLoad(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const latest = useRef(0);

  const reload = useCallback(() => {
    const ticket = latest.current + 1;
    latest.current = ticket;
    setState((current) => ({ ...current, loading: true, error: null }));
    return loader()
      .then((data) => {
        if (latest.current === ticket) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (latest.current === ticket) setState({ data: null, error, loading: false });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  const setData = useCallback((update) => {
    setState((current) => ({ ...current, data: typeof update === 'function' ? update(current.data) : update }));
  }, []);

  return { ...state, reload, setData };
}

/** Transient success / error message shown at the top of a page. */
export function useNotice() {
  const [notice, setNotice] = useState(null);
  const timer = useRef();
  const show = useCallback((type, message) => {
    window.clearTimeout(timer.current);
    setNotice({ type, message });
    if (type === 'success') timer.current = window.setTimeout(() => setNotice(null), 4000);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return {
    notice,
    success: (message) => show('success', message),
    error: (failure) => show('error', typeof failure === 'string' ? failure : failure.message),
    clear: () => setNotice(null),
  };
}

export function Notice({ notice }) {
  if (!notice) return null;
  return (
    <div className={notice.type === 'success' ? 'success-alert' : 'error-alert'}
      role={notice.type === 'success' ? 'status' : 'alert'}>
      {notice.message}
    </div>
  );
}

export function PageState({ loading, error, children }) {
  if (error) return <div className="error-alert" role="alert">{error.message}</div>;
  if (loading && !children) return <p className="admin-muted" role="status">Loading…</p>;
  return children;
}

/** Label + control + validation message. */
export function Field({ label, error, hint, htmlFor, className = '', children }) {
  return (
    <div className={`admin-field ${className}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error ? <p className="admin-hint">{hint}</p> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function StatusPill({ status }) {
  return <span className={`pill pill-${status}`}>{status.replace('_', ' ')}</span>;
}
