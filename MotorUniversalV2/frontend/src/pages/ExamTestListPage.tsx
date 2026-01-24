import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { examService } from '../services/examService';
import { OptimizedImage } from '../components/ui/OptimizedImage';
import { 
  Play, 
  BookOpen, 
  FileQuestion, 
  ClipboardList, 
  X, 
  Settings, 
  Zap, 
  Target, 
  HelpCircle,
  Clock,
  Layers,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;
  const [selectedExam, setSelectedExam] = useState<{
    id: number;
    title: string;
    questionCount: number;
    exerciseCount: number;
  } | null>(null);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const { data: examsData, isLoading } = useQuery({
    queryKey: ['exams-test', currentPage, searchTerm],
    queryFn: () => examService.getExams(currentPage, ITEMS_PER_PAGE, searchTerm)
  });

  // Filtrar solo exámenes publicados (la paginación viene del servidor)
  const exams = (examsData?.exams || []).filter((exam: any) => exam.is_published);
  const totalPages = examsData?.pages || 1;
  const total = examsData?.total || 0;

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-12 3xl:p-14 4xl:p-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6 lg:mb-8 xl:mb-10">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-bold text-gray-800 flex items-center gap-2 lg:gap-3 xl:gap-4">
            <Play className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 xl:h-10 xl:w-10 2xl:h-12 2xl:w-12 text-emerald-600" />
            Probar Exámenes
          </h1>
          <p className="text-gray-600 mt-1 lg:mt-2 text-sm sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl">
            Selecciona un examen para probarlo
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg xl:rounded-xl shadow p-3 sm:p-4 lg:p-5 xl:p-6 2xl:p-8 mb-4 sm:mb-6 lg:mb-8">
        <div className="flex gap-2 sm:gap-4 lg:gap-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 sm:pl-10 lg:pl-12 xl:pl-14 pr-4 py-2 lg:py-3 xl:py-4 2xl:py-5 border border-gray-300 rounded-lg xl:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl"
            />
          </div>
          <button
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 sm:px-4 lg:px-6 xl:px-8 py-2 lg:py-3 xl:py-4 2xl:py-5 rounded-lg xl:rounded-xl transition-colors text-sm sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Exams Grid */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow p-8">
          <LoadingSpinner message="Cargando exámenes..." />
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No hay exámenes publicados</h3>
          <p className="text-gray-500">
            Los exámenes deben estar publicados para poder probarlos
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 gap-4 sm:gap-6 lg:gap-8 xl:gap-10">
            {exams.map((exam: any) => {
              const totalQuestions = exam.total_questions || 0;
              const totalExercises = exam.total_exercises || 0;

              return (
                <div
                  key={exam.id}
                  className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 group"
                >
                  {/* Card Image */}
                  <div 
                    className="relative h-32 sm:h-40 lg:h-44 xl:h-48 2xl:h-56 bg-gradient-to-br from-emerald-500 to-teal-600 cursor-pointer"
                    onClick={() => handleTestExam(exam.id, exam.name, totalQuestions, totalExercises)}
                  >
                    {exam.image_url ? (
                      <OptimizedImage
                        src={exam.image_url}
                        alt={exam.name}
                        className="w-full h-full object-cover"
                        fallbackIcon={<FileText className="h-12 w-12 sm:h-16 sm:w-16 text-white/50" />}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-white/50" />
                      </div>
                    )}
                    
                    {/* Version Badge */}
                    <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
                      <span className="px-2 py-1 rounded-full text-[10px] sm:text-xs font-mono bg-black/30 text-white">
                        {exam.version}
                      </span>
                    </div>

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <button
                        onClick={() => handleTestExam(exam.id, exam.name, totalQuestions, totalExercises)}
                        className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100 bg-white rounded-full p-3 sm:p-4 shadow-lg hover:shadow-xl"
                      >
                        <Play className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-600 ml-0.5 sm:ml-1" />
                      </button>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4">
                    <h3 
                      className="font-semibold text-gray-900 mb-2 line-clamp-1 cursor-pointer hover:text-emerald-600 transition-colors"
                      onClick={() => handleTestExam(exam.id, exam.name, totalQuestions, totalExercises)}
                    >
                      {exam.name}
                    </h3>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Target className="h-3.5 w-3.5 text-green-500" />
                        <span>{exam.passing_score}% aprobación</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-blue-500" />
                        <span>{exam.duration_minutes || 0} min</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileQuestion className="h-3.5 w-3.5 text-purple-500" />
                        <span>{totalQuestions} preguntas</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ClipboardList className="h-3.5 w-3.5 text-amber-500" />
                        <span>{totalExercises} ejercicios</span>
                      </div>
                    </div>
                    
                    {/* Card Footer */}
                    <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t">
                      <div className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" />
                        <span>{exam.total_categories || 0} categorías</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {new Date(exam.created_at).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 sm:mt-6 lg:mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-lg xl:rounded-xl shadow px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5">
              <p className="text-xs sm:text-sm lg:text-base xl:text-lg text-gray-600">
                {exams.length} de {total}
              </p>
              <div className="flex items-center gap-2 lg:gap-3">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 sm:p-2 lg:p-3 rounded-lg xl:rounded-xl border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
                </button>
                <span className="px-2 sm:px-3 lg:px-4 py-1 lg:py-2 text-xs sm:text-sm lg:text-base xl:text-lg">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 sm:p-2 lg:p-3 rounded-lg xl:rounded-xl border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
                </button>
              </div>
            </div>
          )}
        </>
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
