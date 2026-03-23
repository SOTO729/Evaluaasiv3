/**
 * Página Mis Solicitudes - Responsable de Plantel
 * 
 * Muestra el historial de solicitudes de saldo/certificados
 * que el responsable ha enviado a su coordinador, con estado visible.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  Paperclip,
  ChevronRight,
  Send,
  Eye,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getCertificateRequests,
  CertificateRequestData,
  CertificateRequestStatus,
} from '../../services/balanceService';

const STATUS_CONFIG: Record<CertificateRequestStatus, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', icon: Clock },
  seen: { label: 'Vista por coordinador', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: Eye },
  modified: { label: 'Modificada', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: ClipboardList },
  approved_by_coordinator: { label: 'Aprobada por coordinador', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  rejected_by_coordinator: { label: 'Rechazada', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', icon: XCircle },
  forwarded: { label: 'En proceso de aprobación', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200', icon: Send },
  in_review: { label: 'En revisión financiera', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: Eye },
  approved: { label: 'Aprobada', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', icon: CheckCircle2 },
  rejected: { label: 'Rechazada', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', icon: XCircle },
  resolved: { label: 'Resuelta', color: 'text-gray-700', bgColor: 'bg-gray-50 border-gray-200', icon: CheckCircle2 },
};

// Mapear estados internos a estados simplificados para el responsable
function getSimplifiedStatus(status: CertificateRequestStatus): string {
  const map: Record<string, string> = {
    pending: 'Pendiente con coordinador',
    seen: 'Pendiente con coordinador',
    modified: 'En revisión de coordinador',
    approved_by_coordinator: 'Aprobada, en proceso',
    rejected_by_coordinator: 'Rechazada por coordinador',
    forwarded: 'En proceso de aprobación',
    in_review: 'En revisión',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    resolved: 'Resuelta',
  };
  return map[status] || status;
}

export default function MisSolicitudesPage() {
  const [requests, setRequests] = useState<CertificateRequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      setError(null);
      const result = await getCertificateRequests();
      setRequests(result.requests);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar solicitudes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) return <LoadingSpinner />;

  const pendingCount = requests.filter(r => ['pending', 'seen', 'modified'].includes(r.status)).length;
  const approvedCount = requests.filter(r => ['approved', 'resolved', 'forwarded', 'approved_by_coordinator'].includes(r.status)).length;
  const rejectedCount = requests.filter(r => ['rejected', 'rejected_by_coordinator'].includes(r.status)).length;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fadeInDown">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-primary-600" />
            Mis Solicitudes
          </h1>
          <p className="text-gray-600 mt-1">Historial de solicitudes de saldo enviadas</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/solicitar-certificados"
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-medium text-sm hover:bg-primary-700 transition-colors shadow-lg"
          >
            <Plus className="w-4 h-4" /> Nueva solicitud
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-800">{requests.length}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-sm text-amber-700">Pendientes</p>
          <p className="text-2xl font-bold text-amber-800">{pendingCount}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-700">Aprobadas</p>
          <p className="text-2xl font-bold text-green-800">{approvedCount}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-sm text-red-700">Rechazadas</p>
          <p className="text-2xl font-bold text-red-800">{rejectedCount}</p>
        </div>
      </div>

      {/* Lista de solicitudes */}
      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
          <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Sin solicitudes</h3>
          <p className="text-gray-400 mb-6">No has enviado ninguna solicitud de saldo aún.</p>
          <Link
            to="/solicitar-certificados"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium text-sm hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" /> Crear primera solicitud
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            return (
              <div key={req.id} className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusCfg.bgColor} ${statusCfg.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {getSimplifiedStatus(req.status)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(req.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-primary-600" />
                        <span className="font-bold text-lg text-gray-800">{req.units_requested}</span>
                        <span className="text-sm text-gray-500">unidades solicitadas</span>
                      </div>
                      {req.coordinator_units && req.coordinator_units !== req.units_requested && (
                        <div className="flex items-center gap-1 text-sm">
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold text-primary-700">{req.coordinator_units}</span>
                          <span className="text-gray-500">aprobadas</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 line-clamp-2 mb-1">{req.justification}</p>
                    
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {req.campus && <span>{req.campus.name}</span>}
                      {req.group && <span>• {req.group.name}</span>}
                      {req.attachments && req.attachments.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          {req.attachments.length} archivo{req.attachments.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    
                    {req.coordinator_notes && (
                      <div className="mt-2 bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium">Notas del coordinador:</p>
                        <p className="text-sm text-gray-700">{req.coordinator_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
