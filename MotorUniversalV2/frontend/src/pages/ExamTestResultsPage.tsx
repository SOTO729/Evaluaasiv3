import React from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, AlertCircle, ArrowLeft, RotateCcw, Clock } from 'lucide-react';

const ExamTestResultsPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const { answers, questions, elapsedTime } = location.state as {
    answers: Record<number, any>;
    questions: any[];
    elapsedTime: number;
  };

  const evaluateAnswer = (question: any): boolean => {
    const userAnswer = answers[question.question_id];

    if (userAnswer === undefined || userAnswer === null) {
      return false;
    }

    switch (question.question_type) {
      case 'true_false':
        return userAnswer === question.correct_answer;

      case 'multiple_choice':
        const correctOption = question.options?.find((opt: any) => opt.is_correct);
        return userAnswer === correctOption?.option_id;

      case 'multiple_select':
        const correctOptions = question.options
          ?.filter((opt: any) => opt.is_correct)
          .map((opt: any) => opt.option_id)
          .sort();
        const userOptions = (userAnswer || []).sort();
        return JSON.stringify(correctOptions) === JSON.stringify(userOptions);

      default:
        return false;
    }
  };

  const results = questions.map(question => ({
    question,
    isCorrect: evaluateAnswer(question),
    userAnswer: answers[question.question_id]
  }));

  const correctCount = results.filter(r => r.isCorrect).length;
  const incorrectCount = results.filter(r => !r.isCorrect).length;
  const score = ((correctCount / questions.length) * 100).toFixed(1);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = () => {
    const numScore = parseFloat(score);
    if (numScore >= 80) return 'text-green-600';
    if (numScore >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderUserAnswer = (result: any) => {
    const { question, userAnswer } = result;

    if (userAnswer === undefined || userAnswer === null) {
      return <span className="text-gray-500 italic">Sin responder</span>;
    }

    switch (question.question_type) {
      case 'true_false':
        return <span>{userAnswer ? 'Verdadero' : 'Falso'}</span>;

      case 'multiple_choice':
        const selectedOption = question.options?.find((opt: any) => opt.option_id === userAnswer);
        return (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: selectedOption?.option_text || 'Sin responder' }}
          />
        );

      case 'multiple_select':
        const selectedOptions = question.options?.filter((opt: any) => 
          (userAnswer || []).includes(opt.option_id)
        );
        return (
          <div className="space-y-1">
            {selectedOptions?.map((opt: any) => (
              <div
                key={opt.option_id}
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: opt.option_text }}
              />
            )) || <span className="text-gray-500 italic">Sin responder</span>}
          </div>
        );

      default:
        return <span className="text-gray-500">-</span>;
    }
  };

  const renderCorrectAnswer = (question: any) => {
    switch (question.question_type) {
      case 'true_false':
        return <span>{question.correct_answer ? 'Verdadero' : 'Falso'}</span>;

      case 'multiple_choice':
        const correctOption = question.options?.find((opt: any) => opt.is_correct);
        return (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: correctOption?.option_text || '-' }}
          />
        );

      case 'multiple_select':
        const correctOptions = question.options?.filter((opt: any) => opt.is_correct);
        return (
          <div className="space-y-1">
            {correctOptions?.map((opt: any) => (
              <div
                key={opt.option_id}
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: opt.option_text }}
              />
            ))}
          </div>
        );

      default:
        return <span className="text-gray-500">-</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Resultados del Examen</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-primary-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Calificación</p>
                <p className={`text-3xl font-bold ${getScoreColor()}`}>{score}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Correctas</p>
                <p className="text-3xl font-bold text-green-600">{correctCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Incorrectas</p>
                <p className="text-3xl font-bold text-red-600">{incorrectCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tiempo</p>
                <p className="text-3xl font-bold text-blue-600">{formatTime(elapsedTime)}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Detailed Results */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Revisión Detallada</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {results.map((result, index) => (
              <div key={result.question.question_id} className="p-6">
                <div className="flex items-start mb-4">
                  <div className="flex-shrink-0 mr-4">
                    {result.isCorrect ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="text-sm font-medium text-gray-600 mr-3">
                        Pregunta {index + 1}
                      </span>
                      <span className="inline-block px-2 py-1 text-xs font-medium text-primary-700 bg-primary-100 rounded">
                        {result.question.category_name}
                      </span>
                    </div>
                    
                    <div
                      className="prose prose-sm max-w-none mb-4"
                      dangerouslySetInnerHTML={{ __html: result.question.question_text }}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className={`p-4 rounded-lg ${result.isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                        <p className="text-sm font-medium text-gray-700 mb-2">Tu respuesta:</p>
                        <div className={result.isCorrect ? 'text-green-900' : 'text-red-900'}>
                          {renderUserAnswer(result)}
                        </div>
                      </div>

                      {!result.isCorrect && (
                        <div className="p-4 rounded-lg bg-green-50">
                          <p className="text-sm font-medium text-gray-700 mb-2">Respuesta correcta:</p>
                          <div className="text-green-900">
                            {renderCorrectAnswer(result.question)}
                          </div>
                        </div>
                      )}
                    </div>

                    {result.question.feedback && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-start">
                          <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-blue-900 mb-1">Retroalimentación:</p>
                            <div
                              className="text-sm text-blue-800 prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: result.question.feedback }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4 mt-8">
          <button
            onClick={() => navigate('/test-exams')}
            className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a la Lista
          </button>
          <button
            onClick={() => navigate(`/test-exams/${examId}/run`, {
              state: location.state
            })}
            className="px-6 py-3 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 flex items-center"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reintentar Examen
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamTestResultsPage;
