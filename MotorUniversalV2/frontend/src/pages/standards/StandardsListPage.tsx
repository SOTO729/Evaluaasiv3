/**
 * Página de Listado de Estándares de Competencia (ECM)
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getStandards,
  deleteStandard,
  requestDeletion,
  CompetencyStandard,
} from '../../services/standardsService';

export default function StandardsListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [standards, setStandards] = useState<CompetencyStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    show: boolean;
    standard: CompetencyStandard | null;
    reason: string;
    isRequest: boolean;
  }>({ show: false, standard: null, reason: '', isRequest: false });

  const isAdmin = user?.role === 'admin';
  const isEditor = user?.role === 'editor';
  const canCreate = isAdmin || isEditor;

  useEffect(() => {
    loadStandards();
  }, [showInactive]);

  const loadStandards = async () => {
    try {
      setLoading(true);
      const response = await getStandards({
        active_only: !showInactive,
        include_stats: true,
      });
      setStandards(response.standards);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los estándares');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (standard: CompetencyStandard) => {
    setDeleteModal({
      show: true,
      standard,
      reason: '',
      isRequest: !isAdmin,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.standard) return;

    try {
      if (deleteModal.isRequest) {
        // Editor: solicitar eliminación
        await requestDeletion(deleteModal.standard.id, deleteModal.reason);
        alert('Solicitud de eliminación enviada al administrador');
      } else {
        // Admin: eliminar directamente
        await deleteStandard(deleteModal.standard.id);
        alert('Estándar eliminado exitosamente');
      }
      setDeleteModal({ show: false, standard: null, reason: '', isRequest: false });
      loadStandards();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al procesar la solicitud');
    }
  };

  const getLevelBadgeColor = (level?: number) => {
    if (!level) return 'bg-gray-100 text-gray-800';
    const colors: Record<number, string> = {
      1: 'bg-green-100 text-green-800',
      2: 'bg-blue-100 text-blue-800',
      3: 'bg-yellow-100 text-yellow-800',
      4: 'bg-orange-100 text-orange-800',
      5: 'bg-red-100 text-red-800',
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estándares de Competencia</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los ECM (Estándares de Competencia) del sistema CONOCER
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          {canCreate && (
            <Link
              to="/standards/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo Estándar
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/standards/deletion-requests"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Solicitudes
            </Link>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex items-center">
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="sr-only peer"
          />
          <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          <span className="ms-3 text-sm font-medium text-gray-700">
            Mostrar inactivos
          </span>
        </label>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Lista de estándares */}
      {standards.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay estándares</h3>
          <p className="mt-1 text-sm text-gray-500">
            {canCreate ? 'Comienza creando un nuevo estándar de competencia.' : 'Aún no se han creado estándares.'}
          </p>
          {canCreate && (
            <div className="mt-6">
              <Link
                to="/standards/new"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Crear Estándar
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {standards.map((standard) => (
              <li key={standard.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-semibold text-indigo-600 truncate">
                          {standard.code}
                        </p>
                        {standard.level && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLevelBadgeColor(standard.level)}`}>
                            Nivel {standard.level}
                          </span>
                        )}
                        {!standard.is_active && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-900">{standard.name}</p>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                        {standard.sector && (
                          <span className="flex items-center">
                            <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {standard.sector}
                          </span>
                        )}
                        <span className="flex items-center">
                          <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {standard.validity_years} años vigencia
                        </span>
                        <span className="flex items-center">
                          <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {standard.exam_count || 0} exámenes
                        </span>
                        <span className="flex items-center">
                          <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          {standard.results_count || 0} resultados
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/standards/${standard.id}`)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Ver
                      </button>
                      {(isAdmin || (isEditor && standard.created_by === user?.id)) && (
                        <button
                          onClick={() => navigate(`/standards/${standard.id}/edit`)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Editar
                        </button>
                      )}
                      {(isAdmin || isEditor) && (
                        <button
                          onClick={() => handleDeleteClick(standard)}
                          className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                        >
                          {isAdmin ? 'Eliminar' : 'Solicitar Baja'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal de eliminación */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {deleteModal.isRequest ? 'Solicitar Eliminación' : 'Eliminar Estándar'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {deleteModal.isRequest
                ? `¿Deseas solicitar la eliminación del estándar "${deleteModal.standard?.code}"? Un administrador deberá aprobar esta solicitud.`
                : `¿Estás seguro de eliminar el estándar "${deleteModal.standard?.code}"? Esta acción no se puede deshacer.`}
            </p>
            {deleteModal.isRequest && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razón de la solicitud *
                </label>
                <textarea
                  value={deleteModal.reason}
                  onChange={(e) => setDeleteModal({ ...deleteModal, reason: e.target.value })}
                  rows={3}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Explica por qué debe eliminarse este estándar..."
                />
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal({ show: false, standard: null, reason: '', isRequest: false })}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteModal.isRequest && !deleteModal.reason.trim()}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteModal.isRequest ? 'Enviar Solicitud' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
