import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { examService } from '../../services/examService';
import { OptimizedImage } from '../../components/ui/OptimizedImage';
import LoadingSpinner from '../../components/LoadingSpinner';
import { 
  FileText, 
  ArrowLeft,
  ClipboardCheck,
  FlaskConical,
  Clock,
  Award,
  HelpCircle
} from 'lucide-react';

interface ExamData {
  id: number;
  name: string;
  version: string;
  description?: string;
  image_url?: string;
  duration_minutes?: number;
  passing_score: number;
  total_questions: number;
  total_exercises: number;
  exam_questions_count?: number;
  simulator_questions_count?: number;
  exam_exercises_count?: number;
  simulator_exercises_count?: number;
  has_exam_content?: boolean;
  has_simulator_content?: boolean;
}

const ExamModeSelectorPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Obtener datos del examen
  const { data: exam, isLoading } = useQuery<ExamData>({
    queryKey: ['exam', id],
    queryFn: () => examService.getExam(Number(id), true) as Promise<ExamData>,
    enabled: !!id,
  });

  const handleSelectMode = (mode: 'exam' | 'simulator') => {
    navigate(`/exams/${id}/preview/${mode}`);
  };

  // Determinar qué modos están disponibles
  const hasExamContent = exam?.has_exam_content ?? ((exam?.exam_questions_count || 0) + (exam?.exam_exercises_count || 0)) > 0;
  const hasSimulatorContent = exam?.has_simulator_content ?? ((exam?.simulator_questions_count || 0) + (exam?.simulator_exercises_count || 0)) > 0;
  const hasBothModes = hasExamContent && hasSimulatorContent;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner message="Cargando examen..." />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-gray-500">
        <FileText className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg">Examen no encontrado</p>
        <button
          onClick={() => navigate('/exams')}
          className="mt-4 text-blue-600 hover:text-blue-700 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a exámenes
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 2xl:px-12 py-4 sm:py-5 md:py-6 lg:py-8 xl:py-10">
        {/* Botón volver */}
        <button
          onClick={() => navigate('/exams')}
          className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-gray-900 mb-3 sm:mb-4 md:mb-5 lg:mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="font-medium text-xs sm:text-sm md:text-base">Volver a exámenes</span>
        </button>

        {/* Header del examen */}
        <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-md sm:shadow-lg overflow-hidden border border-gray-100 mb-4 sm:mb-5 md:mb-6 lg:mb-8">
          {/* Imagen de cabecera */}
          <div className="relative h-28 sm:h-32 md:h-40 lg:h-48 xl:h-52 2xl:h-56 bg-gradient-to-br from-blue-600 to-blue-800">
            {exam.image_url ? (
              <OptimizedImage
                src={exam.image_url}
                alt={exam.name}
                className="w-full h-full object-cover"
                fallbackIcon={<FileText className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 text-white/50" />}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 text-white/50" />
              </div>
            )}
            
            {/* Overlay con gradiente más oscuro para mejor contraste */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
            
            {/* Título sobre la imagen - Con más énfasis */}
            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 md:p-5 lg:p-6 xl:p-8">
              <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] md:text-xs font-mono bg-white/20 text-white backdrop-blur-sm mb-2 sm:mb-3 inline-block">
                v{exam.version}
              </span>
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-extrabold text-white drop-shadow-lg leading-tight">{exam.name}</h1>
            </div>
          </div>

          {/* Stats compactos - Tiempo y calificación mínima en horizontal */}
          <div className="px-3 sm:px-4 md:px-5 lg:px-6 py-2.5 sm:py-3 md:py-4 bg-gray-50/50">
            <div className="flex items-center justify-center gap-4 sm:gap-6 md:gap-8 lg:gap-10">
              <div className="flex items-center gap-1.5 sm:gap-2 text-gray-700">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                <span className="text-xs sm:text-sm md:text-base"><strong className="text-gray-900">{exam.duration_minutes || '--'}</strong> min</span>
              </div>
              <div className="w-px h-4 sm:h-5 bg-gray-300" />
              <div className="flex items-center gap-1.5 sm:gap-2 text-gray-700">
                <Award className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                <span className="text-xs sm:text-sm md:text-base"><strong className="text-gray-900">{exam.passing_score}%</strong> para aprobar</span>
              </div>
            </div>
          </div>
        </div>

        {/* Título de selección */}
        <div className="text-center mb-4 sm:mb-5 md:mb-6 lg:mb-8">
          <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">
            Selecciona una opción
          </h2>
          <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-600">
            ¿Deseas practicar o presentar tu evaluación oficial?
          </p>
        </div>

        {/* Botones de selección */}
        <div className={`grid gap-3 sm:gap-4 md:gap-5 lg:gap-6 ${hasBothModes ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-md mx-auto'}`}>
          {/* Opción Examen - Solo mostrar si hay contenido de examen */}
          {hasExamContent && (
          <button
            onClick={() => handleSelectMode('exam')}
            className="group bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-md sm:shadow-lg border-2 border-transparent hover:border-blue-500 p-4 sm:p-5 md:p-6 lg:p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98]"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 xl:w-28 xl:h-28 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mb-3 sm:mb-4 md:mb-5 lg:mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <ClipboardCheck className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 text-white" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-800 mb-1.5 sm:mb-2 md:mb-3">
                Examen Oficial
              </h3>
              <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-3 sm:mb-4 leading-relaxed">
                Evaluación oficial para obtener tu certificación. Los resultados serán registrados.
              </p>
              <div className="flex items-center gap-1.5 sm:gap-2 text-blue-600 font-medium">
                <span className="text-xs sm:text-sm md:text-base">Presentar examen</span>
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 rotate-180" />
              </div>
            </div>
          </button>
          )}

          {/* Opción Simulador - Solo mostrar si hay contenido de simulador */}
          {hasSimulatorContent && (
          <button
            onClick={() => handleSelectMode('simulator')}
            className="group bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-md sm:shadow-lg border-2 border-transparent hover:border-purple-500 p-4 sm:p-5 md:p-6 lg:p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98]"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 xl:w-28 xl:h-28 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center mb-3 sm:mb-4 md:mb-5 lg:mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <FlaskConical className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 text-white" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-800 mb-1.5 sm:mb-2 md:mb-3">
                Simulador
              </h3>
              <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-3 sm:mb-4 leading-relaxed">
                Practica y prepárate con ejercicios de entrenamiento. No afecta tu calificación oficial.
              </p>
              <div className="flex items-center gap-1.5 sm:gap-2 text-purple-600 font-medium">
                <span className="text-xs sm:text-sm md:text-base">Practicar</span>
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 rotate-180" />
              </div>
            </div>
          </button>
          )}
        </div>

        {/* Mensaje si no hay contenido */}
        {!hasExamContent && !hasSimulatorContent && (
          <div className="bg-amber-50 rounded-lg sm:rounded-xl p-4 sm:p-6 border border-amber-200 text-center">
            <p className="text-amber-800 text-sm sm:text-base">
              Este examen aún no tiene preguntas ni ejercicios configurados.
            </p>
          </div>
        )}

        {/* Información adicional - Solo mostrar si hay ambos modos */}
        {hasBothModes && (
        <div className="mt-4 sm:mt-5 md:mt-6 lg:mt-8 bg-blue-50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 lg:p-6 border border-blue-100">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <HelpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-800 mb-0.5 sm:mb-1 text-xs sm:text-sm md:text-base">¿Cuál es la diferencia?</h4>
              <ul className="text-[10px] sm:text-xs md:text-sm text-gray-600 space-y-0.5 sm:space-y-1">
                <li><strong className="text-blue-700">Examen Oficial:</strong> Si apruebas, obtienes tu certificación. Es la evaluación real y definitiva.</li>
                <li><strong className="text-purple-700">Simulador:</strong> Modo de práctica para prepararte antes del examen oficial. Sin presión ni registro.</li>
              </ul>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default ExamModeSelectorPage;
