import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { examService } from '../../services/examService'
import { useAuthStore } from '../../store/authStore'
import { OptimizedImage } from '../../components/ui/OptimizedImage'
import { 
  FileText, 
  Plus, 
  Eye, 
  EyeOff, 
  BookOpen,
  Layers,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  Award,
  Timer,
  Gamepad2
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'

// Componente de tarjeta de examen con nuevo diseño
const ExamCard = ({ 
  exam,
  index = 0,
  showStatus = true
}: { 
  exam: any;
  index?: number;
  showStatus?: boolean;
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isCandidate = user?.role === 'candidato';

  const handleCardClick = () => {
    if (isCandidate) {
      navigate(`/exams/${exam.id}/select-mode`);
    } else {
      navigate(`/exams/${exam.id}/edit`);
    }
  };

  return (
    <div 
      className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 group animate-stagger-in relative hover:shadow-lg cursor-pointer transition-all duration-300"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Card Image */}
      <div 
        className="relative h-40 bg-gradient-to-br from-blue-600 to-blue-800 cursor-pointer"
        onClick={handleCardClick}
      >
        {exam.image_url ? (
          <OptimizedImage
            src={exam.image_url}
            alt={exam.name}
            className="w-full h-full object-cover"
            fallbackIcon={<FileText className="h-16 w-16 text-white/50" />}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText className="h-16 w-16 text-white/50" />
          </div>
        )}
        
        {/* Status Badge - Solo mostrar si showStatus es true */}
        {showStatus && !isCandidate && (
          <div className="absolute top-3 left-3">
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                exam.is_published
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-800/70 text-white'
              }`}
            >
              {exam.is_published ? (
                <>
                  <Eye className="h-3 w-3" />
                  Publicado
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3" />
                  Borrador
                </>
              )}
            </span>
          </div>
        )}

        {/* Version Badge */}
        <div className="absolute top-3 right-3">
          <span className="px-2 py-1 rounded-full text-xs font-mono bg-black/30 text-white">
            {exam.version}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4">
        <h3 
          className="font-semibold text-gray-900 mb-2 line-clamp-1 transition-colors cursor-pointer hover:text-blue-600"
          onClick={handleCardClick}
        >
          {exam.name}
        </h3>
        
        {/* Stats Grid - Diferente para candidatos */}
        {isCandidate ? (
          <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Award className="h-3.5 w-3.5 text-emerald-500" />
              <span>Mínimo {exam.passing_score}%</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5 text-blue-500" />
              <span>{exam.total_topics || 0} temas</span>
            </div>
            <div className="flex items-center gap-1">
              <Timer className="h-3.5 w-3.5 text-slate-500" />
              <span>{exam.duration_minutes || 0} min</span>
            </div>
            <div className="flex items-center gap-1">
              <Award className="h-3.5 w-3.5 text-emerald-500" />
              <span>Mínimo {exam.passing_score}%</span>
            </div>
            <div className="flex items-center gap-1">
              <Gamepad2 className={`h-3.5 w-3.5 ${exam.has_simulator_content ? 'text-purple-500' : 'text-gray-300'}`} />
              <span className={exam.has_simulator_content ? 'text-purple-600 font-medium' : 'text-gray-400'}>
                {exam.has_simulator_content ? 'Simulador' : 'Sin simulador'}
              </span>
            </div>
          </div>
        )}
        
        {/* Card Footer */}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              <span>{exam.total_categories || 0} categorías</span>
            </div>
            {isCandidate && (
              <>
                <div className="flex items-center gap-1" title="Temas">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>{exam.total_topics || 0}</span>
                </div>
                <div className="flex items-center gap-1" title="Duración">
                  <Timer className="h-3.5 w-3.5" />
                  <span>{exam.duration_minutes || 0} min</span>
                </div>
                <div className="flex items-center gap-1" title={exam.has_simulator_content ? 'Con simulador' : 'Sin simulador'}>
                  <Gamepad2 className={`h-3.5 w-3.5 ${exam.has_simulator_content ? 'text-purple-400' : ''}`} />
                  {exam.has_simulator_content && <span className="text-purple-400">Sim</span>}
                </div>
              </>
            )}
          </div>
          {!isCandidate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {new Date(exam.created_at).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ExamsListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const draftsRef = useRef<HTMLDivElement>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;
  const isCandidate = user?.role === 'candidato';
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['exams', currentPage, searchTerm],
    queryFn: () => examService.getExams(currentPage, ITEMS_PER_PAGE, searchTerm),
    staleTime: 30000,
  })

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Scroll a borradores si viene el parámetro
  useEffect(() => {
    if (searchParams.get('scrollTo') === 'drafts' && !isLoading && draftsRef.current) {
      setTimeout(() => {
        // Calcular posición con offset para ver el título
        const element = draftsRef.current
        if (element) {
          const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
          const offsetPosition = elementPosition - 100 // 100px de margen superior
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' })
        }
        // Limpiar el parámetro de la URL
        searchParams.delete('scrollTo')
        setSearchParams(searchParams, { replace: true })
      }, 300)
    }
  }, [searchParams, isLoading, setSearchParams])



  const handleDelete = async () => {
    if (!examToDelete) return;
    try {
      await examService.deleteExam(examToDelete.id);
      setDeleteModalOpen(false);
      setExamToDelete(null);
      refetch();
    } catch (error) {
      console.error('Error al eliminar examen:', error);
    }
  };

  // La función de eliminar se mantiene comentada por si se necesita en el futuro
  // const openDeleteModal = (exam: any) => {
  //   setExamToDelete(exam);
  //   setDeleteModalOpen(true);
  // };

  const canCreateExam = user?.role === 'admin' || user?.role === 'editor'

  // Datos de paginación del servidor
  const allExams = data?.exams || [];
  const totalPages = data?.pages || 1;
  const total = data?.total || 0;

  return (
    <div className="p-4 sm:p-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600" />
            {isCandidate ? 'Exámenes Disponibles' : 'Exámenes'}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            {isCandidate 
              ? 'Explora los exámenes disponibles para tu certificación'
              : 'Gestiona los exámenes con sus categorías, preguntas y ejercicios'
            }
          </p>
        </div>
        {canCreateExam && (
          <button 
            onClick={() => navigate('/exams/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
          >
            <Plus className="h-5 w-5" />
            Nuevo Examen
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar exámenes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 sm:py-2 rounded-lg transition-colors w-full sm:w-auto"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Exams Grid */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow p-8">
          <LoadingSpinner message="Cargando exámenes..." />
        </div>
      ) : allExams.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No hay exámenes</h3>
          <p className="text-gray-500 mb-4">Crea tu primer examen para comenzar</p>
          {canCreateExam && (
            <button
              onClick={() => navigate('/exams/create')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Crear Examen
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Para candidatos: mostrar solo grid sin secciones */}
          {isCandidate ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {allExams.map((exam: any, index: number) => (
                <ExamCard 
                  key={exam.id} 
                  exam={exam}
                  index={index}
                  showStatus={false}
                />
              ))}
            </div>
          ) : (
            <>
              {/* Sección de Publicados */}
              {allExams.filter((e: any) => e.is_published).length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Eye className="h-5 w-5 text-green-600" />
                    <h2 className="text-lg font-semibold text-gray-800">Publicados</h2>
                    <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      {allExams.filter((e: any) => e.is_published).length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {allExams.filter((e: any) => e.is_published).map((exam: any, index: number) => (
                      <ExamCard 
                        key={exam.id} 
                        exam={exam}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Sección de Borradores */}
              {allExams.filter((e: any) => !e.is_published).length > 0 && (
                <div ref={draftsRef} className="mb-8 scroll-mt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <EyeOff className="h-5 w-5 text-gray-500" />
                    <h2 className="text-lg font-semibold text-gray-800">Borradores</h2>
                    <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                      {allExams.filter((e: any) => !e.is_published).length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {allExams.filter((e: any) => !e.is_published).map((exam: any, index: number) => (
                      <ExamCard 
                        key={exam.id} 
                        exam={exam}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-lg shadow px-4 sm:px-6 py-3 sm:py-4">
              <p className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1">
                Mostrando {allExams.length} de {total} exámenes
              </p>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="px-3 py-1 text-sm min-w-[100px] text-center">
                  {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setDeleteModalOpen(false); setExamToDelete(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar Examen</h3>
            <p className="text-gray-600 mb-4">
              ¿Estás seguro de que deseas eliminar el examen "{examToDelete?.name}"? 
              Esta acción también eliminará todas las categorías, preguntas y ejercicios asociados.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setExamToDelete(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExamsListPage
