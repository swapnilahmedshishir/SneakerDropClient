import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [],
  loading: false,
  error: null,
};

const dropsSlice = createSlice({
  name: 'drops',
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
    },
    setDrops: (state, action) => {
      state.items = action.payload;
      state.loading = false;
      state.error = null;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    updateDropStock: (state, action) => {
      const { dropId, availableStock } = action.payload;
      const drop = state.items.find(d => d.id === dropId);
      if (drop) {
        drop.availableStock = availableStock;
      }
    },
  },
});

export const { setLoading, setDrops, setError, updateDropStock } = dropsSlice.actions;
export default dropsSlice.reducer;
