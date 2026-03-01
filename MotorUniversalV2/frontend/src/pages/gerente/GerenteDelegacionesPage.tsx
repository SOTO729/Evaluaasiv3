/**
 * Página de Delegaciones del Gerente
 * Gestionar permisos de aprobación de financieros
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldOff,
  Users,
  AlertCircle,
  CheckCircle2,
  Mail,
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

  useEffect(() => { loadData(); }, []);

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

  const handleToggle = async (id: string, currentState: boolean) => {
    try {
      setTogglingId(id);
      setError(null);
      const result = await toggleFinancieroDelegation(id, !currentState);
      setFinancieros((prev) =>
        prev.map((f) => (f.id === id ? { ...f, can_approve_balance: result.financiero.can_approve_balance } : f))
      );
      setSuccess(result.financiero.can_approve_balance ? 'Delegación activada exitosamente' : 'Delegación revocada');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cambiar delegación');
    } finally {
      setTogglingId(null);
    }
  };

  const delegatedCount = financieros.filter((f) => f.can_approve_balance).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />

        <div className="relative flex items-center fluid-gap-4">
          <Link to="/gerente" className="fluid-p-2 bg-white/15 rounded-fluid-lg hover:bg-white/25 transition-colors">
            <ArrowLeft className="fluid-icon-sm text-white" />
          </Link>
          <div className="fluid-p-3 bg-white/15 rounded-fluid-xl backdrop-blur-sm">
            <Shield className="fluid-icon-xl text-white" />
          </div>
          <div>
            <h1 className="fluid-text-3xl font-bold">Delegaciones</h1>
            <p className="fluid-text-base text-white/80">Gestionar permisos de aprobación</p>
          </div>
        </div>
      </div>

      {/* Banner informativo */}
      <div className="bg-indigo-50/80 border border-indigo-200/60 rounded-fluid-2xl fluid-p-5 fluid-mb-6">
        <div className="flex items-start fluid-gap-3">
          <Info className="fluid-icon-sm text-indigo-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-indigo-800 fluid-text-sm">¿Cómo funcionan las delegaciones?</p>
            <p className="fluid-text-xs text-indigo-600 fluid-mt-1 leading-relaxed">
              Los financieros con delegación activada pueden aprobar solicitudes de saldo directamente sin necesidad de su aprobación. 
              Los financieros sin delegación solo pueden recomendar aprobación o rechazo.
            </p>
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-center fluid-gap-2 animate-fade-in-up">
          <CheckCircle2 className="fluid-icon-sm text-green-500 flex-shrink-0" />
          <p className="text-green-700 fluid-text-sm font-medium">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-center fluid-gap-2">
          <AlertCircle className="fluid-icon-sm text-red-500 flex-shrink-0" />
          <p className="text-red-700 fluid-text-sm">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4 fluid-mb-6">
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5 flex items-center fluid-gap-4">
          <div className="fluid-p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-fluid-xl shadow-sm">
            <Users className="fluid-icon-lg text-white" />
          </div>
          <div>
            <p className="fluid-text-2xl font-bold text-gray-800">{financieros.length}</p>
            <p className="fluid-text-xs text-gray-500 font-medium">Total Financieros</p>
          </div>
        </div>
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5 flex items-center fluid-gap-4">
          <div className="fluid-p-3 bg-gradient-to-br from-emerald-500 to-green-500 rounded-fluid-xl shadow-sm">
            <ShieldCheck className="fluid-icon-lg text-white" />
          </div>
          <div>
            <p className="fluid-text-2xl font-bold text-gray-800">{delegatedCount}</p>
            <p className="fluid-text-xs text-gray-500 font-medium">Con Delegación</p>
          </div>
        </div>
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5 flex items-center fluid-gap-4">
          <div className="fluid-p-3 bg-gradient-to-br from-gray-400 to-gray-500 rounded-fluid-xl shadow-sm">
            <ShieldOff className="fluid-icon-lg text-white" />
          </div>
          <div>
            <p className="fluid-text-2xl font-bold text-gray-800">{financieros.length - delegatedCount}</p>
            <p className="fluid-text-xs text-gray-500 font-medium">Solo Recomendación</p>
          </div>
        </div>
      </div>

      {/* Financieros */}
      {financieros.length === 0 ? (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-6 text-center">
          <Users className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-3" />
          <p className="fluid-text-lg text-gray-500">No hay financieros registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 fluid-gap-4">
          {financieros.map((fin) => (
            <div
              key={fin.id}
              className={`bg-white rounded-fluid-2xl shadow-sm border overflow-hidden transition-all duration-300 hover:shadow-md ${
                fin.can_approve_balance ? 'border-emerald-200 hover:border-emerald-300' : 'border-gray-200/80 hover:border-gray-300'
              }`}
            >
              <div className={`h-1 ${fin.can_approve_balance ? 'bg-gradient-to-r from-emerald-400 to-green-400' : 'bg-gray-200'}`} />
              <div className="fluid-p-5">
                <div className="flex items-start justify-between fluid-mb-4">
                  <div className="flex items-center fluid-gap-3">
                    <div className={`fluid-w-10 fluid-h-10 rounded-full flex items-center justify-center font-semibold text-white fluid-text-sm ${
                      fin.can_approve_balance
                        ? 'bg-gradient-to-br from-emerald-500 to-green-500'
                        : 'bg-gradient-to-br from-gray-400 to-gray-500'
                    }`}>
                      {(fin.full_name || fin.email || 'F')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 fluid-text-sm">{fin.full_name || 'Sin nombre'}</p>
                      <p className="fluid-text-xs text-gray-500 flex items-center fluid-gap-1">
                        <Mail className="fluid-icon-xs" /> {fin.email}
                      </p>
                    </div>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(fin.id, fin.can_approve_balance)}
                    disabled={togglingId === fin.id}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${
                      fin.can_approve_balance ? 'bg-emerald-500' : 'bg-gray-300'
                    } ${togglingId === fin.id ? 'opacity-50' : ''}`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                        fin.can_approve_balance ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className={`fluid-px-3 fluid-py-2 rounded-fluid-xl fluid-text-xs font-medium ${
                  fin.can_approve_balance
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : 'bg-gray-50 text-gray-500 border border-gray-200/60'
                }`}>
                  {fin.can_approve_balance ? (
                    <span className="flex items-center fluid-gap-1"><ShieldCheck className="fluid-icon-xs" /> Puede aprobar directamente</span>
                  ) : (
                    <span className="flex items-center fluid-gap-1"><ShieldOff className="fluid-icon-xs" /> Solo puede recomendar</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
