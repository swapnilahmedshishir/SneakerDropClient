import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  markReservationExpired,
  markReservationPurchased,
  purchaseReservation,
  reserveDrop,
} from '../reservations/reservationsSlice';
import { formatCountdown, useCountdown } from './useCountdown';

function getStockVariant(availableStock) {
  if (availableStock <= 0) return 'bg-red-50 text-red-700 border-red-200';
  if (availableStock <= 3) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function formatPrice(price) {
  return `$${Number(price).toFixed(2)}`;
}

const RESERVE_BUTTON_CLASSES =
  'w-full rounded-lg bg-gray-900 px-4 py-2.5 font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400';

/**
 * The live stage of an ACTIVE reservation: countdown + Complete Purchase.
 * Mounted with key={reservation.id} so the countdown always starts from the
 * server-provided expiresAt. When the timer reaches zero this shows
 * "Reservation Expired" — a pure client display. The server remains the
 * authority; its `reservation_expired` event / a 410 updates the store status.
 */
function ReservationPanel({ reservation, name, purchasing, reserveButton, onPurchase }) {
  const remainingMs = useCountdown(reservation.expiresAt);
  const timerExpired = remainingMs <= 0;

  if (timerExpired) {
    return (
      <div>
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-700">
          Reservation Expired
        </div>
        <p className="mb-3 text-center text-xs text-gray-500">
          Your reservation is no longer valid. You can reserve again if stock allows.
        </p>
        {reserveButton}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
        <span className="text-sm font-semibold text-emerald-800">Reserved ✓</span>
        <span
          data-testid="countdown"
          className="font-mono text-lg font-bold tabular-nums text-emerald-800"
        >
          {formatCountdown(remainingMs)}
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Complete the purchase before the timer ends — the server enforces expiry.
      </p>
      <button
        type="button"
        onClick={onPurchase}
        disabled={purchasing}
        aria-label={`Complete purchase for ${name}`}
        className="mt-2 w-full rounded-lg bg-emerald-700 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-600"
      >
        {purchasing ? 'Processing...' : 'Complete Purchase'}
      </button>
    </div>
  );
}

function DropCard({ drop }) {
  const dispatch = useAppDispatch();
  const { id, name, price, availableStock } = drop;
  const reservation = useAppSelector((state) => state.reservations.byDropId[id]);

  // Transient UI state only — the reservation itself lives in Redux.
  const [reserving, setReserving] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const outOfStock = availableStock <= 0;
  const isActive = reservation?.status === 'ACTIVE';
  const isExpired = reservation?.status === 'EXPIRED';
  const isPurchased = reservation?.status === 'PURCHASED';

  async function handleReserve() {
    setError(null);
    setNotice(null);
    setReserving(true);
    const result = await dispatch(reserveDrop(id));
    setReserving(false);
    if (reserveDrop.rejected.match(result)) {
      setError(result.payload?.message ?? 'Reservation failed. Please try again.');
    }
  }

  async function handlePurchase() {
    if (!reservation || isExpired || isPurchased) return;
    setError(null);
    setNotice(null);
    setPurchasing(true);
    const result = await dispatch(purchaseReservation(reservation.id));
    setPurchasing(false);
    if (purchaseReservation.rejected.match(result)) {
      const { status, message } = result.payload ?? {};
      if (status === 410) {
        // The backend just confirmed the reservation is expired.
        dispatch(markReservationExpired({ dropId: id }));
        setError(message ?? 'Reservation has expired.');
      } else if (
        status === 409 &&
        typeof message === 'string' &&
        message.toLowerCase().includes('already been purchased')
      ) {
        dispatch(markReservationPurchased({ dropId: id }));
        setNotice('This pair was already purchased for this reservation.');
      } else {
        setError(message ?? 'Purchase failed. Please try again.');
      }
    }
  }

  const reserveButton = (
    <button
      type="button"
      onClick={handleReserve}
      disabled={reserving || outOfStock}
      aria-label={`Reserve ${name}`}
      className={RESERVE_BUTTON_CLASSES}
    >
      {reserving ? 'Reserving...' : 'Reserve'}
    </button>
  );

  return (
    <article className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold leading-tight text-gray-900">{name}</h2>
        <span className="shrink-0 text-sm font-medium text-gray-400">#{id}</span>
      </div>

      <p className="text-2xl font-bold text-gray-900">{formatPrice(price)}</p>

      <div className="mt-3 mb-6">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${getStockVariant(availableStock)}`}
        >
          {outOfStock ? 'Out of stock' : `${availableStock} available`}
        </span>
      </div>

      <div className="mt-auto">
        {isPurchased ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center text-sm font-semibold text-emerald-800">
            ✓ Purchase Complete
          </div>
        ) : isExpired ? (
          <div>
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-700">
              Reservation Expired
            </div>
            <p className="mb-3 text-center text-xs text-gray-500">
              Your reservation is no longer valid. You can reserve again if stock allows.
            </p>
            {reserveButton}
          </div>
        ) : isActive ? (
          <ReservationPanel
            key={reservation.id}
            reservation={reservation}
            name={name}
            purchasing={purchasing}
            reserveButton={reserveButton}
            onPurchase={handlePurchase}
          />
        ) : (
          reserveButton
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-3 text-sm font-medium text-emerald-700">{notice}</p>
        )}
      </div>
    </article>
  );
}

export default DropCard;