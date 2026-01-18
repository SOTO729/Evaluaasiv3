/**
 * Página de vista de Material de Estudio para Candidatos
 * Vista presentacional con desglose de sesiones y temas
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getMaterial,
  StudyMaterial,
} from '../../services/studyContentService';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Layers,
  FileText,
  Video,
  Download,
  Gamepad2,
  PlayCircle,
  Clock,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

const StudyContentCandidatePage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const materialId = parseInt(id || '0');

  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());
  const [dominantColor, setDominantColor] = useState<string>('#1e3a5f');

  // Extraer color dominante de la imagen
  const extractDominantColor = (imageUrl: string) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const startY = Math.floor(img.height * 0.5);
      const imageData = ctx.getImageData(0, startY, img.width, img.height - startY);
      const data = imageData.data;

      let r = 0, g = 0, b = 0, count = 0;

      for (let i = 0; i < data.length; i += 40) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }

      if (count > 0) {
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        
        const darkenFactor = 0.6;
        r = Math.floor(r * darkenFactor);
        g = Math.floor(g * darkenFactor);
        b = Math.floor(b * darkenFactor);
        
        setDominantColor(`rgb(${r}, ${g}, ${b})`);
      }
    };
    img.onerror = () => {
      setDominantColor('#1e3a5f');
    };
    img.src = imageUrl;
  };

  useEffect(() => {
    const fetchMaterial = async () => {
      try {
        const data = await getMaterial(materialId);
        setMaterial(data);
        
        // Mantener todas las sesiones contraídas por defecto
        setExpandedSessions(new Set());
        
        if (data.image_url) {
          extractDominantColor(data.image_url);
        }
      } catch (error) {
        console.error('Error fetching material:', error);
      } finally {
        setLoading(false);
      }
    };

    if (materialId) {
      fetchMaterial();
    }
  }, [materialId]);

  const toggleSession = (index: number) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Calcular totales
  const totalSessions = material?.sessions?.length || 0;
  const totalTopics = material?.sessions?.reduce((acc, session) => acc + (session.topics?.length || 0), 0) || 0;
  const totalEstimatedTime = material?.sessions?.reduce((acc, session) => {
    return acc + (session.topics?.reduce((topicAcc, topic) => topicAcc + (topic.estimated_time_minutes || 0), 0) || 0);
  }, 0) || 0;

  // Contar tipos de contenido en un tema
  const getTopicContentTypes = (topic: any) => {
    const types = [];
    if (topic.reading) types.push({ icon: FileText, label: 'Lectura', color: 'text-blue-600' });
    if (topic.video) types.push({ icon: Video, label: 'Video', color: 'text-purple-600' });
    if (topic.downloadable_exercise) types.push({ icon: Download, label: 'Recursos', color: 'text-green-600' });
    if (topic.interactive_exercise) types.push({ icon: Gamepad2, label: 'Ejercicio', color: 'text-orange-600' });
    return types;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Cargando material..." />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <BookOpen className="h-16 w-16 text-gray-300 mb-4" />
        <p className="text-gray-500 text-lg">Material no encontrado</p>
        <button
          onClick={() => navigate('/study-contents')}
          className="mt-4 text-blue-600 hover:underline"
        >
          Volver a materiales
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden overscroll-contain">
      {/* Barra de navegación superior */}
      <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-gray-200/80 shadow-sm sticky top-0 z-40 backdrop-blur-sm bg-opacity-95">
        <div className="max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-14 py-3 lg:py-4 xl:py-5 2xl:py-6">
          <div className="flex items-center justify-between">
            {/* Botón volver */}
            <button
              onClick={() => navigate('/study-contents')}
              className="group inline-flex items-center gap-2 lg:gap-3 xl:gap-4 px-3 lg:px-4 xl:px-5 2xl:px-6 py-2 lg:py-2.5 xl:py-3 2xl:py-3.5 rounded-xl lg:rounded-2xl bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="p-1 lg:p-1.5 xl:p-2 rounded-lg bg-gray-100 group-hover:bg-blue-100 transition-colors">
                <ArrowLeft className="h-4 w-4 lg:h-5 lg:w-5 xl:h-6 xl:w-6 2xl:h-7 2xl:w-7 text-gray-600 group-hover:text-blue-600 transition-colors" />
              </div>
              <span className="text-sm lg:text-base xl:text-lg 2xl:text-xl font-medium text-gray-700 group-hover:text-blue-700 transition-colors">
                Volver a materiales
              </span>
            </button>
            
            {/* Indicador de breadcrumb */}
            <div className="hidden sm:flex items-center gap-2 lg:gap-3 text-sm lg:text-base xl:text-lg text-gray-400">
              <span className="text-gray-400">Materiales</span>
              <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5 text-gray-300" />
              <span className="text-gray-600 font-medium truncate max-w-[200px] lg:max-w-[300px] xl:max-w-[400px]">
                {material.title}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal con layout de dos columnas */}
      <div className="max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-14 py-6 lg:py-10 xl:py-12 2xl:py-16">
        
        {/* Hero con imagen de fondo */}
        <div 
          className="relative rounded-xl lg:rounded-2xl xl:rounded-3xl overflow-hidden shadow-lg mb-8 lg:mb-12 xl:mb-14 2xl:mb-16"
          style={{
            background: material.image_url 
              ? `url(${material.image_url}) center/cover no-repeat`
              : `linear-gradient(135deg, ${dominantColor} 0%, #1e3a5f 100%)`
          }}
        >
          {/* Overlay oscuro para legibilidad */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
          
          {/* Contenido superpuesto */}
          <div className="relative z-10 p-6 sm:p-8 lg:p-10 xl:p-12 2xl:p-16">
            <div className="max-w-2xl xl:max-w-3xl 2xl:max-w-4xl">
              {/* Título */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-bold text-white mb-4 lg:mb-5 xl:mb-6 2xl:mb-8 drop-shadow-lg">
                {material.title}
              </h1>

              {/* Estadísticas en línea */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 lg:gap-5 xl:gap-6 2xl:gap-8 mb-5 lg:mb-6 xl:mb-8 2xl:mb-10">
                <div className="flex items-center gap-2 xl:gap-3">
                  <div className="p-1.5 xl:p-2 2xl:p-2.5 bg-white/20 backdrop-blur-sm rounded-lg xl:rounded-xl">
                    <Layers className="h-4 w-4 lg:h-5 lg:w-5 xl:h-6 xl:w-6 2xl:h-7 2xl:w-7 text-white" />
                  </div>
                  <span className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-white/90">
                    <span className="font-semibold text-white">{totalSessions}</span> {totalSessions === 1 ? 'Sesión' : 'Sesiones'}
                  </span>
                </div>
                <div className="w-px h-4 xl:h-5 2xl:h-6 bg-white/30 hidden sm:block" />
                <div className="flex items-center gap-2 xl:gap-3">
                  <div className="p-1.5 xl:p-2 2xl:p-2.5 bg-white/20 backdrop-blur-sm rounded-lg xl:rounded-xl">
                    <FileText className="h-4 w-4 lg:h-5 lg:w-5 xl:h-6 xl:w-6 2xl:h-7 2xl:w-7 text-white" />
                  </div>
                  <span className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-white/90">
                    <span className="font-semibold text-white">{totalTopics}</span> {totalTopics === 1 ? 'Tema' : 'Temas'}
                  </span>
                </div>
                {totalEstimatedTime > 0 && (
                  <>
                    <div className="w-px h-4 xl:h-5 2xl:h-6 bg-white/30 hidden sm:block" />
                    <div className="flex items-center gap-2 xl:gap-3">
                      <div className="p-1.5 xl:p-2 2xl:p-2.5 bg-white/20 backdrop-blur-sm rounded-lg xl:rounded-xl">
                        <Clock className="h-4 w-4 lg:h-5 lg:w-5 xl:h-6 xl:w-6 2xl:h-7 2xl:w-7 text-white" />
                      </div>
                      <span className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-white/90">
                        <span className="font-semibold text-white">~{totalEstimatedTime}</span> min
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Botón de acción principal */}
              <button
                onClick={() => navigate(`/study-contents/${materialId}/preview`)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 lg:gap-3 xl:gap-4 bg-white hover:bg-gray-100 text-gray-900 px-6 lg:px-8 xl:px-10 2xl:px-12 py-3 lg:py-4 xl:py-5 2xl:py-6 rounded-xl lg:rounded-2xl font-semibold text-sm lg:text-base xl:text-lg 2xl:text-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
              >
                <PlayCircle className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7 2xl:h-8 2xl:w-8 text-blue-600" />
                Iniciar Material de Estudio
              </button>
            </div>
          </div>
          
          {/* Icono de fondo si no hay imagen */}
          {!material.image_url && (
            <div className="absolute right-8 bottom-8 xl:right-12 xl:bottom-12 2xl:right-16 2xl:bottom-16 opacity-10">
              <BookOpen className="h-32 w-32 lg:h-48 lg:w-48 xl:h-56 xl:w-56 2xl:h-72 2xl:w-72 text-white" />
            </div>
          )}
        </div>

        {/* Lista de sesiones y temas */}
        <div className="bg-white rounded-xl lg:rounded-2xl xl:rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 lg:p-8 xl:p-10 2xl:p-12 border-b border-gray-100">
            <h2 className="text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl font-bold text-gray-900 flex items-center gap-2 lg:gap-3 xl:gap-4">
              <BookOpen className="h-6 w-6 lg:h-7 lg:w-7 xl:h-8 xl:w-8 2xl:h-10 2xl:w-10 text-blue-600" />
              Contenido de estudio
            </h2>
            <p className="text-gray-500 lg:text-lg xl:text-xl 2xl:text-2xl mt-1 lg:mt-2 xl:mt-3">
              {totalSessions} {totalSessions === 1 ? 'sesión' : 'sesiones'} • {totalTopics} {totalTopics === 1 ? 'tema' : 'temas'}
            </p>
          </div>

          {/* Sesiones */}
          <div className="divide-y divide-gray-100">
            {material.sessions && material.sessions.length > 0 ? (
              material.sessions
                .sort((a, b) => a.session_number - b.session_number)
                .map((session, sessionIndex) => (
                  <div key={session.id} className="bg-white">
                    {/* Header de sesión */}
                    <button
                      onClick={() => toggleSession(sessionIndex)}
                      className="w-full flex items-center justify-between p-4 sm:p-5 lg:p-6 xl:p-7 2xl:p-8 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-4 lg:gap-5 xl:gap-6 2xl:gap-7">
                        <div className="flex-shrink-0 w-10 h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 2xl:w-16 2xl:h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-base lg:text-lg xl:text-xl 2xl:text-2xl">
                          {sessionIndex + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-base sm:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl">
                            {session.title}
                          </h3>
                          <p className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-500 mt-0.5 lg:mt-1">
                            {session.topics?.length || 0} {(session.topics?.length || 0) === 1 ? 'tema' : 'temas'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {expandedSessions.has(sessionIndex) ? (
                          <ChevronDown className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7 2xl:h-8 2xl:w-8 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7 2xl:h-8 2xl:w-8 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Lista de temas */}
                    {expandedSessions.has(sessionIndex) && session.topics && (
                      <div className="bg-gray-50 border-t border-gray-100">
                        {session.topics
                          .sort((a, b) => a.order - b.order)
                          .map((topic, topicIndex) => {
                            const contentTypes = getTopicContentTypes(topic);
                            return (
                              <div
                                key={topic.id}
                                className="flex items-start gap-4 lg:gap-5 xl:gap-6 2xl:gap-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-4 lg:py-5 xl:py-6 2xl:py-7 border-b border-gray-100 last:border-b-0 hover:bg-gray-100/50 transition-colors"
                              >
                                {/* Número del tema */}
                                <div className="flex-shrink-0 w-8 h-8 lg:w-10 lg:h-10 xl:w-12 xl:h-12 2xl:w-14 2xl:h-14 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-sm lg:text-base xl:text-lg 2xl:text-xl font-medium mt-0.5">
                                  {topicIndex + 1}
                                </div>
                                
                                {/* Información del tema */}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-gray-900 text-base lg:text-lg xl:text-xl 2xl:text-2xl mb-1 lg:mb-2">
                                    {topic.title}
                                  </h4>
                                  
                                  {/* Tipos de contenido disponibles */}
                                  <div className="flex flex-wrap gap-2 lg:gap-3 xl:gap-4 mt-2 lg:mt-3">
                                    {contentTypes.map(({ icon: Icon, label, color }, idx) => (
                                      <span
                                        key={idx}
                                        className={`inline-flex items-center gap-1 lg:gap-1.5 xl:gap-2 px-2 lg:px-3 xl:px-4 2xl:px-5 py-1 lg:py-1.5 xl:py-2 2xl:py-2.5 bg-white rounded-md lg:rounded-lg xl:rounded-xl text-xs lg:text-sm xl:text-base 2xl:text-lg font-medium ${color} border border-gray-200`}
                                      >
                                        <Icon className="h-3 w-3 lg:h-4 lg:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6" />
                                        {label}
                                      </span>
                                    ))}
                                  </div>
                                  
                                  {/* Tiempo estimado */}
                                  {topic.estimated_time_minutes && topic.estimated_time_minutes > 0 && (
                                    <div className="flex items-center gap-1 lg:gap-2 xl:gap-3 mt-2 lg:mt-3 text-xs lg:text-sm xl:text-base 2xl:text-lg text-gray-500">
                                      <Clock className="h-3 w-3 lg:h-4 lg:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6" />
                                      <span>{topic.estimated_time_minutes} min</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                ))
            ) : (
              <div className="p-8 lg:p-12 xl:p-16 2xl:p-20 text-center">
                <Layers className="h-12 w-12 lg:h-16 lg:w-16 xl:h-20 xl:w-20 2xl:h-24 2xl:w-24 text-gray-300 mx-auto mb-3 lg:mb-4 xl:mb-5 2xl:mb-6" />
                <p className="text-gray-500 lg:text-lg xl:text-xl 2xl:text-2xl">Este material aún no tiene sesiones.</p>
              </div>
            )}
          </div>
        </div>

        {/* Botón de acción al final */}
        <div className="mt-8 lg:mt-12 xl:mt-14 2xl:mt-16 text-center">
          <button
            onClick={() => navigate(`/study-contents/${materialId}/preview`)}
            className="inline-flex items-center justify-center gap-3 lg:gap-4 xl:gap-5 bg-blue-600 hover:bg-blue-700 text-white px-8 lg:px-10 xl:px-12 2xl:px-16 py-4 lg:py-5 xl:py-6 2xl:py-7 rounded-xl lg:rounded-2xl xl:rounded-3xl font-semibold text-lg lg:text-xl xl:text-2xl 2xl:text-3xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
          >
            <PlayCircle className="h-6 w-6 lg:h-7 lg:w-7 xl:h-8 xl:w-8 2xl:h-10 2xl:w-10" />
            Iniciar Material de Estudio
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudyContentCandidatePage;
