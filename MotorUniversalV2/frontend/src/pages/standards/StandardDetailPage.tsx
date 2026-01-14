/**
 * Página de detalle de Estándar de Competencia
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getStandard, getStandardExams, CompetencyStandard } from '../../services/standardsService';

export default function StandardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [standard, setStandard] = useState<CompetencyStandard | null>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';
  const isEditor = user?.role === 'editor';

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !standard) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{error || 'Estándar no encontrado'}</p>
        </div>
        <button
          onClick={() => navigate('/standards')}
          className="mt-4 text-indigo-600 hover:text-indigo-500"
        >
          ← Volver a estándares
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Navegación */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/standards')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a estándares
        </button>
      </div>

      {/* Header */}
      <div className="bg-white shadow sm:rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-gradient-to-r from-indigo-600 to-indigo-700">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{standard.code}</h1>
                {standard.level && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLevelBadgeColor(standard.level)}`}>
                    Nivel {standard.level}
                  </span>
                )}
                {!standard.is_active && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                    Inactivo
                  </span>
                )}
              </div>
              <p className="mt-1 text-lg text-indigo-100">{standard.name}</p>
            </div>
            {(isAdmin || (isEditor && standard.created_by === user?.id)) && (
              <button
                onClick={() => navigate(`/standards/${standard.id}/edit`)}
                className="inline-flex items-center px-4 py-2 border border-white border-opacity-30 rounded-md text-sm font-medium text-white hover:bg-white hover:bg-opacity-10"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar
              </button>
            )}
          </div>
        </div>

        {/* Información principal */}
        <div className="px-4 py-5 sm:p-6">
          {standard.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500">Descripción</h3>
              <p className="mt-1 text-gray-900">{standard.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Sector</dt>
              <dd className="mt-1 text-sm text-gray-900">{standard.sector || 'No especificado'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Nivel de Competencia</dt>
              <dd className="mt-1 text-sm text-gray-900">{getLevelDescription(standard.level)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Vigencia</dt>
              <dd className="mt-1 text-sm text-gray-900">{standard.validity_years} años</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Certificador</dt>
              <dd className="mt-1 text-sm text-gray-900">{standard.certifying_body}</dd>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-indigo-600">{standard.exam_count || 0}</div>
              <div className="text-sm text-indigo-700">Exámenes asociados</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{standard.results_count || 0}</div>
              <div className="text-sm text-green-700">Resultados totales</div>
            </div>
          </div>
        </div>
      </div>

      {/* Exámenes asociados */}
      <div className="mt-8">
        <div className="sm:flex sm:items-center sm:justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Exámenes basados en este estándar</h2>
          {(isAdmin || isEditor) && (
            <Link
              to={`/exams/new?standard=${standard.id}`}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear Examen
            </Link>
          )}
        </div>

        {exams.length === 0 ? (
          <div className="bg-white shadow sm:rounded-lg p-6 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No hay exámenes creados para este estándar</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {exams.map((exam) => (
                <li key={exam.id}>
                  <Link
                    to={`/exams/${exam.id}`}
                    className="block hover:bg-gray-50"
                  >
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-medium text-indigo-600">{exam.name}</p>
                          {exam.version && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              v{exam.version}
                            </span>
                          )}
                          {exam.is_published ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Publicado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Borrador
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {exam.question_count || 0} preguntas
                        </div>
                      </div>
                      {exam.description && (
                        <p className="mt-1 text-sm text-gray-500 truncate">{exam.description}</p>
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
      <div className="mt-8 bg-gray-50 rounded-lg p-4 text-xs text-gray-500">
        <p>Creado: {new Date(standard.created_at).toLocaleDateString('es-MX', { dateStyle: 'long' })}</p>
        {standard.updated_at && (
          <p>Última actualización: {new Date(standard.updated_at).toLocaleDateString('es-MX', { dateStyle: 'long' })}</p>
        )}
      </div>
    </div>
  );
}
