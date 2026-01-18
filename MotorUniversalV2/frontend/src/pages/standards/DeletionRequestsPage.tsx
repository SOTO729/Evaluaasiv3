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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/standards')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a estándares
        </button>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Solicitudes de Eliminación</h1>
        <p className="mt-1 text-sm text-gray-500">
          Revisa y aprueba o rechaza las solicitudes de eliminación de estándares
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-6">
        <div className="flex gap-2">
          {['', 'pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
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
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Lista de solicitudes */}
      {requests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay solicitudes</h3>
          <p className="mt-1 text-sm text-gray-500">
            {statusFilter === 'pending'
              ? 'No hay solicitudes pendientes por revisar.'
              : 'No se encontraron solicitudes con este filtro.'}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {requests.map((req) => (
              <li key={req.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium text-gray-900">{req.entity_name}</p>
                      {getStatusBadge(req.status)}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      <span className="font-medium">Razón:</span> {req.reason}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Solicitado: {new Date(req.requested_at).toLocaleDateString('es-MX', { dateStyle: 'medium' })}
                    </p>
                    {req.admin_response && (
                      <div className="mt-2 bg-gray-50 rounded p-2">
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Respuesta admin:</span> {req.admin_response}
                        </p>
                      </div>
                    )}
                  </div>
                  {req.status === 'pending' && (
                    <div className="ml-4 flex gap-2">
                      <button
                        onClick={() => handleReview(req, 'approve')}
                        className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => handleReview(req, 'reject')}
                        className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200"
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
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {reviewModal.action === 'approve' ? 'Aprobar Eliminación' : 'Rechazar Solicitud'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {reviewModal.action === 'approve'
                ? `¿Confirmas la eliminación de "${reviewModal.request?.entity_name}"?`
                : `¿Rechazar la solicitud de eliminación de "${reviewModal.request?.entity_name}"?`}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Respuesta (opcional)
              </label>
              <textarea
                value={reviewModal.response}
                onChange={(e) => setReviewModal({ ...reviewModal, response: e.target.value })}
                rows={3}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                placeholder="Agrega un comentario para el solicitante..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setReviewModal({ show: false, request: null, action: null, response: '' })}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmReview}
                className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
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
