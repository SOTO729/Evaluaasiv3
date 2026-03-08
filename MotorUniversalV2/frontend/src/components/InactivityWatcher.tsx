import { ReactNode } from 'react';
import { useInactivityLogout } from '../hooks/useInactivityLogout';
import { useAuthStore, clearAllCache } from '../store/authStore';

interface InactivityWatcherProps {
  children: ReactNode;
  timeoutMinutes?: number;
  warningMinutes?: number;
}

export const InactivityWatcher = ({
  children,
  timeoutMinutes = 15,
  warningMinutes = 5
}: InactivityWatcherProps) => {
  const { showCountdown, secondsLeft, dismissCountdown } = useInactivityLogout({
    timeoutMinutes,
    warningMinutes,
    enabled: true
  });

  const { logout } = useAuthStore();

  const handleLogoutNow = () => {
    clearAllCache();
    logout();
    window.location.href = '/login';
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const pct = Math.max(0, (secondsLeft / (warningMinutes * 60)) * 100);
  const isUrgent = secondsLeft <= 60;

  return (
    <>
      {children}

      {showCountdown && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-fade-in">
            {/* Barra de progreso superior */}
            <div className="h-1.5 bg-gray-200">
              <div
                className={`h-full transition-all duration-1000 ease-linear ${
                  isUrgent ? 'bg-red-500' : 'bg-amber-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="p-6 text-center">
              {/* Icono */}
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                isUrgent ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                <svg className={`w-8 h-8 ${isUrgent ? 'text-red-600' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Sesión por expirar
              </h3>
              <p className="text-sm text-gray-500 mb-5">
                Tu sesión se cerrará por inactividad en:
              </p>

              {/* Countdown grande */}
              <div className={`text-5xl font-mono font-bold mb-6 tabular-nums ${
                isUrgent ? 'text-red-600' : 'text-gray-900'
              }`}>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </div>

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={handleLogoutNow}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cerrar sesión
                </button>
                <button
                  onClick={dismissCountdown}
                  className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  Seguir activo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InactivityWatcher;
