import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { examService } from '../../services/examService'
import { useAuthStore } from '../../store/authStore'
import LoadingSpinner from '../../components/LoadingSpinner'

// Componente de tarjeta de examen reutilizable (compacto)
const ExamCard = ({ exam }: { exam: any }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
    {/* Header con imagen */}
    {exam.image_url && (
      <div className="-m-4 mb-3">
        <img 
          src={exam.image_url} 
          alt={exam.name}
          className="w-full h-24 object-cover rounded-t-lg"
        />
      </div>
    )}
    <div className="flex justify-between items-start mb-2">
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 truncate">
          {exam.name}
        </h3>
        <p className="text-xs text-gray-500 font-mono">{exam.version}</p>
      </div>
      <span
        className={`px-1.5 py-0.5 text-xs rounded-full whitespace-nowrap ml-2 ${
          exam.is_published
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        {exam.is_published ? 'Publicado' : 'Borrador'}
      </span>
    </div>

    <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-600 mb-3 pb-3 border-b">
      <div className="flex items-center">
        <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{exam.passing_score}%</span>
      </div>
      <div className="flex items-center">
        <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{exam.duration_minutes || 0} min</span>
      </div>
      <div className="flex items-center">
        <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{exam.total_questions} preg.</span>
      </div>
      <div className="flex items-center">
        <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span>{exam.total_exercises} ejer.</span>
      </div>
    </div>

    <div className="flex items-center justify-between">
      <div className="flex items-center text-xs text-gray-600">
        <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        <span>{exam.total_categories || 0} cat.</span>
      </div>
      <Link
        to={`/exams/${exam.id}/edit`}
        className="px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md transition-colors"
      >
        Editar
      </Link>
    </div>
  </div>
)

const ExamsListPage = () => {
  const { user } = useAuthStore()
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examService.getExams(),
    staleTime: 30000, // Cachear por 30 segundos
  })

  if (isLoading) return <LoadingSpinner message="Cargando exámenes..." fullScreen />
  if (error) return <div className="text-center py-12 text-red-600">Error al cargar exámenes</div>

  const canCreateExam = user?.role === 'admin' || user?.role === 'editor'

  // Separar exámenes publicados y borradores
  const publishedExams = data?.exams?.filter((exam: any) => exam.is_published) || []
  const draftExams = data?.exams?.filter((exam: any) => !exam.is_published) || []
  const hasExams = (data?.exams?.length || 0) > 0

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Exámenes</h1>
        {canCreateExam && (
          <Link to="/exams/create" className="btn btn-primary">
            Crear Examen
          </Link>
        )}
      </div>

      {hasExams ? (
        <>
          {/* Sección de Exámenes Publicados */}
          {publishedExams.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Publicados ({publishedExams.length})
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {publishedExams.map((exam: any) => (
                  <ExamCard key={exam.id} exam={exam} />
                ))}
              </div>
            </div>
          )}

          {/* Sección de Borradores */}
          {draftExams.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Borradores ({draftExams.length})
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {draftExams.map((exam: any) => (
                  <ExamCard key={exam.id} exam={exam} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">No hay exámenes disponibles</p>
          {canCreateExam && (
            <Link to="/exams/create" className="btn btn-primary mt-4 inline-block">
              Crear Primer Examen
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export default ExamsListPage
