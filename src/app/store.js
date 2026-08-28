import { configureStore } from '@reduxjs/toolkit';
import dropsReducer from '../features/drops/dropsSlice';

export const store = configureStore({
  reducer: {
    drops: dropsReducer,
  },
});

export default store;
