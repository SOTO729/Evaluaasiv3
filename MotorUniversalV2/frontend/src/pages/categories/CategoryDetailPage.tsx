import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { examService } from '../../services/examService'
import type { Topic } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'

const CategoryDetailPage = () => {
  const { examId, categoryId } = useParams<{ examId: string; categoryId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  const [deleteConfirmTopic, setDeleteConfirmTopic] = useState<Topic | null>(null)
  const [formData, setFormData] = useState({
    name: '',
  })

  const { data: category, isLoading, error } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: async () => {
      const categories = await examService.getCategories(Number(examId))
      return categories.categories.find(c => c.id === Number(categoryId))
    },
    enabled: !!examId && !!categoryId,
  })

  const { data: topicsData, isLoading: isLoadingTopics } = useQuery({
    queryKey: ['topics', categoryId],
    queryFn: () => examService.getTopics(Number(categoryId)),
    enabled: !!categoryId,
  })

  const createTopicMutation = useMutation({
    mutationFn: (data: Partial<Topic>) => examService.createTopic(Number(categoryId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics', categoryId] })
      queryClient.invalidateQueries({ queryKey: ['category', categoryId] })
      setIsCreateModalOpen(false)
      setFormData({ name: '' })
    },
  })

  const updateTopicMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Topic> }) => 
      examService.updateTopic(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics', categoryId] })
      queryClient.invalidateQueries({ queryKey: ['category', categoryId] })
      setEditingTopic(null)
      setFormData({ name: '' })
    },
  })

  const deleteTopicMutation = useMutation({
    mutationFn: (topicId: number) => examService.deleteTopic(topicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics', categoryId] })
      queryClient.invalidateQueries({ queryKey: ['category', categoryId] })
      setDeleteConfirmTopic(null)
    },
  })

  const handleOpenCreateModal = () => {
    setFormData({ name: '' })
    setEditingTopic(null)
    setIsCreateModalOpen(true)
  }

  const handleOpenEditModal = (topic: Topic) => {
    setFormData({ name: topic.name })
    setEditingTopic(topic)
    setIsCreateModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsCreateModalOpen(false)
    setEditingTopic(null)
    setFormData({ name: '' })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingTopic) {
      updateTopicMutation.mutate({ id: editingTopic.id, data: formData })
    } else {
      createTopicMutation.mutate(formData)
    }
  }

  const handleDelete = (e: React.MouseEvent, topic: Topic) => {
    e.stopPropagation()
    setDeleteConfirmTopic(topic)
  }

  const confirmDelete = () => {
    if (deleteConfirmTopic) {
      deleteTopicMutation.mutate(deleteConfirmTopic.id)
    }
  }

  const handleTopicClick = (topicId: number) => {
    navigate(`/exams/${examId}/categories/${categoryId}/topics/${topicId}`)
  }

  const handleEdit = (e: React.MouseEvent, topic: Topic) => {
    e.stopPropagation()
    handleOpenEditModal(topic)
  }

  if (isLoading) return <LoadingSpinner message="Cargando categoría..." fullScreen />
  if (error) return <div className="text-center py-12 text-red-600">Error al cargar la categoría</div>
  if (!category) return <div className="text-center py-12 text-gray-600">Categoría no encontrada</div>

  const topics = topicsData?.topics || []

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

      {/* Sección de Temas */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Temas de la Categoría</h2>
          <button 
            onClick={handleOpenCreateModal}
            className="btn btn-primary"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear Tema
          </button>
        </div>

        {isLoadingTopics ? (
          <LoadingSpinner message="Cargando temas..." />
        ) : topics.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium mb-2">No hay temas creados</p>
            <p className="text-sm">Crea el primer tema para esta categoría</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre del Tema
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Número de Preguntas
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Número de Ejercicios
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topics.map((topic, index) => (
                  <tr
                    key={topic.id}
                    onClick={() => handleTopicClick(topic.id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{topic.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{topic.total_questions || 0}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{topic.total_exercises || 0}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={(e) => handleEdit(e, topic)}
                          className="p-2 text-primary-600 hover:bg-primary-100 rounded-lg transition-colors"
                          title="Editar tema"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, topic)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Eliminar tema"
                          disabled={deleteTopicMutation.isPending}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Crear/Editar Tema */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">
              {editingTopic ? 'Editar Tema' : 'Crear Nuevo Tema'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Tema *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                  placeholder="Ej: Álgebra Lineal"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createTopicMutation.isPending || updateTopicMutation.isPending}
                >
                  {createTopicMutation.isPending || updateTopicMutation.isPending
                    ? 'Guardando...'
                    : editingTopic
                    ? 'Actualizar'
                    : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {deleteConfirmTopic && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Confirmar Eliminación
              </h3>
            </div>
            
            <p className="text-gray-700 mb-2">
              ¿Estás seguro de que deseas eliminar el tema <strong>"{deleteConfirmTopic.name}"</strong>?
            </p>
            
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800 font-medium">
                    Esta acción no se puede deshacer. Se eliminarán permanentemente:
                  </p>
                  <ul className="list-disc list-inside text-sm text-red-700 mt-2">
                    <li>Todas las preguntas creadas en este tema ({deleteConfirmTopic.total_questions || 0})</li>
                    <li>Todos los ejercicios creados en este tema ({deleteConfirmTopic.total_exercises || 0})</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmTopic(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={deleteTopicMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium"
                disabled={deleteTopicMutation.isPending}
              >
                {deleteTopicMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CategoryDetailPage
