/**
 * Página de Historial de Reasignaciones
 * Muestra la trazabilidad completa de cada número de asignación y los
 * movimientos de candidatos que ha tenido dentro de un examen de grupo.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  History,
  Search,
  ArrowRight,
  User,
  Hash,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
  XCircle,
  X,
  Repeat2,
  ChevronDown,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import {
  getGroup,
  getSwapHistory,
  getSwapTimeline,
  CandidateGroup,
  SwapHistoryRecord,
  SwapTimelineEntry,
} from '../../services/partnersService';

type ViewMode = 'list' | 'timeline';

export default function SwapHistoryPage() {
  const { groupId, assignmentId } = useParams();
  const [searchParams] = useSearchParams();
  const assignmentName = searchParams.get('name') || '';

  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  // List view state
  const [records, setRecords] = useState<SwapHistoryRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Timeline view state
  const [timeline, setTimeline] = useState<SwapTimelineEntry[]>([]);
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const gId = Number(groupId);
  const examId = Number(assignmentId);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load group info
  useEffect(() => {
    if (!gId) return;
    getGroup(gId).then(setGroup).catch(console.error);
  }, [gId]);

  // Load data
  const loadData = useCallback(async () => {
    if (!gId || !examId) return;
    setLoading(true);
    setError(null);
    try {
      if (viewMode === 'timeline') {
        const data = await getSwapTimeline(gId, examId);
        let filtered = data.timeline;
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase();
          filtered = filtered.filter(t =>
            t.assignment_number.toLowerCase().includes(q) ||
            t.current_holder?.full_name?.toLowerCase().includes(q) ||
            t.moves.some(m =>
              m.from_user_name?.toLowerCase().includes(q) ||
              m.to_user_name?.toLowerCase().includes(q)
            )
          );
        }
        setTimeline(filtered);
      } else {
        const data = await getSwapHistory(gId, examId, {
          page: currentPage,
          per_page: 50,
          assignment_number: debouncedSearch || undefined,
          sort: 'performed_at',
          dir: 'desc',
        });
        setRecords(data.history);
        setTotalRecords(data.total);
        setTotalPages(data.pages);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error cargando historial';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [gId, examId, viewMode, currentPage, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page on search
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, viewMode]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading && !records.length && !timeline.length) {
    return <LoadingSpinner message="Cargando historial de reasignaciones..." fullScreen />;
  }

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb
        items={[
          { label: 'Socios', path: '/partners' },
          ...(group ? [{ label: group.name, path: `/partners/groups/${gId}` }] : []),
          { label: assignmentName || 'Examen', path: `/partners/groups/${gId}/assignments/${examId}/detail` },
          { label: 'Historial de Reasignaciones' },
        ]}
      />

      {/* ===== HEADER CON GRADIENTE ===== */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
            <div className="flex items-center fluid-gap-4">
              <Link
                to={`/partners/groups/${gId}/assignments/${examId}/edit-members?name=${encodeURIComponent(assignmentName)}`}
                className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors"
                title="Volver a miembros"
              >
                <ArrowLeft className="fluid-icon-lg" />
              </Link>
              <div>
                {assignmentName && (
                  <p className="fluid-text-sm text-white/80 fluid-mb-1">{assignmentName}</p>
                )}
                <h1 className="fluid-text-2xl font-bold flex items-center fluid-gap-3">
                  <History className="fluid-icon-lg" />
                  Historial de Reasignaciones
                </h1>
                <p className="fluid-text-sm text-white/70 fluid-mt-1">
                  Trazabilidad completa de movimientos de números de asignación
                </p>
              </div>
            </div>
            <div className="flex items-center fluid-gap-2">
              <button
                onClick={loadData}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 text-white rounded-fluid-xl font-medium fluid-text-sm transition-colors backdrop-blur-sm"
              >
                <RefreshCw className="fluid-icon-sm" />
                Actualizar
              </button>
            </div>
          </div>


        </div>
      </div>

      {/* ===== MENSAJES DE ESTADO ===== */}
      {error && (
        <div className="fluid-mb-4">
          <div className="fluid-p-3 bg-red-50 border border-red-200 rounded-fluid-lg flex items-center fluid-gap-2 text-red-700">
            <XCircle className="fluid-icon flex-shrink-0" />
            <p className="fluid-text-sm flex-1">{error}</p>
            <button onClick={() => setError(null)}>
              <X className="fluid-icon-sm" />
            </button>
          </div>
        </div>
      )}

      {/* ===== BARRA DE HERRAMIENTAS ===== */}
      <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 fluid-mb-5">
        <div className="flex flex-wrap items-center fluid-gap-3">
          {/* View tabs */}
          <div className="flex rounded-fluid-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('timeline')}
              className={`inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-2 fluid-text-sm font-medium transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FileSpreadsheet className="fluid-icon-sm" />
              Por Asignación
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-2 fluid-text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Clock className="fluid-icon-sm" />
              Cronológico
            </button>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[250px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por N° asignación o nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full fluid-pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 fluid-text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== CONTENIDO ===== */}
      {loading ? (
        <div className="fluid-py-12 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : viewMode === 'timeline' ? (
        /* ============== TIMELINE VIEW ============== */
        <div>
          {timeline.length === 0 ? (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-fluid-2xl border-2 border-dashed border-purple-200 fluid-p-12 text-center">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                <History className="w-7 h-7 text-purple-400" />
              </div>
              <p className="text-gray-600 font-medium fluid-text-base fluid-mb-1">
                No hay reasignaciones registradas
              </p>
              <p className="text-gray-400 fluid-text-sm">
                El historial se registrará automáticamente con las próximas reasignaciones
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map((entry) => (
                <div
                  key={entry.assignment_number}
                  className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-300"
                >
                  {/* Assignment header */}
                  <button
                    onClick={() => setExpandedAssignment(expandedAssignment === entry.assignment_number ? null : entry.assignment_number)}
                    className="w-full fluid-px-5 fluid-py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center fluid-gap-3 flex-wrap">
                      <div className="inline-flex items-center fluid-gap-1 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 fluid-px-3 fluid-py-1 rounded-fluid-lg font-mono fluid-text-sm font-bold border border-purple-200">
                        <Hash className="w-3.5 h-3.5" />
                        {entry.assignment_number}
                      </div>
                      <span className="fluid-text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                        {entry.moves.length} movimiento{entry.moves.length !== 1 ? 's' : ''}
                      </span>
                      {entry.current_holder && (
                        <span className="fluid-text-sm text-gray-600 flex items-center fluid-gap-1">
                          <User className="w-3.5 h-3.5" />
                          Actual: <span className="font-medium text-gray-800">{entry.current_holder.full_name}</span>
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      className={`fluid-icon-sm text-gray-400 transition-transform duration-200 ${
                        expandedAssignment === entry.assignment_number ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Expanded timeline */}
                  {expandedAssignment === entry.assignment_number && (
                    <div className="fluid-px-5 fluid-pb-5 border-t border-gray-100">
                      <div className="relative fluid-mt-4 ml-4">
                        {/* Vertical line */}
                        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-300 to-indigo-200" />

                        {entry.moves.map((move, idx) => (
                          <div key={move.id} className="relative pl-9 pb-5 last:pb-0">
                            {/* Dot */}
                            <div
                              className={`absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                                idx === entry.moves.length - 1
                                  ? 'bg-gradient-to-br from-purple-500 to-indigo-600 border-purple-400 shadow-sm shadow-purple-300'
                                  : 'bg-white border-purple-300'
                              }`}
                            />

                            <div className="bg-gradient-to-r from-gray-50 to-white rounded-fluid-lg fluid-p-4 border border-gray-100 hover:border-gray-200 transition-colors">
                              <div className="flex flex-wrap items-center fluid-gap-2 fluid-text-sm">
                                {/* From */}
                                <span className="font-medium text-red-600 flex items-center fluid-gap-1 bg-red-50 fluid-px-2 py-0.5 rounded-fluid-lg">
                                  <User className="w-3.5 h-3.5" />
                                  {move.from_user_name || move.from_user_id}
                                </span>
                                <ArrowRight className="fluid-icon-sm text-gray-400" />
                                {/* To */}
                                <span className="font-medium text-green-600 flex items-center fluid-gap-1 bg-green-50 fluid-px-2 py-0.5 rounded-fluid-lg">
                                  <User className="w-3.5 h-3.5" />
                                  {move.to_user_name || move.to_user_id}
                                </span>

                                {/* Type badge */}
                                <span className={`fluid-text-xs px-2 py-0.5 rounded-full font-medium ${
                                  move.swap_type === 'bulk'
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                                }`}>
                                  {move.swap_type === 'bulk' ? (
                                    <span className="flex items-center fluid-gap-1">
                                      <Repeat2 className="w-3 h-3" />
                                      Masiva
                                    </span>
                                  ) : 'Individual'}
                                </span>
                              </div>

                              <div className="fluid-mt-2 flex flex-wrap items-center fluid-gap-3 fluid-text-xs text-gray-500">
                                <span className="flex items-center fluid-gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(move.performed_at)}
                                </span>
                                {move.performed_by_name && (
                                  <span>
                                    Por: <span className="font-medium text-gray-700">{move.performed_by_name}</span>
                                  </span>
                                )}
                                {move.from_user_email && (
                                  <span className="text-gray-400">{move.from_user_email}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ============== LIST VIEW ============== */
        <div>
          {records.length === 0 ? (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-fluid-2xl border-2 border-dashed border-purple-200 fluid-p-12 text-center">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                <History className="w-7 h-7 text-purple-400" />
              </div>
              <p className="text-gray-600 font-medium fluid-text-base fluid-mb-1">
                No hay reasignaciones registradas
              </p>
              <p className="text-gray-400 fluid-text-sm">
                El historial se registrará automáticamente con las próximas reasignaciones
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Table header info */}
                <div className="fluid-px-5 fluid-py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
                  <p className="fluid-text-sm text-gray-600 font-medium">
                    <span className="text-gray-900 font-bold">{totalRecords}</span> reasignación(es) registrada(s)
                  </p>
                  {totalPages > 1 && (
                    <span className="fluid-text-xs text-gray-500">
                      Página {currentPage} de {totalPages}
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 fluid-text-sm">
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="fluid-px-4 fluid-py-3 text-left font-semibold text-gray-600 fluid-text-xs uppercase tracking-wider">Fecha</th>
                        <th className="fluid-px-4 fluid-py-3 text-left font-semibold text-gray-600 fluid-text-xs uppercase tracking-wider">N° Asignación</th>
                        <th className="fluid-px-4 fluid-py-3 text-left font-semibold text-gray-600 fluid-text-xs uppercase tracking-wider">Origen</th>
                        <th className="fluid-px-4 fluid-py-3 text-center font-semibold text-gray-600 fluid-text-xs uppercase tracking-wider w-10"></th>
                        <th className="fluid-px-4 fluid-py-3 text-left font-semibold text-gray-600 fluid-text-xs uppercase tracking-wider">Destino</th>
                        <th className="fluid-px-4 fluid-py-3 text-left font-semibold text-gray-600 fluid-text-xs uppercase tracking-wider">Ejecutado por</th>
                        <th className="fluid-px-4 fluid-py-3 text-center font-semibold text-gray-600 fluid-text-xs uppercase tracking-wider">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {records.map((r) => (
                        <tr key={r.id} className="hover:bg-purple-50/30 transition-colors">
                          <td className="fluid-px-4 fluid-py-3 whitespace-nowrap text-gray-500 fluid-text-xs">
                            <span className="flex items-center fluid-gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(r.performed_at)}
                            </span>
                          </td>
                          <td className="fluid-px-4 fluid-py-3 whitespace-nowrap">
                            <span className="font-mono fluid-text-xs font-bold bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 fluid-px-2 py-1 rounded-fluid-lg border border-purple-200">
                              {r.assignment_number}
                            </span>
                          </td>
                          <td className="fluid-px-4 fluid-py-3">
                            <div className="flex items-center fluid-gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-400 to-red-500 flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                                {(r.from_user_name || '?')[0]?.toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium text-gray-800 fluid-text-xs">{r.from_user_name || '—'}</div>
                                {r.from_user_email && <div className="text-gray-400 fluid-text-xs">{r.from_user_email}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="fluid-px-4 fluid-py-3 text-center">
                            <ArrowRight className="fluid-icon-sm text-gray-400 mx-auto" />
                          </td>
                          <td className="fluid-px-4 fluid-py-3">
                            <div className="flex items-center fluid-gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                                {(r.to_user_name || '?')[0]?.toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium text-gray-800 fluid-text-xs">{r.to_user_name || '—'}</div>
                                {r.to_user_email && <div className="text-gray-400 fluid-text-xs">{r.to_user_email}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="fluid-px-4 fluid-py-3 fluid-text-xs text-gray-600">
                            {r.performed_by_name || '—'}
                          </td>
                          <td className="fluid-px-4 fluid-py-3 text-center">
                            <span className={`inline-flex items-center fluid-gap-1 fluid-text-xs px-2 py-0.5 rounded-full font-medium ${
                              r.swap_type === 'bulk'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}>
                              {r.swap_type === 'bulk' ? (
                                <>
                                  <Repeat2 className="w-3 h-3" />
                                  Masiva
                                </>
                              ) : 'Individual'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="fluid-mt-4 flex items-center justify-between">
                  <span className="fluid-text-xs text-gray-500">
                    Página <span className="font-medium text-gray-700">{currentPage}</span> de <span className="font-medium text-gray-700">{totalPages}</span>
                  </span>
                  <div className="flex items-center fluid-gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="fluid-p-2 border border-gray-300 rounded-fluid-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="fluid-icon-sm" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="fluid-p-2 border border-gray-300 rounded-fluid-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="fluid-icon-sm" />
                    </button>
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
