# Sneaker Drop — Frontend (`client`)

React dashboard for the **Limited Edition Sneaker Drop** assessment: browse active drops, reserve a pair for 60 seconds, complete the purchase before it expires, and watch stock update in real time — no page refreshes.

---

## Tech Stack

| Concern            | Library                                     |
| ------------------ | ------------------------------------------- |
| UI                 | React 19 + Vite 8                           |
| Server / app state | Redux Toolkit + React Redux                 |
| Styling            | Tailwind CSS 4 (via `@tailwindcss/postcss`) |
| HTTP               | Axios                                       |
| Realtime           | socket.io-client                            |
| Testing            | Vitest + Testing Library (jsdom)            |
| Linting            | oxlint                                      |

---

## Features

- **Active-drops dashboard** — `GET /api/drops/active` (the server already filters future drops), rendered as a responsive product-card grid with loading, error (with retry), and empty states.
- **Product cards** — name, price, stock badge (green / amber ≤ 3 / red when sold out), Reserve button, reservation state, per-drop **Recent purchasers** feed (top 3, newest first, with an empty state), and purchase action.
- **Reserve → countdown → purchase flow** — `Reserve` → `Reserving...` → `Reserved ✓`, a live `00:59`-style countdown driven by the **server-provided `expiresAt`**, then `Complete Purchase` → `Processing...` → `Purchase Complete`.
- **Realtime sync** — `stock_updated` and `reservation_expired` socket events update open cards instantly; disconnect/reconnect is handled by socket.io.
- **Shopper switcher** — pick User 1–5 (the seeded users) so two browser windows can exercise the multi-user flow; switching clears the previous shopper's cached reservations.
- **Toast notifications** — bounded stack (max 4) for success/error feedback on top of inline card errors.
- **Duplicate-click protection** — buttons are disabled while pending, plus a ref-based guard that closes the double-click race before re-render.
- **Accessibility** — meaningful `aria-label`s, `aria-busy` on pending buttons, `role="alert"`/`role="status"` feedback, and visually hidden out-of-stock hints.

### State correctness principles

The backend/PostgreSQL is the **only** source of truth. Redux is a read-only mirror of it:

- The countdown is **display-only**. When it hits zero the card shows _"Reservation Expired"_, but the store status only flips on backend confirmation — a `reservation_expired` socket event or a `410` from the purchase API.
- The expiry time is never computed from the local click time; it comes from the server response (Postgres timestamps are normalized so every browser parses them reliably).
- Sockets never modify business state — the flow is always _HTTP → DB transaction → commit → broadcast → UI update_.

---

## Project Structure

```
client/
├── index.html
├── vite.config.js               # Vite + React plugin
├── vitest.config.js             # jsdom, globals, setup file
├── tailwind.config.js / postcss.config.js
└── src/
    ├── main.jsx                 # StrictMode + <Provider store>
    ├── App.jsx                  # → DropsDashboard
    ├── app/
    │   ├── store.js             # configureStore: drops, reservations, toast, user
    │   └── hooks.js             # useAppDispatch / useAppSelector
    ├── features/
    │   ├── drops/
    │   │   ├── DropsDashboard.jsx    # header, shopper picker, loading/error/empty/grid
    │   │   ├── DropCard.jsx          # card: stock badge, reserve/purchase, feed, errors
    │   │   ├── ShopperSelect.jsx     # User 1–5 switcher
    │   │   ├── dropsSlice.js         # fetchActiveDrops + updateDropStock (socket-driven)
    │   │   └── useCountdown.js       # ticks down to server expiresAt
    │   ├── reservations/
    │   │   └── reservationsSlice.js  # reserve/purchase thunks, keyed by dropId
    │   ├── toast/
    │   │   ├── toastSlice.js         # bounded toast stack (max 4)
    │   │   └── ToastContainer.jsx    # auto-dismiss view layer
    │   └── user/
    │       └── userSlice.js          # active shopper id (no auth — assessment scope)
    ├── services/
    │   ├── api.js                    # axios client + endpoint helpers
    │   └── errors.js                 # HTTP status / message extraction
    ├── sockets/
    │   ├── socket.js                 # lazily-created socket.io singleton
    │   └── useStockSocket.js         # event → dispatch wiring (connect/disconnect)
    └── test/
        └── setup.js                  # @testing-library/jest-dom
```

**Redux slices**

| Slice          | State                             | Responsibility                                                                |
| -------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| `drops`        | `items`, `loading`, `error`       | Fetch active drops; apply `stock_updated` payloads to the matching drop       |
| `reservations` | `byDropId` (dropId → reservation) | Reserve/purchase results; backend-confirmed `EXPIRED`/`PURCHASED` transitions |
| `toast`        | `items` (max 4)                   | Cross-cutting success/error feedback                                          |
| `user`         | `id`                              | Active shopper for every reserve/purchase call                                |

