import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '../../services/examService';
import { Plus, Trash2, ArrowLeft, Eye, AlertCircle, Type } from 'lucide-react';

interface BlankItem {
  id?: string;
  answer_text: string;
  correct_answer: string;
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

export const DragDropAnswerPage = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [items, setItems] = useState<BlankItem[]>([]);
  const [distractors, setDistractors] = useState<BlankItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [blankCount, setBlankCount] = useState(0);
  const [editorReady, setEditorReady] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  // Crear el HTML visual de un blank
  const createBlankHtml = useCallback((num: number): string => {
    return `<span contenteditable="false" class="inline-flex items-center gap-1 px-3 py-1 mx-1 bg-indigo-100 border-2 border-indigo-400 rounded-lg text-indigo-700 font-semibold text-sm cursor-default select-none" data-blank="${num}">Espacio ${num}<button class="ml-1 text-indigo-500 hover:text-red-500 font-bold text-lg leading-none" data-remove-blank="${num}" style="line-height: 1;">×</button></span>`;
  }, []);

  // Convertir marcadores internos a HTML visual para el editor
  const markersToVisual = useCallback((text: string): string => {
    if (!text) return '';
    return text.replace(/___BLANK_(\d+)___/g, (_, num) => createBlankHtml(num));
  }, [createBlankHtml]);

  // Convertir HTML visual a marcadores internos
  const visualToMarkers = useCallback((element: HTMLDivElement): string => {
    const clone = element.cloneNode(true) as HTMLDivElement;
    
    // Reemplazar spans de blank por marcadores
    const blankSpans = clone.querySelectorAll('span[data-blank]');
    blankSpans.forEach(span => {
      const num = span.getAttribute('data-blank');
      const marker = document.createTextNode(`___BLANK_${num}___`);
      span.parentNode?.replaceChild(marker, span);
    });
    
    // Convertir BRs a newlines y obtener texto
    const brs = clone.querySelectorAll('br');
    brs.forEach(br => {
      br.replaceWith('\n');
    });
    
    // Procesar divs como párrafos
    const divs = clone.querySelectorAll('div');
    divs.forEach(div => {
      if (div.textContent || div.querySelector('span[data-blank]')) {
        const content = div.innerHTML;
        div.replaceWith('\n' + content);
      }
    });
    
    return clone.textContent?.trim() || '';
  }, []);

  // Extraer blanks del editor
  const getBlanksFromEditor = useCallback((): string[] => {
    if (!editorRef.current) return [];
    const blankSpans = editorRef.current.querySelectorAll('span[data-blank]');
    const blanks: string[] = [];
    blankSpans.forEach(span => {
      const num = span.getAttribute('data-blank');
      if (num) blanks.push(`blank_${num}`);
    });
    return [...new Set(blanks)].sort((a, b) => {
      const numA = parseInt(a.replace('blank_', ''));
      const numB = parseInt(b.replace('blank_', ''));
      return numA - numB;
    });
  }, []);

  // Parsear question_text que puede contener instrucciones
  const parseQuestionText = useCallback((fullText: string): { instructions: string; template: string } => {
    if (fullText.includes('___INSTRUCTIONS___') && fullText.includes('___TEMPLATE___')) {
      const parts = fullText.split('___TEMPLATE___');
      const instructionsPart = parts[0].replace('___INSTRUCTIONS___', '').trim();
      const templatePart = parts[1]?.trim() || '';
      return { instructions: instructionsPart, template: templatePart };
    }
    // Si no tiene el formato estructurado, todo es template
    return { instructions: '', template: fullText };
  }, []);

  // Combinar instrucciones y template para guardar
  const combineQuestionText = useCallback((instr: string, template: string): string => {
    if (instr.trim()) {
      return `___INSTRUCTIONS___\n${instr.trim()}\n___TEMPLATE___\n${template}`;
    }
    return template;
  }, []);

