import { configureStore } from '@reduxjs/toolkit';
import dropsReducer from '../features/drops/dropsSlice';
import reservationsReducer from '../features/reservations/reservationsSlice';
import userReducer from '../features/user/userSlice';

export const store = configureStore({
  reducer: {
    drops: dropsReducer,
    reservations: reservationsReducer,
    user: userReducer,
  },
});

export default store;
