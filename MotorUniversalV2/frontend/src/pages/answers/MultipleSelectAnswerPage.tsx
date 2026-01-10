import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '../../services/examService';

interface Answer {
  id?: string;
  answer_text: string;
  is_correct: boolean;
}

// Componente Toast personalizado
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: 'bg-gradient-to-r from-green-500 to-emerald-600',
    error: 'bg-gradient-to-r from-red-500 to-rose-600',
    warning: 'bg-gradient-to-r from-amber-500 to-yellow-500'
  };

  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-fadeSlideIn">
      <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl text-white ${bgColors[type]}`}>
        <div className="flex-shrink-0">
          {icons[type]}
        </div>
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const ANSWER_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const MultipleSelectAnswerPage = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const [answers, setAnswers] = useState<Answer[]>([
    { answer_text: '', is_correct: false },
    { answer_text: '', is_correct: false }
  ]);

  // Obtener respuestas existentes
  const { data: answersResponse } = useQuery({
    queryKey: ['answers', questionId],
    queryFn: () => examService.getAnswers(questionId!)
  });

  const answersData = answersResponse?.answers || [];

  // Cargar respuestas existentes
  useEffect(() => {
    if (answersData && answersData.length > 0) {
      setAnswers(answersData.map((a: any) => ({
        id: a.id,
        answer_text: a.answer_text,
        is_correct: a.is_correct
      })));
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
    if (answers.length < 6) {
      setAnswers([...answers, { answer_text: '', is_correct: false }]);
    }
  };

  const handleRemoveAnswer = (index: number) => {
    if (answers.length > 2) {
      setAnswers(answers.filter((_, i) => i !== index));
    }
  };

  const handleAnswerTextChange = (index: number, text: string) => {
    const newAnswers = [...answers];
    newAnswers[index].answer_text = text;
    setAnswers(newAnswers);
  };

  const handleCorrectChange = (index: number) => {
    const newAnswers = [...answers];
    newAnswers[index].is_correct = !newAnswers[index].is_correct;
    setAnswers(newAnswers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones con toast personalizado
    const emptyAnswers = answers.filter(a => !a.answer_text.trim());
    if (emptyAnswers.length > 0) {
      setToast({ 
        message: `Completa el texto de todas las opciones (${emptyAnswers.length} vacía${emptyAnswers.length > 1 ? 's' : ''})`, 
        type: 'warning' 
      });
      return;
    }

    const correctAnswers = answers.filter(a => a.is_correct);
    if (correctAnswers.length === 0) {
      setToast({ message: 'Debes seleccionar al menos una respuesta correcta', type: 'warning' });
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
      const promises = answers.map((answer, index) => {
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
            answer_number: index + 1
          });
        }
      });

      await Promise.all(promises);
      setToast({ message: 'Respuestas guardadas correctamente', type: 'success' });
      setTimeout(() => navigate(-1), 1000); // Volver después de mostrar el mensaje
    } catch (error) {
      console.error('Error al guardar respuestas:', error);
      setToast({ message: 'Error al guardar las respuestas', type: 'error' });
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
          Configurar Respuestas - Selección Múltiple
        </h1>
        <p className="text-gray-600">
          Configura las respuestas para esta pregunta (puedes seleccionar varias correctas)
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Opciones de Respuesta */}
        <div className="card mb-6">
          <div className="mb-6">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Opciones de Respuesta</h3>
                <p className="text-sm text-gray-600">
                  Agrega las posibles respuestas y marca cuáles son correctas (puedes seleccionar varias)
                </p>
              </div>
              <button
                onClick={handleAddAnswer}
                disabled={answers.length >= 6}
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
          <div className="space-y-4">
            {answers.map((answer, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 transition-all ${
                  answer.is_correct
                    ? 'bg-green-50 border-green-400 shadow-sm'
                    : 'bg-white border-gray-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox personalizado */}
                  <button
                    type="button"
                    onClick={() => handleCorrectChange(index)}
                    className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
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

                  {/* Letra de la opción */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center">
                    {ANSWER_LETTERS[index]}
                  </div>

                  {/* Input de texto */}
                  <input
                    type="text"
                    value={answer.answer_text}
                    onChange={(e) => handleAnswerTextChange(index, e.target.value)}
                    className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 ${
                      !answer.answer_text.trim() ? 'border-amber-300 bg-amber-50/50' : 'border-gray-300'
                    }`}
                    placeholder={`Opción ${ANSWER_LETTERS[index]}`}
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
                  <div className="mt-2 ml-10 flex items-center text-sm text-green-700">
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
                  <strong>{answers.length}</strong> de 6 opciones
                </span>
                <span className="text-gray-600">
                  <strong className="text-green-600">{correctCount}</strong> correcta{correctCount !== 1 ? 's' : ''}
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

      {/* Toast de notificación */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
