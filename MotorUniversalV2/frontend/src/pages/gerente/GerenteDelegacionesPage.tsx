/**
 * Página de Delegación de Aprobaciones - Gerente
 * 
 * Permite al gerente activar/desactivar la capacidad de 
 * aprobar solicitudes de saldo para cada financiero.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldOff,
  Users,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Mail,
  Clock,
  Info,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getFinancierosForDelegation,
  toggleFinancieroDelegation,
  DelegatedFinanciero,
} from '../../services/balanceService';

export default function GerenteDelegacionesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [financieros, setFinancieros] = useState<DelegatedFinanciero[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getFinancierosForDelegation();
      setFinancieros(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar financieros');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (financiero: DelegatedFinanciero) => {
    try {
      setTogglingId(financiero.id);
      setError(null);
      setSuccess(null);

      const newValue = !financiero.can_approve_balance;
      const result = await toggleFinancieroDelegation(financiero.id, newValue);

      setFinancieros(prev =>
        prev.map(f =>
          f.id === financiero.id
            ? { ...f, can_approve_balance: newValue }
            : f
        )
      );

      setSuccess(result.message);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cambiar delegación');
    } finally {
      setTogglingId(null);
    }
  };

  const delegatedCount = financieros.filter(f => f.can_approve_balance).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/gerente"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-600" />
            Delegación de Aprobaciones
          </h1>
          <p className="text-gray-600 mt-1">
            Controla qué financieros pueden aprobar o rechazar solicitudes de saldo
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          Actualizar
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-indigo-800 font-medium">¿Cómo funciona la delegación?</p>
          <p className="text-indigo-700 text-sm mt-1">
            Al activar la delegación para un financiero, este podrá <strong>aprobar o rechazar</strong> solicitudes 
            de saldo directamente, sin necesidad de que un gerente intervenga. El financiero verá las solicitudes 
            recomendadas en su panel y podrá tomar la decisión final.
            Puedes revocar esta delegación en cualquier momento.
          </p>
        </div>
      </div>

      {/* Success/Error messages */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 animate-fadeInDown">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-600">Total Financieros</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{financieros.length}</p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-600">Con Delegación Activa</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{delegatedCount}</p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gray-100 rounded-lg">
              <ShieldOff className="w-5 h-5 text-gray-500" />
            </div>
            <span className="text-sm text-gray-600">Solo Recomendación</span>
          </div>
          <p className="text-2xl font-bold text-gray-600">{financieros.length - delegatedCount}</p>
        </div>
      </div>

      {/* Financieros List */}
      {financieros.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay financieros registrados</h3>
          <p className="text-gray-500">
            Crea un usuario con rol "financiero" para poder delegar aprobaciones.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {financieros.map(financiero => (
            <div
              key={financiero.id}
              className={`bg-white rounded-xl border shadow-sm p-5 transition-all ${
                financiero.can_approve_balance
                  ? 'border-green-200 bg-green-50/30'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* User Info */}
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                    financiero.can_approve_balance
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {financiero.name?.charAt(0)?.toUpperCase() || 'F'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 flex items-center gap-2">
                      {financiero.full_name}
                      {financiero.can_approve_balance && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                          Puede aprobar
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {financiero.email}
                      </span>
                      {financiero.last_login && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Último acceso: {new Date(financiero.last_login).toLocaleDateString('es-MX')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Toggle */}
                <div className="flex items-center gap-3 sm:flex-shrink-0">
                  <span className={`text-sm font-medium ${
                    financiero.can_approve_balance ? 'text-green-700' : 'text-gray-500'
                  }`}>
                    {financiero.can_approve_balance ? 'Delegación activa' : 'Solo recomienda'}
                  </span>
                  <button
                    onClick={() => handleToggle(financiero)}
                    disabled={togglingId === financiero.id}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      financiero.can_approve_balance
                        ? 'bg-green-500 focus:ring-green-500'
                        : 'bg-gray-300 focus:ring-gray-400'
                    } ${togglingId === financiero.id ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        financiero.can_approve_balance ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Details when delegated */}
              {financiero.can_approve_balance && (
                <div className="mt-3 pt-3 border-t border-green-100 flex items-center gap-2 text-sm text-green-700">
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    Este financiero puede aprobar y rechazar solicitudes de saldo sin intervención del gerente.
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
