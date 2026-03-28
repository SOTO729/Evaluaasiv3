/**
 * Página de Reportes del Plantel para el Responsable
 * Muestra tabla de evaluaciones con filtros, búsqueda y exportación a Excel
 * Muestra hasta 100 registros por página
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  getMiPlantelEvaluations, 
  getMiPlantelExams,
  getMiPlantelGroups,
  exportMiPlantelEvaluations,
  getMiPlantel,
  PlantelEvaluation
} from '../../services/partnersService';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';

const TRAMITE_LABELS: Record<string, { text: string; color: string }> = {
  pendiente: { text: 'Pendiente', color: 'bg-gray-100 text-gray-700' },
  en_tramite: { text: 'En trámite', color: 'bg-primary-100 text-primary-700' },
  entregado: { text: 'Entregado', color: 'bg-green-100 text-green-700' },
};

const MiPlantelReportesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Obtener logo del plantel (usa cache de Layout)
  const { data: plantelData } = useQuery({
    queryKey: ['mi-plantel'],
    queryFn: getMiPlantel,
    staleTime: 5 * 60 * 1000,
  });
  const campusLogo = plantelData?.campus?.logo_url;

  useEffect(() => {
    if (!user?.can_view_reports) navigate('/mi-plantel', { replace: true });
  }, [user, navigate]);

  const [evaluations, setEvaluations] = useState<PlantelEvaluation[]>([]);
  const [exams, setExams] = useState<{ id: number; name: string; version: string }[]>([]);
  const [groups, setGroups] = useState<{ id: number; name: string; is_active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Paginación
  const [page, setPage] = useState(1);
  const perPage = 100;
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  
  // Filtros
  const [selectedExam, setSelectedExam] = useState<number | ''>('');
  const [selectedResult, setSelectedResult] = useState<number | ''>('');
  const [selectedGroup, setSelectedGroup] = useState<number | ''>('');
  const [searchText, setSearchText] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(searchText);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadEvaluations();
  }, [page, selectedExam, selectedResult, selectedGroup, searchDebounced]);

  const loadFilters = async () => {
    try {
      const [examsRes, groupsRes] = await Promise.all([
        getMiPlantelExams(),
        getMiPlantelGroups()
      ]);
      setExams(examsRes.exams);
      setGroups(groupsRes.groups);
    } catch (err) {
      console.error('Error loading filters:', err);
    }
  };

  const loadEvaluations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: Record<string, string | number> = { page, per_page: perPage };
      if (selectedExam !== '') params.exam_id = selectedExam;
      if (selectedResult !== '') params.result = selectedResult;
      if (selectedGroup !== '') params.group_id = selectedGroup;
      if (searchDebounced) params.search = searchDebounced;
      
      const response = await getMiPlantelEvaluations(params);
      
      setEvaluations(response.evaluations);
      setTotal(response.total);
      setTotalPages(response.pages);
    } catch (err: any) {
      console.error('Error loading evaluations:', err);
      setError(err.response?.data?.error || 'Error al cargar las evaluaciones');
    } finally {
      setLoading(false);
    }
  }, [page, selectedExam, selectedResult, selectedGroup, searchDebounced]);

  const handleExport = async () => {
    try {
      setExporting(true);
      
      const params: Record<string, string | number> = {};
      if (selectedExam !== '') params.exam_id = selectedExam;
      if (selectedResult !== '') params.result = selectedResult;
      if (selectedGroup !== '') params.group_id = selectedGroup;
      if (searchDebounced) params.search = searchDebounced;
      
      const blob = await exportMiPlantelEvaluations(params);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Evaluaciones_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Error exporting:', err);
      setError('Error al exportar el reporte');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSelectedExam('');
    setSelectedResult('');
    setSelectedGroup('');
    setSearchText('');
    setPage(1);
  };

  const hasActiveFilters = selectedExam !== '' || selectedResult !== '' || selectedGroup !== '' || searchText !== '';

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/mi-plantel"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Volver"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {campusLogo ? (
                  <img src={campusLogo} alt="Plantel" className="h-10 w-auto object-contain" />
                ) : (
                  <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                )}
                Reportes de Evaluaciones
              </h1>
              <p className="text-gray-500 mt-0.5 text-sm">
                {loading ? 'Cargando...' : `${total} evaluación${total !== 1 ? 'es' : ''} encontrada${total !== 1 ? 's' : ''}`}
                {hasActiveFilters && ' (filtrado)'}
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="inline-flex items-center px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm shadow-sm"
          >
            {exporting ? (
              <>
                <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exportando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportar Excel
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Búsqueda */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Buscar candidato</label>
            <div className="relative">
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Nombre, CURP o email..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Grupo */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Grupo</label>
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value ? Number(e.target.value) : '');
                setPage(1);
              }}
              className="w-full border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Todos los grupos</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}{!g.is_active ? ' (inactivo)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Examen */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Examen</label>
            <select
              value={selectedExam}
              onChange={(e) => {
                setSelectedExam(e.target.value ? Number(e.target.value) : '');
                setPage(1);
              }}
              className="w-full border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Todos</option>
              {exams.map(exam => (
                <option key={exam.id} value={exam.id}>{exam.name}</option>
              ))}
            </select>
          </div>

          {/* Resultado */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Resultado</label>
            <div className="flex gap-2">
              <select
                value={selectedResult}
                onChange={(e) => {
                  setSelectedResult(e.target.value !== '' ? Number(e.target.value) : '');
                  setPage(1);
                }}
                className="flex-1 border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Todos</option>
                <option value="1">Aprobado</option>
                <option value="0">Reprobado</option>
              </select>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-gray-200"
                  title="Limpiar filtros"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-12">
            <LoadingSpinner message="Cargando evaluaciones..." />
          </div>
        ) : evaluations.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No hay evaluaciones</h3>
            <p className="text-gray-500 text-sm">
              {hasActiveFilters
                ? 'No se encontraron evaluaciones con los filtros seleccionados'
                : 'Aún no hay evaluaciones completadas en tu plantel'}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-3 text-sm text-primary-600 hover:text-primary-800 font-medium">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Candidato</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">CURP</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Grupo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Examen</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estándar</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Calif.</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Resultado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Trámite</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Duración</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Docs</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {evaluations.map((ev, idx) => (
                    <tr key={ev.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900 truncate max-w-[180px]" title={ev.candidate?.full_name || ''}>
                          {ev.candidate?.full_name || '-'}
                        </div>
                        <div className="text-xs text-gray-400 truncate max-w-[180px]">
                          {ev.candidate?.email || ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-mono text-gray-600">{ev.candidate?.curp || '-'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-gray-700 truncate max-w-[140px] block" title={ev.group?.name || ''}>
                          {ev.group?.name || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-gray-900 truncate max-w-[160px]" title={ev.exam?.name || ''}>
                          {ev.exam?.name || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {ev.standard ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-50 text-primary-700" title={ev.standard.name}>
                            {ev.standard.code}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className="text-base font-bold text-gray-900">{ev.score}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          ev.result === 1 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {ev.result_text}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {ev.tramite_status ? (
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            TRAMITE_LABELS[ev.tramite_status]?.color || 'bg-gray-100 text-gray-600'
                          }`}>
                            {TRAMITE_LABELS[ev.tramite_status]?.text || ev.tramite_status}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-gray-700 text-xs">{formatDate(ev.end_date)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className="text-gray-600 text-xs">{formatDuration(ev.duration_seconds)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {ev.report_url ? (
                            <a
                              href={ev.report_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                              title="Ver reporte PDF"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </a>
                          ) : (
                            <span className="p-1.5 text-gray-300">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </span>
                          )}
                          {ev.certificate_url && ev.result === 1 ? (
                            <a
                              href={ev.certificate_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title={ev.certificate_code ? `Certificado: ${ev.certificate_code}` : 'Ver certificado'}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                              </svg>
                            </a>
                          ) : (
                            <span className="p-1.5 text-gray-300">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-gray-500">
                Mostrando {Math.min((page - 1) * perPage + 1, total)}-{Math.min(page * perPage, total)} de {total} resultados
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="px-2.5 py-1.5 border rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 border rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-gray-600 px-2">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 border rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    Siguiente
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="px-2.5 py-1.5 border rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    »
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MiPlantelReportesPage;
