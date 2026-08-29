import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useStockSocket } from '../../sockets/useStockSocket';
import { fetchActiveDrops } from './dropsSlice';
import DropCard from './DropCard';
import ShopperSelect from './ShopperSelect';
import ToastContainer from '../toast/ToastContainer';


function DropsDashboard() {
  const dispatch = useAppDispatch();
  const { items, loading, error } = useAppSelector((state) => state.drops);

  useStockSocket();

  useEffect(() => {
    dispatch(fetchActiveDrops());
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Limited Edition Sneaker Drop
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Live active drops — stock updates in real time.
            </p>
          </div>
          <ShopperSelect />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {loading && (
          <div
            data-testid="drops-loading"
            role="status"
            className="flex flex-col items-center justify-center py-24 text-gray-500"
          >
            <span
              aria-hidden="true"
              className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900"
            />
            <span className="mt-4 text-sm font-medium">Loading active drops…</span>
          </div>
        )}

        {!loading && error && (
          <div
            data-testid="drops-error"
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center"
          >
            <p className="text-sm font-semibold text-red-700">Failed to load drops: {error}</p>
            <button
              type="button"
              onClick={() => dispatch(fetchActiveDrops())}
              className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
            >
              Try again
            </button>
          </div>
        )}


        {!loading && !error && items.length === 0 && (
          <div className="py-24 text-center text-gray-500">
            <p className="text-sm font-medium">No active drops right now. Check back soon!</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div data-testid="drops-grid" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((drop) => (
              <DropCard key={drop.id} drop={drop} />
            ))}
          </div>
        )}
      </main>

      {/* Transient global feedback (success / error toasts). */}
      <ToastContainer />
    </div>
  );
}

export default DropsDashboard;