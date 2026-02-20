/**
 * Página de Asignaciones por ECM
 * 
 * Vista principal que muestra todos los ECM con resumen de asignaciones:
 * total de candidatos, costo acumulado, promedio de calificación, tasa de aprobación.
 * Accesible por admin y coordinator.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  AlertCircle,
  Users,
  Wallet,
  Award,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  BarChart3,
  GraduationCap,
  FileSpreadsheet,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getEcmAssignments,
  EcmAssignmentSummary,
} from '../../services/partnersService';
import { formatCurrency } from '../../services/balanceService';

export default function EcmAssignmentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ecms, setEcms] = useState<EcmAssignmentSummary[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (!refreshing) setLoading(true);
      setError(null);
      const data = await getEcmAssignments({ search: search || undefined });
      setEcms(data.ecms);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = () => {
    loadData();
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Totales globales
  const totalCandidates = ecms.reduce((sum, e) => sum + e.total_candidates, 0);
  const totalCost = ecms.reduce((sum, e) => sum + e.total_cost, 0);
  const ecmsWithResults = ecms.filter(e => e.avg_score !== null);
  const globalAvgScore = ecmsWithResults.length > 0
    ? Math.round(ecmsWithResults.reduce((sum, e) => sum + (e.avg_score || 0), 0) / ecmsWithResults.length)
    : null;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex items-center justify-between flex-wrap fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <Link
              to="/partners/dashboard"
              className="p-2 rounded-fluid-xl bg-white/10 hover:bg-white/20 transition-all"
            >
              <ArrowLeft className="fluid-icon-base" />
            </Link>
            <div>
              <h1 className="fluid-text-2xl font-bold">Asignaciones por ECM</h1>
              <p className="fluid-text-sm text-white/80 mt-1">
                Vista detallada de todas las asignaciones agrupadas por estándar de competencia
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

      {/* Tarjetas de resumen global */}
      <div className="grid grid-cols-2 md:grid-cols-4 fluid-gap-4 fluid-mb-6">
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
          <div className="flex items-center fluid-gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-fluid-xl flex items-center justify-center">
              <FileSpreadsheet className="fluid-icon-base text-blue-600" />
            </div>
            <div>
              <p className="fluid-text-xs text-gray-500">ECMs</p>
              <p className="fluid-text-2xl font-bold text-gray-900">{ecms.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
          <div className="flex items-center fluid-gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-fluid-xl flex items-center justify-center">
              <Users className="fluid-icon-base text-purple-600" />
            </div>
            <div>
              <p className="fluid-text-xs text-gray-500">Candidatos</p>
              <p className="fluid-text-2xl font-bold text-gray-900">{totalCandidates.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
          <div className="flex items-center fluid-gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-fluid-xl flex items-center justify-center">
              <Wallet className="fluid-icon-base text-green-600" />
            </div>
            <div>
              <p className="fluid-text-xs text-gray-500">Inversión total</p>
              <p className="fluid-text-lg font-bold text-gray-900">{formatCurrency(totalCost)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
          <div className="flex items-center fluid-gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-fluid-xl flex items-center justify-center">
              <BarChart3 className="fluid-icon-base text-amber-600" />
            </div>
            <div>
              <p className="fluid-text-xs text-gray-500">Promedio global</p>
              <p className="fluid-text-2xl font-bold text-gray-900">
                {globalAvgScore !== null ? `${globalAvgScore}%` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5 fluid-mb-6">
        <div className="flex items-center fluid-gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
            <input
              type="text"
              placeholder="Buscar ECM por código o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm"
            />
          </div>
          <button
            onClick={handleSearch}
            className="fluid-px-4 fluid-py-2 bg-blue-600 text-white rounded-fluid-xl hover:bg-blue-700 fluid-text-sm font-medium shadow-lg transition-all"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Lista de ECMs */}
      {ecms.length === 0 ? (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 text-center">
          <GraduationCap className="fluid-icon-lg text-gray-300 mx-auto mb-3" />
          <p className="fluid-text-base font-medium text-gray-500">No se encontraron ECMs</p>
          <p className="fluid-text-sm text-gray-400 mt-1">
            {search ? 'Intenta con otra búsqueda' : 'No hay estándares de competencia registrados'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {ecms.map((ecm) => (
            <Link
              key={ecm.id}
              to={`/asignaciones-ecm/${ecm.id}`}
              className="block bg-white rounded-fluid-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-200 transition-all group"
            >
              <div className="fluid-p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start fluid-gap-4 flex-1">
                    {/* Logo o ícono */}
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-fluid-xl flex items-center justify-center flex-shrink-0 border border-blue-200">
                      {ecm.logo_url ? (
                        <img src={ecm.logo_url} alt={ecm.code} className="w-10 h-10 object-contain rounded" />
                      ) : (
                        <Award className="fluid-icon-lg text-blue-600" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Código y nombre */}
                      <div className="flex items-center fluid-gap-2 flex-wrap">
                        <span className="fluid-px-2 fluid-py-1 bg-blue-100 text-blue-700 rounded-fluid-lg fluid-text-xs font-bold">
                          {ecm.code}
                        </span>
                        {ecm.sector && (
                          <span className="fluid-px-2 fluid-py-1 bg-gray-100 text-gray-600 rounded-fluid-lg fluid-text-xs">
                            {ecm.sector}
                          </span>
                        )}
                        {ecm.level && (
                          <span className="fluid-px-2 fluid-py-1 bg-purple-100 text-purple-600 rounded-fluid-lg fluid-text-xs">
                            Nivel {ecm.level}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 fluid-text-base mt-1 group-hover:text-blue-600 transition-colors">
                        {ecm.name}
                      </h3>
                      
                      {/* Métricas */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 fluid-gap-4 mt-3">
                        <div>
                          <p className="fluid-text-xs text-gray-400">Asignaciones</p>
                          <p className="fluid-text-base font-semibold text-gray-900">{ecm.total_assignments}</p>
                        </div>
                        <div>
                          <p className="fluid-text-xs text-gray-400">Candidatos</p>
                          <p className="fluid-text-base font-semibold text-gray-900 flex items-center fluid-gap-1">
                            <Users className="fluid-icon-xs text-gray-400" />
                            {ecm.total_candidates}
                          </p>
                        </div>
                        <div>
                          <p className="fluid-text-xs text-gray-400">Inversión</p>
                          <p className="fluid-text-base font-semibold text-green-600">
                            {formatCurrency(ecm.total_cost)}
                          </p>
                        </div>
                        <div>
                          <p className="fluid-text-xs text-gray-400">Promedio</p>
                          <p className={`fluid-text-base font-semibold ${
                            ecm.avg_score !== null 
                              ? ecm.avg_score >= 80 ? 'text-green-600' : ecm.avg_score >= 60 ? 'text-amber-600' : 'text-red-600'
                              : 'text-gray-400'
                          }`}>
                            {ecm.avg_score !== null ? `${ecm.avg_score}%` : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="fluid-text-xs text-gray-400">Aprobación</p>
                          <p className={`fluid-text-base font-semibold flex items-center fluid-gap-1 ${
                            ecm.pass_rate !== null
                              ? ecm.pass_rate >= 70 ? 'text-green-600' : ecm.pass_rate >= 50 ? 'text-amber-600' : 'text-red-600'
                              : 'text-gray-400'
                          }`}>
                            {ecm.pass_rate !== null ? (
                              <>
                                <ShieldCheck className="fluid-icon-xs" />
                                {ecm.pass_rate}%
                              </>
                            ) : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Flecha */}
                  <ChevronRight className="fluid-icon-base text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
