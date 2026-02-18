import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  HelpCircle,
  ShieldAlert,
  DollarSign,
  RotateCcw
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

interface AccessData {
  can_take: boolean;
  max_attempts: number;
  retakes_total: number;
  total_allowed: number;
  attempts_used: number;
  attempts_remaining: number;
  attempts_exhausted: boolean;
  retake_cost: number;
}

const ExamModeSelectorPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupExamId = searchParams.get('geid');
  const groupQueryString = ['gid', 'geid'].filter(k => searchParams.get(k)).map(k => `${k}=${searchParams.get(k)}`).join('&');

  // Obtener datos del examen
  const { data: exam, isLoading } = useQuery<ExamData>({
    queryKey: ['exam', id],
    queryFn: () => examService.getExam(Number(id), true) as Promise<ExamData>,
    enabled: !!id,
  });

  // Verificar acceso (intentos restantes)
  const { data: access, isLoading: accessLoading } = useQuery<AccessData>({
    queryKey: ['exam-access', id, groupExamId],
    queryFn: () => examService.checkExamAccess(Number(id), Number(groupExamId)),
    enabled: !!id && !!groupExamId,
    retry: false,
  });

  const handleSelectMode = (mode: 'exam' | 'simulator') => {
    // Bloquear solo examen oficial si no hay intentos
    if (mode === 'exam' && access?.attempts_exhausted) return;
    // Navegar directamente al onboarding (flujo de inicio)
    navigate(`/exams/${id}/onboarding/${mode}${groupQueryString ? '?' + groupQueryString : ''}`);
  };

  // Determinar qué modos están disponibles
  const hasExamContent = exam?.has_exam_content ?? ((exam?.exam_questions_count || 0) + (exam?.exam_exercises_count || 0)) > 0;
  const hasSimulatorContent = exam?.has_simulator_content ?? ((exam?.simulator_questions_count || 0) + (exam?.simulator_exercises_count || 0)) > 0;
  const hasBothModes = hasExamContent && hasSimulatorContent;

  if (isLoading || accessLoading) {
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

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="w-full fluid-px-6 fluid-py-6">
        {/* Botón volver */}
        <button
          onClick={() => navigate('/exams')}
          className="flex items-center fluid-gap-2 text-gray-600 hover:text-gray-900 fluid-mb-4 transition-colors"
        >
          <ArrowLeft className="fluid-icon-sm" />
          <span className="font-medium fluid-text-sm">Volver a exámenes</span>
        </button>

        {/* Header del examen */}
        <div className="bg-white rounded-fluid-xl shadow-lg overflow-hidden border border-gray-100 fluid-mb-6">
          {/* Imagen de cabecera */}
          <div className="relative fluid-h-48 bg-gradient-to-br from-blue-600 to-blue-800">
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
            
            {/* Overlay con gradiente más oscuro para mejor contraste */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
            
            {/* Título sobre la imagen - Con más énfasis */}
            <div className="absolute bottom-0 left-0 right-0 fluid-p-4">
              <span className="fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-mono bg-white/20 text-white  fluid-mb-2 inline-block">
                v{exam.version}
              </span>
              <h1 className="fluid-text-3xl font-extrabold text-white drop-shadow-lg leading-tight">{exam.name}</h1>
            </div>
          </div>

          {/* Stats compactos - Tiempo y calificación mínima en horizontal */}
          <div className="fluid-px-4 fluid-py-3 bg-gray-50/50">
            <div className="flex items-center justify-center fluid-gap-6">
              <div className="flex items-center fluid-gap-2 text-gray-700">
                <Clock className="fluid-icon-sm text-blue-500" />
                <span className="fluid-text-sm"><strong className="text-gray-900">{exam.duration_minutes || '--'}</strong> min</span>
              </div>
              <div className="w-px fluid-h-5 bg-gray-300" />
              <div className="flex items-center fluid-gap-2 text-gray-700">
                <Award className="fluid-icon-sm text-emerald-500" />
                <span className="fluid-text-sm"><strong className="text-gray-900">{exam.passing_score}%</strong> para aprobar</span>
              </div>
            </div>
          </div>
        </div>

        {/* Alerta de intentos agotados */}
        {access?.attempts_exhausted && (
          <div className="bg-red-50 rounded-fluid-xl shadow-lg border-2 border-red-200 fluid-p-6 fluid-mb-6">
            <div className="flex flex-col items-center text-center fluid-gap-4">
              <div className="fluid-w-16 fluid-h-16 rounded-full bg-red-100 flex items-center justify-center">
                <ShieldAlert className="fluid-icon-xl text-red-500" />
              </div>
              <div>
                <h3 className="fluid-text-xl font-bold text-red-800 fluid-mb-2">
                  Intentos agotados
                </h3>
                <p className="fluid-text-base text-red-700 fluid-mb-1">
                  Has utilizado todos tus intentos disponibles para el <strong>Examen Oficial</strong>.
                </p>
                <p className="fluid-text-sm text-red-600">
                  Intentos utilizados: <strong>{access.attempts_used}</strong> de <strong>{access.total_allowed}</strong>
                </p>
              </div>
              <div className="w-full max-w-sm bg-white rounded-fluid-lg fluid-p-4 border border-red-100">
                <div className="flex items-center justify-center fluid-gap-2 fluid-mb-2">
                  <RotateCcw className="fluid-icon-sm text-orange-500" />
                  <span className="font-semibold text-gray-800 fluid-text-base">Solicitar Retoma</span>
                </div>
                <p className="fluid-text-sm text-gray-600 fluid-mb-3">
                  Contacta a tu coordinador para solicitar una retoma del examen.
                </p>
                {access.retake_cost > 0 && (
                  <div className="flex items-center justify-center fluid-gap-1 bg-orange-50 rounded-fluid fluid-py-2 fluid-px-3 border border-orange-200">
                    <DollarSign className="fluid-icon-sm text-orange-600" />
                    <span className="font-bold text-orange-700 fluid-text-lg">
                      ${access.retake_cost.toFixed(2)} MXN
                    </span>
                  </div>
                )}
                {access.retake_cost === 0 && (
                  <div className="flex items-center justify-center fluid-gap-1 bg-green-50 rounded-fluid fluid-py-2 fluid-px-3 border border-green-200">
                    <span className="font-medium text-green-700 fluid-text-sm">
                      Retoma sin costo adicional
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info de intentos restantes (cuando quedan pocos) */}
        {access && !access.attempts_exhausted && access.attempts_remaining <= 2 && access.attempts_remaining > 0 && (
          <div className="bg-amber-50 rounded-fluid-lg fluid-p-3 border border-amber-200 fluid-mb-4">
            <div className="flex items-center fluid-gap-2 justify-center">
              <ShieldAlert className="fluid-icon-sm text-amber-600" />
              <span className="fluid-text-sm text-amber-800">
                Te {access.attempts_remaining === 1 ? 'queda' : 'quedan'} <strong>{access.attempts_remaining}</strong> {access.attempts_remaining === 1 ? 'intento' : 'intentos'} para el examen oficial
              </span>
            </div>
          </div>
        )}

        {/* Título de selección */}
        <div className="text-center fluid-mb-6">
          <h2 className="fluid-text-2xl font-bold text-gray-800 fluid-mb-2">
            Selecciona una opción
          </h2>
          <p className="fluid-text-base text-gray-600">
            ¿Deseas practicar o presentar tu evaluación oficial?
          </p>
        </div>

        {/* Botones de selección */}
        <div className={`grid fluid-gap-4 ${hasBothModes ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-md mx-auto'}`}>
          {/* Opción Examen - Solo mostrar si hay contenido de examen */}
          {hasExamContent && (
          <button
            onClick={() => handleSelectMode('exam')}
            disabled={access?.attempts_exhausted}
            className={`group bg-white rounded-fluid-xl shadow-lg border-2 border-transparent fluid-p-6 transition-all duration-300 active:scale-[0.98] ${
              access?.attempts_exhausted
                ? 'opacity-50 cursor-not-allowed grayscale'
                : 'hover:border-blue-500 hover:shadow-xl hover:-translate-y-1'
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <div className="fluid-w-20 fluid-h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center fluid-mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <ClipboardCheck className="fluid-icon-xl text-white" />
              </div>
              <h3 className="fluid-text-xl font-bold text-gray-800 fluid-mb-2">
                Examen Oficial
              </h3>
              <p className="fluid-text-sm text-gray-600 fluid-mb-4 leading-relaxed">
                Evaluación oficial para obtener tu certificación. Los resultados serán registrados.
              </p>
              <div className="flex items-center fluid-gap-2 text-blue-600 font-medium">
                <span className="fluid-text-sm">Presentar examen</span>
                <ArrowLeft className="fluid-icon-sm rotate-180" />
              </div>
            </div>
          </button>
          )}

          {/* Opción Simulador - Solo mostrar si hay contenido de simulador */}
          {hasSimulatorContent && (
          <button
            onClick={() => handleSelectMode('simulator')}
            className="group bg-white rounded-fluid-xl shadow-lg border-2 border-transparent hover:border-purple-500 fluid-p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98]"
          >
            <div className="flex flex-col items-center text-center">
              <div className="fluid-w-20 fluid-h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center fluid-mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <FlaskConical className="fluid-icon-xl text-white" />
              </div>
              <h3 className="fluid-text-xl font-bold text-gray-800 fluid-mb-2">
                Simulador
              </h3>
              <p className="fluid-text-sm text-gray-600 fluid-mb-4 leading-relaxed">
                Practica y prepárate con ejercicios de entrenamiento. No afecta tu calificación oficial.
              </p>
              <div className="flex items-center fluid-gap-2 text-purple-600 font-medium">
                <span className="fluid-text-sm">Practicar</span>
                <ArrowLeft className="fluid-icon-sm rotate-180" />
              </div>
            </div>
          </button>
          )}
        </div>

        {/* Mensaje si no hay contenido */}
        {!hasExamContent && !hasSimulatorContent && (
          <div className="bg-amber-50 rounded-fluid-lg fluid-p-4 border border-amber-200 text-center">
            <p className="text-amber-800 fluid-text-sm">
              Este examen aún no tiene preguntas ni ejercicios configurados.
            </p>
          </div>
        )}

        {/* Información adicional - Solo mostrar si hay ambos modos */}
        {hasBothModes && (
        <div className="fluid-mt-6 bg-blue-50 rounded-fluid-lg fluid-p-4 border border-blue-100">
          <div className="flex items-start fluid-gap-3">
            <div className="flex-shrink-0 fluid-w-8 fluid-h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <HelpCircle className="fluid-icon-sm text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-800 fluid-mb-1 fluid-text-sm">¿Cuál es la diferencia?</h4>
              <ul className="fluid-text-xs text-gray-600 flex flex-col fluid-gap-1">
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
