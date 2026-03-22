/**
 * Página: Solicitudes de Responsables - Coordinador
 * 
 * Muestra las solicitudes de saldo que los responsables
 * de plantel han enviado al coordinador. El coordinador puede:
 * - Ver detalle de cada solicitud (adjuntos incluidos)
 * - Rechazar con motivo
 * - Modificar (unidades, grupo)
 * - Aprobar y enviar al flujo financiero/gerente
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  XCircle,
  AlertCircle,
  RefreshCw,
  Send,
  Edit3,
  Paperclip,
  Award,
  Building2,
  Users,
  Download,
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowLeft,
  FileText,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getCertificateRequests,
  reviewCertificateRequest,
  updateCertificateRequestStatus,
  CertificateRequestData,
  CertificateRequestStatus,
  Attachment,
  formatFileSize,
} from '../../services/balanceService';


const STATUS_CONFIG: Record<CertificateRequestStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pendiente', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  seen: { label: 'Vista', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  modified: { label: 'Modificada', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200' },
  approved_by_coordinator: { label: 'Aprobada', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
  rejected_by_coordinator: { label: 'Rechazada', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
  forwarded: { label: 'Enviada a aprobación', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  in_review: { label: 'En revisión', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  approved: { label: 'Aprobada final', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  rejected: { label: 'Rechazada final', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
  resolved: { label: 'Resuelta', color: 'text-gray-700', bgColor: 'bg-gray-50 border-gray-200' },
};

export default function SolicitudesResponsablesPage() {
  const [requests, setRequests] = useState<CertificateRequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processed'>('all');

  // Detail/Review state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'modify' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewUnits, setReviewUnits] = useState<number>(0);
  const [reviewGroupId, setReviewGroupId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setError(null);
      const statusParam = filter === 'pending' ? 'pending_coordinator' : undefined;
      const result = await getCertificateRequests({ status: statusParam });
      setRequests(result.requests);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar solicitudes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [filter]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const toggleExpand = async (req: CertificateRequestData) => {
    if (expandedId === req.id) {
      setExpandedId(null);
      setReviewAction(null);
      return;
    }
    setExpandedId(req.id);
    setReviewAction(null);
    setReviewNotes('');
    setReviewUnits(req.coordinator_units || req.units_requested);
    setReviewGroupId(req.coordinator_group_id || req.group_id);

    // Mark as seen if pending
    if (req.status === 'pending') {
      try {
        await updateCertificateRequestStatus(req.id, 'seen');
        setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'seen' as CertificateRequestStatus, status_label: 'Vista' } : r));
      } catch { /* ignore */ }
    }
  };

  const handleReview = async (reqId: number) => {
    if (!reviewAction) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await reviewCertificateRequest(reqId, {
        action: reviewAction,
        units: reviewAction !== 'reject' ? reviewUnits : undefined,
        group_id: reviewAction !== 'reject' ? reviewGroupId : undefined,
        notes: reviewNotes || undefined, 
      });
      // Update the request in the list
      setRequests(prev => prev.map(r => r.id === reqId ? result.request : r));
      setExpandedId(null);
      setReviewAction(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const pendingCount = requests.filter(r => ['pending', 'seen', 'modified'].includes(r.status)).length;
  const filteredRequests = filter === 'processed' 
    ? requests.filter(r => !['pending', 'seen', 'modified'].includes(r.status))
    : requests;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fadeInDown">
        <div>
          <Link to="/mi-saldo" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm font-medium mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Mi Saldo
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-blue-600" />
            Solicitudes de Responsables
            {pendingCount > 0 && (
              <span className="ml-2 px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold">
                {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
          </h1>
          <p className="text-gray-600 mt-1">Solicitudes de saldo recibidas de responsables de plantel</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'processed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? 'Todas' : f === 'pending' ? `Pendientes (${pendingCount})` : 'Procesadas'}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
          <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Sin solicitudes</h3>
          <p className="text-gray-400">No hay solicitudes de responsables por el momento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map(req => {
            const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const isExpanded = expandedId === req.id;
            const canReview = ['pending', 'seen', 'modified'].includes(req.status);

            return (
              <div key={req.id} className={`bg-white rounded-xl border shadow-sm transition-shadow ${isExpanded ? 'shadow-lg ring-2 ring-blue-200' : 'hover:shadow-md'}`}>
                {/* Header row */}
                <button
                  onClick={() => toggleExpand(req)}
                  className="w-full p-5 text-left flex items-start justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusCfg.bgColor} ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(req.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {req.attachments && req.attachments.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Paperclip className="w-3 h-3" /> {req.attachments.length}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mb-1.5">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold text-gray-800">{req.responsable?.full_name || 'Responsable'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-lg text-emerald-700">{req.units_requested}</span>
                        <span className="text-sm text-gray-500">unidades</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {req.campus && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {req.campus.name}
                        </span>
                      )}
                      {req.group && <span>• Grupo: {req.group.name}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canReview && (
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">Requiere acción</span>
                    )}
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t px-5 pb-5">
                    {/* Justificación */}
                    <div className="mt-4 mb-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Justificación</h4>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{req.justification}</p>
                    </div>

                    {/* Adjuntos */}
                    {req.attachments && req.attachments.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Documentos adjuntos</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {req.attachments.map((att: Attachment, idx: number) => (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                              <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-blue-800 truncate">{att.name}</p>
                                <p className="text-xs text-blue-500">{formatFileSize(att.size)}</p>
                              </div>
                              <Download className="w-4 h-4 text-blue-400" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notas previas del coordinador */}
                    {req.coordinator_notes && (
                      <div className="mb-4 bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                        <p className="text-xs font-semibold text-indigo-600 mb-1">Notas previas del coordinador</p>
                        <p className="text-sm text-indigo-800">{req.coordinator_notes}</p>
                      </div>
                    )}

                    {/* Si ya fue enviada, mostrar estado */}
                    {req.forwarded_request_id && (
                      <div className="mb-4 bg-purple-50 rounded-lg p-3 border border-purple-200">
                        <p className="text-xs font-semibold text-purple-600 mb-1">Estado del flujo de aprobación</p>
                        <p className="text-sm text-purple-800">
                          {req.forwarded_request_status_label || req.forwarded_request_status || 'En proceso'}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    {canReview && !reviewAction && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        <button
                          onClick={() => setReviewAction('approve')}
                          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700 transition-colors shadow-md"
                        >
                          <Send className="w-4 h-4" /> Aprobar y Enviar
                        </button>
                        <button
                          onClick={() => setReviewAction('modify')}
                          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" /> Modificar
                        </button>
                        <button
                          onClick={() => setReviewAction('reject')}
                          className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 rounded-xl font-medium text-sm hover:bg-red-100 border border-red-200 transition-colors"
                        >
                          <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                      </div>
                    )}

                    {/* Review forms */}
                    {canReview && reviewAction && (
                      <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                          {reviewAction === 'approve' && '✅ Aprobar y enviar al flujo de aprobación'}
                          {reviewAction === 'modify' && '📝 Modificar solicitud'}
                          {reviewAction === 'reject' && '❌ Rechazar solicitud'}
                        </h4>

                        {/* Units (approve/modify) */}
                        {reviewAction !== 'reject' && (
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Unidades</label>
                            <input
                              type="number"
                              min={1}
                              value={reviewUnits}
                              onChange={(e) => setReviewUnits(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-32 py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-bold text-center"
                            />
                            {reviewUnits !== req.units_requested && (
                              <span className="ml-2 text-xs text-indigo-600">
                                (original: {req.units_requested})
                              </span>
                            )}
                          </div>
                        )}

                        {/* Group (approve/modify) - optional group selection */}
                        {reviewAction !== 'reject' && req.campus && (
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Grupo (precio especial)</label>
                            <select
                              value={reviewGroupId || ''}
                              onChange={(e) => setReviewGroupId(e.target.value ? Number(e.target.value) : null)}
                              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            >
                              <option value="">Sin grupo (precio del plantel)</option>
                              {/* Groups will come from the request.campus to look up */}
                            </select>
                          </div>
                        )}

                        {/* Notes */}
                        <div className="mb-4">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {reviewAction === 'reject' ? 'Motivo del rechazo *' : 'Notas (opcional)'}
                          </label>
                          <textarea
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            rows={3}
                            placeholder={reviewAction === 'reject' ? 'Explica el motivo del rechazo...' : 'Notas adicionales...'}
                            className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReview(req.id)}
                            disabled={submitting || (reviewAction === 'reject' && !reviewNotes.trim())}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm shadow-md transition-colors disabled:opacity-50 ${
                              reviewAction === 'reject'
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : reviewAction === 'modify'
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                          >
                            {submitting ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                            ) : (
                              <>
                                {reviewAction === 'approve' && <><Send className="w-4 h-4" /> Aprobar y enviar</>}
                                {reviewAction === 'modify' && <><Edit3 className="w-4 h-4" /> Guardar cambios</>}
                                {reviewAction === 'reject' && <><XCircle className="w-4 h-4" /> Confirmar rechazo</>}
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setReviewAction(null)}
                            className="px-4 py-2.5 text-gray-600 hover:text-gray-800 text-sm font-medium"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
