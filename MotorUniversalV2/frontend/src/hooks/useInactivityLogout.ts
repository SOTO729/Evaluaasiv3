import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore, clearAllCache } from '../store/authStore';

interface UseInactivityLogoutOptions {
  timeoutMinutes?: number;
  warningMinutes?: number;
  enabled?: boolean;
}

/**
 * Hook para cerrar sesión automáticamente después de un período de inactividad.
 * Muestra un countdown modal los últimos N minutos (por defecto 5).
 * Solo aplica para usuarios tipo "candidato".
 */
export const useInactivityLogout = (options: UseInactivityLogoutOptions = {}) => {
  const {
    timeoutMinutes = 15,
    warningMinutes = 5,
    enabled = true
  } = options;

  const { user, logout, isAuthenticated } = useAuthStore();
  const isCandidato = user?.role === 'candidato';
  const shouldTrack = enabled && isAuthenticated && isCandidato;

  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = timeoutMs - warningMinutes * 60 * 1000;

  // Countdown state
  const [showCountdown, setShowCountdown] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(warningMinutes * 60);

  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineRef = useRef<number>(Date.now() + timeoutMs);

  const handleLogout = useCallback(() => {
    clearAllCache();
    logout();
    window.location.href = '/login?reason=inactivity';
  }, [logout]);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setShowCountdown(false);
  }, []);

  const startCountdown = useCallback(() => {
    setShowCountdown(true);
    // Calculate remaining seconds from deadline
    const tick = () => {
      const remaining = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        handleLogout();
      }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
  }, [handleLogout]);

  const resetTimer = useCallback(() => {
    // Clear all timers
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    stopCountdown();

    if (!shouldTrack) return;

    deadlineRef.current = Date.now() + timeoutMs;

    warningTimerRef.current = setTimeout(() => {
      startCountdown();
    }, warningMs);

    logoutTimerRef.current = setTimeout(() => {
      handleLogout();
    }, timeoutMs);
  }, [shouldTrack, timeoutMs, warningMs, handleLogout, startCountdown, stopCountdown]);

  // Dismiss countdown and reset (user clicked "Seguir") — counts as activity
  const dismissCountdown = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!shouldTrack) {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      stopCountdown();
      return;
    }

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    resetTimer();

    activityEvents.forEach(ev =>
      document.addEventListener(ev, resetTimer, { passive: true })
    );

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      stopCountdown();
      activityEvents.forEach(ev => document.removeEventListener(ev, resetTimer));
    };
  }, [shouldTrack, resetTimer, stopCountdown]);

  return {
    showCountdown,
    secondsLeft,
    dismissCountdown,
    isCandidato,
    isTrackingInactivity: shouldTrack
  };
};

export default useInactivityLogout;