  // Cargar datos existentes
  useEffect(() => {
    if (questionData?.question_text && editorRef.current && !editorReady) {
      const { instructions: loadedInstructions, template } = parseQuestionText(questionData.question_text);
      setInstructions(loadedInstructions);
      
      const visualHtml = markersToVisual(template);
      editorRef.current.innerHTML = visualHtml || '';
      
      // Contar blanks existentes
      const matches = template.match(/___BLANK_(\d+)___/g) || [];
      const maxNum = matches.reduce((max: number, m: string) => {
        const num = parseInt(m.match(/\d+/)?.[0] || '0');
        return Math.max(max, num);
      }, 0);
      setBlankCount(maxNum);
      setEditorReady(true);
    }
    
    if (answersData && answersData.length > 0 && !editorReady) {
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
        
        if (a.correct_answer && a.correct_answer.startsWith('blank_')) {
          loadedItems.push(item);
        } else if (a.correct_answer === 'distractor' || !a.is_correct) {
          loadedDistractors.push(item);
        }
      });
      
      loadedItems.sort((a, b) => a.answer_number - b.answer_number);
      setItems(loadedItems);
      setDistractors(loadedDistractors);
    }
  }, [questionData, answersData, markersToVisual, editorReady]);

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

  // Insertar espacio en blanco en la posición del cursor
  const insertBlank = useCallback(() => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    
    const newNum = blankCount + 1;
    setBlankCount(newNum);
    
    const blankHtml = createBlankHtml(newNum);
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // Verificar si el cursor está dentro del editor
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = blankHtml + '\u200B'; // Zero-width space for cursor positioning
        const fragment = document.createDocumentFragment();
        let lastNode: Node | null = null;
        while (tempDiv.firstChild) {
          lastNode = tempDiv.firstChild;
          fragment.appendChild(lastNode);
        }
        
        range.insertNode(fragment);
        
        // Mover cursor después del blank
        if (lastNode) {
          range.setStartAfter(lastNode);
          range.setEndAfter(lastNode);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else {
        // Si el cursor no está en el editor, agregar al final
        editorRef.current.innerHTML += blankHtml;
      }
    } else {
      // Sin selección, agregar al final
      editorRef.current.innerHTML += blankHtml;
    }
    
    // Agregar item para este blank
    setItems(prev => [...prev, {
      answer_text: '',
      correct_answer: `blank_${newNum}`,
      answer_number: prev.length + 1,
      is_correct: true
    }]);
  }, [blankCount, createBlankHtml]);

  // Manejar clicks en el editor (para eliminar blanks)
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const removeBlankNum = target.getAttribute('data-remove-blank');
    
    if (removeBlankNum) {
      e.preventDefault();
      e.stopPropagation();
      
      // Encontrar y eliminar el span del blank
      const blankSpan = editorRef.current?.querySelector(`span[data-blank="${removeBlankNum}"]`);
      if (blankSpan) {
        blankSpan.remove();
      }
      
      // Eliminar el item correspondiente
      setItems(prev => prev.filter(item => item.correct_answer !== `blank_${removeBlankNum}`));
    }
  }, []);

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
    if (!editorRef.current) return;
    
    const templateText = visualToMarkers(editorRef.current);
    const fullQuestionText = combineQuestionText(instructions, templateText);
    const blanks = getBlanksFromEditor();
    
    if (blanks.length === 0) {
      setToast({ message: 'Agrega al menos un espacio en blanco al texto', type: 'warning' });
      return;
    }

    const missingAnswers = blanks.filter(blankId => 
      !items.find(item => item.correct_answer === blankId && item.answer_text.trim())
    );
    if (missingAnswers.length > 0) {
      setToast({ message: 'Todos los espacios en blanco deben tener una respuesta', type: 'warning' });
      return;
    }

    setIsSaving(true);

    try {
      await updateQuestionMutation.mutateAsync({ question_text: fullQuestionText });

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
      
      // Esperar un momento para que el usuario vea el mensaje y regresar
      setTimeout(() => {
        navigate(-1);
      }, 800);
    } catch (error) {
      console.error('Error al guardar:', error);
      setToast({ message: 'Error al guardar la configuración', type: 'error' });
      setIsSaving(false);
    }
  };

  // Renderizar texto con blanks para preview
  const renderPreviewText = () => {
    if (!editorRef.current) return '';
    const templateText = visualToMarkers(editorRef.current);
    let text = templateText;
    
    const regex = /___BLANK_(\d+)___/g;
    text = text.replace(regex, (_, num) => {
      const blankId = `blank_${num}`;
      const item = items.find(i => i.correct_answer === blankId);
      return `<span class="inline-block min-w-[100px] px-3 py-1 mx-1 bg-green-100 border-2 border-green-400 rounded-lg text-green-800 font-medium">${item?.answer_text || '???'}</span>`;
    });
    
    return text.replace(/\n/g, '<br>');
  };

  const blanks = getBlanksFromEditor();

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
              disabled={isSaving}
            >
              <Eye className="w-4 h-4" />
              Vista previa
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Pantalla de carga mientras se guarda */}
        {isSaving && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-lg font-medium text-gray-700">Guardando cambios...</p>
            </div>
          </div>
        )}

        {/* Instrucciones de ayuda */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Cómo funciona:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Escribe o pega el texto de la pregunta en el editor</li>
                <li>Posiciona el cursor donde quieras un espacio en blanco y haz clic en <strong>"+ Insertar Espacio"</strong></li>
                <li>Define la respuesta correcta para cada espacio en la sección de abajo</li>
                <li>Opcionalmente, agrega distractores (opciones incorrectas)</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor de texto visual */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Type className="w-5 h-5 text-gray-600" />
                Texto de la pregunta
              </h2>
              <button
                onClick={insertBlank}
                className="flex items-center gap-1 px-4 py-2 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Insertar Espacio
              </button>
            </div>
            
            {/* Editor contentEditable */}
            <div
              ref={editorRef}
              contentEditable
              onClick={handleEditorClick}
              className="w-full min-h-[200px] max-h-[400px] overflow-y-auto p-4 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-800 leading-relaxed"
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              suppressContentEditableWarning
            />
            
            <div className="flex items-center justify-between mt-3 text-sm">
              <p className="text-gray-500">
                Espacios insertados: <span className="font-semibold text-indigo-600">{blanks.length}</span>
              </p>
              <p className="text-gray-400 text-xs">
                Haz clic en × para eliminar un espacio
              </p>
            </div>
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Vista previa (con respuestas)</h2>
              
              <div 
                className="p-4 bg-gray-50 rounded-lg min-h-[180px] text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderPreviewText() }}
              />
              
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-600 mb-2">Opciones que verá el estudiante:</p>
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
                      {item.answer_text}
                      {!item.is_correct && <span className="ml-1 text-xs text-gray-400">(distractor)</span>}
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
              {blanks.length > 0 ? blanks.map((blankId) => {
                const blankNum = blankId.replace('blank_', '');
                const item = items.find(i => i.correct_answer === blankId);
                const itemIndex = items.findIndex(i => i.correct_answer === blankId);
                
                return (
                  <div key={blankId} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="flex-shrink-0 w-24 text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-1.5 rounded-lg text-center border border-indigo-200">
                      Espacio {blankNum}
                    </span>
                    <span className="text-gray-400">→</span>
                    <input
                      type="text"
                      value={item?.answer_text || ''}
                      onChange={(e) => {
                        if (itemIndex >= 0) {
                          updateItem(itemIndex, 'answer_text', e.target.value);
                        } else {
                          setItems(prev => [...prev, {
                            answer_text: e.target.value,
                            correct_answer: blankId,
                            answer_number: prev.length + 1,
                            is_correct: true
                          }]);
                        }
                      }}
                      placeholder="Escribe la respuesta correcta..."
                      className="flex-1 px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
                    />
                  </div>
                );
              }) : (
                <p className="text-gray-400 text-sm italic text-center py-6 bg-gray-50 rounded-lg">
                  Inserta espacios en blanco en el texto para definir las respuestas
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
              Los distractores son opciones incorrectas que aumentan la dificultad
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
