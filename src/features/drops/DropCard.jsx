import { useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { pushToast } from '../toast/toastSlice';
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
  'w-full rounded-lg bg-gray-900 px-4 py-2.5 font-medium text-white transition-colors hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400';

const PURCHASE_BUTTON_CLASSES =
  'mt-2 w-full rounded-lg bg-emerald-700 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-600';

// Network failures carry no HTTP status — give them a clearer message than
// axios' bare "Network Error".
const NETWORK_ERROR_MESSAGE = 'Network error — please check your connection and try again.';
const SERVER_ERROR_MESSAGE = 'Server error — please try again in a moment.';

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
        aria-busy={purchasing}
        className={PURCHASE_BUTTON_CLASSES}
      >
        {purchasing ? 'Processing...' : 'Complete Purchase'}
      </button>
    </div>
  );
}

function DropCard({ drop }) {
  const dispatch = useAppDispatch();
  const { id, name, price, availableStock } = drop;
  const recentPurchasers = (drop.recentPurchasers ?? [])
    .map((purchaser) => purchaser?.username)
    .filter(Boolean)
    .slice(0, 3);
  const reservation = useAppSelector((state) => state.reservations.byDropId[id]);

  // Transient UI state only — the reservation itself lives in Redux.
  // Inline errors persist until the next action on this card clears them;
  // the toast layer provides the transient feedback.
  const [reserving, setReserving] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  // Ref-based guard against double clicks within the same tick (the disabled
  // attribute alone can be raced by rapid double clicks before re-render).
  const pendingRef = useRef(false);
  const outOfStock = availableStock <= 0;
  const isPurchased = reservation?.status === 'PURCHASED';
  const isExpired = reservation?.status === 'EXPIRED';
  const isActive = reservation?.status === 'ACTIVE';

  async function handleReserve() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setError(null);
    setNotice(null);
    setReserving(true);
    try {
      const result = await dispatch(reserveDrop(id));
      if (reserveDrop.rejected.match(result)) {
        const { status, message } = result.payload ?? {};
        if (status === 0) {
          // Axios never got a response — a network failure, not a server answer.
          setError(NETWORK_ERROR_MESSAGE);
          dispatch(pushToast({ type: 'error', message: NETWORK_ERROR_MESSAGE }));
        } else if (status === 409) {
          setError(message ?? 'This drop is sold out — no pairs left to reserve.');
        } else if (status >= 500) {
          setError(SERVER_ERROR_MESSAGE);
          dispatch(pushToast({ type: 'error', message: SERVER_ERROR_MESSAGE }));
        } else {
          setError(message ?? 'Reservation failed. Please try again.');
        }
      } else {
        dispatch(
          pushToast({
            type: 'success',
            message: `Pair of ${name} reserved — complete your purchase within 1 minute.`,
          })
        );
      }
    } finally {
      setReserving(false);
      pendingRef.current = false;
    }
  }

  async function handlePurchase() {
    if (!reservation || isExpired || isPurchased) return;
    if (pendingRef.current) return;
    pendingRef.current = true;
    setError(null);
    setNotice(null);
    setPurchasing(true);
    try {
      const result = await dispatch(purchaseReservation(reservation.id));
      if (purchaseReservation.rejected.match(result)) {
        const { status, message } = result.payload ?? {};
        if (status === 0) {
          setError(NETWORK_ERROR_MESSAGE);
          dispatch(pushToast({ type: 'error', message: NETWORK_ERROR_MESSAGE }));
        } else if (status === 410) {
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
        } else if (status === 403) {
          setError(message ?? 'Only the shopper who reserved this pair can purchase it.');
        } else if (status === 404) {
          setError(message ?? 'Reservation not found — it may have already been processed.');
        } else if (status >= 500) {
          setError(SERVER_ERROR_MESSAGE);
          dispatch(pushToast({ type: 'error', message: SERVER_ERROR_MESSAGE }));
        } else {
          setError(message ?? 'Purchase failed. Please try again.');
        }
      } else {
        dispatch(
          pushToast({ type: 'success', message: `Purchase complete — enjoy your pair of ${name}!` })
        );
      }
    } finally {
      setPurchasing(false);
      pendingRef.current = false;
    }
  }

  const reserveButton = (
    <button
      type="button"
      onClick={handleReserve}
      disabled={reserving || outOfStock}
      aria-label={`Reserve ${name}`}
      aria-busy={reserving}
      // Out-of-stock reason is exposed via a visually hidden hint so the
      // visible "Out of stock" text stays unique to the stock badge above.
      aria-describedby={outOfStock ? `out-of-stock-hint-${id}` : undefined}
      className={RESERVE_BUTTON_CLASSES}
    >
      {reserving ? 'Reserving...' : 'Reserve'}
    </button>
  );

  return (
    <article
      aria-label={`${name} product card`}
      className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold leading-tight text-gray-900">{name}</h2>
        <span className="shrink-0 text-sm font-medium text-gray-400">#{id}</span>
      </div>

      <p className="text-2xl font-bold text-gray-900">{formatPrice(price)}</p>

      <div className="mt-3 mb-4">
        <span
          aria-label={
            outOfStock
              ? `No stock available for ${name}`
              : `${availableStock} pairs available for ${name}`
          }
          className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${getStockVariant(availableStock)}`}
        >
          {outOfStock ? 'Out of stock' : `${availableStock} available`}
        </span>
        {outOfStock && (
          <span id={`out-of-stock-hint-${id}`} className="sr-only">
            Out of stock — cannot reserve {name}
          </span>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Recent purchasers
        </h3>
        {recentPurchasers.length > 0 ? (
          <ul
            className="mt-1.5 flex flex-wrap gap-1.5"
            aria-label={`Recent purchasers of ${name}: ${recentPurchasers.join(', ')}`}
          >
            {recentPurchasers.map((username, index) => (
              <li
                key={`${username}-${index}`}
                data-testid="recent-purchaser"
                className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
              >
                {username}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-xs italic text-gray-400">No purchases yet</p>
        )}
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
          <p role="status" className="mt-3 text-sm font-medium text-emerald-700">
            {notice}
          </p>
        )}
      </div>
    </article>
  );
}

export default DropCard;