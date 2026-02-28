/**
 * Página de detalle de solicitud para el financiero
 * 
 * Permite:
 * - Ver todos los detalles de la solicitud
 * - Solicitar documentación adicional (becas)
 * - Recomendar aprobar o rechazar
 * - Aprobar/rechazar (financiero delegado)
 * - Cancelar solicitud
 * 
 * Diseño fluid responsive consistente con el resto del sitio
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
      <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-2xl fluid-p-6 text-center">
          <AlertCircle className="fluid-icon-xl text-red-500 mx-auto fluid-mb-4" />
          <h2 className="fluid-text-xl font-semibold text-red-800 fluid-mb-2">Error</h2>
          <p className="text-red-600 fluid-text-base">{error || 'Solicitud no encontrada'}</p>
          <Link
            to="/financiero/solicitudes"
            className="fluid-mt-4 inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-red-600 text-white rounded-fluid-xl hover:bg-red-700 transition-colors"
          >
            <ArrowLeft className="fluid-icon-xs" />
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

  const getFileIcon = (type: string) => {
    if (type === 'xlsx' || type === 'xls') return <FileSpreadsheet className="fluid-icon-sm text-green-600" />;
    if (type === 'pdf') return <File className="fluid-icon-sm text-red-600" />;
    if (['jpg', 'jpeg', 'png'].includes(type)) return <Image className="fluid-icon-sm text-blue-600" />;
    return <File className="fluid-icon-sm text-gray-600" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* ===== HEADER CON GRADIENTE ===== */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
            <div className="flex items-center fluid-gap-4">
              <Link
                to="/financiero/solicitudes"
                className="fluid-p-2.5 bg-white/20 hover:bg-white/30 rounded-fluid-xl transition-all duration-300 hover:scale-105"
              >
                <ArrowLeft className="fluid-icon-lg text-white" />
              </Link>
              <div>
                <div className="flex items-center fluid-gap-3 flex-wrap">
                  <h1 className="fluid-text-3xl font-bold text-white">
                    Solicitud #{request.id}
                  </h1>
                  <span className={`fluid-px-3 fluid-py-1 rounded-full fluid-text-xs font-medium border ${getStatusColor(request.status)} border-white/20`}>
                    {getStatusLabel(request.status)}
                  </span>
                  <span className={`fluid-px-3 fluid-py-1 rounded-full fluid-text-xs font-medium ${
                    request.request_type === 'beca'
                      ? 'bg-purple-200/30 text-white border border-purple-300/40'
                      : 'bg-white/15 text-white border border-white/20'
                  }`}>
                    {request.request_type === 'beca' ? '🎓 ' : '💰 '}{request.request_type_label}
                  </span>
                </div>
                <p className="fluid-text-base text-white/80 fluid-mt-1">
                  {request.coordinator?.full_name} — {formatCurrency(request.amount_requested)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 fluid-gap-6">
        {/* ===== CONTENIDO PRINCIPAL (2/3) ===== */}
        <div className="lg:col-span-2 space-y-5">
          {/* Detalles de la Solicitud */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
            <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
                <FileText className="fluid-icon-sm text-indigo-600" />
                Detalles de la Solicitud
              </h2>
            </div>

            <div className="fluid-p-5 space-y-4">
              {/* Monto Destacado */}
              <div className="flex items-center fluid-gap-4 fluid-p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-fluid-xl border border-emerald-200/60">
                <div className="fluid-p-3 bg-emerald-100 rounded-fluid-xl">
                  <DollarSign className="fluid-icon-lg text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="fluid-text-xs text-emerald-600 font-medium uppercase tracking-wider">Monto Solicitado</p>
                  <p className="fluid-text-2xl font-bold text-gray-900">
                    {formatCurrency(request.amount_requested)}
                  </p>
                </div>
              </div>

              {/* Grid de información */}
              <div className="grid grid-cols-1 sm:grid-cols-2 fluid-gap-4">
                {/* Coordinador */}
                <div className="flex items-start fluid-gap-3 fluid-p-3 bg-gray-50/80 rounded-fluid-xl">
                  <div className="fluid-p-2 bg-indigo-100 rounded-fluid-lg flex-shrink-0">
                    <Users className="fluid-icon-sm text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="fluid-text-xs text-gray-500 font-medium">Coordinador</p>
                    <p className="font-semibold text-gray-900 fluid-text-sm truncate">
                      {request.coordinator?.full_name}
                    </p>
                    <p className="fluid-text-xs text-gray-500 truncate">
                      {request.coordinator?.email}
                    </p>
                  </div>
                </div>

                {/* Plantel */}
                <div className="flex items-start fluid-gap-3 fluid-p-3 bg-gray-50/80 rounded-fluid-xl">
                  <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg flex-shrink-0">
                    <Building2 className="fluid-icon-sm text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="fluid-text-xs text-gray-500 font-medium">Plantel Destino</p>
                    <p className="font-semibold text-gray-900 fluid-text-sm truncate">
                      {request.campus?.name || 'No especificado'}
                    </p>
                    {request.campus?.state_name && (
                      <p className="fluid-text-xs text-gray-500">{request.campus.state_name}</p>
                    )}
                    {request.campus?.partner_name && (
                      <p className="fluid-text-xs text-gray-400">Partner: {request.campus.partner_name}</p>
                    )}
                  </div>
                </div>

                {/* Grupo */}
                {request.group && (
                  <div className="flex items-start fluid-gap-3 fluid-p-3 bg-gray-50/80 rounded-fluid-xl">
                    <div className="fluid-p-2 bg-purple-100 rounded-fluid-lg flex-shrink-0">
                      <Users className="fluid-icon-sm text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="fluid-text-xs text-gray-500 font-medium">Grupo</p>
                      <p className="font-semibold text-gray-900 fluid-text-sm">{request.group.name}</p>
                      {request.group.code && (
                        <p className="fluid-text-xs text-gray-500">Código: {request.group.code}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Fecha */}
                <div className="flex items-start fluid-gap-3 fluid-p-3 bg-gray-50/80 rounded-fluid-xl">
                  <div className="fluid-p-2 bg-gray-100 rounded-fluid-lg flex-shrink-0">
                    <Calendar className="fluid-icon-sm text-gray-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="fluid-text-xs text-gray-500 font-medium">Fecha de Solicitud</p>
                    <p className="font-semibold text-gray-900 fluid-text-sm">
                      {new Date(request.requested_at).toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="fluid-text-xs text-gray-500">
                      {new Date(request.requested_at).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Justificación */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
            <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
                <MessageSquare className="fluid-icon-sm text-blue-600" />
                Justificación
              </h2>
            </div>
            <div className="fluid-p-5">
              <div className="fluid-p-4 bg-blue-50/50 rounded-fluid-xl border border-blue-100/50">
                <p className="text-gray-700 whitespace-pre-wrap fluid-text-sm leading-relaxed">
                  {request.justification}
                </p>
              </div>
            </div>
          </div>

          {/* Documentación Adjunta */}
          {request.attachments && request.attachments.length > 0 && (
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
              <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
                  <Paperclip className="fluid-icon-sm text-amber-600" />
                  Documentación Adjunta
                  <span className="fluid-px-2 fluid-py-0.5 bg-amber-100 text-amber-700 rounded-full fluid-text-xs font-medium">
                    {request.attachments.length}
                  </span>
                </h2>
              </div>
              <div className="fluid-p-5 fluid-gap-2 flex flex-col">
                {request.attachments.map((file, index) => (
                  <a
                    key={index}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 rounded-fluid-xl hover:bg-indigo-50 transition-all duration-200 group border border-gray-100 hover:border-indigo-200"
                  >
                    {getFileIcon(file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="fluid-text-sm font-medium text-gray-800 truncate group-hover:text-indigo-700">{file.name}</p>
                      <p className="fluid-text-xs text-gray-500">{formatSize(file.size)} • {file.type.toUpperCase()}</p>
                    </div>
                    <ExternalLink className="fluid-icon-xs text-gray-400 group-hover:text-indigo-600 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Revisión Anterior */}
          {request.financiero_notes && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-fluid-2xl border border-blue-200/60 overflow-hidden">
              <div className="fluid-p-5 border-b border-blue-200/40">
                <h2 className="fluid-text-lg font-semibold text-blue-900 flex items-center fluid-gap-2">
                  <MessageSquare className="fluid-icon-sm text-blue-600" />
                  Revisión Anterior
                </h2>
              </div>
              <div className="fluid-p-5">
                <p className="text-blue-700 fluid-text-sm">{request.financiero_notes}</p>
                {request.financiero_reviewed_at && (
                  <p className="fluid-text-xs text-blue-500 fluid-mt-2">
                    Revisado: {new Date(request.financiero_reviewed_at).toLocaleDateString('es-MX')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Documentación Solicitada */}
          {request.documentation_requested && (
            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-fluid-2xl border border-yellow-200/60 overflow-hidden">
              <div className="fluid-p-5 border-b border-yellow-200/40">
                <h2 className="fluid-text-lg font-semibold text-yellow-900 flex items-center fluid-gap-2">
                  <AlertCircle className="fluid-icon-sm text-yellow-600" />
                  Documentación Solicitada
                </h2>
              </div>
              <div className="fluid-p-5">
                <p className="text-yellow-700 fluid-text-sm">{request.documentation_requested}</p>
                <div className="fluid-mt-3">
                  <span className={`inline-flex items-center fluid-px-2.5 fluid-py-1 rounded-full fluid-text-xs font-medium ${
                    request.documentation_provided
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {request.documentation_provided ? '✓ Documentación recibida' : '⏳ Pendiente de envío'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== SIDEBAR - ACCIONES (1/3) ===== */}
        <div className="space-y-5">
          {canReview ? (
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
              <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="fluid-text-lg font-semibold text-gray-900">Revisar Solicitud</h2>
                <p className="fluid-text-xs text-gray-500 fluid-mt-1">Seleccione una acción para proceder</p>
              </div>

              <div className="fluid-p-5">
                {error && (
                  <div className="fluid-mb-4 fluid-p-3 bg-red-50 border border-red-200 rounded-fluid-xl text-red-700 fluid-text-sm flex items-center fluid-gap-2">
                    <AlertCircle className="fluid-icon-xs flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Action Selection */}
                <div className="space-y-2 fluid-mb-5">
                  <button
                    onClick={() => setAction('recommend_approve')}
                    className={`w-full fluid-p-3.5 rounded-fluid-xl border-2 transition-all duration-200 flex items-center fluid-gap-3 ${
                      action === 'recommend_approve'
                        ? 'border-green-500 bg-green-50 shadow-sm shadow-green-100'
                        : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'
                    }`}
                  >
                    <div className={`fluid-p-1.5 rounded-fluid-lg ${action === 'recommend_approve' ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <CheckCircle2 className={`fluid-icon-sm ${
                        action === 'recommend_approve' ? 'text-green-600' : 'text-gray-400'
                      }`} />
                    </div>
                    <span className={`fluid-text-sm font-medium ${action === 'recommend_approve' ? 'text-green-700' : 'text-gray-700'}`}>
                      Recomendar Aprobar
                    </span>
                  </button>

                  <button
                    onClick={() => setAction('recommend_reject')}
                    className={`w-full fluid-p-3.5 rounded-fluid-xl border-2 transition-all duration-200 flex items-center fluid-gap-3 ${
                      action === 'recommend_reject'
                        ? 'border-red-500 bg-red-50 shadow-sm shadow-red-100'
                        : 'border-gray-200 hover:border-red-300 hover:bg-red-50/50'
                    }`}
                  >
                    <div className={`fluid-p-1.5 rounded-fluid-lg ${action === 'recommend_reject' ? 'bg-red-100' : 'bg-gray-100'}`}>
                      <XCircle className={`fluid-icon-sm ${
                        action === 'recommend_reject' ? 'text-red-600' : 'text-gray-400'
                      }`} />
                    </div>
                    <span className={`fluid-text-sm font-medium ${action === 'recommend_reject' ? 'text-red-700' : 'text-gray-700'}`}>
                      Recomendar Rechazar
                    </span>
                  </button>

                  {request.request_type === 'beca' && (
                    <button
                      onClick={() => setAction('request_docs')}
                      className={`w-full fluid-p-3.5 rounded-fluid-xl border-2 transition-all duration-200 flex items-center fluid-gap-3 ${
                        action === 'request_docs'
                          ? 'border-yellow-500 bg-yellow-50 shadow-sm shadow-yellow-100'
                          : 'border-gray-200 hover:border-yellow-300 hover:bg-yellow-50/50'
                      }`}
                    >
                      <div className={`fluid-p-1.5 rounded-fluid-lg ${action === 'request_docs' ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                        <FileText className={`fluid-icon-sm ${
                          action === 'request_docs' ? 'text-yellow-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <span className={`fluid-text-sm font-medium ${action === 'request_docs' ? 'text-yellow-700' : 'text-gray-700'}`}>
                        Solicitar Documentos
                      </span>
                    </button>
                  )}
                </div>

                {/* Action Form */}
                {action === 'recommend_approve' && (
                  <div className="space-y-4 animate-fade-in-up">
                    <div>
                      <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1.5">
                        Monto Recomendado
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 fluid-text-sm">$</span>
                        <input
                          type="number"
                          value={recommendedAmount}
                          onChange={(e) => setRecommendedAmount(e.target.value)}
                          className="w-full pl-8 pr-4 fluid-py-2.5 border border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 fluid-text-sm bg-gray-50/50 transition-all"
                          placeholder="0.00"
                        />
                      </div>
                      <p className="fluid-text-xs text-gray-400 fluid-mt-1">
                        Puede modificar si considera que el monto debe ser diferente
                      </p>
                    </div>
                    <div>
                      <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1.5">
                        Notas (opcional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="w-full fluid-px-3 fluid-py-2.5 border border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 fluid-text-sm bg-gray-50/50 transition-all resize-none"
                        placeholder="Comentarios adicionales..."
                      />
                    </div>
                  </div>
                )}

                {action === 'recommend_reject' && (
                  <div className="animate-fade-in-up">
                    <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1.5">
                      Motivo del rechazo *
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      className="w-full fluid-px-3 fluid-py-2.5 border border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 fluid-text-sm bg-gray-50/50 transition-all resize-none"
                      placeholder="Explique el motivo por el cual recomienda rechazar..."
                      required
                    />
                  </div>
                )}

                {action === 'request_docs' && (
                  <div className="animate-fade-in-up">
                    <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1.5">
                      Documentación requerida *
                    </label>
                    <textarea
                      value={docsRequested}
                      onChange={(e) => setDocsRequested(e.target.value)}
                      rows={4}
                      className="w-full fluid-px-3 fluid-py-2.5 border border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 fluid-text-sm bg-gray-50/50 transition-all resize-none"
                      placeholder="Especifique qué documentos necesita..."
                      required
                    />
                  </div>
                )}

                {/* Submit Button */}
                {action && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`w-full fluid-mt-5 fluid-py-3 rounded-fluid-xl font-medium flex items-center justify-center fluid-gap-2 transition-all duration-200 fluid-text-sm shadow-sm hover:shadow-md ${
                      action === 'recommend_approve'
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : action === 'recommend_reject'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    } disabled:opacity-50`}
                  >
                    {submitting ? (
                      <Loader2 className="fluid-icon-sm animate-spin" />
                    ) : (
                      <>
                        <Send className="fluid-icon-xs" />
                        Enviar Recomendación
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : canApprove ? (
            /* Approval Panel for delegated financiero */
            <div className="bg-white rounded-fluid-2xl shadow-sm border-2 border-amber-300 overflow-hidden">
              <div className="fluid-p-5 border-b border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
                <div className="flex items-center fluid-gap-2">
                  <ShieldCheck className="fluid-icon-sm text-amber-600" />
                  <h2 className="fluid-text-lg font-semibold text-gray-900">Aprobación Delegada</h2>
                </div>
                <p className="fluid-text-xs text-amber-600 fluid-mt-1">
                  Usted tiene permisos delegados para aprobar o rechazar esta solicitud.
                </p>
              </div>

              <div className="fluid-p-5">
                {/* Recomendación previa */}
                {request.financiero_notes && (
                  <div className="fluid-mb-4 fluid-p-3 bg-blue-50 border border-blue-200 rounded-fluid-xl">
                    <p className="fluid-text-xs font-medium text-blue-600 fluid-mb-1">Recomendación previa</p>
                    <p className="fluid-text-sm text-blue-800">{request.financiero_notes}</p>
                    {request.financiero_recommended_amount && (
                      <p className="fluid-text-sm font-medium text-blue-800 fluid-mt-1">
                        Monto recomendado: {formatCurrency(request.financiero_recommended_amount)}
                      </p>
                    )}
                  </div>
                )}

                {error && (
                  <div className="fluid-mb-4 fluid-p-3 bg-red-50 border border-red-200 rounded-fluid-xl text-red-700 fluid-text-sm flex items-center fluid-gap-2">
                    <AlertCircle className="fluid-icon-xs flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Monto a aprobar */}
                <div className="fluid-mb-4">
                  <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1.5">
                    Monto a Aprobar
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 fluid-text-sm">$</span>
                    <input
                      type="number"
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-4 fluid-py-2.5 border border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-amber-500 fluid-text-sm bg-gray-50/50"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* Notas */}
                <div className="fluid-mb-5">
                  <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1.5">
                    Notas del aprobador
                  </label>
                  <textarea
                    value={approverNotes}
                    onChange={(e) => setApproverNotes(e.target.value)}
                    rows={3}
                    className="w-full fluid-px-3 fluid-py-2.5 border border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-amber-500 fluid-text-sm bg-gray-50/50 resize-none"
                    placeholder="Comentarios sobre la aprobación o rechazo..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex fluid-gap-3">
                  <button
                    onClick={() => setShowConfirmModal('approve')}
                    className="flex-1 fluid-py-3 bg-green-600 hover:bg-green-700 text-white rounded-fluid-xl font-medium flex items-center justify-center fluid-gap-2 transition-all duration-200 fluid-text-sm shadow-sm hover:shadow-md"
                  >
                    <CheckCircle2 className="fluid-icon-xs" />
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
                    className="flex-1 fluid-py-3 bg-red-600 hover:bg-red-700 text-white rounded-fluid-xl font-medium flex items-center justify-center fluid-gap-2 transition-all duration-200 fluid-text-sm shadow-sm hover:shadow-md"
                  >
                    <XCircle className="fluid-icon-xs" />
                    Rechazar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-fluid-2xl border border-gray-200/80 fluid-p-6 text-center">
              <div className="fluid-p-3 bg-gray-100 rounded-full inline-flex fluid-mb-3">
                <Clock className="fluid-icon-lg text-gray-400" />
              </div>
              <h3 className="fluid-text-base font-medium text-gray-900">
                Solicitud ya procesada
              </h3>
              <p className="text-gray-500 fluid-mt-1 fluid-text-sm">
                Esta solicitud ya fue revisada y está pendiente de aprobación final
              </p>
            </div>
          )}

          {/* Info Rápida */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5">
            <h3 className="fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-3">Información</h3>
            <dl className="space-y-3">
              <div className="flex justify-between items-center">
                <dt className="fluid-text-sm text-gray-500">Estado</dt>
                <dd className={`fluid-text-xs font-medium ${getStatusColor(request.status)} fluid-px-2.5 fluid-py-1 rounded-full`}>
                  {getStatusLabel(request.status)}
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="fluid-text-sm text-gray-500">Tipo</dt>
                <dd className="fluid-text-sm font-medium text-gray-900">{request.request_type_label}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="fluid-text-sm text-gray-500">ID Solicitud</dt>
                <dd className="fluid-text-sm font-mono font-medium text-gray-700">#{request.id}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="fluid-text-sm text-gray-500">Solicitado</dt>
                <dd className="fluid-text-sm font-medium text-gray-900">
                  {new Date(request.requested_at).toLocaleDateString('es-MX')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Cancel Button */}
          {canCancelRequest && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-3 bg-red-50 text-red-600 rounded-fluid-2xl border border-red-200 hover:bg-red-100 transition-all duration-200 font-medium fluid-text-sm"
            >
              <Ban className="fluid-icon-xs" />
              Cancelar Solicitud
            </button>
          )}
        </div>
      </div>

      {/* ===== MODAL DE CONFIRMACIÓN ===== */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up">
          <div className="bg-white rounded-fluid-2xl fluid-p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-2">
              {showConfirmModal === 'approve'
                ? 'Confirmar Aprobación'
                : 'Confirmar Rechazo'}
            </h3>
            <p className="text-gray-600 fluid-mb-4 fluid-text-sm">
              {showConfirmModal === 'approve'
                ? `¿Está seguro de aprobar esta solicitud por ${formatCurrency(approvedAmount)}?`
                : '¿Está seguro de rechazar esta solicitud?'}
            </p>
            {showConfirmModal === 'approve' && (
              <div className="fluid-p-3 bg-green-50 border border-green-200 rounded-fluid-xl fluid-mb-4">
                <p className="fluid-text-sm text-green-800">
                  Se acreditará <strong>{formatCurrency(approvedAmount)}</strong> al saldo del coordinador.
                </p>
              </div>
            )}
            <div className="flex fluid-gap-3">
              <button
                onClick={() => setShowConfirmModal(null)}
                disabled={approving}
                className="flex-1 fluid-py-2.5 border border-gray-300 rounded-fluid-xl text-gray-700 hover:bg-gray-50 disabled:opacity-50 fluid-text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={showConfirmModal === 'approve' ? handleApprove : handleReject}
                disabled={approving}
                className={`flex-1 fluid-py-2.5 rounded-fluid-xl text-white font-medium flex items-center justify-center fluid-gap-2 disabled:opacity-50 fluid-text-sm transition-all ${
                  showConfirmModal === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {approving ? (
                  <Loader2 className="fluid-icon-xs animate-spin" />
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

      {/* ===== MODAL DE CANCELACIÓN ===== */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up">
          <div className="bg-white rounded-fluid-2xl fluid-p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-2">
              Cancelar Solicitud
            </h3>
            <p className="text-gray-600 fluid-mb-4 fluid-text-sm">
              ¿Está seguro de cancelar la solicitud #{request.id} por {formatCurrency(request.amount_requested)}? Esta acción no se puede deshacer.
            </p>
            <div className="fluid-mb-4">
              <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1.5">
                Motivo de cancelación (opcional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full fluid-px-3 fluid-py-2.5 border border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-red-500 fluid-text-sm bg-gray-50/50 resize-none"
                placeholder="Explique por qué desea cancelar..."
              />
            </div>
            <div className="flex fluid-gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="flex-1 fluid-py-2.5 border border-gray-300 rounded-fluid-xl text-gray-700 hover:bg-gray-50 disabled:opacity-50 fluid-text-sm font-medium transition-colors"
              >
                No, mantener
              </button>
              <button
                onClick={handleCancelRequest}
                disabled={cancelling}
                className="flex-1 fluid-py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-fluid-xl font-medium flex items-center justify-center fluid-gap-2 disabled:opacity-50 fluid-text-sm transition-all"
              >
                {cancelling ? (
                  <Loader2 className="fluid-icon-xs animate-spin" />
                ) : (
                  <>
                    <Ban className="fluid-icon-xs" />
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
