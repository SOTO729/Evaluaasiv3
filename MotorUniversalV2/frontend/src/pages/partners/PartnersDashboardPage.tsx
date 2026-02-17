/**
 * Dashboard de Coordinador - Gestión de Partners
 * Rediseñado con gradientes, gráficos y atajos a secciones
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Users,
  Layers,
  Plus,
  ChevronRight,
  AlertCircle,
  GraduationCap,
  FileText,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Activity,
  UserCog,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-2xl fluid-p-8 text-center">
          <AlertCircle className="fluid-icon-2xl text-red-500 mx-auto fluid-mb-4" />
          <h2 className="fluid-text-xl font-bold text-red-800 fluid-mb-2">Error al cargar el dashboard</h2>
          <p className="fluid-text-base text-red-600 fluid-mb-6">{error}</p>
          <button
            onClick={loadDashboard}
            className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-red-600 hover:bg-red-700 text-white rounded-fluid-xl font-semibold transition-all"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const stats = dashboard?.stats;

  // Preparar datos para gráfico de barras
  const stateData = (dashboard?.partners_by_state || []).slice(0, 8).map(item => ({
    name: item.state.length > 10 ? item.state.substring(0, 10) + '...' : item.state,
    fullName: item.state,
    partners: item.count,
  }));

  // Datos para gráfico circular
  const pieData = [
    { name: 'Partners', value: stats?.total_partners || 0, color: '#3B82F6' },
    { name: 'Planteles', value: stats?.total_campuses || 0, color: '#10B981' },
    { name: 'Grupos', value: stats?.total_groups || 0, color: '#F59E0B' },
  ];

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-fluid-2xl fluid-p-8 fluid-mb-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-6">
          <div className="flex items-center fluid-gap-5">
            <div className="fluid-p-4 bg-white/20 rounded-fluid-2xl backdrop-blur-sm">
              <Building2 className="fluid-icon-2xl text-white" />
            </div>
            <div>
              <h1 className="fluid-text-3xl font-bold">Panel de Partners</h1>
              <p className="fluid-text-base text-white/80 fluid-mt-2">
                Gestión integral de instituciones educativas, planteles y grupos
              </p>
            </div>
          </div>
          <div className="flex flex-wrap fluid-gap-3">
            <Link
              to="/partners"
              className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-3 bg-white/10 hover:bg-white/20 text-white rounded-fluid-xl font-semibold fluid-text-sm transition-all backdrop-blur-sm border border-white/20"
            >
              <Layers className="fluid-icon-sm" />
              Ver Partners
            </Link>
            <Link
              to="/partners/new"
              className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-3 bg-white hover:bg-gray-100 text-blue-600 rounded-fluid-xl font-semibold fluid-text-sm transition-all shadow-lg"
            >
              <Plus className="fluid-icon-sm" />
              Nuevo Partner
            </Link>
          </div>
        </div>
      </div>

      {/* Estadísticas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-5 fluid-mb-8">
        <Link
          to="/partners"
          className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg hover:border-blue-300 transition-all duration-300 group"
        >
          <div className="flex items-center fluid-gap-4">
            <div className="fluid-p-4 bg-gradient-to-br from-blue-100 to-blue-200 rounded-fluid-xl group-hover:scale-110 transition-transform duration-300">
              <Building2 className="fluid-icon-lg text-blue-600" />
            </div>
            <div>
              <p className="fluid-text-3xl font-bold text-gray-900">{stats?.total_partners || 0}</p>
              <p className="fluid-text-sm text-gray-500 font-medium fluid-mt-1">Partners</p>
            </div>
          </div>
          <div className="fluid-mt-4 flex items-center fluid-gap-1 fluid-text-sm text-blue-600 group-hover:text-blue-700 font-medium">
            <span>Ver todos</span>
            <ChevronRight className="fluid-icon-sm group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center fluid-gap-4">
            <div className="fluid-p-4 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-fluid-xl">
              <MapPin className="fluid-icon-lg text-emerald-600" />
            </div>
            <div>
              <p className="fluid-text-3xl font-bold text-gray-900">{stats?.total_campuses || 0}</p>
              <p className="fluid-text-sm text-gray-500 font-medium fluid-mt-1">Planteles</p>
            </div>
          </div>
          <div className="fluid-mt-4 fluid-text-sm text-gray-400">
            Sedes activas registradas
          </div>
        </div>

        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center fluid-gap-4">
            <div className="fluid-p-4 bg-gradient-to-br from-amber-100 to-amber-200 rounded-fluid-xl">
              <Layers className="fluid-icon-lg text-amber-600" />
            </div>
            <div>
              <p className="fluid-text-3xl font-bold text-gray-900">{stats?.total_groups || 0}</p>
              <p className="fluid-text-sm text-gray-500 font-medium fluid-mt-1">Grupos</p>
            </div>
          </div>
          <div className="fluid-mt-4 fluid-text-sm text-gray-400">
            Grupos de candidatos
          </div>
        </div>

        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center fluid-gap-4">
            <div className="fluid-p-4 bg-gradient-to-br from-purple-100 to-purple-200 rounded-fluid-xl">
              <Users className="fluid-icon-lg text-purple-600" />
            </div>
            <div>
              <p className="fluid-text-3xl font-bold text-gray-900">{stats?.total_members || 0}</p>
              <p className="fluid-text-sm text-gray-500 font-medium fluid-mt-1">Candidatos</p>
            </div>
          </div>
          <div className="fluid-mt-4 fluid-text-sm text-gray-400">
            Inscritos en grupos
          </div>
        </div>
      </div>

      {/* Atajos a Secciones del Módulo */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 fluid-mb-8">
        <div className="flex items-center fluid-gap-3 fluid-mb-6">
          <div className="fluid-p-2 bg-indigo-100 rounded-fluid-lg">
            <Activity className="fluid-icon-base text-indigo-600" />
          </div>
          <h2 className="fluid-text-xl font-bold text-gray-800">Acciones Rápidas</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 fluid-gap-4">
          <Link
            to="/partners/new"
            className="flex flex-col items-center fluid-gap-3 fluid-p-5 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-fluid-xl border border-blue-200 transition-all duration-300 group"
          >
            <div className="fluid-p-3 bg-blue-600 rounded-fluid-xl group-hover:scale-110 transition-transform shadow-lg">
              <Plus className="fluid-icon-base text-white" />
            </div>
            <span className="fluid-text-sm font-semibold text-blue-700 text-center">Nuevo Partner</span>
          </Link>

          <Link
            to="/partners"
            className="flex flex-col items-center fluid-gap-3 fluid-p-5 bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 rounded-fluid-xl border border-emerald-200 transition-all duration-300 group"
          >
            <div className="fluid-p-3 bg-emerald-600 rounded-fluid-xl group-hover:scale-110 transition-transform shadow-lg">
              <Building2 className="fluid-icon-base text-white" />
            </div>
            <span className="fluid-text-sm font-semibold text-emerald-700 text-center">Ver Partners</span>
          </Link>

          <Link
            to="/grupos"
            className="flex flex-col items-center fluid-gap-3 fluid-p-5 bg-gradient-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 rounded-fluid-xl border border-amber-200 transition-all duration-300 group"
          >
            <div className="fluid-p-3 bg-amber-600 rounded-fluid-xl group-hover:scale-110 transition-transform shadow-lg">
              <MapPin className="fluid-icon-base text-white" />
            </div>
            <span className="fluid-text-sm font-semibold text-amber-700 text-center">Planteles</span>
          </Link>

          <Link
            to="/grupos"
            className="flex flex-col items-center fluid-gap-3 fluid-p-5 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-fluid-xl border border-purple-200 transition-all duration-300 group"
          >
            <div className="fluid-p-3 bg-purple-600 rounded-fluid-xl group-hover:scale-110 transition-transform shadow-lg">
              <Layers className="fluid-icon-base text-white" />
            </div>
            <span className="fluid-text-sm font-semibold text-purple-700 text-center">Grupos</span>
          </Link>

          <Link
            to="/grupos"
            className="flex flex-col items-center fluid-gap-3 fluid-p-5 bg-gradient-to-br from-rose-50 to-rose-100 hover:from-rose-100 hover:to-rose-200 rounded-fluid-xl border border-rose-200 transition-all duration-300 group"
          >
            <div className="fluid-p-3 bg-rose-600 rounded-fluid-xl group-hover:scale-110 transition-transform shadow-lg">
              <GraduationCap className="fluid-icon-base text-white" />
            </div>
            <span className="fluid-text-sm font-semibold text-rose-700 text-center">Ciclos</span>
          </Link>

          <Link
            to="/user-management"
            className="flex flex-col items-center fluid-gap-3 fluid-p-5 bg-gradient-to-br from-cyan-50 to-cyan-100 hover:from-cyan-100 hover:to-cyan-200 rounded-fluid-xl border border-cyan-200 transition-all duration-300 group"
          >
            <div className="fluid-p-3 bg-cyan-600 rounded-fluid-xl group-hover:scale-110 transition-transform shadow-lg">
              <UserCog className="fluid-icon-base text-white" />
            </div>
            <span className="fluid-text-sm font-semibold text-cyan-700 text-center">Candidatos</span>
          </Link>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-3 fluid-gap-6 fluid-mb-8">
        {/* Gráfico de barras - Presencia por Estado */}
        <div className="lg:col-span-2 bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
          <div className="flex items-center fluid-gap-3 fluid-mb-6">
            <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg">
              <TrendingUp className="fluid-icon-base text-blue-600" />
            </div>
            <h2 className="fluid-text-lg font-bold text-gray-800">Presencia por Estado</h2>
          </div>
          
          {stateData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={stateData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
                            <p className="font-semibold text-gray-900">{data.fullName}</p>
                            <p className="text-blue-600">{data.partners} partners</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="partners" 
                    fill="#3B82F6" 
                    radius={[6, 6, 0, 0]}
                    name="Partners"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-3" />
                <p className="fluid-text-base text-gray-500">No hay datos de presencia por estado</p>
              </div>
            </div>
          )}
        </div>

        {/* Gráfico circular - Distribución */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
          <div className="flex items-center fluid-gap-3 fluid-mb-6">
            <div className="fluid-p-2 bg-purple-100 rounded-fluid-lg">
              <Activity className="fluid-icon-base text-purple-600" />
            </div>
            <h2 className="fluid-text-lg font-bold text-gray-800">Distribución</h2>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
                          <p className="font-semibold text-gray-900">{data.name}</p>
                          <p style={{ color: data.color }}>{data.value} registros</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Leyenda */}
          <div className="flex flex-wrap justify-center fluid-gap-4 fluid-mt-4">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center fluid-gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="fluid-text-sm text-gray-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grupos Recientes */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="fluid-p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-amber-100 rounded-fluid-lg">
                <Layers className="fluid-icon-base text-amber-600" />
              </div>
              <h2 className="fluid-text-lg font-bold text-gray-800">Grupos Recientes</h2>
            </div>
            <Link
              to="/partners"
              className="inline-flex items-center fluid-gap-1 fluid-text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver todos
              <ArrowRight className="fluid-icon-sm" />
            </Link>
          </div>
        </div>
        
        {dashboard?.recent_groups && dashboard.recent_groups.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {dashboard.recent_groups.map((group) => (
              <Link
                key={group.id}
                to={`/partners/groups/${group.id}`}
                className="flex items-center justify-between fluid-p-5 hover:bg-blue-50 transition-colors group"
              >
                <div className="flex items-center fluid-gap-4">
                  <div className="fluid-p-3 bg-amber-100 rounded-fluid-xl group-hover:bg-amber-200 transition-colors">
                    <Users className="fluid-icon-base text-amber-600" />
                  </div>
                  <div>
                    <h3 className="fluid-text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {group.name}
                    </h3>
                    <p className="fluid-text-sm text-gray-500 fluid-mt-0.5">
                      {group.campus?.name} • {group.campus?.partner?.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center fluid-gap-6">
                  <div className="text-right">
                    <p className="fluid-text-lg font-bold text-gray-900">{group.member_count || 0}</p>
                    <p className="fluid-text-xs text-gray-500">miembros</p>
                  </div>
                  <ChevronRight className="fluid-icon-base text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="fluid-p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto fluid-mb-4">
              <Layers className="fluid-icon-xl text-gray-400" />
            </div>
            <p className="fluid-text-base text-gray-500">No hay grupos recientes</p>
            <p className="fluid-text-sm text-gray-400 fluid-mt-1">Los grupos creados recientemente aparecerán aquí</p>
          </div>
        )}
      </div>

      {/* Resumen de Flujo de Trabajo */}
      <div className="fluid-mt-8 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-fluid-2xl fluid-p-8 text-white">
        <div className="flex items-center fluid-gap-3 fluid-mb-6">
          <FileText className="fluid-icon-lg" />
          <h2 className="fluid-text-xl font-bold">Flujo de Trabajo Típico</h2>
        </div>
        <div className="grid md:grid-cols-5 fluid-gap-4">
          <div className="flex flex-col items-center text-center fluid-p-4 bg-white/10 rounded-fluid-xl backdrop-blur-sm">
            <div className="fluid-p-3 bg-white/20 rounded-full fluid-mb-3">
              <Building2 className="fluid-icon-base" />
            </div>
            <span className="fluid-text-sm font-semibold">1. Crear Partner</span>
            <span className="fluid-text-xs text-white/70 fluid-mt-1">Institución educativa</span>
          </div>
          <div className="flex flex-col items-center text-center fluid-p-4 bg-white/10 rounded-fluid-xl backdrop-blur-sm">
            <div className="fluid-p-3 bg-white/20 rounded-full fluid-mb-3">
              <MapPin className="fluid-icon-base" />
            </div>
            <span className="fluid-text-sm font-semibold">2. Agregar Plantel</span>
            <span className="fluid-text-xs text-white/70 fluid-mt-1">Sede con responsable</span>
          </div>
          <div className="flex flex-col items-center text-center fluid-p-4 bg-white/10 rounded-fluid-xl backdrop-blur-sm">
            <div className="fluid-p-3 bg-white/20 rounded-full fluid-mb-3">
              <GraduationCap className="fluid-icon-base" />
            </div>
            <span className="fluid-text-sm font-semibold">3. Ciclo Escolar</span>
            <span className="fluid-text-xs text-white/70 fluid-mt-1">Período académico</span>
          </div>
          <div className="flex flex-col items-center text-center fluid-p-4 bg-white/10 rounded-fluid-xl backdrop-blur-sm">
            <div className="fluid-p-3 bg-white/20 rounded-full fluid-mb-3">
              <Users className="fluid-icon-base" />
            </div>
            <span className="fluid-text-sm font-semibold">4. Crear Grupo</span>
            <span className="fluid-text-xs text-white/70 fluid-mt-1">Añadir candidatos</span>
          </div>
          <div className="flex flex-col items-center text-center fluid-p-4 bg-white/10 rounded-fluid-xl backdrop-blur-sm">
            <div className="fluid-p-3 bg-white/20 rounded-full fluid-mb-3">
              <CheckCircle2 className="fluid-icon-base" />
            </div>
            <span className="fluid-text-sm font-semibold">5. Asignar Exámenes</span>
            <span className="fluid-text-xs text-white/70 fluid-mt-1">Iniciar evaluación</span>
          </div>
        </div>
      </div>
    </div>
  );
}
