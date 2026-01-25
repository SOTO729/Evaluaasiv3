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
        <div className="max-w-7xl mx-auto fluid-px-6 fluid-py-4">
          <div className="flex items-center justify-between">
            {/* Botón volver */}
            <button
              onClick={() => navigate('/study-contents')}
              className="group inline-flex items-center fluid-gap-3 fluid-px-4 fluid-py-2 rounded-fluid-xl bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="fluid-p-2 rounded-lg bg-gray-100 group-hover:bg-blue-100 transition-colors">
                <ArrowLeft className="fluid-icon-base text-gray-600 group-hover:text-blue-600 transition-colors" />
              </div>
              <span className="fluid-text-sm font-medium text-gray-700 group-hover:text-blue-700 transition-colors">
                Volver a materiales
              </span>
            </button>
            
            {/* Indicador de breadcrumb */}
            <div className="hidden sm:flex items-center fluid-gap-2 fluid-text-sm text-gray-400">
              <span className="text-gray-400">Materiales</span>
              <ChevronRight className="fluid-icon-sm text-gray-300" />
              <span className="text-gray-600 font-medium truncate max-w-[200px]">
                {material.title}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal con layout de dos columnas */}
      <div className="max-w-7xl mx-auto fluid-px-6 fluid-py-10">
        
        {/* Hero con imagen de fondo */}
        <div 
          className="relative rounded-fluid-2xl overflow-hidden shadow-lg fluid-mb-12"
          style={{
            background: material.image_url 
              ? `url(${material.image_url}) center/cover no-repeat`
              : `linear-gradient(135deg, ${dominantColor} 0%, #1e3a5f 100%)`
          }}
        >
          {/* Overlay oscuro para legibilidad */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
          
          {/* Contenido superpuesto */}
          <div className="relative z-10 fluid-p-10">
            <div className="max-w-2xl">
              {/* Título */}
              <h1 className="fluid-text-3xl font-bold text-white fluid-mb-6 drop-shadow-lg">
                {material.title}
              </h1>

              {/* Estadísticas en línea */}
              <div className="flex flex-wrap items-center fluid-gap-5 fluid-mb-8">
                <div className="flex items-center fluid-gap-2">
                  <div className="fluid-p-2 bg-white/20 backdrop-blur-sm rounded-fluid-lg">
                    <Layers className="fluid-icon-base text-white" />
                  </div>
                  <span className="fluid-text-sm text-white/90">
                    <span className="font-semibold text-white">{totalSessions}</span> {totalSessions === 1 ? 'Sesión' : 'Sesiones'}
                  </span>
                </div>
                <div className="w-px h-4 bg-white/30 hidden sm:block" />
                <div className="flex items-center fluid-gap-2">
                  <div className="fluid-p-2 bg-white/20 backdrop-blur-sm rounded-fluid-lg">
                    <FileText className="fluid-icon-base text-white" />
                  </div>
                  <span className="fluid-text-sm text-white/90">
                    <span className="font-semibold text-white">{totalTopics}</span> {totalTopics === 1 ? 'Tema' : 'Temas'}
                  </span>
                </div>
                {totalEstimatedTime > 0 && (
                  <>
                    <div className="w-px h-4 bg-white/30 hidden sm:block" />
                    <div className="flex items-center fluid-gap-2">
                      <div className="fluid-p-2 bg-white/20 backdrop-blur-sm rounded-fluid-lg">
                        <Clock className="fluid-icon-base text-white" />
                      </div>
                      <span className="fluid-text-sm text-white/90">
                        <span className="font-semibold text-white">~{totalEstimatedTime}</span> min
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Botón de acción principal */}
              <button
                onClick={() => navigate(`/study-contents/${materialId}/preview`)}
                className="w-full sm:w-auto flex items-center justify-center fluid-gap-3 bg-white hover:bg-gray-100 text-gray-900 fluid-px-8 fluid-py-4 rounded-fluid-xl font-semibold fluid-text-base shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
              >
                <PlayCircle className="fluid-icon-lg text-blue-600" />
                Iniciar Material de Estudio
              </button>
            </div>
          </div>
          
          {/* Icono de fondo si no hay imagen */}
          {!material.image_url && (
            <div className="absolute right-8 bottom-8 opacity-10">
              <BookOpen className="fluid-icon-2xl text-white" />
            </div>
          )}
        </div>

        {/* Lista de sesiones y temas */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="fluid-p-8 border-b border-gray-100">
            <h2 className="fluid-text-2xl font-bold text-gray-900 flex items-center fluid-gap-3">
              <BookOpen className="fluid-icon-lg text-blue-600" />
              Contenido de estudio
            </h2>
            <p className="text-gray-500 fluid-text-base fluid-mt-2">
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
                      className="w-full flex items-center justify-between fluid-p-6 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center fluid-gap-5">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold fluid-text-base">
                          {sessionIndex + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 fluid-text-lg">
                            {session.title}
                          </h3>
                          <p className="fluid-text-sm text-gray-500 fluid-mt-1">
                            {session.topics?.length || 0} {(session.topics?.length || 0) === 1 ? 'tema' : 'temas'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center fluid-gap-2">
                        {expandedSessions.has(sessionIndex) ? (
                          <ChevronDown className="fluid-icon-base text-gray-400" />
                        ) : (
                          <ChevronRight className="fluid-icon-base text-gray-400" />
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
                                className="flex items-start fluid-gap-5 fluid-px-8 fluid-py-5 border-b border-gray-100 last:border-b-0 hover:bg-gray-100/50 transition-colors"
                              >
                                {/* Número del tema */}
                                <div className="flex-shrink-0 w-8 h-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center fluid-text-sm font-medium mt-0.5">
                                  {topicIndex + 1}
                                </div>
                                
                                {/* Información del tema */}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-gray-900 fluid-text-base fluid-mb-1">
                                    {topic.title}
                                  </h4>
                                  
                                  {/* Tipos de contenido disponibles */}
                                  <div className="flex flex-wrap fluid-gap-2 fluid-mt-2">
                                    {contentTypes.map(({ icon: Icon, label, color }, idx) => (
                                      <span
                                        key={idx}
                                        className={`inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-white rounded-fluid-md fluid-text-xs font-medium ${color} border border-gray-200`}
                                      >
                                        <Icon className="fluid-icon-xs" />
                                        {label}
                                      </span>
                                    ))}
                                  </div>
                                  
                                  {/* Tiempo estimado */}
                                  {topic.estimated_time_minutes && topic.estimated_time_minutes > 0 && (
                                    <div className="flex items-center fluid-gap-1 fluid-mt-2 fluid-text-xs text-gray-500">
                                      <Clock className="fluid-icon-xs" />
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
              <div className="fluid-p-12 text-center">
                <Layers className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-4" />
                <p className="text-gray-500 fluid-text-base">Este material aún no tiene sesiones.</p>
              </div>
            )}
          </div>
        </div>

        {/* Botón de acción al final */}
        <div className="fluid-mt-12 text-center">
          <button
            onClick={() => navigate(`/study-contents/${materialId}/preview`)}
            className="inline-flex items-center justify-center fluid-gap-4 bg-blue-600 hover:bg-blue-700 text-white fluid-px-10 fluid-py-5 rounded-fluid-2xl font-semibold fluid-text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
          >
            <PlayCircle className="fluid-icon-lg" />
            Iniciar Material de Estudio
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudyContentCandidatePage;
