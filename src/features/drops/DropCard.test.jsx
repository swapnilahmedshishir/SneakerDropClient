import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import DropCard from './DropCard';
import dropsReducer from './dropsSlice';
import reservationsReducer from '../reservations/reservationsSlice';
import userReducer from '../user/userSlice';
import {
  purchaseReservation as apiPurchase,
  reserveActiveDrop,
} from '../../services/api';

vi.mock('../../services/api', () => ({
  getActiveDrops: vi.fn(),
  reserveActiveDrop: vi.fn(),
  purchaseReservation: vi.fn(),
  apiClient: {},
}));

const DROP = {
  id: 3,
  name: 'Adidas Yeezy Boost 350',
  price: 220,
  totalStock: 3,
  availableStock: 3,
  startsAt: '2026-08-29T00:00:00.000Z',
};

// Server-style expiresAt timestamp (Postgres spacing with a +06-style offset).
// The system clock is pinned in the countdown tests so the display is exact.
const EXPIRES_AT = '2026-08-29T10:00:59.000+00:00';

const ACTIVE_RESERVATION = {
  id: 101,
  userId: 1,
  dropId: 3,
  status: 'ACTIVE',
  expiresAt: EXPIRES_AT,
};

const PURCHASE = { id: 500, userId: 1, dropId: 3, reservationId: 101 };

// Must match DropCard's user-friendly network failure message (the component
// deliberately replaces axios' raw "Network Error" text).
const NETWORK_ERROR_TEXT = 'Network error — please check your connection and try again.';

function makeStore({ reservation } = {}) {
  return configureStore({
    reducer: { drops: dropsReducer, user: userReducer, reservations: reservationsReducer },
    preloadedState: {
      drops: { items: [DROP], loading: false, error: null },
      user: { id: 1 },
      reservations: { byDropId: reservation ? { [DROP.id]: reservation } : {} },
    },
  });
}

function renderCard({ reservation } = {}) {
  return render(
    <Provider store={makeStore({ reservation })}>
      <DropCard drop={DROP} />
    </Provider>
  );
}

async function flushPromise(promiseResolver) {
  await act(async () => {
    promiseResolver();
  });
}

