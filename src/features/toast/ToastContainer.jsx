import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { dismissToast } from './toastSlice';

// How long feedback stays on screen before removing itself.
const AUTO_DISMISS_MS = 5000;

// Solid backgrounds keep white text at sufficient contrast (>= 4.5:1).
const TOAST_STYLES = {
  success: 'border-emerald-800 bg-emerald-700 text-white',
  error: 'border-red-800 bg-red-700 text-white',
  info: 'border-gray-800 bg-gray-900 text-white',
};

function Toast({ toast }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timer = setTimeout(() => dispatch(dismissToast(toast.id)), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dispatch, toast.id]);

  // Errors announce assertively (role="alert"); success/info announce politely
  // (role="status"). Both are rendered into the DOM on appearance, which is
  // what makes screen readers pick them up.
  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      data-testid="toast"
      className={`pointer-events-auto flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${TOAST_STYLES[toast.type] ?? TOAST_STYLES.info}`}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={() => dispatch(dismissToast(toast.id))}
        aria-label={`Dismiss notification: ${toast.message}`}
        className="shrink-0 rounded p-0.5 text-lg leading-none opacity-80 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

/**
 * Fixed bottom-right stack of transient notifications. Renders nothing when
 * there is no feedback, so it never interferes with existing queries for
 * `role="alert"` / `role="status"` elsewhere in tests or the page.
 */
function ToastContainer() {
  // Defensive read: stores created without the toast slice (tests) render nothing.
  const toasts = useAppSelector((state) => state.toast?.items ?? []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:left-auto sm:right-6 sm:w-96"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

export default ToastContainer;
