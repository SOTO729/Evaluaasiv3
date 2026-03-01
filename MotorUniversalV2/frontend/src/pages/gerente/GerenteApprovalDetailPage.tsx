/**
 * Detalle de Aprobación del Gerente
 * Vista detallada + acciones de aprobación/rechazo/revisión
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileCheck,
  User,
  Building2,
  DollarSign,
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
  reviewRequest,
  BalanceRequest,
  formatCurrency,
} from '../../services/balanceService';

export default function GerenteApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<BalanceRequest | null>(null);

  // Aprobación directa
  const [approverNotes, setApproverNotes] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<'approve' | 'reject' | null>(null);

  // Revisión (recomendar) - kept for future use
  const [_reviewMode] = useState(false);
  const [reviewAction] = useState<'recommend_approve' | 'recommend_reject' | null>(null);
  const [_reviewNotes] = useState('');
  const [_reviewRecommendedAmount] = useState('');

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getBalanceRequest(Number(id));
      setRequest(data);
      setApprovedAmount(String(data.financiero_recommended_amount || data.amount_requested || ''));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar solicitud');
    } finally {
      setLoading(false);
    }
  };

  const canProcess = request && ['pending', 'in_review', 'recommended_approve', 'recommended_reject'].includes(request.status);
  const isPending = request?.status === 'pending';
  const isRecommendedApprove = request?.status === 'recommended_approve';
  const isRecommendedReject = request?.status === 'recommended_reject';
  const hasFinancieroReview = request?.financiero != null;

  const handleApprove = async () => {
    if (!request) return;
    try {
      setProcessing(true);
      await approveRequest(request.id, {
        amount_approved: parseFloat(approvedAmount),
        notes: approverNotes || undefined,
      });
      navigate('/gerente/aprobaciones', { state: { message: 'Solicitud aprobada exitosamente', type: 'success' } });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al aprobar');
    } finally {
      setProcessing(false);
      setShowConfirmModal(null);
    }
  };

  const handleReject = async () => {
    if (!request || !approverNotes.trim()) return;
    try {
      setProcessing(true);
      await rejectRequest(request.id, { notes: approverNotes });
      navigate('/gerente/aprobaciones', { state: { message: 'Solicitud rechazada', type: 'info' } });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al rechazar');
    } finally {
      setProcessing(false);
      setShowConfirmModal(null);
    }
  };

  const _handleReview = async () => {
    if (!request || !reviewAction) return;
    try {
      await reviewRequest(request.id, {
        action: reviewAction,
        notes: _reviewNotes || undefined,
        recommended_amount: _reviewRecommendedAmount ? parseFloat(_reviewRecommendedAmount) : undefined,
      });
      navigate('/gerente/aprobaciones', { state: { message: 'Revisión enviada exitosamente', type: 'success' } });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al enviar revisión');
    }
  };
  void _handleReview;

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet className="fluid-icon-sm text-green-500" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <Image className="fluid-icon-sm text-blue-500" />;
    if (['pdf'].includes(ext)) return <FileText className="fluid-icon-sm text-red-500" />;
    return <File className="fluid-icon-sm text-gray-500" />;
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner size="lg" />
    </div>
  );

  if (error && !request) return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto">
      <div className="bg-red-50 border border-red-200 rounded-fluid-2xl fluid-p-6 text-center">
        <AlertCircle className="fluid-icon-xl text-red-500 mx-auto fluid-mb-4" />
        <h2 className="fluid-text-xl font-semibold text-red-800 fluid-mb-2">Error</h2>
        <p className="text-red-600 fluid-text-base">{error}</p>
        <Link to="/gerente/aprobaciones" className="inline-block fluid-mt-4 fluid-px-4 fluid-py-2 bg-red-600 text-white rounded-fluid-xl hover:bg-red-700 transition-colors">
          Volver
        </Link>
      </div>
    </div>
  );

  if (!request) return null;

  const statusBadge = () => {
    const map: Record<string, { label: string; cls: string }> = {
      pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
      in_review: { label: 'En Revisión', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
      recommended_approve: { label: 'Recom. Aprobar', cls: 'bg-green-100 text-green-700 border-green-200' },
      recommended_reject: { label: 'Recom. Rechazar', cls: 'bg-red-100 text-red-700 border-red-200' },
      approved: { label: 'Aprobada', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      rejected: { label: 'Rechazada', cls: 'bg-red-100 text-red-700 border-red-200' },
    };
    const s = map[request.status] || map.pending;
    return (
      <span className={`inline-flex items-center fluid-px-3 fluid-py-1 rounded-full fluid-text-xs font-semibold border ${s.cls}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
        <div className="relative flex items-center fluid-gap-4">
          <Link to="/gerente/aprobaciones" className="fluid-p-2 bg-white/15 rounded-fluid-lg hover:bg-white/25 transition-colors">
            <ArrowLeft className="fluid-icon-sm text-white" />
          </Link>
          <div className="fluid-p-3 bg-white/15 rounded-fluid-xl backdrop-blur-sm">
            <FileCheck className="fluid-icon-xl text-white" />
          </div>
          <div className="flex-1">
            <h1 className="fluid-text-3xl font-bold">Solicitud #{request.id}</h1>
            <p className="fluid-text-base text-white/80">
              {request.coordinator?.full_name || 'Coordinador'} • {new Date(request.requested_at).toLocaleDateString('es-MX')}
            </p>
          </div>
          <div className="flex-shrink-0">
            {statusBadge()}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-center fluid-gap-2">
          <AlertCircle className="fluid-icon-sm text-red-500 flex-shrink-0" />
          <p className="text-red-700 fluid-text-sm">{error}</p>
        </div>
      )}

      {/* ===== CONTENIDO 3-col ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 fluid-gap-6">
        {/* --- MAIN (2/3) --- */}
        <div className="lg:col-span-2 space-y-6">

          {/* Info Coordinador */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
            <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
                <User className="fluid-icon-sm text-purple-500" /> Información del Coordinador
              </h2>
            </div>
            <div className="fluid-p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-4">
                <div className="fluid-p-3 bg-gray-50/80 rounded-fluid-xl">
                  <p className="fluid-text-xs text-gray-500 font-medium uppercase tracking-wider">Nombre</p>
                  <p className="fluid-text-sm font-semibold text-gray-800 fluid-mt-1">{request.coordinator?.full_name || 'N/A'}</p>
                </div>
                <div className="fluid-p-3 bg-gray-50/80 rounded-fluid-xl">
                  <p className="fluid-text-xs text-gray-500 font-medium uppercase tracking-wider">Email</p>
                  <p className="fluid-text-sm font-semibold text-gray-800 fluid-mt-1">{request.coordinator?.email || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Destino */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
            <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
                <Building2 className="fluid-icon-sm text-indigo-500" /> Destino
              </h2>
            </div>
            <div className="fluid-p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-4">
                <div className="fluid-p-3 bg-gray-50/80 rounded-fluid-xl">
                  <p className="fluid-text-xs text-gray-500 font-medium uppercase tracking-wider">Plantel</p>
                  <p className="fluid-text-sm font-semibold text-gray-800 fluid-mt-1">{request.campus?.name || 'Sin plantel'}</p>
                </div>
                <div className="fluid-p-3 bg-gray-50/80 rounded-fluid-xl">
                  <p className="fluid-text-xs text-gray-500 font-medium uppercase tracking-wider">Grupo</p>
                  <p className="fluid-text-sm font-semibold text-gray-800 fluid-mt-1">{request.group?.name || 'General'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Justificación */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
            <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
                <MessageSquare className="fluid-icon-sm text-cyan-500" /> Justificación
              </h2>
            </div>
            <div className="fluid-p-5">
              <p className="fluid-text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {request.justification || 'Sin justificación proporcionada.'}
              </p>
            </div>
          </div>

          {/* Adjuntos */}
          {request.attachments && request.attachments.length > 0 && (
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
              <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
                  <Paperclip className="fluid-icon-sm text-amber-500" /> Adjuntos ({request.attachments.length})
                </h2>
              </div>
              <div className="fluid-p-5 grid grid-cols-1 md:grid-cols-2 fluid-gap-3">
                {request.attachments.map((att: any, i: number) => (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 rounded-fluid-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50/30 transition-all group"
                  >
                    {getFileIcon(att.filename || att.name || 'file')}
                    <span className="flex-1 fluid-text-sm text-gray-700 truncate group-hover:text-purple-700">{att.filename || att.name}</span>
                    <ExternalLink className="fluid-icon-xs text-gray-400 group-hover:text-purple-500" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Notas del Financiero */}
          {hasFinancieroReview && (
            <div className="bg-blue-50/80 rounded-fluid-2xl border border-blue-200/60 overflow-hidden">
              <div className="fluid-p-5 border-b border-blue-200/40 bg-blue-100/30">
                <h2 className="fluid-text-lg font-semibold text-blue-800 flex items-center fluid-gap-2">
                  <FileText className="fluid-icon-sm text-blue-600" /> Revisión del Financiero
                </h2>
              </div>
              <div className="fluid-p-5 space-y-3">
                <div className="flex items-center fluid-gap-3">
                  <span className="fluid-text-xs text-blue-600 font-semibold uppercase">Recomendación:</span>
                  {isRecommendedApprove ? (
                    <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-0.5 bg-green-100 text-green-700 rounded-full fluid-text-xs font-medium">
                      <ThumbsUp className="fluid-icon-xs" /> Aprobar
                    </span>
                  ) : isRecommendedReject ? (
                    <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-0.5 bg-red-100 text-red-700 rounded-full fluid-text-xs font-medium">
                      <ThumbsDown className="fluid-icon-xs" /> Rechazar
                    </span>
                  ) : null}
                </div>
                {request.financiero_recommended_amount && (
                  <p className="fluid-text-sm text-blue-700">
                    <strong>Monto recomendado:</strong> {formatCurrency(request.financiero_recommended_amount)}
                  </p>
                )}
                {request.financiero_notes && (
                  <p className="fluid-text-sm text-blue-700 whitespace-pre-line">
                    <strong>Notas:</strong> {request.financiero_notes}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Advertencia sin revisión */}
          {!hasFinancieroReview && isPending && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-fluid-2xl fluid-p-5">
              <div className="flex items-start fluid-gap-3">
                <AlertCircle className="fluid-icon-sm text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 fluid-text-sm">Sin revisión del Financiero</p>
                  <p className="fluid-text-xs text-amber-600 fluid-mt-1">
                    Esta solicitud no ha sido revisada por un financiero. Puede procesarla directamente o esperar la revisión.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ===== SECCIÓN REVISIÓN (Gerente como reviewer) ===== */}
          {canProcess && !_reviewMode && (
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
              <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
                  <FileCheck className="fluid-icon-sm text-violet-500" /> Decisión del Gerente
                </h2>
              </div>
              <div className="fluid-p-5 space-y-4">
                {/* Monto */}
                <div>
                  <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1.5">
                    Monto a Aprobar
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-xs text-gray-400" />
                    <input
                      type="number"
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(e.target.value)}
                      className="w-full pl-10 fluid-py-2 fluid-px-4 bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* Notas */}
                <div>
                  <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1.5">
                    Notas del Gerente <span className="text-gray-400">(requerido para rechazo)</span>
                  </label>
                  <textarea
                    value={approverNotes}
                    onChange={(e) => setApproverNotes(e.target.value)}
                    rows={3}
                    className="w-full fluid-py-2 fluid-px-4 bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none resize-none"
                    placeholder="Ingrese notas o comentarios..."
                  />
                </div>

                {/* Botones */}
                <div className="flex flex-col sm:flex-row fluid-gap-3 fluid-pt-2">
                  <button
                    onClick={() => setShowConfirmModal('approve')}
                    disabled={!approvedAmount || parseFloat(approvedAmount) <= 0}
                    className="flex-1 flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-fluid-xl hover:from-emerald-600 hover:to-green-600 transition-all hover:scale-[1.01] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed font-semibold fluid-text-sm"
                  >
                    <CheckCircle2 className="fluid-icon-sm" /> Aprobar Solicitud
                  </button>
                  <button
                    onClick={() => setShowConfirmModal('reject')}
                    disabled={!approverNotes.trim()}
                    className="flex-1 flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-fluid-xl hover:from-red-600 hover:to-rose-600 transition-all hover:scale-[1.01] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed font-semibold fluid-text-sm"
                  >
                    <XCircle className="fluid-icon-sm" /> Rechazar Solicitud
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Already processed */}
          {!canProcess && request.status === 'approved' && (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-fluid-2xl fluid-p-5">
              <div className="flex items-center fluid-gap-3">
                <CheckCircle2 className="fluid-icon-lg text-emerald-500" />
                <div>
                  <p className="font-semibold text-emerald-800 fluid-text-lg">Solicitud Aprobada</p>
                  <p className="fluid-text-sm text-emerald-600 fluid-mt-1">
                    Aprobada por {formatCurrency(request.amount_approved || 0)}
                    {request.approver_notes && <span> — {request.approver_notes}</span>}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!canProcess && request.status === 'rejected' && (
            <div className="bg-red-50/80 border border-red-200 rounded-fluid-2xl fluid-p-5">
              <div className="flex items-center fluid-gap-3">
                <XCircle className="fluid-icon-lg text-red-500" />
                <div>
                  <p className="font-semibold text-red-800 fluid-text-lg">Solicitud Rechazada</p>
                  <p className="fluid-text-sm text-red-600 fluid-mt-1">
                    {request.approver_notes || 'Sin notas adicionales'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- SIDEBAR (1/3) --- */}
        <div className="space-y-6">
          {/* Resumen Financiero */}
          <div className="bg-gradient-to-br from-purple-600 via-violet-600 to-fuchsia-600 rounded-fluid-2xl fluid-p-5 text-white relative overflow-hidden shadow-lg">
            <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/5 rounded-full" />
            <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full" />
            <div className="relative">
              <p className="fluid-text-xs text-white/70 font-semibold uppercase tracking-wider fluid-mb-3">Resumen Financiero</p>
              <div className="space-y-3">
                <div>
                  <p className="fluid-text-xs text-white/60">Monto Solicitado</p>
                  <p className="fluid-text-2xl font-bold">{formatCurrency(request.amount_requested)}</p>
                </div>
                {request.financiero_recommended_amount && (
                  <div className="fluid-pt-3 border-t border-white/20">
                    <p className="fluid-text-xs text-white/60">Monto Recomendado</p>
                    <p className="fluid-text-xl font-bold">{formatCurrency(request.financiero_recommended_amount)}</p>
                  </div>
                )}
                {request.amount_approved && (
                  <div className="fluid-pt-3 border-t border-white/20">
                    <p className="fluid-text-xs text-white/60">Monto Aprobado</p>
                    <p className="fluid-text-xl font-bold text-emerald-300">{formatCurrency(request.amount_approved)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tipo de solicitud */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5">
            <p className="fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-3">Tipo de Solicitud</p>
            <div className="inline-flex items-center fluid-gap-2 fluid-px-3 fluid-py-1.5 bg-purple-50 text-purple-700 rounded-fluid-xl fluid-text-sm font-medium">
              <FileText className="fluid-icon-xs" />
              <span className="capitalize">{(request.request_type || 'general').replace(/_/g, ' ')}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5">
            <p className="fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-4">Línea de Tiempo</p>
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-1 before:bottom-1 before:w-0.5 before:bg-gray-200">
              <div className="relative">
                <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow-sm" />
                <p className="fluid-text-xs font-semibold text-gray-800">Solicitud creada</p>
                <p className="fluid-text-xs text-gray-500">{new Date(request.requested_at).toLocaleString('es-MX')}</p>
              </div>

              {hasFinancieroReview && (
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                  <p className="fluid-text-xs font-semibold text-gray-800">Revisión financiera</p>
                  <p className="fluid-text-xs text-gray-500">{request.financiero?.full_name || 'Financiero'}</p>
                </div>
              )}

              {(request.status === 'approved' || request.status === 'rejected') && (
                <div className="relative">
                  <div className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                    request.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'
                  }`} />
                  <p className="fluid-text-xs font-semibold text-gray-800">
                    {request.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                  </p>
                  {request.approved_at && (
                    <p className="fluid-text-xs text-gray-500">{new Date(request.approved_at).toLocaleString('es-MX')}</p>
                  )}
                </div>
              )}

              {canProcess && (
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow-sm animate-pulse" />
                  <p className="fluid-text-xs font-semibold text-amber-700">Esperando decisión</p>
                  <p className="fluid-text-xs text-gray-500">Pendiente de aprobación</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== MODAL CONFIRMACIÓN ===== */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center fluid-p-4 bg-black/50 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-white rounded-fluid-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className={`fluid-p-5 ${showConfirmModal === 'approve' ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gradient-to-r from-red-500 to-rose-500'} text-white`}>
              <h3 className="fluid-text-xl font-bold flex items-center fluid-gap-2">
                {showConfirmModal === 'approve' ? <CheckCircle2 className="fluid-icon-lg" /> : <XCircle className="fluid-icon-lg" />}
                {showConfirmModal === 'approve' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
              </h3>
            </div>
            <div className="fluid-p-5 space-y-4">
              {showConfirmModal === 'approve' ? (
                <>
                  <p className="fluid-text-sm text-gray-600">
                    Está por aprobar la solicitud <strong>#{request.id}</strong> de{' '}
                    <strong>{request.coordinator?.full_name}</strong> por:
                  </p>
                  <p className="fluid-text-2xl font-bold text-emerald-600 text-center fluid-py-2">
                    {formatCurrency(parseFloat(approvedAmount || '0'))}
                  </p>
                </>
              ) : (
                <p className="fluid-text-sm text-gray-600">
                  Está por rechazar la solicitud <strong>#{request.id}</strong> de{' '}
                  <strong>{request.coordinator?.full_name}</strong>. Esta acción no se puede deshacer.
                </p>
              )}

              <div className="flex fluid-gap-3 fluid-pt-2">
                <button
                  onClick={() => setShowConfirmModal(null)}
                  disabled={processing}
                  className="flex-1 fluid-px-4 fluid-py-2.5 bg-gray-100 text-gray-700 rounded-fluid-xl hover:bg-gray-200 transition-colors font-medium fluid-text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={showConfirmModal === 'approve' ? handleApprove : handleReject}
                  disabled={processing}
                  className={`flex-1 fluid-px-4 fluid-py-2.5 text-white rounded-fluid-xl font-medium fluid-text-sm flex items-center justify-center fluid-gap-2 transition-all ${
                    showConfirmModal === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {processing && <Loader2 className="fluid-icon-xs animate-spin" />}
                  {showConfirmModal === 'approve' ? 'Aprobar' : 'Rechazar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
