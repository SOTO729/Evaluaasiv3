import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { examService } from '../../services/examService';
import LoadingSpinner from '../../components/LoadingSpinner';
import { 
  FileText, 
  ArrowLeft,
  ArrowRight,
  Clock,
  Target,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  Play,
  ClipboardCheck,
  FlaskConical,
  BookOpen,
  MousePointer,
  Move,
  CheckSquare,
  ToggleLeft,
  ListOrdered,
  Info,
  ChevronDown
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
}

const ExamOnboardingPage = () => {
  const { id, mode } = useParams<{ id: string; mode: 'exam' | 'simulator' }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('gid') ? Number(searchParams.get('gid')) : undefined;
  const groupExamId = searchParams.get('geid') ? Number(searchParams.get('geid')) : undefined;
  const [currentStep, setCurrentStep] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right'>('right');
  const contentRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);

  const currentMode = mode === 'simulator' ? 'simulator' : 'exam';
  const isSimulator = currentMode === 'simulator';

  // Obtener datos del examen
  const { data: exam, isLoading } = useQuery<ExamData>({
    queryKey: ['exam', id],
    queryFn: () => examService.getExam(Number(id), true) as Promise<ExamData>,
    enabled: !!id,
  });

  // Calcular el total de elementos según el modo
  const getTotalItems = () => {
    if (!exam) return { questions: 0, exercises: 0, total: 0 };
    
    if (isSimulator) {
      const questions = exam.simulator_questions_count || 0;
      const exercises = exam.simulator_exercises_count || 0;
      return { questions, exercises, total: questions + exercises };
    } else {
      const questions = exam.exam_questions_count || exam.total_questions || 0;
      const exercises = exam.exam_exercises_count || exam.total_exercises || 0;
      return { questions, exercises, total: questions + exercises };
    }
  };

  const { total: totalItems } = getTotalItems();

  // Detectar si los botones son visibles usando Intersection Observer
  useEffect(() => {
    if (!buttonsRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Mostrar el hint si los botones NO son completamente visibles
          setShowScrollHint(!entry.isIntersecting);
        });
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.8 // Los botones deben estar al menos 80% visibles
      }
    );

    observer.observe(buttonsRef.current);

    return () => {
      observer.disconnect();
    };
  }, [currentStep, exam]);

  // Verificar scroll al cambiar de paso o cargar
  const checkScrollNeeded = useCallback(() => {
    if (!contentRef.current) return;
    
    const container = contentRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Mostrar hint si hay más de 50px de contenido por scrollear
    const hasMoreContent = scrollHeight - scrollTop - clientHeight > 50;
    setShowScrollHint(hasMoreContent);
  }, []);

  // Verificar scroll al cambiar de paso o cargar
  useEffect(() => {
    // Pequeño delay para que el DOM se actualice
    const timer = setTimeout(() => {
      checkScrollNeeded();
    }, 100);
    return () => clearTimeout(timer);
  }, [currentStep, exam, checkScrollNeeded]);

  // Scroll hacia abajo hasta los botones
  const handleScrollDown = () => {
    if (buttonsRef.current) {
      buttonsRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      // Volver a la selección de modo
      navigate(`/exams/${id}/select-mode`);
    } else {
      setAnimationDirection('left');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(prev => prev - 1);
        // Scroll hacia arriba al cambiar de paso
        if (contentRef.current) {
          contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        setTimeout(() => setIsAnimating(false), 50);
      }, 150);
    }
  };

  const handleNext = () => {
    if (currentStep < 2) {
      setAnimationDirection('right');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        // Scroll hacia arriba al cambiar de paso
        if (contentRef.current) {
          contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        setTimeout(() => setIsAnimating(false), 50);
      }, 150);
    }
  };

  const handleStartExam = () => {
    navigate(`/test-exams/${id}/run`, {
      state: {
        questionCount: exam?.total_questions || 0,
        exerciseCount: exam?.total_exercises || 0,
        mode: currentMode,
        groupId,
        groupExamId
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner message="Cargando..." />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-500 bg-gray-50">
        <FileText className="fluid-icon-2xl fluid-mb-4 text-gray-300" />
        <p className="fluid-text-lg">Examen no encontrado</p>
        <button
          onClick={() => navigate('/exams')}
          className="fluid-mt-4 text-blue-600 hover:text-blue-700 flex items-center fluid-gap-2"
        >
          <ArrowLeft className="fluid-icon-xs" />
          Volver a exámenes
        </button>
      </div>
    );
  }

  // Colores según el modo
  const bgGradient = isSimulator 
    ? 'from-violet-500 to-violet-700' 
    : 'from-blue-500 to-blue-700';
  const textColor = isSimulator ? 'text-violet-600' : 'text-blue-600';
  const bgLight = isSimulator ? 'bg-violet-50' : 'bg-blue-50';
  const borderColor = isSimulator ? 'border-violet-200' : 'border-blue-200';

  // Renderizar el contenido del paso actual
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="text-center">
            {/* Icono principal */}
            <div className={`fluid-icon-2xl mx-auto fluid-mb-6 rounded-full bg-gradient-to-br ${bgGradient} flex items-center justify-center shadow-xl`}>
              {isSimulator ? (
                <FlaskConical className="fluid-icon-xl text-white" />
              ) : (
                <ClipboardCheck className="fluid-icon-xl text-white" />
              )}
            </div>

            {/* Título */}
            <h1 className="fluid-text-3xl font-bold text-gray-800 fluid-mb-3">
              Estás a punto de comenzar
            </h1>
            <h2 className={`fluid-text-2xl font-bold ${textColor} fluid-mb-6`}>
              {isSimulator ? <>una prueba de <strong>simulación</strong></> : <>tu <strong>examen</strong> de certificación</>}
            </h2>

            {/* Nombre del examen */}
            <div className={`${bgLight} rounded-fluid-xl fluid-p-6 fluid-mb-6 border ${borderColor}`}>
              <p className="fluid-text-lg font-semibold text-gray-800 fluid-mb-1">
                {exam.name}
              </p>
              <p className="fluid-text-sm text-gray-500">Versión {exam.version}</p>
            </div>

            {/* Info de ejercicios y tiempo */}
            <div className="flex flex-row justify-center fluid-gap-10 fluid-mb-6">
              <div className="flex items-center fluid-gap-4">
                <div className={`fluid-icon-xl rounded-full ${bgLight} flex items-center justify-center`}>
                  <Target className={`fluid-icon-sm ${textColor}`} />
                </div>
                <div className="text-left">
                  <p className="fluid-text-3xl font-bold text-gray-800">{totalItems}</p>
                  <p className="fluid-text-sm text-gray-500">ejercicios</p>
                </div>
              </div>
              <div className="flex items-center fluid-gap-4">
                <div className={`fluid-icon-xl rounded-full ${bgLight} flex items-center justify-center`}>
                  <Clock className={`fluid-icon-sm ${textColor}`} />
                </div>
                <div className="text-left">
                  <p className="fluid-text-3xl font-bold text-gray-800">{exam.duration_minutes || '--'}</p>
                  <p className="fluid-text-sm text-gray-500">minutos</p>
                </div>
              </div>
            </div>

            {/* Mensaje principal */}
            <div className={`${bgLight} rounded-fluid-xl fluid-p-6 border ${borderColor} text-left flex flex-col fluid-gap-4`}>
              {isSimulator ? (
                <>
                  <p className="fluid-text-base text-gray-700 leading-relaxed">
                    Al finalizar el <strong>simulador</strong> podrás generar el reporte el cual te indicará si has alcanzado 
                    el nivel para presentar tu <strong>examen</strong> de certificación.
                  </p>
                  <p className="fluid-text-base text-gray-700 leading-relaxed">
                    Para continuar haz clic en <strong>SIGUIENTE</strong>. Para suspender haz clic en <strong>ATRÁS</strong>.
                  </p>
                </>
              ) : (
                <>
                  <p className="fluid-text-base text-gray-700 leading-relaxed">
                    Esta es una evaluación oficial. Al aprobar obtendrás tu certificación.
                    Los resultados serán registrados permanentemente.
                  </p>
                  <p className="fluid-text-base text-gray-700 leading-relaxed">
                    Para continuar haz clic en <strong>SIGUIENTE</strong>. Para regresar haz clic en <strong>ATRÁS</strong>.
                  </p>
                </>
              )}
            </div>

            {/* Mensaje de éxito */}
            <div className={`fluid-mt-6 inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-3 rounded-full ${bgLight} ${textColor} font-semibold fluid-text-base`}>
              <CheckCircle2 className="fluid-icon-sm" />
              ¡Éxito!
            </div>
          </div>
        );

      case 1:
        return (
          <div>
            {/* Título */}
            <div className="text-center fluid-mb-6">
              <div className={`fluid-icon-xl mx-auto fluid-mb-4 rounded-full ${bgLight} flex items-center justify-center`}>
                <BookOpen className={`fluid-icon-sm ${textColor}`} />
              </div>
              <h1 className="fluid-text-2xl font-bold text-gray-800 fluid-mb-2">
                Instrucciones
              </h1>
              <p className="fluid-text-base text-gray-600">
                Lee cómo funciona {isSimulator ? <>el <strong>simulador</strong></> : <>el <strong>examen</strong></>}
              </p>
            </div>

            {/* Instrucciones de preguntas */}
            <div className={`${bgLight} rounded-fluid-xl fluid-p-6 border ${borderColor} fluid-mb-6`}>
              <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
                <Info className={`fluid-icon-sm ${textColor}`} />
                Tipos de preguntas
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 fluid-gap-4">
                <div className="flex items-center fluid-gap-4 fluid-p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="fluid-icon-lg rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <ToggleLeft className="fluid-icon-sm text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-800 fluid-text-base">Verdadero / Falso</h4>
                    <p className="fluid-text-sm text-gray-500">Indica si es verdadero o falso</p>
                  </div>
                </div>

                <div className="flex items-center fluid-gap-4 fluid-p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="fluid-icon-lg rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="fluid-icon-sm text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-800 fluid-text-base">Opción múltiple</h4>
                    <p className="fluid-text-sm text-gray-500">Selecciona una respuesta</p>
                  </div>
                </div>

                <div className="flex items-center fluid-gap-4 fluid-p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="fluid-icon-lg rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckSquare className="fluid-icon-sm text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-800 fluid-text-base">Selección múltiple</h4>
                    <p className="fluid-text-sm text-gray-500">Selecciona todas las correctas</p>
                  </div>
                </div>

                <div className="flex items-center fluid-gap-4 fluid-p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="fluid-icon-lg rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <ListOrdered className="fluid-icon-sm text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-800 fluid-text-base">Ordenamiento</h4>
                    <p className="fluid-text-sm text-gray-500">Ordena en secuencia correcta</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Instrucciones de ejercicios interactivos */}
            <div className={`${bgLight} rounded-fluid-xl fluid-p-6 border ${borderColor}`}>
              <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
                <Target className={`fluid-icon-sm ${textColor}`} />
                Ejercicios interactivos
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 fluid-gap-4 fluid-mb-4">
                <div className="flex items-center fluid-gap-4 fluid-p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="fluid-icon-lg rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <MousePointer className="fluid-icon-sm text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-800 fluid-text-base">Arrastrar y soltar</h4>
                    <p className="fluid-text-sm text-gray-500">Arrastra a las zonas correctas</p>
                  </div>
                </div>

                <div className="flex items-center fluid-gap-4 fluid-p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="fluid-icon-lg rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <Move className="fluid-icon-sm text-rose-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-800 fluid-text-base">Pasos secuenciales</h4>
                    <p className="fluid-text-sm text-gray-500">Realiza acciones en orden</p>
                  </div>
                </div>
              </div>

              {/* Nota importante */}
              <div className={`fluid-p-4 ${bgLight} rounded-xl border ${borderColor}`}>
                <p className="fluid-text-sm text-gray-700">
                  <strong>Importante:</strong> Navega entre preguntas usando los botones. 
                  Puedes regresar a preguntas anteriores para modificar tus respuestas.
                </p>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="text-center">
            {/* Icono de alerta */}
            <div className="fluid-icon-2xl mx-auto fluid-mb-6 rounded-full bg-rose-100 flex items-center justify-center">
              <AlertTriangle className="fluid-icon-xl text-rose-600" />
            </div>

            {/* Título */}
            <h1 className="fluid-text-3xl font-bold text-gray-800 fluid-mb-6">
              Importante
            </h1>

            {/* Mensaje principal */}
            <div className={`${bgLight} rounded-fluid-xl fluid-p-6 border ${borderColor} text-left fluid-mb-6`}>
              <p className="fluid-text-base text-gray-700 leading-relaxed fluid-mb-4">
                A partir de este momento se iniciará {isSimulator ? <>el <strong>simulador</strong></> : <>el <strong>examen</strong></>}. 
                Si estás seguro da clic en <strong className={textColor}>INICIAR</strong>, 
                en caso contrario da clic en <strong>ATRÁS</strong>.
              </p>
              
              <div className="bg-rose-50 border border-rose-200 rounded-xl fluid-p-4">
                <p className="fluid-text-sm text-rose-800 font-medium">
                  Si continúas e interrumpes tu prueba, se calificarán solo las preguntas que se hayan resuelto.
                </p>
              </div>
            </div>

            {/* Información de soporte */}
            <div className={`${bgLight} rounded-fluid-xl fluid-p-6 border ${borderColor}`}>
              <h3 className="fluid-text-base font-semibold text-gray-800 fluid-mb-4">
                Si experimentas alguna falla comunícate con soporte:
              </h3>
              
              <div className="grid grid-cols-2 fluid-gap-4 text-left">
                <div className="flex items-center fluid-gap-3 fluid-p-3 bg-white rounded-xl">
                  <div className="fluid-icon-md rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="fluid-icon-xs text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="fluid-text-xs text-gray-500">Correo</p>
                    <p className="fluid-text-sm font-medium text-gray-800 truncate">soporte@grupoeduit.com</p>
                  </div>
                </div>

                <div className="flex items-center fluid-gap-3 fluid-p-3 bg-white rounded-xl">
                  <div className="fluid-icon-md rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Phone className="fluid-icon-xs text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="fluid-text-xs text-gray-500">Teléfono</p>
                    <p className="fluid-text-sm font-medium text-gray-800">01 800 808 6240</p>
                  </div>
                </div>

                <div className="flex items-center fluid-gap-3 fluid-p-3 bg-white rounded-xl">
                  <div className="fluid-icon-md rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="fluid-icon-xs text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="fluid-text-xs text-gray-500">WhatsApp</p>
                    <p className="fluid-text-sm font-medium text-gray-800">22 21 65 6782</p>
                  </div>
                </div>

                <div className="flex items-center fluid-gap-3 fluid-p-3 bg-white rounded-xl">
                  <div className="fluid-icon-md rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Calendar className="fluid-icon-xs text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="fluid-text-xs text-gray-500">Horario</p>
                    <p className="fluid-text-xs font-medium text-gray-800">L-V: 9am-6pm | S: 9am-2pm</p>
                  </div>
                </div>
              </div>

              <p className="fluid-text-xs text-gray-500 fluid-mt-4">
                Hora del centro de México
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Contenedor scrolleable que incluye header, contenido y botones */}
      <div 
        ref={contentRef}
        onScroll={checkScrollNeeded}
        className="relative z-10 flex-1 overflow-y-auto"
      >
        {/* Header con indicador de progreso */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 fluid-px-12 fluid-py-4 shadow-sm">
          <div className="flex items-center justify-between fluid-mb-2">
            <span className="fluid-text-sm text-gray-500">Paso {currentStep + 1} de 3</span>
            <span className={`fluid-text-sm font-medium ${textColor}`}>
              {isSimulator ? 'Simulador' : 'Examen'}
            </span>
          </div>
          <div className="flex fluid-gap-2">
            {[0, 1, 2].map((step) => (
              <div
                key={step}
                className={`h-1.5 sm:h-2 flex-1 rounded-full transition-all duration-300 ${
                  step <= currentStep
                    ? isSimulator ? 'bg-violet-500' : 'bg-blue-500'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Contenido principal con animación */}
        <div className="bg-white">
          <div 
            className={`max-w-4xl mx-auto fluid-px-8 fluid-py-10 transition-all duration-300 ease-out ${
              isAnimating 
                ? animationDirection === 'right' 
                  ? 'opacity-0 translate-x-8' 
                  : 'opacity-0 -translate-x-8'
                : 'opacity-100 translate-x-0'
            }`}
          >
            {renderStepContent()}
          </div>
        </div>

        {/* Botones de navegación */}
        <div ref={buttonsRef} className="sticky bottom-0 z-20 bg-white border-t border-gray-200 fluid-px-12 fluid-py-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex justify-between fluid-gap-6">
            <button
              onClick={handleBack}
              className="flex items-center fluid-gap-2 fluid-px-8 fluid-py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-fluid-lg transition-all fluid-text-base active:scale-95"
            >
              <ArrowLeft className="fluid-icon-xs" />
              ATRÁS
            </button>

            {currentStep < 2 ? (
              <button
                onClick={handleNext}
                className={`flex items-center fluid-gap-2 fluid-px-8 fluid-py-3 text-white font-semibold rounded-fluid-lg transition-all fluid-text-base active:scale-95 ${
                  isSimulator 
                    ? 'bg-violet-500 hover:bg-violet-600' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                SIGUIENTE
                <ArrowRight className="fluid-icon-xs" />
              </button>
            ) : (
              <button
                onClick={handleStartExam}
                className={`flex items-center fluid-gap-2 fluid-px-10 fluid-py-3 text-white font-semibold rounded-fluid-lg transition-all shadow-lg fluid-text-base active:scale-95 ${
                  isSimulator 
                    ? 'bg-violet-500 hover:bg-violet-600' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                <Play className="fluid-icon-xs" />
                INICIAR
              </button>
            )}
          </div>
        </div>
        
      {/* Botón flotante de scroll hacia abajo */}
      {showScrollHint && (
        <div className="fixed bottom-24 sm:bottom-28 right-4 sm:right-6 z-50">
          <button
            onClick={handleScrollDown}
            className={`fluid-icon-lg rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 border-2 border-white ${
              isSimulator 
                ? 'bg-violet-500 hover:bg-violet-600 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
            style={{
              animation: 'bounce 1s ease-in-out infinite'
            }}
            title="Desplazarse hacia abajo para ver los botones"
          >
            <ChevronDown className="fluid-icon-sm" />
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

export default ExamOnboardingPage;
