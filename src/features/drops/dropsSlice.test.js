import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import dropsReducer, { fetchActiveDrops, updateDropStock } from './dropsSlice';
import { getActiveDrops } from '../../services/api';

vi.mock('../../services/api', () => ({
  getActiveDrops: vi.fn(),
  apiClient: {},
}));

const ACTIVE_DROP = {
  id: 1,
  name: 'Air Jordan 1',
  price: 200,
  totalStock: 5,
  availableStock: 5,
  startsAt: '2026-08-29T00:00:00.000Z',
};

const FUTURE_DROP = {
  id: 2,
  name: 'Nike Dunk Low',
  price: 150,
  totalStock: 10,
  availableStock: 10,
  startsAt: '2099-01-01T00:00:00.000Z',
};

function createStore() {
  return configureStore({ reducer: { drops: dropsReducer } });
}

describe('dropsSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts idle: empty items, no loading, no error', () => {
    const state = createStore().getState().drops;
    expect(state).toEqual({ items: [], loading: false, error: null });
  });

  it('sets loading while the active-drops request is pending', async () => {
    let resolveRequest;
    getActiveDrops.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    const store = createStore();
    const pending = store.dispatch(fetchActiveDrops());

    expect(store.getState().drops.loading).toBe(true);
    expect(store.getState().drops.error).toBeNull();

    resolveRequest({ success: true, data: [ACTIVE_DROP] });
    await pending;

    expect(store.getState().drops.loading).toBe(false);
  });

  it('stores the active drops returned by the API on success', async () => {
    getActiveDrops.mockResolvedValue({ success: true, data: [ACTIVE_DROP] });

    const store = createStore();
    await store.dispatch(fetchActiveDrops());

    const { drops } = store.getState();
    expect(drops.loading).toBe(false);
    expect(drops.error).toBeNull();
    expect(drops.items).toEqual([ACTIVE_DROP]);
  });

  it('only contains whatever /api/drops/active returns — future drops never appear', async () => {
    // The server filters future drops out of this endpoint; the dashboard
    // renders exactly that response, so a future drop cannot reach state.
    getActiveDrops.mockResolvedValue({ success: true, data: [ACTIVE_DROP] });

    const store = createStore();
    await store.dispatch(fetchActiveDrops());

    const names = store.getState().drops.items.map((drop) => drop.name);
    expect(names).toContain(ACTIVE_DROP.name);
    expect(names).not.toContain(FUTURE_DROP.name);
  });

  it('records the error message when the API call fails', async () => {
    getActiveDrops.mockRejectedValue(new Error('Network Error'));

    const store = createStore();
    await store.dispatch(fetchActiveDrops());

    const { drops } = store.getState();
    expect(drops.loading).toBe(false);
    expect(drops.items).toEqual([]);
    expect(drops.error).toBe('Network Error');
  });

  it('updates only the matching drop on a stock_updated event', () => {
    let state = dropsReducer(
      { items: [{ ...ACTIVE_DROP }], loading: false, error: null },
      updateDropStock({ dropId: 1, availableStock: 3 })
    );
    expect(state.items[0].availableStock).toBe(3);

    // Two drops in state; the event must touch only the targeted one.
    state = dropsReducer(
      { items: [{ ...ACTIVE_DROP }, { ...FUTURE_DROP, availableStock: 10 }], loading: false, error: null },
      updateDropStock({ dropId: 2, availableStock: 0 })
    );
    expect(state.items[0].availableStock).toBe(5);
    expect(state.items[1].availableStock).toBe(0);

    // Unknown ids are ignored entirely.
    state = dropsReducer(state, updateDropStock({ dropId: 999, availableStock: 1 }));
    expect(state.items).toHaveLength(2);
  });
});