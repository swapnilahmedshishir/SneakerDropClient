import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ToastContainer from './ToastContainer';
import toastReducer, { pushToast } from './toastSlice';

function makeStore() {
  return configureStore({ reducer: { toast: toastReducer } });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastContainer', () => {
  it('renders error toasts as alerts and success toasts as status', () => {
    const store = makeStore();
    store.dispatch(pushToast({ type: 'error', message: 'Drop is out of stock' }));
    store.dispatch(pushToast({ type: 'success', message: 'Purchase complete' }));

    render(
      <Provider store={store}>
        <ToastContainer />
      </Provider>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Drop is out of stock');
    expect(screen.getByRole('status')).toHaveTextContent('Purchase complete');
  });

  it('renders nothing when there is no feedback', () => {
    render(
      <Provider store={makeStore()}>
        <ToastContainer />
      </Provider>
    );

    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('auto-dismisses a toast after 5 seconds', () => {
    vi.useFakeTimers();
    const store = makeStore();
    store.dispatch(pushToast({ type: 'info', message: 'Heads up' }));

    render(
      <Provider store={store}>
        <ToastContainer />
      </Provider>
    );
    expect(screen.getByTestId('toast')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('can be dismissed immediately with its clearly-labelled close button', () => {
    const store = makeStore();
    store.dispatch(pushToast({ type: 'error', message: 'Reservation failed' }));

    render(
      <Provider store={store}>
        <ToastContainer />
      </Provider>
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss notification: Reservation failed' })
    );

    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });
});
