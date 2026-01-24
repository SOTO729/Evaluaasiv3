import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { examService } from '../../services/examService';
import { OptimizedImage } from '../../components/ui/OptimizedImage';
import LoadingSpinner from '../../components/LoadingSpinner';
import { 
  FileText, 
  Clock, 
  Target, 
  Award, 
  HelpCircle, 
  Layers,
  ArrowLeft,
  Play,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  FlaskConical
} from 'lucide-react';

// Tipo extendido de examen para esta página
interface ExamWithMaterials {
  id: number;
  name: string;
  version: string;
  description?: string;
  instructions?: string;
  duration_minutes?: number;
  passing_score: number;
  image_url?: string;
  total_questions: number;
  total_exercises: number;
  categories?: { id: number; name: string; percentage?: number }[];
  competency_standard?: { id: number; code: string; name: string };
  linked_study_materials?: { id: number; title: string; description?: string; image_url?: string }[];
}

const ExamPreviewPage = () => {
  const { id, mode } = useParams<{ id: string; mode: 'exam' | 'simulator' }>();
  const navigate = useNavigate();
  
  // Determinar el modo (por defecto 'exam')
  const currentMode = mode === 'simulator' ? 'simulator' : 'exam';
  const isSimulator = currentMode === 'simulator';

  // Obtener datos del examen
  const { data: exam, isLoading } = useQuery<ExamWithMaterials>({
    queryKey: ['exam', id],
    queryFn: () => examService.getExam(Number(id), true) as Promise<ExamWithMaterials>,
    enabled: !!id,
  });

  const handleStartExam = () => {
    // Navegar al flujo de onboarding en lugar de directamente al examen
    navigate(`/exams/${id}/onboarding/${currentMode}`);
  };

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

  const hasLinkedMaterials = exam.linked_study_materials && exam.linked_study_materials.length > 0;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl 3xl:max-w-[2400px] 4xl:max-w-[2800px] mx-auto p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-12 3xl:p-14 4xl:p-16">
        {/* Botón volver */}
        <button
          onClick={() => navigate(`/exams/${id}/select-mode`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="font-medium text-sm sm:text-base">Cambiar modo</span>
        </button>

        {/* Badge de modo */}
        <div className="flex justify-center mb-4 sm:mb-6">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm sm:text-base ${
            isSimulator 
              ? 'bg-purple-100 text-purple-700 border border-purple-200' 
              : 'bg-blue-100 text-blue-700 border border-blue-200'
          }`}>
            {isSimulator ? (
              <>
                <FlaskConical className="w-4 h-4 sm:w-5 sm:h-5" />
                Modo Simulador
              </>
            ) : (
              <>
                <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                Modo Examen
              </>
            )}
          </div>
        </div>

      {/* Header del examen */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden border border-gray-100">
        {/* Imagen de cabecera */}
        <div className="relative h-36 sm:h-48 md:h-56 lg:h-64 bg-gradient-to-br from-blue-600 to-blue-800">
          {exam.image_url ? (
            <OptimizedImage
              src={exam.image_url}
              alt={exam.name}
              className="w-full h-full object-cover"
              fallbackIcon={<FileText className="h-20 w-20 text-white/50" />}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileText className="h-20 w-20 text-white/50" />
            </div>
          )}
          
          {/* Overlay con gradiente */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* Título sobre la imagen */}
          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 md:p-6">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 flex-wrap">
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-mono bg-white/20 text-white backdrop-blur-sm">
                v{exam.version}
              </span>
              {exam.competency_standard && (
                <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-blue-500/80 text-white backdrop-blur-sm">
                  {exam.competency_standard.code}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-4xl 2xl:text-5xl 3xl:text-6xl 4xl:text-7xl font-bold text-white line-clamp-2">{exam.name}</h1>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-3 sm:p-4 md:p-6">
          {/* Descripción */}
          {exam.description && (
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">{exam.description}</p>
          )}

          {/* Botón de iniciar - Arriba */}
          <div className="flex justify-center mb-4 sm:mb-6">
            <button
              onClick={handleStartExam}
              className={`flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-base sm:text-lg transition-all text-white shadow-lg hover:shadow-xl active:scale-95 ${
                isSimulator 
                  ? 'bg-purple-600 hover:bg-purple-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSimulator ? (
                <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <Play className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
              {isSimulator ? 'Iniciar Simulador' : 'Iniciar Examen'}
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
            <div className="bg-blue-50 rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 text-center">
              <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 mx-auto mb-1 sm:mb-2" />
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{exam.total_questions}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Preguntas</p>
            </div>
            <div className="bg-purple-50 rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 text-center">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 mx-auto mb-1 sm:mb-2" />
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{exam.total_exercises}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Ejercicios</p>
            </div>
            <div className="bg-slate-50 rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 text-center">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600 mx-auto mb-1 sm:mb-2" />
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{exam.duration_minutes || '--'}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Minutos</p>
            </div>
            <div className="bg-emerald-50 rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 text-center">
              <Award className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 mx-auto mb-1 sm:mb-2" />
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{exam.passing_score}%</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Mín. para aprobar</p>
            </div>
          </div>

          {/* Categorías */}
          {exam.categories && exam.categories.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Categorías del examen
              </h3>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {exam.categories.map((cat: any) => (
                  <span
                    key={cat.id}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-100 text-gray-700 rounded-md sm:rounded-lg text-xs sm:text-sm"
                  >
                    {cat.name}
                    {cat.percentage && (
                      <span className="ml-1 text-gray-400">({cat.percentage}%)</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Materiales de estudio relacionados (informativo) */}
          {hasLinkedMaterials && exam.linked_study_materials && (
            <div className="mb-4 sm:mb-6">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Material de estudio relacionado
              </h3>
              
              <div className="space-y-2 sm:space-y-3">
                {exam.linked_study_materials.map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl border bg-blue-50 border-blue-200 cursor-pointer hover:shadow-md transition-all"
                    onClick={() => navigate(`/study-contents/${material.id}`)}
                  >
                    {/* Icono */}
                    <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-blue-500">
                      <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    
                    {/* Info del material */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base text-blue-800 truncate">
                        {material.title}
                      </p>
                      <p className="text-xs text-blue-600">Haz clic para ver el material</p>
                    </div>
                    
                    {/* Acción */}
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instrucciones */}
          {exam.instructions && (
            <div className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1.5 sm:mb-2">
                Instrucciones
              </h3>
              <div 
                className="text-gray-600 text-xs sm:text-sm prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: exam.instructions }}
              />
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default ExamPreviewPage;
