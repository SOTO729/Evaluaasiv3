/**
 * Página de Editor de Video
 * Pantalla completa para crear/editar material de video
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  getMaterial,
  upsertVideo,
  uploadVideo,
  getVideoSignedUrlByTopic,
  StudyTopic,
  CreateVideoData,
} from '../../services/studyContentService';
import {
  ArrowLeft,
  Video,
  Loader2,
  Check,
  Save,
  Upload,
  Link,
  Play,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Film,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import CustomVideoPlayer from '../../components/CustomVideoPlayer';
import { sanitizeReadingHtml } from '../../utils/sanitizeReading';
import { isAzureUrl } from '../../utils/urlHelpers';

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Convierte una URL de YouTube/Vimeo en su URL embebible (misma lógica que la página del candidato).
// Devuelve null si la URL no corresponde a un servicio embebible.
const getEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  const trimmed = url.trim();

  const youtubeMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([^&?\s/]+)/);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}?feature=oembed`;
  }

  // Si ya es una URL del reproductor de Vimeo, usarla tal cual (conserva el hash ?h=)
  if (trimmed.includes('player.vimeo.com/video/')) {
    return trimmed;
  }

  const vimeoMatch = trimmed.match(
    /vimeo\.com\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)(?:\/([0-9a-zA-Z]+))?/
  );
  if (vimeoMatch) {
    const id = vimeoMatch[1];
    let hash = vimeoMatch[2];
    if (!hash) {
      const hMatch = trimmed.match(/[?&]h=([0-9a-zA-Z]+)/);
      if (hMatch) hash = hMatch[1];
    }
    return hash
      ? `https://player.vimeo.com/video/${id}?h=${hash}`
      : `https://player.vimeo.com/video/${id}`;
  }

  return null;
};

// Detecta si la URL apunta directamente a un archivo de video reproducible.
const isDirectVideo = (url: string): boolean =>
  /\.(mp4|webm|ogg|ogv|mov|m4v|mkv)(\?.*)?$/i.test(url) || url.startsWith('blob:');

const VideoEditorPage = () => {
  const navigate = useNavigate();
  const { id: materialId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const topicId = searchParams.get('topicId');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [topic, setTopic] = useState<StudyTopic | null>(null);
  const [form, setForm] = useState<CreateVideoData>({ title: '', video_url: '' });
  const [mode, setMode] = useState<'url' | 'upload'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);
  const [signedUrlLoading, setSignedUrlLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Módulos de Quill para descripción (toolbar enriquecida)
  const quillModules = useMemo(() => ({
    toolbar: [
      [{ 'header': [3, 4, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['blockquote', 'link'],
      ['clean'],
    ],
  }), []);

  const quillFormats = useMemo(() => [
    'header', 'bold', 'italic', 'underline',
    'list', 'blockquote', 'link',
  ], []);

  // Genera/limpia la URL local para previsualizar el archivo seleccionado.
  useEffect(() => {
    if (!selectedFile) {
      setLocalPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setLocalPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);
  
  // Cargar datos
  useEffect(() => {
    const loadData = async () => {
      if (!materialId || !sessionId || !topicId) {
        navigate(-1);
        return;
      }
      
      try {
        const data = await getMaterial(parseInt(materialId));
        
        const session = data.sessions?.find(s => s.id === parseInt(sessionId));
        const foundTopic = session?.topics?.find(t => t.id === parseInt(topicId));
        
        if (foundTopic) {
          setTopic(foundTopic);
          if (foundTopic.video) {
            setForm({
              title: foundTopic.video.title,
              description: foundTopic.video.description || '',
              video_url: foundTopic.video.video_url,
              video_type: foundTopic.video.video_type,
              thumbnail_url: foundTopic.video.thumbnail_url,
            });
            // Si ya tiene un video guardado, por defecto el modo es URL.
            if (foundTopic.video.video_url) {
              setMode('url');
            }
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setToast({ message: 'Error al cargar los datos', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [materialId, sessionId, topicId, navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/mpeg', 'video/3gpp', 'video/x-matroska'];
      if (!validTypes.includes(file.type)) {
        setToast({ message: 'Tipo de archivo no válido. Use MP4, WebM, OGG, MOV, AVI, MKV o MPEG.', type: 'error' });
        return;
      }
      const maxSize = 2 * 1024 * 1024 * 1024;
      if (file.size > maxSize) {
        setToast({ message: 'El archivo excede el tamaño máximo de 2GB', type: 'error' });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !materialId || !sessionId || !topicId) {
      setToast({ message: 'Por favor completa el título del video', type: 'error' });
      return;
    }
    
    if (mode === 'url' && !form.video_url.trim()) {
      setToast({ message: 'Por favor ingresa la URL del video', type: 'error' });
      return;
    }
    if (mode === 'upload' && !selectedFile) {
      setToast({ message: 'Por favor selecciona un archivo de video', type: 'error' });
      return;
    }
    
    setSaving(true);
    try {
      if (mode === 'upload' && selectedFile) {
        setIsUploading(true);
        await uploadVideo(
          parseInt(materialId),
          parseInt(sessionId),
          parseInt(topicId),
          selectedFile,
          form.title,
          form.description || '',
          0, // duration_minutes - ya no se usa
          (progress) => setUploadProgress(progress)
        );
        setIsUploading(false);
        setToast({ message: '¡Video subido exitosamente!', type: 'success' });
      } else {
        await upsertVideo(parseInt(materialId), parseInt(sessionId), parseInt(topicId), form);
        setToast({ message: '¡Video guardado exitosamente!', type: 'success' });
      }
      setTimeout(() => navigate(`/study-contents/${materialId}`), 1000);
    } catch (error: any) {
      console.error('Error saving video:', error);
      setIsUploading(false);
      let errorMessage = 'Error al guardar el video';
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'La subida tardó demasiado tiempo.';
      } else if (error.message === 'Network Error') {
        errorMessage = 'Error de red al subir el video.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const isFormComplete = form.title.trim() && (
    (mode === 'url' && form.video_url.trim()) || 
    (mode === 'upload' && selectedFile)
  );

  // Para videos ya guardados en Azure Blob Storage, obtener una URL firmada (SAS)
  // fresca para poder reproducirlos en la previsualización.
  useEffect(() => {
    let cancelled = false;
    const loadSignedUrl = async () => {
      // Si hay un archivo recién seleccionado, se usa su URL local; no hace falta firmar.
      if (selectedFile || !form.video_url || !isAzureUrl(form.video_url) || !topicId) {
        setSignedVideoUrl(null);
        return;
      }
      setSignedUrlLoading(true);
      try {
        const response = await getVideoSignedUrlByTopic(parseInt(topicId));
        if (!cancelled) setSignedVideoUrl(response.video_url);
      } catch (error) {
        console.error('Error obteniendo URL firmada del video:', error);
        if (!cancelled) setSignedVideoUrl(form.video_url);
      } finally {
        if (!cancelled) setSignedUrlLoading(false);
      }
    };
    loadSignedUrl();
    return () => { cancelled = true; };
  }, [form.video_url, selectedFile, topicId]);

  // Determina la fuente reproducible para la previsualización.
  // Prioriza el archivo recién seleccionado, luego la URL/archivo guardado.
  const playableSource = (() => {
    // 1) Archivo recién seleccionado (cualquier modo): blob local
    if (localPreviewUrl) return { type: 'file' as const, src: localPreviewUrl };

    // 2) ¿Es una URL externa embebible (YouTube/Vimeo)?
    const trimmedUrl = form.video_url?.trim() || '';
    if (trimmedUrl) {
      const embed = getEmbedUrl(trimmedUrl);
      if (embed) return { type: 'embed' as const, src: embed };

      // 3) Video guardado en Azure Blob → usar URL firmada
      if (isAzureUrl(trimmedUrl)) {
        if (signedUrlLoading) return { type: 'loading' as const, src: '' };
        return { type: 'file' as const, src: signedVideoUrl || trimmedUrl };
      }

      // 4) Archivo directo (mp4, webm, etc.)
      if (isDirectVideo(trimmedUrl)) return { type: 'file' as const, src: trimmedUrl };

      // 5) URL no reconocida
      return { type: 'unknown' as const, src: trimmedUrl };
    }

    return null;
  })();

  // Reproductor reutilizable para la previsualización (mismo estilo que la página del candidato).
  const renderPlayer = () => {
    if (!playableSource) {
      return (
        <div className="flex flex-col items-center justify-center text-center aspect-video bg-gray-900 text-gray-400 rounded-xl">
          <Film className="w-12 h-12 mb-3 text-gray-600" />
          <p className="text-sm">Selecciona un archivo o ingresa una URL para previsualizar</p>
        </div>
      );
    }
    if (playableSource.type === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center text-center aspect-video bg-gray-900 text-gray-400 rounded-xl">
          <Loader2 className="w-8 h-8 mb-3 animate-spin text-purple-400" />
          <p className="text-sm">Cargando video...</p>
        </div>
      );
    }
    if (playableSource.type === 'embed') {
      return (
        <div className="relative w-full bg-black rounded-xl overflow-hidden shadow-md">
          <div className="relative w-full aspect-video">
            <iframe
              src={playableSource.src}
              title="Vista previa del video"
              className="absolute inset-0 w-full h-full"
              style={{ border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      );
    }
    if (playableSource.type === 'file') {
      return (
        <div className="relative w-full bg-black rounded-xl overflow-hidden shadow-md">
          <div className="relative w-full aspect-video">
            <CustomVideoPlayer
              src={playableSource.src}
              className="absolute top-0 left-0 w-full h-full"
              objectFit="contain"
            />
          </div>
        </div>
      );
    }
    // URL desconocida (no embebible ni archivo directo)
    return (
      <div className="flex flex-col items-center justify-center text-center aspect-video bg-gray-900 text-gray-300 rounded-xl px-6">
        <AlertCircle className="w-10 h-10 mb-3 text-amber-400" />
        <p className="text-sm font-medium">No se puede previsualizar esta URL directamente</p>
        <a
          href={playableSource.src}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 text-xs text-purple-300 underline break-all max-w-md"
        >
          {playableSource.src}
        </a>
      </div>
    );
  };

  if (loading) {
    return <LoadingSpinner message="Cargando editor..." fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Estilos del editor de descripción */}
      <style>{`
        .video-description-editor .ql-toolbar.ql-snow {
          border: none;
          border-bottom: 1px solid #e5e7eb;
          background: #fafafa;
          border-radius: 0;
        }
        .video-description-editor .ql-container.ql-snow {
          border: none;
          font-size: 0.95rem;
        }
        .video-description-editor .ql-editor {
          min-height: 130px;
        }
        .video-description-editor .ql-editor.ql-blank::before {
          font-style: normal;
          color: #9ca3af;
        }
        .video-description-editor .ql-snow .ql-stroke { stroke: #6b7280; }
        .video-description-editor .ql-snow .ql-fill { fill: #6b7280; }
        .video-description-editor .ql-snow.ql-toolbar button:hover .ql-stroke,
        .video-description-editor .ql-snow.ql-toolbar button.ql-active .ql-stroke {
          stroke: #9333ea;
        }
        .video-description-editor .ql-snow.ql-toolbar button:hover .ql-fill,
        .video-description-editor .ql-snow.ql-toolbar button.ql-active .ql-fill {
          fill: #9333ea;
        }
        .video-description-editor .ql-snow.ql-toolbar button:hover,
        .video-description-editor .ql-snow.ql-toolbar button.ql-active {
          color: #9333ea;
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Header flotante (sin barra rectangular) */}
      <header className="sticky top-0 z-40 pointer-events-none">
        <div className="flex items-center gap-3 px-4 sm:px-6 pt-3 pb-2">
          {/* Izquierda: pastilla de navegación + identidad (toda clicable) */}
          <button
            type="button"
            onClick={() => navigate(`/study-contents/${materialId}`)}
            title="Volver al material"
            className="group pointer-events-auto flex items-center gap-2 rounded-2xl bg-white/90 backdrop-blur-md shadow-lg shadow-gray-900/5 ring-1 ring-gray-900/5 pl-1.5 pr-3.5 py-1.5 min-w-0 shrink-0 hover:ring-purple-200 transition-all text-left"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 group-hover:text-purple-600 group-hover:bg-purple-50 transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </span>
            <span className="flex flex-col min-w-0 leading-tight pr-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">
                {topic?.video ? 'Editar video' : 'Nuevo video'}
              </span>
              <span className="text-sm font-semibold text-gray-900 truncate max-w-[120px] sm:max-w-[180px]">
                {topic?.title || 'Video'}
              </span>
            </span>
          </button>

          {/* Centro: chip de identidad del material */}
          <div className="pointer-events-auto hidden md:flex items-center gap-2.5 rounded-2xl bg-white/90 backdrop-blur-md shadow-lg shadow-gray-900/5 ring-1 ring-gray-900/5 px-6 py-2.5">
            <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-purple-50 text-purple-600 shrink-0">
              <Video className="w-4 h-4" />
            </span>
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Editor de material de video</span>
          </div>

          {/* Derecha: guardar */}
          <div className="pointer-events-auto flex items-center gap-2 shrink-0 ml-auto">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center justify-center w-11 h-11 rounded-2xl shadow-lg transition-all ring-1 ${
                showPreview
                  ? 'bg-purple-600 text-white ring-purple-600/30 shadow-purple-600/25'
                  : 'bg-white/90 backdrop-blur-md text-gray-600 ring-gray-900/5 shadow-gray-900/5 hover:text-purple-600 hover:ring-purple-200'
              }`}
              title={showPreview ? 'Volver a editar' : 'Ver vista previa'}
            >
              {showPreview ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !isFormComplete || isUploading}
              className={`flex items-center gap-2 h-11 px-5 rounded-2xl text-sm font-semibold transition-all ${
                isFormComplete && !isUploading
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 hover:bg-purple-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-sm'
              }`}
            >
              {saving || isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>{saving || isUploading ? 'Guardando...' : 'Guardar'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 px-4 sm:px-6 pt-2 pb-6">
        {showPreview ? (
          /* ---------- VISTA PREVIA (tal cual la verá el candidato) ---------- */
          <div className="w-full">
            <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
              <Eye className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-gray-700">Vista previa</span>
              <span className="text-gray-400">— así se verá el video en el material de estudio</span>
            </div>
            <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
              {form.title.trim() || playableSource ? (
                <article className="px-6 sm:px-10 py-8">
                  <h1 className="text-2xl font-bold text-gray-900 mb-5">
                    {form.title || 'Sin título'}
                  </h1>
                  {renderPlayer()}
                  {form.description && sanitizeReadingHtml(form.description).replace(/<[^>]*>/g, '').trim() && (
                    <div
                      className="reading-content prose prose-base max-w-none mt-6 prose-headings:text-gray-900 prose-headings:font-semibold prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-purple-600 prose-strong:text-gray-900"
                      dangerouslySetInnerHTML={{ __html: sanitizeReadingHtml(form.description) }}
                    />
                  )}
                </article>
              ) : (
                <div className="flex flex-col items-center justify-center text-center min-h-[400px] text-gray-400">
                  <Film className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm">Aún no hay contenido para previsualizar</p>
                </div>
              )}
            </div>
          </div>
        ) : (
        /* ---------- EDITOR (dos columnas: datos + previsualización en vivo) ---------- */
        <div className="w-full bg-white border border-gray-200 shadow-xl rounded-2xl overflow-hidden">
          <div className="grid lg:grid-cols-2">
            {/* Columna izquierda: formulario */}
            <div className="px-6 sm:px-8 py-7 space-y-6 lg:border-r lg:border-gray-100">
            {/* Título */}
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                Título del video <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ej: Introducción al tema"
                className="w-full fluid-px-4 fluid-py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all fluid-text-base"
              />
            </div>

            {/* Descripción con editor de texto */}
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                Descripción (opcional)
              </label>
              <div className="video-description-editor border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
                <ReactQuill
                  theme="snow"
                  value={form.description || ''}
                  onChange={(content) => setForm({ ...form, description: content })}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Describe brevemente el contenido del video..."
                  style={{ minHeight: '150px' }}
                />
              </div>
            </div>

            {/* Selector de modo - Upload a la izquierda, URL a la derecha */}
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-3">
                Fuente del video <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 fluid-gap-4">
                <button
                  onClick={() => setMode('upload')}
                  className={`fluid-p-4 border-2 rounded-xl flex flex-col items-center fluid-gap-2 transition-all ${
                    mode === 'upload' 
                      ? 'border-purple-500 bg-purple-50 text-purple-700' 
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <Upload className="w-6 h-6" />
                  <span className="font-medium fluid-text-sm">Subir archivo</span>
                  <span className="fluid-text-xs opacity-70">MP4, WebM, etc.</span>
                </button>
                <button
                  onClick={() => setMode('url')}
                  className={`fluid-p-4 border-2 rounded-xl flex flex-col items-center fluid-gap-2 transition-all ${
                    mode === 'url' 
                      ? 'border-purple-500 bg-purple-50 text-purple-700' 
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <Link className="w-6 h-6" />
                  <span className="font-medium fluid-text-sm">URL externa</span>
                  <span className="fluid-text-xs opacity-70">YouTube, Vimeo, etc.</span>
                </button>
              </div>
            </div>

            {/* Contenido según modo */}
            {mode === 'url' ? (
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                  URL del video <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={form.video_url}
                  onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full fluid-px-4 fluid-py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all fluid-text-base"
                />
                <p className="fluid-mt-2 fluid-text-xs text-gray-500">
                  Soportamos YouTube, Vimeo, o URLs directas a archivos de video
                </p>
              </div>
            ) : (
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                  Archivo de video <span className="text-red-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {!selectedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-xl fluid-p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all"
                  >
                    <Upload className="w-12 h-12 mx-auto text-gray-400 fluid-mb-3" />
                    <p className="text-gray-600 font-medium fluid-text-base">Haz clic para seleccionar un video</p>
                    <p className="fluid-text-sm text-gray-500 fluid-mt-1">MP4, WebM, OGG, MOV • Máximo 2GB</p>
                  </div>
                ) : (
                  <div className="border-2 border-purple-200 bg-purple-50 rounded-xl fluid-p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center fluid-gap-3">
                        <div className="fluid-p-2 bg-purple-100 rounded-lg">
                          <Play className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 fluid-text-base">{selectedFile.name}</p>
                          <p className="fluid-text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="fluid-p-2 hover:bg-purple-100 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                    
                    {isUploading && (
                      <div className="fluid-mt-4">
                        <div className="flex justify-between fluid-text-sm text-gray-600 fluid-mb-1">
                          <span>Subiendo...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>

            {/* Columna derecha: previsualización en vivo del reproductor */}
            <div className="px-6 sm:px-8 py-7 bg-gray-50/70 lg:flex lg:flex-col">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
                <Play className="w-4 h-4 text-purple-600" />
                <span>Previsualización del reproductor</span>
              </div>
              <div className="lg:sticky lg:top-20">
                {renderPlayer()}
                <p className="mt-3 text-xs text-gray-400 leading-relaxed">
                  Así se reproducirá el video para el candidato. Soporta YouTube, Vimeo,
                  archivos subidos y enlaces directos a video.
                </p>
              </div>
            </div>
          </div>
        </div>
        )}
      </main>
    </div>
  );
};

export default VideoEditorPage;
