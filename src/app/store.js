import { configureStore } from '@reduxjs/toolkit';
import dropsReducer from '../features/drops/dropsSlice';
import reservationsReducer from '../features/reservations/reservationsSlice';
import toastReducer from '../features/toast/toastSlice';
import userReducer from '../features/user/userSlice';

export const store = configureStore({
  reducer: {
    drops: dropsReducer,
    reservations: reservationsReducer,
    toast: toastReducer,
    user: userReducer,
  },
});

export default store;

