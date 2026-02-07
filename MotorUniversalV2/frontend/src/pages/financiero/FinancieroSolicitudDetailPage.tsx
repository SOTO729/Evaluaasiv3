/**
 * Página de detalle de solicitud para el financiero
 * 
 * Permite:
 * - Ver todos los detalles de la solicitud
 * - Solicitar documentación adicional (becas)
 * - Recomendar aprobar o rechazar
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  DollarSign,
  Building2,
  Users,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  MessageSquare,
  Send,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getPendingRequests,
  reviewRequest,
  BalanceRequest,
  getStatusColor,
  getStatusLabel,
  formatCurrency,
} from '../../services/balanceService';

export default function FinancieroSolicitudDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<BalanceRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [action, setAction] = useState<'recommend_approve' | 'recommend_reject' | 'request_docs' | null>(null);
  const [recommendedAmount, setRecommendedAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [docsRequested, setDocsRequested] = useState('');

  useEffect(() => {
    loadRequest();
  }, [id]);

  const loadRequest = async () => {
    try {
      setLoading(true);
      // Get all requests and find the one we need
      const data = await getPendingRequests({ status: 'all', per_page: 1000 });
      const found = data.requests.find(r => r.id === Number(id));
      if (found) {
        setRequest(found);
        setRecommendedAmount(String(found.amount_requested));
      } else {
        setError('Solicitud no encontrada');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!action || !request) return;

    try {
      setSubmitting(true);
      setError(null);

      let payload: any = { action };

      if (action === 'recommend_approve') {
        payload.recommended_amount = parseFloat(recommendedAmount) || request.amount_requested;
        payload.notes = notes;
      } else if (action === 'recommend_reject') {
        if (!notes.trim()) {
          setError('Debe proporcionar un motivo para rechazar');
          setSubmitting(false);
          return;
        }
        payload.notes = notes;
      } else if (action === 'request_docs') {
        if (!docsRequested.trim()) {
          setError('Debe especificar qué documentación requiere');
          setSubmitting(false);
          return;
        }
        payload.documentation_requested = docsRequested;
      }

      await reviewRequest(request.id, payload);
      navigate('/financiero/solicitudes', { 
        state: { message: 'Solicitud actualizada correctamente' } 
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar la solicitud');
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

  if (!request) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error || 'Solicitud no encontrada'}</p>
          <Link
            to="/financiero/solicitudes"
            className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Volver a solicitudes
          </Link>
        </div>
      </div>
    );
  }

  const canReview = ['pending', 'in_review'].includes(request.status);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/financiero/solicitudes"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Solicitud #{request.id}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
              {getStatusLabel(request.status)}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              request.request_type === 'beca'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {request.request_type_label}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Detalles de la Solicitud
            </h2>

            <div className="space-y-4">
              {/* Amount */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Monto Solicitado</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(request.amount_requested)}
                  </p>
                </div>
              </div>

              {/* Coordinator */}
              <div className="flex items-start gap-4">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Coordinador</p>
                  <p className="font-medium text-gray-900">
                    {request.coordinator?.full_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {request.coordinator?.email}
                  </p>
                </div>
              </div>

              {/* Campus */}
              <div className="flex items-start gap-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Plantel Destino</p>
                  <p className="font-medium text-gray-900">
                    {request.campus?.name || 'No especificado'}
                  </p>
                  {request.campus?.state_name && (
                    <p className="text-sm text-gray-500">{request.campus.state_name}</p>
                  )}
                  {request.campus?.partner_name && (
                    <p className="text-sm text-gray-400">Partner: {request.campus.partner_name}</p>
                  )}
                </div>
              </div>

              {/* Group */}
              {request.group && (
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Grupo</p>
                    <p className="font-medium text-gray-900">{request.group.name}</p>
                    {request.group.code && (
                      <p className="text-sm text-gray-500">Código: {request.group.code}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Date */}
              <div className="flex items-start gap-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha de Solicitud</p>
                  <p className="font-medium text-gray-900">
                    {new Date(request.requested_at).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Justification */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Justificación
            </h2>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-700 whitespace-pre-wrap">
                {request.justification}
              </p>
            </div>
          </div>

          {/* Previous Review (if exists) */}
          {request.financiero_notes && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Revisión Anterior
              </h2>
              <p className="text-blue-700">{request.financiero_notes}</p>
              {request.financiero_reviewed_at && (
                <p className="text-sm text-blue-500 mt-2">
                  Revisado: {new Date(request.financiero_reviewed_at).toLocaleDateString('es-MX')}
                </p>
              )}
            </div>
          )}

          {/* Documentation requested */}
          {request.documentation_requested && (
            <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-6">
              <h2 className="text-lg font-semibold text-yellow-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Documentación Solicitada
              </h2>
              <p className="text-yellow-700">{request.documentation_requested}</p>
              <div className="mt-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  request.documentation_provided
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {request.documentation_provided ? 'Documentación recibida' : 'Pendiente de envío'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Actions */}
        <div className="space-y-6">
          {canReview ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Revisar Solicitud
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Action Selection */}
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => setAction('recommend_approve')}
                  className={`w-full p-4 rounded-lg border-2 transition-colors flex items-center gap-3 ${
                    action === 'recommend_approve'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <CheckCircle2 className={`w-5 h-5 ${
                    action === 'recommend_approve' ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  <span className={action === 'recommend_approve' ? 'text-green-700 font-medium' : 'text-gray-700'}>
                    Recomendar Aprobar
                  </span>
                </button>

                <button
                  onClick={() => setAction('recommend_reject')}
                  className={`w-full p-4 rounded-lg border-2 transition-colors flex items-center gap-3 ${
                    action === 'recommend_reject'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-red-300'
                  }`}
                >
                  <XCircle className={`w-5 h-5 ${
                    action === 'recommend_reject' ? 'text-red-600' : 'text-gray-400'
                  }`} />
                  <span className={action === 'recommend_reject' ? 'text-red-700 font-medium' : 'text-gray-700'}>
                    Recomendar Rechazar
                  </span>
                </button>

                {request.request_type === 'beca' && (
                  <button
                    onClick={() => setAction('request_docs')}
                    className={`w-full p-4 rounded-lg border-2 transition-colors flex items-center gap-3 ${
                      action === 'request_docs'
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-gray-200 hover:border-yellow-300'
                    }`}
                  >
                    <FileText className={`w-5 h-5 ${
                      action === 'request_docs' ? 'text-yellow-600' : 'text-gray-400'
                    }`} />
                    <span className={action === 'request_docs' ? 'text-yellow-700 font-medium' : 'text-gray-700'}>
                      Solicitar Documentos
                    </span>
                  </button>
                )}
              </div>

              {/* Action Form */}
              {action === 'recommend_approve' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monto Recomendado
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={recommendedAmount}
                        onChange={(e) => setRecommendedAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Puede modificar si considera que el monto debe ser diferente
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notas (opcional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Comentarios adicionales..."
                    />
                  </div>
                </div>
              )}

              {action === 'recommend_reject' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo del rechazo *
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    placeholder="Explique el motivo por el cual recomienda rechazar..."
                    required
                  />
                </div>
              )}

              {action === 'request_docs' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Documentación requerida *
                  </label>
                  <textarea
                    value={docsRequested}
                    onChange={(e) => setDocsRequested(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    placeholder="Especifique qué documentos necesita que el coordinador proporcione..."
                    required
                  />
                </div>
              )}

              {/* Submit Button */}
              {action && (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={`w-full mt-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                    action === 'recommend_approve'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : action === 'recommend_reject'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  } disabled:opacity-50`}
                >
                  {submitting ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Enviar Recomendación
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                Solicitud ya procesada
              </h3>
              <p className="text-gray-500 mt-1">
                Esta solicitud ya fue revisada y está pendiente de aprobación final
              </p>
            </div>
          )}

          {/* Quick Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Información</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Estado</dt>
                <dd className={`text-sm font-medium ${getStatusColor(request.status)} px-2 py-0.5 rounded`}>
                  {getStatusLabel(request.status)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Tipo</dt>
                <dd className="text-sm font-medium text-gray-900">{request.request_type_label}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Solicitado</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {new Date(request.requested_at).toLocaleDateString('es-MX')}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
