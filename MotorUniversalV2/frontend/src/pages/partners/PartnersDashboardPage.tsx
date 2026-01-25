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
      <div className="fluid-p-8 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fluid-p-8 max-w-[1920px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700 fluid-text-base">{error}</p>
          <button onClick={loadDashboard} className="ml-auto text-red-700 underline fluid-text-base">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const stats = dashboard?.stats;

  return (
    <div className="fluid-p-8 max-w-[1920px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center fluid-gap-5 fluid-mb-6 fluid-mb-8">
        <div>
          <h1 className="fluid-text-3xl font-bold text-gray-800 flex items-center fluid-gap-2 fluid-gap-4">
            <Building2 className="fluid-icon-xl text-blue-600" />
            Gestión de Partners
          </h1>
          <p className="text-sm fluid-text-lg fluid-text-xl text-gray-600 fluid-mt-1">
            Panel de control para coordinadores
          </p>
        </div>
        <Link
          to="/partners/new"
          className="inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl font-medium fluid-text-base transition-colors"
        >
          <Plus className="fluid-icon-lg" />
          Nuevo Partner
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-6 fluid-mb-6 fluid-mb-8">
        <Link
          to="/partners"
          className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg hover:border-blue-300 transition-all group"
        >
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-3 bg-blue-100 rounded-fluid-xl">
              <Building2 className="fluid-icon-xl text-blue-600" />
            </div>
            <div>
              <p className="fluid-text-3xl font-bold text-gray-900">
                {stats?.total_partners || 0}
              </p>
              <p className="fluid-text-sm text-gray-500">Partners</p>
            </div>
          </div>
          <div className="fluid-mt-3 flex items-center fluid-text-sm text-blue-600 group-hover:text-blue-700">
            <span>Ver todos</span>
            <ChevronRight className="fluid-icon-sm" />
          </div>
        </Link>

        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-3 bg-emerald-100 rounded-fluid-xl">
              <MapPin className="fluid-icon-xl text-emerald-600" />
            </div>
            <div>
              <p className="fluid-text-3xl font-bold text-gray-900">
                {stats?.total_campuses || 0}
              </p>
              <p className="fluid-text-sm text-gray-500">Planteles</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-3 bg-amber-100 rounded-fluid-xl">
              <Layers className="fluid-icon-xl text-amber-600" />
            </div>
            <div>
              <p className="fluid-text-3xl font-bold text-gray-900">
                {stats?.total_groups || 0}
              </p>
              <p className="fluid-text-sm text-gray-500">Grupos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-3 bg-purple-100 rounded-fluid-xl">
              <Users className="fluid-icon-xl text-purple-600" />
            </div>
            <div>
              <p className="fluid-text-3xl font-bold text-gray-900">
                {stats?.total_members || 0}
              </p>
              <p className="fluid-text-sm text-gray-500">Candidatos</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 fluid-gap-8">
        {/* Presencia por Estado */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
          <div className="flex items-center fluid-gap-2 fluid-mb-5">
            <TrendingUp className="fluid-icon-lg text-blue-600" />
            <h2 className="fluid-text-xl font-semibold text-gray-800">
              Presencia por Estado
            </h2>
          </div>
          
          {dashboard?.partners_by_state && dashboard.partners_by_state.length > 0 ? (
            <div className="flex flex-col fluid-gap-3 max-h-[400px] overflow-y-auto">
              {dashboard.partners_by_state.map(({ state, count }) => (
                <div key={state} className="flex items-center justify-between">
                  <span className="fluid-text-base text-gray-700">{state}</span>
                  <span className="fluid-px-2 fluid-py-1 bg-blue-100 text-blue-700 rounded-full fluid-text-sm font-medium">
                    {count} {count === 1 ? 'partner' : 'partners'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 fluid-text-base text-center py-8">
              No hay datos de presencia por estado
            </p>
          )}
        </div>

        {/* Grupos Recientes */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
          <div className="flex items-center fluid-gap-2 fluid-mb-5">
            <Layers className="fluid-icon-lg text-amber-600" />
            <h2 className="fluid-text-xl font-semibold text-gray-800">
              Grupos Recientes
            </h2>
          </div>
          
          {dashboard?.recent_groups && dashboard.recent_groups.length > 0 ? (
            <div className="flex flex-col fluid-gap-3">
              {dashboard.recent_groups.map((group) => (
                <Link
                  key={group.id}
                  to={`/partners/groups/${group.id}`}
                  className="block fluid-p-3 bg-gray-50 hover:bg-gray-100 rounded-fluid-xl transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium fluid-text-base text-gray-900">
                        {group.name}
                      </h3>
                      <p className="fluid-text-sm text-gray-500">
                        {group.campus?.name} • {group.campus?.partner?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="fluid-text-base font-semibold text-gray-700">
                        {group.member_count || 0}
                      </span>
                      <p className="fluid-text-xs text-gray-500">miembros</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 fluid-text-base text-center py-8">
              No hay grupos recientes
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="fluid-mt-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-fluid-2xl fluid-p-6">
        <h2 className="fluid-text-xl font-semibold text-white fluid-mb-5">
          Acciones Rápidas
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 fluid-gap-4">
          <Link
            to="/partners/new"
            className="flex items-center fluid-gap-3 fluid-p-4 bg-white/10 hover:bg-white/20 rounded-fluid-xl text-white transition-colors"
          >
            <Building2 className="fluid-icon-lg" />
            <span className="fluid-text-base font-medium">Crear Partner</span>
          </Link>
          <Link
            to="/partners"
            className="flex items-center fluid-gap-3 fluid-p-4 bg-white/10 hover:bg-white/20 rounded-fluid-xl text-white transition-colors"
          >
            <MapPin className="fluid-icon-lg" />
            <span className="fluid-text-base font-medium">Ver Planteles</span>
          </Link>
          <Link
            to="/partners"
            className="flex items-center fluid-gap-3 fluid-p-4 bg-white/10 hover:bg-white/20 rounded-fluid-xl text-white transition-colors"
          >
            <Layers className="fluid-icon-lg" />
            <span className="fluid-text-base font-medium">Gestionar Grupos</span>
          </Link>
          <Link
            to="/partners"
            className="flex items-center fluid-gap-3 fluid-p-4 bg-white/10 hover:bg-white/20 rounded-fluid-xl text-white transition-colors"
          >
            <Users className="fluid-icon-lg" />
            <span className="fluid-text-base font-medium">Asignar Candidatos</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
