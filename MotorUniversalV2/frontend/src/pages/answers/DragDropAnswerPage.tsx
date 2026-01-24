import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '../../services/examService';

interface DragDropItem {
  id?: string;
  answer_text: string;       // El elemento a arrastrar
  correct_answer: string;    // La zona/destino correcto
  answer_number: number;
}

interface DropZone {
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

export const DragDropAnswerPage = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  // Zonas de destino (drop zones)
  const [dropZones, setDropZones] = useState<DropZone[]>([
    { id: 'zona_1', name: 'Zona 1' },
    { id: 'zona_2', name: 'Zona 2' }
  ]);
  
  // Elementos arrastrables
  const [items, setItems] = useState<DragDropItem[]>([
    { answer_text: '', correct_answer: 'zona_1', answer_number: 1 },
    { answer_text: '', correct_answer: 'zona_2', answer_number: 2 }
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
      // Extraer zonas únicas de correct_answer
      const zonesSet = new Set<string>();
      const loadedItems: DragDropItem[] = [];
      
      answersData.forEach((a: any, idx: number) => {
        const correctPos = a.correct_answer || `zona_${idx + 1}`;
        zonesSet.add(correctPos);
        
        loadedItems.push({
          id: a.id,
          answer_text: a.answer_text,
          correct_answer: correctPos,
          answer_number: a.answer_number || idx + 1
        });
      });
      
      // Reconstruir zonas
      const zonesArray = Array.from(zonesSet).map((z) => ({
        id: z,
        name: z.replace('zona_', 'Zona ').replace(/_/g, ' ')
      }));
      
      if (zonesArray.length > 0) {
        setDropZones(zonesArray);
      }
      
      // Ordenar por answer_number
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

  // Handlers para zonas
  const handleAddZone = () => {
    if (dropZones.length < 6) {
      const newId = `zona_${dropZones.length + 1}`;
      setDropZones([...dropZones, { id: newId, name: `Zona ${dropZones.length + 1}` }]);
    }
  };

  const handleRemoveZone = (zoneId: string) => {
    if (dropZones.length > 2) {
      setDropZones(dropZones.filter(z => z.id !== zoneId));
      // Reasignar items que estaban en esta zona a la primera zona
      setItems(items.map(item => 
        item.correct_answer === zoneId 
          ? { ...item, correct_answer: dropZones[0].id }
          : item
      ));
    }
  };

  const handleZoneNameChange = (zoneId: string, name: string) => {
    setDropZones(dropZones.map(z => z.id === zoneId ? { ...z, name } : z));
  };

  // Handlers para items
  const handleAddItem = () => {
    if (items.length < 12) {
      setItems([...items, { 
        answer_text: '', 
        correct_answer: dropZones[0]?.id || 'zona_1',
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

  const handleItemZoneChange = (index: number, zoneId: string) => {
    const newItems = [...items];
    newItems[index].correct_answer = zoneId;
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.some(i => !i.answer_text.trim())) {
      setToast({ message: 'Todos los elementos deben tener texto', type: 'warning' });
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

  const isValid = items.every(i => i.answer_text.trim()) && dropZones.length >= 2;

  // Agrupar items por zona para preview
  const itemsByZone = dropZones.map(zone => ({
    zone,
    items: items.filter(i => i.correct_answer === zone.id)
  }));

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
          Configurar - Arrastrar y Soltar
        </h1>
        <p className="text-gray-600">
          Define las zonas de destino y los elementos que el estudiante deberá arrastrar a cada zona.
        </p>
      </div>

      {/* Información */}
      <div className="card mb-6 bg-purple-50 border-purple-200">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-purple-900 mb-1">Arrastrar y Soltar</h3>
            <p className="text-sm text-purple-700">
              El estudiante verá todos los elementos mezclados y deberá arrastrar cada uno 
              a su zona correcta. Cada elemento tiene una única zona destino correcta.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Columna izquierda: Zonas de destino */}
          <div className="card">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-1">Zonas de Destino</h3>
                <p className="text-sm text-gray-600">Define las áreas donde se soltarán los elementos</p>
              </div>
              <button
                type="button"
                onClick={handleAddZone}
                disabled={dropZones.length >= 6}
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                + Agregar Zona
              </button>
            </div>

            <div className="space-y-3">
              {dropZones.map((zone, index) => (
                <div key={zone.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <span className="w-8 h-8 flex items-center justify-center bg-purple-100 text-purple-700 rounded-full font-bold text-sm">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={zone.name}
                    onChange={(e) => handleZoneNameChange(zone.id, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Nombre de la zona"
                  />
                  {dropZones.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveZone(zone.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Columna derecha: Elementos a arrastrar */}
          <div className="card">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-1">Elementos</h3>
                <p className="text-sm text-gray-600">Define los elementos y su zona correcta</p>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={items.length >= 12}
                className="btn btn-primary text-sm disabled:opacity-50"
              >
                + Agregar Elemento
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full font-bold text-sm">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={item.answer_text}
                      onChange={(e) => handleItemTextChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    <span className="text-sm text-gray-600">Zona correcta:</span>
                    <select
                      value={item.correct_answer}
                      onChange={(e) => handleItemZoneChange(index, e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    >
                      {dropZones.map(zone => (
                        <option key={zone.id} value={zone.id}>{zone.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="card mt-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Vista Previa</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {itemsByZone.map(({ zone, items: zoneItems }) => (
              <div key={zone.id} className="border-2 border-dashed border-purple-300 rounded-lg p-3 min-h-[120px]">
                <div className="text-sm font-semibold text-purple-700 mb-2 text-center">{zone.name}</div>
                <div className="space-y-2">
                  {zoneItems.map((item, idx) => (
                    <div key={idx} className="bg-blue-100 text-blue-800 px-3 py-2 rounded text-sm text-center">
                      {item.answer_text || '(sin texto)'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
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

export default DragDropAnswerPage;
