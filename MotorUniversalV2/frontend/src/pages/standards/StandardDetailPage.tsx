/**
 * Página de detalle de Estándar de Competencia
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getStandard, getStandardExams, deleteStandard, CompetencyStandard } from '../../services/standardsService';
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Plus,
  Search,
  FileText,
  Clock,
  User as UserIcon,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Award,
  BookOpen,
  BarChart2,
  Tag,
  ScrollText,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

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
  const [examSearch, setExamSearch] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'developer';
  const isEditor = user?.role === 'editor' || user?.role === 'editor_invitado' || user?.role === 'coordinator';

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
      1: 'bg-emerald-100 text-emerald-700',
      2: 'bg-blue-100 text-blue-700',
      3: 'bg-amber-100 text-amber-700',
      4: 'bg-orange-100 text-orange-700',
      5: 'bg-red-100 text-red-700',
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

  const filteredExams = examSearch
    ? exams.filter(
        (e) =>
          e.name?.toLowerCase().includes(examSearch.toLowerCase()) ||
          e.version?.toLowerCase().includes(examSearch.toLowerCase()) ||
          e.description?.toLowerCase().includes(examSearch.toLowerCase())
      )
    : exams;

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando estándar..." />
      </div>
    );
  }

  if (error || !standard) {
    return (
      <div className="fluid-p-6 max-w-[1920px] mx-auto animate-fade-in-up">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-4">
          <AlertCircle className="fluid-icon-sm text-red-600 flex-shrink-0" />
          <p className="fluid-text-sm text-red-700">{error || 'Estándar no encontrado'}</p>
        </div>
        <button
          onClick={() => navigate('/standards')}
          className="fluid-mt-4 inline-flex items-center fluid-gap-2 text-primary-600 hover:text-primary-500 fluid-text-sm"
        >
          <ArrowLeft className="fluid-icon-sm" />
          Volver a estándares
        </button>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[1920px] mx-auto animate-fade-in-up">
      {/* Navegación */}
      <div className="fluid-mb-6">
        <button
          onClick={() => navigate('/standards')}
          className="inline-flex items-center fluid-gap-2 fluid-text-sm text-gray-500 hover:text-primary-600 transition-colors group"
        >
          <ArrowLeft className="fluid-icon-sm transition-transform group-hover:-translate-x-0.5" />
          Volver a estándares
        </button>
      </div>

      {/* Header Card */}
      <div className="bg-white shadow rounded-fluid-xl overflow-hidden fluid-mb-8">
        <div className="fluid-px-6 fluid-py-5 bg-gradient-to-r from-primary-600 to-primary-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
            <div className="flex items-center fluid-gap-4">
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
                    <span className={`inline-flex items-center fluid-px-3 fluid-py-1 rounded-fluid-md fluid-text-xs font-medium ${getLevelBadgeColor(standard.level)}`}>
                      Nivel {standard.level}
                    </span>
                  )}
                  {standard.is_active ? (
                    <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 rounded-fluid-md fluid-text-xs font-medium bg-green-100 text-green-700">
                      <CheckCircle2 className="fluid-icon-xs" />
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 rounded-fluid-md fluid-text-xs font-medium bg-gray-200 text-gray-800">
                      <XCircle className="fluid-icon-xs" />
                      Inactivo
                    </span>
                  )}
                </div>
                <p className="fluid-mt-1 fluid-text-lg text-primary-100">{standard.name}</p>
                {standard.brand && (
                  <p className="fluid-mt-1 fluid-text-sm text-primary-200 flex items-center fluid-gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Marca: {standard.brand.name}
                  </p>
                )}
              </div>
            </div>
            {(isAdmin || isEditor) && (
              <div className="flex flex-wrap fluid-gap-2">
                <button
                  onClick={() => navigate(`/standards/${standard.id}/certificate-template`)}
                  className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2 border border-white/30 rounded-fluid-lg fluid-text-sm font-medium text-white hover:bg-white/10 transition-colors"
                >
                  <Award className="fluid-icon-sm" />
                  <span className="hidden sm:inline">Plantilla Certificado</span>
                </button>
                <button
                  onClick={() => navigate(`/standards/${standard.id}/edit`)}
                  className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2 border border-white/30 rounded-fluid-lg fluid-text-sm font-medium text-white hover:bg-white/10 transition-colors"
                >
                  <Edit3 className="fluid-icon-sm" />
                  Editar
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-red-600 hover:bg-red-700 rounded-fluid-lg fluid-text-sm font-medium text-white transition-colors"
                  >
                    <Trash2 className="fluid-icon-sm" />
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
              <h3 className="fluid-text-sm font-medium text-gray-500 fluid-mb-1">Descripción</h3>
              <p className="fluid-text-base text-gray-900">{standard.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 fluid-gap-6">
            {standard.brand && (
              <div className="bg-blue-50 rounded-fluid-lg fluid-p-4">
                <dt className="fluid-text-xs font-medium text-blue-500 uppercase tracking-wide">Marca</dt>
                <dd className="fluid-mt-1 fluid-text-sm font-semibold text-blue-900">{standard.brand.name}</dd>
              </div>
            )}
            <div className="bg-gray-50 rounded-fluid-lg fluid-p-4">
              <dt className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Sector</dt>
              <dd className="fluid-mt-1 fluid-text-sm font-semibold text-gray-900">{standard.sector || 'No especificado'}</dd>
            </div>
            <div className="bg-gray-50 rounded-fluid-lg fluid-p-4">
              <dt className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Nivel de Competencia</dt>
              <dd className="fluid-mt-1 fluid-text-sm font-semibold text-gray-900">{getLevelDescription(standard.level)}</dd>
            </div>
            <div className="bg-gray-50 rounded-fluid-lg fluid-p-4">
              <dt className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Vigencia</dt>
              <dd className="fluid-mt-1 fluid-text-sm font-semibold text-gray-900">{standard.validity_years} años</dd>
            </div>
            <div className="bg-gray-50 rounded-fluid-lg fluid-p-4">
              <dt className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Certificador</dt>
              <dd className="fluid-mt-1 fluid-text-sm font-semibold text-gray-900">{standard.certifying_body}</dd>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="fluid-mt-6 grid grid-cols-2 lg:grid-cols-4 fluid-gap-4">
            <div className="bg-primary-50 rounded-fluid-lg fluid-p-4 flex items-center fluid-gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-fluid-lg flex items-center justify-center">
                <BookOpen className="fluid-icon-sm text-primary-600" />
              </div>
              <div>
                <div className="fluid-text-xl font-bold text-primary-600">{standard.exam_count || 0}</div>
                <div className="fluid-text-xs text-primary-700">Exámenes</div>
              </div>
            </div>
            <div className="bg-green-50 rounded-fluid-lg fluid-p-4 flex items-center fluid-gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-fluid-lg flex items-center justify-center">
                <BarChart2 className="fluid-icon-sm text-green-600" />
              </div>
              <div>
                <div className="fluid-text-xl font-bold text-green-600">{standard.results_count || 0}</div>
                <div className="fluid-text-xs text-green-700">Resultados</div>
              </div>
            </div>
            <div className={`${standard.has_template ? 'bg-emerald-50' : 'bg-gray-50'} rounded-fluid-lg fluid-p-4 flex items-center fluid-gap-3`}>
              <div className={`flex-shrink-0 w-10 h-10 ${standard.has_template ? 'bg-emerald-100' : 'bg-gray-100'} rounded-fluid-lg flex items-center justify-center`}>
                <ScrollText className={`fluid-icon-sm ${standard.has_template ? 'text-emerald-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <div className={`fluid-text-sm font-bold ${standard.has_template ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {standard.has_template ? 'Activa' : 'Sin plantilla'}
                </div>
                <div className={`fluid-text-xs ${standard.has_template ? 'text-emerald-700' : 'text-gray-500'}`}>Plantilla certificado</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exámenes asociados */}
      <div className="bg-white shadow rounded-fluid-xl overflow-hidden fluid-mb-8">
        <div className="fluid-px-6 fluid-py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <FileText className="fluid-icon-sm text-primary-600" />
              Exámenes basados en este estándar
              <span className="fluid-text-sm font-normal text-gray-500">({exams.length})</span>
            </h2>
            <div className="flex items-center fluid-gap-3">
              {/* Barra de búsqueda */}
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar examen..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="w-full pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent fluid-text-sm"
                />
              </div>
              {(isAdmin || isEditor) && (
                <Link
                  to={`/exams/create?standard=${standard.id}`}
                  className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-fluid-lg fluid-text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <Plus className="fluid-icon-sm" />
                  <span className="hidden sm:inline">Crear Examen</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {exams.length === 0 ? (
          <div className="fluid-p-10 text-center">
            <FileText className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-4" />
            <h3 className="fluid-text-base font-medium text-gray-700 fluid-mb-2">No hay exámenes</h3>
            <p className="fluid-text-sm text-gray-500">No se han creado exámenes para este estándar aún</p>
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="fluid-p-10 text-center">
            <Search className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-4" />
            <p className="fluid-text-sm text-gray-500">No se encontraron exámenes que coincidan con "{examSearch}"</p>
          </div>
        ) : (
          <div className="max-h-[480px] overflow-y-auto">
            <div className="divide-y divide-gray-100">
              {filteredExams.map((exam) => {
                const examContent = (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center fluid-gap-3 fluid-mb-1">
                        <p className="fluid-text-sm font-semibold text-gray-900 group-hover:text-primary-600 transition-colors truncate">
                          {exam.name}
                        </p>
                        {exam.version && (
                          <span className="flex-shrink-0 inline-flex items-center fluid-px-2 fluid-py-0.5 rounded-fluid-md fluid-text-xs font-medium bg-gray-100 text-gray-700">
                            v{exam.version}
                          </span>
                        )}
                        {exam.is_published ? (
                          <span className="flex-shrink-0 inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-0.5 rounded-fluid-md fluid-text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3 h-3" />
                            Publicado
                          </span>
                        ) : (
                          <span className="flex-shrink-0 inline-flex items-center fluid-px-2 fluid-py-0.5 rounded-fluid-md fluid-text-xs font-medium bg-amber-100 text-amber-700">
                            Borrador
                          </span>
                        )}
                      </div>
                      {exam.description && (
                        <p className="fluid-text-xs text-gray-500 truncate fluid-mb-2">{exam.description}</p>
                      )}
                      <div className="flex flex-wrap items-center fluid-gap-x-4 fluid-gap-y-1 fluid-text-xs text-gray-400">
                        {exam.created_at && (
                          <span className="inline-flex items-center fluid-gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(exam.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {exam.creator_name && (
                          <span className="inline-flex items-center fluid-gap-1">
                            <UserIcon className="w-3 h-3" />
                            Creado por: {exam.creator_name}
                          </span>
                        )}
                        {exam.updater_name && (
                          <span className="inline-flex items-center fluid-gap-1">
                            <Edit3 className="w-3 h-3" />
                            Editado por: {exam.updater_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="flex-shrink-0 fluid-icon-sm text-gray-300 group-hover:text-primary-500 transition-colors fluid-ml-4" />
                  </>
                );

                return (
                  <Link key={exam.id} to={`/standards/${id}/exams/${exam.id}`} className="flex items-center justify-between fluid-px-6 fluid-py-4 hover:bg-gray-50 transition-colors group cursor-pointer">
                    {examContent}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-gray-50 rounded-fluid-xl fluid-p-5 fluid-text-xs text-gray-500 flex flex-wrap fluid-gap-x-6 fluid-gap-y-2">
        <span className="inline-flex items-center fluid-gap-1">
          <Clock className="w-3 h-3" />
          Creado: {new Date(standard.created_at).toLocaleDateString('es-MX', { dateStyle: 'long' })}
        </span>
        {standard.updated_at && (
          <span className="inline-flex items-center fluid-gap-1">
            <Edit3 className="w-3 h-3" />
            Última actualización: {new Date(standard.updated_at).toLocaleDateString('es-MX', { dateStyle: 'long' })}
          </span>
        )}
      </div>

      {/* Modal de confirmación para eliminar */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-xl shadow-xl w-full max-w-md">
            <div className="fluid-p-6">
              <div className="flex items-center fluid-gap-4 fluid-mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
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
                      <Trash2 className="w-4 h-4" />
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
