import { useEffect } from 'react';
import { useAppDispatch } from '../app/hooks';
import { updateDropStock } from '../features/drops/dropsSlice';
import { getSocket } from './socket';

/**
 * Connects to the Socket.io server and keeps the dashboard in sync with the
 * backend. The server broadcasts `stock_updated` ({ dropId, availableStock })
 * whenever a drop's available stock changes (reservation created / expired),
 * so open cards update without a page refresh.
 */
export function useStockSocket() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    const handleStockUpdated = (payload) => {
      dispatch(updateDropStock(payload));
    };

    socket.on('stock_updated', handleStockUpdated);

    return () => {
      socket.off('stock_updated', handleStockUpdated);
      socket.disconnect();
    };
  }, [dispatch]);
}