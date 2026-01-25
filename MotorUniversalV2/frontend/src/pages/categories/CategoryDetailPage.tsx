import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { examService } from '../../services/examService'
import type { Topic } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import Breadcrumb from '../../components/Breadcrumb'

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

  // Query para obtener el examen (para el breadcrumb)
  const { data: exam } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => examService.getExam(Number(examId)),
    enabled: !!examId,
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

  const breadcrumbItems = [
    { label: exam?.name || 'Examen', path: `/exams/${examId}/edit` },
    { label: category.name, isActive: true },
  ]

  return (
    <div className="max-w-7xl mx-auto fluid-p-6">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Botón volver a examen */}
      <button
        onClick={() => navigate(`/exams/${examId}/edit`)}
        className="fluid-mb-4 text-primary-600 hover:text-primary-700 flex items-center fluid-text-sm font-medium transition-colors"
      >
        <svg className="fluid-icon-sm fluid-mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a examen
      </button>

      {/* Header */}
      <div className="fluid-mb-8">
        <div className="bg-gradient-to-r from-blue-600 via-sky-600 to-blue-700 rounded-fluid-2xl fluid-p-6 shadow-xl shadow-blue-500/20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center fluid-gap-4">
            <div>
              <h1 className="fluid-text-3xl font-bold text-white">{category.name}</h1>
              {category.description && (
                <p className="text-blue-100 fluid-mt-2">{category.description}</p>
              )}
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-fluid-xl fluid-px-6 fluid-py-4 text-center">
              <div className="fluid-text-sm text-blue-100 font-medium">Peso en el examen</div>
              <div className="fluid-text-4xl font-bold text-white">{category.percentage}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4 fluid-mb-8">
        <div className="bg-white rounded-fluid-xl border border-gray-100 fluid-p-5 shadow-sm hover:shadow-lg hover:border-green-200 transform hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex items-center fluid-gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-fluid-xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <svg className="fluid-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="fluid-text-sm font-medium text-gray-500">Temas</div>
              <div className="fluid-text-2xl font-bold text-gray-900">{category.total_topics || 0}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-fluid-xl border border-gray-100 fluid-p-5 shadow-sm hover:shadow-lg hover:border-blue-200 transform hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex items-center fluid-gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-fluid-xl bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <svg className="fluid-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="fluid-text-sm font-medium text-gray-500">Preguntas</div>
              <div className="fluid-text-2xl font-bold text-gray-900">{category.total_questions || 0}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-fluid-xl border border-gray-100 fluid-p-5 shadow-sm hover:shadow-lg hover:border-violet-200 transform hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex items-center fluid-gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-fluid-xl bg-violet-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <svg className="fluid-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="fluid-text-sm font-medium text-gray-500">Ejercicios</div>
              <div className="fluid-text-2xl font-bold text-gray-900">{category.total_exercises || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de Temas */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="fluid-p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center fluid-gap-4 fluid-mb-6">
            <div>
              <h2 className="fluid-text-xl font-bold text-gray-900">Temas de la Categoría</h2>
              <p className="fluid-text-sm text-gray-500 fluid-mt-1">Gestiona los temas y su contenido</p>
            </div>
            <button 
              onClick={handleOpenCreateModal}
              className="inline-flex items-center fluid-px-4 fluid-py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 hover:from-green-600 hover:to-emerald-700 transform hover:-translate-y-0.5 transition-all duration-200"
            >
              <svg className="fluid-icon-sm fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear Tema
            </button>
          </div>

          {isLoadingTopics ? (
            <LoadingSpinner message="Cargando temas..." />
          ) : topics.length === 0 ? (
            <div className="text-center fluid-py-16 fluid-px-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-fluid-2xl bg-gradient-to-br from-green-100 to-emerald-200 fluid-mb-6">
                <svg className="fluid-icon-xl text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-2">No hay temas creados</h3>
              <p className="text-gray-500 fluid-mb-6 max-w-sm mx-auto">Los temas te permiten organizar las preguntas y ejercicios de esta categoría</p>
              <button 
                onClick={handleOpenCreateModal}
                className="inline-flex items-center fluid-px-5 fluid-py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 hover:from-green-600 hover:to-emerald-700 transform hover:-translate-y-0.5 transition-all duration-200"
              >
                <svg className="fluid-icon-sm fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Crear Primer Tema
              </button>
            </div>
          ) : (
            <div className="rounded-fluid-xl border border-gray-200 overflow-hidden animate-fadeSlideIn">
              <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="fluid-px-6 fluid-py-4 text-left fluid-text-xs font-bold text-gray-600 uppercase tracking-wider w-16 bg-gray-100">
                        #
                      </th>
                      <th scope="col" className="fluid-px-6 fluid-py-4 text-left fluid-text-xs font-bold text-gray-600 uppercase tracking-wider bg-gray-100">
                        Nombre del Tema
                      </th>
                      <th scope="col" className="fluid-px-6 fluid-py-4 text-center fluid-text-xs font-bold text-gray-600 uppercase tracking-wider w-32 bg-gray-100">
                        Preguntas
                      </th>
                      <th scope="col" className="fluid-px-6 fluid-py-4 text-center fluid-text-xs font-bold text-gray-600 uppercase tracking-wider w-32 bg-gray-100">
                        Ejercicios
                      </th>
                      <th scope="col" className="fluid-px-6 fluid-py-4 text-right fluid-text-xs font-bold text-gray-600 uppercase tracking-wider w-32 bg-gray-100">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {topics.map((topic, index) => (
                    <tr
                      key={topic.id}
                      onClick={() => handleTopicClick(topic.id)}
                      className="hover:bg-gradient-to-r hover:from-green-50/50 hover:to-transparent cursor-pointer transition-all duration-200 group"
                    >
                      <td className="fluid-px-6 fluid-py-4 whitespace-nowrap">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-fluid-lg bg-gradient-to-br from-green-100 to-emerald-200 text-green-700 font-bold fluid-text-sm shadow-sm">
                          {index + 1}
                        </span>
                      </td>
                      <td className="fluid-px-6 fluid-py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-10 h-10 rounded-fluid-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center fluid-mr-3 group-hover:from-green-100 group-hover:to-emerald-100 transition-all duration-300">
                            <svg className="fluid-icon-sm text-gray-500 group-hover:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <div className="fluid-text-sm font-semibold text-gray-900 group-hover:text-green-900 transition-colors">{topic.name}</div>
                            <div className="fluid-text-xs text-gray-500">Haz clic para ver contenido</div>
                          </div>
                        </div>
                      </td>
                      <td className="fluid-px-6 fluid-py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center fluid-px-3 fluid-py-1 rounded-fluid-lg fluid-text-xs font-semibold bg-blue-100 text-blue-700">
                          <svg className="fluid-icon-xs fluid-mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {topic.total_questions || 0}
                        </span>
                      </td>
                      <td className="fluid-px-6 fluid-py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center fluid-px-3 fluid-py-1 rounded-fluid-lg fluid-text-xs font-semibold bg-violet-100 text-violet-700">
                          <svg className="fluid-icon-xs fluid-mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {topic.total_exercises || 0}
                        </span>
                      </td>
                      <td className="fluid-px-6 fluid-py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end fluid-gap-1">
                          <button
                            onClick={(e) => handleEdit(e, topic)}
                            className="fluid-p-2 rounded-fluid-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200"
                            title="Editar tema"
                          >
                            <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, topic)}
                            className="fluid-p-2 rounded-fluid-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200"
                            title="Eliminar tema"
                            disabled={deleteTopicMutation.isPending}
                          >
                            <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            </div>
          )}
        </div>
      </div>

      {/* Modal de Crear/Editar Tema */}
      {isCreateModalOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4"
          onClick={handleCloseModal}
        >
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 fluid-px-6 fluid-py-4">
              <h3 className="fluid-text-xl font-bold text-white">
                {editingTopic ? 'Editar Tema' : 'Crear Nuevo Tema'}
              </h3>
              <p className="text-green-100 fluid-text-sm fluid-mt-1">
                {editingTopic ? 'Modifica la información del tema' : 'Añade un nuevo tema a esta categoría'}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="fluid-p-6">
              <div className="fluid-mb-6">
                <label className="block fluid-text-sm font-semibold text-gray-700 fluid-mb-2">
                  Nombre del Tema *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                  required
                  placeholder="Ej: Álgebra Lineal"
                />
              </div>
              <div className="flex fluid-gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="fluid-px-5 fluid-py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="fluid-px-5 fluid-py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 hover:from-green-600 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4"
          onClick={() => setDeleteConfirmTopic(null)}
        >
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-red-500 to-rose-600 fluid-px-6 fluid-py-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-10 h-10 rounded-fluid-xl bg-white/20 flex items-center justify-center fluid-mr-3">
                  <svg className="fluid-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="fluid-text-xl font-bold text-white">
                  Confirmar Eliminación
                </h3>
              </div>
            </div>
            
            <div className="fluid-p-6">
              <p className="text-gray-700 fluid-mb-4">
                ¿Estás seguro de que deseas eliminar el tema <strong className="text-gray-900">"{deleteConfirmTopic.name}"</strong>?
              </p>
              
              <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="fluid-icon-sm text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="fluid-ml-3">
                    <p className="fluid-text-sm text-red-800 font-semibold">
                      Esta acción no se puede deshacer
                    </p>
                    <ul className="list-disc list-inside fluid-text-sm text-red-700 fluid-mt-2 flex flex-col fluid-gap-1">
                      <li>{deleteConfirmTopic.total_questions || 0} preguntas serán eliminadas</li>
                      <li>{deleteConfirmTopic.total_exercises || 0} ejercicios serán eliminados</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex fluid-gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTopic(null)}
                  className="fluid-px-5 fluid-py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                  disabled={deleteTopicMutation.isPending}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="fluid-px-5 fluid-py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:from-red-600 hover:to-rose-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={deleteTopicMutation.isPending}
                >
                  {deleteTopicMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CategoryDetailPage
