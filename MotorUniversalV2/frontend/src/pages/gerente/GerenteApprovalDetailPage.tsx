/**
 * Página de Detalle de Solicitud para Aprobación
 * 
 * El gerente puede ver el detalle completo de una solicitud
 * y aprobarla o rechazarla definitivamente
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileCheck,
  User,
  Building2,
  Users,
  DollarSign,
  Clock,
  FileText,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Paperclip,
  FileSpreadsheet,
  Image,
  File,
  ExternalLink,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getBalanceRequest,
  approveRequest,
  rejectRequest,
  BalanceRequest,
  formatCurrency,
} from '../../services/balanceService';

export default function GerenteApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<BalanceRequest | null>(null);
  const [approverNotes, setApproverNotes] = useState('');
  const [approvedAmount, setApprovedAmount] = useState<number>(0);
  const [processing, setProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    loadRequest();
  }, [id]);

  const loadRequest = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getBalanceRequest(parseInt(id));
      setRequest(data);
      setApprovedAmount(data.financiero_recommended_amount || data.amount_requested);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar solicitud');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    try {
      setProcessing(true);
      await approveRequest(parseInt(id), {
        amount_approved: approvedAmount,
        notes: approverNotes || undefined,
      });
      navigate('/gerente/aprobaciones', {
        state: { message: 'Solicitud aprobada exitosamente', type: 'success' }
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al aprobar');
      setProcessing(false);
      setShowConfirmModal(null);
    }
  };

  const handleReject = async () => {
    if (!id || !approverNotes.trim()) {
      setError('Debe proporcionar una razón para el rechazo');
      return;
    }
    try {
      setProcessing(true);
      await rejectRequest(parseInt(id), {
        notes: approverNotes,
      });
      navigate('/gerente/aprobaciones', {
        state: { message: 'Solicitud rechazada', type: 'info' }
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al rechazar');
      setProcessing(false);
      setShowConfirmModal(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <Link
            to="/gerente/aprobaciones"
            className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Volver a Aprobaciones
          </Link>
        </div>
      </div>
    );
  }

  if (!request) return null;

  const canProcess = ['recommended_approve', 'recommended_reject', 'in_review'].includes(request.status);
  const isRecommendedApprove = request.status === 'recommended_approve';
  const isRecommendedReject = request.status === 'recommended_reject';

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 animate-fadeInDown">
        <Link
          to="/gerente/aprobaciones"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <FileCheck className="w-8 h-8 text-purple-600" />
            Solicitud #{request.id}
          </h1>
          <p className="text-gray-600 mt-1">
            Revisión y aprobación final
          </p>
        </div>
        {canProcess && (
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isRecommendedApprove
                ? 'bg-green-100 text-green-700'
                : isRecommendedReject
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {isRecommendedApprove && <ThumbsUp className="w-4 h-4 inline mr-1" />}
              {isRecommendedReject && <ThumbsDown className="w-4 h-4 inline mr-1" />}
              {isRecommendedApprove ? 'Recomienda Aprobar' : isRecommendedReject ? 'Recomienda Rechazar' : 'En Revisión'}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6 animate-fadeInUp delay-100">
          {/* Información del Coordinador */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-400" />
              Coordinador Solicitante
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Nombre</p>
                <p className="font-medium text-gray-900">
                  {request.coordinator?.full_name || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-gray-900">{request.coordinator?.email || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Destino */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-400" />
              Destino del Saldo
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Plantel</p>
                <p className="font-medium text-gray-900">
                  {request.campus?.name || 'Sin plantel especificado'}
                </p>
                {request.campus?.state_name && (
                  <p className="text-sm text-gray-500">{request.campus.state_name}</p>
                )}
              </div>
              {request.group && (
                <div>
                  <p className="text-sm text-gray-500">Grupo</p>
                  <p className="font-medium text-gray-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    {request.group.name}
                    {request.group.code && (
                      <span className="text-sm text-gray-500">({request.group.code})</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Justificación */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-400" />
              Justificación
            </h2>
            <p className="text-gray-700 whitespace-pre-wrap">
              {request.justification || 'Sin justificación proporcionada'}
            </p>
          </div>

          {/* Documentación Adjunta */}
          {request.attachments && request.attachments.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-gray-400" />
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

          {/* Notas del Financiero */}
          {request.financiero_notes && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
              <h2 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                Notas del Área Financiera
              </h2>
              <p className="text-blue-700 whitespace-pre-wrap">
                {request.financiero_notes}
              </p>
              {request.financiero && (
                <p className="text-sm text-blue-600 mt-3">
                  — {request.financiero.full_name}
                  {request.financiero_reviewed_at && (
                    <span className="text-blue-500 ml-2">
                      ({new Date(request.financiero_reviewed_at).toLocaleDateString()})
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Acción del Gerente */}
          {canProcess && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-purple-500" />
                Decisión Final
              </h2>

              <div className="space-y-4">
                {/* Monto a aprobar */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto a Aprobar
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs text-gray-500">
                      Solicitado: {formatCurrency(request.amount_requested)}
                    </span>
                    {request.financiero_recommended_amount && (
                      <span className="text-xs text-blue-600">
                        | Recomendado: {formatCurrency(request.financiero_recommended_amount)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Notas del aprobador */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas (opcional para aprobar, obligatorio para rechazar)
                  </label>
                  <textarea
                    value={approverNotes}
                    onChange={(e) => setApproverNotes(e.target.value)}
                    rows={3}
                    placeholder="Agregar notas o comentarios..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                {/* Botones de acción */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowConfirmModal('approve')}
                    disabled={processing || approvedAmount <= 0}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Aprobar Solicitud
                  </button>
                  <button
                    onClick={() => setShowConfirmModal('reject')}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                    Rechazar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Ya procesada */}
          {!canProcess && (
            <div className={`rounded-xl border p-6 ${
              request.status === 'approved'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-3">
                {request.status === 'approved' ? (
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-600" />
                )}
                <div>
                  <p className={`font-semibold ${
                    request.status === 'approved' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    Solicitud {request.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                  </p>
                  {request.approved_by && (
                    <p className={`text-sm ${
                      request.status === 'approved' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Por: {request.approved_by.full_name} • {request.approved_at && new Date(request.approved_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              {request.approver_notes && (
                <p className={`mt-3 ${
                  request.status === 'approved' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {request.approver_notes}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6 animate-fadeInUp delay-200">
          {/* Resumen Financiero */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 p-6 hover-lift card-transition">
            <h3 className="font-semibold text-purple-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Resumen Financiero
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-purple-600">Monto Solicitado</p>
                <p className="text-2xl font-bold text-purple-800">
                  {formatCurrency(request.amount_requested)}
                </p>
              </div>
              {request.financiero_recommended_amount && (
                <div>
                  <p className="text-sm text-purple-600">Monto Recomendado</p>
                  <p className="text-xl font-semibold text-purple-700">
                    {formatCurrency(request.financiero_recommended_amount)}
                  </p>
                </div>
              )}
              {request.amount_approved && (
                <div className="pt-3 border-t border-purple-200">
                  <p className="text-sm text-green-600">Monto Aprobado</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(request.amount_approved)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Tipo de Solicitud */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-3">Tipo de Solicitud</h3>
            <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-medium ${
              request.request_type === 'beca'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {request.request_type_label}
            </span>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              Historial
            </h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-2 h-2 mt-2 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Solicitud Creada</p>
                  <p className="text-xs text-gray-500">
                    {new Date(request.requested_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {request.financiero_reviewed_at && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 mt-2 bg-yellow-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Revisión Financiera</p>
                    <p className="text-xs text-gray-500">
                      {new Date(request.financiero_reviewed_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {request.approved_at && (
                <div className="flex gap-3">
                  <div className={`w-2 h-2 mt-2 rounded-full ${
                    request.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {request.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(request.approved_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {showConfirmModal === 'approve' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
            </h3>
            <p className="text-gray-600 mb-4">
              {showConfirmModal === 'approve'
                ? `¿Está seguro de aprobar esta solicitud por ${formatCurrency(approvedAmount)}?`
                : '¿Está seguro de rechazar esta solicitud? Esta acción no se puede deshacer.'}
            </p>
            {showConfirmModal === 'reject' && !approverNotes.trim() && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                Debe proporcionar una razón para el rechazo
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(null)}
                disabled={processing}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={showConfirmModal === 'approve' ? handleApprove : handleReject}
                disabled={processing || (showConfirmModal === 'reject' && !approverNotes.trim())}
                className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
                  showConfirmModal === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  showConfirmModal === 'approve' ? 'Aprobar' : 'Rechazar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
