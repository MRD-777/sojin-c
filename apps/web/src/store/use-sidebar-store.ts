import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  isSecondarySidebarOpen: boolean;
  activePrimaryItem: string | null;
  toggleSecondarySidebar: () => void;
  setSecondarySidebarOpen: (isOpen: boolean) => void;
  setActivePrimaryItem: (item: string) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isSecondarySidebarOpen: true,
      activePrimaryItem: 'dashboard',
      toggleSecondarySidebar: () =>
        set((state) => ({ isSecondarySidebarOpen: !state.isSecondarySidebarOpen })),
      setSecondarySidebarOpen: (isOpen) =>
        set({ isSecondarySidebarOpen: isOpen }),
      setActivePrimaryItem: (item) =>
        set({ activePrimaryItem: item, isSecondarySidebarOpen: true }),
    }),
    {
      name: 'sidebar-storage',
    }
  )
);
