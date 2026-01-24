import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '../../services/examService';
import { GripVertical, Plus, Trash2, ArrowLeft, Save, Eye, AlertCircle } from 'lucide-react';

interface BlankItem {
  id?: string;
  answer_text: string;       // El texto que va en el espacio en blanco
  correct_answer: string;    // ID del blank donde va (blank_1, blank_2, etc.)
  answer_number: number;
  is_correct: boolean;
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

export const FillBlankDragAnswerPage = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  // Texto con marcadores de espacio en blanco (usar ___BLANK_1___, ___BLANK_2___, etc.)
  const [templateText, setTemplateText] = useState('');
  
  // Elementos que van en los espacios en blanco
  const [items, setItems] = useState<BlankItem[]>([]);
  
  // Distractores (opciones incorrectas)
  const [distractors, setDistractors] = useState<BlankItem[]>([]);
  
  // Mostrar preview
  const [showPreview, setShowPreview] = useState(false);

  // Obtener datos de la pregunta
  const { data: questionResponse } = useQuery({
    queryKey: ['question', questionId],
    queryFn: () => examService.getQuestion(questionId!)
  });

  const questionData = questionResponse?.question;

  // Obtener respuestas existentes
  const { data: answersResponse } = useQuery({
    queryKey: ['answers', questionId],
    queryFn: () => examService.getAnswers(questionId!)
  });

  const answersData = answersResponse?.answers || [];

  // Cargar datos existentes
  useEffect(() => {
    if (questionData?.question_text) {
      // El texto de la pregunta contiene el template
      setTemplateText(questionData.question_text);
    }
    
    if (answersData && answersData.length > 0) {
      const loadedItems: BlankItem[] = [];
      const loadedDistractors: BlankItem[] = [];
      
      answersData.forEach((a: any, idx: number) => {
        const item: BlankItem = {
          id: a.id,
          answer_text: a.answer_text,
          correct_answer: a.correct_answer || '',
          answer_number: a.answer_number || idx + 1,
          is_correct: a.is_correct || false
        };
        
        // Si tiene correct_answer (ej: blank_1) es una respuesta correcta
        // Si no tiene, es un distractor
        if (a.correct_answer && a.correct_answer.startsWith('blank_')) {
          loadedItems.push(item);
        } else {
          loadedDistractors.push(item);
        }
      });
      
      loadedItems.sort((a, b) => a.answer_number - b.answer_number);
      setItems(loadedItems);
      setDistractors(loadedDistractors);
    }
  }, [questionData, answersData]);

  // Mutaciones
  const updateQuestionMutation = useMutation({
    mutationFn: (data: { question_text: string }) =>
      examService.updateQuestion(questionId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question', questionId] });
    }
  });

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

