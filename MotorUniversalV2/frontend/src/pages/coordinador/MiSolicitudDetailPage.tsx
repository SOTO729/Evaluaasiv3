/**
 * Página de Detalle de Solicitud - Coordinador
 * 
 * Vista de solo lectura para que el coordinador vea
 * el estado y detalles de sus solicitudes
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  Paperclip,
  FileSpreadsheet,
  Image,
  File,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Ban,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getBalanceRequest,
  cancelRequest,
  BalanceRequest,
  getStatusColor,
  getStatusLabel,
  formatCurrency,
} from '../../services/balanceService';

// Helper para obtener icono de archivo
const getFileIcon = (type: string) => {
  if (type === 'pdf') return <File className="w-5 h-5 text-red-500" />;
  if (['jpg', 'jpeg', 'png'].includes(type)) return <Image className="w-5 h-5 text-blue-500" />;
  if (['xls', 'xlsx'].includes(type)) return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
  return <File className="w-5 h-5 text-gray-500" />;
};

// Helper para formatear tamaño de archivo
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function MiSolicitudDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<BalanceRequest | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar solicitud');
    } finally {
      setLoading(false);
    }
  };

  const canCancel = request && ['pending', 'in_review', 'recommended_approve', 'recommended_reject'].includes(request.status);

  const handleCancel = async () => {
    if (!request) return;
    try {
      setCancelling(true);
      await cancelRequest(request.id, { reason: cancelReason });
      navigate('/historial-solicitudes', {
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

  if (error || !request) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error || 'Solicitud no encontrada'}</p>
          <Link
            to="/mi-saldo"
            className="mt-4 inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Volver a Mi Saldo
          </Link>
        </div>
      </div>
    );
  }

  // Determinar el paso actual en el flujo
  const getTimelineStep = () => {
    switch (request.status) {
      case 'pending': return 1;
      case 'in_review': return 2;
      case 'recommended_approve':
      case 'recommended_reject': return 3;
      case 'approved':
      case 'rejected':
      case 'cancelled': return 4;
      default: return 1;
    }
  };

  const timelineStep = getTimelineStep();

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 animate-fadeInDown">
        <Link
          to="/mi-saldo"
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
        <div className="lg:col-span-2 space-y-6 animate-fadeInUp delay-100">
          {/* Estado y Progreso */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Estado de la Solicitud
            </h2>

            {/* Timeline */}
            <div className="relative">
              <div className="flex items-center justify-between">
                {/* Paso 1: Enviada */}
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    timelineStep >= 1 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="mt-2 text-xs font-medium text-gray-600">Enviada</span>
                </div>

                {/* Línea */}
                <div className={`flex-1 h-1 mx-2 ${timelineStep >= 2 ? 'bg-green-500' : 'bg-gray-200'}`} />

                {/* Paso 2: En Revisión */}
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    timelineStep >= 2 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {timelineStep === 2 ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </div>
                  <span className="mt-2 text-xs font-medium text-gray-600">En Revisión</span>
                </div>

                {/* Línea */}
                <div className={`flex-1 h-1 mx-2 ${timelineStep >= 3 ? 'bg-green-500' : 'bg-gray-200'}`} />

                {/* Paso 3: Recomendación */}
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    timelineStep >= 3 
                      ? request.status === 'recommended_reject' 
                        ? 'bg-amber-500 text-white'
                        : 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {request.status === 'recommended_reject' ? (
                      <ThumbsDown className="w-5 h-5" />
                    ) : (
                      <ThumbsUp className="w-5 h-5" />
                    )}
                  </div>
                  <span className="mt-2 text-xs font-medium text-gray-600">Recomendación</span>
                </div>

                {/* Línea */}
                <div className={`flex-1 h-1 mx-2 ${timelineStep >= 4 ? request.status === 'approved' ? 'bg-green-500' : 'bg-red-500' : 'bg-gray-200'}`} />

                {/* Paso 4: Decisión Final */}
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    timelineStep >= 4 
                      ? request.status === 'approved' 
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {request.status === 'approved' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : request.status === 'rejected' ? (
                      <XCircle className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>
                  <span className="mt-2 text-xs font-medium text-gray-600">Decisión</span>
                </div>
              </div>
            </div>

            {/* Mensaje de estado */}
            <div className={`mt-6 p-4 rounded-lg ${
              request.status === 'approved' ? 'bg-green-50 border border-green-200' :
              request.status === 'rejected' ? 'bg-red-50 border border-red-200' :
              request.status === 'recommended_approve' ? 'bg-blue-50 border border-blue-200' :
              request.status === 'recommended_reject' ? 'bg-amber-50 border border-amber-200' :
              'bg-gray-50 border border-gray-200'
            }`}>
              <p className={`text-sm font-medium ${
                request.status === 'approved' ? 'text-green-800' :
                request.status === 'rejected' ? 'text-red-800' :
                request.status === 'recommended_approve' ? 'text-blue-800' :
                request.status === 'recommended_reject' ? 'text-amber-800' :
                'text-gray-800'
              }`}>
                {request.status === 'pending' && 'Tu solicitud está pendiente de revisión por el área financiera.'}
                {request.status === 'in_review' && 'Tu solicitud está siendo revisada por el área financiera.'}
                {request.status === 'recommended_approve' && 'El área financiera ha recomendado aprobar tu solicitud. Está pendiente de aprobación final.'}
                {request.status === 'recommended_reject' && 'El área financiera ha recomendado rechazar tu solicitud. Está pendiente de decisión final.'}
                {request.status === 'approved' && '¡Tu solicitud ha sido aprobada! El saldo será acreditado a tu cuenta.'}
                {request.status === 'rejected' && 'Tu solicitud ha sido rechazada. Revisa las notas para más información.'}
              </p>
            </div>
          </div>

          {/* Detalles de Montos */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Información de Montos
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Monto Solicitado */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Monto Solicitado</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(request.amount_requested)}
                </p>
              </div>

              {/* Monto Recomendado (si existe) */}
              {request.financiero_recommended_amount && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600 mb-1">Monto Recomendado por Financiero</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {formatCurrency(request.financiero_recommended_amount)}
                  </p>
                </div>
              )}

              {/* Monto Aprobado (si existe) */}
              {request.amount_approved && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600 mb-1">Monto Aprobado</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(request.amount_approved)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Justificación */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-500" />
              Justificación
            </h2>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-700 whitespace-pre-wrap">
                {request.justification || 'Sin justificación proporcionada'}
              </p>
            </div>
          </div>

          {/* Notas del Financiero */}
          {request.financiero_notes && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                Notas del Área Financiera
              </h2>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-blue-800 whitespace-pre-wrap">{request.financiero_notes}</p>
                {request.financiero && (
                  <p className="mt-2 text-sm text-blue-600">
                    - {request.financiero.full_name}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Notas del Aprobador */}
          {request.approver_notes && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-500" />
                Notas de la Gerencia
              </h2>
              <div className={`p-4 rounded-lg border ${
                request.status === 'approved' 
                  ? 'bg-green-50 border-green-100' 
                  : 'bg-red-50 border-red-100'
              }`}>
                <p className={`whitespace-pre-wrap ${
                  request.status === 'approved' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {request.approver_notes}
                </p>
                {request.approved_by && (
                  <p className={`mt-2 text-sm ${
                    request.status === 'approved' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    - {request.approved_by.full_name}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Documentación Solicitada (para becas) */}
          {request.documentation_requested && (
            <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-6">
              <h2 className="text-lg font-semibold text-amber-800 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Documentación Solicitada
              </h2>
              <div className="p-4 bg-amber-50 rounded-lg">
                <p className="text-amber-800 whitespace-pre-wrap">{request.documentation_requested}</p>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                Por favor, proporciona la documentación solicitada para continuar con el proceso.
              </p>
            </div>
          )}

          {/* Archivos Adjuntos */}
          {request.attachments && request.attachments.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-gray-500" />
                Archivos Adjuntos ({request.attachments.length})
              </h2>
              <div className="space-y-2">
                {request.attachments.map((file: any, index: number) => (
                  <a
                    key={index}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.type)}
                      <div>
                        <p className="font-medium text-gray-700 group-hover:text-blue-600">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6 animate-fadeInUp delay-200">
          {/* Info Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover-lift card-transition">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">
              Información
            </h3>
            <div className="space-y-4">
              {/* Campus */}
              {request.campus && (
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Campus</p>
                    <p className="font-medium text-gray-800">{request.campus.name}</p>
                  </div>
                </div>
              )}

              {/* Grupo */}
              {request.group && (
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Grupo</p>
                    <p className="font-medium text-gray-800">{request.group.name}</p>
                  </div>
                </div>
              )}

              {/* Fecha de Solicitud */}
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Fecha de Solicitud</p>
                  <p className="font-medium text-gray-800">
                    {new Date(request.requested_at).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              {/* Fecha de Revisión Financiera */}
              {request.financiero_reviewed_at && (
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Revisión Financiera</p>
                    <p className="font-medium text-gray-800">
                      {new Date(request.financiero_reviewed_at).toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              )}

              {/* Fecha de Aprobación/Rechazo */}
              {request.approved_at && (
                <div className="flex items-start gap-3">
                  {request.status === 'approved' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  )}
                  <div>
                    <p className="text-xs text-gray-500">
                      {request.status === 'approved' ? 'Fecha de Aprobación' : 'Fecha de Rechazo'}
                    </p>
                    <p className="font-medium text-gray-800">
                      {new Date(request.approved_at).toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">
              Acciones
            </h3>
            <div className="space-y-3">
              <Link
                to="/mi-saldo"
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a Mi Saldo
              </Link>
              <Link
                to="/historial-solicitudes"
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Ver Historial
              </Link>
              {canCancel && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Ban className="w-4 h-4" />
                  Cancelar Solicitud
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Cancelar Solicitud
            </h3>
            <p className="text-gray-600 mb-4">
              ¿Está seguro de que desea cancelar esta solicitud por {formatCurrency(request.amount_requested)}? Esta acción no se puede deshacer.
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
                onClick={handleCancel}
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
