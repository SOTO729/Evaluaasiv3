/**
 * Página de vista previa del Material de Estudio
 * Diseño estilo Coursera para una experiencia de aprendizaje cómoda
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  getMaterial,
  getMaterialProgress,
  StudyMaterial,
  StudyInteractiveExerciseAction,
  registerContentProgress,
  MaterialProgressResponse,
  getVideoSignedUrlByTopic,
} from '../../services/studyContentService';
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  FileText,
  Video,
  Download,
  Gamepad2,
  PlayCircle,
  Menu,
  X,
  Check,
  RotateCcw,
  Image,
  Target,
  Clock,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import CustomVideoPlayer from '../../components/CustomVideoPlayer';
import { isAzureUrl } from '../../lib/urlHelpers';

// Función para calcular similitud entre dos strings (algoritmo de Levenshtein)
const calculateSimilarity = (str1: string, str2: string): number => {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 100;
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Crear matriz de distancias
  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Llenar la matriz
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // eliminación
        matrix[i][j - 1] + 1,      // inserción
        matrix[i - 1][j - 1] + cost // sustitución
      );
    }
  }
  
  // Calcular porcentaje de similitud
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  const similarity = Math.round(((maxLen - distance) / maxLen) * 100);
  
  return similarity;
};

const StudyContentPreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const materialId = Number(id);

  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'reading' | 'video' | 'downloadable' | 'interactive'>('reading');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set([0]));
  const [isScrolled, setIsScrolled] = useState(false);

  // Función para cambiar de tab y hacer scroll hacia arriba con título extendido
  const handleTabChange = (tab: 'reading' | 'video' | 'downloadable' | 'interactive') => {
    setActiveTab(tab);
    // Resetear el estado de scroll para mostrar el título extendido
    setIsScrolled(false);
    // Hacer scroll hacia arriba del contenedor principal
    if (mainContainerRef.current) {
      mainContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  // Estados para ejercicio interactivo
  const [exerciseStarted, setExerciseStarted] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepCompleted, setStepCompleted] = useState<Record<string, boolean>>({});
  const [actionResponses, setActionResponses] = useState<Record<string, any>>({});
  const [exerciseCompleted, setExerciseCompleted] = useState(false);
  const [exerciseScore, setExerciseScore] = useState<{ score: number; maxScore: number; percentage: number } | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, { message: string; attempts: number }>>({});
  const [showErrorModal, setShowErrorModal] = useState<{ message: string; actionKey: string } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const exerciseContainerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const instructionsRef = useRef<HTMLDivElement>(null);
  const startExerciseRef = useRef<HTMLDivElement>(null);
  const downloadButtonRef = useRef<HTMLDivElement>(null);
  const readingContentRef = useRef<HTMLDivElement>(null);
  const readingEndRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const sessionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [showDownloadScrollHint, setShowDownloadScrollHint] = useState(false);
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  const readingMarkedCompleteRef = useRef(false);
  
  // Estado para el tamaño de la ventana - para calcular altura de imagen responsiva
  const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
  
  // Calcular altura máxima de la imagen según el tamaño de pantalla
  const getImageMaxHeight = useCallback(() => {
    // Offsets más grandes para asegurar que la imagen quepa completa
    // Móvil: header(60) + tabs(50) + exercise-header(60) + step-nav(60) + bottom-bar(80) + margins(80) = ~390px
    // Más grande en móviles porque hay menos espacio vertical
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    
    let offset = 450; // default para móvil pequeño - más espacio
    if (width >= 1536) {
      offset = 350; // 2xl
    } else if (width >= 1280) {
      offset = 370; // xl
    } else if (width >= 1024) {
      offset = 390; // lg
    } else if (width >= 768) {
      offset = 410; // md
    } else if (width >= 640) {
      offset = 430; // sm
    }
    
    return Math.max(windowHeight - offset, 150); // mínimo 150px
  }, [windowHeight]);
  
  // Efecto para escuchar cambios en el tamaño de la ventana
  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);
    // Llamar una vez para establecer el valor inicial
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Estados de progreso del estudiante
  const [materialProgress, setMaterialProgress] = useState<MaterialProgressResponse | null>(null);
  const [completedContents, setCompletedContents] = useState<{
    reading: Set<number>;
    video: Set<number>;
    downloadable: Set<number>;
    interactive: Set<string>;
  }>({
    reading: new Set(),
    video: new Set(),
    downloadable: new Set(),
    interactive: new Set(),
  });
  
  // Estado para guardar las mejores calificaciones de ejercicios interactivos
  const [savedInteractiveScores, setSavedInteractiveScores] = useState<Record<string, number>>({});

  // Estado para URL de video con SAS token fresco
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);
  const [videoUrlLoading, setVideoUrlLoading] = useState(false);

  // Calcular el progreso total del material basado en contenidos completados
  const calculateMaterialProgress = () => {
    if (!materialProgress) return { completed: 0, total: 0, percentage: 0 };
    
    // Contar todos los contenidos completados de los sets locales
    const totalCompleted = 
      completedContents.reading.size + 
      completedContents.video.size + 
      completedContents.downloadable.size + 
      completedContents.interactive.size;
    
    return {
      completed: totalCompleted,
      total: materialProgress.total_contents,
      percentage: materialProgress.total_contents > 0 
        ? Math.round((totalCompleted / materialProgress.total_contents) * 100)
        : 0
    };
  };

  const progressStats = calculateMaterialProgress();

  // Handler para el scroll - con debounce para evitar bugs con rueda del ratón
  const isAnimatingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollTopRef = useRef(0);
  const animationDuration = 300; // Duración de la transición CSS
  const debounceDelay = 50; // Delay para debounce del scroll
  
  // Umbrales separados para evitar parpadeo (histéresis)
  const compressThreshold = 60;  // Comprimir cuando scroll > 60px
  const expandThreshold = 15;    // Expandir solo cuando scroll < 15px

  const handleMainScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    
    // Si está animando, ignorar completamente
    if (isAnimatingRef.current) {
      return;
    }
    
    // Guardar posición actual
    lastScrollTopRef.current = scrollTop;
    
    // Cancelar timeout anterior
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Debounce: esperar a que el scroll se estabilice
    scrollTimeoutRef.current = setTimeout(() => {
      const currentScrollTop = lastScrollTopRef.current;
      
      // Verificar si todavía no está animando
      if (isAnimatingRef.current) {
        return;
      }
      
      // Lógica con histéresis
      if (currentScrollTop <= expandThreshold && isScrolled) {
        // Cerca del top y comprimido - expandir
        isAnimatingRef.current = true;
        setIsScrolled(false);
        setTimeout(() => {
          isAnimatingRef.current = false;
        }, animationDuration);
      } else if (currentScrollTop >= compressThreshold && !isScrolled) {
        // Pasó el umbral de compresión y no está comprimido - comprimir
        isAnimatingRef.current = true;
        setIsScrolled(true);
        setTimeout(() => {
          isAnimatingRef.current = false;
        }, animationDuration);
      }
    }, debounceDelay);
  }, [isScrolled]);

  // Cargar material
  useEffect(() => {
    const loadMaterial = async () => {
      try {
        const data = await getMaterial(materialId);
        setMaterial(data);
        
        // Establecer la primera tab disponible
        if (data.sessions && data.sessions.length > 0) {
          const firstTopic = data.sessions[0].topics?.[0];
          if (firstTopic) {
            setFirstAvailableTab(firstTopic);
          }
        }
        
        // Cargar progreso del material completo
        try {
          const progress = await getMaterialProgress(materialId);
          setMaterialProgress(progress);
          
          // Inicializar los sets de contenidos completados desde el progreso del material
          // Los IDs vienen como strings del backend (content_id es VARCHAR), convertir a números para reading/video/downloadable
          if (progress.all_completed_contents) {
            setCompletedContents({
              reading: new Set((progress.all_completed_contents.reading || []).map(Number)),
              video: new Set((progress.all_completed_contents.video || []).map(Number)),
              downloadable: new Set((progress.all_completed_contents.downloadable || []).map(Number)),
              // Los IDs de ejercicios interactivos son UUIDs (strings)
              interactive: new Set((progress.all_completed_contents.interactive || []).map(String)),
            });
          }
          
          // Cargar scores de ejercicios interactivos
          if (progress.interactive_scores) {
            setSavedInteractiveScores(progress.interactive_scores);
          }
        } catch (progressError) {
          console.error('Error loading material progress:', progressError);
        }
      } catch (error) {
        console.error('Error loading material:', error);
      } finally {
        setLoading(false);
      }
    };
    loadMaterial();
  }, [materialId]);

  // Definir currentSession y currentTopic antes de usarlos en useEffect
  const currentSession = material?.sessions?.[currentSessionIndex];
  const currentTopic = currentSession?.topics?.[currentTopicIndex];

  // Función para registrar progreso de contenido
  const markContentCompleted = async (
    contentType: 'reading' | 'video' | 'downloadable' | 'interactive',
    contentId: number | string,
    score?: number
  ) => {
    try {
      await registerContentProgress(contentType, contentId, { 
        is_completed: true,
        score 
      });
      
      // Actualizar estado local (esto actualiza progressStats automáticamente)
      setCompletedContents(prev => ({
        ...prev,
        [contentType]: new Set([...prev[contentType], contentId])
      }));
      
      // Si es un ejercicio interactivo, actualizar el score guardado localmente
      if (contentType === 'interactive' && score !== undefined) {
        const exerciseIdStr = String(contentId);
        setSavedInteractiveScores(prev => {
          // Solo actualizar si es mejor que el score existente
          const currentScore = prev[exerciseIdStr];
          if (currentScore === undefined || score > currentScore) {
            return { ...prev, [exerciseIdStr]: score };
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error registering progress:', error);
    }
  };

  // Para YouTube/Vimeo, marcar como completado automáticamente al entrar a la pestaña de video
  useEffect(() => {
    if (activeTab === 'video' && currentTopic?.video) {
      const videoUrl = currentTopic.video.video_url;
      const isExternalVideo = videoUrl && !isAzureUrl(videoUrl);
      const isNotCompleted = !completedContents.video.has(currentTopic.video.id);
      
      if (isExternalVideo && isNotCompleted) {
        // Para YouTube/Vimeo - marcar como completado automáticamente al entrar
        setTimeout(() => {
          markContentCompleted('video', currentTopic.video!.id);
        }, 1000); // Delay breve para que el usuario vea el video cargando
      }
    }
  }, [activeTab, currentTopic?.video?.id]);

  // Obtener URL de video con SAS token fresco cuando se selecciona un video de Azure
  useEffect(() => {
    const loadSignedVideoUrl = async () => {
      if (activeTab !== 'video' || !currentTopic?.video) {
        setSignedVideoUrl(null);
        return;
      }

      const videoUrl = currentTopic.video.video_url;
      
      // Solo necesitamos obtener URL firmada para videos de Azure Blob Storage o CDN
      if (!isAzureUrl(videoUrl)) {
        setSignedVideoUrl(videoUrl);
        return;
      }

      setVideoUrlLoading(true);
      try {
        const response = await getVideoSignedUrlByTopic(currentTopic.id);
        setSignedVideoUrl(response.video_url);
      } catch (error) {
        console.error('Error getting signed video URL:', error);
        // En caso de error, usar la URL original (puede fallar si el SAS expiró)
        setSignedVideoUrl(videoUrl);
      } finally {
        setVideoUrlLoading(false);
      }
    };

    loadSignedVideoUrl();
  }, [activeTab, currentTopic?.id, currentTopic?.video?.id]);

  const setFirstAvailableTab = (topic: any) => {
    // Prioridad: Lectura > Video > Ejercicio > Recursos
    if (topic.allow_reading !== false && topic.reading) {
      setActiveTab('reading');
    } else if (topic.allow_video !== false && topic.video) {
      setActiveTab('video');
    } else if (topic.allow_interactive !== false && topic.interactive_exercise) {
      setActiveTab('interactive');
    } else if (topic.allow_downloadable !== false && topic.downloadable_exercise) {
      setActiveTab('downloadable');
    } else {
      // Si no hay ninguno con contenido, abrir lectura por defecto
      setActiveTab('reading');
    }
  };

  // Detectar si el botón de iniciar ejercicio no está visible en pantalla
  useEffect(() => {
    const container = mainContainerRef.current;
    
    const checkStartButtonVisibility = () => {
      if (activeTab === 'interactive' && !exerciseStarted && startExerciseRef.current && container) {
        const startRect = startExerciseRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        // Mostrar el hint si el botón de inicio NO está visible en el viewport
        const isButtonVisible = startRect.top < viewportHeight && startRect.bottom > 0;
        
        // También verificar si ya llegamos al fondo del scroll
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
        
        // Solo mostrar hint si el botón no es visible Y no estamos al fondo
        setShowScrollHint(!isButtonVisible && !isAtBottom);
      } else {
        setShowScrollHint(false);
      }
    };

    // Ejecutar después de un delay para asegurar que el DOM está renderizado
    const timeoutId = setTimeout(checkStartButtonVisibility, 300);
    
    // También ejecutar inmediatamente
    checkStartButtonVisibility();
    
    // Escuchar scroll del contenedor principal
    container?.addEventListener('scroll', checkStartButtonVisibility);
    window.addEventListener('resize', checkStartButtonVisibility);

    return () => {
      clearTimeout(timeoutId);
      container?.removeEventListener('scroll', checkStartButtonVisibility);
      window.removeEventListener('resize', checkStartButtonVisibility);
    };
  }, [activeTab, exerciseStarted, currentTopic]);

  // Detectar si el botón de descarga no está visible en pantalla
  useEffect(() => {
    const container = mainContainerRef.current;
    
    const checkDownloadButtonVisibility = () => {
      if (activeTab === 'downloadable' && downloadButtonRef.current && container) {
        const downloadRect = downloadButtonRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const isButtonVisible = downloadRect.top < viewportHeight && downloadRect.bottom > 0;
        
        // También verificar si ya llegamos al fondo del scroll
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
        
        // Solo mostrar hint si el botón no es visible Y no estamos al fondo
        setShowDownloadScrollHint(!isButtonVisible && !isAtBottom);
      } else {
        setShowDownloadScrollHint(false);
      }
    };

    const timeoutId = setTimeout(checkDownloadButtonVisibility, 300);
    checkDownloadButtonVisibility();
    
    // Escuchar scroll del contenedor principal
    container?.addEventListener('scroll', checkDownloadButtonVisibility);
    window.addEventListener('resize', checkDownloadButtonVisibility);

    return () => {
      clearTimeout(timeoutId);
      container?.removeEventListener('scroll', checkDownloadButtonVisibility);
      window.removeEventListener('resize', checkDownloadButtonVisibility);
    };
  }, [activeTab, currentTopic]);

  // Detectar cuando el usuario llega al final de la lectura para marcarla como completada
  useEffect(() => {
    // Reset cuando cambie el tema o la tab
    readingMarkedCompleteRef.current = false;
    
    if (activeTab !== 'reading' || !currentTopic?.reading) return;
    
    const readingId = currentTopic.reading.id;
    
    // Si ya está completada, no hacer nada
    if (completedContents.reading.has(readingId)) return;
    
    const checkReadingEnd = () => {
      if (!readingEndRef.current || readingMarkedCompleteRef.current) return;
      
      const endElement = readingEndRef.current;
      const rect = endElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // El elemento final está visible si está dentro del viewport
      // Consideramos visible si al menos parte del elemento está en pantalla
      const isEndVisible = rect.top < viewportHeight && rect.bottom > 0;
      
      console.log('Checking reading end:', { isEndVisible, rectTop: rect.top, rectBottom: rect.bottom, viewportHeight });
      
      if (isEndVisible && !readingMarkedCompleteRef.current) {
        readingMarkedCompleteRef.current = true;
        // Marcar como completado automáticamente
        console.log('Marking reading as complete:', readingId);
        markContentCompleted('reading', readingId);
      }
    };
    
    // Verificar inmediatamente (para lecturas cortas que caben en pantalla)
    const timeoutId = setTimeout(checkReadingEnd, 500);
    
    // Escuchar scroll en el contenedor main (tiene overflow-y-auto) y también en window
    const mainElement = mainContainerRef.current;
    if (mainElement) {
      mainElement.addEventListener('scroll', checkReadingEnd);
    }
    window.addEventListener('scroll', checkReadingEnd);
    window.addEventListener('resize', checkReadingEnd);
    
    // También verificar cada segundo como fallback
    const intervalId = setInterval(checkReadingEnd, 1000);
    
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      if (mainElement) {
        mainElement.removeEventListener('scroll', checkReadingEnd);
      }
      window.removeEventListener('scroll', checkReadingEnd);
      window.removeEventListener('resize', checkReadingEnd);
    };
  }, [activeTab, currentTopic?.reading?.id, completedContents.reading]);

  // Calcular progreso
  const getTotalTopics = () => {
    return material?.sessions?.reduce((acc, session) => acc + (session.topics?.length || 0), 0) || 0;
  };

  // Navegación
  const selectTopic = (sessionIdx: number, topicIdx: number) => {
    setCurrentSessionIndex(sessionIdx);
    setCurrentTopicIndex(topicIdx);
    const topic = material?.sessions?.[sessionIdx]?.topics?.[topicIdx];
    if (topic) {
      setFirstAvailableTab(topic);
    }
    // Reset estado del ejercicio interactivo al cambiar de tema
    resetExerciseState();
    // En móvil, cerrar sidebar
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // Funciones para ejercicio interactivo
  const resetExerciseState = () => {
    setExerciseStarted(false);
    setCurrentStepIndex(0);
    setStepCompleted({});
    setActionResponses({});
    setExerciseCompleted(false);
    setExerciseScore(null);
    setActionErrors({});
    setShowErrorModal(null);
    setImageDimensions(null);
  };

  // Función para calcular las dimensiones reales de la imagen renderizada
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // Obtener las dimensiones renderizadas de la imagen (no las naturales)
    setImageDimensions({
      width: img.clientWidth,
      height: img.clientHeight
    });
  };

  // Recalcular dimensiones cuando cambia el tamaño de la ventana
  useEffect(() => {
    const handleResize = () => {
      if (imageRef.current) {
        setImageDimensions({
          width: imageRef.current.clientWidth,
          height: imageRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Resetear dimensiones cuando cambia el paso
  useEffect(() => {
    setImageDimensions(null);
  }, [currentStepIndex]);

  const startExercise = () => {
    resetExerciseState();
    setExerciseStarted(true);
    // Scroll suave al inicio del contenedor principal para que el header sticky siga visible
    setTimeout(() => {
      mainContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  // Función para evaluar el ejercicio
  // evaluateExercise acepta un parámetro opcional con las respuestas actualizadas
  const evaluateExercise = (updatedResponses?: Record<string, any>) => {
    const exercise = currentTopic?.interactive_exercise;
    if (!exercise?.steps) return { score: 0, maxScore: 0, percentage: 0 };

    // Usar respuestas actualizadas si se proporcionan, sino usar el estado
    const responses = updatedResponses || actionResponses;

    let score = 0;
    let maxScore = 0;

    console.log('=== EVALUANDO EJERCICIO ===');
    console.log('responses:', responses);

    exercise.steps.forEach((step, stepIdx) => {
      console.log(`--- Step ${stepIdx + 1} (id: ${step.id}) ---`);
      step.actions?.forEach(action => {
        // Usar action.step_id para consistencia con handlers (handleTextSubmit, handleActionClick)
        const responseKey = `${action.step_id}_${action.id}`;
        const userResponse = responses[responseKey];

        console.log(`Action: type=${action.action_type}, id=${action.id}, step_id=${action.step_id}`);
        console.log(`  correct_answer=${action.correct_answer}, responseKey=${responseKey}, userResponse=${userResponse}`);

        if (action.action_type === 'button') {
          // Para botones, solo suma puntos si el botón es correcto (correct_answer = "true", "1", "correct")
          const isCorrectButton = action.correct_answer && 
            ['true', '1', 'correct', 'yes', 'si', 'sí'].includes(String(action.correct_answer).toLowerCase().trim());
          
          console.log(`  isCorrectButton=${isCorrectButton}`);
          
          if (isCorrectButton) {
            // Este botón es correcto, suma al maxScore
            maxScore += 1;
            // Si el usuario lo clickeó, suma puntos
            if (userResponse) score += 1;
            console.log(`  -> Botón correcto. maxScore=${maxScore}, score=${score}`);
          }
          // Los botones incorrectos no suman al maxScore ni al score
        } else if (action.action_type === 'text_input') {
          // Verificar si es un campo incorrecto (no suma puntos)
          const isWrongTextInput = action.correct_answer === 'wrong';
          if (isWrongTextInput) {
            // Los campos incorrectos no suman al maxScore ni al score (igual que botones incorrectos)
            return;
          }
          
          // Para inputs de texto correctos, comparar con respuesta correcta
          maxScore += 1;
          const correctAnswer = action.correct_answer || '';
          const isCaseSensitive = action.is_case_sensitive;
          const scoringMode = action.scoring_mode || 'exact';

          if (userResponse && correctAnswer) {
            // Extraer el valor si es un objeto (respuesta parcial o con similitud)
            const userText = typeof userResponse === 'object' 
              ? String(userResponse.value || '').trim() 
              : String(userResponse).trim();
            const correctText = String(correctAnswer).trim();
            const compareUser = isCaseSensitive ? userText : userText.toLowerCase();
            const compareCorrect = isCaseSensitive ? correctText : correctText.toLowerCase();

            console.log(`  text_input eval: userText="${userText}", correctText="${correctText}", mode=${scoringMode}`);
            console.log(`  compareUser="${compareUser}", compareCorrect="${compareCorrect}"`);

            // Verificar si la respuesta tiene formato de similitud (objeto con value y similarity)
            if (scoringMode === 'similarity' && typeof userResponse === 'object' && userResponse.similarity !== undefined) {
              // Usar el porcentaje de similitud guardado directamente
              score += userResponse.similarity / 100;
              console.log(`  -> Similarity mode (stored): ${userResponse.similarity}%`);
            } else if (scoringMode === 'similarity') {
              // Calcular similitud si no se guardó (respuesta parcial)
              const similarity = calculateSimilarity(compareUser, compareCorrect);
              score += similarity / 100;
              console.log(`  -> Similarity mode (calculated): ${similarity}%`);
            } else if (scoringMode === 'exact') {
              // 0% o 100% - debe coincidir exactamente
              const isMatch = compareUser === compareCorrect;
              if (isMatch) score += 1;
              console.log(`  -> Exact mode: match=${isMatch}, score=${score}`);
            } else if (scoringMode === 'contains') {
              const contains = compareUser.includes(compareCorrect);
              if (contains) score += 1;
              console.log(`  -> Contains mode: contains=${contains}, score=${score}`);
            }
          } else if (userResponse && !correctAnswer) {
            // Si no hay respuesta correcta definida pero el usuario escribi\u00f3 algo, es v\u00e1lido
            score += 1;
          }
        }
      });
    });

    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    return { score, maxScore, percentage };
  };

  // Función para completar el ejercicio y calcular puntuación
  // Acepta respuestas actualizadas para evitar problemas de sincronización de estado
  const completeExercise = async (updatedResponses?: Record<string, any>) => {
    const result = evaluateExercise(updatedResponses);
    setExerciseScore(result);
    setExerciseCompleted(true);
    
    // Registrar el progreso siempre (el backend guardará la mejor calificación)
    if (currentTopic?.interactive_exercise?.id) {
      const exerciseId = currentTopic.interactive_exercise.id;
      // Solo marcar como "completado" si es 100%
      const isCompleted = result.percentage >= 100;
      await registerContentProgress('interactive', exerciseId, { 
        is_completed: isCompleted,
        score: result.percentage 
      });
      
      // Actualizar el score local si es mejor
      setSavedInteractiveScores(prev => {
        const currentScore = prev[exerciseId];
        if (currentScore === undefined || result.percentage > currentScore) {
          return { ...prev, [exerciseId]: result.percentage };
        }
        return prev;
      });
      
      // Si 100%, agregar a completados (todas las respuestas deben ser correctas)
      if (isCompleted && !completedContents.interactive.has(exerciseId)) {
        setCompletedContents(prev => ({
          ...prev,
          interactive: new Set([...prev.interactive, exerciseId])
        }));
      }
    }
  };

  const handleActionClick = (action: StudyInteractiveExerciseAction, stepIndex: number) => {
    const exerciseId = currentTopic?.interactive_exercise?.id;
    if (!exerciseId) return;

    const actionKey = `${action.step_id}_${action.id}`;
    
    // Verificar si el botón es correcto
    const isCorrectButton = action.correct_answer && 
      ['true', '1', 'correct', 'yes', 'si', 'sí'].includes(String(action.correct_answer).toLowerCase().trim());

    if (isCorrectButton) {
      // Botón correcto - guardar respuesta y avanzar
      const newResponses = { ...actionResponses, [actionKey]: true };
      setActionResponses(newResponses);

      // Marcar paso como completado
      setStepCompleted(prev => ({
        ...prev,
        [`${exerciseId}_${stepIndex}`]: true
      }));

      // Avanzar al siguiente paso o completar ejercicio
      const steps = currentTopic?.interactive_exercise?.steps || [];
      if (stepIndex < steps.length - 1) {
        setTimeout(() => setCurrentStepIndex(stepIndex + 1), 300);
      } else {
        // Es el último paso, completar ejercicio con las respuestas actualizadas
        setTimeout(() => completeExercise(newResponses), 300);
      }
    } else {
      // Botón incorrecto - manejar según configuración
      const currentError = actionErrors[actionKey] || { message: '', attempts: 0 };
      const newAttempts = currentError.attempts + 1;
      // max_attempts son intentos ADICIONALES después del primer error
      const additionalAttempts = action.max_attempts ?? 1;
      const errorMessage = action.error_message || 'Respuesta incorrecta. Inténtalo de nuevo.';
      const onErrorAction = (action.on_error_action || 'next_step') as string;

      // Verificar si la acción es terminar ejercicio inmediatamente
      // Soportar ambos valores: 'end_exercise' (legacy) y 'next_exercise' (actual)
      if (onErrorAction === 'end_exercise' || onErrorAction === 'next_exercise') {
        // Cerrar modal y terminar ejercicio inmediatamente
        setShowErrorModal(null);
        const newResponses = { ...actionResponses, [actionKey]: false };
        setActionResponses(newResponses);
        setStepCompleted(prev => ({ ...prev, [`${exerciseId}_${stepIndex}`]: true }));
        setTimeout(() => completeExercise(newResponses), 300);
        return;
      }

      // Si la acción es pasar al siguiente paso (sin reintentos)
      if (onErrorAction === 'next_step') {
        // Marcar como completado (aunque incorrecto) y avanzar
        const newResponses = { ...actionResponses, [actionKey]: false };
        setActionResponses(newResponses);
        setStepCompleted(prev => ({ ...prev, [`${exerciseId}_${stepIndex}`]: true }));
        
        const steps = currentTopic?.interactive_exercise?.steps || [];
        if (stepIndex < steps.length - 1) {
          setTimeout(() => setCurrentStepIndex(stepIndex + 1), 300);
        } else {
          setTimeout(() => completeExercise(newResponses), 300);
        }
        return;
      }

      // Si es 'show_message' o cualquier otro valor - mostrar error con reintentos

      // Actualizar contador de intentos
      setActionErrors(prev => ({
        ...prev,
        [actionKey]: { message: errorMessage, attempts: newAttempts }
      }));

      // Mostrar modal de error
      setShowErrorModal({ message: errorMessage, actionKey });

      // Manejar acción si se agotaron los intentos adicionales
      // Agotar intentos cuando newAttempts supera los adicionales permitidos
      if (newAttempts > additionalAttempts) {
        // Cerrar modal inmediatamente
        setShowErrorModal(null);
        
        // Marcar como completado (aunque incorrecto)
        const newResponses = { ...actionResponses, [actionKey]: false };
        setActionResponses(newResponses);
        setStepCompleted(prev => ({ ...prev, [`${exerciseId}_${stepIndex}`]: true }));
        
        const steps = currentTopic?.interactive_exercise?.steps || [];
        if (stepIndex < steps.length - 1) {
          // Hay más pasos, avanzar al siguiente
          setTimeout(() => setCurrentStepIndex(stepIndex + 1), 300);
        } else {
          // Es el último paso, concluir ejercicio inmediatamente
          setTimeout(() => completeExercise(newResponses), 300);
        }
      }
    }
  };

  const handleTextSubmit = (action: StudyInteractiveExerciseAction, stepIndex: number, value: string) => {
    const exerciseId = currentTopic?.interactive_exercise?.id;
    if (!exerciseId || !value.trim()) return;

    const actionKey = `${action.step_id}_${action.id}`;
    const correctAnswer = action.correct_answer || '';
    const isCaseSensitive = action.is_case_sensitive;
    const scoringMode = action.scoring_mode || 'exact';

    const userText = value.trim();
    const correctText = correctAnswer.trim();
    const compareUser = isCaseSensitive ? userText : userText.toLowerCase();
    const compareCorrect = isCaseSensitive ? correctText : correctText.toLowerCase();

    // Modo similitud: siempre acepta la respuesta y guarda el porcentaje de similitud
    if (scoringMode === 'similarity' && correctText) {
      const similarityScore = calculateSimilarity(compareUser, compareCorrect);
      
      // Guardar respuesta con el porcentaje de similitud
      const newResponses = { ...actionResponses, [actionKey]: { value, similarity: similarityScore } };
      setActionResponses(newResponses);

      // Marcar paso como completado
      setStepCompleted(prev => ({
        ...prev,
        [`${exerciseId}_${stepIndex}`]: true
      }));

      // Avanzar al siguiente paso o completar ejercicio
      const steps = currentTopic?.interactive_exercise?.steps || [];
      if (stepIndex < steps.length - 1) {
        setTimeout(() => setCurrentStepIndex(stepIndex + 1), 300);
      } else {
        // Es el último paso, completar ejercicio
        setTimeout(() => completeExercise(newResponses), 300);
      }
      return;
    }

    // Para otros modos: verificar si la respuesta es correcta
    let isCorrect = false;

    if (correctText) {
      if (scoringMode === 'exact') {
        // 0% o 100% - debe coincidir exactamente
        isCorrect = compareUser === compareCorrect;
      } else if (scoringMode === 'contains') {
        isCorrect = compareUser.includes(compareCorrect);
      } else if (scoringMode === 'regex') {
        try {
          const regex = new RegExp(correctText, isCaseSensitive ? '' : 'i');
          isCorrect = regex.test(userText);
        } catch {
          isCorrect = false;
        }
      }
    } else {
      // Si no hay respuesta correcta definida, cualquier respuesta es válida
      isCorrect = true;
    }

    if (isCorrect) {
      // Respuesta correcta - guardar y avanzar
      const newResponses = { ...actionResponses, [actionKey]: value };
      setActionResponses(newResponses);

      // Marcar paso como completado
      setStepCompleted(prev => ({
        ...prev,
        [`${exerciseId}_${stepIndex}`]: true
      }));

      // Avanzar al siguiente paso o completar ejercicio
      const steps = currentTopic?.interactive_exercise?.steps || [];
      if (stepIndex < steps.length - 1) {
        setTimeout(() => setCurrentStepIndex(stepIndex + 1), 300);
      } else {
        // Es el último paso, completar ejercicio
        setTimeout(() => completeExercise(newResponses), 300);
      }
    } else {
      // Respuesta incorrecta - manejar según configuración
      const currentError = actionErrors[actionKey] || { message: '', attempts: 0 };
      const newAttempts = currentError.attempts + 1;
      // max_attempts son intentos ADICIONALES después del primer error
      const additionalAttempts = action.max_attempts ?? 1;
      const errorMessage = action.error_message || 'Respuesta incorrecta. Inténtalo de nuevo.';
      const onErrorAction = (action.on_error_action || 'next_step') as string;

      // Verificar si la acción es terminar ejercicio inmediatamente
      if (onErrorAction === 'end_exercise' || onErrorAction === 'next_exercise') {
        setShowErrorModal(null);
        const newResponses = { ...actionResponses, [actionKey]: value };
        setActionResponses(newResponses);
        setStepCompleted(prev => ({ ...prev, [`${exerciseId}_${stepIndex}`]: true }));
        setTimeout(() => completeExercise(newResponses), 300);
        return;
      }

      // Si la acción es pasar al siguiente paso (sin reintentos)
      if (onErrorAction === 'next_step') {
        const newResponses = { ...actionResponses, [actionKey]: value };
        setActionResponses(newResponses);
        setStepCompleted(prev => ({ ...prev, [`${exerciseId}_${stepIndex}`]: true }));
        
        const steps = currentTopic?.interactive_exercise?.steps || [];
        if (stepIndex < steps.length - 1) {
          setTimeout(() => setCurrentStepIndex(stepIndex + 1), 300);
        } else {
          setTimeout(() => completeExercise(newResponses), 300);
        }
        return;
      }

      // Si es 'show_message' o cualquier otro valor - mostrar error con reintentos
      setActionErrors(prev => ({
        ...prev,
        [actionKey]: { message: errorMessage, attempts: newAttempts }
      }));

      // Mostrar modal de error
      setShowErrorModal({ message: errorMessage, actionKey });

      // Manejar acción si se agotaron los intentos adicionales
      if (newAttempts > additionalAttempts) {
        setShowErrorModal(null);
        
        const newResponses = { ...actionResponses, [actionKey]: value };
        setActionResponses(newResponses);
        setStepCompleted(prev => ({ ...prev, [`${exerciseId}_${stepIndex}`]: true }));
        
        const steps = currentTopic?.interactive_exercise?.steps || [];
        if (stepIndex < steps.length - 1) {
          setTimeout(() => setCurrentStepIndex(stepIndex + 1), 300);
        } else {
          setTimeout(() => completeExercise(newResponses), 300);
        }
      }
    }
  };

  // Handler para guardar texto parcialmente (auto-save sin validación)
  const handleTextChange = useCallback((action: StudyInteractiveExerciseAction, _stepIndex: number, value: string) => {
    const exerciseId = currentTopic?.interactive_exercise?.id;
    if (!exerciseId || !value.trim()) return;

    const actionKey = `${action.step_id}_${action.id}`;
    
    console.log('handleTextChange - Guardando respuesta parcial:', actionKey, value);
    
    // Siempre guardar el valor actual (sobrescribir si ya existe una respuesta parcial)
    setActionResponses(prev => {
      const existing = prev[actionKey];
      // Si ya hay una respuesta completa (no parcial), no sobrescribir
      if (existing && typeof existing !== 'object') {
        console.log('  -> Ya existe respuesta completa, no sobrescribir');
        return prev;
      }
      if (existing && typeof existing === 'object' && !existing.partial) {
        console.log('  -> Ya existe respuesta con similarity, no sobrescribir');
        return prev;
      }
      console.log('  -> Guardando como respuesta parcial');
      return { ...prev, [actionKey]: { value, partial: true } };
    });
  }, [currentTopic?.interactive_exercise?.id]);

  const goToNextTopic = () => {
    const topicsInCurrentSession = currentSession?.topics?.length || 0;
    if (currentTopicIndex < topicsInCurrentSession - 1) {
      selectTopic(currentSessionIndex, currentTopicIndex + 1);
    } else if (currentSessionIndex < (material?.sessions?.length || 0) - 1) {
      setExpandedSessions(prev => new Set([...prev, currentSessionIndex + 1]));
      selectTopic(currentSessionIndex + 1, 0);
    }
  };

  const hasNextTopic = () => {
    const topicsInCurrentSession = currentSession?.topics?.length || 0;
    return currentTopicIndex < topicsInCurrentSession - 1 || currentSessionIndex < (material?.sessions?.length || 0) - 1;
  };

  const hasPreviousTopic = () => {
    return currentTopicIndex > 0 || currentSessionIndex > 0;
  };

  // Obtener los tabs disponibles para el tema actual en orden: Lectura > Video > Interactivo > Descargable
  const getAvailableTabs = (topic: any): Array<'reading' | 'video' | 'downloadable' | 'interactive'> => {
    if (!topic) return [];
    const tabs: Array<'reading' | 'video' | 'downloadable' | 'interactive'> = [];
    if (topic.allow_reading !== false && topic.reading) tabs.push('reading');
    if (topic.allow_video !== false && topic.video) tabs.push('video');
    if (topic.allow_interactive !== false && topic.interactive_exercise) tabs.push('interactive');
    if (topic.allow_downloadable !== false && topic.downloadable_exercise) tabs.push('downloadable');
    return tabs;
  };

  // Verificar si un tema tiene todos sus contenidos completados
  const isTopicCompleted = (topic: any): boolean => {
    if (!topic) return false;
    
    let hasContent = false;
    
    // Verificar lectura
    if (topic.allow_reading !== false && topic.reading) {
      hasContent = true;
      if (!completedContents.reading.has(topic.reading.id)) return false;
    }
    
    // Verificar video
    if (topic.allow_video !== false && topic.video) {
      hasContent = true;
      if (!completedContents.video.has(topic.video.id)) return false;
    }
    
    // Verificar ejercicio interactivo
    if (topic.allow_interactive !== false && topic.interactive_exercise) {
      hasContent = true;
      if (!completedContents.interactive.has(topic.interactive_exercise.id)) return false;
    }
    
    // Verificar descargable
    if (topic.allow_downloadable !== false && topic.downloadable_exercise) {
      hasContent = true;
      if (!completedContents.downloadable.has(topic.downloadable_exercise.id)) return false;
    }
    
    // Si no hay contenido, no está completado
    return hasContent;
  };

  // Verificar si una sesión tiene todos sus temas completados
  const isSessionCompleted = (session: any): boolean => {
    if (!session?.topics || session.topics.length === 0) return false;
    return session.topics.every((topic: any) => isTopicCompleted(topic));
  };

  // Navegar al siguiente contenido o tema
  const goToNextContent = () => {
    const availableTabs = getAvailableTabs(currentTopic);
    const currentTabIndex = availableTabs.indexOf(activeTab);
    
    if (currentTabIndex < availableTabs.length - 1) {
      // Hay más contenido en este tema, ir al siguiente tab
      setActiveTab(availableTabs[currentTabIndex + 1]);
      // Reset ejercicio si cambiamos de tab
      if (activeTab === 'interactive') {
        resetExerciseState();
      }
    } else {
      // Estamos en el último contenido, ir al siguiente tema
      goToNextTopic();
    }
  };

  // Navegar al contenido o tema anterior
  const goToPreviousContent = () => {
    const availableTabs = getAvailableTabs(currentTopic);
    const currentTabIndex = availableTabs.indexOf(activeTab);
    
    if (currentTabIndex > 0) {
      // Hay contenido anterior en este tema
      setActiveTab(availableTabs[currentTabIndex - 1]);
      // Reset ejercicio si cambiamos de tab
      if (activeTab === 'interactive') {
        resetExerciseState();
      }
    } else if (hasPreviousTopic()) {
      // Ir al tema anterior y seleccionar el último tab
      // Calculamos el tema anterior
      let prevSessionIdx = currentSessionIndex;
      let prevTopicIdx = currentTopicIndex - 1;
      
      if (currentTopicIndex === 0 && currentSessionIndex > 0) {
        prevSessionIdx = currentSessionIndex - 1;
        const prevSession = material?.sessions?.[prevSessionIdx];
        prevTopicIdx = (prevSession?.topics?.length || 1) - 1;
      }
      
      const prevTopic = material?.sessions?.[prevSessionIdx]?.topics?.[prevTopicIdx];
      const prevTabs = getAvailableTabs(prevTopic);
      
      setCurrentSessionIndex(prevSessionIdx);
      setCurrentTopicIndex(prevTopicIdx);
      resetExerciseState();
      
      if (prevTabs.length > 0) {
        setActiveTab(prevTabs[prevTabs.length - 1]);
      } else {
        setFirstAvailableTab(prevTopic);
      }
    }
  };

  // Verificar si hay siguiente contenido (dentro del tema o en otro tema)
  const hasNextContent = () => {
    const availableTabs = getAvailableTabs(currentTopic);
    const currentTabIndex = availableTabs.indexOf(activeTab);
    return currentTabIndex < availableTabs.length - 1 || hasNextTopic();
  };

  // Verificar si hay contenido anterior
  const hasPreviousContent = () => {
    const availableTabs = getAvailableTabs(currentTopic);
    const currentTabIndex = availableTabs.indexOf(activeTab);
    return currentTabIndex > 0 || hasPreviousTopic();
  };

  const toggleSession = (idx: number) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      const isExpanding = !newSet.has(idx);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      
      // Si se está expandiendo, hacer scroll para mostrar el contenido
      if (isExpanding) {
        setTimeout(() => {
          const sessionElement = sessionRefs.current.get(idx);
          if (sessionElement && sidebarScrollRef.current) {
            const container = sidebarScrollRef.current;
            const elementTop = sessionElement.offsetTop;
            
            // Calcular posición para mostrar el contenido expandido
            const scrollTarget = Math.max(0, elementTop - 60);
            
            container.scrollTo({
              top: scrollTarget,
              behavior: 'smooth'
            });
          }
        }, 50); // Pequeño delay para que el DOM se actualice
      }
      
      return newSet;
    });
  };

  // Obtener URL de video embed
  const getVideoEmbedUrl = (url: string) => {
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?\s]+)/);
    if (youtubeMatch) {
      // Usar el formato estándar de embed de YouTube
      return `https://www.youtube.com/embed/${youtubeMatch[1]}?feature=oembed`;
    }
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return url;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <LoadingSpinner message="Cargando contenido..." />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-red-600">Material no encontrado</p>
      </div>
    );
  }

  return (
    <div className="bg-white flex flex-col h-screen overflow-hidden">
      {/* Header minimalista - responsivo */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0 z-40">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8 2xl:px-10 h-10 sm:h-11 md:h-12 lg:h-14 xl:h-16 2xl:h-18">
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 flex-1 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden flex-shrink-0"
            >
              {sidebarOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
            <button
              onClick={() => navigate(`/study-contents/${materialId}`)}
              className="flex items-center gap-1 sm:gap-1.5 md:gap-2 lg:gap-2.5 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 xl:w-6 xl:h-6" />
              <span className="hidden sm:inline font-medium text-xs sm:text-sm md:text-base xl:text-lg">Volver</span>
            </button>
            <div className="h-4 sm:h-5 md:h-6 xl:h-7 w-px bg-gray-200 hidden sm:block flex-shrink-0" />
            <h1 className="font-semibold text-gray-900 truncate text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl max-w-[100px] xs:max-w-[140px] sm:max-w-[180px] md:max-w-[280px] lg:max-w-md xl:max-w-xl 2xl:max-w-2xl">
              {material.title}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0">
            {/* Progreso del material - visible en tablet y desktop */}
            <div className="hidden md:flex items-center gap-2 md:gap-3 xl:gap-4">
              <div className="w-20 md:w-28 lg:w-36 xl:w-48 2xl:w-56 h-1.5 md:h-2 xl:h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${progressStats.percentage}%` }}
                />
              </div>
              <span className="text-xs md:text-sm xl:text-base 2xl:text-lg font-medium text-blue-600">{progressStats.percentage}%</span>
            </div>
            {/* Progreso compacto en móvil */}
            <div className="flex md:hidden items-center">
              <span className="text-[10px] sm:text-xs font-medium text-blue-600 bg-blue-50 px-1.5 sm:px-2 py-0.5 rounded-full">{progressStats.percentage}%</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar - Navegación del curso */}
        <aside 
          className={`
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:min-w-0'}
            fixed lg:relative left-0 top-0 z-30 
            w-[85vw] max-w-[320px] sm:w-80 md:w-72 lg:w-72 xl:w-80 2xl:w-[380px]
            lg:min-w-[280px] xl:min-w-[320px] 2xl:min-w-[380px]
            bg-gray-50 border-r border-gray-200 
            transform transition-all duration-300 ease-in-out
            h-screen lg:h-auto lg:max-h-[calc(100vh-56px)] xl:lg:max-h-[calc(100vh-64px)]
            flex flex-col
          `}
        >
          {/* Header del sidebar - fijo */}
          <div className="p-3 sm:p-4 border-b border-gray-200 bg-white flex-shrink-0">
            <div className="text-blue-600 mb-0.5 sm:mb-1">
              <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wide">Contenido de estudio</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500">
              {material.sessions?.length || 0} sesiones · {getTotalTopics()} temas
            </p>
          </div>

          {/* Lista de sesiones y temas - scrolleable */}
          <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto min-h-0 scroll-smooth">
            <nav className="p-2 pb-20 lg:pb-16">
              {material.sessions?.map((session, sIdx) => {
                const sessionCompleted = isSessionCompleted(session);
                return (
                <div 
                  key={session.id} 
                  className="mb-1"
                  ref={(el) => {
                    if (el) sessionRefs.current.set(sIdx, el);
                  }}
                >
                  {/* Session header */}
                  <button
                    onClick={() => toggleSession(sIdx)}
                    className="w-full flex items-start gap-2 p-3 rounded-lg hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className={`transform transition-transform mt-0.5 flex-shrink-0 ${expandedSessions.has(sIdx) ? 'rotate-90' : ''}`}>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 break-words flex items-center gap-1.5">
                        <span className="text-gray-400">{session.session_number}.</span>
                        <span className="flex-1">{session.title}</span>
                      </p>
                    </div>
                    <span className={`text-xs flex-shrink-0 mt-0.5 ${sessionCompleted ? 'text-green-500 font-medium' : 'text-gray-400'}`}>
                      {session.topics?.length || 0}
                      {session.topics && session.topics.reduce((sum, t) => sum + (t.estimated_time_minutes || 0), 0) > 0 && (
                        <span className="ml-1">· {session.topics.reduce((sum, t) => sum + (t.estimated_time_minutes || 0), 0)}m</span>
                      )}
                    </span>
                  </button>

                  {/* Topics list */}
                  {expandedSessions.has(sIdx) && (
                    <div className="ml-4 border-l-2 border-gray-200">
                      {session.topics?.map((topic, tIdx) => {
                        const isActive = sIdx === currentSessionIndex && tIdx === currentTopicIndex;
                        const topicCompleted = isTopicCompleted(topic);
                        
                        return (
                          <button
                            key={topic.id}
                            onClick={() => selectTopic(sIdx, tIdx)}
                            className={`
                              w-full p-3 pl-4 text-left transition-colors
                              ${isActive 
                                ? 'bg-blue-50 border-l-2 border-blue-600 -ml-0.5' 
                                : 'hover:bg-gray-100 border-l-2 border-transparent -ml-0.5'
                              }
                            `}
                          >
                            <div className={`text-sm flex items-center gap-2 ${isActive ? 'font-medium text-blue-600' : 'text-gray-700'}`}>
                              <span className="flex-1">
                                <span className="text-gray-400 mr-1">{session.session_number}.{tIdx + 1}</span> {topic.title}
                              </span>               
                              {topic.estimated_time_minutes && (
                                <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                                  <Clock className="w-3 h-3" />
                                  {topic.estimated_time_minutes}m
                                </span>
                              )}
                              {topicCompleted && (
                                <span className="flex items-center justify-center w-2.5 h-2.5 bg-green-500 rounded-full flex-shrink-0">
                                  <Check className="w-1.5 h-1.5 text-white" strokeWidth={3} />
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
              })}
            </nav>
          </div>
        </aside>

        {/* Overlay para móvil */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/30 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Contenido principal */}
        <main ref={mainContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-white overscroll-contain" onScroll={handleMainScroll}>
          {/* Header sticky con título y pestañas - más compacto */}
          <div className={`sticky top-0 z-20 bg-white border-b border-gray-100 transition-all duration-300 ease-out ${isScrolled ? 'py-0.5' : ''}`}>
            <div className={`max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8 2xl:px-10 transition-all duration-300 ease-out ${isScrolled ? 'pt-0.5 pb-0' : 'pt-2 sm:pt-3 xl:pt-4 pb-0'}`}>
              {/* Breadcrumb - se oculta al hacer scroll */}
              <div className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-gray-500 transition-all duration-300 ease-out overflow-hidden ${isScrolled ? 'h-0 opacity-0 mb-0' : 'h-auto opacity-100 mb-1'}`}>
                <span className="truncate max-w-[80px] sm:max-w-[120px] md:max-w-none">{currentSession?.title}</span>
                <ChevronRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                <span className="text-gray-900 font-medium truncate">{currentTopic?.title}</span>
              </div>

              {/* Título del tema - más compacto */}
              <h1 className={`font-bold text-gray-900 transition-all duration-300 ease-out ${isScrolled ? 'text-[11px] sm:text-xs md:text-sm xl:text-base mb-0' : 'text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl mb-0.5 xl:mb-1'}`}>{currentTopic?.title}</h1>
              {/* Descripción - se oculta al hacer scroll */}
              {currentTopic?.description && (
                <p className={`text-gray-600 transition-all duration-300 ease-out overflow-hidden ${isScrolled ? 'h-0 opacity-0 mb-0' : 'text-[11px] sm:text-xs md:text-sm xl:text-base 2xl:text-lg h-auto opacity-100 mb-1.5 sm:mb-2 xl:mb-3'}`}>{currentTopic.description}</p>
              )}

              {/* Tabs de contenido - más compactas */}
              <div className={`border-b border-gray-200 transition-all duration-300 ease-out ${isScrolled ? 'mb-0 mt-0' : 'mb-1.5 sm:mb-2 md:mb-3 xl:mb-4 mt-1 sm:mt-1.5 md:mt-2 xl:mt-3'}`}>
                <nav className={`flex overflow-x-auto scrollbar-hide transition-all duration-300 ease-out ${isScrolled ? 'gap-1.5 sm:gap-2 xl:gap-3' : 'gap-2 sm:gap-3 md:gap-5 lg:gap-6 xl:gap-8 2xl:gap-10'}`}>
                  {currentTopic?.allow_reading !== false && (
                    <button
                      onClick={() => handleTabChange('reading')}
                      className={`text-xs sm:text-sm xl:text-base 2xl:text-lg font-medium border-b-2 transition-colors whitespace-nowrap ${isScrolled ? 'pb-1 sm:pb-1.5 xl:pb-2' : 'pb-1.5 sm:pb-2 xl:pb-3'} ${
                        activeTab === 'reading'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-1 sm:gap-1.5 xl:gap-2">
                        <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 xl:w-4 xl:h-4 2xl:w-5 2xl:h-5" />
                        <span className={isScrolled ? 'hidden sm:inline' : ''}>Lectura</span>
                        {currentTopic?.reading && completedContents.reading.has(currentTopic.reading.id) && (
                          <span className="flex items-center justify-center w-2 h-2 sm:w-2.5 sm:h-2.5 xl:w-3 xl:h-3 bg-green-500 rounded-full">
                            <Check className="w-1 h-1 sm:w-1.5 sm:h-1.5 xl:w-2 xl:h-2 text-white" strokeWidth={3} />
                          </span>
                        )}
                      </div>
                    </button>
                  )}
                  {currentTopic?.allow_video !== false && (
                    <button
                      onClick={() => handleTabChange('video')}
                      className={`text-xs sm:text-sm xl:text-base 2xl:text-lg font-medium border-b-2 transition-colors whitespace-nowrap ${isScrolled ? 'pb-1 sm:pb-1.5 xl:pb-2' : 'pb-1.5 sm:pb-2 xl:pb-3'} ${
                        activeTab === 'video'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-1 sm:gap-1.5 xl:gap-2">
                        <Video className="w-3 h-3 sm:w-3.5 sm:h-3.5 xl:w-4 xl:h-4 2xl:w-5 2xl:h-5" />
                        <span className={isScrolled ? 'hidden sm:inline' : ''}>Video</span>
                        {currentTopic?.video && completedContents.video.has(currentTopic.video.id) && (
                          <span className="flex items-center justify-center w-2 h-2 sm:w-2.5 sm:h-2.5 xl:w-3 xl:h-3 bg-green-500 rounded-full">
                            <Check className="w-1 h-1 sm:w-1.5 sm:h-1.5 xl:w-2 xl:h-2 text-white" strokeWidth={3} />
                          </span>
                        )}
                      </div>
                    </button>
                  )}
                  {currentTopic?.allow_interactive !== false && (
                    <button
                      onClick={() => handleTabChange('interactive')}
                      className={`text-xs sm:text-sm xl:text-base 2xl:text-lg font-medium border-b-2 transition-colors whitespace-nowrap ${isScrolled ? 'pb-1 sm:pb-1.5 xl:pb-2' : 'pb-1.5 sm:pb-2 xl:pb-3'} ${
                        activeTab === 'interactive'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-1 sm:gap-1.5 xl:gap-2">
                        <Gamepad2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 xl:w-4 xl:h-4 2xl:w-5 2xl:h-5" />
                        <span className={isScrolled ? 'hidden sm:inline' : ''}>Ejercicio</span>
                        {currentTopic?.interactive_exercise && completedContents.interactive.has(currentTopic.interactive_exercise.id) && (
                          <span className="flex items-center justify-center w-2 h-2 sm:w-2.5 sm:h-2.5 xl:w-3 xl:h-3 bg-green-500 rounded-full">
                            <Check className="w-1 h-1 sm:w-1.5 sm:h-1.5 xl:w-2 xl:h-2 text-white" strokeWidth={3} />
                          </span>
                        )}
                      </div>
                    </button>
                  )}
                  {currentTopic?.allow_downloadable !== false && (
                    <button
                      onClick={() => handleTabChange('downloadable')}
                      className={`text-xs sm:text-sm xl:text-base 2xl:text-lg font-medium border-b-2 transition-colors whitespace-nowrap ${isScrolled ? 'pb-1 sm:pb-1.5 xl:pb-2' : 'pb-1.5 sm:pb-2 xl:pb-3'} ${
                        activeTab === 'downloadable'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-1 sm:gap-1.5 xl:gap-2">
                        <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5 xl:w-4 xl:h-4 2xl:w-5 2xl:h-5" />
                        <span className={isScrolled ? 'hidden sm:inline' : ''}>Recursos</span>
                        {currentTopic?.downloadable_exercise && completedContents.downloadable.has(currentTopic.downloadable_exercise.id) && (
                          <span className="flex items-center justify-center w-2 h-2 sm:w-2.5 sm:h-2.5 xl:w-3 xl:h-3 bg-green-500 rounded-full">
                            <Check className="w-1 h-1 sm:w-1.5 sm:h-1.5 xl:w-2 xl:h-2 text-white" strokeWidth={3} />
                          </span>
                        )}
                      </div>
                    </button>
                  )}
                </nav>
              </div>
            </div>
          </div>

          {/* Contenido según tab activa */}
          <div className="max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8 2xl:px-10 pb-16 sm:pb-14 xl:pb-18">
            <div className="min-h-[200px] sm:min-h-[250px] md:min-h-[300px] lg:min-h-[350px] xl:min-h-[400px] 2xl:min-h-[450px]">
              {/* Video */}
              {activeTab === 'video' && (
                <div ref={videoContainerRef} className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl 2xl:max-w-4xl">
                  {currentTopic?.video ? (
                    <div className="space-y-2 sm:space-y-2.5">
                      {/* Título del video */}
                      <h2 className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl font-semibold text-gray-900 pb-1 sm:pb-1.5 xl:pb-2 border-b border-gray-300">{currentTopic.video.title}</h2>
                      
                      {/* Video container - responsivo según tipo de video */}
                      {isAzureUrl(currentTopic.video.video_url) ? (
                        // Contenedor para videos de Azure Blob/CDN
                        <div className="relative w-full bg-black rounded-md sm:rounded-lg lg:rounded-xl overflow-hidden shadow-md">
                          {/* Wrapper con aspect ratio 16:9, el video usa contain para ajustarse */}
                          <div className="relative w-full aspect-video">
                            {videoUrlLoading ? (
                              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                                <div className="text-center">
                                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                  <p className="text-gray-400 text-[10px] sm:text-xs">Cargando video...</p>
                                </div>
                              </div>
                            ) : signedVideoUrl ? (
                              <CustomVideoPlayer
                                src={signedVideoUrl}
                                className="absolute top-0 left-0 w-full h-full"
                                objectFit="contain"
                                onEnded={() => {
                                  if (currentTopic.video && !completedContents.video.has(currentTopic.video.id)) {
                                    markContentCompleted('video', currentTopic.video.id);
                                  }
                                }}
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                                <p className="text-gray-400 text-xs">Error al cargar el video</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        // Contenedor para YouTube/Vimeo - aspect ratio 16:9 responsivo
                        <div className="relative w-full bg-black rounded-md sm:rounded-lg lg:rounded-xl overflow-hidden shadow-md">
                          {/* Wrapper con aspect ratio 16:9 */}
                          <div className="relative w-full aspect-video">
                            <iframe
                              src={getVideoEmbedUrl(currentTopic.video.video_url)}
                              className="absolute inset-0 w-full h-full"
                              style={{ border: 'none' }}
                              allowFullScreen
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              referrerPolicy="strict-origin-when-cross-origin"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Descripción del video - abajo */}
                      {currentTopic.video.description && (
                        <div 
                          className="pt-2 sm:pt-3 text-gray-600 prose prose-sm max-w-none text-xs sm:text-sm"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTopic.video.description) }}
                        />
                      )}
                      
                      {/* Estado de completado del video */}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        {completedContents.video.has(currentTopic.video.id) ? (
                          <div className="flex items-center justify-center gap-1.5 py-2 px-3 bg-green-50 text-green-700 rounded-md sm:rounded-lg text-xs sm:text-sm">
                            <span className="flex items-center justify-center w-3 h-3 bg-green-500 rounded-full">
                              <Check className="w-1.5 h-1.5 text-white" strokeWidth={3} />
                            </span>
                            <span className="font-medium">Video completado</span>
                          </div>
                        ) : isAzureUrl(currentTopic.video.video_url) ? (
                          // Para videos blob/CDN - instrucción de ver completo
                          <div className="flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-50 text-gray-500 rounded-md sm:rounded-lg text-xs sm:text-sm">
                            <PlayCircle className="w-4 h-4" />
                            <span>Mira el video completo para marcarlo como completado</span>
                          </div>
                        ) : (
                          // Para YouTube/Vimeo - se marca automáticamente al entrar
                          <div className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 text-blue-600 rounded-md sm:rounded-lg text-xs sm:text-sm">
                            <Video className="w-4 h-4" />
                            <span>Marcando video como completado...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 sm:py-14 lg:py-20 text-gray-400">
                      <Video className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 mb-2 sm:mb-3 text-gray-300" />
                      <p className="text-sm sm:text-base lg:text-lg">No hay video disponible para este tema</p>
                    </div>
                  )}
                </div>
              )}

              {/* Lectura */}
              {activeTab === 'reading' && (
                <div ref={readingContentRef}>
                  {currentTopic?.reading ? (
                    <article className="w-full">
                      <h2 className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl font-semibold text-gray-900 pb-1 sm:pb-1.5 xl:pb-2 mb-1.5 sm:mb-2 xl:mb-3 border-b border-gray-300">{currentTopic.reading.title}</h2>
                      <div 
                        className="reading-content prose prose-sm xl:prose-base 2xl:prose-lg max-w-full prose-headings:text-gray-900 prose-headings:font-semibold prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:marker:text-gray-400 prose-img:max-w-full prose-pre:max-w-full prose-pre:overflow-x-auto [&_img]:rounded-lg [&_img]:my-2 text-xs sm:text-sm xl:text-base 2xl:text-lg"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTopic.reading.content || '') }}
                      />
                      
                      {/* Elemento invisible al final para detectar scroll */}
                      <div ref={readingEndRef} className="h-1" />
                      
                      {/* Estado de completado de la lectura */}
                      <div className="mt-4 sm:mt-5 lg:mt-6 xl:mt-8 pt-3 sm:pt-4 xl:pt-5 border-t border-gray-200">
                        {completedContents.reading.has(currentTopic.reading.id) ? (
                          <div className="flex items-center justify-center gap-1.5 sm:gap-2 xl:gap-3 py-2 sm:py-2.5 xl:py-3 px-3 sm:px-4 xl:px-6 bg-green-50 text-green-700 rounded-md sm:rounded-lg xl:rounded-xl text-xs sm:text-sm xl:text-base 2xl:text-lg">
                            <span className="flex items-center justify-center w-2.5 h-2.5 sm:w-3 sm:h-3 xl:w-4 xl:h-4 bg-green-500 rounded-full">
                              <Check className="w-1.5 h-1.5 sm:w-2 sm:h-2 xl:w-2.5 xl:h-2.5 text-white" strokeWidth={3} />
                            </span>
                            <span className="font-medium">Lectura completada</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 sm:gap-2 xl:gap-3 py-2 sm:py-2.5 xl:py-3 px-3 sm:px-4 xl:px-6 bg-gray-50 text-gray-500 rounded-md sm:rounded-lg xl:rounded-xl text-xs sm:text-sm xl:text-base 2xl:text-lg">
                            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 xl:w-5 xl:h-5" />
                            <span className="text-center">Lee hasta el final para marcar como completada</span>
                          </div>
                        )}
                      </div>
                    </article>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 sm:py-14 lg:py-20 xl:py-28 2xl:py-32 text-gray-400">
                      <FileText className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 2xl:w-20 2xl:h-20 mb-2 sm:mb-3 xl:mb-4 text-gray-300" />
                      <p className="text-sm sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl text-center">No hay contenido de lectura para este tema</p>
                    </div>
                  )}
                </div>
              )}

              {/* Descargable */}
              {activeTab === 'downloadable' && (
                <div>
                  {currentTopic?.downloadable_exercise ? (
                    <article className="w-full">
                      <h2 className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl font-semibold text-gray-900 pb-1 sm:pb-1.5 xl:pb-2 mb-1.5 sm:mb-2 xl:mb-3 border-b border-gray-300">{currentTopic.downloadable_exercise.title}</h2>
                      
                      {/* Instrucciones */}
                      {currentTopic.downloadable_exercise.description && (
                        <div className="bg-gray-50 rounded-md sm:rounded-lg p-2 sm:p-2.5 lg:p-3 border border-gray-200 mb-2 sm:mb-3">
                          <h3 className="text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1 sm:mb-1.5 flex items-center gap-1">
                            <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            Instrucciones
                          </h3>
                          <div 
                            className="reading-content prose prose-sm max-w-full prose-headings:text-gray-900 prose-headings:font-semibold prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:marker:text-gray-400 text-xs sm:text-sm"
                            style={{ wordBreak: 'normal', overflowWrap: 'anywhere' }}
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTopic.downloadable_exercise.description.replace(/\u00a0/g, ' ')) }}
                          />
                        </div>
                      )}
                      
                      {/* Botón circular para scroll hacia abajo */}
                      {showDownloadScrollHint && (
                        <div className="fixed bottom-16 sm:bottom-18 right-3 sm:right-4 z-50">
                          <button
                            onClick={() => {
                              downloadButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 border-2 border-white animate-bounce-in"
                            title="Ver sección de descarga"
                          >
                            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      )}
                      
                      {/* Botón de descarga */}
                      <div ref={downloadButtonRef} className="bg-blue-50 rounded-md sm:rounded-lg p-2 sm:p-2.5 lg:p-3 border border-blue-200">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="p-1 sm:p-1.5 bg-blue-100 rounded-md flex-shrink-0">
                              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-blue-900 text-[11px] sm:text-xs">Archivo listo para descargar</p>
                              <p className="text-[10px] sm:text-xs text-blue-600 truncate">{currentTopic.downloadable_exercise.file_name}</p>
                            </div>
                          </div>
                          <a
                            href={currentTopic.downloadable_exercise.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              // Registrar progreso cuando se descarga
                              if (currentTopic.downloadable_exercise && !completedContents.downloadable.has(currentTopic.downloadable_exercise.id)) {
                                markContentCompleted('downloadable', currentTopic.downloadable_exercise.id);
                              }
                            }}
                            className="px-2 sm:px-2.5 py-1 sm:py-1.5 bg-blue-600 text-white text-[11px] sm:text-xs rounded-md font-medium hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            Descargar
                          </a>
                        </div>
                      </div>
                      
                      {/* Estado de completado del descargable */}
                      {completedContents.downloadable.has(currentTopic.downloadable_exercise.id) && (
                        <div className="mt-2 sm:mt-3 flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-2 sm:px-3 bg-green-50 text-green-700 rounded-md sm:rounded-lg text-xs">
                          <span className="flex items-center justify-center w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full">
                            <Check className="w-1.5 h-1.5 text-white" strokeWidth={3} />
                          </span>
                          <span className="font-medium text-[11px] sm:text-xs">Archivo descargado</span>
                        </div>
                      )}
                    </article>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 sm:py-14 text-gray-400">
                      <Download className="w-10 h-10 sm:w-12 sm:h-12 mb-2 sm:mb-3 text-gray-300" />
                      <p className="text-xs sm:text-sm">No hay ejercicio descargable para este tema</p>
                    </div>
                  )}
                </div>
              )}

              {/* Interactivo */}
              {activeTab === 'interactive' && (
                <div ref={exerciseContainerRef}>
                  {currentTopic?.interactive_exercise ? (
                    !exerciseStarted ? (
                      // Vista inicial - Comenzar ejercicio (estilo minimalista)
                      <article className="w-full">
                        <h2 className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl font-semibold text-gray-900 pb-1 sm:pb-1.5 lg:pb-2 xl:pb-3 mb-1.5 sm:mb-2 lg:mb-3 xl:mb-4 border-b border-gray-300">{currentTopic.interactive_exercise.title}</h2>
                        
                        {/* Instrucciones */}
                        {currentTopic.interactive_exercise.description && (
                          <div ref={instructionsRef} className="bg-gray-50 rounded-md sm:rounded-lg xl:rounded-xl p-2 sm:p-2.5 lg:p-3 xl:p-4 2xl:p-5 border border-gray-200 mb-2 sm:mb-3 lg:mb-4 xl:mb-5 relative">
                            <h3 className="text-[10px] sm:text-xs lg:text-sm xl:text-base font-semibold text-gray-700 uppercase tracking-wide mb-1 sm:mb-1.5 lg:mb-2 xl:mb-3 flex items-center gap-1 lg:gap-1.5 xl:gap-2">
                              <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5" />
                              Instrucciones
                            </h3>
                            <div 
                              className="reading-content prose prose-sm xl:prose-base 2xl:prose-lg max-w-full prose-headings:text-gray-900 prose-headings:font-semibold prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:marker:text-gray-400 text-xs sm:text-sm lg:text-base xl:text-lg"
                              style={{ wordBreak: 'normal', overflowWrap: 'anywhere' }}
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTopic.interactive_exercise.description.replace(/\u00a0/g, ' ')) }}
                            />
                          </div>
                        )}
                        
                        {/* Botón circular para scroll hacia abajo - posición fija a la derecha */}
                        {showScrollHint && (
                          <div className="fixed bottom-16 sm:bottom-18 lg:bottom-20 xl:bottom-24 2xl:bottom-28 right-3 sm:right-4 lg:right-6 xl:right-8 2xl:right-10 z-50">
                            <button
                              onClick={() => {
                                startExerciseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                              className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 xl:w-10 xl:h-10 2xl:w-12 2xl:h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 border-2 border-white animate-bounce-in"
                              title="Ver sección para iniciar ejercicio"
                            >
                              <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6" />
                            </button>
                          </div>
                        )}
                        
                        {/* Botón para comenzar - Diseño llamativo */}
                        <div ref={startExerciseRef} className="bg-blue-50 rounded-md sm:rounded-lg xl:rounded-xl p-2 sm:p-2.5 lg:p-3 xl:p-4 2xl:p-5 border border-blue-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 xl:gap-4">
                              <div className="p-1 sm:p-1.5 lg:p-2 xl:p-2.5 bg-blue-100 rounded-md lg:rounded-lg">
                                <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6 2xl:w-7 2xl:h-7 text-blue-600" />
                              </div>
                              <p className="font-medium text-blue-900 text-[11px] sm:text-xs lg:text-sm xl:text-base 2xl:text-lg">Listo para comenzar</p>
                            </div>
                            <button
                              onClick={startExercise}
                              disabled={!currentTopic.interactive_exercise.steps?.length}
                              className="px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6 py-1 sm:py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 bg-blue-600 text-white text-[11px] sm:text-xs lg:text-sm xl:text-base 2xl:text-lg rounded-md lg:rounded-lg xl:rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-1 lg:gap-1.5 xl:gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <PlayCircle className="w-3.5 h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                              Comenzar
                            </button>
                          </div>
                        </div>
                        
                        {/* Estado de completado / mejor calificación del ejercicio interactivo */}
                        <div className="mt-2 sm:mt-3 lg:mt-4 xl:mt-5 pt-2 sm:pt-3 lg:pt-4 xl:pt-5 border-t border-gray-200">
                          {currentTopic.interactive_exercise.id && savedInteractiveScores[currentTopic.interactive_exercise.id] !== undefined ? (
                            savedInteractiveScores[currentTopic.interactive_exercise.id] >= 100 ? (
                              <div className="flex items-center justify-center gap-1.5 lg:gap-2 xl:gap-3 py-1.5 sm:py-2 lg:py-2.5 xl:py-3 px-2 sm:px-3 lg:px-4 xl:px-5 bg-green-50 text-green-700 rounded-md sm:rounded-lg xl:rounded-xl text-xs lg:text-sm xl:text-base">
                                <span className="flex items-center justify-center w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4 xl:w-5 xl:h-5 bg-green-500 rounded-full">
                                  <Check className="w-1.5 h-1.5 sm:w-2 sm:h-2 lg:w-2.5 lg:h-2.5 xl:w-3 xl:h-3 text-white" strokeWidth={3} />
                                </span>
                                <span className="font-medium text-[11px] sm:text-xs lg:text-sm xl:text-base 2xl:text-lg">Ejercicio completado</span>
                                <span className="text-green-600 font-bold ml-1 text-[11px] sm:text-xs lg:text-sm xl:text-base 2xl:text-lg">({Math.round(savedInteractiveScores[currentTopic.interactive_exercise.id])}%)</span>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row items-center justify-center gap-1 lg:gap-2 py-1.5 sm:py-2 lg:py-2.5 xl:py-3 px-2 sm:px-3 lg:px-4 xl:px-5 bg-amber-50 text-amber-700 rounded-md sm:rounded-lg xl:rounded-xl">
                                <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6" />
                                <span className="text-[10px] sm:text-xs lg:text-sm xl:text-base text-center">Tu mejor calificación: <strong>{Math.round(savedInteractiveScores[currentTopic.interactive_exercise.id])}%</strong> - Obtén 80% o más para completar</span>
                              </div>
                            )
                          ) : (
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-1 lg:gap-2 py-1.5 sm:py-2 lg:py-2.5 xl:py-3 px-2 sm:px-3 lg:px-4 xl:px-5 bg-gray-50 text-gray-500 rounded-md sm:rounded-lg xl:rounded-xl">
                              <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6" />
                              <span className="text-[10px] sm:text-xs lg:text-sm xl:text-base text-center">Completa el ejercicio con 80% o más para marcarlo como completado</span>
                            </div>
                          )}
                        </div>
                        
                        {!currentTopic.interactive_exercise.steps?.length && (
                          <p className="text-amber-600 text-[10px] sm:text-xs lg:text-sm xl:text-base mt-2 sm:mt-3 lg:mt-4 flex items-center gap-1.5 lg:gap-2">
                            <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 lg:w-2 lg:h-2 bg-amber-500 rounded-full"></span>
                            Este ejercicio aún no tiene pasos configurados
                          </p>
                        )}
                      </article>
                    ) : exerciseCompleted ? (
                      // Vista de ejercicio completado con calificación
                      <div className={`rounded-md sm:rounded-lg xl:rounded-xl 2xl:rounded-2xl p-3 sm:p-4 lg:p-6 xl:p-8 2xl:p-10 text-center ${
                        exerciseScore && exerciseScore.percentage >= 100 
                          ? 'bg-gradient-to-br from-green-50 to-emerald-50' 
                          : 'bg-gradient-to-br from-amber-50 to-orange-50'
                      }`}>
                        {/* Círculo con calificación */}
                        <div className="relative inline-flex items-center justify-center mb-2 sm:mb-3 lg:mb-4 xl:mb-6">
                          <svg className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 xl:w-32 xl:h-32 2xl:w-40 2xl:h-40 transform -rotate-90">
                            <circle
                              cx="50%"
                              cy="50%"
                              r="42%"
                              stroke="currentColor"
                              strokeWidth="5"
                              fill="none"
                              className="text-gray-200"
                            />
                            <circle
                              cx="50%"
                              cy="50%"
                              r="42%"
                              stroke="currentColor"
                              strokeWidth="5"
                              fill="none"
                              strokeDasharray={`${(exerciseScore?.percentage || 0) * 2.64} 264`}
                              className={exerciseScore && exerciseScore.percentage >= 100 ? 'text-green-500' : 'text-amber-500'}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-base sm:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl font-bold ${
                              exerciseScore && exerciseScore.percentage >= 100 ? 'text-green-600' : 'text-amber-600'
                            }`}>
                              {exerciseScore?.percentage || 0}%
                            </span>
                            <span className="text-[10px] sm:text-xs lg:text-sm xl:text-base text-gray-500">
                              {exerciseScore?.score || 0}/{exerciseScore?.maxScore || 0}
                            </span>
                          </div>
                        </div>

                        <h2 className="text-sm sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl font-bold text-gray-900 mb-0.5 sm:mb-1 lg:mb-2">
                          {exerciseScore && exerciseScore.percentage >= 100 
                            ? '¡Excelente trabajo!' 
                            : 'Sigue practicando'}
                        </h2>
                        <p className="text-gray-600 text-[11px] sm:text-xs lg:text-sm xl:text-base 2xl:text-lg mb-0.5 lg:mb-1">
                          Has completado el ejercicio "{currentTopic.interactive_exercise.title}"
                        </p>
                        <p className={`text-[10px] sm:text-xs lg:text-sm xl:text-base mb-2 sm:mb-3 lg:mb-4 xl:mb-5 ${
                          exerciseScore && exerciseScore.percentage >= 100 ? 'text-green-600' : 'text-amber-600'
                        }`}>
                          {exerciseScore && exerciseScore.percentage >= 100 
                            ? '¡Perfecto! Todas las respuestas correctas'
                            : 'Necesitas 100% para completar este ejercicio'}
                        </p>

                        <div className="flex flex-col sm:flex-row justify-center gap-1.5 sm:gap-2 lg:gap-3 xl:gap-4">
                          <button
                            onClick={resetExerciseState}
                            className="px-2.5 sm:px-3 lg:px-4 xl:px-6 2xl:px-8 py-1 sm:py-1.5 lg:py-2 xl:py-3 2xl:py-4 bg-white text-gray-700 text-[11px] sm:text-xs lg:text-sm xl:text-base 2xl:text-lg rounded-md sm:rounded-lg xl:rounded-xl font-medium hover:bg-gray-100 transition-colors inline-flex items-center justify-center gap-1 sm:gap-1.5 lg:gap-2 border border-gray-300"
                          >
                            <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5" />
                            Practicar de nuevo
                          </button>
                          {hasNextContent() && (
                            <button
                              onClick={goToNextContent}
                              className={`px-2.5 sm:px-3 lg:px-4 xl:px-6 2xl:px-8 py-1 sm:py-1.5 lg:py-2 xl:py-3 2xl:py-4 text-white text-[11px] sm:text-xs lg:text-sm xl:text-base 2xl:text-lg rounded-md sm:rounded-lg xl:rounded-xl font-medium transition-colors inline-flex items-center justify-center gap-1 sm:gap-1.5 lg:gap-2 ${
                                exerciseScore && exerciseScore.percentage >= 100 
                                  ? 'bg-green-600 hover:bg-green-700' 
                                  : 'bg-amber-500 hover:bg-amber-600'
                              }`}
                            >
                              Continuar
                              <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      // Vista de ejecución del ejercicio - Pasos (diseño profesional)
                      <div 
                        className="flex flex-col gap-1.5 sm:gap-2 lg:gap-3" 
                      >
                        {(() => {
                          const steps = currentTopic.interactive_exercise.steps || [];
                          const currentStep = steps[currentStepIndex];
                          const exerciseId = currentTopic.interactive_exercise.id;
                          const isStepDone = stepCompleted[`${exerciseId}_${currentStepIndex}`];

                          if (!currentStep) {
                            return (
                              <div className="text-center py-4 sm:py-6 lg:py-8">
                                <Image className="w-8 h-8 sm:w-10 sm:w-10 lg:w-12 lg:h-12 mx-auto text-gray-300 mb-1.5 sm:mb-2 lg:mb-3" />
                                <p className="text-gray-500 text-[11px] sm:text-xs lg:text-sm">Este ejercicio no tiene pasos configurados</p>
                              </div>
                            );
                          }

                          return (
                            <>
                              {/* Header del ejercicio con progreso */}
                              <div className="bg-white border border-gray-200 rounded-md sm:rounded-lg lg:rounded-xl xl:rounded-2xl shadow-sm overflow-hidden flex-shrink-0">
                                <div className="flex items-center justify-between px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6 py-1.5 sm:py-2 lg:py-3 xl:py-4 2xl:py-5">
                                  <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 xl:gap-4 min-w-0 flex-1">
                                    <div className="p-1 sm:p-1.5 lg:p-2 xl:p-2.5 2xl:p-3 bg-blue-100 rounded-md lg:rounded-lg xl:rounded-xl flex-shrink-0">
                                      <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6 2xl:w-7 2xl:h-7 text-blue-600" />
                                    </div>
                                    <h3 className="font-semibold text-gray-900 text-xs sm:text-sm lg:text-base xl:text-lg 2xl:text-xl truncate">{currentTopic.interactive_exercise.title}</h3>
                                  </div>
                                  <button
                                    onClick={resetExerciseState}
                                    className="p-1 sm:p-1.5 lg:p-2 xl:p-2.5 2xl:p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md lg:rounded-lg xl:rounded-xl transition-colors flex-shrink-0"
                                    title="Salir del ejercicio"
                                  >
                                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6 2xl:w-7 2xl:h-7" />
                                  </button>
                                </div>
                              </div>

                              {/* Instrucciones del ejercicio - colapsables */}
                              {currentTopic.interactive_exercise.description && (
                                <div className="bg-blue-50 border border-blue-200 rounded-md sm:rounded-lg lg:rounded-xl xl:rounded-2xl overflow-hidden flex-shrink-0">
                                  <button
                                    onClick={() => setInstructionsExpanded(!instructionsExpanded)}
                                    className="w-full flex items-center justify-between px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6 py-1.5 sm:py-2 lg:py-3 xl:py-4 2xl:py-5 hover:bg-blue-100/50 transition-colors"
                                  >
                                    <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 xl:gap-3">
                                      <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6 text-blue-600" />
                                      <span className="text-[11px] sm:text-xs lg:text-sm xl:text-base 2xl:text-lg font-medium text-blue-800">Instrucciones</span>
                                    </div>
                                    <ChevronDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6 text-blue-600 transition-transform ${instructionsExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                  {instructionsExpanded && (
                                    <div className="px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6 pb-2 sm:pb-3 lg:pb-4 xl:pb-5 2xl:pb-6 border-t border-blue-200">
                                      <div 
                                        className="prose prose-sm max-w-none text-blue-900 reading-content pt-1.5 sm:pt-2 lg:pt-3 xl:pt-4 text-xs sm:text-sm lg:text-base xl:text-lg"
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTopic.interactive_exercise.description.replace(/\u00a0/g, ' ')) }}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Área de la imagen con acciones superpuestas */}
                              <div className="flex items-center justify-center">
                                <div 
                                  ref={imageContainerRef}
                                  className="relative bg-white rounded-md sm:rounded-lg lg:rounded-xl xl:rounded-2xl border border-gray-200"
                                >
                                  {currentStep.image_url ? (
                                    <>
                                      <img
                                        ref={imageRef}
                                        src={currentStep.image_url}
                                        alt={currentStep.title || `Paso ${currentStepIndex + 1}`}
                                        className="block rounded-md sm:rounded-lg lg:rounded-xl xl:rounded-2xl"
                                        style={{
                                          maxHeight: `${getImageMaxHeight()}px`,
                                          maxWidth: 'calc(100vw - 80px)',
                                          width: 'auto',
                                          height: 'auto',
                                        }}
                                        onLoad={handleImageLoad}
                                      />
                                      {/* Contenedor de acciones que coincide exactamente con la imagen */}
                                      {imageDimensions && (
                                        <div
                                          style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: imageDimensions.width,
                                            height: imageDimensions.height,
                                            pointerEvents: 'none',
                                          }}
                                        >
                                          {/* Acciones superpuestas sobre la imagen - ordenadas para que las correctas estén encima */}
                                          {[...(currentStep.actions || [])]
                                            .sort((a, b) => {
                                              // Los comentarios siempre van primero (z-index más bajo)
                                              if (a.action_type === 'comment' && b.action_type !== 'comment') return -1;
                                              if (b.action_type === 'comment' && a.action_type !== 'comment') return 1;
                                              if (a.action_type === 'comment' && b.action_type === 'comment') return 0;
                                              
                                              // Las acciones incorrectas primero (z-index menor), correctas después (z-index mayor)
                                              const isACorrect = a.action_type === 'text_input' 
                                                ? a.correct_answer !== 'wrong'
                                                : a.correct_answer && ['true', '1', 'correct', 'yes', 'si', 'sí'].includes(String(a.correct_answer).toLowerCase().trim());
                                              const isBCorrect = b.action_type === 'text_input'
                                                ? b.correct_answer !== 'wrong'
                                                : b.correct_answer && ['true', '1', 'correct', 'yes', 'si', 'sí'].includes(String(b.correct_answer).toLowerCase().trim());
                                              if (isACorrect === isBCorrect) return 0;
                                              return isACorrect ? 1 : -1; // Incorrectas primero, correctas después
                                            })
                                            .map((action: StudyInteractiveExerciseAction) => (
                                            <ExerciseActionOverlay
                                              key={action.id}
                                              action={action}
                                              stepIndex={currentStepIndex}
                                              isStepCompleted={isStepDone}
                                              currentValue={actionResponses[`${action.step_id}_${action.id}`]}
                                              onButtonClick={handleActionClick}
                                              onTextSubmit={handleTextSubmit}
                                              onTextChange={handleTextChange}
                                            />
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="flex items-center justify-center h-36 sm:h-44 lg:h-52 xl:h-64 2xl:h-80 w-52 sm:w-60 lg:w-72 xl:w-80 2xl:w-96 bg-gray-100">
                                      <Image className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 2xl:w-20 2xl:h-20 text-gray-300" />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Navegación de pasos - estilo profesional */}
                              <div className="bg-white border border-gray-200 rounded-md sm:rounded-lg lg:rounded-xl xl:rounded-2xl px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6 py-1.5 sm:py-2 lg:py-3 xl:py-4 2xl:py-5 flex justify-between items-center shadow-sm flex-shrink-0">
                                <button
                                  onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
                                  disabled={currentStepIndex === 0}
                                  className={`px-1.5 sm:px-2.5 lg:px-3 xl:px-4 2xl:px-5 py-1 sm:py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 text-[11px] sm:text-xs lg:text-sm xl:text-base 2xl:text-lg font-medium rounded-md lg:rounded-lg xl:rounded-xl flex items-center gap-0.5 sm:gap-1 xl:gap-2 transition-colors ${
                                    currentStepIndex === 0 
                                      ? 'text-gray-300 cursor-not-allowed' 
                                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                  }`}
                                >
                                  <ChevronLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                                  <span className="hidden xs:inline">Paso anterior</span>
                                  <span className="xs:hidden">Atrás</span>
                                </button>
                                
                                {currentStepIndex < steps.length - 1 ? (
                                  <button
                                    onClick={() => {
                                      // Forzar blur de cualquier input activo para guardar respuestas parciales
                                      if (document.activeElement instanceof HTMLElement) {
                                        document.activeElement.blur();
                                      }
                                      // Dar tiempo para que el blur y setState se procesen
                                      setTimeout(() => {
                                        setCurrentStepIndex(currentStepIndex + 1);
                                      }, 50);
                                    }}
                                    className="px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6 py-1 sm:py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 text-[11px] sm:text-xs lg:text-sm xl:text-base 2xl:text-lg font-semibold text-white bg-blue-600 rounded-md lg:rounded-lg xl:rounded-xl hover:bg-blue-700 flex items-center gap-0.5 sm:gap-1 xl:gap-2 transition-colors shadow-sm"
                                  >
                                    <span className="hidden xs:inline">Siguiente paso</span>
                                    <span className="xs:hidden">Siguiente</span>
                                    <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      // Forzar blur de cualquier input activo para guardar respuestas parciales
                                      if (document.activeElement instanceof HTMLElement) {
                                        document.activeElement.blur();
                                      }
                                      // Dar tiempo para que el blur y setState se procesen
                                      setTimeout(() => {
                                        // Pasar undefined para que use el estado actual de actionResponses
                                        completeExercise();
                                      }, 100);
                                    }}
                                    className="px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6 py-1 sm:py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 text-[11px] sm:text-xs lg:text-sm xl:text-base 2xl:text-lg font-semibold text-white bg-green-600 rounded-md lg:rounded-lg xl:rounded-xl hover:bg-green-700 flex items-center gap-0.5 sm:gap-1 xl:gap-2 transition-colors shadow-sm"
                                  >
                                    <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6" />
                                    <span className="hidden xs:inline">Finalizar ejercicio</span>
                                    <span className="xs:hidden">Finalizar</span>
                                  </button>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 sm:py-14 lg:py-20 text-gray-400">
                      <Gamepad2 className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 mb-2 sm:mb-3 text-gray-300" />
                      <p className="text-sm sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl">No hay ejercicio interactivo para este tema</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Espaciado para la barra fija inferior */}
            <div className="h-14 sm:h-14 md:h-16 lg:h-18 xl:h-20 2xl:h-24" />
          </div>
        </main>
      </div>

      {/* Barra de navegación fija inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1800px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 2xl:px-12 py-2 sm:py-2.5 md:py-3 xl:py-4 2xl:py-5">
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 md:gap-4 xl:gap-6">
            <button
              onClick={goToPreviousContent}
              disabled={!hasPreviousContent()}
              className={`flex items-center gap-1 sm:gap-1.5 xl:gap-2 px-3 sm:px-4 md:px-5 xl:px-6 2xl:px-8 py-1.5 sm:py-2 md:py-2.5 xl:py-3 2xl:py-4 text-xs sm:text-sm md:text-base xl:text-lg 2xl:text-xl rounded-md md:rounded-lg xl:rounded-xl font-medium transition-colors ${
                hasPreviousContent()
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                  : 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 xl:w-6 xl:h-6" />
              <span className="hidden xs:inline">Atrás</span>
            </button>

            <button
              onClick={goToNextContent}
              disabled={!hasNextContent()}
              className={`flex items-center gap-1 sm:gap-1.5 xl:gap-2 px-3 sm:px-4 md:px-5 xl:px-6 2xl:px-8 py-1.5 sm:py-2 md:py-2.5 xl:py-3 2xl:py-4 text-xs sm:text-sm md:text-base xl:text-lg 2xl:text-xl rounded-md md:rounded-lg xl:rounded-xl font-medium transition-colors ${
                hasNextContent()
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              <span className="hidden xs:inline">Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 xl:w-6 xl:h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de error para ejercicio interactivo */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-3 sm:p-4" onClick={() => setShowErrorModal(null)}>
          <div className="bg-white rounded-lg sm:rounded-xl shadow-2xl max-w-md sm:max-w-lg w-full mx-3 sm:mx-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            {/* Header fijo */}
            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 pb-2 sm:pb-3 border-b border-gray-100">
              <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-full flex items-center justify-center">
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-900">Respuesta incorrecta</h3>
            </div>
            
            {/* Contenido con scroll */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 pt-2 sm:pt-3">
              <div 
                className="text-gray-600 prose prose-sm max-w-none text-xs sm:text-sm [&>p]:my-1.5 [&>ul]:my-1.5 [&>ol]:my-1.5 [&>h1]:text-sm sm:[&>h1]:text-base [&>h2]:text-xs sm:[&>h2]:text-sm [&>h3]:text-[11px] sm:[&>h3]:text-xs"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(showErrorModal.message) }}
              />
            </div>
            
            {/* Footer fijo */}
            <div className="p-3 sm:p-4 pt-2 sm:pt-3 border-t border-gray-100">
              {(() => {
                // max_attempts son oportunidades ADICIONALES después del primer error
                const action = currentTopic?.interactive_exercise?.steps
                  ?.flatMap(s => s.actions || [])
                  ?.find(a => `${a.step_id}_${a.id}` === showErrorModal.actionKey);
                const additionalAttempts = action?.max_attempts ?? 1;
                const usedAttempts = actionErrors[showErrorModal.actionKey]?.attempts || 0;
                // El error actual (oportunidad 0) no cuenta, las oportunidades adicionales empiezan después
                const remaining = additionalAttempts - usedAttempts + 1;
                
                return (
                  <p className="text-[10px] sm:text-xs text-amber-600 mb-1.5 sm:mb-2 text-center">
                    {remaining > 0 
                      ? `Te ${remaining === 1 ? 'queda' : 'quedan'} ${remaining} ${remaining === 1 ? 'oportunidad' : 'oportunidades'}`
                      : 'No te quedan más oportunidades'
                    }
                  </p>
                );
              })()}
              <button
                onClick={() => setShowErrorModal(null)}
                className="w-full px-3 py-1.5 sm:py-2 bg-blue-600 text-white rounded-md sm:rounded-lg font-medium hover:bg-blue-700 transition-colors text-xs sm:text-sm"
              >
                Intentar de nuevo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente para acciones superpuestas en el ejercicio interactivo
interface ExerciseActionOverlayProps {
  action: StudyInteractiveExerciseAction;
  stepIndex: number;
  isStepCompleted: boolean;
  currentValue: any;
  onButtonClick: (action: StudyInteractiveExerciseAction, stepIndex: number) => void;
  onTextSubmit: (action: StudyInteractiveExerciseAction, stepIndex: number, value: string) => void;
  onTextChange?: (action: StudyInteractiveExerciseAction, stepIndex: number, value: string) => void;
}

const ExerciseActionOverlay: React.FC<ExerciseActionOverlayProps> = ({
  action,
  stepIndex,
  isStepCompleted,
  currentValue,
  onButtonClick,
  onTextSubmit,
  onTextChange
}) => {
  const [textValue, setTextValue] = useState(currentValue || '');
  const [showFeedback, setShowFeedback] = useState(false);
  const textValueRef = useRef(textValue);
  const onTextChangeRef = useRef(onTextChange);

  // Mantener refs actualizados
  useEffect(() => {
    textValueRef.current = textValue;
  }, [textValue]);

  useEffect(() => {
    onTextChangeRef.current = onTextChange;
  }, [onTextChange]);

  // Guardar automáticamente cuando el componente se desmonta
  useEffect(() => {
    return () => {
      if (action.action_type === 'text_input' && action.correct_answer !== 'wrong' && textValueRef.current.trim() && onTextChangeRef.current) {
        console.log('ExerciseActionOverlay unmount - guardando:', textValueRef.current);
        onTextChangeRef.current(action, stepIndex, textValueRef.current);
      }
    };
  }, [action, stepIndex]);

  // Determinar si es una acción correcta para asignar z-index
  const isCorrectAction = action.action_type === 'text_input'
    ? action.correct_answer !== 'wrong'
    : action.correct_answer && ['true', '1', 'correct', 'yes', 'si', 'sí'].includes(String(action.correct_answer).toLowerCase().trim());

  // Estilo base para posicionar la acción sobre la imagen
  // Las acciones correctas tienen z-index mayor para estar siempre encima de las incorrectas
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${action.position_x}%`,
    top: `${action.position_y}%`,
    width: `${action.width}%`,
    height: `${action.height}%`,
    pointerEvents: isStepCompleted ? 'none' : 'auto',
    zIndex: isCorrectAction ? 20 : 10, // Correctas encima de incorrectas
  };

  if (action.action_type === 'button') {
    // Si hay placeholder, el botón debe ser visible con el texto
    const hasPlaceholder = action.placeholder && action.placeholder.trim() !== '';
    // Verificar tipo de cursor según scoring_mode
    const useTextCursor = action.scoring_mode === 'text_cursor';
    const useDefaultCursor = action.scoring_mode === 'default_cursor';
    // Verificar si es un botón incorrecto
    const isCorrectButton = action.correct_answer && 
      ['true', '1', 'correct', 'yes', 'si', 'sí'].includes(String(action.correct_answer).toLowerCase().trim());
    
    // Determinar estilo de visualización según label_style
    const labelStyle = action.label_style || 'invisible';
    const showShadow = labelStyle === 'text_with_shadow' || labelStyle === 'shadow_only';
    const showText = labelStyle === 'text_only' || labelStyle === 'text_with_shadow';
    const isInvisible = labelStyle === 'invisible';
    
    // Colores base según si es correcto o incorrecto
    const baseColor = isCorrectButton ? 'rgb(20, 184, 166)' : 'rgb(249, 115, 22)';
    const bgColor = isCorrectButton ? 'rgba(20, 184, 166, 0.25)' : 'rgba(251, 146, 60, 0.25)';
    
    return (
      <button
        style={{
          ...baseStyle,
          opacity: 1,
          backgroundColor: showShadow ? bgColor : 'transparent',
          cursor: useTextCursor ? 'text' : useDefaultCursor ? 'default' : undefined,
          border: showShadow ? `2px solid ${baseColor}` : 'none',
          borderRadius: '4px',
        }}
        onClick={() => {
          setShowFeedback(true);
          setTimeout(() => {
            setShowFeedback(false);
            onButtonClick(action, stepIndex);
          }, 300);
        }}
        disabled={isStepCompleted}
        className={`flex items-center justify-center text-xs font-medium transition-all ${
          currentValue 
            ? 'bg-green-100 text-green-700' 
            : showFeedback
            ? (isCorrectButton ? 'bg-teal-300 scale-95' : 'bg-orange-300 scale-95')
            : isInvisible
            ? '' // Sin hover visible para modo invisible
            : hasPlaceholder && showText
            ? (isCorrectButton 
                ? 'text-teal-800 hover:bg-teal-200/60'
                : 'text-orange-800 hover:bg-orange-200/60')
            : showShadow 
            ? (isCorrectButton ? 'hover:bg-teal-200/60' : 'hover:bg-orange-200/60')
            : ''
        }`}
        title={isInvisible ? '' : (action.placeholder || action.label || 'Clic aquí')}
      >
        {hasPlaceholder && showText && (
          <span className="truncate px-2 text-sm">{action.placeholder}</span>
        )}
        {currentValue && <span className="ml-1">✓</span>}
      </button>
    );
  }

  if (action.action_type === 'text_input') {
    // Verificar si es un campo incorrecto (text_input con correct_answer === 'wrong')
    const isWrongTextInput = action.correct_answer === 'wrong';
    
    if (isWrongTextInput) {
      // Campo incorrecto: parece un campo de texto pero actúa como botón incorrecto
      const hasPlaceholder = action.placeholder && action.placeholder.trim() !== '';
      
      // Determinar estilo de visualización según label_style
      const labelStyle = action.label_style || 'invisible';
      const showShadow = labelStyle === 'text_with_shadow' || labelStyle === 'shadow_only';
      const showText = labelStyle === 'text_only' || labelStyle === 'text_with_shadow';
      const isInvisible = labelStyle === 'invisible';
      
      return (
        <div
          style={{
            ...baseStyle,
            opacity: 1,
            backgroundColor: showShadow ? 'rgba(251, 146, 60, 0.25)' : 'transparent',
            cursor: 'text',
            border: showShadow ? '2px solid rgb(249, 115, 22)' : 'none',
            borderRadius: '4px',
          }}
          onClick={() => {
            if (!isStepCompleted) {
              setShowFeedback(true);
              setTimeout(() => {
                setShowFeedback(false);
                // Usar el mismo handler que los botones incorrectos
                onButtonClick(action, stepIndex);
              }, 300);
            }
          }}
          className={`flex items-center justify-center text-xs font-medium transition-all ${
            currentValue 
              ? 'bg-red-100 text-red-700' 
              : showFeedback
              ? 'bg-orange-300 scale-95'
              : isInvisible
              ? ''
              : 'text-orange-800 hover:bg-orange-200/60'
          }`}
          title={isInvisible ? '' : (action.placeholder || 'Escribe aquí')}
        >
          {hasPlaceholder && showText && (
            <span className="truncate px-2 text-sm italic text-orange-600">{action.placeholder}</span>
          )}
        </div>
      );
    }
    
    // Campo de texto normal (correcto)
    // Si hay placeholder, mostrarlo como guía
    const placeholderText = action.placeholder && action.placeholder.trim() !== '' ? action.placeholder : '';
    
    // Determinar estilo de visualización según label_style
    const labelStyle = action.label_style || 'invisible';
    const showShadow = labelStyle === 'text_with_shadow' || labelStyle === 'shadow_only';
    const showPlaceholder = (labelStyle === 'text_only' || labelStyle === 'text_with_shadow') && placeholderText;
    
    return (
      <div 
        style={{
          ...baseStyle,
          overflow: 'visible', // Permitir que el indicador se muestre fuera
          pointerEvents: 'auto', // Siempre permitir interacción con el input
          backgroundColor: showShadow ? 'rgba(132, 204, 22, 0.25)' : 'transparent',
          border: showShadow ? '2px solid rgb(132, 204, 22)' : 'none',
          borderRadius: '4px',
        }} 
        className="flex items-center"
      >
        <input
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={() => {
            // Auto-guardar al perder el foco si hay texto
            if (textValue.trim() && onTextChange) {
              onTextChange(action, stepIndex, textValue);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && textValue.trim()) {
              onTextSubmit(action, stepIndex, textValue);
              (e.target as HTMLInputElement).blur(); // Quitar foco después de enviar
            }
          }}
          placeholder={showPlaceholder ? placeholderText : ''}
          className="w-full h-full focus:outline-none"
          style={{
            color: action.text_color || '#000000',
            fontFamily: action.font_family || 'Arial',
            fontSize: 'inherit',
            background: 'transparent',
            border: 'none',
            padding: '0 4px',
            caretColor: action.text_color || '#000000',
            overflow: 'hidden', // El texto no desborda
            textOverflow: 'clip', // Cortar texto que exceda
          }}
        />
      </div>
    );
  }

  // Renderizar comentario/letrero
  if (action.action_type === 'comment') {
    const commentText = action.comment_text || action.label || 'Comentario';
    const bgColor = action.comment_bg_color || '#fef3c7';
    const textColor = action.comment_text_color || '#92400e';
    const fontSize = action.comment_font_size || 14;
    
    return (
      <div
        style={{
          ...baseStyle,
          pointerEvents: 'none', // Los comentarios no son interactivos
          zIndex: 5, // Debajo de botones y campos de texto
          backgroundColor: bgColor,
          border: `2px solid ${textColor}40`,
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 8px',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            color: textColor,
            fontSize: `${fontSize}px`,
            fontWeight: 500,
            textAlign: 'center',
            lineHeight: 1.3,
            wordBreak: 'break-word',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {commentText}
        </span>
      </div>
    );
  }

  return null;
};

export default StudyContentPreviewPage;
