function getStockVariant(availableStock) {
  if (availableStock <= 0) return 'bg-red-50 text-red-700 border-red-200';
  if (availableStock <= 3) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function formatPrice(price) {
  return `$${Number(price).toFixed(2)}`;
}

function DropCard({ drop }) {
  const { id, name, price, availableStock } = drop;
  const outOfStock = availableStock <= 0;

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

      {/* Reserve flow (timer + confirmation) ships in a later phase. */}
      <button
        type="button"
        disabled={outOfStock}
        aria-label={`Reserve ${name}`}
        className="mt-auto w-full rounded-lg bg-gray-900 px-4 py-2.5 font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
      >
        Reserve
      </button>
    </article>
  );
}

export default DropCard;