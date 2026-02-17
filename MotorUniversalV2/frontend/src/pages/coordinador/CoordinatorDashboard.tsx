/**
 * Dashboard Principal del Coordinador
 * 
 * Vista de bienvenida con:
 * - Saludo personalizado
 * - Resumen de saldos
 * - Estadísticas de partners, planteles, ciclos, grupos y alumnos
 * - Gráficos visuales con Recharts
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  Building2,
  MapPin,
  Users,
  Layers,
  Calendar,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Plus,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import { getPartnersDashboard, DashboardStats } from '../../services/partnersService';
import { getMyBalance, CoordinatorBalance, formatCurrency } from '../../services/balanceService';

// Colores para los gráficos
const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function CoordinatorDashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [balance, setBalance] = useState<CoordinatorBalance | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Cargar en paralelo
      const [statsData, balanceData] = await Promise.all([
        getPartnersDashboard(),
        getMyBalance().catch(() => null), // Balance puede no existir
      ]);
      
      setDashboardStats(statsData);
      setBalance(balanceData);
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError(err.response?.data?.error || 'Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Obtener saludo según la hora del día
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  // Obtener nombre del coordinador
  const getCoordinatorName = () => {
    if (user?.name) return user.name;
    if (user?.full_name) return user.full_name.split(' ')[0];
    return 'Coordinador';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
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
          <button onClick={loadData} className="ml-auto text-red-700 underline fluid-text-base">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const stats = dashboardStats?.stats;
  const partnersByState = dashboardStats?.partners_by_state || [];

  // Datos para el gráfico de donut
  const distributionData = [
    { name: 'Partners', value: stats?.total_partners || 0 },
    { name: 'Planteles', value: stats?.total_campuses || 0 },
    { name: 'Grupos', value: stats?.total_groups || 0 },
  ];

  return (
    <div className="fluid-p-6 fluid-p-8 max-w-[1920px] mx-auto space-y-6 animate-fade-in-up">
      {/* Header con bienvenida */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-fluid-2xl fluid-p-8 text-white relative overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full transform translate-x-1/3 -translate-y-1/3"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full transform -translate-x-1/3 translate-y-1/3"></div>
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-6">
          <div>
            <div className="flex items-center fluid-gap-3 fluid-mb-2">
              <Sparkles className="fluid-icon-xl text-yellow-300" />
              <span className="text-blue-100 fluid-text-lg">Portal de Coordinador</span>
            </div>
            <h1 className="fluid-text-4xl font-bold fluid-mb-2">
              {getGreeting()}, {getCoordinatorName()}
            </h1>
            <p className="text-blue-100 fluid-text-lg">
              Aquí tienes un resumen de tu actividad y estadísticas
            </p>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center fluid-gap-2 fluid-px-5 fluid-py-3 bg-white/20 hover:bg-white/30 rounded-fluid-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`fluid-icon-lg ${refreshing ? 'animate-spin' : ''}`} />
            <span className="fluid-text-base font-medium">Actualizar</span>
          </button>
        </div>
      </div>

      {/* Grid de contenido principal */}
      <div className="grid grid-cols-1 xl:grid-cols-3 fluid-gap-6">
        {/* Columna izquierda - Saldos y acciones rápidas */}
        <div className="xl:col-span-1 space-y-6">
          {/* Tarjeta de Saldo */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 fluid-p-5">
              <div className="flex items-center fluid-gap-3">
                <div className="fluid-p-3 bg-white/20 rounded-fluid-xl">
                  <Wallet className="fluid-icon-xl text-white" />
                </div>
                <div>
                  <p className="text-white/80 fluid-text-sm">Mi Saldo Actual</p>
                  <p className="text-white fluid-text-3xl font-bold">
                    {balance ? formatCurrency(balance.current_balance) : '$0.00'}
                  </p>
                </div>
              </div>
            </div>
            <div className="fluid-p-5 space-y-3">
              {balance && (
                <div className="grid grid-cols-2 fluid-gap-4 fluid-pb-4 border-b border-gray-100">
                  <div>
                    <p className="text-gray-500 fluid-text-xs">Total Recibido</p>
                    <p className="text-green-600 font-semibold fluid-text-base">
                      {formatCurrency(balance.total_received)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 fluid-text-xs">Total Usado</p>
                    <p className="text-gray-700 font-semibold fluid-text-base">
                      {formatCurrency(balance.total_spent)}
                    </p>
                  </div>
                </div>
              )}
              <Link
                to="/mi-saldo"
                className="flex items-center justify-between fluid-p-3 bg-gray-50 hover:bg-gray-100 rounded-fluid-lg transition-colors group"
              >
                <span className="text-gray-700 fluid-text-sm font-medium">Ver detalles de saldo</span>
                <ChevronRight className="fluid-icon-md text-gray-400 group-hover:text-gray-600 transition-colors" />
              </Link>
              <Link
                to="/solicitar-saldo"
                className="flex items-center justify-center fluid-gap-2 w-full fluid-py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-lg transition-colors fluid-text-sm font-medium"
              >
                <Plus className="fluid-icon-md" />
                Solicitar Saldo
              </Link>
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h3 className="font-semibold text-gray-800 fluid-text-base fluid-mb-4">Acciones Rápidas</h3>
            <div className="space-y-2">
              <Link
                to="/partners/new"
                className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 hover:bg-blue-50 rounded-fluid-lg transition-colors group"
              >
                <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg group-hover:bg-blue-200 transition-colors">
                  <Building2 className="fluid-icon-md text-blue-600" />
                </div>
                <span className="text-gray-700 fluid-text-sm font-medium">Nuevo Partner</span>
                <ArrowRight className="fluid-icon-sm text-gray-400 ml-auto" />
              </Link>
              <Link
                to="/partners"
                className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 hover:bg-green-50 rounded-fluid-lg transition-colors group"
              >
                <div className="fluid-p-2 bg-green-100 rounded-fluid-lg group-hover:bg-green-200 transition-colors">
                  <MapPin className="fluid-icon-md text-green-600" />
                </div>
                <span className="text-gray-700 fluid-text-sm font-medium">Ver Partners</span>
                <ArrowRight className="fluid-icon-sm text-gray-400 ml-auto" />
              </Link>
              <Link
                to="/grupos"
                className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 hover:bg-purple-50 rounded-fluid-lg transition-colors group"
              >
                <div className="fluid-p-2 bg-purple-100 rounded-fluid-lg group-hover:bg-purple-200 transition-colors">
                  <Layers className="fluid-icon-md text-purple-600" />
                </div>
                <span className="text-gray-700 fluid-text-sm font-medium">Ver Grupos</span>
                <ArrowRight className="fluid-icon-sm text-gray-400 ml-auto" />
              </Link>
            </div>
          </div>
        </div>

        {/* Columna derecha - Estadísticas y gráficos */}
        <div className="xl:col-span-2 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-4">
            <Link
              to="/partners"
              className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-lg hover:border-blue-300 transition-all group animate-stagger-in"
              style={{ animationDelay: '0.1s' }}
            >
              <div className="flex items-center fluid-gap-3">
                <div className="fluid-p-3 bg-blue-100 rounded-fluid-xl group-hover:bg-blue-200 transition-colors">
                  <Building2 className="fluid-icon-lg text-blue-600" />
                </div>
                <div>
                  <p className="fluid-text-2xl font-bold text-gray-900">
                    {stats?.total_partners || 0}
                  </p>
                  <p className="fluid-text-xs text-gray-500">Partners</p>
                </div>
              </div>
            </Link>

            <Link
              to="/partners"
              className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-lg hover:border-green-300 transition-all group animate-stagger-in"
              style={{ animationDelay: '0.2s' }}
            >
              <div className="flex items-center fluid-gap-3">
                <div className="fluid-p-3 bg-green-100 rounded-fluid-xl group-hover:bg-green-200 transition-colors">
                  <MapPin className="fluid-icon-lg text-green-600" />
                </div>
                <div>
                  <p className="fluid-text-2xl font-bold text-gray-900">
                    {stats?.total_campuses || 0}
                  </p>
                  <p className="fluid-text-xs text-gray-500">Planteles</p>
                </div>
              </div>
            </Link>

            <Link
              to="/grupos"
              className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-lg hover:border-purple-300 transition-all group animate-stagger-in"
              style={{ animationDelay: '0.3s' }}
            >
              <div className="flex items-center fluid-gap-3">
                <div className="fluid-p-3 bg-purple-100 rounded-fluid-xl group-hover:bg-purple-200 transition-colors">
                  <Layers className="fluid-icon-lg text-purple-600" />
                </div>
                <div>
                  <p className="fluid-text-2xl font-bold text-gray-900">
                    {stats?.total_groups || 0}
                  </p>
                  <p className="fluid-text-xs text-gray-500">Grupos</p>
                </div>
              </div>
            </Link>

            <div
              className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-5 animate-stagger-in"
              style={{ animationDelay: '0.4s' }}
            >
              <div className="flex items-center fluid-gap-3">
                <div className="fluid-p-3 bg-amber-100 rounded-fluid-xl">
                  <Users className="fluid-icon-lg text-amber-600" />
                </div>
                <div>
                  <p className="fluid-text-2xl font-bold text-gray-900">
                    {stats?.total_members || 0}
                  </p>
                  <p className="fluid-text-xs text-gray-500">Alumnos</p>
                </div>
              </div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6">
            {/* Gráfico de distribución */}
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
              <h3 className="font-semibold text-gray-800 fluid-text-base fluid-mb-4 flex items-center fluid-gap-2">
                <TrendingUp className="fluid-icon-md text-blue-600" />
                Distribución General
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {distributionData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [value, 'Cantidad']}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Partners por estado */}
            {partnersByState.length > 0 && (
              <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
                <h3 className="font-semibold text-gray-800 fluid-text-base fluid-mb-4 flex items-center fluid-gap-2">
                  <Calendar className="fluid-icon-md text-green-600" />
                  Partners por Estado
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart
                      data={partnersByState.slice(0, 6)}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                    >
                      <XAxis type="number" />
                      <YAxis dataKey="state" type="category" width={80} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => [value, 'Partners']}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                        }}
                      />
                      <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Grupos recientes */}
          {dashboardStats?.recent_groups && dashboardStats.recent_groups.length > 0 && (
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
              <div className="flex items-center justify-between fluid-mb-4">
                <h3 className="font-semibold text-gray-800 fluid-text-base flex items-center fluid-gap-2">
                  <Layers className="fluid-icon-md text-purple-600" />
                  Grupos Recientes
                </h3>
                <Link
                  to="/grupos"
                  className="text-blue-600 hover:text-blue-700 fluid-text-sm font-medium flex items-center fluid-gap-1"
                >
                  Ver todos
                  <ChevronRight className="fluid-icon-sm" />
                </Link>
              </div>
              <div className="space-y-3">
                {dashboardStats.recent_groups.slice(0, 4).map((group) => (
                  <Link
                    key={group.id}
                    to={`/grupos/${group.id}`}
                    className="flex items-center justify-between fluid-p-3 bg-gray-50 hover:bg-gray-100 rounded-fluid-lg transition-colors group"
                  >
                    <div className="flex items-center fluid-gap-3">
                      <div className="fluid-p-2 bg-purple-100 rounded-fluid-lg">
                        <Layers className="fluid-icon-sm text-purple-600" />
                      </div>
                      <div>
                        <p className="text-gray-800 font-medium fluid-text-sm">{group.name}</p>
                        <p className="text-gray-500 fluid-text-xs">
                          {group.campus?.name || 'Sin plantel'} • {group.member_count || 0} alumnos
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="fluid-icon-md text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
