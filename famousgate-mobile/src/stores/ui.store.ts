import { create } from 'zustand';

interface UIState {
  isOnline: boolean;
  pendingSyncCount: number;
  setOnline: (online: boolean) => void;
  setPendingSyncCount: (count: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isOnline: true,
  pendingSyncCount: 0,
  setOnline: (online) => set({ isOnline: online }),
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
}));
