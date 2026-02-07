/**
 * Página de Solicitar Saldo - Coordinador
 * 
 * Formulario para solicitar nuevo saldo o beca
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  DollarSign,
  Gift,
  Building2,
  Send,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  createBalanceRequest,
} from '../../services/balanceService';
import {
  getGroups,
  CandidateGroup,
} from '../../services/partnersService';
import {
  getAvailableCampuses,
  AvailableCampus,
} from '../../services/userManagementService';

export default function SolicitarSaldoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isBeca = searchParams.get('type') === 'beca';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data
  const [campuses, setCampuses] = useState<AvailableCampus[]>([]);
  const [groups, setGroups] = useState<CandidateGroup[]>([]);
  
  // Form
  const [requestType, setRequestType] = useState<'saldo' | 'beca'>(isBeca ? 'beca' : 'saldo');
  const [amount, setAmount] = useState<string>('');
  const [campusId, setCampusId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [justification, setJustification] = useState('');

  useEffect(() => {
    loadCampuses();
  }, []);

  useEffect(() => {
    if (campusId) {
      loadGroups(campusId);
    } else {
      setGroups([]);
      setGroupId(null);
    }
  }, [campusId]);

  const loadCampuses = async () => {
    try {
      setLoading(true);
      const data = await getAvailableCampuses();
      setCampuses(data.campuses || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar planteles');
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async (campusId: number) => {
    try {
      const data = await getGroups(campusId, { active_only: true });
      setGroups(data.groups || data);
    } catch (err: any) {
      console.error('Error loading groups:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (!amount || parseFloat(amount) <= 0) {
      setError('Ingresa un monto válido');
      return;
    }
    if (!campusId) {
      setError('Selecciona un plantel');
      return;
    }
    if (!justification.trim()) {
      setError('Ingresa una justificación');
      return;
    }
    if (requestType === 'beca' && justification.length < 50) {
      setError('Para solicitudes de beca, la justificación debe ser más detallada (mínimo 50 caracteres)');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await createBalanceRequest({
        request_type: requestType,
        amount_requested: parseFloat(amount),
        campus_id: campusId,
        group_id: groupId || undefined,
        justification: justification.trim(),
      });

      navigate('/coordinador/mi-saldo', {
        state: { message: 'Solicitud enviada exitosamente', type: 'success' }
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al enviar solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/coordinador/mi-saldo"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            {requestType === 'beca' ? (
              <Gift className="w-8 h-8 text-purple-600" />
            ) : (
              <DollarSign className="w-8 h-8 text-green-600" />
            )}
            {requestType === 'beca' ? 'Solicitar Beca' : 'Solicitar Saldo'}
          </h1>
          <p className="text-gray-600 mt-1">
            {requestType === 'beca' 
              ? 'Solicita una beca para tus candidatos'
              : 'Solicita saldo para asignar certificaciones'
            }
          </p>
        </div>
      </div>

      {/* Type Selector */}
      <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Tipo de Solicitud
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setRequestType('saldo')}
            className={`p-4 rounded-xl border-2 transition-all ${
              requestType === 'saldo'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                requestType === 'saldo' ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                <DollarSign className={`w-6 h-6 ${
                  requestType === 'saldo' ? 'text-green-600' : 'text-gray-400'
                }`} />
              </div>
              <div className="text-left">
                <p className={`font-medium ${
                  requestType === 'saldo' ? 'text-green-800' : 'text-gray-700'
                }`}>
                  Saldo
                </p>
                <p className="text-xs text-gray-500">Presupuesto regular</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setRequestType('beca')}
            className={`p-4 rounded-xl border-2 transition-all ${
              requestType === 'beca'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                requestType === 'beca' ? 'bg-purple-100' : 'bg-gray-100'
              }`}>
                <Gift className={`w-6 h-6 ${
                  requestType === 'beca' ? 'text-purple-600' : 'text-gray-400'
                }`} />
              </div>
              <div className="text-left">
                <p className={`font-medium ${
                  requestType === 'beca' ? 'text-purple-800' : 'text-gray-700'
                }`}>
                  Beca
                </p>
                <p className="text-xs text-gray-500">Requiere justificación</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Monto */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Monto a Solicitar (MXN) *
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-10 pr-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>
          {amount && parseFloat(amount) > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              ≈ {Math.floor(parseFloat(amount) / 500)} certificaciones (estimado a $500 c/u)
            </p>
          )}
        </div>

        {/* Destino */}
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h3 className="font-medium text-gray-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-400" />
            Destino del Saldo
          </h3>

          {/* Plantel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plantel *
            </label>
            <select
              value={campusId || ''}
              onChange={(e) => setCampusId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            >
              <option value="">Seleccionar plantel...</option>
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name} {campus.state_name && `(${campus.state_name})`}
                </option>
              ))}
            </select>
          </div>

          {/* Grupo (opcional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grupo (opcional)
            </label>
            <select
              value={groupId || ''}
              onChange={(e) => setGroupId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              disabled={!campusId}
            >
              <option value="">Todos los grupos / General</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} {group.code && `(${group.code})`}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Dejar vacío si el saldo es para uso general en el plantel
            </p>
          </div>
        </div>

        {/* Justificación */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Justificación *
          </label>
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={4}
            placeholder={requestType === 'beca'
              ? 'Explica detalladamente por qué se requiere esta beca, quiénes serán los beneficiarios y cuál es el impacto esperado...'
              : 'Indica para qué se utilizará el saldo, cuántos candidatos se beneficiarán, etc.'
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
            required
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-500">
              {requestType === 'beca' ? 'Mínimo 50 caracteres para becas' : 'Obligatorio'}
            </p>
            <p className="text-xs text-gray-500">
              {justification.length} caracteres
            </p>
          </div>
        </div>

        {/* Info Box para Becas */}
        {requestType === 'beca' && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-purple-500 mt-0.5" />
            <div>
              <p className="font-medium text-purple-800">Solicitud de Beca</p>
              <p className="text-sm text-purple-700 mt-1">
                Las solicitudes de beca requieren una justificación detallada y pueden requerir 
                documentación adicional. El proceso de aprobación puede tomar más tiempo que 
                una solicitud de saldo regular.
              </p>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-4">
          <Link
            to="/coordinador/mi-saldo"
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-center font-medium transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              requestType === 'beca'
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Enviar Solicitud
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
