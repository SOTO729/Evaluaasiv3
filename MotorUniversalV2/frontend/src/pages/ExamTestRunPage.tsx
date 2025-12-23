import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { examService } from '../services/examService';
import LoadingSpinner from '../components/LoadingSpinner';
import { ChevronLeft, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';

const ExamTestRunPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  const { questionCount } = location.state as { questionCount: number; exerciseCount: number };
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [startTime] = useState(Date.now());
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  const { data: exam, isLoading } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => examService.getExam(Number(examId!), true),
    enabled: !!examId
  });

  // Seleccionar preguntas aleatorias
  const [selectedQuestions, setSelectedQuestions] = useState<any[]>([]);

  useEffect(() => {
    if (exam) {
      const allQuestions: any[] = [];
      exam.categories?.forEach((category: any) => {
        category.questions?.forEach((question: any) => {
          allQuestions.push({ ...question, category_name: category.category_name });
        });
      });

      // Seleccionar aleatoriamente
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      setSelectedQuestions(shuffled.slice(0, questionCount));
    }
  }, [exam, questionCount]);

  const currentQuestion = selectedQuestions[currentQuestionIndex];

  const handleAnswerChange = (questionId: number, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < selectedQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    navigate(`/test-exams/${examId}/results`, {
      state: {
        answers,
        questions: selectedQuestions,
        elapsedTime
      }
    });
  };

  const getAnsweredCount = () => {
    return Object.keys(answers).length;
  };

  const renderQuestionInput = () => {
    if (!currentQuestion) return null;

    const currentAnswer = answers[currentQuestion.question_id];

    switch (currentQuestion.question_type) {
      case 'true_false':
        return (
          <div className="space-y-3">
            <label className="flex items-center space-x-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name={`question-${currentQuestion.question_id}`}
                value="true"
                checked={currentAnswer === true}
                onChange={() => handleAnswerChange(currentQuestion.question_id, true)}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-gray-900">Verdadero</span>
            </label>
            <label className="flex items-center space-x-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name={`question-${currentQuestion.question_id}`}
                value="false"
                checked={currentAnswer === false}
                onChange={() => handleAnswerChange(currentQuestion.question_id, false)}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-gray-900">Falso</span>
            </label>
          </div>
        );

      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {currentQuestion.options?.map((option: any) => (
              <label
                key={option.option_id}
                className="flex items-center space-x-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="radio"
                  name={`question-${currentQuestion.question_id}`}
                  value={option.option_id}
                  checked={currentAnswer === option.option_id}
                  onChange={() => handleAnswerChange(currentQuestion.question_id, option.option_id)}
                  className="w-4 h-4 text-primary-600"
                />
                <div
                  className="text-gray-900 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: option.option_text }}
                />
              </label>
            ))}
          </div>
        );

      case 'multiple_select':
        return (
          <div className="space-y-3">
            {currentQuestion.options?.map((option: any) => {
              const selectedOptions = currentAnswer || [];
              const isChecked = selectedOptions.includes(option.option_id);
              
              return (
                <label
                  key={option.option_id}
                  className="flex items-center space-x-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const newSelected = e.target.checked
                        ? [...selectedOptions, option.option_id]
                        : selectedOptions.filter((id: number) => id !== option.option_id);
                      handleAnswerChange(currentQuestion.question_id, newSelected);
                    }}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <div
                    className="text-gray-900 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: option.option_text }}
                  />
                </label>
              );
            })}
          </div>
        );

      default:
        return <p className="text-gray-500">Tipo de pregunta no soportado</p>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-500">Examen no encontrado</p>
      </div>
    );
  }

  if (selectedQuestions.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{exam.name}</h1>
              <p className="text-sm text-gray-600 mt-1">
                Pregunta {currentQuestionIndex + 1} de {selectedQuestions.length}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                <span>{getAnsweredCount()} / {selectedQuestions.length} respondidas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / selectedQuestions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="mb-2">
            <span className="inline-block px-3 py-1 text-xs font-medium text-primary-700 bg-primary-100 rounded-full">
              {currentQuestion.category_name}
            </span>
          </div>
          
          <div
            className="prose prose-lg max-w-none mb-8"
            dangerouslySetInnerHTML={{ __html: currentQuestion.question_text }}
          />

          {renderQuestionInput()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Anterior
          </button>

          {currentQuestionIndex === selectedQuestions.length - 1 ? (
            <button
              onClick={() => setShowConfirmSubmit(true)}
              className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Finalizar Examen
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 flex items-center"
            >
              Siguiente
              <ChevronRight className="w-4 h-4 ml-2" />
            </button>
          )}
        </div>
      </div>

      {/* Confirm Submit Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-start mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ¿Finalizar examen?
                </h3>
                <p className="text-sm text-gray-600">
                  Has respondido {getAnsweredCount()} de {selectedQuestions.length} preguntas.
                </p>
                {getAnsweredCount() < selectedQuestions.length && (
                  <p className="text-sm text-yellow-700 mt-2">
                    Tienes {selectedQuestions.length - getAnsweredCount()} preguntas sin responder.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Continuar Examen
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Sí, Finalizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamTestRunPage;
