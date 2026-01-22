/**
 * Dashboard de Coordinador - Gestión de Partners
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Users,
  Layers,
  Plus,
  TrendingUp,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getPartnersDashboard, DashboardStats } from '../../services/partnersService';

export default function PartnersDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await getPartnersDashboard();
      setDashboard(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg lg:rounded-xl p-4 lg:p-6 flex items-center gap-3 lg:gap-4">
          <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 text-red-600" />
          <p className="text-red-700 text-sm lg:text-base">{error}</p>
          <button onClick={loadDashboard} className="ml-auto text-red-700 underline text-sm lg:text-base">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const stats = dashboard?.stats;

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 lg:gap-6 mb-6 lg:mb-8 xl:mb-10">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-bold text-gray-800 flex items-center gap-2 lg:gap-3 xl:gap-4">
            <Building2 className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 xl:h-10 xl:w-10 2xl:h-12 2xl:w-12 text-blue-600" />
            Gestión de Partners
          </h1>
          <p className="text-sm sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl text-gray-600 mt-1 lg:mt-2">
            Panel de control para coordinadores
          </p>
        </div>
        <Link
          to="/partners/new"
          className="inline-flex items-center justify-center gap-2 lg:gap-3 px-4 lg:px-5 xl:px-6 2xl:px-8 py-2 lg:py-2.5 xl:py-3 2xl:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg lg:rounded-xl font-medium text-sm lg:text-base xl:text-lg 2xl:text-xl transition-colors"
        >
          <Plus className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7" />
          Nuevo Partner
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 xl:gap-8 mb-6 lg:mb-8 xl:mb-10">
        <Link
          to="/partners"
          className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6 xl:p-8 hover:shadow-lg hover:border-blue-300 transition-all group"
        >
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="p-2 lg:p-3 xl:p-4 bg-blue-100 rounded-lg lg:rounded-xl">
              <Building2 className="h-5 w-5 lg:h-6 lg:w-6 xl:h-8 xl:w-8 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-bold text-gray-900">
                {stats?.total_partners || 0}
              </p>
              <p className="text-xs lg:text-sm xl:text-base 2xl:text-lg text-gray-500">Partners</p>
            </div>
          </div>
          <div className="mt-3 lg:mt-4 flex items-center text-xs lg:text-sm xl:text-base text-blue-600 group-hover:text-blue-700">
            <span>Ver todos</span>
            <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5" />
          </div>
        </Link>

        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6 xl:p-8">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="p-2 lg:p-3 xl:p-4 bg-emerald-100 rounded-lg lg:rounded-xl">
              <MapPin className="h-5 w-5 lg:h-6 lg:w-6 xl:h-8 xl:w-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-bold text-gray-900">
                {stats?.total_campuses || 0}
              </p>
              <p className="text-xs lg:text-sm xl:text-base 2xl:text-lg text-gray-500">Planteles</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6 xl:p-8">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="p-2 lg:p-3 xl:p-4 bg-amber-100 rounded-lg lg:rounded-xl">
              <Layers className="h-5 w-5 lg:h-6 lg:w-6 xl:h-8 xl:w-8 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-bold text-gray-900">
                {stats?.total_groups || 0}
              </p>
              <p className="text-xs lg:text-sm xl:text-base 2xl:text-lg text-gray-500">Grupos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6 xl:p-8">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="p-2 lg:p-3 xl:p-4 bg-purple-100 rounded-lg lg:rounded-xl">
              <Users className="h-5 w-5 lg:h-6 lg:w-6 xl:h-8 xl:w-8 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-bold text-gray-900">
                {stats?.total_members || 0}
              </p>
              <p className="text-xs lg:text-sm xl:text-base 2xl:text-lg text-gray-500">Candidatos</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 xl:gap-10">
        {/* Presencia por Estado */}
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6 xl:p-8">
          <div className="flex items-center gap-2 lg:gap-3 mb-4 lg:mb-6">
            <TrendingUp className="h-5 w-5 lg:h-6 lg:w-6 text-blue-600" />
            <h2 className="text-lg lg:text-xl xl:text-2xl 2xl:text-3xl font-semibold text-gray-800">
              Presencia por Estado
            </h2>
          </div>
          
          {dashboard?.partners_by_state && dashboard.partners_by_state.length > 0 ? (
            <div className="space-y-3 lg:space-y-4 max-h-[300px] lg:max-h-[400px] overflow-y-auto">
              {dashboard.partners_by_state.map(({ state, count }) => (
                <div key={state} className="flex items-center justify-between">
                  <span className="text-sm lg:text-base xl:text-lg text-gray-700">{state}</span>
                  <span className="px-2 lg:px-3 py-0.5 lg:py-1 bg-blue-100 text-blue-700 rounded-full text-xs lg:text-sm xl:text-base font-medium">
                    {count} {count === 1 ? 'partner' : 'partners'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm lg:text-base text-center py-8">
              No hay datos de presencia por estado
            </p>
          )}
        </div>

        {/* Grupos Recientes */}
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6 xl:p-8">
          <div className="flex items-center gap-2 lg:gap-3 mb-4 lg:mb-6">
            <Layers className="h-5 w-5 lg:h-6 lg:w-6 text-amber-600" />
            <h2 className="text-lg lg:text-xl xl:text-2xl 2xl:text-3xl font-semibold text-gray-800">
              Grupos Recientes
            </h2>
          </div>
          
          {dashboard?.recent_groups && dashboard.recent_groups.length > 0 ? (
            <div className="space-y-3 lg:space-y-4">
              {dashboard.recent_groups.map((group) => (
                <Link
                  key={group.id}
                  to={`/partners/groups/${group.id}`}
                  className="block p-3 lg:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg lg:rounded-xl transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-sm lg:text-base xl:text-lg text-gray-900">
                        {group.name}
                      </h3>
                      <p className="text-xs lg:text-sm xl:text-base text-gray-500">
                        {group.campus?.name} • {group.campus?.partner?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm lg:text-base xl:text-lg font-semibold text-gray-700">
                        {group.member_count || 0}
                      </span>
                      <p className="text-xs lg:text-sm text-gray-500">miembros</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm lg:text-base text-center py-8">
              No hay grupos recientes
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 lg:mt-8 xl:mt-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl lg:rounded-2xl p-4 lg:p-6 xl:p-8">
        <h2 className="text-lg lg:text-xl xl:text-2xl font-semibold text-white mb-4 lg:mb-6">
          Acciones Rápidas
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 xl:gap-6">
          <Link
            to="/partners/new"
            className="flex items-center gap-3 lg:gap-4 p-3 lg:p-4 xl:p-5 bg-white/10 hover:bg-white/20 rounded-lg lg:rounded-xl text-white transition-colors"
          >
            <Building2 className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7" />
            <span className="text-sm lg:text-base xl:text-lg font-medium">Crear Partner</span>
          </Link>
          <Link
            to="/partners"
            className="flex items-center gap-3 lg:gap-4 p-3 lg:p-4 xl:p-5 bg-white/10 hover:bg-white/20 rounded-lg lg:rounded-xl text-white transition-colors"
          >
            <MapPin className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7" />
            <span className="text-sm lg:text-base xl:text-lg font-medium">Ver Planteles</span>
          </Link>
          <Link
            to="/partners"
            className="flex items-center gap-3 lg:gap-4 p-3 lg:p-4 xl:p-5 bg-white/10 hover:bg-white/20 rounded-lg lg:rounded-xl text-white transition-colors"
          >
            <Layers className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7" />
            <span className="text-sm lg:text-base xl:text-lg font-medium">Gestionar Grupos</span>
          </Link>
          <Link
            to="/partners"
            className="flex items-center gap-3 lg:gap-4 p-3 lg:p-4 xl:p-5 bg-white/10 hover:bg-white/20 rounded-lg lg:rounded-xl text-white transition-colors"
          >
            <Users className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7" />
            <span className="text-sm lg:text-base xl:text-lg font-medium">Asignar Candidatos</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
