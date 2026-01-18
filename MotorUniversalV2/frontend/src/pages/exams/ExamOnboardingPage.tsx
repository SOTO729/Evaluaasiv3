import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  const [currentStep, setCurrentStep] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(false);
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

  // Detectar si hay contenido que requiere scroll
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

  // Scroll hacia abajo
  const handleScrollDown = () => {
    if (buttonsRef.current) {
      buttonsRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      // Volver a la selección de modo
      navigate(`/exams/${id}/select-mode`);
    } else {
      setCurrentStep(prev => prev - 1);
      // Scroll hacia arriba al cambiar de paso
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(prev => prev + 1);
      // Scroll hacia arriba al cambiar de paso
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStartExam = () => {
    navigate(`/test-exams/${id}/run`, {
      state: {
        questionCount: exam?.total_questions || 0,
        exerciseCount: exam?.total_exercises || 0,
        mode: currentMode
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

  // Colores según el modo
  const bgGradient = isSimulator 
    ? 'from-amber-500 to-amber-700' 
    : 'from-blue-500 to-blue-700';
  const textColor = isSimulator ? 'text-amber-600' : 'text-blue-600';
  const bgLight = isSimulator ? 'bg-amber-50' : 'bg-blue-50';
  const borderColor = isSimulator ? 'border-amber-200' : 'border-blue-200';

  // Renderizar el contenido del paso actual
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="text-center max-w-2xl mx-auto px-2 sm:px-0">
            {/* Icono principal */}
            <div className={`w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 mx-auto mb-4 sm:mb-6 rounded-full bg-gradient-to-br ${bgGradient} flex items-center justify-center shadow-xl`}>
              {isSimulator ? (
                <FlaskConical className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 text-white" />
              ) : (
                <ClipboardCheck className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 text-white" />
              )}
            </div>

            {/* Título */}
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800 mb-2 sm:mb-4">
              Estás a punto de comenzar
            </h1>
            <h2 className={`text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold ${textColor} mb-4 sm:mb-6 md:mb-8`}>
              {isSimulator ? 'una prueba de simulación' : 'tu examen de certificación'}
            </h2>

            {/* Nombre del examen */}
            <div className={`${bgLight} rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 md:mb-8 border ${borderColor}`}>
              <p className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-1">
                {exam.name}
              </p>
              <p className="text-xs sm:text-sm text-gray-500">Versión {exam.version}</p>
            </div>

            {/* Info de ejercicios y tiempo */}
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-6 md:gap-8 mb-4 sm:mb-6 md:mb-8">
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${bgLight} flex items-center justify-center`}>
                  <Target className={`w-5 h-5 sm:w-6 sm:h-6 ${textColor}`} />
                </div>
                <div className="text-left">
                  <p className="text-xl sm:text-2xl font-bold text-gray-800">{totalItems}</p>
                  <p className="text-xs sm:text-sm text-gray-500">ejercicios</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${bgLight} flex items-center justify-center`}>
                  <Clock className={`w-5 h-5 sm:w-6 sm:h-6 ${textColor}`} />
                </div>
                <div className="text-left">
                  <p className="text-xl sm:text-2xl font-bold text-gray-800">{exam.duration_minutes || '--'}</p>
                  <p className="text-xs sm:text-sm text-gray-500">minutos</p>
                </div>
              </div>
            </div>

            {/* Mensaje principal */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 text-left space-y-3 sm:space-y-4">
              {isSimulator ? (
                <>
                  <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                    Al finalizar el simulador podrás generar el reporte el cual te indicará si has alcanzado 
                    el nivel para presentar tu examen de certificación.
                  </p>
                  <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                    Para continuar el simulador haz clic en el botón <strong>SIGUIENTE</strong>.
                  </p>
                  <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                    Si deseas suspenderlo haz clic en el botón <strong>ATRÁS</strong>.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                    Esta es una evaluación oficial. Al aprobar obtendrás tu certificación.
                    Los resultados serán registrados permanentemente.
                  </p>
                  <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                    Para continuar con el examen haz clic en el botón <strong>SIGUIENTE</strong>.
                  </p>
                  <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                    Si deseas regresar haz clic en el botón <strong>ATRÁS</strong>.
                  </p>
                </>
              )}
            </div>

            {/* Mensaje de éxito */}
            <div className={`mt-4 sm:mt-6 inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-full ${bgLight} ${textColor} font-semibold text-sm sm:text-base`}>
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              ¡Éxito!
            </div>
          </div>
        );

      case 1:
        return (
          <div className="max-w-3xl mx-auto px-2 sm:px-0">
            {/* Título */}
            <div className="text-center mb-4 sm:mb-6 md:mb-8">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-3 sm:mb-4 rounded-full ${bgLight} flex items-center justify-center`}>
                <BookOpen className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 ${textColor}`} />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">
                Instrucciones
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                Lee cuidadosamente cómo funciona {isSimulator ? 'el simulador' : 'el examen'}
              </p>
            </div>

            {/* Instrucciones de preguntas */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                <Info className={`w-4 h-4 sm:w-5 sm:h-5 ${textColor}`} />
                Tipos de preguntas
              </h3>
              
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <ToggleLeft className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-800 mb-0.5 sm:mb-1 text-sm sm:text-base">Verdadero / Falso</h4>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Selecciona si la afirmación presentada es verdadera o falsa.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-800 mb-0.5 sm:mb-1 text-sm sm:text-base">Opción múltiple</h4>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Selecciona <strong>una sola</strong> respuesta correcta de las opciones disponibles.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-800 mb-0.5 sm:mb-1 text-sm sm:text-base">Selección múltiple</h4>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Selecciona <strong>todas</strong> las respuestas correctas. Puede haber más de una.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <ListOrdered className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-800 mb-0.5 sm:mb-1 text-sm sm:text-base">Ordenamiento</h4>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Arrastra y ordena los elementos en la secuencia correcta.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Instrucciones de ejercicios interactivos */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                <Target className={`w-4 h-4 sm:w-5 sm:h-5 ${textColor}`} />
                Ejercicios interactivos
              </h3>
              
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <MousePointer className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-800 mb-0.5 sm:mb-1 text-sm sm:text-base">Arrastrar y soltar</h4>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Arrastra los elementos y suéltalos en las zonas correspondientes.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <Move className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-800 mb-0.5 sm:mb-1 text-sm sm:text-base">Pasos secuenciales</h4>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Realiza las acciones en el orden correcto.
                    </p>
                  </div>
                </div>
              </div>

              {/* Nota importante */}
              <div className={`mt-4 sm:mt-6 p-3 sm:p-4 ${bgLight} rounded-lg sm:rounded-xl border ${borderColor}`}>
                <p className="text-xs sm:text-sm text-gray-700">
                  <strong>Importante:</strong> Navega entre las preguntas usando los botones. 
                  Puedes regresar a preguntas anteriores para modificar tus respuestas.
                </p>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="max-w-2xl mx-auto text-center px-2 sm:px-0">
            {/* Icono de alerta */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-amber-600" />
            </div>

            {/* Título */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-4 sm:mb-6">
              Importante
            </h1>

            {/* Mensaje principal */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 text-left mb-4 sm:mb-6 md:mb-8">
              <p className="text-sm sm:text-base md:text-lg text-gray-700 leading-relaxed mb-3 sm:mb-4">
                A partir de este momento se iniciará {isSimulator ? 'el simulador' : 'el examen'}. 
                Si estás seguro da clic en el botón <strong className={textColor}>INICIAR</strong>, 
                en caso contrario da clic al botón <strong>ATRÁS</strong>.
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                <p className="text-xs sm:text-sm md:text-base text-amber-800 font-medium">
                  Si continúas e interrumpes tu prueba, se calificarán solo las preguntas que se hayan resuelto.
                </p>
              </div>
            </div>

            {/* Información de soporte */}
            <div className="bg-gray-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-200">
              <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">
                Si experimentas alguna falla comunícate con soporte:
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4 text-left">
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white rounded-lg sm:rounded-xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500">Correo</p>
                    <p className="text-xs sm:text-sm font-medium text-gray-800 truncate">soporte@grupoeduit.com</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white rounded-lg sm:rounded-xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500">Teléfono</p>
                    <p className="text-xs sm:text-sm font-medium text-gray-800">01 800 808 6240</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white rounded-lg sm:rounded-xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500">WhatsApp</p>
                    <p className="text-xs sm:text-sm font-medium text-gray-800">22 21 65 6782</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white rounded-lg sm:rounded-xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500">Horario</p>
                    <p className="text-[10px] sm:text-xs font-medium text-gray-800">L-V: 9am-6pm | S: 9am-2pm</p>
                  </div>
                </div>
              </div>

              <p className="text-[10px] sm:text-xs text-gray-500 mt-3 sm:mt-4">
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Indicador de progreso */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-xs sm:text-sm text-gray-500">Paso {currentStep + 1} de 3</span>
            <span className={`text-xs sm:text-sm font-medium ${textColor}`}>
              {isSimulator ? 'Simulador' : 'Examen'}
            </span>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            {[0, 1, 2].map((step) => (
              <div
                key={step}
                className={`h-1 sm:h-1.5 flex-1 rounded-full transition-colors ${
                  step <= currentStep
                    ? isSimulator ? 'bg-amber-500' : 'bg-blue-500'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div 
        ref={contentRef}
        onScroll={checkScrollNeeded}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8"
      >
        {renderStepContent()}
        
        {/* Botón flotante de scroll hacia abajo */}
        {showScrollHint && (
          <div className="fixed bottom-20 sm:bottom-24 right-4 sm:right-6 z-50">
            <button
              onClick={handleScrollDown}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 border-2 border-white animate-bounce ${
                isSimulator 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title="Desplazarse hacia abajo"
            >
              <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        )}
      </div>

      {/* Botones de navegación */}
      <div ref={buttonsRef} className="bg-white border-t border-gray-200 px-3 sm:px-4 py-3 sm:py-4">
        <div className="max-w-3xl mx-auto flex justify-between gap-3 sm:gap-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg sm:rounded-xl transition-colors text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            ATRÁS
          </button>

          {currentStep < 2 ? (
            <button
              onClick={handleNext}
              className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 text-white font-semibold rounded-lg sm:rounded-xl transition-colors text-sm sm:text-base ${
                isSimulator 
                  ? 'bg-amber-500 hover:bg-amber-600' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              SIGUIENTE
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          ) : (
            <button
              onClick={handleStartExam}
              className={`flex items-center gap-1.5 sm:gap-2 px-5 sm:px-8 py-2.5 sm:py-3 text-white font-semibold rounded-lg sm:rounded-xl transition-colors shadow-lg text-sm sm:text-base ${
                isSimulator 
                  ? 'bg-amber-500 hover:bg-amber-600' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5" />
              INICIAR
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamOnboardingPage;
