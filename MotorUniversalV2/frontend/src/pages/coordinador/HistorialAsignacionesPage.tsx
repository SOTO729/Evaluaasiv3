/**
 * Página de Historial de Asignaciones - Coordinador
 * 
 * Vista detallada de cada asignación de examen que consumió saldo.
 * Permite rastrear cada peso invertido: grupo, examen, candidatos, costo unitario y total.
 * Incluye vista de tabla detallada + movimientos estilo bancario.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  Filter,
  Calendar,
  Users,
  BookOpen,
  Wallet,
  TrendingDown,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  ClipboardList,
  Building2,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getAssignmentHistory,
  AssignmentHistoryResponse,
  formatCurrency,
  getMyBalance,
} from '../../services/balanceService';

type ViewMode = 'table' | 'movements';

export default function HistorialAsignacionesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AssignmentHistoryResponse | null>(null);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [refreshing, setRefreshing] = useState(false);

  // Filtros
  const [conceptFilter, setConceptFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadData();
  }, [currentPage, conceptFilter, dateFrom, dateTo]);

  const loadData = async () => {
    try {
      if (!refreshing) setLoading(true);
      setError(null);

      const [historyData, balanceData] = await Promise.all([
        getAssignmentHistory({
          page: currentPage,
          per_page: 20,
          concept: conceptFilter as any || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
        getMyBalance(),
      ]);

      setData(historyData);
      setCurrentBalance(balanceData.totals?.current_balance || 0);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el historial');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && !refreshing) {
    return <LoadingSpinner message="Cargando historial de asignaciones..." fullScreen />;
  }

  const transactions = data?.transactions || [];
  const summary = data?.summary || { total_assignments: 0, total_spent: 0 };

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/mi-saldo"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Mi Saldo
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <ClipboardList className="w-7 h-7 text-emerald-600" />
              Historial de Asignaciones
            </h1>
            <p className="text-gray-500 mt-1">
              Rastreo detallado de cada asignación y su consumo de saldo
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-gray-500">Saldo actual</p>
          </div>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(currentBalance)}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-sm text-gray-500">Total gastado en asignaciones</p>
          </div>
          <p className="text-2xl font-bold text-orange-700">{formatCurrency(summary.total_spent)}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm text-gray-500">Total de asignaciones</p>
          </div>
          <p className="text-2xl font-bold text-emerald-700">{summary.total_assignments}</p>
        </div>
      </div>

      {/* Filtros y toggle de vista */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={conceptFilter}
              onChange={(e) => { setConceptFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los tipos</option>
              <option value="asignacion_certificacion">Certificación</option>
              <option value="asignacion_retoma">Retoma</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Desde"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Hasta"
            />
          </div>

          {/* Toggle de vista */}
          <div className="ml-auto flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                viewMode === 'table' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Tabla
            </button>
            <button
              onClick={() => setViewMode('movements')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                viewMode === 'movements' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Movimientos
            </button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      {transactions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Sin asignaciones registradas</h3>
          <p className="text-gray-500">
            Aún no has realizado asignaciones que consuman saldo.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* ===== VISTA DE TABLA DETALLADA ===== */
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Grupo</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Examen / ECM</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Candidatos</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Costo unitario</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Saldo antes</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Saldo después</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(txn.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      {txn.assignment_details?.group ? (
                        <Link 
                          to={`/partners/groups/${txn.assignment_details.group.id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {txn.assignment_details.group.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {txn.assignment_details?.exam?.name || '-'}
                        </p>
                        {txn.assignment_details?.exam?.ecm_code && (
                          <p className="text-xs text-blue-600">
                            ECM: {txn.assignment_details.exam.ecm_code}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        {txn.assignment_details?.candidates_count || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-gray-600">
                      {txn.assignment_details?.unit_cost !== undefined 
                        ? formatCurrency(txn.assignment_details.unit_cost) 
                        : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-semibold text-red-600">
                        - {formatCurrency(txn.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-gray-500">
                      {formatCurrency(txn.balance_before)}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-gray-500">
                      {formatCurrency(txn.balance_after)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ===== VISTA DE MOVIMIENTOS (ESTILO BANCARIO) ===== */
        <div className="space-y-3">
          {transactions.map((txn) => (
            <div 
              key={txn.id}
              className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Icono + Info principal */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      {txn.concept_label || 'Asignación de certificación'}
                    </p>
                    {txn.assignment_details?.group && (
                      <div className="flex items-center gap-2 mt-1">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        <Link 
                          to={`/partners/groups/${txn.assignment_details.group.id}`}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          {txn.assignment_details.group.name}
                        </Link>
                      </div>
                    )}
                    {txn.assignment_details?.exam && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {txn.assignment_details.exam.name}
                          {txn.assignment_details.exam.ecm_code && (
                            <span className="text-blue-600 ml-1">
                              (ECM: {txn.assignment_details.exam.ecm_code})
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {txn.assignment_details && (
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {txn.assignment_details.candidates_count} candidato(s)
                        </span>
                        <span>
                          × {formatCurrency(txn.assignment_details.unit_cost)} c/u
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(txn.created_at)}
                    </p>
                  </div>
                </div>

                {/* Monto y saldo */}
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-red-600">
                    - {formatCurrency(txn.amount)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Saldo: {formatCurrency(txn.balance_before)} → {formatCurrency(txn.balance_after)}
                  </p>
                </div>
              </div>

              {/* Notas */}
              {txn.notes && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">{txn.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Paginación */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between mt-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">
            Mostrando página {data.current_page} de {data.pages} ({data.total} registros)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
              {currentPage}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(data.pages, currentPage + 1))}
              disabled={currentPage >= data.pages}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
