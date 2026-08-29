import { useEffect } from 'react';
import { useAppDispatch } from '../app/hooks';
import { updateDropStock } from '../features/drops/dropsSlice';
import { markReservationExpired } from '../features/reservations/reservationsSlice';
import { pushToast } from '../features/toast/toastSlice';
import { getSocket } from './socket';

/**
 * Connects to the Socket.io server and keeps the dashboard in sync with the
 * backend:
 *   - `stock_updated`        -> drop stock changes (reservation / expiry)
 *   - `reservation_expired`  -> backend expired a reservation (authoritative)
 * Both update open cards without a page refresh.
 */
export function useStockSocket() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    const handleStockUpdated = (payload) => {
      dispatch(updateDropStock(payload));
    };

    const handleReservationExpired = (payload) => {
      // The backend is the authority on expiry — apply it unconditionally (it
      // is a no-op when this shopper has no cached reservation for the drop).
      // Only raise a toast when it is actually *our* reservation that expired.
      dispatch((innerDispatch, getState) => {
        const reservation = getState().reservations.byDropId[payload.dropId];
        if (reservation?.status === 'ACTIVE') {
          innerDispatch(
            pushToast({
              type: 'error',
              message: 'Your reservation expired before the purchase was completed.',
            })
          );
        }
        innerDispatch(markReservationExpired({ dropId: payload.dropId }));
      });
    };

    socket.on('stock_updated', handleStockUpdated);
    socket.on('reservation_expired', handleReservationExpired);

    return () => {
      socket.off('stock_updated', handleStockUpdated);
      socket.off('reservation_expired', handleReservationExpired);
      socket.disconnect();
    };
  }, [dispatch]);
}
