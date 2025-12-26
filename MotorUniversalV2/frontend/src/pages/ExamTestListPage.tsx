import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { examService } from '../services/examService';
import LoadingSpinner from '../components/LoadingSpinner';
import { Play, BookOpen, FileQuestion, ClipboardList, X, Settings, Zap, Target, HelpCircle } from 'lucide-react';

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

  // Presets rápidos
  const presets = [
    { label: 'Rápido', description: 'Solo preguntas', questions: Math.min(5, totalQuestions), exercises: 0, icon: Zap, color: 'amber' },
    { label: 'Práctico', description: 'Solo ejercicios', questions: 0, exercises: totalExercises, icon: ClipboardList, color: 'purple', hidden: totalExercises === 0 },
    { label: 'Completo', description: 'Todo incluido', questions: totalQuestions, exercises: totalExercises, icon: Target, color: 'green' },
  ].filter(p => !p.hidden);

  const handlePreset = (questions: number, exercises: number) => {
    setQuestionCount(questions);
    setExerciseCount(exercises);
  };

  // Calcular porcentaje para el slider visual
  const questionPercentage = totalQuestions > 0 ? (questionCount / totalQuestions) * 100 : 0;
  const exercisePercentage = totalExercises > 0 ? (exerciseCount / totalExercises) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-slide-up">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5 relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">
                Configurar Prueba
              </h3>
              <p className="text-primary-100 text-sm mt-0.5 line-clamp-1">
                {examTitle}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Presets rápidos */}
          <div className="mb-6">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Configuración rápida</p>
            <div className={`grid gap-3 ${presets.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {presets.map((preset) => {
                const Icon = preset.icon;
                const isActive = questionCount === preset.questions && exerciseCount === preset.exercises;
                return (
                  <button
                    key={preset.label}
                    onClick={() => handlePreset(preset.questions, preset.exercises)}
                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200 ${
                      isActive
                        ? `border-${preset.color}-500 bg-${preset.color}-50 shadow-md`
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg mb-2 ${
                      isActive ? `bg-${preset.color}-500` : 'bg-gray-100'
                    }`}>
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-semibold ${isActive ? `text-${preset.color}-700` : 'text-gray-700'}`}>
                        {preset.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divisor */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                O personaliza
              </span>
            </div>
          </div>

          {/* Configuración personalizada */}
          <div className="space-y-6">
            {/* Preguntas */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    <FileQuestion className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-800">
                      Preguntas
                    </label>
                    <p className="text-xs text-gray-500">
                      de {totalQuestions} disponibles
                    </p>
                  </div>
                </div>
                <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-sm">
                  <button
                    onClick={() => setQuestionCount(Math.max(0, questionCount - 1))}
                    className="px-3 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-l-lg transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    max={totalQuestions}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Math.min(totalQuestions, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-14 text-center font-bold text-gray-800 border-x border-gray-200 py-1.5 focus:outline-none"
                  />
                  <button
                    onClick={() => setQuestionCount(Math.min(totalQuestions, questionCount + 1))}
                    className="px-3 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-r-lg transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              {/* Slider visual */}
              <div className="relative">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${questionPercentage}%` }}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max={totalQuestions}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Ejercicios */}
            {totalExercises > 0 && (
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg mr-3">
                      <ClipboardList className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-800">
                        Ejercicios
                      </label>
                      <p className="text-xs text-gray-500">
                        de {totalExercises} disponibles
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-sm">
                    <button
                      onClick={() => setExerciseCount(Math.max(0, exerciseCount - 1))}
                      className="px-3 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-l-lg transition-colors"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      max={totalExercises}
                      value={exerciseCount}
                      onChange={(e) => setExerciseCount(Math.min(totalExercises, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-14 text-center font-bold text-gray-800 border-x border-gray-200 py-1.5 focus:outline-none"
                    />
                    <button
                      onClick={() => setExerciseCount(Math.min(totalExercises, exerciseCount + 1))}
                      className="px-3 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-r-lg transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
                {/* Slider visual */}
                <div className="relative">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-300"
                      style={{ width: `${exercisePercentage}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={totalExercises}
                    value={exerciseCount}
                    onChange={(e) => setExerciseCount(parseInt(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Resumen */}
          <div className="mt-6 p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl border border-primary-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-sm">
                <HelpCircle className="w-4 h-4 text-primary-500 mr-2" />
                <span className="text-gray-600">Tu prueba tendrá:</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold">
                  {questionCount} preguntas
                </span>
                {totalExercises > 0 && (
                  <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold">
                    {exerciseCount} ejercicios
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer con botones */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleStart}
            disabled={questionCount === 0 && exerciseCount === 0}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-lg shadow-primary-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary-500/30"
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
  const exams = (examsData?.exams || []).filter((exam: any) => exam.is_published);

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
