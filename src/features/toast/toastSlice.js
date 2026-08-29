import { createSlice, nanoid } from '@reduxjs/toolkit';

/**
 * Cross-cutting user feedback (toasts) as application state: any component or
 * socket handler can raise one, so it belongs in the store rather than in one
 * card's local state. Auto-dismiss timing is a view concern — it lives in
 * <ToastContainer /> so tests and logic stay simple here.
 */
const MAX_TOASTS = 4;

const initialState = {
  items: [],
};

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    pushToast: {
      reducer(state, action) {
        state.items.push(action.payload);
        // Keep the stack bounded — oldest feedback drops off first.
        if (state.items.length > MAX_TOASTS) {
          state.items.splice(0, state.items.length - MAX_TOASTS);
        }
      },
      prepare({ type = 'info', message }) {
        return { payload: { id: nanoid(), type, message } };
      },
    },
    dismissToast(state, action) {
      state.items = state.items.filter((toast) => toast.id !== action.payload);
    },
  },
});

export const { pushToast, dismissToast } = toastSlice.actions;
export default toastSlice.reducer;
