/**
 * Página de Seguridad del Gerente
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

  useEffect(() => { loadData(); }, [periodDays]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSecurityReport({ days: periodDays });
      setReport(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar reporte de seguridad');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner size="lg" />
    </div>
  );

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center fluid-gap-4">
            <Link to="/gerente" className="fluid-p-2 bg-white/15 rounded-fluid-lg hover:bg-white/25 transition-colors">
              <ArrowLeft className="fluid-icon-sm text-white" />
            </Link>
            <div className="fluid-p-3 bg-white/15 rounded-fluid-xl backdrop-blur-sm">
              <Shield className="fluid-icon-xl text-white" />
            </div>
            <div>
              <h1 className="fluid-text-3xl font-bold">Seguridad</h1>
              <p className="fluid-text-base text-white/80">Alertas y monitoreo</p>
            </div>
          </div>

          <div className="flex items-center fluid-gap-3">
            {/* Period pills */}
            <div className="hidden md:flex fluid-gap-1 bg-white/10 rounded-fluid-xl fluid-p-1">
              {[7, 14, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setPeriodDays(d)}
                  className={`fluid-px-3 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium transition-all ${
                    periodDays === d ? 'bg-white text-red-700 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="fluid-p-2.5 bg-white/15 hover:bg-white/25 rounded-fluid-xl transition-all hover:scale-105 backdrop-blur-sm"
            >
              <RefreshCw className={`fluid-icon-lg text-white ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-center fluid-gap-2">
          <AlertCircle className="fluid-icon-sm text-red-500" />
          <p className="text-red-700 fluid-text-sm">{error}</p>
        </div>
      )}

      {/* ===== ALERT CARDS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4 fluid-mb-6">
        {[
          {
            label: 'Logins Fallidos',
            value: report?.recent_failed_logins?.length || 0,
            icon: XCircle,
            dangerColor: 'from-red-500 to-rose-500',
            safeColor: 'from-emerald-500 to-green-500',
            dangerBg: 'bg-red-50 border-red-200',
            safeBg: 'bg-emerald-50 border-emerald-200',
          },
          {
            label: 'IPs Sospechosas',
            value: report?.suspicious_ips?.length || 0,
            icon: Globe,
            dangerColor: 'from-amber-500 to-orange-500',
            safeColor: 'from-emerald-500 to-green-500',
            dangerBg: 'bg-amber-50 border-amber-200',
            safeBg: 'bg-emerald-50 border-emerald-200',
          },
          {
            label: 'Acciones Fuera de Horario',
            value: report?.off_hours_actions || 0,
            icon: Clock,
            dangerColor: 'from-purple-500 to-violet-500',
            safeColor: 'from-emerald-500 to-green-500',
            dangerBg: 'bg-purple-50 border-purple-200',
            safeBg: 'bg-emerald-50 border-emerald-200',
          },
        ].map((card) => {
          const isDanger = card.value > 0;
          return (
            <div key={card.label} className={`rounded-fluid-2xl border fluid-p-5 ${isDanger ? card.dangerBg : card.safeBg} transition-all hover:shadow-md`}>
              <div className="flex items-start justify-between fluid-mb-3">
                <div className={`fluid-p-2.5 bg-gradient-to-br ${isDanger ? card.dangerColor : card.safeColor} rounded-fluid-xl shadow-sm`}>
                  <card.icon className="fluid-icon-sm text-white" />
                </div>
                {isDanger && <AlertTriangle className="fluid-icon-sm text-amber-500 animate-pulse" />}
              </div>
              <p className="fluid-text-3xl font-bold text-gray-800">{card.value}</p>
              <p className="fluid-text-xs text-gray-500 font-medium fluid-mt-1">{card.label}</p>
              <p className="fluid-text-xs text-gray-400 fluid-mt-0.5">Últimos {periodDays} días</p>
            </div>
          );
        })}
      </div>

      {/* ===== DETAILS GRID ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6 fluid-mb-6">
        {/* Users with Failed Logins */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <User className="fluid-icon-sm text-red-500" />
              Usuarios con Logins Fallidos
            </h2>
          </div>
          <div className="fluid-p-5">
            {!report?.users_with_failed_logins?.length ? (
              <div className="text-center fluid-py-6">
                <Lock className="fluid-icon-xl text-emerald-300 mx-auto fluid-mb-3" />
                <p className="fluid-text-sm text-emerald-600 font-medium">Sin alertas</p>
                <p className="fluid-text-xs text-gray-400">No se detectaron logins fallidos</p>
              </div>
            ) : (
              <div className="space-y-3">
                {report.users_with_failed_logins.map((user: any, i: number) => (
                  <div key={i} className="flex items-center justify-between fluid-p-3 rounded-fluid-xl border border-gray-100 hover:border-red-200 hover:bg-red-50/30 transition-all">
                    <div className="flex items-center fluid-gap-3 min-w-0">
                      <div className="fluid-w-8 fluid-h-8 rounded-full bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-medium fluid-text-xs">{(user.email || 'U')[0].toUpperCase()}</span>
                      </div>
                      <span className="fluid-text-sm text-gray-700 truncate">{user.email}</span>
                    </div>
                    <span className="fluid-px-2 fluid-py-0.5 bg-red-100 text-red-700 rounded-full fluid-text-xs font-semibold flex-shrink-0">
                      {user.failed_attempts} fallidos
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Suspicious IPs */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <Globe className="fluid-icon-sm text-amber-500" />
              IPs Sospechosas
            </h2>
          </div>
          <div className="fluid-p-5">
            {!report?.suspicious_ips?.length ? (
              <div className="text-center fluid-py-6">
                <Globe className="fluid-icon-xl text-emerald-300 mx-auto fluid-mb-3" />
                <p className="fluid-text-sm text-emerald-600 font-medium">Sin IPs sospechosas</p>
                <p className="fluid-text-xs text-gray-400">Ninguna IP fue marcada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {report.suspicious_ips.map((ip: any, i: number) => (
                  <div key={i} className="flex items-center justify-between fluid-p-3 rounded-fluid-xl border border-gray-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all">
                    <div className="flex items-center fluid-gap-3">
                      <div className="fluid-p-2 bg-amber-100 rounded-fluid-lg">
                        <Globe className="fluid-icon-xs text-amber-600" />
                      </div>
                      <span className="fluid-text-sm font-mono text-gray-700">{ip.ip || ip.ip_address}</span>
                    </div>
                    <span className="fluid-px-2 fluid-py-0.5 bg-amber-100 text-amber-700 rounded-full fluid-text-xs font-semibold">
                      {ip.failed_attempts} intentos
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== RECENT FAILED LOGINS TABLE ===== */}
      {report?.recent_failed_logins && report.recent_failed_logins.length > 0 && (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <AlertTriangle className="fluid-icon-sm text-orange-500" />
              Últimos Logins Fallidos
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">IP</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.recent_failed_logins.map((login: any, i: number) => (
                  <tr key={i} className="hover:bg-red-50/30 transition-colors">
                    <td className="fluid-px-4 fluid-py-3 fluid-text-xs text-gray-500">{new Date(login.timestamp || login.created_at).toLocaleString('es-MX')}</td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-700">{login.email}</td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm font-mono text-gray-600">{login.ip || login.ip_address || '-'}</td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-xs text-red-600">{login.error || login.reason || 'Credenciales inválidas'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
