/**
 * Página de Asignaciones ECM (tabla plana)
 *
 * Muestra TODAS las asignaciones (una fila por candidato/examen) a través de
 * todos los ECM, en una tabla al estilo de user-management. Permite buscar,
 * filtrar (ECM, marca, estado, tipo de usuario, fechas), ordenar y paginar.
 * Accesible por admin, coordinator y soporte.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  AlertCircle,
  Users,
  Wallet,
  BarChart3,
  ShieldCheck,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Minus,
  Building2,
  MapPin,
  ArrowUpDown,
  X,
  Tag,
  ExternalLink,
  CalendarClock,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getAllEcmAssignments,
  EcmAssignmentDetail,
  FlatEcmAssignmentsResponse,
} from '../../services/partnersService';
import { formatCurrency } from '../../services/balanceService';
import { useAuthStore } from '../../store/authStore';

const PER_PAGE = 30;

export default function EcmAssignmentsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isResponsable = user?.role === 'responsable';
  const isSoporte = user?.role === 'soporte';
  const hidePrices = isResponsable || isSoporte;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FlatEcmAssignmentsResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Búsqueda con debounce
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isSearchPending = search !== debouncedSearch;

  // Filtros
  const [ecmId, setEcmId] = useState<number | undefined>();
  const [brandId, setBrandId] = useState<number | undefined>();
  const [userType, setUserType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Debounce de la búsqueda
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Resetear a la página 1 cuando cambia la búsqueda
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Autofoco al montar
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Atajo de teclado "/" para enfocar la búsqueda
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const loadData = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      setError(null);
      const result = await getAllEcmAssignments({
        page,
        per_page: PER_PAGE,
        search: debouncedSearch || undefined,
        ecm_id: ecmId,
        brand_id: brandId,
        user_type: userType !== 'all' ? userType : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
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
  }, [page, debouncedSearch, ecmId, brandId, userType, statusFilter, dateFrom, dateTo, sortBy, sortDir, refreshing]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, ecmId, brandId, userType, statusFilter, dateFrom, dateTo, sortBy, sortDir]);

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

  const hasActiveFilters = ecmId || brandId || userType !== 'all' || statusFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch('');
    setEcmId(undefined);
    setBrandId(undefined);
    setUserType('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('date');
    setSortDir('desc');
    setPage(1);
    searchInputRef.current?.focus();
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
      <div className="w-full min-w-[70px]">
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

  const summary = data?.summary;
  const assignments = data?.assignments || [];
  const filters = data?.filters;
  const totalPages = data?.pages || 0;
  const total = data?.total || 0;

  if (loading && !data) return <LoadingSpinner />;

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex items-center justify-between flex-wrap fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <Link
              to="/partners"
              className="p-2 rounded-fluid-xl bg-white/10 hover:bg-white/20 transition-all"
            >
              <ArrowLeft className="fluid-icon-base" />
            </Link>
            <div>
              <h1 className="fluid-text-2xl font-bold">Asignaciones ECM</h1>
              <p className="fluid-text-sm text-white/80 mt-1">
                Todas las asignaciones de certificación en una sola tabla
              </p>
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
        <div className={`grid grid-cols-2 ${hidePrices ? 'md:grid-cols-3' : 'md:grid-cols-4'} fluid-gap-4 fluid-mb-6`}>
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-4">
            <div className="flex items-center fluid-gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-fluid-xl flex items-center justify-center">
                <Users className="fluid-icon-base text-blue-600" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500">Total asignaciones</p>
                <p className="fluid-text-xl font-bold text-gray-900">{summary.total_assignments.toLocaleString()}</p>
                <p className="fluid-text-xs text-gray-400">{summary.total_candidates} candidatos únicos</p>
              </div>
            </div>
          </div>
          {!hidePrices && (
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-4">
              <div className="flex items-center fluid-gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-fluid-xl flex items-center justify-center">
                  <Wallet className="fluid-icon-base text-green-600" />
                </div>
                <div>
                  <p className="fluid-text-xs text-gray-500">Inversión total</p>
                  <p className="fluid-text-lg font-bold text-green-700">{formatCurrency(summary.total_cost)}</p>
                </div>
              </div>
            </div>
          )}
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
        <div className="flex items-center fluid-gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por nombre, email, CURP o ECM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full fluid-pl-10 fluid-pr-10 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm"
            />
            {isSearchPending && (
              <span className="absolute right-10 top-1/2 -translate-y-1/2 fluid-text-xs text-gray-400 hidden sm:inline">
                Buscando…
              </span>
            )}
            {search ? (
              <button
                onClick={() => { setSearch(''); searchInputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Limpiar búsqueda"
              >
                <X className="fluid-icon-sm" />
              </button>
            ) : (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 fluid-text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 hidden sm:inline">/</kbd>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`fluid-px-4 fluid-py-2 rounded-fluid-xl flex items-center fluid-gap-2 fluid-text-sm font-medium transition-all ${
              showFilters ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="fluid-icon-sm" />
            Filtros
          </button>
          {hasActiveFilters && (
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
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 fluid-gap-3">
            {filters && filters.ecms.length > 0 && (
              <div>
                <label className="fluid-text-xs font-medium text-gray-500 mb-1 block">ECM</label>
                <select
                  value={ecmId || ''}
                  onChange={(e) => { setEcmId(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                  className="w-full fluid-py-2 fluid-px-3 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                >
                  <option value="">Todos los ECM</option>
                  {filters.ecms.map((ecm) => (
                    <option key={ecm.id} value={ecm.id}>{ecm.code} — {ecm.name}</option>
                  ))}
                </select>
              </div>
            )}
            {filters && filters.brands.length > 0 && (
              <div>
                <label className="fluid-text-xs font-medium text-gray-500 mb-1 block flex items-center fluid-gap-1">
                  <Tag className="fluid-icon-xs" /> Marca
                </label>
                <select
                  value={brandId || ''}
                  onChange={(e) => { setBrandId(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                  className="w-full fluid-py-2 fluid-px-3 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                >
                  <option value="">Todas las marcas</option>
                  {filters.brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
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
          </div>
        )}
      </div>

      {/* Tabla de asignaciones */}
      {assignments.length === 0 ? (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 text-center">
          <Users className="fluid-icon-lg text-gray-300 mx-auto mb-3" />
          <p className="fluid-text-base font-medium text-gray-500">No se encontraron asignaciones</p>
          <p className="fluid-text-sm text-gray-400 mt-1">
            {search || hasActiveFilters ? 'Ajusta la búsqueda o los filtros' : 'Aún no hay asignaciones registradas'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-3 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    <button onClick={() => handleSort('ecm')} className="flex items-center fluid-gap-1 hover:text-gray-900 transition-colors">
                      ECM
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-3 fluid-text-xs font-medium text-gray-500 uppercase">
                    <button onClick={() => handleSort('name')} className="flex items-center fluid-gap-1 hover:text-gray-900 transition-colors">
                      Usuario
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-3 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Nº Asignación
                  </th>
                  <th className="text-left py-3 px-3 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    <button onClick={() => handleSort('role')} className="flex items-center fluid-gap-1 hover:text-gray-900 transition-colors">
                      Rol
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-3 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    <button onClick={() => handleSort('group')} className="flex items-center fluid-gap-1 hover:text-gray-900 transition-colors">
                      Grupo / Campus
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-3 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    <button onClick={() => handleSort('exam')} className="flex items-center fluid-gap-1 hover:text-gray-900 transition-colors">
                      Examen
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-3 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    <button onClick={() => handleSort('date')} className="flex items-center fluid-gap-1 hover:text-gray-900 transition-colors mx-auto">
                      Fecha
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-3 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    <button onClick={() => handleSort('cost')} className="flex items-center fluid-gap-1 hover:text-gray-900 transition-colors mx-auto">
                      {hidePrices ? 'Cert.' : 'Costo'}
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-3 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    <button onClick={() => handleSort('score')} className="flex items-center fluid-gap-1 hover:text-gray-900 transition-colors mx-auto">
                      Calificación
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-3 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    <button onClick={() => handleSort('status')} className="flex items-center fluid-gap-1 hover:text-gray-900 transition-colors mx-auto">
                      Estado
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-3 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Material
                  </th>
                  <th className="text-center py-3 px-3 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    <button onClick={() => handleSort('duration')} className="flex items-center fluid-gap-1 hover:text-gray-900 transition-colors mx-auto">
                      Duración
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-3 fluid-text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Vigencia
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignments.map((a, idx) => (
                  <tr
                    key={`${a.user_id}-${a.exam_id}-${a.group_id}-${a.ecm_id ?? 'x'}-${idx}`}
                    className={`hover:bg-sky-50/50 transition-colors ${a.ecm_assignment_id ? 'cursor-pointer' : ''}`}
                    onClick={() => a.ecm_assignment_id && navigate(`/asignaciones-ecm/candidato/${a.ecm_assignment_id}`)}
                  >
                    {/* ECM */}
                    <td className="py-3 px-3">
                      <div className="flex items-center fluid-gap-2">
                        {a.ecm_logo_url ? (
                          <img src={a.ecm_logo_url} alt={a.ecm_code} className="w-7 h-7 object-contain rounded flex-shrink-0" />
                        ) : null}
                        <div className="min-w-0">
                          {a.ecm_id ? (
                            <Link
                              to={`/asignaciones-ecm/${a.ecm_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-0.5 bg-blue-100 text-blue-700 rounded-fluid-lg fluid-text-xs font-bold hover:bg-blue-200 transition-colors"
                              title={a.ecm_name}
                            >
                              {a.ecm_code}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="fluid-text-xs text-gray-400">—</span>
                          )}
                          {a.brand && (
                            <p className="fluid-text-xs text-gray-400 mt-0.5 truncate max-w-[120px]">{a.brand}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Usuario */}
                    <td className="py-3 px-3">
                      <div>
                        <p className="font-medium text-gray-900 fluid-text-sm">{a.user_name}</p>
                        <p className="fluid-text-xs text-gray-500">{a.user_email}</p>
                        {a.user_curp && (
                          <p className="fluid-text-xs text-gray-400">CURP: {a.user_curp}</p>
                        )}
                      </div>
                    </td>
                    {/* Nº Asignación */}
                    <td className="py-3 px-3 text-center">
                      {a.assignment_number ? (
                        <span className="inline-block bg-blue-100 text-blue-800 font-mono font-semibold fluid-text-xs px-2 py-0.5 rounded-fluid-lg tracking-wider">
                          {a.assignment_number}
                        </span>
                      ) : (
                        <span className="fluid-text-xs text-gray-400">—</span>
                      )}
                    </td>
                    {/* Rol */}
                    <td className="py-3 px-3">
                      {getRoleBadge(a.user_role)}
                    </td>
                    {/* Grupo / Campus */}
                    <td className="py-3 px-3">
                      <div>
                        <Link
                          to={`/partners/groups/${a.group_id}`}
                          className="font-medium text-blue-600 hover:text-blue-800 fluid-text-sm"
                          onClick={(e) => e.stopPropagation()}
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
                    <td className="py-3 px-3">
                      <p className="fluid-text-sm text-gray-900">{a.exam_name}</p>
                      {a.passing_score && (
                        <p className="fluid-text-xs text-gray-400">Min: {a.passing_score}%</p>
                      )}
                    </td>
                    {/* Fecha */}
                    <td className="py-3 px-3 text-center">
                      <p className="fluid-text-sm text-gray-700">{formatDate(a.assignment_date)}</p>
                      {a.result_date && a.result_date !== a.assignment_date && (
                        <p className="fluid-text-xs text-gray-400">
                          Resultado: {formatDate(a.result_date)}
                        </p>
                      )}
                    </td>
                    {/* Costo */}
                    <td className="py-3 px-3 text-center">
                      <p className={`fluid-text-sm font-medium ${a.unit_cost > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {hidePrices ? (a.unit_cost > 0 ? '1 cert.' : '—') : (a.unit_cost > 0 ? formatCurrency(a.unit_cost) : '$0')}
                      </p>
                    </td>
                    {/* Calificación */}
                    <td className="py-3 px-3 text-center">
                      {a.score !== null ? (
                        <span className={`fluid-text-base font-bold ${
                          a.passed ? 'text-green-600' : a.result_status === 'completed' ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {a.score}%
                        </span>
                      ) : (
                        <span className="fluid-text-sm text-gray-400">—</span>
                      )}
                    </td>
                    {/* Estado */}
                    <td className="py-3 px-3 text-center">
                      {getStatusBadge(a)}
                    </td>
                    {/* Material */}
                    <td className="py-3 px-3">
                      {getMaterialBar(a.material_progress)}
                    </td>
                    {/* Duración */}
                    <td className="py-3 px-3 text-center">
                      <span className="fluid-text-sm text-gray-700">{formatDuration(a.duration_seconds)}</span>
                    </td>
                    {/* Vigencia */}
                    <td className="py-3 px-3 text-center">
                      {a.vigencia ? (
                        <div className="flex flex-col items-center">
                          <span className={`inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-0.5 rounded-full fluid-text-xs font-medium ${
                            a.vigencia.is_expired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            <CalendarClock className="w-3 h-3" />
                            {a.vigencia.is_expired ? 'Vencida' : 'Vigente'}
                          </span>
                          {a.vigencia.expires_at && (
                            <span className="fluid-text-xs text-gray-400 mt-0.5">{formatDate(a.vigencia.expires_at)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="fluid-text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between fluid-px-5 fluid-py-4 border-t border-gray-200 bg-gray-50">
              <p className="fluid-text-sm text-gray-500">
                Página {data?.current_page} de {totalPages} · {total.toLocaleString()} asignaciones
              </p>
              <div className="flex items-center fluid-gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="fluid-px-3 fluid-py-2 rounded-fluid-lg border border-gray-300 bg-white fluid-text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center fluid-gap-1"
                >
                  <ChevronLeft className="fluid-icon-sm" />
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="fluid-px-3 fluid-py-2 rounded-fluid-lg border border-gray-300 bg-white fluid-text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center fluid-gap-1"
                >
                  Siguiente
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
