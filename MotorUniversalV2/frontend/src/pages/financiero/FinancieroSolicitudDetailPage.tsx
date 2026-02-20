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
  Paperclip,
  FileSpreadsheet,
  Image,
  File,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Ban,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import {
  getBalanceRequest,
  reviewRequest,
  cancelRequest,
  approveRequest,
  rejectRequest,
  BalanceRequest,
  getStatusColor,
  getStatusLabel,
  formatCurrency,
} from '../../services/balanceService';

export default function FinancieroSolicitudDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<BalanceRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state (review)
  const [action, setAction] = useState<'recommend_approve' | 'recommend_reject' | 'request_docs' | null>(null);
  const [recommendedAmount, setRecommendedAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [docsRequested, setDocsRequested] = useState('');

  // Approval state (delegated financiero)
  const [approvedAmount, setApprovedAmount] = useState<number>(0);
  const [approverNotes, setApproverNotes] = useState('');
  const [approving, setApproving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<'approve' | 'reject' | null>(null);

  // Cancel state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadRequest();
  }, [id]);

  const loadRequest = async () => {
    try {
      setLoading(true);
      // Get the specific request by ID
      const found = await getBalanceRequest(Number(id));
      if (found) {
        setRequest(found);
        setRecommendedAmount(String(found.amount_requested));
        setApprovedAmount(found.financiero_recommended_amount || found.amount_requested);
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
        state: { message: 'Solicitud actualizada correctamente', type: 'success' } 
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Approval handlers (delegated financiero) ---
  const handleApprove = async () => {
    if (!request) return;
    try {
      setApproving(true);
      await approveRequest(request.id, {
        amount_approved: approvedAmount,
        notes: approverNotes || undefined,
      });
      navigate('/financiero/solicitudes', {
        state: { message: 'Solicitud aprobada exitosamente', type: 'success' },
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al aprobar');
      setApproving(false);
      setShowConfirmModal(null);
    }
  };

  const handleReject = async () => {
    if (!request || !approverNotes.trim()) {
      setError('Debe proporcionar una razón para el rechazo');
      return;
    }
    try {
      setApproving(true);
      await rejectRequest(request.id, { notes: approverNotes });
      navigate('/financiero/solicitudes', {
        state: { message: 'Solicitud rechazada', type: 'info' },
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al rechazar');
      setApproving(false);
      setShowConfirmModal(null);
    }
  };

  const handleCancelRequest = async () => {
    if (!request) return;
    try {
      setCancelling(true);
      await cancelRequest(request.id, { reason: cancelReason });
      navigate('/financiero/solicitudes', {
        state: { message: 'Solicitud cancelada exitosamente', type: 'success' },
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cancelar la solicitud');
      setCancelling(false);
      setShowCancelModal(false);
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
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
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
  const canApprove =
    user?.can_approve_balance === true &&
    ['recommended_approve', 'recommended_reject'].includes(request.status);
  const canCancelRequest = ['pending', 'in_review', 'recommended_approve', 'recommended_reject'].includes(request.status);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
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

          {/* Documentación Adjunta */}
          {request.attachments && request.attachments.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Paperclip className="w-5 h-5" />
                Documentación Adjunta ({request.attachments.length} archivo{request.attachments.length !== 1 ? 's' : ''})
              </h2>
              <div className="space-y-2">
                {request.attachments.map((file, index) => {
                  const getFileIcon = (type: string) => {
                    if (type === 'xlsx' || type === 'xls') return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
                    if (type === 'pdf') return <File className="w-5 h-5 text-red-600" />;
                    if (['jpg', 'jpeg', 'png'].includes(type)) return <Image className="w-5 h-5 text-blue-600" />;
                    return <File className="w-5 h-5 text-gray-600" />;
                  };
                  const formatSize = (bytes: number) => {
                    if (bytes < 1024) return `${bytes} B`;
                    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                  };
                  return (
                    <a
                      key={index}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                    >
                      {getFileIcon(file.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatSize(file.size)} • {file.type.toUpperCase()}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

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
          ) : canApprove ? (
            /* Approval Panel for delegated financiero */
            <div className="bg-white rounded-xl shadow-sm border-2 border-amber-300 p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Aprobación Delegada
                </h2>
              </div>

              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                Usted tiene permisos delegados para aprobar o rechazar esta solicitud.
              </div>

              {/* Financiero recommendation summary */}
              {request.financiero_notes && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-medium text-blue-600 mb-1">Recomendación previa</p>
                  <p className="text-sm text-blue-800">{request.financiero_notes}</p>
                  {request.financiero_recommended_amount && (
                    <p className="text-sm font-medium text-blue-800 mt-1">
                      Monto recomendado: {formatCurrency(request.financiero_recommended_amount)}
                    </p>
                  )}
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Approved amount */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto a Aprobar
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas del aprobador
                </label>
                <textarea
                  value={approverNotes}
                  onChange={(e) => setApproverNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="Comentarios sobre la aprobación o rechazo..."
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal('approve')}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Aprobar
                </button>
                <button
                  onClick={() => {
                    if (!approverNotes.trim()) {
                      setError('Debe proporcionar una razón para el rechazo');
                      return;
                    }
                    setShowConfirmModal('reject');
                  }}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Rechazar
                </button>
              </div>
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

          {/* Cancel Button */}
          {canCancelRequest && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl border border-red-200 hover:bg-red-100 transition-colors font-medium"
            >
              <Ban className="w-4 h-4" />
              Cancelar Solicitud
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {showConfirmModal === 'approve'
                ? 'Confirmar Aprobación'
                : 'Confirmar Rechazo'}
            </h3>
            <p className="text-gray-600 mb-4">
              {showConfirmModal === 'approve'
                ? `¿Está seguro de aprobar esta solicitud por ${formatCurrency(approvedAmount)}?`
                : '¿Está seguro de rechazar esta solicitud?'}
            </p>
            {showConfirmModal === 'approve' && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                <p className="text-sm text-green-800">
                  Se acreditará <strong>{formatCurrency(approvedAmount)}</strong> al saldo del coordinador.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(null)}
                disabled={approving}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={showConfirmModal === 'approve' ? handleApprove : handleReject}
                disabled={approving}
                className={`flex-1 py-2 rounded-lg text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 ${
                  showConfirmModal === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {approving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : showConfirmModal === 'approve' ? (
                  'Aprobar'
                ) : (
                  'Rechazar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Cancelar Solicitud
            </h3>
            <p className="text-gray-600 mb-4">
              ¿Está seguro de cancelar la solicitud #{request.id} por {formatCurrency(request.amount_requested)}? Esta acción no se puede deshacer.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo de cancelación (opcional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                placeholder="Explique por qué desea cancelar..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                No, mantener
              </button>
              <button
                onClick={handleCancelRequest}
                disabled={cancelling}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {cancelling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    Sí, cancelar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
