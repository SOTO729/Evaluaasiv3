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
  StudyTopic,
  CreateVideoData,
} from '../../services/studyContentService';
import {
  ArrowLeft,
  Video,
  Loader2,
  Check,
  Upload,
  Link,
  Play,
  X,
  AlertCircle,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Función para convertir HTML a texto plano
const htmlToPlainText = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Módulos de Quill para descripción
  const quillModules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ],
  }), []);

  const quillFormats = useMemo(() => [
    'bold', 'italic', 'underline',
    'list'
  ], []);
  
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
            // Convertir descripción HTML a texto plano si es necesario
            const description = foundTopic.video.description || '';
            const cleanDescription = description.includes('<') ? htmlToPlainText(description) : description;
            
            setForm({
              title: foundTopic.video.title,
              description: cleanDescription,
              video_url: foundTopic.video.video_url,
              video_type: foundTopic.video.video_type,
              thumbnail_url: foundTopic.video.thumbnail_url,
            });
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

  if (loading) {
    return <LoadingSpinner message="Cargando editor..." fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 fluid-px-4 fluid-py-3 rounded-lg shadow-lg flex items-center fluid-gap-2 fluid-text-sm ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Header pegado al navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="w-full fluid-px-4">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate(`/study-contents/${materialId}`)}
              className="flex items-center fluid-gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline fluid-text-sm">Volver al material</span>
            </button>

            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-purple-100 rounded-lg">
                <Video className="w-5 h-5 text-purple-600" />
              </div>
              <div className="hidden sm:block">
                <h1 className="fluid-text-lg font-semibold text-gray-900">
                  {topic?.video ? 'Editar Video' : 'Crear Video'}
                </h1>
                <p className="fluid-text-sm text-gray-500">{topic?.title}</p>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !isFormComplete || isUploading}
              className={`flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-lg font-medium transition-all fluid-text-sm ${
                isFormComplete && !isUploading
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving || isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : null}
              <span>Guardar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido - ocupa toda la pantalla */}
      <main className="flex-1 w-full fluid-px-4 fluid-py-6">
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header visual */}
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 fluid-p-6 text-white">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative z-10 flex items-center fluid-gap-3">
              <div className="fluid-p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Video className="w-8 h-8" />
              </div>
              <div>
                <h2 className="fluid-text-xl font-semibold">Material de Video</h2>
                <p className="text-white/80 fluid-text-sm">Sube un video o ingresa una URL</p>
              </div>
            </div>
          </div>

          <div className="fluid-p-6 space-y-6">
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
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
                <ReactQuill
                  theme="snow"
                  value={form.description || ''}
                  onChange={(content) => setForm({ ...form, description: content })}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Describe brevemente el contenido del video..."
                  style={{ minHeight: '120px' }}
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
        </div>
      </main>
    </div>
  );
};

export default VideoEditorPage;
