import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import App from './App';
import dropsReducer from './features/drops/dropsSlice';
import reservationsReducer from './features/reservations/reservationsSlice';
import userReducer from './features/user/userSlice';
import { getActiveDrops } from './services/api';
import { getSocket } from './sockets/socket';

vi.mock('./services/api', () => ({
  getActiveDrops: vi.fn(),
  reserveActiveDrop: vi.fn(),
  purchaseReservation: vi.fn(),
  apiClient: {},
}));

vi.mock('./sockets/socket', () => ({
  getSocket: vi.fn(),
}));

function createFakeSocket() {
  const handlers = {};
  const fake = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    off: vi.fn(),
    on: vi.fn((event, handler) => {
      handlers[event] = handler;
    }),
    emitStockUpdated(payload) {
      handlers.stock_updated?.(payload);
    },
    emitReservationExpired(payload) {
      handlers.reservation_expired?.(payload);
    },
  };
  return fake;
}

const ACTIVE_DROPS = [
  {
    id: 1,
    name: 'Air Jordan 1',
    price: 200,
    totalStock: 5,
    availableStock: 5,
    startsAt: '2026-08-29T00:00:00.000Z',
    recentPurchasers: [{ username: 'david' }, { username: 'hasan' }, { username: 'karim' }],
  },
  {
    id: 2,
    name: 'Adidas Yeezy Boost 350',
    price: 220,
    totalStock: 3,
    availableStock: 1,
    startsAt: '2026-08-29T00:00:00.000Z',
    recentPurchasers: [],
  },
];

function renderApp(preloadedState) {
  const store = configureStore({
    reducer: {
      drops: dropsReducer,
      reservations: reservationsReducer,
      user: userReducer,
    },
    preloadedState,
  });
  return render(
    <Provider store={store}>
      <App />
    </Provider>
  );
}

