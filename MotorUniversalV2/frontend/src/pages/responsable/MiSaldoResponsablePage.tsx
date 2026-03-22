/**
 * Página de Mis Vouchers - Responsable de Plantel
 * 
 * Muestra los vouchers del plantel en UNIDADES,
 * no en pesos. El responsable solo ve cuántos vouchers
 * tiene disponibles, consumidos, etc.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  Award,
  Gift,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getMyCampusBalance, MyCampusBalanceResponse } from '../../services/balanceService';

export default function MiSaldoResponsablePage() {
  const [data, setData] = useState<MyCampusBalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      setError(null);
      const result = await getMyCampusBalance();
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los vouchers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
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
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const units = data.totals_units;
  const campus = data.campus;

  const usagePercent = units.total_received > 0
    ? Math.round((units.total_spent / units.total_received) * 100)
    : 0;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fadeInDown">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Award className="w-8 h-8 text-green-600" />
            Mis Vouchers
          </h1>
          <p className="text-gray-600 mt-1">
            Vouchers disponibles — {campus.name}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Saldo Total Hero - en UNIDADES */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-8 text-white mb-8 shadow-xl animate-fadeInUp hover-lift">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-green-100 text-sm font-medium mb-2">Vouchers Disponibles</p>
            <p className="text-5xl font-bold">
              {units.current_balance}
            </p>
            <p className="text-green-100 mt-2 text-lg">
              vouchers
            </p>
          </div>
          <div className="mt-6 md:mt-0">
            <Link
              to="/solicitar-certificados"
              className="flex items-center gap-2 px-5 py-3 bg-white text-green-600 rounded-xl font-medium hover:bg-green-50 transition-colors"
            >
              <Award className="w-5 h-5" />
              Solicitar Vouchers
            </Link>
          </div>
        </div>

        {/* Progress Bar */}
        {units.total_received > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between text-sm text-green-100 mb-2">
              <span>Uso de vouchers</span>
              <span>{usagePercent}% consumido</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards en UNIDADES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border shadow-sm animate-fadeInUp delay-100 hover-lift card-transition">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Recibidas</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {units.total_received - units.total_scholarships}
          </p>
          <p className="text-xs text-gray-500 mt-1">vouchers comprados</p>
        </div>

        <div className="bg-white rounded-xl p-5 border shadow-sm animate-fadeInUp delay-200 hover-lift card-transition">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Gift className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Becas</span>
          </div>
          <p className="text-2xl font-bold text-purple-700">
            {units.total_scholarships}
          </p>
          <p className="text-xs text-gray-500 mt-1">vouchers de beca</p>
        </div>

        <div className="bg-white rounded-xl p-5 border shadow-sm animate-fadeInUp delay-300 hover-lift card-transition">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Consumidas</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">
            {units.total_spent}
          </p>
          <p className="text-xs text-gray-500 mt-1">vouchers utilizados</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200 shadow-sm animate-fadeInUp delay-400 hover-lift card-transition">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Wallet className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-green-700">Total Acreditado</span>
          </div>
          <p className="text-2xl font-bold text-green-700">
            {units.total_received}
          </p>
          <p className="text-xs text-gray-500 mt-1">vouchers en total</p>
        </div>
      </div>

      {/* Link a solicitar certificados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/solicitar-certificados"
          className="flex items-center justify-between p-4 bg-white border rounded-xl hover:border-green-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Award className="w-5 h-5 text-green-600" />
            </div>
            <span className="font-medium text-gray-800">Solicitar Vouchers</span>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </Link>

        <Link
          to="/mis-solicitudes"
          className="flex items-center justify-between p-4 bg-white border rounded-xl hover:border-purple-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <span className="font-medium text-gray-800">Mis Solicitudes</span>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </Link>

        <Link
          to="/mi-plantel"
          className="flex items-center justify-between p-4 bg-white border rounded-xl hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </div>
            <span className="font-medium text-gray-800">Mi Plantel</span>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </Link>
      </div>
    </div>
  );
}
