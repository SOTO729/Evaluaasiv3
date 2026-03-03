/**
 * Página de administración de cuentas bloqueadas
 * Permite ver y desbloquear cuentas bloqueadas por intentos excesivos de login
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Unlock,
  RefreshCw,
  AlertTriangle,
  Clock,
  User,
  Mail,
  Shield,
  CheckCircle,
  XCircle,
  UnlockKeyhole,
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import lockedAccountsService, {
  type LockedAccount,
  type FailedAttempt,
  type LockoutConfig,
} from '../services/lockedAccountsService';

export default function LockedAccountsPage() {
  const [lockedAccounts, setLockedAccounts] = useState<LockedAccount[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<FailedAttempt[]>([]);
  const [config, setConfig] = useState<LockoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [unlockingAll, setUnlockingAll] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const data = await lockedAccountsService.getLockedAccounts();
      setLockedAccounts(data.locked_accounts);
      setFailedAttempts(data.failed_attempts);
      setConfig(data.config);
    } catch (err: any) {
      console.error('Error fetching locked accounts:', err);
      setError(err.response?.data?.error || 'Error al obtener las cuentas bloqueadas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const handleUnlock = async (username: string) => {
    setUnlocking(username);
    setSuccessMessage(null);
    try {
      const result = await lockedAccountsService.unlockAccount(username);
      setSuccessMessage(result.message);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al desbloquear la cuenta');
    } finally {
      setUnlocking(null);
    }
  };

  const handleUnlockAll = async () => {
    if (!confirm('¿Estás seguro de que deseas desbloquear TODAS las cuentas bloqueadas?')) return;
    setUnlockingAll(true);
    setSuccessMessage(null);
    try {
      const result = await lockedAccountsService.unlockAll();
      setSuccessMessage(result.message);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al desbloquear las cuentas');
    } finally {
      setUnlockingAll(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ShieldAlert className="h-7 w-7 text-red-500" />
            Cuentas Bloqueadas
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gestión de cuentas bloqueadas por intentos excesivos de acceso
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Auto-refresh
          </label>
          {/* Refresh button */}
          <button
            onClick={() => fetchData()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
          {/* Unlock all button */}
          {lockedAccounts.length > 0 && (
            <button
              onClick={handleUnlockAll}
              disabled={unlockingAll}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {unlockingAll ? (
                <LoadingSpinner size="sm" />
              ) : (
                <UnlockKeyhole className="h-4 w-4" />
              )}
              Desbloquear Todas
            </button>
          )}
        </div>
      </div>

      {/* Config info */}
      {config && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
            <Shield className="h-4 w-4" />
            <span className="font-medium">Configuración de bloqueo:</span>
            <span>
              Máximo {config.max_attempts} intentos fallidos → Bloqueo por {config.lockout_duration_minutes} minutos
            </span>
          </div>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <span className="text-green-700 dark:text-green-300 text-sm">{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-auto text-green-500 hover:text-green-700"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{lockedAccounts.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Cuentas Bloqueadas</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{failedAttempts.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Con Intentos Fallidos</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {lockedAccounts.length === 0 && failedAttempts.length === 0 ? '✓' : '—'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {lockedAccounts.length === 0 && failedAttempts.length === 0
                  ? 'Todo en orden'
                  : 'Requiere atención'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Locked Accounts Table */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-500" />
          Cuentas Bloqueadas ({lockedAccounts.length})
        </h2>
        {lockedAccounts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No hay cuentas bloqueadas actualmente</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Intentos Fallidos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Tiempo Restante
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {lockedAccounts.map((account) => (
                    <tr key={account.username} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                            <User className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {account.user?.name || account.username}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <Mail className="h-3 w-3" />
                              {account.user?.email || account.username}
                            </div>
                            {account.user && account.user.username !== account.username && (
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                Login: {account.username}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                          <AlertTriangle className="h-3 w-3" />
                          {account.failed_attempts} intentos
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400">
                          <Clock className="h-4 w-4" />
                          {formatTime(account.remaining_seconds)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {account.user?.role || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleUnlock(account.username)}
                          disabled={unlocking === account.username}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {unlocking === account.username ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <Unlock className="h-3.5 w-3.5" />
                          )}
                          Desbloquear
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Failed Attempts Table (not yet locked) */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Intentos Fallidos sin Bloqueo ({failedAttempts.length})
        </h2>
        {failedAttempts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No hay intentos fallidos activos</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Intentos Fallidos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {failedAttempts.map((attempt) => (
                    <tr key={attempt.username} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                            <User className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {attempt.user?.name || attempt.username}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <Mail className="h-3 w-3" />
                              {attempt.user?.email || attempt.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                            {attempt.failed_attempts} / {config?.max_attempts || 5}
                          </span>
                          {/* Progress bar */}
                          <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (attempt.failed_attempts / (config?.max_attempts || 5)) * 100)}%`,
                                backgroundColor:
                                  attempt.failed_attempts >= (config?.max_attempts || 5) - 1
                                    ? '#ef4444'
                                    : attempt.failed_attempts >= Math.ceil((config?.max_attempts || 5) / 2)
                                    ? '#f59e0b'
                                    : '#3b82f6',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                          <AlertTriangle className="h-3 w-3" />
                          En riesgo
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {attempt.user?.role || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleUnlock(attempt.username)}
                          disabled={unlocking === attempt.username}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {unlocking === attempt.username ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <Unlock className="h-3.5 w-3.5" />
                          )}
                          Resetear
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
