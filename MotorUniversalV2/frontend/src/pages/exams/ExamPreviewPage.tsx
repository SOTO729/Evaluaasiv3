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
        <FileText className="fluid-icon-xl fluid-mb-4 text-gray-300" />
        <p className="fluid-text-lg">Examen no encontrado</p>
        <button
          onClick={() => navigate('/exams')}
          className="fluid-mt-4 text-blue-600 hover:text-blue-700 flex items-center fluid-gap-2"
        >
          <ArrowLeft className="fluid-icon-sm" />
          Volver a exámenes
        </button>
      </div>
    );
  }

  const hasLinkedMaterials = exam.linked_study_materials && exam.linked_study_materials.length > 0;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="w-full fluid-px-6 fluid-py-6">
        {/* Botón volver */}
        <button
          onClick={() => navigate(`/exams/${id}/select-mode`)}
          className="flex items-center fluid-gap-2 text-gray-600 hover:text-gray-900 fluid-mb-6 transition-colors"
        >
          <ArrowLeft className="fluid-icon-sm" />
          <span className="font-medium fluid-text-sm">Cambiar modo</span>
        </button>

        {/* Badge de modo */}
        <div className="flex justify-center fluid-mb-6">
          <div className={`inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-full font-semibold fluid-text-sm ${
            isSimulator 
              ? 'bg-purple-100 text-purple-700 border border-purple-200' 
              : 'bg-blue-100 text-blue-700 border border-blue-200'
          }`}>
            {isSimulator ? (
              <>
                <FlaskConical className="fluid-icon-sm" />
                Modo Simulador
              </>
            ) : (
              <>
                <ClipboardCheck className="fluid-icon-sm" />
                Modo Examen
              </>
            )}
          </div>
        </div>

      {/* Header del examen */}
      <div className="bg-white rounded-fluid-xl shadow-lg overflow-hidden border border-gray-100">
        {/* Imagen de cabecera */}
        <div className="relative h-36 sm:h-48 md:h-56 lg:h-64 bg-gradient-to-br from-blue-600 to-blue-800">
          {exam.image_url ? (
            <OptimizedImage
              src={exam.image_url}
              alt={exam.name}
              className="w-full h-full object-cover"
              fallbackIcon={<FileText className="fluid-icon-xl text-white/50" />}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileText className="fluid-icon-xl text-white/50" />
            </div>
          )}
          
          {/* Overlay con gradiente */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* Título sobre la imagen */}
          <div className="absolute bottom-0 left-0 right-0 fluid-p-4">
            <div className="flex items-center fluid-gap-2 fluid-mb-2 flex-wrap">
              <span className="fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-mono bg-white/20 text-white backdrop-blur-sm">
                v{exam.version}
              </span>
              {exam.competency_standard && (
                <span className="fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-medium bg-blue-500/80 text-white backdrop-blur-sm">
                  {exam.competency_standard.code}
                </span>
              )}
            </div>
            <h1 className="fluid-text-3xl font-bold text-white line-clamp-2">{exam.name}</h1>
          </div>
        </div>

        {/* Contenido */}
        <div className="fluid-p-4">
          {/* Descripción */}
          {exam.description && (
            <p className="fluid-text-sm text-gray-600 fluid-mb-6">{exam.description}</p>
          )}

          {/* Botón de iniciar - Arriba */}
          <div className="flex justify-center fluid-mb-6">
            <button
              onClick={handleStartExam}
              className={`flex items-center fluid-gap-3 fluid-px-8 fluid-py-4 rounded-fluid-lg font-semibold fluid-text-base transition-all text-white shadow-lg hover:shadow-xl active:scale-95 ${
                isSimulator 
                  ? 'bg-purple-600 hover:bg-purple-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSimulator ? (
                <FlaskConical className="fluid-icon" />
              ) : (
                <Play className="fluid-icon" />
              )}
              {isSimulator ? 'Iniciar Simulador' : 'Iniciar Examen'}
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 fluid-gap-3 fluid-mb-6">
            <div className="bg-blue-50 rounded-fluid-lg fluid-p-3 text-center">
              <HelpCircle className="fluid-icon text-blue-600 mx-auto fluid-mb-2" />
              <p className="fluid-text-xl font-bold text-gray-900">{exam.total_questions}</p>
              <p className="fluid-text-xs text-gray-500">Preguntas</p>
            </div>
            <div className="bg-purple-50 rounded-fluid-lg fluid-p-3 text-center">
              <Target className="fluid-icon text-purple-600 mx-auto fluid-mb-2" />
              <p className="fluid-text-xl font-bold text-gray-900">{exam.total_exercises}</p>
              <p className="fluid-text-xs text-gray-500">Ejercicios</p>
            </div>
            <div className="bg-slate-50 rounded-fluid-lg fluid-p-3 text-center">
              <Clock className="fluid-icon text-slate-600 mx-auto fluid-mb-2" />
              <p className="fluid-text-xl font-bold text-gray-900">{exam.duration_minutes || '--'}</p>
              <p className="fluid-text-xs text-gray-500">Minutos</p>
            </div>
            <div className="bg-emerald-50 rounded-fluid-lg fluid-p-3 text-center">
              <Award className="fluid-icon text-emerald-600 mx-auto fluid-mb-2" />
              <p className="fluid-text-xl font-bold text-gray-900">{exam.passing_score}%</p>
              <p className="fluid-text-xs text-gray-500">Mín. para aprobar</p>
            </div>
          </div>

          {/* Categorías */}
          {exam.categories && exam.categories.length > 0 && (
            <div className="fluid-mb-6">
              <h3 className="fluid-text-xs font-semibold text-gray-700 uppercase tracking-wide fluid-mb-3 flex items-center fluid-gap-2">
                <Layers className="fluid-icon-sm" />
                Categorías del examen
              </h3>
              <div className="flex flex-wrap fluid-gap-2">
                {exam.categories.map((cat: any) => (
                  <span
                    key={cat.id}
                    className="fluid-px-3 fluid-py-1 bg-gray-100 text-gray-700 rounded-fluid-md fluid-text-xs"
                  >
                    {cat.name}
                    {cat.percentage && (
                      <span className="fluid-ml-1 text-gray-400">({cat.percentage}%)</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Materiales de estudio relacionados (informativo) */}
          {hasLinkedMaterials && exam.linked_study_materials && (
            <div className="fluid-mb-6">
              <h3 className="fluid-text-xs font-semibold text-gray-700 uppercase tracking-wide fluid-mb-3 flex items-center fluid-gap-2">
                <BookOpen className="fluid-icon-sm" />
                Material de estudio relacionado
              </h3>
              
              <div className="flex flex-col fluid-gap-3">
                {exam.linked_study_materials.map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center fluid-gap-4 fluid-p-4 rounded-fluid-lg border bg-blue-50 border-blue-200 cursor-pointer hover:shadow-md transition-all"
                    onClick={() => navigate(`/study-contents/${material.id}`)}
                  >
                    {/* Icono */}
                    <div className="flex-shrink-0 fluid-icon-lg rounded-full flex items-center justify-center bg-blue-500">
                      <BookOpen className="fluid-icon-sm text-white" />
                    </div>
                    
                    {/* Info del material */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium fluid-text-sm text-blue-800 truncate">
                        {material.title}
                      </p>
                      <p className="fluid-text-xs text-blue-600">Haz clic para ver el material</p>
                    </div>
                    
                    {/* Acción */}
                    <ChevronRight className="fluid-icon-sm text-blue-500 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instrucciones */}
          {exam.instructions && (
            <div className="bg-gray-50 rounded-fluid-lg fluid-p-4">
              <h3 className="fluid-text-xs font-semibold text-gray-700 uppercase tracking-wide fluid-mb-2">
                Instrucciones
              </h3>
              <div 
                className="text-gray-600 fluid-text-xs prose prose-sm max-w-none"
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