describe('DropCard reservation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a Reserve button when nothing is reserved yet', () => {
    renderCard();
    expect(screen.getByRole('button', { name: 'Reserve Adidas Yeezy Boost 350' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Complete Purchase/ })).not.toBeInTheDocument();
  });

  it('goes Reserve -> Reserving... -> Reserved with the server-provided countdown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T10:00:00.000Z'));
    let resolveReserve;
    reserveActiveDrop.mockReturnValue(
      new Promise((resolve) => {
        resolveReserve = resolve;
      })
    );

    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Reserve Adidas Yeezy Boost 350' }));

    // The aria-label stays the same, so check the loading text on the button.
    const pendingButton = screen.getByRole('button', {
      name: 'Reserve Adidas Yeezy Boost 350',
    });
    expect(pendingButton).toHaveTextContent('Reserving...');
    expect(pendingButton).toBeDisabled();

    await flushPromise(() => resolveReserve({ success: true, data: ACTIVE_RESERVATION }));

    expect(screen.getByText('Reserved ✓')).toBeInTheDocument();
    // 59s remaining -> banner reads 00:59.
    expect(screen.getByTestId('countdown')).toHaveTextContent('00:59');
    expect(
      screen.getByRole('button', { name: 'Complete purchase for Adidas Yeezy Boost 350' })
    ).toBeEnabled();
  });

  it('parses the raw Postgres expiresAt format exactly as the live server sends it', async () => {
    vi.useFakeTimers();
    // Live server returns "2026-08-29 10:20:15.938+06" (space + bare-hour
    // offset). 10:00:59 +06 == 04:00:59Z.
    vi.setSystemTime(new Date('2026-08-29T04:00:00.000Z'));

    const postgresReservation = {
      ...ACTIVE_RESERVATION,
      expiresAt: '2026-08-29 10:00:59.000+06',
    };

    renderCard({ reservation: postgresReservation });

    expect(screen.getByTestId('countdown')).toHaveTextContent('00:59');
  });
  it('ticks the countdown down every second', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T10:00:00.000Z'));

    renderCard({ reservation: ACTIVE_RESERVATION });

    expect(screen.getByTestId('countdown')).toHaveTextContent('00:59');

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId('countdown')).toHaveTextContent('00:58');

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId('countdown')).toHaveTextContent('00:57');
  });

  it('shows Reservation Expired when the countdown reaches zero (display only — backend stays authoritative)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T10:00:00.000Z'));

    renderCard({ reservation: ACTIVE_RESERVATION });

    act(() => vi.advanceTimersByTime(60_000));

    expect(screen.getByText('Reservation Expired')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete Purchase/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reserve Adidas Yeezy Boost 350' })).toBeEnabled();
  });

  it('shows the server error when reserving an out-of-stock drop', async () => {
    reserveActiveDrop.mockRejectedValue({
      response: { status: 409, data: { message: 'Drop is out of stock' } },
    });

    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Reserve Adidas Yeezy Boost 350' }));

    expect(await screen.findByText('Drop is out of stock')).toBeInTheDocument();
    // Back to the reserve button, ready to retry.
    expect(screen.getByRole('button', { name: 'Reserve Adidas Yeezy Boost 350' })).toBeEnabled();
  });
  it('shows a network error when the reservation request fails', async () => {
    reserveActiveDrop.mockRejectedValue(new Error('Network Error'));

    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Reserve Adidas Yeezy Boost 350' }));

    expect(await screen.findByText(NETWORK_ERROR_TEXT)).toBeInTheDocument();
  });

  it('ignores rapid duplicate clicks while the reserve request is pending', async () => {
    reserveActiveDrop.mockReturnValue(new Promise(() => {})); // never resolves

    renderCard();
    const reserveButton = screen.getByRole('button', { name: 'Reserve Adidas Yeezy Boost 350' });

    // Two clicks inside the same tick, before React re-renders the disabled state.
    fireEvent.click(reserveButton);
    fireEvent.click(reserveButton);
    await act(async () => {});

    expect(reserveActiveDrop).toHaveBeenCalledTimes(1);
    expect(reserveButton).toBeDisabled();
    expect(reserveButton).toHaveAttribute('aria-busy', 'true');
    expect(reserveButton).toHaveTextContent('Reserving...');
  });

  it('keeps other product cards interactive while one card has a pending request', async () => {
    reserveActiveDrop.mockReturnValue(new Promise(() => {})); // never resolves
    const otherDrop = { ...DROP, id: 4, name: 'Nike Dunk Low' };

    const store = configureStore({
      reducer: { drops: dropsReducer, user: userReducer, reservations: reservationsReducer },
      preloadedState: {
        drops: { items: [DROP, otherDrop], loading: false, error: null },
        user: { id: 1 },
        reservations: { byDropId: {} },
      },
    });
    render(
      <Provider store={store}>
        <DropCard drop={DROP} />
        <DropCard drop={otherDrop} />
      </Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reserve Adidas Yeezy Boost 350' }));
    await act(async () => {});

    expect(screen.getByRole('button', { name: 'Reserve Adidas Yeezy Boost 350' })).toBeDisabled();
    // The unrelated card stays usable — pending state is per card, never global.
    expect(
      screen.getByRole('button', { name: 'Reserve Nike Dunk Low' })
    ).toBeEnabled();
  });

  it('runs Complete Purchase -> Processing... -> Purchase Complete', async () => {
    let resolvePurchase;
    apiPurchase.mockReturnValue(
      new Promise((resolve) => {
        resolvePurchase = resolve;
      })
    );

    renderCard({ reservation: ACTIVE_RESERVATION });

    fireEvent.click(
      screen.getByRole('button', { name: 'Complete purchase for Adidas Yeezy Boost 350' })
    );
    const processingButton = screen.getByRole('button', {
      name: 'Complete purchase for Adidas Yeezy Boost 350',
    });
    expect(processingButton).toHaveTextContent('Processing...');
    expect(processingButton).toBeDisabled();

    await flushPromise(() => resolvePurchase({ success: true, data: PURCHASE }));

    expect(screen.getByText('✓ Purchase Complete')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete Purchase/ })).not.toBeInTheDocument();
  });

  it('blocks purchase when the server confirms the reservation expired (410)', async () => {
    apiPurchase.mockRejectedValue({
      response: { status: 410, data: { message: 'Reservation has expired' } },
    });

    renderCard({ reservation: ACTIVE_RESERVATION });

    fireEvent.click(
      screen.getByRole('button', { name: 'Complete purchase for Adidas Yeezy Boost 350' })
    );

    expect(await screen.findByText('Reservation Expired')).toBeInTheDocument();
    expect(screen.getByText('Reservation has expired')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete Purchase/ })).not.toBeInTheDocument();
  });
});

describe('DropCard recent purchasers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders up to three recent purchasers, in server order', () => {
    render(
      <Provider store={makeStore()}>
        <DropCard
          drop={{
            ...DROP,
            recentPurchasers: [
              { username: 'david' },
              { username: 'hasan' },
              { username: 'karim' },
              { username: 'should-be-cut' },
            ],
          }}
        />
      </Provider>
    );

    expect(screen.getByText('Recent purchasers')).toBeInTheDocument();
    const chips = screen.getAllByTestId('recent-purchaser');
    expect(chips.map((chip) => chip.textContent)).toEqual(['david', 'hasan', 'karim']);
    expect(screen.queryByText('should-be-cut')).not.toBeInTheDocument();
  });

  it('shows only the purchasers that exist when fewer than three', () => {
    render(
      <Provider store={makeStore()}>
        <DropCard drop={{ ...DROP, recentPurchasers: [{ username: 'sadia' }] }} />
      </Provider>
    );

    expect(screen.getByText('sadia')).toBeInTheDocument();
    expect(screen.getAllByTestId('recent-purchaser')).toHaveLength(1);
    expect(screen.queryByText('No purchases yet')).not.toBeInTheDocument();
  });

  it('shows an empty state when no purchases exist or the field is missing', () => {
    render(
      <Provider store={makeStore()}>
        <DropCard drop={{ ...DROP, recentPurchasers: [] }} />
      </Provider>
    );

    expect(screen.getByText('No purchases yet')).toBeInTheDocument();
    expect(screen.queryByTestId('recent-purchaser')).not.toBeInTheDocument();

    // Legacy payloads without the field must render the empty state, not crash.
    render(
      <Provider store={makeStore()}>
        <DropCard drop={{ ...DROP, id: 99, name: 'Legacy Drop' }} />
      </Provider>
    );

    expect(screen.getAllByText('No purchases yet')).toHaveLength(2);
  });
});