  // Extraer blanks del template
  const extractBlanks = (text: string): string[] => {
    const regex = /___BLANK_(\d+)___/g;
    const blanks: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      blanks.push(`blank_${match[1]}`);
    }
    return [...new Set(blanks)]; // Eliminar duplicados
  };

  const blanks = extractBlanks(templateText);

  // Agregar un nuevo espacio en blanco al texto
  const addBlankToText = () => {
    const nextBlankNum = blanks.length + 1;
    setTemplateText(prev => prev + ` ___BLANK_${nextBlankNum}___`);
    // Agregar item para este blank
    setItems(prev => [...prev, {
      answer_text: '',
      correct_answer: `blank_${nextBlankNum}`,
      answer_number: prev.length + 1,
      is_correct: true
    }]);
  };

  // Agregar distractor
  const addDistractor = () => {
    setDistractors(prev => [...prev, {
      answer_text: '',
      correct_answer: '',
      answer_number: items.length + prev.length + 1,
      is_correct: false
    }]);
  };

  // Eliminar distractor
  const removeDistractor = (index: number) => {
    setDistractors(prev => prev.filter((_, i) => i !== index));
  };

  // Actualizar item
  const updateItem = (index: number, field: keyof BlankItem, value: string) => {
    setItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  // Actualizar distractor
  const updateDistractor = (index: number, value: string) => {
    setDistractors(prev => prev.map((item, i) => 
      i === index ? { ...item, answer_text: value } : item
    ));
  };

  // Guardar todo
  const handleSave = async () => {
    // Validar que haya al menos un blank
    if (blanks.length === 0) {
      setToast({ message: 'Agrega al menos un espacio en blanco al texto', type: 'warning' });
      return;
    }

    // Validar que todos los blanks tengan respuesta
    const missingAnswers = blanks.filter(blankId => 
      !items.find(item => item.correct_answer === blankId && item.answer_text.trim())
    );
    if (missingAnswers.length > 0) {
      setToast({ message: 'Todos los espacios en blanco deben tener una respuesta', type: 'warning' });
      return;
    }

    try {
      // Guardar el texto de la pregunta con los marcadores
      await updateQuestionMutation.mutateAsync({ question_text: templateText });

      // Obtener IDs existentes
      const existingIds = new Set(answersData.map((a: any) => a.id));
      const currentIds = new Set([...items, ...distractors].filter(i => i.id).map(i => i.id));

      // Eliminar respuestas que ya no existen
      for (const answer of answersData) {
        if (!currentIds.has(answer.id)) {
          await deleteAnswerMutation.mutateAsync(answer.id);
        }
      }

      // Guardar/actualizar items (respuestas correctas)
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const data = {
          answer_text: item.answer_text,
          is_correct: true,
          correct_answer: item.correct_answer,
          answer_number: i + 1
        };

        if (item.id && existingIds.has(item.id)) {
          await updateAnswerMutation.mutateAsync({ answerId: item.id, data });
        } else {
          await createAnswerMutation.mutateAsync(data);
        }
      }

      // Guardar/actualizar distractores
      for (let i = 0; i < distractors.length; i++) {
        const distractor = distractors[i];
        if (!distractor.answer_text.trim()) continue;
        
        const data = {
          answer_text: distractor.answer_text,
          is_correct: false,
          correct_answer: 'distractor',
          answer_number: items.length + i + 1
        };

        if (distractor.id && existingIds.has(distractor.id)) {
          await updateAnswerMutation.mutateAsync({ answerId: distractor.id, data });
        } else {
          await createAnswerMutation.mutateAsync(data);
        }
      }

      setToast({ message: 'Configuración guardada exitosamente', type: 'success' });
    } catch (error) {
      console.error('Error al guardar:', error);
      setToast({ message: 'Error al guardar la configuración', type: 'error' });
    }
  };

  // Renderizar texto con blanks para preview
  const renderPreviewText = () => {
    let text = templateText;
    blanks.forEach((blankId) => {
      const item = items.find(i => i.correct_answer === blankId);
      const marker = `___BLANK_${blankId.replace('blank_', '')}___`;
      text = text.replace(
        marker,
        `<span class="inline-block min-w-[100px] px-3 py-1 mx-1 bg-green-100 border-2 border-green-400 rounded-lg text-green-800 font-medium">${item?.answer_text || '???'}</span>`
      );
    });
    return text;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Completar Espacios en Blanco</h1>
              <p className="text-gray-500 text-sm">Configura el texto con espacios para arrastrar y soltar</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showPreview ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye className="w-4 h-4" />
              Vista previa
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md"
            >
              <Save className="w-4 h-4" />
              Guardar
            </button>
          </div>
        </div>

        {/* Instrucciones */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Cómo funciona:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Escribe el texto de la pregunta en el área de texto</li>
                <li>Usa el botón "Agregar Espacio" para insertar marcadores <code className="bg-blue-100 px-1 rounded">___BLANK_N___</code></li>
                <li>Define la respuesta correcta para cada espacio en blanco</li>
                <li>Opcionalmente, agrega distractores (opciones incorrectas)</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor de texto */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Texto de la pregunta</h2>
              <button
                onClick={addBlankToText}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Agregar Espacio
              </button>
            </div>
            <textarea
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              placeholder="Escribe el texto aquí. Usa ___BLANK_1___, ___BLANK_2___ para marcar los espacios en blanco..."
              className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              Espacios detectados: {blanks.length > 0 ? blanks.join(', ') : 'Ninguno'}
            </p>
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Vista previa</h2>
              <div 
                className="p-4 bg-gray-50 rounded-lg min-h-[180px] text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderPreviewText() }}
              />
              
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-600 mb-2">Opciones disponibles para arrastrar:</p>
                <div className="flex flex-wrap gap-2">
                  {[...items, ...distractors].filter(i => i.answer_text.trim()).map((item, idx) => (
                    <div
                      key={idx}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 ${
                        item.is_correct 
                          ? 'bg-blue-50 border-blue-300 text-blue-800' 
                          : 'bg-gray-50 border-gray-300 text-gray-700'
                      }`}
                    >
                      <GripVertical className="w-3 h-3 inline mr-1 opacity-50" />
                      {item.answer_text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Respuestas y Distractores */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Respuestas correctas */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </span>
              Respuestas Correctas
            </h2>
            
            <div className="space-y-3">
              {blanks.map((blankId, idx) => {
                const item = items.find(i => i.correct_answer === blankId) || {
                  answer_text: '',
                  correct_answer: blankId,
                  answer_number: idx + 1,
                  is_correct: true
                };
                const itemIndex = items.findIndex(i => i.correct_answer === blankId);
                
                return (
                  <div key={blankId} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-xs font-mono bg-green-200 text-green-800 px-2 py-1 rounded">
                      {blankId.replace('blank_', 'Espacio ')}
                    </span>
                    <input
                      type="text"
                      value={item.answer_text}
                      onChange={(e) => {
                        if (itemIndex >= 0) {
                          updateItem(itemIndex, 'answer_text', e.target.value);
                        } else {
                          // Agregar nuevo item
                          setItems(prev => [...prev, {
                            answer_text: e.target.value,
                            correct_answer: blankId,
                            answer_number: prev.length + 1,
                            is_correct: true
                          }]);
                        }
                      }}
                      placeholder="Respuesta correcta..."
                      className="flex-1 px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                    />
                  </div>
                );
              })}
              
              {blanks.length === 0 && (
                <p className="text-gray-400 text-sm italic text-center py-4">
                  Agrega espacios en blanco al texto para definir las respuestas
                </p>
              )}
            </div>
          </div>

          {/* Distractores */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✗</span>
                </span>
                Distractores (Opcionales)
              </h2>
              <button
                onClick={addDistractor}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mb-3">
              Los distractores son opciones incorrectas que aparecerán junto a las respuestas correctas
            </p>
            
            <div className="space-y-2">
              {distractors.map((distractor, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={distractor.answer_text}
                    onChange={(e) => updateDistractor(idx, e.target.value)}
                    placeholder={`Distractor ${idx + 1}...`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  />
                  <button
                    onClick={() => removeDistractor(idx)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              {distractors.length === 0 && (
                <p className="text-gray-400 text-sm italic text-center py-4">
                  Sin distractores. El estudiante solo verá las respuestas correctas.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
