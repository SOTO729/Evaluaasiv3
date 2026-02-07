/**
 * Página de Reportes de Seguridad
 * 
 * Alertas de seguridad, logins fallidos, IPs sospechosas
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  ArrowLeft,
  AlertTriangle,
  User,
  Globe,
  Clock,
  RefreshCw,
  AlertCircle,
  XCircle,
  Lock,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getSecurityReport,
  SecurityReport,
} from '../../services/activityService';

export default function GerenteSecurityPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [periodDays, setPeriodDays] = useState(7);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadReport();
  }, [periodDays]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSecurityReport({ days: periodDays });
      setReport(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar reporte');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReport();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadReport}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/gerente"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <Shield className="w-8 h-8 text-red-600" />
              Reporte de Seguridad
            </h1>
            <p className="text-gray-600 mt-1">
              Alertas y actividad sospechosa
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={14}>Últimos 14 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {report && (
        <>
          {/* Alert Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Failed Logins */}
            <div className={`rounded-xl p-6 border ${
              (report.users_with_failed_logins?.length || 0) > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-lg ${
                  (report.users_with_failed_logins?.length || 0) > 0
                    ? 'bg-red-100'
                    : 'bg-green-100'
                }`}>
                  <Lock className={`w-6 h-6 ${
                    (report.users_with_failed_logins?.length || 0) > 0
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`} />
                </div>
                <span className={`text-sm font-medium ${
                  (report.users_with_failed_logins?.length || 0) > 0
                    ? 'text-red-700'
                    : 'text-green-700'
                }`}>
                  Usuarios con Login Fallido
                </span>
              </div>
              <p className={`text-3xl font-bold ${
                (report.users_with_failed_logins?.length || 0) > 0
                  ? 'text-red-800'
                  : 'text-green-800'
              }`}>
                {report.users_with_failed_logins?.length || 0}
              </p>
            </div>

            {/* Suspicious IPs */}
            <div className={`rounded-xl p-6 border ${
              (report.suspicious_ips?.length || 0) > 0
                ? 'bg-amber-50 border-amber-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-lg ${
                  (report.suspicious_ips?.length || 0) > 0
                    ? 'bg-amber-100'
                    : 'bg-green-100'
                }`}>
                  <Globe className={`w-6 h-6 ${
                    (report.suspicious_ips?.length || 0) > 0
                      ? 'text-amber-600'
                      : 'text-green-600'
                  }`} />
                </div>
                <span className={`text-sm font-medium ${
                  (report.suspicious_ips?.length || 0) > 0
                    ? 'text-amber-700'
                    : 'text-green-700'
                }`}>
                  IPs Sospechosas
                </span>
              </div>
              <p className={`text-3xl font-bold ${
                (report.suspicious_ips?.length || 0) > 0
                  ? 'text-amber-800'
                  : 'text-green-800'
              }`}>
                {report.suspicious_ips?.length || 0}
              </p>
            </div>

            {/* Off Hours Actions */}
            <div className={`rounded-xl p-6 border ${
              (report.off_hours_actions || 0) > 0
                ? 'bg-purple-50 border-purple-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-lg ${
                  (report.off_hours_actions || 0) > 0
                    ? 'bg-purple-100'
                    : 'bg-green-100'
                }`}>
                  <Clock className={`w-6 h-6 ${
                    (report.off_hours_actions || 0) > 0
                      ? 'text-purple-600'
                      : 'text-green-600'
                  }`} />
                </div>
                <span className={`text-sm font-medium ${
                  (report.off_hours_actions || 0) > 0
                    ? 'text-purple-700'
                    : 'text-green-700'
                }`}>
                  Acciones Fuera de Horario
                </span>
              </div>
              <p className={`text-3xl font-bold ${
                (report.off_hours_actions || 0) > 0
                  ? 'text-purple-800'
                  : 'text-green-800'
              }`}>
                {report.off_hours_actions || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                (Entre 10pm y 6am)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Users with Failed Logins */}
            <div className="bg-white rounded-xl border shadow-sm">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <User className="w-5 h-5 text-red-500" />
                  Usuarios con Intentos Fallidos
                </h2>
              </div>
              <div className="p-6">
                {report.users_with_failed_logins && report.users_with_failed_logins.length > 0 ? (
                  <div className="space-y-3">
                    {report.users_with_failed_logins.map((user, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                      >
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          <span className="text-gray-800">{user.email}</span>
                        </div>
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                          {user.failed_attempts} intentos
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Lock className="w-12 h-12 mx-auto mb-3 text-green-300" />
                    <p>No hay usuarios con intentos fallidos</p>
                  </div>
                )}
              </div>
            </div>

            {/* Suspicious IPs */}
            <div className="bg-white rounded-xl border shadow-sm">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-amber-500" />
                  IPs con Múltiples Intentos Fallidos
                </h2>
              </div>
              <div className="p-6">
                {report.suspicious_ips && report.suspicious_ips.length > 0 ? (
                  <div className="space-y-3">
                    {report.suspicious_ips.map((ip, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100"
                      >
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-500" />
                          <code className="text-gray-800 font-mono">{ip.ip}</code>
                        </div>
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                          {ip.failed_attempts} intentos
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Globe className="w-12 h-12 mx-auto mb-3 text-green-300" />
                    <p>No hay IPs sospechosas</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Failed Logins */}
          <div className="mt-6 bg-white rounded-xl border shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                Intentos de Login Fallidos Recientes
              </h2>
            </div>
            <div className="overflow-x-auto">
              {report.recent_failed_logins && report.recent_failed_logins.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha/Hora
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        IP
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {report.recent_failed_logins.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(log.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-800">
                            {log.user_email || log.details?.email || 'Desconocido'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <code className="text-sm text-gray-600 font-mono">
                            {log.ip_address || 'N/A'}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-red-600">
                            {log.error_message || 'Credenciales inválidas'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Lock className="w-16 h-16 mx-auto mb-4 text-green-300" />
                  <p className="text-lg font-medium">Sin intentos fallidos</p>
                  <p className="text-sm">No se han registrado intentos de login fallidos en este período</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
