import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/services/auth.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      
      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user,
        isLoading: false,
      }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
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
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
