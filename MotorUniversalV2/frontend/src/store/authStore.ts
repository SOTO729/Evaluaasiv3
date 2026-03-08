import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

// Función para limpiar toda la cache del navegador
export const clearAllCache = () => {
  // Limpiar localStorage completamente
  localStorage.clear();
  
  // Limpiar sessionStorage completamente
  sessionStorage.clear();
  
  // Limpiar cookies (las accesibles desde JavaScript)
  document.cookie.split(';').forEach(cookie => {
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
    if (name) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
    }
  });
  
  // Limpiar IndexedDB
  if ('indexedDB' in window) {
    indexedDB.databases?.().then(databases => {
      databases.forEach(db => {
        if (db.name) indexedDB.deleteDatabase(db.name);
      });
    }).catch(() => {});
  }
  
  // Limpiar Cache API (Service Worker caches)
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    }).catch(() => {});
  }

  // Limpiar react-query cache si está disponible globalmente
  if ((window as any).__queryClient) {
    (window as any).__queryClient.clear();
  }
  
  console.log('🧹 Cache del navegador limpiada completamente');
};

// Función para limpiar cache de sesión de examen
export const clearExamSessionCache = () => {
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (key.startsWith('exam_session_') || key.startsWith('exam_answers_')) {
      localStorage.removeItem(key);
    }
  });
  console.log('🧹 Cache de sesión de examen limpiada');
};

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
  updateUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (user, accessToken, refreshToken) => {
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        })
      },

      logout: () => {
        // Limpiar toda la cache al cerrar sesión
        clearAllCache();
        
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },

      updateUser: (user) => {
        set({ user })
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)
