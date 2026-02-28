/**
 * Página de detalle de Estándar de Competencia
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getStandard, getStandardExams, deleteStandard, CompetencyStandard } from '../../services/standardsService';

export default function StandardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [standard, setStandard] = useState<CompetencyStandard | null>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'developer';
  const isEditor = user?.role === 'editor' || user?.role === 'editor_invitado';

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [standardData, examsData] = await Promise.all([
        getStandard(Number(id)),
        getStandardExams(Number(id)),
      ]);
      setStandard(standardData);
      setExams(examsData.exams);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el estándar');
    } finally {
      setLoading(false);
    }
  };

  const getLevelDescription = (level?: number) => {
    if (!level) return 'No especificado';
    const descriptions: Record<number, string> = {
      1: 'Nivel 1 - Competencias simples',
      2: 'Nivel 2 - Competencias básicas',
      3: 'Nivel 3 - Competencias intermedias',
      4: 'Nivel 4 - Competencias avanzadas',
      5: 'Nivel 5 - Competencias expertas',
    };
    return descriptions[level] || `Nivel ${level}`;
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

  const handleDelete = async () => {
    if (!standard) return;
    try {
      setDeleting(true);
      await deleteStandard(standard.id);
      navigate('/standards', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar el estándar');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !standard) {
    return (
      <div className="max-w-3xl mx-auto fluid-px-4 fluid-py-8">
        <div className="bg-red-50 border border-red-200 rounded-fluid-md fluid-p-4">
          <p className="fluid-text-sm text-red-600">{error || 'Estándar no encontrado'}</p>
        </div>
        <button
          onClick={() => navigate('/standards')}
          className="fluid-mt-4 text-primary-600 hover:text-primary-500"
        >
          ← Volver a estándares
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto fluid-px-6 fluid-py-8">
      {/* Navegación */}
      <div className="fluid-mb-6">
        <button
          onClick={() => navigate('/standards')}
          className="inline-flex items-center fluid-text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="fluid-mr-2 fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a estándares
        </button>
      </div>

      {/* Header */}
      <div className="bg-white shadow rounded-fluid-lg overflow-hidden">
        <div className="fluid-px-6 fluid-py-5 bg-gradient-to-r from-primary-600 to-primary-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
            <div className="flex items-center fluid-gap-4">
              {/* Logo del estándar */}
              {standard.logo_url && (
                <img
                  src={standard.logo_url}
                  alt={`Logo ${standard.code}`}
                  className="w-20 h-20 object-contain rounded-fluid-lg bg-white p-1 shadow-md"
                />
              )}
              <div className="text-white">
                <div className="flex flex-wrap items-center fluid-gap-3">
                  <h1 className="fluid-text-2xl font-bold">{standard.code}</h1>
                  {standard.level && (
                    <span className={`inline-flex items-center fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-medium ${getLevelBadgeColor(standard.level)}`}>
                      Nivel {standard.level}
                    </span>
                  )}
                  {!standard.is_active && (
                    <span className="inline-flex items-center fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-medium bg-gray-200 text-gray-800">
                      Inactivo
                    </span>
                  )}
                </div>
                <p className="fluid-mt-1 fluid-text-lg text-primary-100">{standard.name}</p>
              </div>
            </div>
            {(isAdmin || (isEditor && standard.created_by === user?.id)) && (
              <div className="flex flex-col sm:flex-row fluid-gap-2">
                <button
                  onClick={() => navigate(`/standards/${standard.id}/certificate-template`)}
                  className="w-full sm:w-auto inline-flex items-center justify-center fluid-px-4 fluid-py-2 border border-white border-opacity-30 rounded-fluid-md fluid-text-sm font-medium text-white hover:bg-white hover:bg-opacity-10"
                >
                  <svg className="fluid-mr-2 fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Plantilla Certificado
                </button>
                <button
                  onClick={() => navigate(`/standards/${standard.id}/edit`)}
                  className="w-full sm:w-auto inline-flex items-center justify-center fluid-px-4 fluid-py-2 border border-white border-opacity-30 rounded-fluid-md fluid-text-sm font-medium text-white hover:bg-white hover:bg-opacity-10"
                >
                  <svg className="fluid-mr-2 fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Editar
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center fluid-px-4 fluid-py-2 bg-red-600 hover:bg-red-700 rounded-fluid-md fluid-text-sm font-medium text-white"
                  >
                    <svg className="fluid-mr-2 fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Eliminar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Información principal */}
        <div className="fluid-px-6 fluid-py-5">
          {standard.description && (
            <div className="fluid-mb-6">
              <h3 className="fluid-text-sm font-medium text-gray-500">Descripción</h3>
              <p className="fluid-mt-1 text-gray-900">{standard.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 fluid-gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="fluid-text-sm font-medium text-gray-500">Sector</dt>
              <dd className="fluid-mt-1 fluid-text-sm text-gray-900">{standard.sector || 'No especificado'}</dd>
            </div>
            <div>
              <dt className="fluid-text-sm font-medium text-gray-500">Nivel de Competencia</dt>
              <dd className="fluid-mt-1 fluid-text-sm text-gray-900">{getLevelDescription(standard.level)}</dd>
            </div>
            <div>
              <dt className="fluid-text-sm font-medium text-gray-500">Vigencia</dt>
              <dd className="fluid-mt-1 fluid-text-sm text-gray-900">{standard.validity_years} años</dd>
            </div>
            <div>
              <dt className="fluid-text-sm font-medium text-gray-500">Certificador</dt>
              <dd className="fluid-mt-1 fluid-text-sm text-gray-900">{standard.certifying_body}</dd>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="fluid-mt-8 grid grid-cols-2 fluid-gap-4">
            <div className="bg-primary-50 rounded-fluid-lg fluid-p-4">
              <div className="fluid-text-2xl font-bold text-primary-600">{standard.exam_count || 0}</div>
              <div className="fluid-text-sm text-primary-700">Exámenes asociados</div>
            </div>
            <div className="bg-green-50 rounded-fluid-lg fluid-p-4">
              <div className="fluid-text-2xl font-bold text-green-600">{standard.results_count || 0}</div>
              <div className="fluid-text-sm text-green-700">Resultados totales</div>
            </div>
          </div>
        </div>
      </div>

      {/* Exámenes asociados */}
      <div className="fluid-mt-8">
        <div className="sm:flex sm:items-center sm:justify-between fluid-mb-4">
          <h2 className="fluid-text-lg font-medium text-gray-900">Exámenes basados en este estándar</h2>
          {(isAdmin || isEditor) && (
            <Link
              to={`/exams/new?standard=${standard.id}`}
              className="inline-flex items-center fluid-px-4 fluid-py-2 border border-transparent rounded-fluid-md shadow-sm fluid-text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              <svg className="-ml-1 fluid-mr-2 fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear Examen
            </Link>
          )}
        </div>

        {exams.length === 0 ? (
          <div className="bg-white shadow rounded-fluid-lg fluid-p-6 text-center">
            <svg className="mx-auto fluid-icon-xl text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="fluid-mt-2 fluid-text-sm text-gray-500">No hay exámenes creados para este estándar</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden rounded-fluid-lg">
            <ul className="divide-y divide-gray-200">
              {exams.map((exam) => (
                <li key={exam.id}>
                  <Link
                    to={`/exams/${exam.id}`}
                    className="block hover:bg-gray-50"
                  >
                    <div className="fluid-px-4 fluid-py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center fluid-gap-3">
                          <p className="fluid-text-sm font-medium text-primary-600">{exam.name}</p>
                          {exam.version && (
                            <span className="inline-flex items-center fluid-px-2 fluid-py-1 rounded fluid-text-xs font-medium bg-gray-100 text-gray-800">
                              v{exam.version}
                            </span>
                          )}
                          {exam.is_published ? (
                            <span className="inline-flex items-center fluid-px-2 fluid-py-1 rounded fluid-text-xs font-medium bg-green-100 text-green-800">
                              Publicado
                            </span>
                          ) : (
                            <span className="inline-flex items-center fluid-px-2 fluid-py-1 rounded fluid-text-xs font-medium bg-yellow-100 text-yellow-800">
                              Borrador
                            </span>
                          )}
                        </div>
                        <div className="fluid-text-sm text-gray-500">
                          {exam.question_count || 0} preguntas
                        </div>
                      </div>
                      {exam.description && (
                        <p className="fluid-mt-1 fluid-text-sm text-gray-500 truncate">{exam.description}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="fluid-mt-8 bg-gray-50 rounded-fluid-lg fluid-p-4 fluid-text-xs text-gray-500">
        <p>Creado: {new Date(standard.created_at).toLocaleDateString('es-MX', { dateStyle: 'long' })}</p>
        {standard.updated_at && (
          <p>Última actualización: {new Date(standard.updated_at).toLocaleDateString('es-MX', { dateStyle: 'long' })}</p>
        )}
      </div>

      {/* Modal de confirmación para eliminar */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-xl shadow-xl w-full max-w-md">
            <div className="fluid-p-6">
              <div className="flex items-center fluid-gap-4 fluid-mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="fluid-text-lg font-semibold text-gray-900">Eliminar Estándar</h3>
                  <p className="fluid-text-sm text-gray-500">Esta acción no se puede deshacer</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-4 fluid-mb-4">
                <p className="fluid-text-sm text-red-800">
                  <strong>¡Advertencia!</strong> Se eliminará permanentemente el estándar <strong>{standard.code}</strong> y todos sus datos asociados.
                </p>
              </div>

              <p className="fluid-text-sm text-gray-600 fluid-mb-6">
                ¿Estás seguro de que deseas eliminar el estándar "{standard.name}"?
              </p>

              <div className="flex justify-end fluid-gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="fluid-px-4 fluid-py-2 border border-gray-300 text-gray-700 rounded-fluid-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-red-600 hover:bg-red-700 text-white rounded-fluid-lg font-medium disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
