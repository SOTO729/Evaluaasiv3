import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { examService } from '../../services/examService'
import { useAuthStore } from '../../store/authStore'
import { OptimizedImage } from '../../components/ui/OptimizedImage'

// Hook para debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
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
  const isCandidate = user?.role === 'candidato' || user?.role === 'responsable';

  const handleCardClick = () => {
    if (isCandidate) {
      navigate(`/exams/${exam.id}/select-mode`);
    } else {
      navigate(`/exams/${exam.id}/edit`);
    }
  };

  return (
    <div 
      className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 group animate-stagger-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Card Image - altura fija para consistencia */}
      <div 
        className="relative h-40 bg-gradient-to-br from-blue-600 to-blue-800 cursor-pointer"
        onClick={handleCardClick}
      >
        {exam.image_url ? (
          <OptimizedImage
            src={exam.image_url}
            alt={exam.name}
            className="w-full h-full object-cover"
            fallbackIcon={<FileText className="fluid-icon-xl text-white/50" />}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText className="fluid-icon-xl text-white/50" />
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
                  <Eye className="w-3 h-3" />
                  Publicado
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3" />
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
      <div className="fluid-p-4">
        <h3 
          className="font-semibold text-gray-900 mb-2 fluid-text-base line-clamp-1 transition-colors cursor-pointer hover:text-blue-600"
          onClick={handleCardClick}
        >
          {exam.name}
        </h3>
        
        {/* Stats - Diseño diferente para candidatos */}
        {isCandidate ? (
          <>
            {/* Info principal para candidato: puntaje y simulador */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 fluid-text-sm">
                <Award className="fluid-icon-sm text-emerald-500" />
                <span className="text-gray-700 font-medium">Mínimo {exam.passing_score}%</span>
              </div>
              {exam.has_simulator_content && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  <Gamepad2 className="w-3 h-3" />
                  Simulador
                </span>
              )}
            </div>
            
            {/* Footer para candidato: info secundaria en gris */}
            <div className="flex items-center gap-4 fluid-text-xs text-gray-400 pt-3 border-t">
              <div className="flex items-center gap-1" title="Duración">
                <Timer className="fluid-icon-xs" />
                <span>{exam.duration_minutes || 0} min</span>
              </div>
              <div className="flex items-center gap-1" title="Categorías">
                <Layers className="fluid-icon-xs" />
                <span>{exam.total_categories || 0} {exam.total_categories === 1 ? 'categoría' : 'categorías'}</span>
              </div>
              <div className="flex items-center gap-1" title="Temas">
                <BookOpen className="fluid-icon-xs" />
                <span>{exam.total_topics || 0} temas</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Stats Grid para admin/editor */}
            <div className="grid grid-cols-2 gap-2 mb-3 fluid-text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <BookOpen className="fluid-icon-xs text-blue-500" />
                <span>{exam.total_topics || 0} temas</span>
              </div>
              <div className="flex items-center gap-1">
                <Timer className="fluid-icon-xs text-slate-500" />
                <span>{exam.duration_minutes || 0} min</span>
              </div>
              <div className="flex items-center gap-1">
                <Award className="fluid-icon-xs text-emerald-500" />
                <span>Mínimo {exam.passing_score}%</span>
              </div>
              <div className="flex items-center gap-1">
                <Gamepad2 className={`fluid-icon-xs ${exam.has_simulator_content ? 'text-purple-500' : 'text-gray-300'}`} />
                <span className={exam.has_simulator_content ? 'text-purple-600 font-medium' : 'text-gray-400'}>
                  {exam.has_simulator_content ? 'Simulador' : 'Sin simulador'}
                </span>
              </div>
            </div>
            
            {/* Card Footer para admin/editor */}
            <div className="flex items-center justify-between fluid-text-xs text-gray-400 pt-3 border-t">
              <div className="flex items-center gap-1">
                <Layers className="fluid-icon-xs" />
                <span>{exam.total_categories || 0} categorías</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="fluid-icon-xs" />
                <span>
                  {new Date(exam.created_at).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </>
        )}
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
  const isCandidate = user?.role === 'candidato' || user?.role === 'responsable';
  
  // Debounce del término de búsqueda (300ms)
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['exams', currentPage, debouncedSearchTerm],
    queryFn: () => examService.getExams(currentPage, ITEMS_PER_PAGE, debouncedSearchTerm),
    staleTime: 30000,
  })

  // Reset page when debounced search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

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
    <div className="fluid-p-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center fluid-gap-4 fluid-mb-6">
        <div>
          <h1 className="fluid-text-3xl font-bold text-gray-800 flex items-center fluid-gap-3">
            <FileText className="fluid-icon-xl text-blue-600" />
            {isCandidate ? 'Exámenes Disponibles' : 'Exámenes'}
          </h1>
          <p className="fluid-text-base text-gray-600 fluid-mt-2">
            {isCandidate 
              ? 'Explora los exámenes disponibles para tu certificación'
              : 'Gestiona los exámenes con sus categorías, preguntas y ejercicios'
            }
          </p>
        </div>
        {canCreateExam && (
          <button 
            onClick={() => navigate('/exams/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white fluid-px-6 fluid-py-3 rounded-fluid-lg flex items-center justify-center fluid-gap-2 transition-colors w-full sm:w-auto fluid-text-base"
          >
            <Plus className="fluid-icon-lg" />
            Nuevo Examen
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-fluid-lg shadow fluid-p-5 fluid-mb-6">
        <div className="flex flex-col sm:flex-row fluid-gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-lg text-gray-400" />
            <input
              type="text"
              placeholder="Buscar exámenes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  refetch()
                }
              }}
              className="w-full pl-10 pr-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
            />
          </div>
          <button
            onClick={() => {
              // Forzar la búsqueda inmediatamente
              refetch()
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white fluid-px-8 fluid-py-3 rounded-fluid-lg transition-colors w-full sm:w-auto flex items-center justify-center fluid-gap-2 font-medium fluid-text-base"
          >
            <Search className="fluid-icon" />
            Buscar
          </button>
        </div>
      </div>

      {/* Exams Grid */}
      {isLoading ? (
        <div className="bg-white rounded-fluid-lg shadow fluid-p-8">
          <LoadingSpinner message="Cargando exámenes..." />
        </div>
      ) : allExams.length === 0 ? (
        <div className="bg-white rounded-fluid-lg shadow fluid-p-8 text-center">
          <FileText className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-4" />
          <h3 className="fluid-text-lg font-medium text-gray-700 fluid-mb-2">No hay exámenes</h3>
          <p className="text-gray-500 fluid-mb-4">Crea tu primer examen para comenzar</p>
          {canCreateExam && (
            <button
              onClick={() => navigate('/exams/create')}
              className="bg-blue-600 hover:bg-blue-700 text-white fluid-px-4 fluid-py-2 rounded-fluid-lg inline-flex items-center fluid-gap-2"
            >
              <Plus className="fluid-icon" />
              Crear Examen
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Para candidatos: mostrar solo grid sin secciones */}
          {isCandidate ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-5 4xl:grid-cols-6 fluid-gap-6 fluid-mb-8">
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
                <div className="fluid-mb-8">
                  <div className="flex items-center fluid-gap-2 fluid-mb-6">
                    <Eye className="fluid-icon text-green-600" />
                    <h2 className="fluid-text-lg font-semibold text-gray-800">Publicados</h2>
                    <span className="bg-green-100 text-green-700 fluid-text-sm font-medium fluid-px-2 fluid-py-1 rounded-full">
                      {allExams.filter((e: any) => e.is_published).length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-5 4xl:grid-cols-6 fluid-gap-6">
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

              {/* Línea divisoria entre secciones */}
              {allExams.filter((e: any) => e.is_published).length > 0 && allExams.filter((e: any) => !e.is_published).length > 0 && (
                <div className="fluid-my-8">
                  <hr className="border-t-2 border-gray-300" />
                </div>
              )}

              {/* Sección de Borradores */}
              {allExams.filter((e: any) => !e.is_published).length > 0 && (
                <div ref={draftsRef} className="fluid-mb-10 scroll-mt-4">
                  <div className="flex items-center fluid-gap-2 fluid-mb-6">
                    <EyeOff className="fluid-icon text-gray-500" />
                    <h2 className="fluid-text-lg font-semibold text-gray-800">Borradores</h2>
                    <span className="bg-gray-100 text-gray-600 fluid-text-sm font-medium fluid-px-2 fluid-py-1 rounded-full">
                      {allExams.filter((e: any) => !e.is_published).length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-5 4xl:grid-cols-6 fluid-gap-6">
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
            <div className="fluid-mt-6 flex flex-col sm:flex-row items-center justify-between fluid-gap-3 bg-white rounded-fluid-lg shadow fluid-px-6 fluid-py-4">
              <p className="fluid-text-sm text-gray-600 order-2 sm:order-1">
                Mostrando {allExams.length} de {total} exámenes
              </p>
              <div className="flex items-center fluid-gap-2 order-1 sm:order-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="fluid-p-2 rounded-fluid-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100"
                >
                  <ChevronLeft className="fluid-icon-lg" />
                </button>
                <span className="fluid-px-3 fluid-py-1 fluid-text-base min-w-[100px] text-center">
                  {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="fluid-p-2 rounded-fluid-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100"
                >
                  <ChevronRight className="fluid-icon-lg" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4" onClick={() => { setDeleteModalOpen(false); setExamToDelete(null); }}>
          <div className="bg-white rounded-fluid-xl shadow-2xl fluid-p-6 max-w-md w-full animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <h3 className="fluid-text-lg font-bold text-gray-900 fluid-mb-2">Eliminar Examen</h3>
            <p className="text-gray-600 fluid-mb-4">
              ¿Estás seguro de que deseas eliminar el examen "{examToDelete?.name}"? 
              Esta acción también eliminará todas las categorías, preguntas y ejercicios asociados.
            </p>
            <div className="flex justify-end fluid-gap-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setExamToDelete(null);
                }}
                className="fluid-px-4 fluid-py-2 border border-gray-300 rounded-fluid-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="fluid-px-4 fluid-py-2 bg-red-600 text-white rounded-fluid-lg hover:bg-red-700 transition-colors"
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
