/**
 * Página de Monitoreo del Gerente
 * Fusión de Activity Logs + Seguridad con sistema de tabs
 * Tabs: Actividad | Seguridad
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Shield,
  AlertTriangle,
  Globe,
  Clock,
  Lock,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getActivityLogs,
  getPersonalUsers,
  getSecurityReport,
  ActivityLog,
  PersonalUser,
  SecurityReport,
  ACTION_TYPES,
  ENTITY_TYPES,
} from '../../services/activityService';

type TabKey = 'actividad' | 'seguridad';

export default function GerenteMonitoreoPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('actividad');
  const [refreshing, setRefreshing] = useState(false);

  // ── Activity state ──
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [personalUsers, setPersonalUsers] = useState<PersonalUser[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [successOnly, setSuccessOnly] = useState('');
  const perPage = 20;

  // ── Security state ──
  const [secLoading, setSecLoading] = useState(true);
  const [secError, setSecError] = useState<string | null>(null);
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [periodDays, setPeriodDays] = useState(7);

  // ── Activity loaders ──
  const loadUsers = useCallback(async () => {
    try {
      const data = await getPersonalUsers();
      setPersonalUsers(data.users);
    } catch { /* silent */ }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      setLogsError(null);
      const params: Record<string, any> = { page: currentPage, per_page: perPage };
      if (selectedUser) params.user_id = selectedUser;
      if (selectedAction) params.action_type = selectedAction;
      if (selectedEntity) params.entity_type = selectedEntity;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (successOnly === 'true') params.success = true;
      else if (successOnly === 'false') params.success = false;
      const data = await getActivityLogs(params);
      setLogs(data.logs || []);
      setTotalLogs(data.total || 0);
    } catch (err: any) {
      setLogsError(err.response?.data?.error || 'Error al cargar logs');
    } finally {
      setLogsLoading(false);
    }
  }, [currentPage, selectedUser, selectedAction, selectedEntity, dateFrom, dateTo, successOnly]);

  // ── Security loader ──
  const loadSecurity = useCallback(async () => {
    try {
      setSecLoading(true);
      setSecError(null);
      const data = await getSecurityReport({ days: periodDays });
      setReport(data);
    } catch (err: any) {
      setSecError(err.response?.data?.error || 'Error al cargar reporte de seguridad');
    } finally {
      setSecLoading(false);
    }
  }, [periodDays]);

  // Initial load
  useEffect(() => { loadUsers(); }, [loadUsers]);

  // Tab-specific data
  useEffect(() => {
    if (activeTab === 'actividad') loadLogs();
  }, [activeTab, loadLogs]);

  useEffect(() => {
    if (activeTab === 'seguridad') loadSecurity();
  }, [activeTab, loadSecurity]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'actividad') await loadLogs();
    else await loadSecurity();
    setRefreshing(false);
  };

  const clearFilters = () => {
    setSelectedUser('');
    setSelectedAction('');
    setSelectedEntity('');
    setDateFrom('');
    setDateTo('');
    setSuccessOnly('');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalLogs / perPage);
  const hasFilters = selectedUser || selectedAction || selectedEntity || dateFrom || dateTo || successOnly;

  const getActionBadgeColor = (actionType: string) => {
    if (actionType.includes('create') || actionType.includes('add')) return 'bg-green-100 text-green-700 border-green-200/60';
    if (actionType.includes('delete') || actionType.includes('remove')) return 'bg-red-100 text-red-700 border-red-200/60';
    if (actionType.includes('update') || actionType.includes('edit')) return 'bg-blue-100 text-blue-700 border-blue-200/60';
    if (actionType.includes('login')) return 'bg-purple-100 text-purple-700 border-purple-200/60';
    return 'bg-gray-100 text-gray-700 border-gray-200/60';
  };

  const tabs: { key: TabKey; label: string; icon: typeof Activity }[] = [
    { key: 'actividad', label: 'Actividad', icon: Activity },
    { key: 'seguridad', label: 'Seguridad', icon: Shield },
  ];

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-white/5 rounded-full" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center fluid-gap-4">
            <Link to="/gerente" className="fluid-p-2 bg-white/15 rounded-fluid-lg hover:bg-white/25 transition-colors">
              <ArrowLeft className="fluid-icon-sm text-white" />
            </Link>
            <div className="fluid-p-3 bg-white/15 rounded-fluid-xl backdrop-blur-sm">
              <Activity className="fluid-icon-xl text-white" />
            </div>
            <div>
              <h1 className="fluid-text-3xl font-bold">Monitoreo</h1>
              <p className="fluid-text-base text-white/80">Actividad del personal y seguridad</p>
            </div>
          </div>

          <div className="flex items-center fluid-gap-3">
            {/* Period pills para seguridad */}
            {activeTab === 'seguridad' && (
              <div className="hidden md:flex fluid-gap-1 bg-white/10 rounded-fluid-xl fluid-p-1">
                {[7, 14, 30, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setPeriodDays(d)}
                    className={`fluid-px-3 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium transition-all ${
                      periodDays === d ? 'bg-white text-indigo-700 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            )}
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

      {/* ===== TABS ===== */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-1.5 fluid-mb-6">
        <div className="flex fluid-gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center fluid-gap-2 fluid-py-3 fluid-px-4 rounded-fluid-xl fluid-text-sm font-semibold transition-all duration-300 ${
                activeTab === tab.key
                  ? tab.key === 'actividad'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md'
                    : 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="fluid-icon-sm" />
              {tab.label}
              {tab.key === 'seguridad' && report && (report.recent_failed_logins?.length || 0) > 0 && (
                <span className="fluid-px-1.5 fluid-py-0.5 bg-red-100 text-red-700 rounded-full fluid-text-xs font-bold">
                  {report.recent_failed_logins.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ===== TAB: ACTIVIDAD ===== */}
      {activeTab === 'actividad' && (
        <div className="animate-fade-in-up">
          {/* Filtros */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5 fluid-mb-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 fluid-gap-3">
              <div>
                <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1">Usuario</label>
                <select
                  value={selectedUser}
                  onChange={(e) => { setSelectedUser(e.target.value); setCurrentPage(1); }}
                  className="w-full fluid-py-2 fluid-px-3 bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-text-xs focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                >
                  <option value="">Todos</option>
                  {personalUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1">Acción</label>
                <select
                  value={selectedAction}
                  onChange={(e) => { setSelectedAction(e.target.value); setCurrentPage(1); }}
                  className="w-full fluid-py-2 fluid-px-3 bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-text-xs focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                >
                  <option value="">Todas</option>
                  {Object.entries(ACTION_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1">Entidad</label>
                <select
                  value={selectedEntity}
                  onChange={(e) => { setSelectedEntity(e.target.value); setCurrentPage(1); }}
                  className="w-full fluid-py-2 fluid-px-3 bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-text-xs focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                >
                  <option value="">Todas</option>
                  {Object.entries(ENTITY_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  className="w-full fluid-py-2 fluid-px-3 bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-text-xs focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                  className="w-full fluid-py-2 fluid-px-3 bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-text-xs focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1">Estado</label>
                <select
                  value={successOnly}
                  onChange={(e) => { setSuccessOnly(e.target.value); setCurrentPage(1); }}
                  className="w-full fluid-py-2 fluid-px-3 bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-text-xs focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                >
                  <option value="">Todos</option>
                  <option value="true">Exitosos</option>
                  <option value="false">Fallidos</option>
                </select>
              </div>
            </div>
            {hasFilters && (
              <div className="fluid-mt-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="fluid-px-3 fluid-py-1.5 fluid-text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-fluid-xl transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {logsError && (
            <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-center fluid-gap-2">
              <AlertCircle className="fluid-icon-sm text-red-500" />
              <p className="text-red-700 fluid-text-sm">{logsError}</p>
            </div>
          )}

          {/* Table */}
          {logsLoading ? (
            <div className="flex justify-center fluid-py-6">
              <LoadingSpinner size="lg" />
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-6 text-center">
              <Activity className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-3" />
              <p className="fluid-text-lg text-gray-500">No hay registros</p>
              <p className="fluid-text-sm text-gray-400 fluid-mt-1">Ajusta los filtros o revisa más tarde</p>
            </div>
          ) : (
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100/80">
                      <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
                      <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Acción</th>
                      <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Entidad</th>
                      <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Detalles</th>
                      <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="fluid-px-4 fluid-py-3 fluid-text-xs text-gray-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('es-MX')}
                        </td>
                        <td className="fluid-px-4 fluid-py-3">
                          <div className="flex items-center fluid-gap-2">
                            <div className="fluid-w-6 fluid-h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                              <User className="w-3 h-3 text-white" />
                            </div>
                            <span className="fluid-text-sm text-gray-700 truncate">{log.user_email || 'Sistema'}</span>
                          </div>
                        </td>
                        <td className="fluid-px-4 fluid-py-3">
                          <span className={`inline-flex fluid-px-2 fluid-py-0.5 rounded-full fluid-text-xs font-medium border ${getActionBadgeColor(log.action_type)}`}>
                            {log.action_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 capitalize">
                          {(log.entity_type || '-').replace(/_/g, ' ')}
                        </td>
                        <td className="fluid-px-4 fluid-py-3 fluid-text-xs text-gray-500 max-w-xs truncate">
                          {typeof log.details === 'string' ? log.details : (log.details ? JSON.stringify(log.details) : '-')}
                        </td>
                        <td className="fluid-px-4 fluid-py-3 text-center">
                          {log.success ? (
                            <CheckCircle2 className="fluid-icon-xs text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle className="fluid-icon-xs text-red-500 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="fluid-px-4 fluid-py-3 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
                  <span className="fluid-text-xs text-gray-500">
                    Página {currentPage} de {totalPages} ({totalLogs} registros)
                  </span>
                  <div className="flex fluid-gap-2">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage <= 1} className="fluid-px-2.5 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">Primera</button>
                    <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="fluid-px-2.5 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">Anterior</button>
                    <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="fluid-px-2.5 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">Siguiente</button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages} className="fluid-px-2.5 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">Última</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: SEGURIDAD ===== */}
      {activeTab === 'seguridad' && (
        <div className="animate-fade-in-up">
          {secError && (
            <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-center fluid-gap-2">
              <AlertCircle className="fluid-icon-sm text-red-500" />
              <p className="text-red-700 fluid-text-sm">{secError}</p>
            </div>
          )}

          {secLoading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              {/* Alert Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4 fluid-mb-6">
                {[
                  { label: 'Logins Fallidos', value: report?.recent_failed_logins?.length || 0, icon: XCircle, dangerColor: 'from-red-500 to-rose-500', safeColor: 'from-emerald-500 to-green-500', dangerBg: 'bg-red-50 border-red-200', safeBg: 'bg-emerald-50 border-emerald-200' },
                  { label: 'IPs Sospechosas', value: report?.suspicious_ips?.length || 0, icon: Globe, dangerColor: 'from-amber-500 to-orange-500', safeColor: 'from-emerald-500 to-green-500', dangerBg: 'bg-amber-50 border-amber-200', safeBg: 'bg-emerald-50 border-emerald-200' },
                  { label: 'Acciones Fuera de Horario', value: report?.off_hours_actions || 0, icon: Clock, dangerColor: 'from-purple-500 to-violet-500', safeColor: 'from-emerald-500 to-green-500', dangerBg: 'bg-purple-50 border-purple-200', safeBg: 'bg-emerald-50 border-emerald-200' },
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

              {/* Details Grid */}
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

              {/* Recent Failed Logins Table */}
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