describe('Active drops dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const fake = createFakeSocket();
    getSocket.mockReturnValue(fake);
  });

  it('shows a loading state while active drops are being fetched', async () => {
    let resolveRequest;
    getActiveDrops.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    renderApp();

    expect(screen.getByTestId('drops-loading')).toBeInTheDocument();

    resolveRequest({ success: true, data: [] });
    await waitFor(() =>
      expect(screen.queryByTestId('drops-loading')).not.toBeInTheDocument()
    );
  });

  it('renders each active drop with its name, price and stock', async () => {
    getActiveDrops.mockResolvedValue({ success: true, data: ACTIVE_DROPS });

    renderApp();

    expect(await screen.findByText('Air Jordan 1')).toBeInTheDocument();
    expect(screen.getByText('Adidas Yeezy Boost 350')).toBeInTheDocument();
    expect(screen.getByText('$200.00')).toBeInTheDocument();
    expect(screen.getByText('$220.00')).toBeInTheDocument();
    expect(screen.getByText('5 available')).toBeInTheDocument();
    expect(screen.getByText('1 available')).toBeInTheDocument();

    // Every card exposes a reserve button.
    expect(screen.getAllByRole('button', { name: /Reserve/ })).toHaveLength(2);
  });

  it('does not render future drops — only what /api/drops/active returns', async () => {
    getActiveDrops.mockResolvedValue({ success: true, data: ACTIVE_DROPS });

    renderApp();
    await screen.findByText('Air Jordan 1');

    // "Nike Dunk Low" is the seeded future drop; it should never show up.
    expect(screen.queryByText(/Nike Dunk Low/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/future/i)).not.toBeInTheDocument();
  });

  it('renders the API error state with a retry button', async () => {
    getActiveDrops.mockRejectedValue(new Error('Network Error'));

    renderApp();

    const errorBox = await screen.findByTestId('drops-error');
    expect(errorBox).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Network Error');
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('updates a card in real time when stock_updated arrives over the socket', async () => {
    const fake = getSocket();
    getActiveDrops.mockResolvedValue({ success: true, data: [ACTIVE_DROPS[0]] });

    renderApp();

    await screen.findByText('5 available');

    // Another shopper reserves a pair -> the server broadcasts new stock.
    act(() => {
      fake.emitStockUpdated({ dropId: 1, availableStock: 2 });
    });
    await waitFor(() => expect(screen.getByText('2 available')).toBeInTheDocument());
    expect(screen.queryByText('5 available')).not.toBeInTheDocument();

    // Stock hits zero -> card flips to its out-of-stock state, no refresh.
    act(() => {
      fake.emitStockUpdated({ dropId: 1, availableStock: 0 });
    });
    await waitFor(() => expect(screen.getByText('Out of stock')).toBeInTheDocument());
    expect(screen.queryByText('0 available')).not.toBeInTheDocument();
  });

  it('connects the socket, then unsubscribes and disconnects on unmount', async () => {
    const fake = getSocket();
    getActiveDrops.mockResolvedValue({ success: true, data: [ACTIVE_DROPS[0]] });

    const view = renderApp();
    await screen.findByText('Air Jordan 1');

    expect(fake.connect).toHaveBeenCalledTimes(1);
    expect(fake.on).toHaveBeenCalledWith('stock_updated', expect.any(Function));
    expect(fake.on).toHaveBeenCalledWith('reservation_expired', expect.any(Function));

    view.unmount();

    expect(fake.off).toHaveBeenCalledWith('stock_updated', expect.any(Function));
    expect(fake.off).toHaveBeenCalledWith('reservation_expired', expect.any(Function));
    expect(fake.disconnect).toHaveBeenCalledTimes(1);
  });

  it('shows Reservation Expired when the backend broadcasts reservation_expired', async () => {
    const fake = getSocket();
    getActiveDrops.mockResolvedValue({ success: true, data: [ACTIVE_DROPS[0]] });

    // Preloaded active reservation for shopper 1 on drop 1; expiresAt is
    // relative to now so the card is comfortably inside its countdown.
    renderApp({
      drops: { items: [ACTIVE_DROPS[0]], loading: false, error: null },
      user: { id: 1 },
      reservations: {
        byDropId: {
          1: {
            id: 5,
            dropId: 1,
            userId: 1,
            status: 'ACTIVE',
            expiresAt: new Date(Date.now() + 59_000).toISOString(),
          },
        },
      },
    });

    expect(await screen.findByText('Reserved ✓')).toBeInTheDocument();

    // Backend (expiration worker) expired the reservation -> socket event.
    act(() => {
      fake.emitReservationExpired({ reservationId: 5, dropId: 1 });
    });

    expect(await screen.findByText('Reservation Expired')).toBeInTheDocument();
    expect(screen.queryByText('Reserved ✓')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete Purchase/ })).not.toBeInTheDocument();
  });

  it('lets a shopper pick a different user in the header control', async () => {
    getActiveDrops.mockResolvedValue({ success: true, data: ACTIVE_DROPS });

    renderApp();
    await screen.findByText('Air Jordan 1');

    const select = screen.getByRole('combobox', { name: 'Choose shopper' });
    expect(select).toHaveValue('1');

    fireEvent.change(select, { target: { value: '2' } });
    expect(select).toHaveValue('2');
  });

  it('shows each drop recent purchasers, capped at 3, with an empty state when none exist', async () => {
    getActiveDrops.mockResolvedValue({ success: true, data: ACTIVE_DROPS });

    renderApp();
    await screen.findByText('Air Jordan 1');

    // Drop 1: the server's top 3, in order.
    const purchaserChips = screen.getAllByTestId('recent-purchaser');
    expect(purchaserChips.map((chip) => chip.textContent)).toEqual(['david', 'hasan', 'karim']);

    // Drop 2 has no purchases -> empty state, not chips.
    expect(screen.getByText('No purchases yet')).toBeInTheDocument();
  });
});