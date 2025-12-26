import React, { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
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
  BookOpen
} from 'lucide-react';

// Función para traducir tipos de pregunta al español
const getQuestionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'true_false': 'Verdadero / Falso',
    'multiple_choice': 'Selección Única',
    'multiple_select': 'Selección Múltiple',
    'ordering': 'Ordenamiento'
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
  const { user } = useAuthStore();

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
  } | null;

  console.log('📊 evaluationResults:', state?.evaluationResults);
  console.log('📊 evaluationResults keys:', state?.evaluationResults ? Object.keys(state.evaluationResults) : 'N/A');

  const evaluationResults = state?.evaluationResults;
  const items = state?.items || [];
  const elapsedTime = state?.elapsedTime || 0;
  const examName = state?.examName || 'Examen';
  const passingScore = state?.passingScore ?? 60;

  // Si no hay resultados de evaluación, mostrar error con más información
  if (!evaluationResults) {
    console.error('❌ No se encontraron resultados de evaluación en el estado:', state);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error al cargar resultados</h2>
          <p className="text-gray-600 mb-4">No se pudieron obtener los resultados de la evaluación.</p>
          {state?.answers && (
            <p className="text-sm text-gray-500 mb-4">
              Se recibieron respuestas pero no los resultados evaluados.
              Por favor, intenta nuevamente.
            </p>
          )}
          <button
            onClick={() => navigate('/test-exams')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
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

  // Función para traducir rol a español
  const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
      'admin': 'Administrador',
      'editor': 'Editor',
      'soporte': 'Soporte',
      'alumno': 'Alumno',
      'auxiliar': 'Auxiliar'
    };
    return labels[role] || role;
  };

  // Función para generar número de referencia único
  const generateReferenceNumber = (): string => {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `EVA-${dateStr}-${randomPart}`;
  };

  // Función para generar el PDF de resultados por categoría y tema
  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = margin;

    // Generar número de referencia único
    const referenceNumber = generateReferenceNumber();

    // Calcular puntaje de 0 a 1000
    const score1000 = Math.round(summary.percentage * 10);

    // Determinar si aprobó o reprobó
    const isPassed = summary.percentage >= passingScore;

    // Función para agregar nueva página si es necesario
    const checkNewPage = (neededSpace: number) => {
      if (yPos + neededSpace > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };

    // Función para remover HTML tags
    const stripHtml = (html: string) => {
      const tmp = document.createElement('DIV');
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || '';
    };

    // ===== ENCABEZADO =====
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 37, 41);
    doc.text('CONSTANCIA DE EVALUACIÓN', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.text(examName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    // Línea decorativa
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 12;

    // ===== INFORMACIÓN DEL EVALUADO =====
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 48, 3, 3, 'F');
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('DATOS DEL EVALUADO', margin + 5, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);

    // Nombre
    doc.setFont('helvetica', 'bold');
    doc.text('Nombre:', margin + 5, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(user?.full_name || user?.name || 'No disponible', margin + 30, yPos);
    yPos += 7;

    // Rol
    doc.setFont('helvetica', 'bold');
    doc.text('Rol:', margin + 5, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(getRoleLabel(user?.role || 'alumno'), margin + 30, yPos);

    // Número de referencia (a la derecha)
    doc.setFont('helvetica', 'bold');
    doc.text('No. Referencia:', pageWidth / 2 + 10, yPos - 7);
    doc.setFont('helvetica', 'normal');
    doc.text(referenceNumber, pageWidth / 2 + 45, yPos - 7);

    // Fecha de aplicación (a la derecha) - formato dd/mm/yyyy
    const now = new Date();
    const fecha = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha:', pageWidth / 2 + 10, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(fecha, pageWidth / 2 + 28, yPos);

    yPos += 25;

    // ===== RESULTADO =====
    const resultBoxColor = isPassed ? [220, 252, 231] : [254, 226, 226]; // green-100 o red-100
    doc.setFillColor(resultBoxColor[0], resultBoxColor[1], resultBoxColor[2]);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 40, 3, 3, 'F');
    yPos += 12;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    if (isPassed) {
      doc.setTextColor(21, 128, 61); // green-700
    } else {
      doc.setTextColor(185, 28, 28); // red-700
    }
    doc.text('RESULTADO', margin + 5, yPos);

    // Badge de aprobado/reprobado
    const resultText = isPassed ? 'APROBADO' : 'REPROBADO';
    doc.setFontSize(16);
    doc.text(resultText, pageWidth - margin - 5 - doc.getTextWidth(resultText), yPos);
    yPos += 12;

    // Puntaje de 0-1000
    doc.setFontSize(28);
    doc.text(`${score1000}`, margin + 5, yPos);
    doc.setFontSize(12);
    doc.setTextColor(107, 114, 128);
    doc.text('/ 1000 puntos', margin + 35, yPos);

    // Porcentaje a la derecha
    doc.setFontSize(20);
    if (isPassed) {
      doc.setTextColor(21, 128, 61);
    } else {
      doc.setTextColor(185, 28, 28);
    }
    doc.text(`${summary.percentage}%`, pageWidth - margin - 25, yPos);

    yPos += 22;

    // ===== DETALLES =====
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(`Preguntas: ${summary.correct_questions}/${summary.total_questions}  |  Tiempo empleado: ${formatTime(elapsedTime)}  |  Puntaje mínimo para aprobar: ${passingScore}%`, margin, yPos);
    if (summary.total_exercises > 0) {
      yPos += 5;
      doc.text(`Ejercicios: ${summary.correct_exercises}/${summary.total_exercises}`, margin, yPos);
    }
    yPos += 12;

    // Calcular resultados por categoría y tema
    const categoryResults: Record<string, {
      topics: Record<string, { correct: number; total: number }>;
      correct: number;
      total: number;
    }> = {};

    // Debug: Log de items
    console.log('📋 PDF - Items recibidos:', items);
    console.log('📋 PDF - Items con topic_name:', items.map((i: any) => ({ type: i.type, category_name: i.category_name, topic_name: i.topic_name })));

    // Procesar items para agrupar por categoría y tema
    items.forEach((item: any) => {
      const categoryName = item.category_name || 'Sin categoría';
      const topicName = item.topic_name || 'Sin tema';
      
      if (!categoryResults[categoryName]) {
        categoryResults[categoryName] = { topics: {}, correct: 0, total: 0 };
      }
      if (!categoryResults[categoryName].topics[topicName]) {
        categoryResults[categoryName].topics[topicName] = { correct: 0, total: 0 };
      }

      // Encontrar el resultado de este item
      let isCorrect = false;
      if (item.type === 'question') {
        const questionResult = questions.find(q => String(q.question_id) === String(item.question_id || item.id));
        if (questionResult) {
          isCorrect = questionResult.is_correct;
        }
      } else if (item.type === 'exercise') {
        const exerciseResult = exercises.find(e => String(e.exercise_id) === String(item.exercise_id || item.id));
        if (exerciseResult) {
          isCorrect = exerciseResult.is_correct;
        }
      }

      categoryResults[categoryName].total++;
      categoryResults[categoryName].topics[topicName].total++;
      if (isCorrect) {
        categoryResults[categoryName].correct++;
        categoryResults[categoryName].topics[topicName].correct++;
      }
    });

    // Título de sección
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 37, 41);
    doc.text('RESULTADOS POR CATEGORÍA', margin, yPos);
    yPos += 10;

    // Iterar sobre cada categoría
    Object.entries(categoryResults).forEach(([categoryName, categoryData]) => {
      checkNewPage(40);
      
      // Calcular porcentaje de la categoría
      const categoryPercentage = categoryData.total > 0 
        ? Math.round((categoryData.correct / categoryData.total) * 100) 
        : 0;

      // Header de categoría
      if (categoryPercentage >= 60) {
        doc.setFillColor(220, 252, 231);
      } else {
        doc.setFillColor(254, 226, 226);
      }
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 12, 2, 2, 'F');
      yPos += 8;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      if (categoryPercentage >= 60) {
        doc.setTextColor(21, 128, 61);
      } else {
        doc.setTextColor(185, 28, 28);
      }
      doc.text(categoryName.toUpperCase(), margin + 5, yPos);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`${categoryPercentage}%`, pageWidth - margin - 20, yPos);
      yPos += 12;

      // Temas dentro de la categoría
      Object.entries(categoryData.topics).forEach(([topicName, topicData]) => {
        checkNewPage(15);
        
        const topicPercentage = topicData.total > 0 
          ? Math.round((topicData.correct / topicData.total) * 100) 
          : 0;

        // Indicador de color según porcentaje
        if (topicPercentage >= 80) {
          doc.setFillColor(34, 197, 94);
        } else if (topicPercentage >= 60) {
          doc.setFillColor(234, 179, 8);
        } else {
          doc.setFillColor(239, 68, 68);
        }
        doc.circle(margin + 8, yPos - 2, 2, 'F');

        // Nombre del tema
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        
        // Truncar nombre si es muy largo
        const maxTopicWidth = pageWidth - 2 * margin - 80;
        let displayTopicName = stripHtml(topicName);
        while (doc.getTextWidth(displayTopicName) > maxTopicWidth && displayTopicName.length > 10) {
          displayTopicName = displayTopicName.slice(0, -1);
        }
        if (displayTopicName !== topicName) displayTopicName += '...';
        
        doc.text(`  ${displayTopicName}`, margin + 12, yPos);
        
        // Porcentaje y aciertos
        if (topicPercentage >= 80) {
          doc.setTextColor(21, 128, 61);
        } else if (topicPercentage >= 60) {
          doc.setTextColor(161, 98, 7);
        } else {
          doc.setTextColor(185, 28, 28);
        }
        doc.setFont('helvetica', 'bold');
        doc.text(`${topicPercentage}%`, pageWidth - margin - 35, yPos);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(`(${topicData.correct}/${topicData.total})`, pageWidth - margin - 15, yPos);
        
        yPos += 8;
      });

      yPos += 5;
    });

    // Pie de página
    checkNewPage(25);
    yPos = pageHeight - 25;
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(156, 163, 175);
    doc.text('Documento generado automáticamente por Evaluaasi', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text(fecha, pageWidth / 2, yPos, { align: 'center' });

    // Descargar el PDF
    doc.save(`Resultados_Examen_${new Date().toISOString().split('T')[0]}.pdf`);
  };

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
          <div className="space-y-1">
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
            <div key={id} className="flex items-center text-sm mb-1">
              <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium mr-2">
                {index + 1}
              </span>
              <span dangerouslySetInnerHTML={{ __html: answer?.answer_text || id }} />
            </div>
          );
        });
        return <div>{orderedAnswers}</div>;

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
          <ul className="list-disc list-inside space-y-1">
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
          <div className="space-y-1">
            {orderedTexts.map((text: string, index: number) => (
              <div key={index} className="flex items-center text-sm">
                <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold mr-2">
                  {index + 1}
                </span>
                <span className="font-bold" dangerouslySetInnerHTML={{ __html: text }} />
              </div>
            ))}
          </div>
        );
      }

      default:
        return <span className="text-gray-500">-</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header con gradiente */}
      <div className={`bg-gradient-to-r ${getScoreBgColor(summary.percentage)} text-white`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Resultados del Examen</h1>
              <p className="text-white/80">Evaluación completada</p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold">{summary.percentage}%</div>
              <div className="text-white/80 text-sm">Calificación Final</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 -mt-12">
          <div className="bg-white rounded-xl shadow-lg p-5 border-t-4 border-gray-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Respuestas</p>
                <p className="text-2xl font-bold text-gray-700">{summary.earned_points}/{summary.total_points}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-t-4 border-primary-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Preguntas</p>
                <p className="text-2xl font-bold text-primary-600">{summary.correct_questions}/{summary.total_questions}</p>
              </div>
              <BookOpen className="w-8 h-8 text-primary-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-t-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ejercicios</p>
                <p className="text-2xl font-bold text-purple-600">{summary.correct_exercises}/{summary.total_exercises}</p>
              </div>
              <Target className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-t-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tiempo</p>
                <p className="text-2xl font-bold text-green-600">{formatTime(elapsedTime)}</p>
              </div>
              <Clock className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-t-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Errores</p>
                <p className="text-2xl font-bold text-red-600">
                  {(summary.total_questions - summary.correct_questions) + (summary.total_exercises - summary.correct_exercises)}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>

        {/* Preguntas */}
        {questions.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg mb-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Preguntas ({summary.correct_questions}/{summary.total_questions} correctas)
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {questions.map((result, index) => (
                <div key={result.question_id} className="p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${result.is_correct ? 'bg-green-100' : 'bg-red-100'}`}>
                        <BookOpen className={`w-5 h-5 ${result.is_correct ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                          Pregunta {index + 1}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                          {getQuestionTypeLabel(result.question_type)}
                        </span>
                        {result.score !== undefined && result.score > 0 && result.score < 1 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Puntuación parcial: {Math.round(result.score * 100)}%
                          </span>
                        )}
                      </div>
                      
                      <div
                        className="prose prose-sm max-w-none mb-4 text-gray-800"
                        dangerouslySetInnerHTML={{ __html: result.question_text }}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className={`p-4 rounded-xl ${result.is_correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                          <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                            <span className={`w-2 h-2 rounded-full mr-2 ${result.is_correct ? 'bg-green-500' : 'bg-red-500'}`} />
                            Tu respuesta:
                          </p>
                          <div className={result.is_correct ? 'text-green-900' : 'text-red-900'}>
                            {renderUserAnswer(result)}
                          </div>
                        </div>

                        {!result.is_correct && (
                          <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                            <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                              <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                              Respuesta correcta:
                            </p>
                            <div className="text-green-900">
                              {renderCorrectAnswer(result)}
                            </div>
                          </div>
                        )}
                      </div>

                      {result.explanation && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                          <div className="flex items-start">
                            <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-blue-900 mb-1">Explicación:</p>
                              <p className="text-sm text-blue-800">{result.explanation}</p>
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

        {/* Ejercicios */}
        {exercises.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg mb-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Ejercicios ({summary.correct_exercises}/{summary.total_exercises} correctos)
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {exercises.map((exercise, index) => (
                <div key={exercise.exercise_id} className="p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${exercise.is_correct ? 'bg-purple-100' : 'bg-red-100'}`}>
                        <Target className={`w-5 h-5 ${exercise.is_correct ? 'text-purple-600' : 'text-red-600'}`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                            Ejercicio {index + 1}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {exercise.total_score}/{exercise.max_score} acciones correctas
                          </span>
                        </div>
                        <button
                          onClick={() => toggleExercise(exercise.exercise_id)}
                          className="text-gray-500 hover:text-gray-700 p-1"
                        >
                          {expandedExercises[exercise.exercise_id] ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      
                      <h3 className="text-lg font-medium text-gray-800 mb-2">{exercise.title}</h3>
                      
                      {/* Barra de progreso */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            exercise.is_correct ? 'bg-purple-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${exercise.max_score > 0 ? (exercise.total_score / exercise.max_score) * 100 : 0}%` }}
                        />
                      </div>

                      {/* Detalle de pasos y acciones */}
                      {expandedExercises[exercise.exercise_id] && (
                        <div className="mt-4 space-y-4">
                          {exercise.steps.map((step) => (
                            <div key={step.step_id} className="bg-gray-50 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold">
                                  {step.step_number}
                                </span>
                                <span className="font-medium text-gray-700">
                                  {step.title || `Paso ${step.step_number}`}
                                </span>
                                {step.is_correct ? (
                                  <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500 ml-auto" />
                                )}
                              </div>
                              
                              <div className="space-y-2 ml-8">
                                {step.actions.map((action) => (
                                  <div
                                    key={action.action_id}
                                    className={`flex items-center justify-between p-3 rounded-lg ${
                                      action.is_correct ? 'bg-green-50' : 'bg-red-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      {action.action_type === 'button' ? (
                                        <MousePointer className="w-4 h-4 text-gray-500" />
                                      ) : (
                                        <Type className="w-4 h-4 text-gray-500" />
                                      )}
                                      <div>
                                        <span className="text-sm font-medium text-gray-700">
                                          {action.action_type === 'button' ? 'Clic' : 'Texto'} #{action.action_number}
                                        </span>
                                        {action.action_type === 'textbox' && (
                                          <div className="text-xs text-gray-600 mt-1">
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
                                          <div className="text-xs text-gray-600 mt-1">
                                            {action.user_response ? 'Clickeado' : 'No clickeado'}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {action.is_correct ? (
                                      <CheckCircle className="w-5 h-5 text-green-600" />
                                    ) : (
                                      <XCircle className="w-5 h-5 text-red-600" />
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
        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={() => navigate('/test-exams')}
            className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 flex items-center shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a la Lista
          </button>
          <button
            onClick={generatePDF}
            className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl hover:from-blue-600 hover:to-blue-700 flex items-center shadow-lg"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar Reporte PDF
          </button>
          <button
            onClick={() => navigate(`/test-exams/${examId}/run`, {
              state: {
                questionCount: (location.state as any)?.questionCount || 0,
                exerciseCount: (location.state as any)?.exerciseCount || 0
              }
            })}
            className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl hover:from-primary-600 hover:to-primary-700 flex items-center shadow-lg"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reintentar Examen
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamTestResultsPage;
