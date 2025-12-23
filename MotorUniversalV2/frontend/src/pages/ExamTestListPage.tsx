import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { examService } from '../services/examService';
import LoadingSpinner from '../components/LoadingSpinner';
import { Play, BookOpen, FileQuestion, ClipboardList } from 'lucide-react';

interface ExamConfigModalProps {
  examId: number;
  examTitle: string;
  totalQuestions: number;
  totalExercises: number;
  onClose: () => void;
  onStart: (questionCount: number, exerciseCount: number) => void;
}

const ExamConfigModal: React.FC<ExamConfigModalProps> = ({
  examTitle,
  totalQuestions,
  totalExercises,
  onClose,
  onStart
}) => {
  const [questionCount, setQuestionCount] = useState(totalQuestions);
  const [exerciseCount, setExerciseCount] = useState(totalExercises);

  const handleStart = () => {
    onStart(questionCount, exerciseCount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Configurar Prueba de Examen
        </h3>
        
        <p className="text-gray-600 mb-6">
          {examTitle}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad de Preguntas
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="1"
                max={totalQuestions}
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min="1"
                max={totalQuestions}
                value={questionCount}
                onChange={(e) => setQuestionCount(Math.min(totalQuestions, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Total disponible: {totalQuestions}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad de Ejercicios
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="0"
                max={totalExercises}
                value={exerciseCount}
                onChange={(e) => setExerciseCount(parseInt(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min="0"
                max={totalExercises}
                value={exerciseCount}
                onChange={(e) => setExerciseCount(Math.min(totalExercises, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Total disponible: {totalExercises}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleStart}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 flex items-center"
          >
            <Play className="w-4 h-4 mr-2" />
            Iniciar Prueba
          </button>
        </div>
      </div>
    </div>
  );
};

const ExamTestListPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedExam, setSelectedExam] = useState<{
    id: number;
    title: string;
    questionCount: number;
    exerciseCount: number;
  } | null>(null);

  const { data: examsData, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examService.getExams(1, 100)
  });

  // Filtrar solo exámenes publicados
  const exams = (examsData?.items || []).filter((exam: any) => exam.is_published);

  const handleTestExam = (examId: number, examTitle: string, questionCount: number, exerciseCount: number) => {
    setSelectedExam({
      id: examId,
      title: examTitle,
      questionCount,
      exerciseCount
    });
  };

  const handleStartTest = (questionCount: number, exerciseCount: number) => {
    if (selectedExam) {
      navigate(`/test-exams/${selectedExam.id}/run`, {
        state: {
          questionCount,
          exerciseCount
        }
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Play className="w-8 h-8 mr-3 text-primary-600" />
          Probar Exámenes
        </h1>
        <p className="mt-2 text-gray-600">
          Selecciona un examen para probarlo desde la perspectiva del alumno
        </p>
      </div>

      {exams && exams.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay exámenes publicados</h3>
          <p className="mt-1 text-sm text-gray-500">
            Los exámenes deben estar publicados para poder probarlos
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {exams?.map((exam: any) => {
            const totalQuestions = exam.total_questions || 0;
            const totalExercises = exam.total_exercises || 0;

            return (
              <div
                key={exam.id}
                className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
              >
                {/* Header con imagen */}
                {exam.image_url && (
                  <div className="-m-6 mb-4">
                    <img 
                      src={exam.image_url} 
                      alt={exam.name}
                      className="w-full h-32 object-cover rounded-t-lg"
                    />
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {exam.name}
                    </h3>
                    <p className="text-sm text-gray-500 font-mono">{exam.version}</p>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full whitespace-nowrap ml-2 bg-green-100 text-green-800">
                    Publicado
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 mb-4 pb-4 border-b">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">Puntaje: {exam.passing_score}%</span>
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{exam.duration_minutes || 0} min</span>
                  </div>
                  <div className="flex items-center">
                    <FileQuestion className="w-4 h-4 mr-2 text-gray-400" />
                    <span>{totalQuestions} preguntas</span>
                  </div>
                  <div className="flex items-center">
                    <ClipboardList className="w-4 h-4 mr-2 text-gray-400" />
                    <span>{totalExercises} ejercicios</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    <span className="font-medium">{exam.total_categories || 0} categoría{exam.total_categories !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleTestExam(exam.id, exam.name, totalQuestions, totalExercises)}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 flex items-center justify-center transition-colors"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Probar Examen
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedExam && (
        <ExamConfigModal
          examId={selectedExam.id}
          examTitle={selectedExam.title}
          totalQuestions={selectedExam.questionCount}
          totalExercises={selectedExam.exerciseCount}
          onClose={() => setSelectedExam(null)}
          onStart={handleStartTest}
        />
      )}
    </div>
  );
};

export default ExamTestListPage;
