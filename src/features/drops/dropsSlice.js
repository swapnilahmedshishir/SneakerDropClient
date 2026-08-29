import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getActiveDrops } from '../../services/api';

// Fetch the active drops once per dashboard mount. The server already filters
// out future drops (startsAt > now), so the client only ever displays drops
// that are genuinely live.
export const fetchActiveDrops = createAsyncThunk(
  'drops/fetchActiveDrops',
  async () => {
    const response = await getActiveDrops();
    return response.data; // Drop[]
  }
);

const initialState = {
  items: [],
  loading: false,
  error: null,
};

const dropsSlice = createSlice({
  name: 'drops',
  initialState,
  reducers: {
    // Applied when a `stock_updated` socket event arrives. Only the matching
    // drop is touched — everything else stays exactly as it was.
    updateDropStock: (state, action) => {
      const { dropId, availableStock } = action.payload;
      const stock = Number(availableStock);
      const drop = state.items.find((item) => item.id === dropId);
      if (drop && Number.isFinite(stock)) {
        drop.availableStock = stock;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveDrops.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActiveDrops.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.error = null;
      })
      .addCase(fetchActiveDrops.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error?.message || 'Failed to load active drops';
      });
  },
});

export const { updateDropStock } = dropsSlice.actions;
export default dropsSlice.reducer;
