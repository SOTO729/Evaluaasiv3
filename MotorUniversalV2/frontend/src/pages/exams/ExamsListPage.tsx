import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { examService } from '../../services/examService'
import { useAuthStore } from '../../store/authStore'

const ExamsListPage = () => {
  const { user } = useAuthStore()
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examService.getExams(),
    staleTime: 30000, // Cachear por 30 segundos
  })

  if (isLoading) return <div>Cargando exámenes...</div>
  if (error) return <div>Error al cargar exámenes</div>

  const canCreateExam = user?.role === 'admin' || user?.role === 'editor'

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

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data?.exams && data.exams.length > 0 ? (
          data.exams.map((exam) => (
            <div key={exam.id} className="card hover:shadow-md transition-shadow">
              {/* Header con imagen */}
              {exam.image_url && (
                <div className="-m-6 mb-4">
                  <img 
                    src={exam.image_url} 
                    alt={exam.name}
                    className="w-full h-32 object-cover rounded-t-lg"
                  />
                </div>
              )}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {exam.name}
                  </h3>
                  <p className="text-sm text-gray-500 font-mono">{exam.version}</p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ml-2 ${
                    exam.is_published
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {exam.is_published ? 'Publicado' : 'Borrador'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 mb-4 pb-4 border-b">
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Puntaje: {exam.passing_score}%</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{exam.duration_minutes || 0} min</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{exam.total_questions} preguntas</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>{exam.total_exercises} ejercicios</span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  <span className="font-medium">{exam.total_categories || 0} categoría{exam.total_categories !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <Link
                to={`/exams/${exam.id}/edit`}
                className="btn btn-secondary text-sm w-full"
              >
                Editar Examen
              </Link>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-500">No hay exámenes disponibles</p>
            {canCreateExam && (
              <Link to="/exams/create" className="btn btn-primary mt-4 inline-block">
                Crear Primer Examen
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ExamsListPage
