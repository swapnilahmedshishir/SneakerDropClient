import { createSlice } from '@reduxjs/toolkit';

// The dashboard is a shopper-facing UI without auth (Phase 11). Each browser
// session picks a shopper id, and every reserve/purchase call is made on that
// shopper's behalf. This is genuinely shared application state (every card
// depends on it), so it lives in Redux rather than per-card local state.
const initialState = {
  id: 1,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserId: (state, action) => {
      state.id = Number(action.payload);
    },
  },
});

export const { setUserId } = userSlice.actions;
export default userSlice.reducer;