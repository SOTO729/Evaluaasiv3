import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { examService } from '../../services/examService'
import { useAuthStore } from '../../store/authStore'

const ExamsListPage = () => {
  const { user } = useAuthStore()
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examService.getExams(),
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
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {exam.name}
                  </h3>
                  <p className="text-sm text-gray-500">Versión {exam.version}</p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    exam.is_published
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {exam.is_published ? 'Publicado' : 'Borrador'}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {exam.description || 'Sin descripción'}
              </p>

              <div className="flex justify-between text-sm text-gray-500 mb-4">
                <span>{exam.total_questions} preguntas</span>
                <span>{exam.duration_minutes || 0} min</span>
              </div>

              <div className="flex gap-2">
                <Link
                  to={`/exams/${exam.id}/edit`}
                  className="btn btn-secondary text-sm flex-1"
                >
                  Ver Detalles
                </Link>
              </div>
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
