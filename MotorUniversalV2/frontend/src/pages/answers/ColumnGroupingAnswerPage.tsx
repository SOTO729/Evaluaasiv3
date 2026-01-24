import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '../../services/examService';

interface GroupingItem {
  id?: string;
  answer_text: string;       // El elemento
  correct_answer: string;    // La columna correcta
  answer_number: number;
}

interface Column {
  id: string;
  name: string;
}

// Toast component
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' 
    ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
    : type === 'error' 
    ? 'bg-gradient-to-r from-red-500 to-rose-600' 
    : 'bg-gradient-to-r from-amber-500 to-yellow-600';

  return (
    <div className="fixed top-4 right-4 z-50 animate-fadeSlideIn">
      <div className={`${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 min-w-[300px]`}>
        <span className="font-medium">{message}</span>
        <button onClick={onClose} className="ml-auto p-1 hover:bg-white/20 rounded-full">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const COLUMN_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800', header: 'bg-blue-500' },
  { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800', header: 'bg-green-500' },
  { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800', header: 'bg-purple-500' },
  { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800', header: 'bg-orange-500' },
  { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-800', header: 'bg-pink-500' },
  { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-800', header: 'bg-teal-500' },
];

export const ColumnGroupingAnswerPage = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  // Columnas (categorías)
  const [columns, setColumns] = useState<Column[]>([
    { id: 'columna_1', name: 'Columna 1' },
    { id: 'columna_2', name: 'Columna 2' }
  ]);
  
  // Elementos a clasificar
  const [items, setItems] = useState<GroupingItem[]>([
    { answer_text: '', correct_answer: 'columna_1', answer_number: 1 },
    { answer_text: '', correct_answer: 'columna_1', answer_number: 2 },
    { answer_text: '', correct_answer: 'columna_2', answer_number: 3 },
    { answer_text: '', correct_answer: 'columna_2', answer_number: 4 }
  ]);

  // Obtener respuestas existentes
  const { data: answersResponse } = useQuery({
    queryKey: ['answers', questionId],
    queryFn: () => examService.getAnswers(questionId!)
  });

  const answersData = answersResponse?.answers || [];

  // Cargar datos existentes
  useEffect(() => {
    if (answersData && answersData.length > 0) {
      const columnsSet = new Set<string>();
      const loadedItems: GroupingItem[] = [];
      
      answersData.forEach((a: any, idx: number) => {
        const correctCol = a.correct_answer || `columna_${(idx % 2) + 1}`;
        columnsSet.add(correctCol);
        
        loadedItems.push({
          id: a.id,
          answer_text: a.answer_text,
          correct_answer: correctCol,
          answer_number: a.answer_number || idx + 1
        });
      });
      
      // Reconstruir columnas
      const columnsArray = Array.from(columnsSet).map((c) => ({
        id: c,
        name: c.replace('columna_', 'Columna ').replace(/_/g, ' ')
      }));
      
      if (columnsArray.length > 0) {
        setColumns(columnsArray);
      }
      
      loadedItems.sort((a, b) => a.answer_number - b.answer_number);
      setItems(loadedItems);
    }
  }, [answersData]);

  // Mutaciones
  const createAnswerMutation = useMutation({
    mutationFn: (data: { answer_text: string; is_correct: boolean; correct_answer?: string; answer_number: number }) =>
      examService.createAnswer(questionId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answers', questionId] });
    }
  });

  const updateAnswerMutation = useMutation({
    mutationFn: ({ answerId, data }: { answerId: string; data: any }) =>
      examService.updateAnswer(answerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answers', questionId] });
    }
  });

  const deleteAnswerMutation = useMutation({
    mutationFn: (answerId: string) => examService.deleteAnswer(answerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answers', questionId] });
    }
  });

  // Handlers para columnas
  const handleAddColumn = () => {
    if (columns.length < 6) {
      const newId = `columna_${columns.length + 1}`;
      setColumns([...columns, { id: newId, name: `Columna ${columns.length + 1}` }]);
    }
  };

  const handleRemoveColumn = (columnId: string) => {
    if (columns.length > 2) {
      setColumns(columns.filter(c => c.id !== columnId));
      // Reasignar items a la primera columna
      setItems(items.map(item => 
        item.correct_answer === columnId 
          ? { ...item, correct_answer: columns[0].id }
          : item
      ));
    }
  };

  const handleColumnNameChange = (columnId: string, name: string) => {
    setColumns(columns.map(c => c.id === columnId ? { ...c, name } : c));
  };

  // Handlers para items
  const handleAddItem = () => {
    if (items.length < 20) {
      setItems([...items, { 
        answer_text: '', 
        correct_answer: columns[0]?.id || 'columna_1',
        answer_number: items.length + 1 
      }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 2) {
      const newItems = items.filter((_, i) => i !== index);
      newItems.forEach((item, idx) => item.answer_number = idx + 1);
      setItems(newItems);
    }
  };

  const handleItemTextChange = (index: number, text: string) => {
    const newItems = [...items];
    newItems[index].answer_text = text;
    setItems(newItems);
  };

  const handleItemColumnChange = (index: number, columnId: string) => {
    const newItems = [...items];
    newItems[index].correct_answer = columnId;
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.some(i => !i.answer_text.trim())) {
      setToast({ message: 'Todos los elementos deben tener texto', type: 'warning' });
      return;
    }

    // Verificar que cada columna tenga al menos un elemento
    const itemsPerColumn = columns.map(col => items.filter(i => i.correct_answer === col.id).length);
    if (itemsPerColumn.some(count => count === 0)) {
      setToast({ message: 'Cada columna debe tener al menos un elemento', type: 'warning' });
      return;
    }

    try {
      const existingIds = items.filter(i => i.id).map(i => i.id!);
      const currentIds = answersData?.map((a: any) => a.id) || [];

      // Eliminar respuestas que ya no están
      const toDelete = currentIds.filter((id: string) => !existingIds.includes(id));
      for (const id of toDelete) {
        await deleteAnswerMutation.mutateAsync(id);
      }

      // Crear o actualizar
      const promises = items.map((item, index) => {
        const data = {
          answer_text: item.answer_text,
          is_correct: true,
          correct_answer: item.correct_answer,
          answer_number: index + 1
        };
        
        if (item.id) {
          return updateAnswerMutation.mutateAsync({ answerId: item.id, data });
        } else {
          return createAnswerMutation.mutateAsync(data);
        }
      });

      await Promise.all(promises);
      setToast({ message: 'Respuestas guardadas correctamente', type: 'success' });
      setTimeout(() => navigate(-1), 1000);
    } catch (error) {
      console.error('Error al guardar:', error);
      setToast({ message: 'Error al guardar las respuestas', type: 'error' });
    }
  };

  const isValid = items.every(i => i.answer_text.trim()) && 
    columns.length >= 2 && 
    columns.every(col => items.some(i => i.correct_answer === col.id));

  // Agrupar items por columna para preview
  const itemsByColumn = columns.map((col, idx) => ({
    column: col,
    color: COLUMN_COLORS[idx % COLUMN_COLORS.length],
    items: items.filter(i => i.correct_answer === col.id)
  }));

  const getColumnColor = (columnId: string) => {
    const idx = columns.findIndex(c => c.id === columnId);
    return COLUMN_COLORS[idx % COLUMN_COLORS.length];
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-primary-600 hover:text-primary-700 mb-4 flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Preguntas
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Configurar - Agrupamiento en Columnas
        </h1>
        <p className="text-gray-600">
          Define las columnas (categorías) y los elementos que pertenecen a cada una.
        </p>
      </div>

      {/* Información */}
      <div className="card mb-6 bg-indigo-50 border-indigo-200">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-indigo-900 mb-1">Agrupamiento en Columnas</h3>
            <p className="text-sm text-indigo-700">
              El estudiante verá todos los elementos mezclados y deberá clasificarlos
              arrastrándolos a la columna correcta. Ejemplo: Clasificar animales en "Mamíferos" y "Reptiles".
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Columna izquierda: Definir columnas */}
          <div className="card">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-1">Columnas (Categorías)</h3>
                <p className="text-sm text-gray-600">Define las categorías de clasificación</p>
              </div>
              <button
                type="button"
                onClick={handleAddColumn}
                disabled={columns.length >= 6}
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                + Agregar Columna
              </button>
            </div>

            <div className="space-y-3">
              {columns.map((column, index) => {
                const color = COLUMN_COLORS[index % COLUMN_COLORS.length];
                return (
                  <div key={column.id} className={`flex items-center gap-2 p-3 rounded-lg ${color.bg} ${color.border} border`}>
                    <span className={`w-8 h-8 flex items-center justify-center ${color.header} text-white rounded-full font-bold text-sm`}>
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={column.name}
                      onChange={(e) => handleColumnNameChange(column.id, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                      placeholder="Nombre de la columna"
                    />
                    {columns.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(column.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Columna derecha: Elementos a clasificar */}
          <div className="card">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-1">Elementos</h3>
                <p className="text-sm text-gray-600">Define los elementos y su columna correcta</p>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={items.length >= 20}
                className="btn btn-primary text-sm disabled:opacity-50"
              >
                + Agregar Elemento
              </button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {items.map((item, index) => {
                const color = getColumnColor(item.correct_answer);
                return (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-8 h-8 flex items-center justify-center ${color.bg} ${color.text} rounded-full font-bold text-sm`}>
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={item.answer_text}
                        onChange={(e) => handleItemTextChange(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="Texto del elemento"
                      />
                      {items.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-10">
                      <span className="text-sm text-gray-600">Pertenece a:</span>
                      <select
                        value={item.correct_answer}
                        onChange={(e) => handleItemColumnChange(index, e.target.value)}
                        className={`px-3 py-1 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 ${color.bg} ${color.border}`}
                      >
                        {columns.map(col => (
                          <option key={col.id} value={col.id}>{col.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="card mt-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Vista Previa - Respuesta Correcta</h3>
          <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
            {itemsByColumn.map(({ column, color, items: columnItems }) => (
              <div key={column.id} className={`rounded-lg overflow-hidden border-2 ${color.border}`}>
                <div className={`${color.header} text-white px-4 py-3 text-center font-semibold`}>
                  {column.name}
                </div>
                <div className={`${color.bg} p-3 min-h-[150px]`}>
                  <div className="space-y-2">
                    {columnItems.map((item, idx) => (
                      <div key={idx} className={`bg-white ${color.text} px-3 py-2 rounded shadow-sm text-sm text-center border ${color.border}`}>
                        {item.answer_text || '(sin texto)'}
                      </div>
                    ))}
                    {columnItems.length === 0 && (
                      <div className="text-center text-gray-400 text-sm py-4">
                        Sin elementos
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Estadísticas */}
        <div className="card mt-4 bg-gray-50">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-gray-600">
              <strong>{columns.length}</strong> columnas
            </span>
            <span className="text-gray-600">
              <strong>{items.length}</strong> elementos
            </span>
            {columns.map((col, idx) => {
              const count = items.filter(i => i.correct_answer === col.id).length;
              const color = COLUMN_COLORS[idx % COLUMN_COLORS.length];
              return (
                <span key={col.id} className={`${color.text} ${color.bg} px-2 py-1 rounded`}>
                  {col.name}: <strong>{count}</strong>
                </span>
              );
            })}
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-4 mt-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!isValid}
            className="btn btn-primary disabled:opacity-50"
          >
            Guardar Respuestas
          </button>
        </div>
      </form>
    </div>
  );
};

export default ColumnGroupingAnswerPage;
