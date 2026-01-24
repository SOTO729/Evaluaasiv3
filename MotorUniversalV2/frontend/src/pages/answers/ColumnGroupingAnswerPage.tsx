import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { examService } from '../../services/examService'
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  AlertCircle,
  Columns,
  GripVertical,
  Loader2
} from 'lucide-react'

interface Answer {
  id?: number
  answer_text: string
  is_correct: boolean
  correct_answer?: string // Nombre de la columna a la que pertenece
}

interface Column {
  name: string
  items: Answer[]
}

export function ColumnGroupingAnswerPage() {
  const { examId, categoryId, topicId, questionId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [columns, setColumns] = useState<Column[]>([
    { name: 'Columna 1', items: [] },
    { name: 'Columna 2', items: [] }
  ])
  const [unassignedItems, setUnassignedItems] = useState<Answer[]>([])
  const [newItemText, setNewItemText] = useState('')
  const [newColumnName, setNewColumnName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Query para obtener la pregunta y sus respuestas
  const { data: questionData, isLoading: isLoadingQuestion } = useQuery({
    queryKey: ['question', questionId],
    queryFn: () => examService.getQuestion(questionId!),
    enabled: !!questionId,
  })

  const { data: answersData, isLoading: isLoadingAnswers } = useQuery({
    queryKey: ['answers', questionId],
    queryFn: () => examService.getAnswers(questionId!),
    enabled: !!questionId,
  })

  // Cargar datos existentes
  useEffect(() => {
    if (answersData?.answers) {
      const answers = answersData.answers as Answer[]
      
      // Extraer nombres de columnas únicas de correct_answer
      const columnNames = new Set<string>()
      answers.forEach(a => {
        if (a.correct_answer) {
          columnNames.add(a.correct_answer)
        }
      })
      
      // Si hay columnas definidas, usarlas
      if (columnNames.size > 0) {
        const newColumns: Column[] = Array.from(columnNames).map(name => ({
          name,
          items: answers.filter(a => a.correct_answer === name)
        }))
        setColumns(newColumns)
        
        // Items sin columna asignada
        setUnassignedItems(answers.filter(a => !a.correct_answer))
      } else if (answers.length > 0) {
        // Todas las respuestas van a "sin asignar"
        setUnassignedItems(answers)
      }
    }
  }, [answersData])

  // Mutation para guardar respuestas
  const saveAnswersMutation = useMutation({
    mutationFn: async () => {
      // Eliminar respuestas existentes que no están en la nueva lista
      const existingAnswers = answersData?.answers || []
      const allNewItems = [
        ...columns.flatMap(col => col.items),
        ...unassignedItems
      ]
      
      for (const existing of existingAnswers) {
        if (!allNewItems.find(item => item.id === existing.id)) {
          await examService.deleteAnswer(String(existing.id))
        }
      }
      
      // Crear o actualizar respuestas
      for (const column of columns) {
        for (const item of column.items) {
          if (item.id) {
            await examService.updateAnswer(String(item.id), {
              answer_text: item.answer_text,
              is_correct: true, // Todos son correctos cuando están en su columna
              correct_answer: column.name
            })
          } else {
            await examService.createAnswer(questionId!, {
              answer_text: item.answer_text,
              is_correct: true,
              correct_answer: column.name
            })
          }
        }
      }
      
      // Guardar items sin asignar
      for (const item of unassignedItems) {
        if (item.id) {
          await examService.updateAnswer(String(item.id), {
            answer_text: item.answer_text,
            is_correct: false,
            correct_answer: ''
          })
        } else {
          await examService.createAnswer(questionId!, {
            answer_text: item.answer_text,
            is_correct: false,
            correct_answer: ''
          })
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answers', questionId] })
      queryClient.invalidateQueries({ queryKey: ['questions', topicId] })
      navigate(`/exams/${examId}/categories/${categoryId}/topics/${topicId}`)
    },
    onError: (error) => {
      console.error('Error al guardar:', error)
      alert('Error al guardar los cambios')
      setIsSaving(false)
    }
  })

  const handleSave = () => {
    // Validar que hay al menos 2 columnas con items
    const columnsWithItems = columns.filter(col => col.items.length > 0)
    if (columnsWithItems.length < 2) {
      alert('Debe haber al menos 2 columnas con elementos')
      return
    }
    
    setIsSaving(true)
    saveAnswersMutation.mutate()
  }

  const addColumn = () => {
    if (newColumnName.trim()) {
      setColumns([...columns, { name: newColumnName.trim(), items: [] }])
      setNewColumnName('')
    }
  }

  const removeColumn = (index: number) => {
    const column = columns[index]
    // Mover items de esta columna a sin asignar
    setUnassignedItems([...unassignedItems, ...column.items])
    setColumns(columns.filter((_, i) => i !== index))
  }

  const renameColumn = (index: number, newName: string) => {
    const updated = [...columns]
    updated[index].name = newName
    setColumns(updated)
  }

  const addItem = () => {
    if (newItemText.trim()) {
      setUnassignedItems([...unassignedItems, { 
        answer_text: newItemText.trim(), 
        is_correct: false 
      }])
      setNewItemText('')
    }
  }

  const removeItem = (columnIndex: number | null, itemIndex: number) => {
    if (columnIndex === null) {
      setUnassignedItems(unassignedItems.filter((_, i) => i !== itemIndex))
    } else {
      const updated = [...columns]
      updated[columnIndex].items = updated[columnIndex].items.filter((_, i) => i !== itemIndex)
      setColumns(updated)
    }
  }

  const moveItemToColumn = (fromColumnIndex: number | null, itemIndex: number, toColumnIndex: number) => {
    let item: Answer
    
    if (fromColumnIndex === null) {
      item = unassignedItems[itemIndex]
      setUnassignedItems(unassignedItems.filter((_, i) => i !== itemIndex))
    } else {
      item = columns[fromColumnIndex].items[itemIndex]
      const updated = [...columns]
      updated[fromColumnIndex].items = updated[fromColumnIndex].items.filter((_, i) => i !== itemIndex)
      setColumns(updated)
    }
    
    const updatedColumns = [...columns]
    updatedColumns[toColumnIndex].items.push(item)
    setColumns(updatedColumns)
  }

  const moveItemToUnassigned = (columnIndex: number, itemIndex: number) => {
    const item = columns[columnIndex].items[itemIndex]
    const updated = [...columns]
    updated[columnIndex].items = updated[columnIndex].items.filter((_, i) => i !== itemIndex)
    setColumns(updated)
    setUnassignedItems([...unassignedItems, item])
  }

  if (isLoadingQuestion || isLoadingAnswers) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  const question = questionData?.question

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(`/exams/${examId}/categories/${categoryId}/topics/${topicId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver al tema</span>
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>

        {/* Título */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Columns className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Agrupamiento en Columnas</h1>
              <p className="text-gray-500">Configura las columnas y los elementos que el estudiante debe agrupar</p>
            </div>
          </div>
          
          {question && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Pregunta:</h3>
              <div 
                className="text-gray-800"
                dangerouslySetInnerHTML={{ __html: question.question_text?.replace(/___INSTRUCTIONS___[\s\S]*?___TEMPLATE___/g, '').trim() || question.question_text }}
              />
            </div>
          )}
        </div>

        {/* Instrucciones */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Cómo funciona:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Crea las columnas (categorías) donde el estudiante agrupará los elementos</li>
                <li>Agrega los elementos que deben ser clasificados</li>
                <li>Arrastra o asigna cada elemento a su columna correcta</li>
                <li>Guarda los cambios cuando termines</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Agregar nueva columna */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Columns className="w-5 h-5 text-purple-500" />
            Columnas
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="Nombre de la nueva columna..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && addColumn()}
            />
            <button
              onClick={addColumn}
              disabled={!newColumnName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Agregar Columna
            </button>
          </div>
        </div>

        {/* Grid de columnas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          {columns.map((column, colIndex) => (
            <div key={colIndex} className="bg-white rounded-xl shadow-md overflow-hidden">
              {/* Header de columna */}
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-3">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={column.name}
                    onChange={(e) => renameColumn(colIndex, e.target.value)}
                    className="bg-transparent text-white font-semibold text-lg w-full focus:outline-none placeholder-white/70"
                    placeholder="Nombre de columna"
                  />
                  {columns.length > 2 && (
                    <button
                      onClick={() => removeColumn(colIndex)}
                      className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded transition-colors"
                      title="Eliminar columna"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-white/70 text-sm mt-1">
                  {column.items.length} elemento{column.items.length !== 1 ? 's' : ''}
                </p>
              </div>
              
              {/* Items de la columna */}
              <div className="p-3 min-h-[150px] bg-gray-50">
                {column.items.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">
                    Arrastra elementos aquí
                  </p>
                ) : (
                  <div className="space-y-2">
                    {column.items.map((item, itemIndex) => (
                      <div
                        key={itemIndex}
                        className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 shadow-sm group"
                      >
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        <span className="flex-1 text-sm text-gray-700">{item.answer_text}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => moveItemToUnassigned(colIndex, itemIndex)}
                            className="p-1 text-gray-400 hover:text-orange-500 transition-colors"
                            title="Quitar de columna"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => removeItem(colIndex, itemIndex)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Items sin asignar */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <GripVertical className="w-5 h-5 text-orange-500" />
            Elementos sin asignar
            <span className="text-sm font-normal text-gray-500">
              ({unassignedItems.length} elemento{unassignedItems.length !== 1 ? 's' : ''})
            </span>
          </h2>
          
          {/* Agregar nuevo item */}
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Texto del nuevo elemento..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && addItem()}
            />
            <button
              onClick={addItem}
              disabled={!newItemText.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Agregar Elemento
            </button>
          </div>
          
          {/* Lista de items sin asignar */}
          {unassignedItems.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4 bg-gray-50 rounded-lg">
              Todos los elementos han sido asignados a columnas
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unassignedItems.map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg group"
                >
                  <GripVertical className="w-4 h-4 text-orange-400" />
                  <span className="flex-1 text-sm text-gray-700">{item.answer_text}</span>
                  
                  {/* Botones para mover a columna */}
                  <div className="flex gap-1">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          moveItemToColumn(null, itemIndex, parseInt(e.target.value))
                          e.target.value = ''
                        }
                      }}
                      className="text-xs px-2 py-1 border border-gray-300 rounded bg-white focus:ring-1 focus:ring-purple-500"
                      defaultValue=""
                    >
                      <option value="" disabled>Mover a...</option>
                      {columns.map((col, colIdx) => (
                        <option key={colIdx} value={colIdx}>{col.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeItem(null, itemIndex)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ColumnGroupingAnswerPage
