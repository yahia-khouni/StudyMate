import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/services/auth.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  logout: () => void;
}

// Timeout for hydration - fallback if hydration takes too long
const HYDRATION_TIMEOUT = 3000;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      isHydrated: false,
      
      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user,
        isLoading: false,
      }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setHydrated: (isHydrated) => set({ isHydrated, isLoading: false }),
      
      logout: () => {
        localStorage.removeItem('accessToken');
        set({ 
          user: null, 
          isAuthenticated: false,
          isLoading: false,
        });
      },
    }),
    {
      name: 'studyai-auth',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // After hydration from storage, mark as hydrated
        if (state) {
          state.isLoading = false;
          state.isHydrated = true;
        }
      },
    }
  )
);

// Set up hydration timeout fallback
if (typeof window !== 'undefined') {
  setTimeout(() => {
    const state = useAuthStore.getState();
    if (!state.isHydrated) {
      console.warn('Auth hydration timeout - setting default state');
      state.setHydrated(true);
    }
  }, HYDRATION_TIMEOUT);
  
  // Listen for session expired events from API interceptor
  window.addEventListener('auth:sessionExpired', () => {
    const state = useAuthStore.getState();
    state.logout();
  });
}
