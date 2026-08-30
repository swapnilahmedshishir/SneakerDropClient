import axios from "axios";

// The server (server/src/app.js) mounts drop routes at /api/drops and enables
// CORS, so the client can call it directly from the Vite dev server.
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://sneakerdropserver.onrender.com";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

/**
 * GET /api/drops/active
 * Resolves with the response body: { success: true, data: Drop[] }.
 * Only drops whose startsAt <= now are returned by the server.
 */
export async function getActiveDrops() {
  const response = await apiClient.get("/drops/active");
  return response.data;
}

/**
 * POST /api/drops/:dropId/reserve
 * Creates a 60-second ACTIVE reservation. The response includes the
 * server-assigned `expiresAt`, which the dashboard uses for its countdown —
 * the frontend timer is only a display, never the source of truth.
 */
export async function reserveActiveDrop(dropId, userId) {
  const response = await apiClient.post(`/drops/${dropId}/reserve`, { userId });
  return response.data;
}

/**
 * POST /api/reservations/:reservationId/purchase
 * Completes the purchase while the reservation is still ACTIVE and unexpired.
 * The backend (not the client timer) decides whether it is valid.
 */
export async function purchaseReservation(reservationId, userId) {
  const response = await apiClient.post(
    `/reservations/${reservationId}/purchase`,
    { userId },
  );
  return response.data;
}
