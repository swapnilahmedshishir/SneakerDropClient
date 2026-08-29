import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  purchaseReservation as apiPurchaseReservation,
  reserveActiveDrop,
} from '../../services/api';
import { getErrorMessage, getErrorStatus } from '../../services/errors';

/**
 * POST /api/drops/:dropId/reserve for the active shopper.
 * The server responds with the reservation and its authoritative `expiresAt`.
 */
export const reserveDrop = createAsyncThunk(
  'reservations/reserveDrop',
  async (dropId, { getState, rejectWithValue }) => {
    try {
      const { user } = getState();
      const response = await reserveActiveDrop(dropId, user.id);
      return response.data; // reservation
    } catch (err) {
      return rejectWithValue({
        status: getErrorStatus(err),
        message: getErrorMessage(err, 'Reservation failed. Please try again.'),
      });
    }
  }
);

/**
 * POST /api/reservations/:reservationId/purchase for the active shopper.
 * The backend decides validity — the client timer is never the authority.
 */
export const purchaseReservation = createAsyncThunk(
  'reservations/purchaseReservation',
  async (reservationId, { getState, rejectWithValue }) => {
    try {
      const { user } = getState();
      const response = await apiPurchaseReservation(reservationId, user.id);
      return response.data; // purchase
    } catch (err) {
      return rejectWithValue({
        status: getErrorStatus(err),
        message: getErrorMessage(err, 'Purchase failed. Please try again.'),
      });
    }
  }
);

const initialState = {
  // dropId -> reservation of the active shopper (server / application state).
  byDropId: {},
};

const reservationsSlice = createSlice({
  name: 'reservations',
  initialState,
  reducers: {
    // Backend-confirmed expiry: applied from the `reservation_expired` socket
    // event or a 410 from the purchase API. The client never flips this from
    // the countdown alone.
    markReservationExpired: (state, action) => {
      const { dropId } = action.payload;
      const reservation = state.byDropId[dropId];
      if (reservation && reservation.status === 'ACTIVE') {
        reservation.status = 'EXPIRED';
      }
    },
    // Backend-confirmed purchase: used when the API reports the reservation was
    // already purchased (e.g. two tabs completed it at the same time).
    markReservationPurchased: (state, action) => {
      const { dropId } = action.payload;
      const reservation = state.byDropId[dropId];
      if (reservation) {
        reservation.status = 'PURCHASED';
      }
    },
    // Switching shopper invalidates the previous shopper's reservations.
    clearReservations: (state) => {
      state.byDropId = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(reserveDrop.fulfilled, (state, action) => {
        const reservation = action.payload;
        state.byDropId[reservation.dropId] = reservation;
      })
      .addCase(purchaseReservation.fulfilled, (state, action) => {
        const purchase = action.payload;
        const reservation = state.byDropId[purchase.dropId];
        if (reservation) {
          reservation.status = 'PURCHASED';
        } else {
          // Fallback: purchase succeeded for a drop we no longer have cached.
          state.byDropId[purchase.dropId] = {
            id: purchase.reservationId,
            dropId: purchase.dropId,
            userId: purchase.userId,
            status: 'PURCHASED',
          };
        }
      });
  },
});

export const { markReservationExpired, markReservationPurchased, clearReservations } =
  reservationsSlice.actions;
export default reservationsSlice.reducer;