Transient UI state (button spinners, inline messages, countdown ticks) intentionally stays in component state.

---

## Realtime Events

`useStockSocket` connects once per page load (lazy singleton) inside the dashboard and cleans up on unmount.

| Event                 | Payload                      | Client behavior                                                                                                  |
| --------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `stock_updated`       | `{ dropId, availableStock }` | Updates that drop's stock badge — all windows stay in sync without refresh                                       |
| `reservation_expired` | `{ dropId }`                 | Marks the cached reservation `EXPIRED` (authoritative); raises a toast only if it was this shopper's reservation |

The server only emits after its database transaction commits, so the UI never displays uncommitted state.

---

## API Usage

Base URL: `VITE_API_URL` (defaults to `http://localhost:5000/api`).

| Helper                                       | Endpoint                                     | Purpose                                                                            |
| -------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `getActiveDrops()`                           | `GET /drops/active`                          | Drops with stock + per-drop `recentPurchasers`                                     |
| `reserveActiveDrop(dropId, userId)`          | `POST /drops/:dropId/reserve`                | Creates a 60s `ACTIVE` reservation; response carries the authoritative `expiresAt` |
| `purchaseReservation(reservationId, userId)` | `POST /reservations/:reservationId/purchase` | Completes the purchase while the reservation is still valid                        |

**HTTP status → UI behavior** (from `DropCard`):

| Status                         | Meaning                       | UI response                                              |
| ------------------------------ | ----------------------------- | -------------------------------------------------------- |
| `409` (reserve)                | Sold out / conflict           | Inline "sold out" error on the card                      |
| `410` (purchase)               | Reservation expired           | Reservation flipped to `EXPIRED`, inline error           |
| `409` "already been purchased" | Duplicate purchase            | Reservation flipped to `PURCHASED`, informational notice |
| `403`                          | Not the reserving shopper     | Inline error                                             |
| `404`                          | Reservation missing/processed | Inline error                                             |
| `5xx`                          | Server error                  | Inline error + toast                                     |
| No response (`status 0`)       | Network failure               | Clearer message than axios' "Network Error" + toast      |

---

## Getting Started

### Prerequisites

- **Node.js 20.19+** (Vite 8 requirement; 22 LTS recommended)

### Install & run

```bash
cd client
npm install

# create .env (see below), then:
npm run dev          # Vite dev server → http://localhost:5173
```

### Environment variables

Copy to `client/.env` (only non-secret values live here — everything prefixed `VITE_` is embedded in the browser bundle):

```env
VITE_API_URL="http://localhost:5000/api"
VITE_SOCKET_URL="http://localhost:5000"
```

Both variables fall back to `localhost:5000` if omitted. In production they must point at the deployed backend, and the backend's `CLIENT_URL`/CORS must allow this app's origin.

### Scripts

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Vite dev server with HMR           |
| `npm run build`   | Production build to `dist/`        |
| `npm run preview` | Serve the production build locally |
| `npm test`        | Vitest suite (run once)            |
| `npm run lint`    | oxlint                             |

---

## Testing

Vitest runs in jsdom with Testing Library; network and socket layers are mocked so suites stay deterministic.

| Suite                       | Covers                                                                                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App.test.jsx`              | Full dashboard integration with a fake socket: rendering active drops, reserve → countdown → purchase flows, realtime `stock_updated` / `reservation_expired` handling, error feedback |
| `DropCard.test.jsx`         | Card states: in-stock, out-of-stock, reserved, expired, purchased, purchaser feed                                                                                                      |
| `dropsSlice.test.js`        | Fetch lifecycle (pending/fulfilled/rejected), `updateDropStock`                                                                                                                        |
| `reservationsSlice.test.js` | Reserve/purchase thunks, expiry/purchased transitions, shopper switch reset                                                                                                            |
| `toastSlice.test.js`        | Push/dismiss, max-stack bound                                                                                                                                                          |
| `ToastContainer.test.jsx`   | Toast rendering and auto-dismiss                                                                                                                                                       |

---

## Deployment (Vercel)

1. Import the `client` folder as a Vercel project — framework preset **Vite**.
2. Build command `npm run build`, output directory `dist` (auto-detected).
3. Set `VITE_API_URL` and `VITE_SOCKET_URL` to the production backend URL in Project → Settings → Environment Variables.
4. Ensure the backend is deployed to a **persistent** Node runtime (Render/Railway/Fly.io — not serverless) so Socket.io connections and the expiration worker work, and that its CORS allows the Vercel domain.
