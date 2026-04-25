import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore, clearAllCache } from '../store/authStore';

interface UseInactivityLogoutOptions {
  timeoutMinutes?: number;
  warningMinutes?: number;
  enabled?: boolean;
}

// Roles que NO deben tener cierre por inactividad (responsables manejan
// portales largos; candidato tiene su propio timeout más estricto)
const RESPONSABLE_ROLES = ['responsable', 'responsable_partner', 'responsable_estatal'];

// Configuración por rol cuando no se pasa override explícito.
// candidato: 15 min con warning de 5 min.
// resto (gerente, financiero, soporte, editor, coordinator, admin, etc.):
// 3 días (4320 min) con warning de 10 min.
const ROLE_TIMEOUT_DEFAULTS: Record<string, { timeout: number; warning: number }> = {
  candidato: { timeout: 15, warning: 5 },
};
const DEFAULT_TIMEOUT_MINUTES = 60 * 24 * 3; // 3 días
const DEFAULT_WARNING_MINUTES = 10;

/**
 * Hook para cerrar sesión automáticamente después de un período de inactividad.
 * - Candidato: 15 min con warning de 5 min.
 * - Responsable / responsable_partner / responsable_estatal: NO aplica.
 * - Resto de roles: 3 días con warning de 10 min.
 * Las opciones permiten sobreescribir manualmente el timeout/warning.
 */
export const useInactivityLogout = (options: UseInactivityLogoutOptions = {}) => {
  const { user, logout, isAuthenticated } = useAuthStore();
  const role = user?.role || '';

  // ¿Aplica el watcher para este rol?
  const isResponsable = RESPONSABLE_ROLES.includes(role);
  const roleApplies = isAuthenticated && !!role && !isResponsable;

  // Resolver timeout/warning efectivos según rol y overrides
  const roleDefaults = ROLE_TIMEOUT_DEFAULTS[role] || {
    timeout: DEFAULT_TIMEOUT_MINUTES,
    warning: DEFAULT_WARNING_MINUTES,
  };
  const timeoutMinutes = options.timeoutMinutes ?? roleDefaults.timeout;
  const warningMinutes = options.warningMinutes ?? roleDefaults.warning;
  const enabled = options.enabled ?? true;

  const isCandidato = role === 'candidato';
  const shouldTrack = enabled && roleApplies;

  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = Math.max(0, timeoutMs - warningMinutes * 60 * 1000);

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
