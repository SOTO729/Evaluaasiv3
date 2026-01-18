import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore, clearAllCache } from '../store/authStore';

interface UseInactivityLogoutOptions {
  // Tiempo de inactividad en minutos antes de cerrar sesión
  timeoutMinutes?: number;
  // Si está habilitado
  enabled?: boolean;
}

/**
 * Hook para cerrar sesión automáticamente después de un período de inactividad
 * Solo aplica para usuarios tipo "candidato"
 */
export const useInactivityLogout = (options: UseInactivityLogoutOptions = {}) => {
  const { 
    timeoutMinutes = 15, // 15 minutos por defecto
    enabled = true 
  } = options;
  
  const { user, logout, isAuthenticated } = useAuthStore();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Solo aplicar para usuarios candidatos
  const isCandidato = user?.role === 'candidato';
  const shouldTrackInactivity = enabled && isAuthenticated && isCandidato;
  
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = timeoutMs - (2 * 60 * 1000); // Advertencia 2 minutos antes
  
  const handleLogout = useCallback(() => {
    console.log('⏰ Sesión cerrada por inactividad');
    clearAllCache();
    logout();
    // Redirigir al login
    window.location.href = '/login?reason=inactivity';
  }, [logout]);
  
  const showWarning = useCallback(() => {
    // Mostrar notificación de advertencia
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Sesión por expirar', {
        body: 'Tu sesión se cerrará en 2 minutos por inactividad',
        icon: '/favicon.ico'
      });
    }
    
    // También mostrar alerta en la página
    const existingWarning = document.getElementById('inactivity-warning');
    if (!existingWarning) {
      const warningDiv = document.createElement('div');
      warningDiv.id = 'inactivity-warning';
      warningDiv.className = 'fixed top-4 right-4 z-[9999] bg-amber-500 text-white px-4 py-3 rounded-lg shadow-lg animate-pulse';
      warningDiv.innerHTML = `
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>Tu sesión se cerrará en 2 minutos por inactividad</span>
        </div>
      `;
      document.body.appendChild(warningDiv);
    }
  }, []);
  
  const removeWarning = useCallback(() => {
    const warningDiv = document.getElementById('inactivity-warning');
    if (warningDiv) {
      warningDiv.remove();
    }
  }, []);
  
  const resetTimer = useCallback(() => {
    // Limpiar timers existentes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    
    // Remover advertencia si existe
    removeWarning();
    
    if (!shouldTrackInactivity) return;
    
    // Configurar advertencia
    warningTimeoutRef.current = setTimeout(() => {
      showWarning();
    }, warningMs);
    
    // Configurar logout
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, timeoutMs);
  }, [shouldTrackInactivity, timeoutMs, warningMs, handleLogout, showWarning, removeWarning]);
  
  useEffect(() => {
    if (!shouldTrackInactivity) {
      // Limpiar timers si no debe trackear
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      removeWarning();
      return;
    }
    
    // Eventos que indican actividad del usuario
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'focus'
    ];
    
    // Iniciar timer
    resetTimer();
    
    // Agregar listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });
    
    // También resetear cuando la ventana recupera el foco
    window.addEventListener('focus', resetTimer);
    
    // Pedir permiso para notificaciones
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    return () => {
      // Limpiar timers
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      
      // Remover listeners
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      window.removeEventListener('focus', resetTimer);
      
      removeWarning();
    };
  }, [shouldTrackInactivity, resetTimer, removeWarning]);
  
  return {
    resetTimer,
    isCandidato,
    isTrackingInactivity: shouldTrackInactivity
  };
};

export default useInactivityLogout;
