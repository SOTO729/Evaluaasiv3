/**
 * Detalle de Ciclo Escolar
 * Muestra información del ciclo y lista los grupos asociados
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  GraduationCap,
  AlertCircle,
  Users,
  Calendar,
  Building2,
  Layers,
  ChevronRight,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import {
  getSchoolCycle,
  SchoolCycle,
} from '../../services/partnersService';

export default function SchoolCycleDetailPage() {
  const { cycleId } = useParams();
  
  const [cycle, setCycle] = useState<SchoolCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCycle();
  }, [cycleId]);

  const loadCycle = async () => {
    if (!cycleId) return;
    
    try {
      setLoading(true);
      setError(null);
      const cycleData = await getSchoolCycle(parseInt(cycleId));
      setCycle(cycleData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el ciclo escolar');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar grupos por búsqueda
  const filteredGroups = (cycle?.groups || []).filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calcular estadísticas
  const stats = {
    totalGroups: cycle?.groups?.length || 0,
    activeGroups: cycle?.groups?.filter(g => g.is_active).length || 0,
    totalMembers: cycle?.groups?.reduce((acc, g) => acc + (g.member_count || 0), 0) || 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !cycle) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <PartnersBreadcrumb
          items={[
            { label: 'Partners', path: '/partners' },
            { label: 'Ciclo Escolar' },
          ]}
        />
        <div className="bg-red-50 border border-red-200 rounded-fluid-2xl fluid-p-8 text-center fluid-mt-6">
          <AlertCircle className="fluid-icon-2xl text-red-500 mx-auto fluid-mb-4" />
          <h2 className="fluid-text-xl font-bold text-red-800 fluid-mb-2">Error</h2>
          <p className="fluid-text-base text-red-600">{error || 'Ciclo no encontrado'}</p>
          <Link
            to="/partners"
            className="inline-flex items-center fluid-gap-2 fluid-mt-6 fluid-px-6 fluid-py-3 bg-red-600 hover:bg-red-700 text-white rounded-fluid-xl font-semibold transition-all"
          >
            <ArrowLeft className="fluid-icon-sm" />
            Volver a Partners
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb
        items={[
          { label: 'Partners', path: '/partners' },
          { label: cycle.campus?.name || 'Plantel', path: `/partners/campuses/${cycle.campus_id}` },
          { label: cycle.name },
        ]}
      />

      {/* Header con degradado */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <div className="fluid-p-3 bg-white/20 rounded-fluid-xl backdrop-blur-sm">
              <GraduationCap className="fluid-icon-xl text-white" />
            </div>
            <div>
              <div className="flex items-center fluid-gap-3 flex-wrap">
                <h1 className="fluid-text-2xl font-bold">{cycle.name}</h1>
                {cycle.is_current && (
                  <span className="fluid-text-sm bg-white/20 fluid-px-3 fluid-py-1 rounded-full font-semibold backdrop-blur-sm border border-white/30">
                    Ciclo Actual
                  </span>
                )}
                {!cycle.is_active && (
                  <span className="fluid-text-sm bg-red-500/80 fluid-px-3 fluid-py-1 rounded-full font-semibold">
                    Inactivo
                  </span>
                )}
              </div>
              <div className="flex items-center fluid-gap-4 fluid-mt-2 fluid-text-sm text-white/80">
                <span className="flex items-center fluid-gap-1">
                  <Building2 className="fluid-icon-sm" />
                  {cycle.campus?.name || 'Plantel'}
                </span>
                <span className="flex items-center fluid-gap-1">
                  <Calendar className="fluid-icon-sm" />
                  {new Date(cycle.start_date).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })} - {new Date(cycle.end_date).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                </span>
                <span className="flex items-center fluid-gap-1 capitalize">
                  <Clock className="fluid-icon-sm" />
                  {cycle.cycle_type === 'annual' ? 'Anual' : 'Semestral'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center fluid-gap-3">
            <Link
              to={`/partners/campuses/${cycle.campus_id}`}
              className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/10 hover:bg-white/20 text-white rounded-fluid-xl font-semibold fluid-text-sm transition-all backdrop-blur-sm border border-white/20"
            >
              <ArrowLeft className="fluid-icon-sm" />
              Volver al Plantel
            </Link>
          </div>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-5 fluid-mb-6">
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-md transition-all duration-300">
          <div className="flex items-center fluid-gap-4">
            <div className="fluid-p-3 bg-blue-100 rounded-fluid-xl">
              <Layers className="fluid-icon-lg text-blue-600" />
            </div>
            <div>
              <p className="fluid-text-3xl font-bold text-gray-900">{stats.totalGroups}</p>
              <p className="fluid-text-sm text-gray-500 font-medium fluid-mt-1">Grupos Totales</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-md transition-all duration-300">
          <div className="flex items-center fluid-gap-4">
            <div className="fluid-p-3 bg-emerald-100 rounded-fluid-xl">
              <CheckCircle2 className="fluid-icon-lg text-emerald-600" />
            </div>
            <div>
              <p className="fluid-text-3xl font-bold text-gray-900">{stats.activeGroups}</p>
              <p className="fluid-text-sm text-gray-500 font-medium fluid-mt-1">Grupos Activos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-md transition-all duration-300">
          <div className="flex items-center fluid-gap-4">
            <div className="fluid-p-3 bg-amber-100 rounded-fluid-xl">
              <Users className="fluid-icon-lg text-amber-600" />
            </div>
            <div>
              <p className="fluid-text-3xl font-bold text-gray-900">{stats.totalMembers}</p>
              <p className="fluid-text-sm text-gray-500 font-medium fluid-mt-1">Candidatos Totales</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Grupos */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300">
        <div className="fluid-p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
            <h2 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg">
                <Users className="fluid-icon-base text-blue-600" />
              </div>
              Grupos del Ciclo
              <span className="fluid-text-sm font-medium text-gray-400 bg-gray-100 fluid-px-2 fluid-py-1 rounded-full">
                {filteredGroups.length}
              </span>
            </h2>
            <div className="flex flex-col sm:flex-row fluid-gap-3">
              {/* Búsqueda */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar grupo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 fluid-pl-10 fluid-pr-8 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="fluid-icon-xs" />
                  </button>
                )}
              </div>
              <Link
                to={`/partners/campuses/${cycle.campus_id}/groups/new?cycleId=${cycle.id}`}
                className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl fluid-text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-md"
              >
                <Plus className="fluid-icon-sm" />
                Nuevo Grupo
              </Link>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="max-h-[500px] overflow-y-auto">
          {filteredGroups.length === 0 ? (
            <div className="fluid-p-12 text-center">
              <div className="fluid-w-20 fluid-h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto fluid-mb-5">
                <Users className="fluid-icon-2xl text-gray-400" />
              </div>
              {searchQuery ? (
                <>
                  <p className="fluid-text-lg font-semibold text-gray-700 fluid-mb-2">No se encontraron grupos</p>
                  <p className="fluid-text-base text-gray-500 fluid-mb-4">No hay resultados para "{searchQuery}"</p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="fluid-px-4 fluid-py-2 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Limpiar búsqueda
                  </button>
                </>
              ) : (
                <>
                  <p className="fluid-text-lg font-semibold text-gray-700 fluid-mb-2">No hay grupos en este ciclo</p>
                  <p className="fluid-text-base text-gray-500 fluid-mb-6">Crea el primer grupo para comenzar</p>
                  <Link
                    to={`/partners/campuses/${cycle.campus_id}/groups/new?cycleId=${cycle.id}`}
                    className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl font-semibold transition-all shadow-lg"
                  >
                    <Plus className="fluid-icon-sm" />
                    Crear Grupo
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredGroups.map((group) => (
                <Link
                  key={group.id}
                  to={`/partners/groups/${group.id}`}
                  className="flex items-center justify-between fluid-p-4 hover:bg-blue-50 transition-all duration-200 group"
                >
                  <div className="flex items-center fluid-gap-4 min-w-0">
                    <div className={`fluid-p-2.5 rounded-fluid-xl ${group.is_active ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Users className={`fluid-icon-base ${group.is_active ? 'text-blue-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center fluid-gap-2 flex-wrap">
                        <span className={`fluid-text-base font-semibold truncate ${group.is_active ? 'text-gray-900' : 'text-gray-500'}`}>
                          {group.name}
                        </span>
                        {!group.is_active && (
                          <span className="fluid-text-xs bg-red-100 text-red-600 fluid-px-2 fluid-py-0.5 rounded-full font-semibold border border-red-200">
                            Inactivo
                          </span>
                        )}
                      </div>
                      {group.description && (
                        <p className="fluid-text-sm text-gray-500 truncate fluid-mt-0.5">{group.description}</p>
                      )}
                      <div className="flex items-center fluid-gap-4 fluid-mt-1.5 fluid-text-sm text-gray-500">
                        <span className="flex items-center fluid-gap-1">
                          <Users className="fluid-icon-xs text-amber-500" />
                          {group.member_count || 0} miembros
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center fluid-gap-2 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="fluid-text-sm font-medium">Ver detalle</span>
                    <ChevronRight className="fluid-icon-sm" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
