import { create } from 'zustand';

interface LegalGateState {
  isOpen: boolean;
  resolver: ((accepted: boolean) => void) | null;
  request: () => Promise<boolean>;
  resolve: (accepted: boolean) => void;
}

// Global store so any page can await current-Terms acceptance from the
// signed-in user without prop-drilling a modal through every route. A
// single <LegalGateModal /> (rendered once in App.tsx) reacts to isOpen.
export const useLegalGateStore = create<LegalGateState>((set, get) => ({
  isOpen: false,
  resolver: null,
  request: () =>
    new Promise<boolean>((resolve) => {
      set({ isOpen: true, resolver: resolve });
    }),
  resolve: (accepted) => {
    const { resolver } = get();
    set({ isOpen: false, resolver: null });
    resolver?.(accepted);
  },
}));
