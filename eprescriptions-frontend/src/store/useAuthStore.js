import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () => set({ user: null }),
      clearKey: () => set({
        user: {
          ...get().user,
          llave_privada: null,
          llave_privada_ec: null,
          llave_privada_rsa: null,
        },
      }),
      isLoggedIn: () => !!get().user,
      role: () => get().user?.rol,
      token: () => get().user?.token || null,
    }),
    {
      name: 'eprescriptions-auth',
      partialize: (s) => ({ user: s.user }),
    }
  )
)
