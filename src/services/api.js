import axios from 'axios';

// The server (server/src/app.js) mounts drop routes at /api/drops and enables
// CORS, so the client can call it directly from the Vite dev server.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * GET /api/drops/active
 * Resolves with the response body: { success: true, data: Drop[] }.
 * Only drops whose startsAt <= now are returned by the server.
 */
export async function getActiveDrops() {
  const response = await apiClient.get('/drops/active');
  return response.data;
}