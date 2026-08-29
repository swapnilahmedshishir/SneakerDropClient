import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { clearReservations } from '../reservations/reservationsSlice';
import { setUserId } from '../user/userSlice';

// Matches the seeded users (rahim, karim, john, hasan, david -> ids 1..5).
// Two browsers can pick different shoppers to exercise the multi-user flow.
const SHOPPER_OPTIONS = [1, 2, 3, 4, 5];

function ShopperSelect() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.user.id);

  const handleChange = (event) => {
    dispatch(setUserId(Number(event.target.value)));
    // Reservations belong to the previous shopper — start fresh.
    dispatch(clearReservations());
  };

  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      <span className="font-medium">Shopper:</span>
      <select
        value={userId}
        onChange={handleChange}
        aria-label="Choose shopper"
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
      >
        {SHOPPER_OPTIONS.map((option) => (
          <option key={option} value={option}>
            User {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default ShopperSelect;