/**
 * Página de Detalle de Asignaciones por ECM
 * 
 * Muestra todas las asignaciones individuales de un ECM específico:
 * usuario, examen, grupo, campus, costo, calificación, progreso de materiales.
 * Filtros por tipo de usuario, estado, grupo, examen, fecha.
 * Accesible por admin y coordinator.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  AlertCircle,
  Users,
  Wallet,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  BarChart3,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  Minus,
  Building2,
  MapPin,
  ArrowUpDown,
  BadgeCheck,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getEcmAssignmentDetail,
  EcmAssignmentDetail,
  EcmAssignmentDetailResponse,
} from '../../services/partnersService';
import { formatCurrency } from '../../services/balanceService';

export default function EcmAssignmentDetailPage() {
  const { ecmId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EcmAssignmentDetailResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [userType, setUserType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [groupId, setGroupId] = useState<number | undefined>();
  const [examId, setExamId] = useState<number | undefined>();
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const loadData = useCallback(async () => {
    if (!ecmId) return;
    try {
      if (!refreshing) setLoading(true);
      setError(null);
      const result = await getEcmAssignmentDetail(Number(ecmId), {
        page,
        per_page: 30,
        search: search || undefined,
        user_type: userType !== 'all' ? userType : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        group_id: groupId,
        exam_id: examId,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ecmId, page, search, userType, statusFilter, dateFrom, dateTo, groupId, examId, sortBy, sortDir, refreshing]);

  useEffect(() => {
    loadData();
  }, [page, userType, statusFilter, groupId, examId, sortBy, sortDir]);

  const handleSearch = () => {
    setPage(1);
    loadData();
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setUserType('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setGroupId(undefined);
    setExamId(undefined);
    setSortBy('date');
    setSortDir('desc');
    setPage(1);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (a: EcmAssignmentDetail) => {
    if (a.result_status === 'completed') {
      if (a.passed) {
        return (
          <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-green-100 text-green-700 rounded-full fluid-text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Aprobado
          </span>
        );
      }
      return (
        <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-red-100 text-red-700 rounded-full fluid-text-xs font-medium">
          <XCircle className="w-3 h-3" />
          Reprobado
        </span>
      );
    }
    if (a.result_status === 'in_progress') {
      return (
        <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-amber-100 text-amber-700 rounded-full fluid-text-xs font-medium">
          <Clock className="w-3 h-3" />
          En curso
        </span>
      );
    }
    return (
      <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-gray-100 text-gray-600 rounded-full fluid-text-xs font-medium">
        <Minus className="w-3 h-3" />
        Pendiente
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      candidato: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Candidato' },
      responsable: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Responsable' },
      coordinator: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Coordinador' },
      admin: { bg: 'bg-red-100', text: 'text-red-700', label: 'Admin' },
    };
    const c = config[role] || { bg: 'bg-gray-100', text: 'text-gray-700', label: role };
    return (
      <span className={`inline-flex items-center fluid-px-2 fluid-py-1 ${c.bg} ${c.text} rounded-full fluid-text-xs font-medium`}>
        {c.label}
      </span>
    );
  };

  const getMaterialBar = (progress: EcmAssignmentDetail['material_progress']) => {
    if (!progress) return <span className="fluid-text-xs text-gray-400">Sin materiales</span>;
    const pct = progress.percentage;
    const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400';
    return (
      <div className="w-full">
        <div className="flex items-center justify-between fluid-text-xs mb-1">
          <span className={`font-medium ${pct >= 100 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {pct}%
          </span>
          <span className="text-gray-400">{progress.completed}/{progress.total}</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>
    );
  };

  if (loading) return <LoadingSpinner />;

  const ecm = data?.ecm;
  const summary = data?.summary;
  const assignments = data?.assignments || [];
  const filters = data?.filters;

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex items-center justify-between flex-wrap fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <Link
              to="/asignaciones-ecm"
              className="p-2 rounded-fluid-xl bg-white/10 hover:bg-white/20 transition-all"
            >
              <ArrowLeft className="fluid-icon-base" />
            </Link>
            <div>
              <div className="flex items-center fluid-gap-2 flex-wrap">
                <span className="fluid-px-3 fluid-py-1 bg-white/20 rounded-fluid-lg font-bold fluid-text-sm">
                  {ecm?.code}
                </span>
                {ecm?.level && (
                  <span className="fluid-px-2 fluid-py-1 bg-white/10 rounded-fluid-lg fluid-text-xs">
                    Nivel {ecm.level}
                  </span>
                )}
              </div>
              <h1 className="fluid-text-xl font-bold mt-1">{ecm?.name}</h1>
              {ecm?.sector && (
                <p className="fluid-text-sm text-white/70 mt-0.5">{ecm.sector} • {ecm?.certifying_body}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="fluid-px-4 fluid-py-2 bg-white/10 hover:bg-white/20 rounded-fluid-xl flex items-center fluid-gap-2 fluid-text-sm transition-all"
          >
            <RefreshCw className={`fluid-icon-sm ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-start fluid-gap-3">
          <AlertCircle className="fluid-icon-base text-red-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-700 fluid-text-base">Error</p>
            <p className="fluid-text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Tarjetas de resumen */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 fluid-gap-4 fluid-mb-6">
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-4">
            <div className="flex items-center fluid-gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-fluid-xl flex items-center justify-center">
                <Users className="fluid-icon-base text-blue-600" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500">Total asignaciones</p>
                <p className="fluid-text-xl font-bold text-gray-900">{summary.total_assignments}</p>
                <p className="fluid-text-xs text-gray-400">{summary.total_candidates} candidatos únicos</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-4">
            <div className="flex items-center fluid-gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-fluid-xl flex items-center justify-center">
                <Wallet className="fluid-icon-base text-green-600" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500">Inversión total</p>
                <p className="fluid-text-xl font-bold text-green-700">{formatCurrency(summary.total_cost)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-4">
            <div className="flex items-center fluid-gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-fluid-xl flex items-center justify-center">
                <BarChart3 className="fluid-icon-base text-amber-600" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500">Promedio</p>
                <p className="fluid-text-xl font-bold text-gray-900">
                  {summary.avg_score !== null ? `${summary.avg_score}%` : '—'}
                </p>
                <p className="fluid-text-xs text-gray-400">{summary.completed_count} completados</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-4">
            <div className="flex items-center fluid-gap-3">
              <div className={`w-10 h-10 rounded-fluid-xl flex items-center justify-center ${
                summary.pass_rate !== null && summary.pass_rate >= 70 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <ShieldCheck className={`fluid-icon-base ${
                  summary.pass_rate !== null && summary.pass_rate >= 70 ? 'text-green-600' : 'text-red-600'
                }`} />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500">Tasa de aprobación</p>
                <p className={`fluid-text-xl font-bold ${
                  summary.pass_rate !== null && summary.pass_rate >= 70 ? 'text-green-700' : 'text-red-700'
                }`}>
                  {summary.pass_rate !== null ? `${summary.pass_rate}%` : '—'}
                </p>
                <p className="fluid-text-xs text-gray-400">
                  {summary.passed_count} aprobados / {summary.pending_count} pendientes
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5 fluid-mb-6">
        {/* Búsqueda + toggle filtros */}
        <div className="flex items-center fluid-gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  handleSearch();
                }
              }}
              className="w-full pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm"
            />
          </div>
          <button
            onClick={handleSearch}
            className="fluid-px-4 fluid-py-2 bg-blue-600 text-white rounded-fluid-xl hover:bg-blue-700 fluid-text-sm font-medium shadow-lg transition-all"
          >
            Buscar
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`fluid-px-4 fluid-py-2 rounded-fluid-xl flex items-center fluid-gap-2 fluid-text-sm font-medium transition-all ${
              showFilters ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="fluid-icon-sm" />
            Filtros
          </button>
          {(userType !== 'all' || statusFilter !== 'all' || dateFrom || dateTo || groupId || examId) && (
            <button
              onClick={clearFilters}
              className="fluid-px-3 fluid-py-2 text-red-600 hover:bg-red-50 rounded-fluid-xl fluid-text-xs font-medium transition-all"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Panel de filtros expandible */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 fluid-gap-3">
            <div>
              <label className="fluid-text-xs font-medium text-gray-500 mb-1 block">Tipo de usuario</label>
              <select
                value={userType}
                onChange={(e) => { setUserType(e.target.value); setPage(1); }}
                className="w-full fluid-py-2 fluid-px-3 border border-gray-300 rounded-fluid-lg fluid-text-sm"
              >
                <option value="all">Todos</option>
                <option value="candidato">Candidatos</option>
                <option value="responsable">Responsables</option>
              </select>
            </div>
            <div>
              <label className="fluid-text-xs font-medium text-gray-500 mb-1 block">Estado</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="w-full fluid-py-2 fluid-px-3 border border-gray-300 rounded-fluid-lg fluid-text-sm"
              >
                <option value="all">Todos</option>
                <option value="completed">Completados</option>
                <option value="pending">Pendientes</option>
                <option value="passed">Aprobados</option>
                <option value="failed">Reprobados</option>
              </select>
            </div>
            <div>
              <label className="fluid-text-xs font-medium text-gray-500 mb-1 block">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full fluid-py-2 fluid-px-3 border border-gray-300 rounded-fluid-lg fluid-text-sm"
              />
            </div>
            <div>
              <label className="fluid-text-xs font-medium text-gray-500 mb-1 block">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-full fluid-py-2 fluid-px-3 border border-gray-300 rounded-fluid-lg fluid-text-sm"
              />
            </div>
            {filters && filters.groups.length > 0 && (
              <div>
                <label className="fluid-text-xs font-medium text-gray-500 mb-1 block">Grupo</label>
                <select
                  value={groupId || ''}
                  onChange={(e) => { setGroupId(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                  className="w-full fluid-py-2 fluid-px-3 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                >
                  <option value="">Todos los grupos</option>
                  {filters.groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}
            {filters && filters.exams.length > 1 && (
              <div>
                <label className="fluid-text-xs font-medium text-gray-500 mb-1 block">Examen</label>
                <select
                  value={examId || ''}
                  onChange={(e) => { setExamId(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                  className="w-full fluid-py-2 fluid-px-3 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                >
                  <option value="">Todos los exámenes</option>
                  {filters.exams.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabla de asignaciones */}
      {assignments.length === 0 ? (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 text-center">
          <Users className="fluid-icon-lg text-gray-300 mx-auto mb-3" />
          <p className="fluid-text-base font-medium text-gray-500">No se encontraron asignaciones</p>
          <p className="fluid-text-sm text-gray-400 mt-1">
            Ajusta los filtros para ver resultados
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase">
                    <button onClick={() => handleSort('name')} className="flex items-center fluid-gap-1 hover:text-gray-900 transition-colors">
                      Usuario
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Rol</th>
                  <th className="text-left py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Grupo / Campus</th>
                  <th className="text-left py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Examen</th>
                  <th className="text-center py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    <button onClick={() => handleSort('date')} className="flex items-center fluid-gap-1 hover:text-gray-900 transition-colors mx-auto">
                      Fecha
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    <button onClick={() => handleSort('cost')} className="flex items-center fluid-gap-1 hover:text-gray-900 transition-colors mx-auto">
                      Costo
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    <button onClick={() => handleSort('score')} className="flex items-center fluid-gap-1 hover:text-gray-900 transition-colors mx-auto">
                      Calificación
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Estado</th>
                  <th className="text-center py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Material</th>
                  <th className="text-center py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignments.map((a, idx) => (
                  <tr key={`${a.user_id}-${a.exam_id}-${a.group_id}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    {/* Usuario */}
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900 fluid-text-sm">{a.user_name}</p>
                        <p className="fluid-text-xs text-gray-500">{a.user_email}</p>
                        {a.user_curp && (
                          <p className="fluid-text-xs text-gray-400">CURP: {a.user_curp}</p>
                        )}
                      </div>
                    </td>
                    {/* Rol */}
                    <td className="py-3 px-4">
                      {getRoleBadge(a.user_role)}
                    </td>
                    {/* Grupo / Campus */}
                    <td className="py-3 px-4">
                      <div>
                        <Link
                          to={`/partners/groups/${a.group_id}`}
                          className="font-medium text-blue-600 hover:text-blue-800 fluid-text-sm"
                        >
                          {a.group_name}
                        </Link>
                        {a.campus_name && (
                          <p className="fluid-text-xs text-gray-500 flex items-center fluid-gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {a.campus_name}
                          </p>
                        )}
                        {a.partner_name && (
                          <p className="fluid-text-xs text-gray-400 flex items-center fluid-gap-1">
                            <Building2 className="w-3 h-3" />
                            {a.partner_name}
                          </p>
                        )}
                      </div>
                    </td>
                    {/* Examen */}
                    <td className="py-3 px-4">
                      <p className="fluid-text-sm text-gray-900">{a.exam_name}</p>
                      {a.passing_score && (
                        <p className="fluid-text-xs text-gray-400">Min: {a.passing_score}%</p>
                      )}
                    </td>
                    {/* Fecha */}
                    <td className="py-3 px-4 text-center">
                      <p className="fluid-text-sm text-gray-700">{formatDate(a.assignment_date)}</p>
                      {a.result_date && a.result_date !== a.assignment_date && (
                        <p className="fluid-text-xs text-gray-400">
                          Resultado: {formatDate(a.result_date)}
                        </p>
                      )}
                    </td>
                    {/* Costo */}
                    <td className="py-3 px-4 text-center">
                      <p className={`fluid-text-sm font-medium ${a.unit_cost > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {a.unit_cost > 0 ? formatCurrency(a.unit_cost) : '$0'}
                      </p>
                    </td>
                    {/* Calificación */}
                    <td className="py-3 px-4 text-center">
                      {a.score !== null ? (
                        <span className={`fluid-text-base font-bold ${
                          a.passed ? 'text-green-600' : a.result_status === 'completed' ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {a.score}
                        </span>
                      ) : (
                        <span className="fluid-text-sm text-gray-400">—</span>
                      )}
                    </td>
                    {/* Estado */}
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(a)}
                      {a.certificate_code && (
                        <p className="fluid-text-xs text-green-600 mt-1 flex items-center justify-center fluid-gap-1">
                          <BadgeCheck className="w-3 h-3" />
                          {a.certificate_code}
                        </p>
                      )}
                    </td>
                    {/* Material */}
                    <td className="py-3 px-4">
                      <div className="min-w-[80px]">
                        {getMaterialBar(a.material_progress)}
                      </div>
                    </td>
                    {/* Duración */}
                    <td className="py-3 px-4 text-center">
                      <p className="fluid-text-sm text-gray-700">{formatDuration(a.duration_seconds)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {data && data.pages > 1 && (
            <div className="fluid-px-5 fluid-py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <p className="fluid-text-sm text-gray-500">
                Mostrando {((page - 1) * 30) + 1}-{Math.min(page * 30, data.total)} de {data.total}
              </p>
              <div className="flex items-center fluid-gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-fluid-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="fluid-icon-sm" />
                </button>
                <span className="fluid-px-3 fluid-py-1 fluid-text-sm font-medium text-gray-700">
                  {page} / {data.pages}
                </span>
                <button
                  onClick={() => setPage(Math.min(data.pages, page + 1))}
                  disabled={page === data.pages}
                  className="p-2 rounded-fluid-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="fluid-icon-sm" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
