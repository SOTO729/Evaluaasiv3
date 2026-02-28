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
  AlertCircle,
  Search,
  ArrowRight,
  User,
  Hash,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
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
  const [totalMoves, setTotalMoves] = useState(0);
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
        setTotalMoves(data.total_moves);
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

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <PartnersBreadcrumb
        items={[
          { label: 'Socios', path: '/partners' },
          ...(group ? [{ label: group.name, path: `/partners/groups/${gId}` }] : []),
          { label: assignmentName || 'Examen', path: `/partners/groups/${gId}/assignments/${examId}/detail` },
          { label: 'Historial de Reasignaciones' },
        ]}
      />

      {/* Header */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to={`/partners/groups/${gId}/assignments/${examId}/edit-members?name=${encodeURIComponent(assignmentName)}`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Volver a miembros"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-600" />
              Historial de Reasignaciones
            </h1>
            <p className="text-sm text-gray-500">
              {assignmentName && <span className="font-medium">{assignmentName}</span>}
              {assignmentName && ' — '}
              Trazabilidad de movimientos de números de asignación
            </p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* View mode toggle + search */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* View tabs */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'timeline' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            <FileSpreadsheet className="w-4 h-4 inline mr-1" />
            Por Asignación
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            <Clock className="w-4 h-4 inline mr-1" />
            Cronológico
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por N° asignación o nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="mt-8 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      ) : viewMode === 'timeline' ? (
        /* ============== TIMELINE VIEW ============== */
        <div className="mt-4">
          {timeline.length === 0 ? (
            <div className="mt-8 text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <History className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No hay reasignaciones registradas para este examen</p>
              <p className="text-gray-400 text-xs mt-1">El historial se registrará con las próximas reasignaciones</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                <span className="font-medium">{timeline.length}</span> número(s) de asignación con movimientos
                {' — '}
                <span className="font-medium">{totalMoves}</span> reasignación(es) total(es)
              </p>

              {timeline.map((entry) => (
                <div
                  key={entry.assignment_number}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm"
                >
                  {/* Assignment header */}
                  <button
                    onClick={() => setExpandedAssignment(expandedAssignment === entry.assignment_number ? null : entry.assignment_number)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-purple-100 text-purple-700 px-2.5 py-1 rounded-md font-mono text-sm font-bold">
                        <Hash className="w-3.5 h-3.5" />
                        {entry.assignment_number}
                      </div>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {entry.moves.length} movimiento{entry.moves.length !== 1 ? 's' : ''}
                      </span>
                      {entry.current_holder && (
                        <span className="text-sm text-gray-600 flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          Actual: <span className="font-medium">{entry.current_holder.full_name}</span>
                        </span>
                      )}
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedAssignment === entry.assignment_number ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {/* Expanded timeline */}
                  {expandedAssignment === entry.assignment_number && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="relative mt-3 ml-4">
                        {/* Vertical line */}
                        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-purple-200" />

                        {entry.moves.map((move, idx) => (
                          <div key={move.id} className="relative pl-8 pb-5 last:pb-0">
                            {/* Dot */}
                            <div className={`absolute left-1.5 top-1 w-3 h-3 rounded-full border-2 ${idx === entry.moves.length - 1 ? 'bg-purple-600 border-purple-600' : 'bg-white border-purple-400'}`} />

                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                {/* From */}
                                <span className="font-medium text-red-600 flex items-center gap-1">
                                  <User className="w-3.5 h-3.5" />
                                  {move.from_user_name || move.from_user_id}
                                </span>
                                <ArrowRight className="w-4 h-4 text-gray-400" />
                                {/* To */}
                                <span className="font-medium text-green-600 flex items-center gap-1">
                                  <User className="w-3.5 h-3.5" />
                                  {move.to_user_name || move.to_user_id}
                                </span>

                                {/* Type badge */}
                                <span className={`text-xs px-1.5 py-0.5 rounded ${move.swap_type === 'bulk' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {move.swap_type === 'bulk' ? 'Masiva' : 'Individual'}
                                </span>
                              </div>

                              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(move.performed_at)}
                                </span>
                                {move.performed_by_name && (
                                  <span>
                                    Por: <span className="font-medium">{move.performed_by_name}</span>
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
        <div className="mt-4">
          {records.length === 0 ? (
            <div className="mt-8 text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <History className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No hay reasignaciones registradas</p>
            </div>
          ) : (
            <>
              <div className="mb-2 text-sm text-gray-500">
                <span className="font-medium">{totalRecords}</span> reasignación(es) total(es)
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Fecha</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">N° Asignación</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Origen</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600"></th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Destino</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Ejecutado por</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {records.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">
                          {formatDate(r.performed_at)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">
                            {r.assignment_number}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-red-600 text-xs">{r.from_user_name || '—'}</div>
                          {r.from_user_email && <div className="text-gray-400 text-xs">{r.from_user_email}</div>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <ArrowRight className="w-4 h-4 text-gray-400 mx-auto" />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-green-600 text-xs">{r.to_user_name || '—'}</div>
                          {r.to_user_email && <div className="text-gray-400 text-xs">{r.to_user_email}</div>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {r.performed_by_name || '—'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${r.swap_type === 'bulk' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            {r.swap_type === 'bulk' ? 'Masiva' : 'Individual'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Página {currentPage} de {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
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
