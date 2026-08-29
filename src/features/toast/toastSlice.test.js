import { describe, it, expect } from 'vitest';
import toastReducer, { pushToast, dismissToast } from './toastSlice';

describe('toastSlice', () => {
  it('pushes a toast with a generated id, defaulting to the info type', () => {
    const state = toastReducer(undefined, pushToast({ message: 'Hello' }));

    expect(state.items).toHaveLength(1);
    expect(state.items[0].message).toBe('Hello');
    expect(state.items[0].type).toBe('info');
    expect(state.items[0].id).toBeTruthy();
  });

  it('keeps the success and error types when provided', () => {
    let state = toastReducer(undefined, pushToast({ type: 'success', message: 'Nice' }));
    state = toastReducer(state, pushToast({ type: 'error', message: 'Bad' }));

    expect(state.items.map((toast) => toast.type)).toEqual(['success', 'error']);
  });

  it('dismisses a toast by id, leaving the others untouched', () => {
    let state = toastReducer(undefined, pushToast({ type: 'error', message: 'First' }));
    state = toastReducer(state, pushToast({ type: 'success', message: 'Second' }));
    const firstId = state.items[0].id;

    state = toastReducer(state, dismissToast(firstId));

    expect(state.items).toHaveLength(1);
    expect(state.items[0].message).toBe('Second');
  });

  it('caps the stack so feedback cannot pile up unbounded', () => {
    let state;
    for (let i = 0; i < 6; i += 1) {
      state = toastReducer(state, pushToast({ type: 'error', message: `toast-${i}` }));
    }

    expect(state.items).toHaveLength(4);
    // The oldest toasts drop off first.
    expect(state.items.map((toast) => toast.message)).toEqual([
      'toast-2',
      'toast-3',
      'toast-4',
      'toast-5',
    ]);
  });
});
