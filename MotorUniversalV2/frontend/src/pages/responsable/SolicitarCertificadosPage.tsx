/**
 * Página de Solicitar Certificados - Responsable de Plantel
 * 
 * Formulario simple para que el responsable solicite certificados:
 * - Número de certificados necesarios
 * - Grupo (opcional)
 * - Justificación
 * La solicitud se envía al coordinador del plantel.
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Send,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Building2,
  Users,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  createCertificateRequest,
  getMyCampusInfo,
  getCampusBalanceSummary,
  MyCampusInfo,
} from '../../services/balanceService';

export default function SolicitarCertificadosPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedGroupId = searchParams.get('groupId') ? Number(searchParams.get('groupId')) : null;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [campusInfo, setCampusInfo] = useState<MyCampusInfo | null>(null);
  const [currentCerts, setCurrentCerts] = useState(0);

  const [units, setUnits] = useState(1);
  const [groupId, setGroupId] = useState<number | null>(preselectedGroupId);
  const [justification, setJustification] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const info = await getMyCampusInfo();
      setCampusInfo(info);

      // Calcular certificados disponibles actuales
      try {
        const balanceSummary = await getCampusBalanceSummary(info.campus.id);
        const cost = info.campus.certification_cost || 0;
        setCurrentCerts(cost > 0 ? Math.floor(balanceSummary.totals.current_balance / cost) : 0);
      } catch {
        setCurrentCerts(0);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar información del plantel');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campusInfo || units <= 0 || !justification.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      await createCertificateRequest({
        campus_id: campusInfo.campus.id,
        group_id: groupId || undefined,
        units_requested: units,
        justification: justification.trim(),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al enviar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (success) {
    return (
      <div className="max-w-lg mx-auto fluid-py-12 fluid-px-4">
        <div className="bg-white rounded-fluid-2xl shadow-lg border border-green-200 fluid-p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto fluid-mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="fluid-text-xl font-bold text-gray-900 fluid-mb-2">Solicitud enviada</h2>
          <p className="fluid-text-sm text-gray-600 fluid-mb-6">
            Tu solicitud de <strong>{units} certificado{units !== 1 ? 's' : ''}</strong> ha sido enviada al coordinador.
            Recibirás una notificación cuando sea procesada.
          </p>
          <div className="flex fluid-gap-3 justify-center">
            <Link
              to="/mi-plantel"
              className="fluid-px-5 fluid-py-2.5 bg-blue-600 text-white rounded-fluid-xl font-medium fluid-text-sm hover:bg-blue-700 transition-colors"
            >
              Volver a Mi Plantel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto fluid-py-6 fluid-px-4">
      {/* Header */}
      <div className="fluid-mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center fluid-gap-2 text-gray-500 hover:text-gray-700 fluid-text-sm font-medium fluid-mb-3 transition-colors">
          <ArrowLeft className="fluid-icon-sm" /> Volver
        </button>
        <div className="flex items-center fluid-gap-3">
          <div className="fluid-p-3 bg-emerald-100 rounded-fluid-xl">
            <Award className="fluid-icon-lg text-emerald-600" />
          </div>
          <div>
            <h1 className="fluid-text-2xl font-bold text-gray-900">Solicitar Certificados</h1>
            <p className="fluid-text-sm text-gray-500">Solicita certificados para tu plantel</p>
          </div>
        </div>
      </div>

      {/* Campus info */}
      {campusInfo && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-fluid-xl fluid-p-4 fluid-mb-6 border border-blue-200">
          <div className="flex items-center fluid-gap-3">
            <Building2 className="fluid-icon-base text-blue-600 flex-shrink-0" />
            <div>
              <p className="fluid-text-sm font-semibold text-blue-900">{campusInfo.campus.name}</p>
              <p className="fluid-text-xs text-blue-600">
                Certificados disponibles actualmente: <strong className="text-blue-800">{currentCerts}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-start fluid-gap-3">
          <AlertCircle className="fluid-icon-base text-red-500 flex-shrink-0 mt-0.5" />
          <p className="fluid-text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 space-y-5">
        {/* Número de certificados */}
        <div>
          <label className="block fluid-text-sm font-semibold text-gray-700 fluid-mb-1.5">
            Número de certificados <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center fluid-gap-3">
            <input
              type="number"
              min={1}
              max={9999}
              value={units}
              onChange={(e) => setUnits(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-32 fluid-py-2.5 fluid-px-4 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 fluid-text-lg font-bold text-center"
            />
            <span className="fluid-text-sm text-gray-500">certificado{units !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Grupo (opcional) */}
        {campusInfo && campusInfo.groups.length > 0 && (
          <div>
            <label className="block fluid-text-sm font-semibold text-gray-700 fluid-mb-1.5">
              Grupo <span className="fluid-text-xs text-gray-400 font-normal">(opcional)</span>
            </label>
            <select
              value={groupId || ''}
              onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
              className="w-full fluid-py-2.5 fluid-px-4 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 fluid-text-sm"
            >
              <option value="">Sin grupo específico (plantel general)</option>
              {campusInfo.groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <p className="fluid-text-xs text-gray-400 mt-1">Selecciona un grupo si los certificados son para un grupo específico</p>
          </div>
        )}

        {/* Justificación */}
        <div>
          <label className="block fluid-text-sm font-semibold text-gray-700 fluid-mb-1.5">
            Justificación <span className="text-red-500">*</span>
          </label>
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={4}
            placeholder="Explica brevemente por qué necesitas estos certificados..."
            className="w-full fluid-py-2.5 fluid-px-4 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 fluid-text-sm resize-none"
            maxLength={1000}
          />
          <p className="fluid-text-xs text-gray-400 mt-1">{justification.length}/1000 caracteres</p>
        </div>

        {/* Resumen */}
        <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 border border-gray-200">
          <h3 className="fluid-text-sm font-semibold text-gray-700 fluid-mb-2 flex items-center fluid-gap-2">
            <Users className="fluid-icon-sm text-gray-400" />
            Resumen de la solicitud
          </h3>
          <div className="grid grid-cols-2 fluid-gap-3 fluid-text-sm">
            <div>
              <p className="text-gray-500">Certificados:</p>
              <p className="font-bold text-emerald-700 fluid-text-lg">{units}</p>
            </div>
            <div>
              <p className="text-gray-500">Disponibles ahora:</p>
              <p className="font-bold text-blue-700 fluid-text-lg">{currentCerts}</p>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-between pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="fluid-px-5 fluid-py-2.5 text-gray-600 hover:text-gray-900 fluid-text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || units <= 0 || !justification.trim()}
            className="fluid-px-6 fluid-py-2.5 bg-emerald-600 text-white rounded-fluid-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center fluid-gap-2 font-medium shadow-lg transition-all fluid-text-sm"
          >
            {submitting ? (
              <><Loader2 className="fluid-icon-sm animate-spin" /> Enviando...</>
            ) : (
              <><Send className="fluid-icon-sm" /> Enviar solicitud</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
