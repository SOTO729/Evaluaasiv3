import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '../../services/examService';

interface Answer {
  id?: string;
  answer_text: string;
  is_correct: boolean;
  answer_number: number;
}

const ANSWER_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export const DragDropAnswerPage = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [answers, setAnswers] = useState<Answer[]>([
    { answer_text: '', is_correct: false, answer_number: 1 },
    { answer_text: '', is_correct: false, answer_number: 2 }
  ]);

  const [allowMultipleCorrect, setAllowMultipleCorrect] = useState(false);

  // Obtener respuestas existentes
  const { data: answersResponse } = useQuery({
    queryKey: ['answers', questionId],
    queryFn: () => examService.getAnswers(questionId!)
  });

  const answersData = answersResponse?.answers || [];

  // Cargar respuestas existentes
  useEffect(() => {
    if (answersData && answersData.length > 0) {
      const loadedAnswers = answersData.map((a: any) => ({
        id: a.id,
        answer_text: a.answer_text,
        is_correct: a.is_correct,
        answer_number: a.answer_number || 0
      }));
      
      // Ordenar por answer_number
      loadedAnswers.sort((a: Answer, b: Answer) => a.answer_number - b.answer_number);
      setAnswers(loadedAnswers);
      
      // Detectar si permite múltiples correctas
      const correctCount = loadedAnswers.filter((a: Answer) => a.is_correct).length;
      setAllowMultipleCorrect(correctCount > 1);
    }
  }, [answersData]);

  // Mutación para crear respuesta
  const createAnswerMutation = useMutation({
    mutationFn: (data: { answer_text: string; is_correct: boolean; answer_number: number }) =>
      examService.createAnswer(questionId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answers', questionId] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    }
  });

  // Mutación para actualizar respuesta
  const updateAnswerMutation = useMutation({
    mutationFn: ({ answerId, data }: { answerId: string; data: { answer_text: string; is_correct: boolean } }) =>
      examService.updateAnswer(answerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answers', questionId] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    }
  });

  // Mutación para eliminar respuesta
  const deleteAnswerMutation = useMutation({
    mutationFn: (answerId: string) => examService.deleteAnswer(answerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answers', questionId] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    }
  });

  const handleAddAnswer = () => {
    if (answers.length < 10) {
      setAnswers([...answers, { 
        answer_text: '', 
        is_correct: false, 
        answer_number: answers.length + 1 
      }]);
    }
  };

  const handleRemoveAnswer = (index: number) => {
    if (answers.length > 2) {
      const newAnswers = answers.filter((_, i) => i !== index);
      // Renumerar las respuestas
      newAnswers.forEach((answer, idx) => {
        answer.answer_number = idx + 1;
      });
      setAnswers(newAnswers);
    }
  };

  const handleAnswerTextChange = (index: number, text: string) => {
    const newAnswers = [...answers];
    newAnswers[index].answer_text = text;
    setAnswers(newAnswers);
  };

  const handleCorrectChange = (index: number) => {
    const newAnswers = [...answers];
    
    if (allowMultipleCorrect) {
      // Modo múltiple: toggle el checkbox
      newAnswers[index].is_correct = !newAnswers[index].is_correct;
    } else {
      // Modo único: deseleccionar todas y seleccionar solo esta
      newAnswers.forEach((answer, idx) => {
        answer.is_correct = idx === index;
      });
    }
    
    setAnswers(newAnswers);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const newAnswers = [...answers];
      [newAnswers[index - 1], newAnswers[index]] = [newAnswers[index], newAnswers[index - 1]];
      // Actualizar los números
      newAnswers.forEach((answer, idx) => {
        answer.answer_number = idx + 1;
      });
      setAnswers(newAnswers);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < answers.length - 1) {
      const newAnswers = [...answers];
      [newAnswers[index], newAnswers[index + 1]] = [newAnswers[index + 1], newAnswers[index]];
      // Actualizar los números
      newAnswers.forEach((answer, idx) => {
        answer.answer_number = idx + 1;
      });
      setAnswers(newAnswers);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    const correctAnswers = answers.filter(a => a.is_correct);
    if (correctAnswers.length === 0) {
      alert('Debes seleccionar al menos una respuesta correcta');
      return;
    }

    if (answers.some(a => !a.answer_text.trim())) {
      alert('Todas las opciones deben tener texto');
      return;
    }

    try {
      // Obtener IDs de respuestas existentes
      const existingIds = answers.filter(a => a.id).map(a => a.id!);
      const currentIds = answersData?.map((a: any) => a.id) || [];

      // Eliminar respuestas que ya no están
      const toDelete = currentIds.filter((id: string) => !existingIds.includes(id));
      for (const id of toDelete) {
        await deleteAnswerMutation.mutateAsync(id);
      }

      // Crear o actualizar respuestas
      const promises = answers.map((answer) => {
        if (answer.id) {
          // Actualizar existente
          return updateAnswerMutation.mutateAsync({
            answerId: answer.id,
            data: {
              answer_text: answer.answer_text,
              is_correct: answer.is_correct
            }
          });
        } else {
          // Crear nueva
          return createAnswerMutation.mutateAsync({
            answer_text: answer.answer_text,
            is_correct: answer.is_correct,
            answer_number: answer.answer_number
          });
        }
      });

      await Promise.all(promises);
      navigate(-1); // Volver a la lista de preguntas
    } catch (error) {
      console.error('Error al guardar respuestas:', error);
      alert('Error al guardar las respuestas');
    }
  };

  const correctCount = answers.filter(a => a.is_correct).length;
  const isValid = correctCount >= 1 && answers.every(a => a.answer_text.trim());

  return (
    <div className="container mx-auto px-4 py-6">
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
          Configurar Respuestas - Arrastrar y Soltar
        </h1>
        <p className="text-gray-600">
          Define las opciones que el estudiante podrá arrastrar. El orden importa.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Configuración */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuración</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowMultipleCorrect}
              onChange={(e) => {
                setAllowMultipleCorrect(e.target.checked);
                if (!e.target.checked) {
                  // Si se deshabilita múltiple, mantener solo la primera correcta
                  const firstCorrectIndex = answers.findIndex(a => a.is_correct);
                  const newAnswers = answers.map((a, idx) => ({
                    ...a,
                    is_correct: idx === firstCorrectIndex && firstCorrectIndex !== -1
                  }));
                  setAnswers(newAnswers);
                }
              }}
              className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <div>
              <div className="font-medium text-gray-900">Permitir múltiples respuestas correctas</div>
              <div className="text-sm text-gray-600">
                Útil cuando varias opciones pueden completar correctamente los espacios
              </div>
            </div>
          </label>
        </div>

        {/* Opciones de Respuesta */}
        <div className="card mb-6">
          <div className="mb-6">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Opciones para Arrastrar</h3>
                <p className="text-sm text-gray-600">
                  Agrega las opciones en el orden que aparecerán al estudiante
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddAnswer}
                disabled={answers.length >= 10}
                className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar Opción
              </button>
            </div>
          </div>

          {/* Lista de respuestas */}
          <div className="space-y-3">
            {answers.map((answer, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 transition-all ${
                  answer.is_correct
                    ? 'bg-green-50 border-green-400 shadow-sm'
                    : 'bg-white border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Controles de orden */}
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Mover arriba"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === answers.length - 1}
                      className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Mover abajo"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Checkbox/Radio personalizado */}
                  <button
                    type="button"
                    onClick={() => handleCorrectChange(index)}
                    className={`flex-shrink-0 w-6 h-6 rounded ${allowMultipleCorrect ? '' : 'rounded-full'} border-2 flex items-center justify-center transition-all ${
                      answer.is_correct
                        ? 'bg-green-500 border-green-500'
                        : 'bg-white border-gray-400 hover:border-green-400'
                    }`}
                  >
                    {answer.is_correct && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Número de orden */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center text-sm">
                    {answer.answer_number}
                  </div>

                  {/* Input de texto */}
                  <input
                    type="text"
                    value={answer.answer_text}
                    onChange={(e) => handleAnswerTextChange(index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder={`Opción ${ANSWER_LETTERS[index]}`}
                    required
                  />

                  {/* Botón eliminar */}
                  {answers.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAnswer(index)}
                      className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar opción"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Indicador de correcta */}
                {answer.is_correct && (
                  <div className="mt-2 ml-14 flex items-center text-sm text-green-700">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Respuesta correcta
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Estado y validación */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-600">
                  <strong>{answers.length}</strong> de 10 opciones
                </span>
                <span className="text-gray-600">
                  <strong className="text-green-600">{correctCount}</strong> correcta{correctCount !== 1 ? 's' : ''}
                </span>
                <span className="text-gray-500">
                  {allowMultipleCorrect ? '• Múltiples respuestas permitidas' : '• Solo una respuesta correcta'}
                </span>
              </div>
              {!isValid && (
                <div className="flex items-center text-amber-600">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Completa todos los campos y selecciona al menos una respuesta correcta
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-4">
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
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Guardar Respuestas
          </button>
        </div>
      </form>
    </div>
  );
};
