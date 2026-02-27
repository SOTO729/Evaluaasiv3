import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

// Función para limpiar toda la cache del navegador
export const clearAllCache = () => {
  // Preservar preferencias de UI que deben sobrevivir al logout
  const keysToKeep: string[] = ['evaluaasi_dev_mode'];
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (!keysToKeep.includes(key)) {
      localStorage.removeItem(key);
    }
  });
  
  // Limpiar sessionStorage completamente
  sessionStorage.clear();
  
  // Limpiar cookies (las accesibles desde JavaScript)
  document.cookie.split(';').forEach(cookie => {
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  });
  
  // Limpiar cache de IndexedDB si existe
  if ('indexedDB' in window) {
    indexedDB.databases?.().then(databases => {
      databases.forEach(db => {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      });
    }).catch(() => {
      // Algunos navegadores no soportan databases()
    });
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
