import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { examService } from '../../services/examService'

const ExamEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const { data: exam, isLoading, error } = useQuery({
    queryKey: ['exam', id],
    queryFn: () => examService.getExam(Number(id), true), // Incluir detalles completos
    enabled: !!id,
  })

  // Debug: Ver qué datos llegan
  console.log('Exam data:', exam)
  console.log('Categories:', exam?.categories)
  console.log('Categories length:', exam?.categories?.length)

  if (isLoading) return <div>Cargando examen...</div>
  if (error) return <div>Error al cargar el examen</div>
  if (!exam) return <div>Examen no encontrado</div>

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/exams')}
          className="text-primary-600 hover:text-primary-700 mb-4 flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Exámenes
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Editar Examen</h1>
      </div>

      {/* Información General del Examen */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-4">Información General</h2>
        
        <div className="space-y-4">
          {/* Nombre del Examen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Examen
            </label>
            <p className="text-lg font-semibold text-gray-900">{exam.name}</p>
          </div>

          {/* Código ECM */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código ECM
            </label>
            <p className="text-lg font-mono font-semibold text-primary-600">{exam.version}</p>
          </div>

          {/* Información adicional en grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Duración
              </label>
              <p className="text-base font-semibold">{exam.duration_minutes || 0} min</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Puntaje Mínimo
              </label>
              <p className="text-base font-semibold">{exam.passing_score}%</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Preguntas
              </label>
              <p className="text-base font-semibold">{exam.total_questions}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Ejercicios
              </label>
              <p className="text-base font-semibold">{exam.total_exercises}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Categorías del Examen */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Categorías del Examen</h2>
          <span className="text-sm text-gray-600">
            {exam.categories?.length || 0} categoría{exam.categories?.length !== 1 ? 's' : ''}
          </span>
        </div>

        {exam.categories && exam.categories.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Porcentaje
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preguntas
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ejercicios
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Opciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {exam.categories.map((category, index) => (
                  <tr key={category.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900">{category.name}</div>
                      {category.description && (
                        <div className="text-sm text-gray-500 mt-1">{category.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-primary-100 text-primary-700">
                        {category.percentage}%
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-medium">{category.total_questions || 0}</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-medium">{category.total_exercises || 0}</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/exams/${id}/categories/${category.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                          title="Ver detalles"
                        >
                          Detalles
                        </button>
                        <button
                          onClick={() => navigate(`/exams/${id}/categories/${category.id}/edit`)}
                          className="text-primary-600 hover:text-primary-800 font-medium"
                          title="Editar categoría"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Estás seguro de eliminar la categoría "${category.name}"?`)) {
                              // TODO: Implementar eliminación
                              console.log('Eliminar categoría', category.id)
                            }
                          }}
                          className="text-red-600 hover:text-red-800 font-medium"
                          title="Eliminar categoría"
                        >
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No hay categorías registradas para este examen
          </div>
        )}
      </div>
    </div>
  )
}

export default ExamEditPage
