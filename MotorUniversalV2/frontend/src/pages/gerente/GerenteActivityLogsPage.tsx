/**
 * Página de Logs de Actividad del Personal
 * 
 * El gerente puede ver todas las acciones realizadas
 * por usuarios de tipo "personal" (admin, gerente, financiero, coordinador)
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
  
  // Filters
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [successOnly, setSuccessOnly] = useState<boolean | undefined>(undefined);
  
  const [refreshing, setRefreshing] = useState(false);

  const perPage = 20;

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [currentPage, selectedUser, selectedAction, selectedEntity, dateFrom, dateTo, successOnly]);

  const loadInitialData = async () => {
    try {
      const users = await getPersonalUsers();
      setPersonalUsers(users.users);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getActivityLogs({
        page: currentPage,
        per_page: perPage,
        user_id: selectedUser || undefined,
        action_type: selectedAction || undefined,
        entity_type: selectedEntity || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        success: successOnly,
      });

      setLogs(data.logs);
      setTotalLogs(data.total);
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
    setSuccessOnly(undefined);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalLogs / perPage);

  const getActionIcon = (actionType: string, success: boolean) => {
    if (!success) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    switch (actionType) {
      case 'login':
      case 'logout':
        return <User className="w-4 h-4 text-blue-500" />;
      case 'create':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'delete':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'balance_approve':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'balance_reject':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActionBadgeColor = (actionType: string) => {
    if (actionType.includes('login') || actionType.includes('logout')) {
      return 'bg-blue-100 text-blue-700';
    }
    if (actionType.includes('create')) {
      return 'bg-green-100 text-green-700';
    }
    if (actionType.includes('delete') || actionType.includes('reject')) {
      return 'bg-red-100 text-red-700';
    }
    if (actionType.includes('approve')) {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (actionType.includes('update') || actionType.includes('review')) {
      return 'bg-yellow-100 text-yellow-700';
    }
    return 'bg-gray-100 text-gray-700';
  };

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
              <Activity className="w-8 h-8 text-blue-600" />
              Logs de Actividad
            </h1>
            <p className="text-gray-600 mt-1">
              Historial de acciones del personal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/gerente/seguridad"
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Shield className="w-5 h-5" />
            Seguridad
          </Link>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* User Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Usuario</label>
            <select
              value={selectedUser}
              onChange={(e) => { setSelectedUser(e.target.value); setCurrentPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {personalUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.role})
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Acción</label>
            <select
              value={selectedAction}
              onChange={(e) => { setSelectedAction(e.target.value); setCurrentPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              {Object.entries(ACTION_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Entity Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Entidad</label>
            <select
              value={selectedEntity}
              onChange={(e) => { setSelectedEntity(e.target.value); setCurrentPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              {Object.entries(ENTITY_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Success Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
            <select
              value={successOnly === undefined ? '' : successOnly.toString()}
              onChange={(e) => {
                const val = e.target.value;
                setSuccessOnly(val === '' ? undefined : val === 'true');
                setCurrentPage(1);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="true">Exitosos</option>
              <option value="false">Fallidos</option>
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        <div className="mt-3 flex justify-end">
          <button
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadLogs}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            No hay registros de actividad
          </h3>
          <p className="text-gray-500">
            No se encontraron logs con los filtros seleccionados
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="mb-4 text-sm text-gray-500">
            {totalLogs} registros encontrados
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Fecha/Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Usuario
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Acción
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Entidad
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Detalles
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(log.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {log.user?.full_name || log.user_email || 'Sistema'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {log.user_role || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getActionBadgeColor(log.action_type)}`}>
                          {getActionIcon(log.action_type, log.success)}
                          {log.action_type_label || log.action_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-gray-900">
                            {log.entity_type_label || log.entity_type || '-'}
                          </p>
                          {log.entity_name && (
                            <p className="text-xs text-gray-500">{log.entity_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs">
                          {log.details && Object.keys(log.details).length > 0 ? (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                Ver detalles
                              </summary>
                              <pre className="mt-2 p-2 bg-gray-50 rounded text-gray-600 overflow-auto max-h-32">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.success ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="w-3 h-3" />
                            Exitoso
                          </span>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 text-xs text-red-600">
                              <XCircle className="w-3 h-3" />
                              Fallido
                            </span>
                            {log.error_message && (
                              <p className="text-xs text-red-500 mt-1 max-w-32 truncate" title={log.error_message}>
                                {log.error_message}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
                >
                  Primera
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Siguiente
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
                >
                  Última
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
