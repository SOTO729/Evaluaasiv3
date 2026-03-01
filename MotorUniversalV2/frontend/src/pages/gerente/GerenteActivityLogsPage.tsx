/**
 * Página de Logs de Actividad del Gerente
 * Visor de actividad filtrable con paginación
 */
import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getActivityLogs,
  getPersonalUsers,
  ActivityLog,
  PersonalUser,
  ACTION_TYPES,
  ENTITY_TYPES,
} from '../../services/activityService';

export default function GerenteActivityLogsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [personalUsers, setPersonalUsers] = useState<PersonalUser[]>([]);

  // Filtros
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [successOnly, setSuccessOnly] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const perPage = 20;

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => { loadLogs(); }, [currentPage, selectedUser, selectedAction, selectedEntity, dateFrom, dateTo, successOnly]);

  const loadInitialData = async () => {
    try {
      const data = await getPersonalUsers();
      setPersonalUsers(data.users);
    } catch {} // silently fail for users list
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { page: currentPage, per_page: perPage };
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
      setError(err.response?.data?.error || 'Error al cargar logs');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
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

  const getActionBadgeColor = (actionType: string) => {
    if (actionType.includes('create') || actionType.includes('add')) return 'bg-green-100 text-green-700 border-green-200/60';
    if (actionType.includes('delete') || actionType.includes('remove')) return 'bg-red-100 text-red-700 border-red-200/60';
    if (actionType.includes('update') || actionType.includes('edit')) return 'bg-blue-100 text-blue-700 border-blue-200/60';
    if (actionType.includes('login')) return 'bg-purple-100 text-purple-700 border-purple-200/60';
    return 'bg-gray-100 text-gray-700 border-gray-200/60';
  };

  const hasFilters = selectedUser || selectedAction || selectedEntity || dateFrom || dateTo || successOnly;

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center fluid-gap-4">
            <Link to="/gerente" className="fluid-p-2 bg-white/15 rounded-fluid-lg hover:bg-white/25 transition-colors">
              <ArrowLeft className="fluid-icon-sm text-white" />
            </Link>
            <div className="fluid-p-3 bg-white/15 rounded-fluid-xl backdrop-blur-sm">
              <Activity className="fluid-icon-xl text-white" />
            </div>
            <div>
              <h1 className="fluid-text-3xl font-bold">Logs de Actividad</h1>
              <p className="fluid-text-base text-white/80">{totalLogs} registros</p>
            </div>
          </div>

          <div className="flex items-center fluid-gap-3">
            <Link
              to="/gerente/seguridad"
              className="hidden md:flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 bg-white/15 hover:bg-white/25 rounded-fluid-xl fluid-text-xs font-medium text-white transition-all"
            >
              <Shield className="fluid-icon-xs" /> Seguridad
            </Link>
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

      {/* ===== FILTROS ===== */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5 fluid-mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 fluid-gap-3">
          {/* Usuario */}
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

          {/* Acción */}
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

          {/* Entidad */}
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

          {/* Desde */}
          <div>
            <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="w-full fluid-py-2 fluid-px-3 bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-text-xs focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
            />
          </div>

          {/* Hasta */}
          <div>
            <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="w-full fluid-py-2 fluid-px-3 bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-text-xs focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
            />
          </div>

          {/* Estado */}
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

      {/* ===== TABLA ===== */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-center fluid-gap-2">
          <AlertCircle className="fluid-icon-sm text-red-500" />
          <p className="text-red-700 fluid-text-sm">{error}</p>
        </div>
      )}

      {loading ? (
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
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage <= 1}
                  className="fluid-px-2.5 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Primera
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="fluid-px-2.5 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="fluid-px-2.5 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Siguiente
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="fluid-px-2.5 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Última
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
