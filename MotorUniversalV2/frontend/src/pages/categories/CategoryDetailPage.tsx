import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { examService } from '../../services/examService'

const CategoryDetailPage = () => {
  const { examId, categoryId } = useParams<{ examId: string; categoryId: string }>()
  const navigate = useNavigate()

  const { data: category, isLoading, error } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: async () => {
      const categories = await examService.getCategories(Number(examId))
      return categories.categories.find(c => c.id === Number(categoryId))
    },
    enabled: !!examId && !!categoryId,
  })

  if (isLoading) return <div>Cargando categoría...</div>
  if (error) return <div>Error al cargar la categoría</div>
  if (!category) return <div>Categoría no encontrada</div>

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/exams/${examId}/edit`)}
          className="text-primary-600 hover:text-primary-700 mb-4 flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Categorías
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
            {category.description && (
              <p className="text-gray-600 mt-2">{category.description}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Peso en el examen</div>
            <div className="text-3xl font-bold text-primary-600">{category.percentage}%</div>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Temas</div>
          <div className="text-2xl font-bold text-gray-900">{category.total_topics || 0}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Preguntas</div>
          <div className="text-2xl font-bold text-gray-900">{category.total_questions || 0}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Ejercicios</div>
          <div className="text-2xl font-bold text-gray-900">{category.total_exercises || 0}</div>
        </div>
      </div>

      {/* Sección de Preguntas y Ejercicios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preguntas */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Preguntas</h2>
            <button className="btn btn-primary">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear Pregunta
            </button>
          </div>
          <div className="text-center py-12 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-medium mb-2">No hay preguntas creadas</p>
            <p className="text-sm">Crea la primera pregunta para esta categoría</p>
          </div>
        </div>

        {/* Ejercicios */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Ejercicios</h2>
            <button className="btn btn-primary">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear Ejercicio
            </button>
          </div>
          <div className="text-center py-12 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium mb-2">No hay ejercicios creados</p>
            <p className="text-sm">Crea el primer ejercicio para esta categoría</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CategoryDetailPage
