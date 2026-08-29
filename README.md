# SneakerDropClient

React 19 + Vite + Redux Toolkit + Tailwind CSS 4 dashboard for the Limited Edition Sneaker Drop assessment, with live stock/expiry updates over socket.io-client.

- Active-drops dashboard with reserve → countdown → purchase flow
- Realtime `stock_updated` / `reservation_expired` handling (no refresh needed)
- Shopper switcher and toast notifications
- Vitest + Testing Library suites (`npm test`), oxlint (`npm run lint`), Vite build (`npm run build`)

👉 **Full assessment documentation:** see the [root README](../README.md) (architecture, concurrency strategy, schema, API reference, setup).

