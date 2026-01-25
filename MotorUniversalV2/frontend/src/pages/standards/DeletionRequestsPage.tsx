/**
 * Página de solicitudes de eliminación (solo admin)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  getDeletionRequests,
  reviewDeletionRequest,
  DeletionRequest,
} from '../../services/standardsService';

export default function DeletionRequestsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [reviewModal, setReviewModal] = useState<{
    show: boolean;
    request: DeletionRequest | null;
    action: 'approve' | 'reject' | null;
    response: string;
  }>({ show: false, request: null, action: null, response: '' });

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      navigate('/standards');
      return;
    }
    loadRequests();
  }, [statusFilter, isAdmin]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await getDeletionRequests(statusFilter || undefined);
      setRequests(response.requests);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar las solicitudes');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (request: DeletionRequest, action: 'approve' | 'reject') => {
    setReviewModal({
      show: true,
      request,
      action,
      response: '',
    });
  };

  const confirmReview = async () => {
    if (!reviewModal.request || !reviewModal.action) return;

    try {
      await reviewDeletionRequest(
        reviewModal.request.id,
        reviewModal.action,
        reviewModal.response || undefined
      );
      alert(reviewModal.action === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada');
      setReviewModal({ show: false, request: null, action: null, response: '' });
      loadRequests();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al procesar la solicitud');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      approved: 'Aprobada',
      rejected: 'Rechazada',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto fluid-px-6 fluid-py-10">
      {/* Header */}
      <div className="fluid-mb-10">
        <button
          onClick={() => navigate('/standards')}
          className="inline-flex items-center fluid-text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="fluid-mr-2 fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a estándares
        </button>
        <h1 className="fluid-mt-4 fluid-text-3xl font-bold text-gray-900">Solicitudes de Eliminación</h1>
        <p className="fluid-mt-2 fluid-text-base text-gray-500">
          Revisa y aprueba o rechaza las solicitudes de eliminación de estándares
        </p>
      </div>

      {/* Filtros */}
      <div className="fluid-mb-8">
        <div className="flex flex-wrap fluid-gap-3">
          {['', 'pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`fluid-px-5 fluid-py-2 fluid-text-sm font-medium rounded-fluid-md ${
                statusFilter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {status === '' ? 'Todas' : status === 'pending' ? 'Pendientes' : status === 'approved' ? 'Aprobadas' : 'Rechazadas'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="fluid-mb-6 bg-red-50 border border-red-200 rounded-fluid-md fluid-p-4">
          <p className="fluid-text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Lista de solicitudes */}
      {requests.length === 0 ? (
        <div className="text-center fluid-py-16 bg-white rounded-fluid-lg shadow">
          <svg className="mx-auto fluid-icon-2xl text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="fluid-mt-4 fluid-text-base font-medium text-gray-900">No hay solicitudes</h3>
          <p className="fluid-mt-2 fluid-text-sm text-gray-500">
            {statusFilter === 'pending'
              ? 'No hay solicitudes pendientes por revisar.'
              : 'No se encontraron solicitudes con este filtro.'}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md rounded-fluid-lg">
          <ul className="divide-y divide-gray-200">
            {requests.map((req) => (
              <li key={req.id} className="fluid-px-6 fluid-py-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between fluid-gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center fluid-gap-3">
                      <p className="fluid-text-base font-medium text-gray-900">{req.entity_name}</p>
                      {getStatusBadge(req.status)}
                    </div>
                    <p className="fluid-mt-2 fluid-text-sm text-gray-500">
                      <span className="font-medium">Razón:</span> {req.reason}
                    </p>
                    <p className="fluid-mt-1 fluid-text-xs text-gray-400">
                      Solicitado: {new Date(req.requested_at).toLocaleDateString('es-MX', { dateStyle: 'medium' })}
                    </p>
                    {req.admin_response && (
                      <div className="fluid-mt-3 bg-gray-50 rounded-fluid-md fluid-p-3">
                        <p className="fluid-text-xs text-gray-600">
                          <span className="font-medium">Respuesta admin:</span> {req.admin_response}
                        </p>
                      </div>
                    )}
                  </div>
                  {req.status === 'pending' && (
                    <div className="flex fluid-gap-3">
                      <button
                        onClick={() => handleReview(req, 'approve')}
                        className="fluid-px-4 fluid-py-2 fluid-text-sm font-medium text-green-700 bg-green-100 rounded-fluid-md hover:bg-green-200"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => handleReview(req, 'reject')}
                        className="fluid-px-4 fluid-py-2 fluid-text-sm font-medium text-red-700 bg-red-100 rounded-fluid-md hover:bg-red-200"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal de revisión */}
      {reviewModal.show && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-xl max-w-2xl w-full mx-4 fluid-p-8">
            <h3 className="fluid-text-xl font-medium text-gray-900 fluid-mb-6">
              {reviewModal.action === 'approve' ? 'Aprobar Eliminación' : 'Rechazar Solicitud'}
            </h3>
            <p className="fluid-text-base text-gray-500 fluid-mb-6">
              {reviewModal.action === 'approve'
                ? `¿Confirmas la eliminación de "${reviewModal.request?.entity_name}"?`
                : `¿Rechazar la solicitud de eliminación de "${reviewModal.request?.entity_name}"?`}
            </p>
            <div className="fluid-mb-6">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                Respuesta (opcional)
              </label>
              <textarea
                value={reviewModal.response}
                onChange={(e) => setReviewModal({ ...reviewModal, response: e.target.value })}
                rows={3}
                className="w-full border-gray-300 rounded-fluid-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                placeholder="Agrega un comentario para el solicitante..."
              />
            </div>
            <div className="flex justify-end fluid-gap-3">
              <button
                onClick={() => setReviewModal({ show: false, request: null, action: null, response: '' })}
                className="fluid-px-4 fluid-py-2 border border-gray-300 rounded-fluid-md fluid-text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmReview}
                className={`fluid-px-4 fluid-py-2 border border-transparent rounded-fluid-md shadow-sm fluid-text-sm font-medium text-white ${
                  reviewModal.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {reviewModal.action === 'approve' ? 'Aprobar' : 'Rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
