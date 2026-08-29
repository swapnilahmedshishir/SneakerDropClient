import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import reservationsReducer, {
  clearReservations,
  markReservationExpired,
  markReservationPurchased,
  purchaseReservation,
  reserveDrop,
} from './reservationsSlice';
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

const RESERVATION = {
  id: 101,
  userId: 1,
  dropId: 3,
  status: 'ACTIVE',
  expiresAt: '2026-08-29T10:20:15.938+06',
};

const PURCHASE = { id: 500, userId: 1, dropId: 3, reservationId: 101 };

function createStore() {
  return configureStore({
    reducer: { user: userReducer, reservations: reservationsReducer },
  });
}

describe('reservationsSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with an empty reservation map', () => {
    const state = createStore().getState().reservations;
    expect(state).toEqual({ byDropId: {} });
  });

  it('stores the reservation returned by the API, keyed by dropId', async () => {
    reserveActiveDrop.mockResolvedValue({ success: true, data: RESERVATION });

    const store = createStore();
    await store.dispatch(reserveDrop(3));

    expect(reserveActiveDrop).toHaveBeenCalledWith(3, store.getState().user.id);
    expect(store.getState().reservations.byDropId[3]).toEqual(RESERVATION);
  });

  it('marks the reservation PURCHASED when a purchase succeeds', async () => {
    apiPurchase.mockResolvedValue({ success: true, data: PURCHASE });
    const store = createStore();
    store.dispatch({ type: 'reservations/reserveDrop/fulfilled', payload: RESERVATION });

    await store.dispatch(purchaseReservation(101));

    expect(apiPurchase).toHaveBeenCalledWith(101, store.getState().user.id);
    expect(store.getState().reservations.byDropId[3].status).toBe('PURCHASED');
  });

  it('flips ACTIVE -> EXPIRED only when the backend confirms (socket event)', () => {
    let state = reservationsReducer(
      { byDropId: { 3: { ...RESERVATION } } },
      markReservationExpired({ dropId: 3 })
    );
    expect(state.byDropId[3].status).toBe('EXPIRED');

    // Already-purchased reservations are left alone.
    state = reservationsReducer(
      { byDropId: { 4: { ...RESERVATION, id: 200, dropId: 4, status: 'PURCHASED' } } },
      markReservationExpired({ dropId: 4 })
    );
    expect(state.byDropId[4].status).toBe('PURCHASED');

    // Unknown drops are ignored.
    state = reservationsReducer(state, markReservationExpired({ dropId: 999 }));
    expect(state.byDropId[999]).toBeUndefined();
  });

  it('marks a reservation PURCHASED on backend confirmation', () => {
    const state = reservationsReducer(
      { byDropId: { 3: { ...RESERVATION } } },
      markReservationPurchased({ dropId: 3 })
    );
    expect(state.byDropId[3].status).toBe('PURCHASED');
  });

  it('clears reservations when the shopper switches', () => {
    const state = reservationsReducer({ byDropId: { 3: RESERVATION } }, clearReservations());
    expect(state.byDropId).toEqual({});
  });

  it('rejects reserve failures with server status + message, without partial state', async () => {
    const axiosError = {
      response: { status: 409, data: { message: 'Drop is out of stock' } },
    };
    reserveActiveDrop.mockRejectedValue(axiosError);

    const store = createStore();
    const result = await store.dispatch(reserveDrop(3));

    expect(result.meta.rejectedWithValue).toBe(true);
    expect(result.payload).toEqual({ status: 409, message: 'Drop is out of stock' });
    expect(store.getState().reservations.byDropId).toEqual({});
  });

  it('rejects purchase failures (e.g. 410 expired) with status + message', async () => {
    apiPurchase.mockRejectedValue({
      response: { status: 410, data: { message: 'Reservation has expired' } },
    });

    const store = createStore();
    const result = await store.dispatch(purchaseReservation(101));

    expect(result.meta.rejectedWithValue).toBe(true);
    expect(result.payload).toEqual({ status: 410, message: 'Reservation has expired' });
  });
});