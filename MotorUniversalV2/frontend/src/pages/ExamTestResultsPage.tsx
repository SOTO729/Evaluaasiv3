import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ArrowLeft, 
  RotateCcw, 
  Clock, 
  Target, 
  ChevronDown,
  ChevronUp,
  MousePointer,
  Type,
  Download,
  BookOpen,
  Loader2,
  Award,
  Send,
  FileText,
  Trophy
} from 'lucide-react';

// Función para traducir tipos de pregunta al español
const getQuestionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'true_false': 'Verdadero / Falso',
    'multiple_choice': 'Selección Única',
    'multiple_select': 'Selección Múltiple',
    'ordering': 'Ordenamiento',
    'drag_drop': 'Arrastrar y Soltar',
    'column_grouping': 'Agrupamiento en Columnas'
  };
  return labels[type] || type;
};

// Tipos para los resultados de evaluación
interface QuestionResult {
  question_id: string;
  question_type: string;
  question_text: string;
  user_answer: any;
  is_correct: boolean;
  score: number;
  correct_answer: any;
  correct_answer_text?: string;
  correct_answers_text?: string[];
  explanation?: string;
  answers: any[];
  // Campos adicionales para ordenamiento
  correct_positions?: number;
  total_positions?: number;
  // Campos para categoría/tema
  category_name?: string;
  topic_name?: string;
  max_score?: number;
}

interface ActionResult {
  action_id: string;
  action_number: number;
  action_type: string;
  user_response: any;
  is_correct: boolean;
  score: number;
  correct_answer: string;
  similarity?: number;
  explanation?: string;
}

interface StepResult {
  step_id: string;
  step_number: number;
  title: string;
  is_correct: boolean;
  actions: ActionResult[];
}

interface ExerciseResult {
  exercise_id: string;
  title: string;
  is_correct: boolean;
  total_score: number;
  max_score: number;
  steps: StepResult[];
}

interface TopicBreakdown {
  earned: number;
  max: number;
  percentage: number;
}

interface CategoryBreakdown {
  topics: Record<string, TopicBreakdown>;
  earned: number;
  max: number;
  percentage: number;
}

interface EvaluationSummary {
  total_items: number;
  total_questions: number;
  total_exercises: number;
  correct_questions: number;
  correct_exercises: number;
  question_score: number;
  exercise_score: number;
  max_exercise_score: number;
  total_points: number;
  earned_points: number;
  percentage: number;
  evaluation_breakdown?: Record<string, CategoryBreakdown>;
}

interface EvaluationResults {
  questions: QuestionResult[];
  exercises: ExerciseResult[];
  summary: EvaluationSummary;
}

const ExamTestResultsPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { accessToken, user } = useAuthStore();

  // Verificar si el usuario puede ver las respuestas detalladas (no candidatos)
  const canViewAnswers = user?.role && ['admin', 'editor', 'soporte'].includes(user.role);

  // Expandir/colapsar secciones
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});

  // Obtener datos de la navegación con manejo defensivo
  const rawState = location.state;
  
  // Debug: Log del estado recibido
  console.log('📊 ExamTestResultsPage - location:', location);
  console.log('📊 ExamTestResultsPage - rawState:', rawState);
  console.log('📊 ExamTestResultsPage - typeof rawState:', typeof rawState);
  
  // Parsear el estado de forma segura
  const state = rawState as {
    evaluationResults?: EvaluationResults;
    items?: any[];
    elapsedTime: number;
    answers?: Record<string, any>;
    exerciseResponses?: Record<string, Record<string, any>>;
    examName?: string;
    passingScore?: number;
    resultId?: string;
  } | null;

  console.log('📊 evaluationResults:', state?.evaluationResults);
  console.log('📊 evaluationResults keys:', state?.evaluationResults ? Object.keys(state.evaluationResults) : 'N/A');

  const evaluationResults = state?.evaluationResults;
  const elapsedTime = state?.elapsedTime || 0;
  const resultId = state?.resultId;
  
  // Ref para evitar procesar múltiples veces
  const hasUploadedRef = useRef(false);

  // Si no hay resultados de evaluación, mostrar error con más información
  if (!evaluationResults) {
    console.error('❌ No se encontraron resultados de evaluación en el estado:', state);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center overflow-x-hidden overscroll-contain">
        <div className="text-center fluid-p-8 max-w-md">
          <AlertCircle className="fluid-icon-xl text-yellow-500 mx-auto fluid-mb-4" />
          <h2 className="fluid-text-xl font-bold text-gray-900 fluid-mb-2">Error al cargar resultados</h2>
          <p className="text-gray-600 fluid-mb-4">No se pudieron obtener los resultados de la evaluación.</p>
          {state?.answers && (
            <p className="fluid-text-sm text-gray-500 fluid-mb-4">
              Se recibieron respuestas pero no los resultados evaluados.
              Por favor, intenta nuevamente.
            </p>
          )}
          <button
            onClick={() => navigate('/test-exams')}
            className="fluid-px-4 fluid-py-2 bg-primary-600 text-white rounded-fluid-lg hover:bg-primary-700"
          >
            Volver a exámenes
          </button>
        </div>
      </div>
    );
  }

  const { questions, exercises, summary } = evaluationResults;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 80) return 'from-green-500 to-emerald-600';
    if (percentage >= 60) return 'from-yellow-500 to-amber-600';
    return 'from-red-500 to-rose-600';
  };

  const toggleExercise = (exerciseId: string) => {
    setExpandedExercises(prev => ({
      ...prev,
      [exerciseId]: !prev[exerciseId]
    }));
  };

  // Estado para controlar la descarga del PDF
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Función para descargar el PDF desde el backend
  const downloadPDFFromBackend = async () => {
    if (!resultId) {
      alert('No se encontró el ID del resultado. Por favor, intenta de nuevo.');
      return;
    }

    setDownloadingPdf(true);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api';
      
      // Obtener zona horaria del equipo del usuario
      const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      console.log('📤 Descargando PDF:', { resultId, apiUrl, hasToken: !!accessToken, timezone: clientTimezone });
      
      const response = await fetch(`${apiUrl}/exams/results/${resultId}/generate-pdf?timezone=${encodeURIComponent(clientTimezone)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', response.status, errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      // Descargar el PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_Evaluacion_${resultId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Error descargando PDF:', error);
      alert('Error al descargar el PDF. Por favor intenta de nuevo.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Efecto para marcar que el resultado se ha visto (sin subir PDF, ya que se genera en backend)
  useEffect(() => {
    if (resultId && !hasUploadedRef.current) {
      hasUploadedRef.current = true;
      console.log('📊 Resultado cargado:', resultId);
    }
  }, [resultId]);

  const renderUserAnswer = (result: QuestionResult) => {
    if (result.user_answer === undefined || result.user_answer === null) {
      return <span className="text-gray-500 italic">Sin responder</span>;
    }

    switch (result.question_type) {
      case 'true_false':
        return <span className="font-medium">{result.user_answer ? 'Verdadero' : 'Falso'}</span>;

      case 'multiple_choice':
        const selectedAnswer = result.answers?.find((a: any) => String(a.id) === String(result.user_answer));
        return (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: selectedAnswer?.answer_text || 'Sin responder' }}
          />
        );

      case 'multiple_select':
        const selectedAnswers = result.answers?.filter((a: any) => 
          (result.user_answer || []).map(String).includes(String(a.id))
        );
        return (
          <div className="flex flex-col fluid-gap-1">
            {selectedAnswers?.map((a: any) => (
              <div
                key={a.id}
                className="prose prose-sm max-w-none flex items-center"
              >
                <span className="w-2 h-2 bg-current rounded-full mr-2 flex-shrink-0" />
                <span dangerouslySetInnerHTML={{ __html: a.answer_text }} />
              </div>
            )) || <span className="text-gray-500 italic">Sin responder</span>}
          </div>
        );

      case 'ordering':
        const orderedAnswers = (result.user_answer || []).map((id: string, index: number) => {
          const answer = result.answers?.find((a: any) => String(a.id) === String(id));
          return (
            <div key={id} className="flex items-center fluid-text-sm fluid-mb-1">
              <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium fluid-mr-2">
                {index + 1}
              </span>
              <span dangerouslySetInnerHTML={{ __html: answer?.answer_text || id }} />
            </div>
          );
        });
        return <div>{orderedAnswers}</div>;

      case 'drag_drop': {
        // Mostrar qué respuesta puso el usuario en cada espacio
        const userAnswer = result.user_answer || {};
        const allAnswers = result.answers || [];
        
        return (
          <div className="flex flex-col fluid-gap-1">
            {Object.entries(userAnswer).map(([blankId, answerId]) => {
              const answer = allAnswers.find((a: any) => String(a.id) === String(answerId));
              const correctAnswer = allAnswers.find((a: any) => a.correct_answer === blankId);
              const isCorrect = String(answerId) === String(correctAnswer?.id);
              
              return (
                <div key={blankId} className="flex items-center fluid-gap-2 fluid-text-sm">
                  <span className="px-2 py-0.5 bg-gray-200 rounded text-xs font-mono">
                    {blankId.replace('blank_', 'Espacio ')}
                  </span>
                  <span className="text-gray-500">→</span>
                  <span className={`px-2 py-0.5 rounded font-medium ${
                    isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {answer?.answer_text || 'Sin respuesta'}
                  </span>
                </div>
              );
            })}
          </div>
        );
      }

      case 'column_grouping': {
        // Mostrar qué elementos clasificó el usuario en cada columna
        const userColAnswer = result.user_answer || {};
        const colOptions = result.answers || [];
        
        // Obtener nombres de columnas del usuario
        const userColumns = Object.keys(userColAnswer);
        
        if (userColumns.length === 0) {
          return <span className="text-gray-500 italic">Sin clasificar</span>;
        }
        
        return (
          <div className="flex flex-col fluid-gap-3">
            {userColumns.map((columnId) => {
              const itemIds = userColAnswer[columnId] || [];
              const items = itemIds.map((id: string) => 
                colOptions.find((o: any) => String(o.id) === String(id))
              ).filter(Boolean);
              
              return (
                <div key={columnId} className="border rounded-fluid-lg overflow-hidden">
                  <div className="bg-gray-100 fluid-px-3 py-1.5 font-medium fluid-text-sm text-gray-700">
                    {columnId.replace('columna_', 'Columna ').replace(/_/g, ' ')}
                  </div>
                  <div className="fluid-px-3 fluid-py-2">
                    {items.length > 0 ? (
                      <div className="flex flex-wrap fluid-gap-1">
                        {items.map((item: any) => {
                          const isCorrect = item.correct_answer === columnId;
                          return (
                            <span 
                              key={item.id}
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {item.answer_text}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Sin elementos</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }

      default:
        return <span className="text-gray-500">-</span>;
    }
  };

  const renderCorrectAnswer = (result: QuestionResult) => {
    switch (result.question_type) {
      case 'true_false':
        return <span className="font-bold">{result.correct_answer ? 'Verdadero' : 'Falso'}</span>;

      case 'multiple_choice': {
        // Usar correct_answer_text si está disponible, sino buscar en answers
        const correctText = result.correct_answer_text || 
          result.answers?.find((a: any) => a.is_correct)?.answer_text ||
          result.answers?.find((a: any) => String(a.id) === String(result.correct_answer))?.answer_text;
        return (
          <div
            className="prose prose-sm max-w-none font-bold"
            dangerouslySetInnerHTML={{ __html: correctText || '-' }}
          />
        );
      }

      case 'multiple_select': {
        // Usar correct_answers_text si está disponible, sino buscar en answers
        const correctTexts = result.correct_answers_text && result.correct_answers_text.length > 0
          ? result.correct_answers_text
          : result.answers?.filter((a: any) => a.is_correct).map((a: any) => a.answer_text) || [];
        return (
          <ul className="list-disc list-inside flex flex-col fluid-gap-1">
            {correctTexts.map((text: string, index: number) => (
              <li key={index} className="text-sm font-bold">
                <span dangerouslySetInnerHTML={{ __html: text }} />
              </li>
            ))}
          </ul>
        );
      }

      case 'ordering': {
        // Usar correct_answers_text si está disponible, sino ordenar answers por answer_number
        const orderedTexts = result.correct_answers_text && result.correct_answers_text.length > 0
          ? result.correct_answers_text
          : result.answers
              ?.slice()
              .sort((a: any, b: any) => (a.answer_number || 0) - (b.answer_number || 0))
              .map((a: any) => a.answer_text) || [];
        return (
          <div className="flex flex-col fluid-gap-1">
            {orderedTexts.map((text: string, index: number) => (
              <div key={index} className="flex items-center fluid-text-sm">
                <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold mr-2">
                  {index + 1}
                </span>
                <span className="font-bold" dangerouslySetInnerHTML={{ __html: text }} />
              </div>
            ))}
          </div>
        );
      }

      case 'drag_drop': {
        // Mostrar qué respuesta va en cada espacio
        const answers = result.answers || [];
        const blanksMap = new Map<string, any>();
        answers.forEach((a: any) => {
          if (a.correct_answer && a.correct_answer.startsWith('blank_')) {
            blanksMap.set(a.correct_answer, a);
          }
        });
        
        return (
          <div className="flex flex-col fluid-gap-1">
            {Array.from(blanksMap.entries()).map(([blankId, answer]) => (
              <div key={blankId} className="flex items-center fluid-gap-2 fluid-text-sm">
                <span className="px-2 py-0.5 bg-gray-200 rounded text-xs font-mono">
                  {blankId.replace('blank_', 'Espacio ')}
                </span>
                <span className="text-gray-500">→</span>
                <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded font-medium">
                  {answer.answer_text}
                </span>
              </div>
            ))}
          </div>
        );
      }

      case 'column_grouping': {
        // Mostrar qué elementos van en cada columna correctamente
        const colAnswers = result.answers || [];
        
        // Agrupar opciones por su columna correcta
        const columnGroups: Record<string, any[]> = {};
        colAnswers.forEach((a: any) => {
          if (a.correct_answer) {
            if (!columnGroups[a.correct_answer]) {
              columnGroups[a.correct_answer] = [];
            }
            columnGroups[a.correct_answer].push(a);
          }
        });
        
        const columns = Object.keys(columnGroups).sort();
        
        if (columns.length === 0) {
          return <span className="text-gray-500">-</span>;
        }
        
        return (
          <div className="flex flex-col fluid-gap-3">
            {columns.map((columnId) => {
              const items = columnGroups[columnId] || [];
              
              return (
                <div key={columnId} className="border border-green-200 rounded-fluid-lg overflow-hidden">
                  <div className="bg-green-100 fluid-px-3 py-1.5 font-bold fluid-text-sm text-green-800">
                    {columnId.replace('columna_', 'Columna ').replace(/_/g, ' ')}
                  </div>
                  <div className="fluid-px-3 fluid-py-2 bg-green-50">
                    <div className="flex flex-wrap fluid-gap-1">
                      {items.map((item: any) => (
                        <span 
                          key={item.id}
                          className="px-2 py-0.5 bg-green-200 text-green-900 rounded text-xs font-bold"
                        >
                          {item.answer_text}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }

      default:
        return <span className="text-gray-500">-</span>;
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 overflow-x-hidden overscroll-contain ${!canViewAnswers ? '' : ''}`}>
      {/* Header con gradiente y bordes suaves */}
      <div className="max-w-7xl mx-auto fluid-px-6 fluid-pt-6">
        <div className={`bg-gradient-to-r ${getScoreBgColor(summary.percentage)} text-white rounded-fluid-xl shadow-xl`}>
          <div className="fluid-px-6 fluid-py-6">
          {/* Botón volver a exámenes para candidatos */}
          {!canViewAnswers && (
            <div className="fluid-mb-4">
              <button
                onClick={() => navigate('/exams')}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 rounded-fluid-md text-white fluid-text-sm font-medium transition-colors"
              >
                <ArrowLeft className="fluid-icon-sm" />
                Volver a Exámenes
              </button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
            <div>
              <h1 className="fluid-text-3xl font-bold fluid-mb-2">Resultados del Examen</h1>
              <p className="text-white/80 fluid-text-lg">Evaluación completada</p>
            </div>
            <div className="text-left sm:text-right">
              <div className="fluid-text-3xl font-bold">{summary.percentage}%</div>
              <div className="text-white/80 fluid-text-sm">Calificación Final</div>
            </div>
          </div>
        </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto fluid-px-6 fluid-pt-6 fluid-pb-8">
        {/* Summary Cards - Diferentes para candidatos */}
        {!canViewAnswers ? (
          /* Tarjetas para candidatos: Tiempo, Puntos, Respuestas enviadas, Estatus */
          <div className="grid grid-cols-2 fluid-gap-4 md:grid-cols-4 fluid-mb-8">
            <div className="bg-white rounded-fluid-lg shadow-lg fluid-p-4 border-t-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Tiempo</p>
                  <p className="fluid-text-xl font-bold text-blue-600">{formatTime(elapsedTime)}</p>
                </div>
                <Clock className="fluid-icon-lg text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-fluid-lg shadow-lg fluid-p-4 border-t-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Puntos</p>
                  <p className="fluid-text-xl font-bold text-yellow-600">{Math.round(1000 * summary.percentage / 100)}</p>
                </div>
                <Trophy className="fluid-icon-lg text-yellow-500" />
              </div>
            </div>

            <div className="bg-white rounded-fluid-lg shadow-lg fluid-p-4 border-t-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Respuestas</p>
                  <p className="fluid-text-xl font-bold text-green-600">{summary.total_questions + summary.total_exercises}</p>
                </div>
                <Send className="fluid-icon-lg text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-fluid-lg shadow-lg fluid-p-4 border-t-4 border-amber-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Estatus</p>
                  <p className={`fluid-text-base font-bold ${summary.percentage >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                    {summary.percentage >= 70 ? 'Aprobado' : 'No aprobado'}
                  </p>
                </div>
                <Award className={`fluid-icon-lg ${summary.percentage >= 70 ? 'text-green-500' : 'text-red-500'}`} />
              </div>
            </div>
          </div>
        ) : (
          /* Tarjetas para admin/editor: Vista completa */
          <div className="grid grid-cols-2 fluid-gap-4 md:grid-cols-5 fluid-mb-8 -fluid-mt-10">
          <div className="bg-white rounded-fluid-lg shadow-lg fluid-p-4 border-t-4 border-gray-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Respuestas</p>
                <p className="fluid-text-xl font-bold text-gray-700">{summary.earned_points}/{summary.total_points}</p>
              </div>
              <CheckCircle className="fluid-icon-lg text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-fluid-lg shadow-lg fluid-p-4 border-t-4 border-primary-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Preguntas</p>
                <p className="fluid-text-xl font-bold text-primary-600">{summary.correct_questions}/{summary.total_questions}</p>
              </div>
              <BookOpen className="fluid-icon-lg text-primary-500" />
            </div>
          </div>

          <div className="bg-white rounded-fluid-lg shadow-lg fluid-p-4 border-t-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Ejercicios</p>
                <p className="fluid-text-xl font-bold text-purple-600">{summary.correct_exercises}/{summary.total_exercises}</p>
              </div>
              <Target className="fluid-icon-lg text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-fluid-lg shadow-lg fluid-p-4 border-t-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Tiempo</p>
                <p className="fluid-text-xl font-bold text-green-600">{formatTime(elapsedTime)}</p>
              </div>
              <Clock className="fluid-icon-lg text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-fluid-lg shadow-lg fluid-p-4 border-t-4 border-red-500 col-span-2 md:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Errores</p>
                <p className="fluid-text-xl font-bold text-red-600">
                  {(summary.total_questions - summary.correct_questions) + (summary.total_exercises - summary.correct_exercises)}
                </p>
              </div>
              <XCircle className="fluid-icon-lg text-red-500" />
            </div>
          </div>
          </div>
        )}

        {/* Mensaje para candidatos */}
        {!canViewAnswers && (
          <div className="bg-blue-50 border border-blue-200 rounded-fluid-lg fluid-p-5 fluid-mb-8">
            <div className="flex items-start">
              <AlertCircle className="fluid-icon text-blue-600 fluid-mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="fluid-text-lg font-semibold text-blue-900 fluid-mb-1">Resultados del Examen</h3>
                <p className="fluid-text-base text-blue-800">
                  Aquí puedes ver tu calificación final y el desglose de tu desempeño por cada área evaluada.
                  Esto te ayudará a identificar tus fortalezas y áreas de oportunidad.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Indicador de scroll para ver más detalles - solo para candidatos */}
        {!canViewAnswers && summary.evaluation_breakdown && Object.keys(summary.evaluation_breakdown).length > 0 && (
          <div className="flex justify-center fluid-mb-6">
            <button
              onClick={() => {
                const breakdownSection = document.getElementById('breakdown-section');
                if (breakdownSection) {
                  breakdownSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="flex flex-col items-center fluid-gap-1 text-gray-400 hover:text-primary-600 transition-colors"
            >
              <span className="fluid-text-sm font-medium">Ver desglose por área</span>
              <ChevronDown className="fluid-icon animate-bounce" />
            </button>
          </div>
        )}

        {/* Desglose por Categoría/Tema */}
        {summary.evaluation_breakdown && Object.keys(summary.evaluation_breakdown).length > 0 && (
          <div id="breakdown-section" className="bg-white rounded-fluid-lg shadow-lg fluid-mb-8">
            <div className="fluid-px-5 fluid-py-4 border-b border-gray-200">
              <h2 className="fluid-text-xl font-bold text-gray-900">Desglose por Área</h2>
              <p className="fluid-text-sm text-gray-500 mt-1">Puntaje obtenido por categoría y tema</p>
            </div>
            <div className="fluid-p-5">
              <div className="flex flex-col fluid-gap-6">
                {Object.entries(summary.evaluation_breakdown).map(([categoryName, categoryData], catIndex) => (
                  <div key={categoryName} className="border border-gray-200 rounded-fluid-lg overflow-hidden">
                    {/* Categoría */}
                    <div className="bg-gray-50 fluid-px-4 fluid-py-3 flex items-center justify-between">
                      <div className="flex items-center fluid-gap-3">
                        <span className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center fluid-text-sm font-bold">
                          {catIndex + 1}
                        </span>
                        <span className="font-semibold text-gray-800">{categoryName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">
                          {categoryData.earned.toFixed(1)}/{categoryData.max} pts
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          categoryData.percentage >= 80 ? 'bg-green-100 text-green-700' :
                          categoryData.percentage >= 60 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {categoryData.percentage}%
                        </span>
                      </div>
                    </div>
                    
                    {/* Temas */}
                    <div className="divide-y divide-gray-100">
                      {Object.entries(categoryData.topics).map(([topicName, topicData], topicIndex) => (
                        <div key={topicName} className="px-4 py-3 flex items-center justify-between bg-white hover:bg-gray-50">
                          <div className="flex items-center gap-2 ml-8">
                            <span className="text-xs text-gray-400 font-medium">
                              {catIndex + 1}.{topicIndex + 1}
                            </span>
                            <span className="text-gray-700">{topicName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">
                              {topicData.earned.toFixed(1)}/{topicData.max} pts
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              topicData.percentage >= 80 ? 'bg-green-100 text-green-700' :
                              topicData.percentage >= 60 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {topicData.percentage}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Nota sobre puntuación parcial */}
              <div className="fluid-mt-4 fluid-p-4 bg-blue-50 border border-blue-200 rounded-fluid-lg">
                <div className="flex items-start">
                  <AlertCircle className="fluid-icon text-blue-600 fluid-mr-2 flex-shrink-0 mt-0.5" />
                  <div className="fluid-text-sm text-blue-800">
                    <p className="font-semibold fluid-mb-1">Acerca de los puntajes:</p>
                    <ul className="list-disc list-inside flex flex-col fluid-gap-1 text-blue-700">
                      <li>Las preguntas de <strong>ordenamiento</strong> otorgan puntos parciales por cada posición correcta.</li>
                      <li>Las preguntas de <strong>selección múltiple</strong> otorgan puntos parciales según las respuestas correctas seleccionadas.</li>
                      <li>Los <strong>ejercicios</strong> otorgan puntos por cada acción completada correctamente.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preguntas - Solo visible para admin/editor/soporte */}
        {canViewAnswers && questions.length > 0 && (
          <div className="bg-white rounded-fluid-xl shadow-lg fluid-mb-8">
            <div className="fluid-px-6 fluid-py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="fluid-text-xl font-bold text-gray-900">
                Preguntas ({summary.correct_questions}/{summary.total_questions} correctas)
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {questions.map((result, index) => (
                <div key={result.question_id} className="fluid-p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 fluid-mr-4">
                      <div className={`w-10 h-10 rounded-fluid-lg flex items-center justify-center ${result.is_correct ? 'bg-green-100' : 'bg-red-100'}`}>
                        <BookOpen className={`fluid-icon ${result.is_correct ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap fluid-gap-2 fluid-mb-3">
                        <span className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                          Pregunta {index + 1}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                          {getQuestionTypeLabel(result.question_type)}
                        </span>
                        {result.score !== undefined && result.score > 0 && result.score < 1 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            ⭐ Puntaje parcial: {(result.score * 100).toFixed(1)}%
                            {result.question_type === 'ordering' && result.correct_positions !== undefined && (
                              <span className="ml-1">({result.correct_positions}/{result.total_positions} posiciones)</span>
                            )}
                          </span>
                        )}
                        {result.category_name && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            {result.category_name}
                          </span>
                        )}
                      </div>
                      
                      <div
                        className="prose prose-sm max-w-none fluid-mb-4 text-gray-800"
                        dangerouslySetInnerHTML={{ __html: result.question_text }}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-4 fluid-mt-4">
                        <div className={`fluid-p-4 rounded-fluid-xl ${result.is_correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                          <p className="fluid-text-sm font-semibold text-gray-700 fluid-mb-2 flex items-center">
                            <span className={`w-2 h-2 rounded-full mr-2 ${result.is_correct ? 'bg-green-500' : 'bg-red-500'}`} />
                            Tu respuesta:
                          </p>
                          <div className={result.is_correct ? 'text-green-900' : 'text-red-900'}>
                            {renderUserAnswer(result)}
                          </div>
                        </div>

                        {!result.is_correct && (
                          <div className="fluid-p-4 rounded-fluid-xl bg-green-50 border border-green-200">
                            <p className="fluid-text-sm font-semibold text-gray-700 fluid-mb-2 flex items-center">
                              <CheckCircle className="fluid-icon-sm text-green-500 fluid-mr-2" />
                              Respuesta correcta:
                            </p>
                            <div className="text-green-900">
                              {renderCorrectAnswer(result)}
                            </div>
                          </div>
                        )}
                      </div>

                      {result.explanation && (
                        <div className="fluid-mt-4 fluid-p-4 bg-blue-50 border border-blue-200 rounded-fluid-xl">
                          <div className="flex items-start">
                            <AlertCircle className="fluid-icon text-blue-600 fluid-mr-2 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="fluid-text-sm font-semibold text-blue-900 fluid-mb-1">Explicación:</p>
                              <p className="fluid-text-sm text-blue-800">{result.explanation}</p>
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
        )}

        {/* Ejercicios - Solo visible para admin/editor/soporte */}
        {canViewAnswers && exercises.length > 0 && (
          <div className="bg-white rounded-fluid-xl shadow-lg fluid-mb-8">
            <div className="fluid-px-6 fluid-py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="fluid-text-xl font-bold text-gray-900">
                Ejercicios ({summary.correct_exercises}/{summary.total_exercises} correctos)
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {exercises.map((exercise, index) => (
                <div key={exercise.exercise_id} className="fluid-p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 fluid-mr-4">
                      <div className={`w-10 h-10 rounded-fluid-lg flex items-center justify-center ${exercise.is_correct ? 'bg-purple-100' : 'bg-red-100'}`}>
                        <Target className={`fluid-icon ${exercise.is_correct ? 'text-purple-600' : 'text-red-600'}`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between fluid-mb-3">
                        <div className="flex items-center fluid-gap-3">
                          <span className="fluid-text-sm font-bold text-gray-900 bg-gray-100 fluid-px-3 fluid-py-1 rounded-full">
                            Ejercicio {index + 1}
                          </span>
                          <span className="inline-flex items-center fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-medium bg-purple-100 text-purple-800">
                            {exercise.total_score}/{exercise.max_score} acciones correctas
                          </span>
                        </div>
                        <button
                          onClick={() => toggleExercise(exercise.exercise_id)}
                          className="text-gray-500 hover:text-gray-700 fluid-p-1"
                        >
                          {expandedExercises[exercise.exercise_id] ? (
                            <ChevronUp className="fluid-icon" />
                          ) : (
                            <ChevronDown className="fluid-icon" />
                          )}
                        </button>
                      </div>
                      
                      <h3 className="fluid-text-lg font-medium text-gray-800 fluid-mb-2">{exercise.title}</h3>
                      
                      {/* Barra de progreso */}
                      <div className="w-full bg-gray-200 rounded-full h-2 fluid-mb-4">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            exercise.is_correct ? 'bg-purple-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${exercise.max_score > 0 ? (exercise.total_score / exercise.max_score) * 100 : 0}%` }}
                        />
                      </div>

                      {/* Detalle de pasos y acciones */}
                      {expandedExercises[exercise.exercise_id] && (
                        <div className="fluid-mt-4 flex flex-col fluid-gap-4">
                          {exercise.steps.map((step) => (
                            <div key={step.step_id} className="bg-gray-50 rounded-fluid-lg fluid-p-4">
                              <div className="flex items-center fluid-gap-2 fluid-mb-3">
                                <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold">
                                  {step.step_number}
                                </span>
                                <span className="font-medium text-gray-700">
                                  {step.title || `Paso ${step.step_number}`}
                                </span>
                                {step.is_correct ? (
                                  <CheckCircle className="fluid-icon-sm text-green-500 ml-auto" />
                                ) : (
                                  <XCircle className="fluid-icon-sm text-red-500 ml-auto" />
                                )}
                              </div>
                              
                              <div className="flex flex-col fluid-gap-2 ml-8">
                                {step.actions.map((action) => (
                                  <div
                                    key={action.action_id}
                                    className={`flex items-center justify-between fluid-p-3 rounded-fluid-lg ${
                                      action.is_correct ? 'bg-green-50' : 'bg-red-50'
                                    }`}
                                  >
                                    <div className="flex items-center fluid-gap-3">
                                      {action.action_type === 'button' ? (
                                        <MousePointer className="fluid-icon-sm text-gray-500" />
                                      ) : (
                                        <Type className="fluid-icon-sm text-gray-500" />
                                      )}
                                      <div>
                                        <span className="fluid-text-sm font-medium text-gray-700">
                                          {action.action_type === 'button' ? 'Clic' : 'Texto'} #{action.action_number}
                                        </span>
                                        {action.action_type === 'textbox' && (
                                          <div className="fluid-text-xs text-gray-600 mt-1">
                                            <span className="font-medium">Tu respuesta:</span> "{action.user_response || '(vacío)'}"
                                            {!action.is_correct && (
                                              <>
                                                <span className="mx-1">→</span>
                                                <span className="font-medium text-green-700">Correcto:</span> "{action.correct_answer}"
                                              </>
                                            )}
                                            {action.similarity !== undefined && (
                                              <span className="ml-2 text-blue-600">
                                                (Similitud: {action.similarity}%)
                                              </span>
                                            )}
                                          </div>
                                        )}
                                        {action.action_type === 'button' && (
                                          <div className="fluid-text-xs text-gray-600 mt-1">
                                            {action.user_response ? 'Clickeado' : 'No clickeado'}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {action.is_correct ? (
                                      <CheckCircle className="fluid-icon text-green-600" />
                                    ) : (
                                      <XCircle className="fluid-icon text-red-600" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row flex-wrap justify-center fluid-gap-4">
          <button
            onClick={() => navigate(canViewAnswers ? '/test-exams' : '/exams')}
            className="fluid-px-5 fluid-py-3 fluid-text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-fluid-lg hover:bg-gray-50 flex items-center justify-center shadow-sm"
          >
            <ArrowLeft className="fluid-icon-sm fluid-mr-2" />
            {canViewAnswers ? 'Volver a la Lista' : 'Volver a Exámenes'}
          </button>
          <button
            onClick={downloadPDFFromBackend}
            disabled={downloadingPdf || !resultId}
            className="fluid-px-5 fluid-py-3 fluid-text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-fluid-lg hover:from-blue-600 hover:to-blue-700 flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloadingPdf ? (
              <Loader2 className="fluid-icon-sm fluid-mr-2 animate-spin" />
            ) : (
              <Download className="fluid-icon-sm fluid-mr-2" />
            )}
            {downloadingPdf ? 'Generando...' : 'Descargar Reporte'}
          </button>
          {/* Botón Detalle del intento para candidatos */}
          {!canViewAnswers && resultId && (
            <button
              onClick={() => navigate(`/certificates/evaluation-report/${examId}/result/${resultId}`)}
              className="fluid-px-5 fluid-py-3 fluid-text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-fluid-lg hover:from-emerald-600 hover:to-emerald-700 flex items-center justify-center shadow-lg"
            >
              <FileText className="fluid-icon-sm fluid-mr-2" />
              Detalle del Intento
            </button>
          )}
          {/* Botón Reintentar solo para admin/editor/soporte */}
          {canViewAnswers && (
            <button
              onClick={() => navigate(`/test-exams/${examId}/run`, {
                state: {
                  questionCount: (location.state as any)?.questionCount || 0,
                  exerciseCount: (location.state as any)?.exerciseCount || 0
                }
              })}
              className="fluid-px-5 fluid-py-3 fluid-text-sm font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 rounded-fluid-lg hover:from-primary-600 hover:to-primary-700 flex items-center justify-center shadow-lg"
            >
              <RotateCcw className="fluid-icon-sm fluid-mr-2" />
              Reintentar Examen
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamTestResultsPage;
