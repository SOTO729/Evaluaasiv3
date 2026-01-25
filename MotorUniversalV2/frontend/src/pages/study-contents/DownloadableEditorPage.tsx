/**
 * Página de Editor de Material Descargable
 * Pantalla completa para crear/editar archivos descargables
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  getMaterial,
  uploadDownloadable,
  updateDownloadable,
  StudyTopic,
  CreateDownloadableData,
} from '../../services/studyContentService';
import {
  ArrowLeft,
  Download,
  Loader2,
  Check,
  Save,
  Upload,
  File,
  FileText,
  Image,
  X,
  AlertCircle,
  Package,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
    return <Image className="w-5 h-5 text-green-500" />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext || '')) {
    return <FileText className="w-5 h-5 text-blue-500" />;
  }
  return <File className="w-5 h-5 text-gray-500" />;
};

const DownloadableEditorPage = () => {
  const navigate = useNavigate();
  const { id: materialId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const topicId = searchParams.get('topicId');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [topic, setTopic] = useState<StudyTopic | null>(null);
  const [form, setForm] = useState<CreateDownloadableData>({ title: '', file_url: '', file_name: '' });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
          if (foundTopic.downloadable_exercise) {
            setForm({
              title: foundTopic.downloadable_exercise.title,
              description: foundTopic.downloadable_exercise.description,
              file_url: foundTopic.downloadable_exercise.file_url,
              file_name: foundTopic.downloadable_exercise.file_name,
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
    const files = Array.from(e.target.files || []);
    addFiles(files);
  };

  const addFiles = (files: File[]) => {
    if (files.length === 0) return;
    
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    const maxSize = 100 * 1024 * 1024;
    if (totalSize > maxSize) {
      setToast({ message: 'Los archivos exceden el tamaño máximo de 100MB', type: 'error' });
      return;
    }
    
    setSelectedFiles(prev => [...prev, ...files]);
    
    // Auto-completar título si está vacío
    if (!form.title.trim() && files.length === 1) {
      setForm({ ...form, title: files[0].name.replace(/\.[^/.]+$/, '') });
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !materialId || !sessionId || !topicId) {
      setToast({ message: 'Por favor completa el título', type: 'error' });
      return;
    }
    
    // Si no hay archivos nuevos pero ya existe un archivo, solo actualizar metadata
    if (selectedFiles.length === 0 && !form.file_url) {
      setToast({ message: 'Por favor selecciona al menos un archivo', type: 'error' });
      return;
    }
    
    setSaving(true);
    try {
      if (selectedFiles.length === 0 && form.file_url) {
        // Solo actualizar título/descripción
        await updateDownloadable(
          parseInt(materialId),
          parseInt(sessionId),
          parseInt(topicId),
          {
            title: form.title,
            description: form.description || ''
          }
        );
        setToast({ message: 'Material actualizado exitosamente', type: 'success' });
      } else {
        // Subir archivos nuevos
        setIsUploading(true);
        await uploadDownloadable(
          parseInt(materialId),
          parseInt(sessionId),
          parseInt(topicId),
          selectedFiles,
          form.title,
          form.description || '',
          (progress) => setUploadProgress(progress)
        );
        setIsUploading(false);
        setToast({ message: '¡Archivo(s) subido(s) exitosamente!', type: 'success' });
      }
      setTimeout(() => navigate(`/study-contents/${materialId}`), 1000);
    } catch (error: any) {
      console.error('Error saving downloadable:', error);
      setIsUploading(false);
      const errorMessage = error.response?.data?.error || 'Error al subir el archivo';
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

  const isFormComplete = form.title.trim() && (selectedFiles.length > 0 || form.file_url);
  const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);

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

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto fluid-px-4">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate(`/study-contents/${materialId}`)}
              className="flex items-center fluid-gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline fluid-text-sm">Volver al material</span>
            </button>

            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-emerald-100 rounded-lg">
                <Download className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="hidden sm:block">
                <h1 className="fluid-text-lg font-semibold text-gray-900">
                  {topic?.downloadable_exercise ? 'Editar Descargable' : 'Crear Descargable'}
                </h1>
                <p className="fluid-text-sm text-gray-500">{topic?.title}</p>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !isFormComplete || isUploading}
              className={`flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-lg font-medium transition-all fluid-text-sm ${
                isFormComplete && !isUploading
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving || isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span className="hidden sm:inline">Guardar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 max-w-5xl mx-auto w-full fluid-px-4 fluid-py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header visual */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 fluid-p-6 text-white">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative z-10 flex items-center fluid-gap-3">
              <div className="fluid-p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Download className="w-8 h-8" />
              </div>
              <div>
                <h2 className="fluid-text-xl font-semibold">Material Descargable</h2>
                <p className="text-white/80 fluid-text-sm">Sube archivos para que los estudiantes puedan descargar</p>
              </div>
            </div>
          </div>

          <div className="fluid-p-6 space-y-6">
            {/* Título */}
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ej: Guía de estudio completa"
                className="w-full fluid-px-4 fluid-py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all fluid-text-base"
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                Descripción (opcional)
              </label>
              <textarea
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe brevemente el contenido del archivo..."
                rows={3}
                className="w-full fluid-px-4 fluid-py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all resize-none fluid-text-base"
              />
            </div>

            {/* Zona de archivos */}
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                Archivos <span className="text-red-500">*</span>
              </label>
              
              {/* Archivo existente */}
              {form.file_url && selectedFiles.length === 0 && (
                <div className="fluid-mb-4 fluid-p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl">
                  <div className="flex items-center fluid-gap-3">
                    <Package className="w-8 h-8 text-emerald-600" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 fluid-text-base">{form.file_name || 'Archivo actual'}</p>
                      <p className="fluid-text-sm text-gray-500">Archivo ya subido</p>
                    </div>
                    <a 
                      href={form.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="fluid-px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg fluid-text-sm font-medium hover:bg-emerald-200 transition-colors"
                    >
                      Ver
                    </a>
                  </div>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              
              {/* Zona de drop */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl fluid-p-8 text-center cursor-pointer transition-all ${
                  isDragging 
                    ? 'border-emerald-500 bg-emerald-50' 
                    : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50'
                }`}
              >
                <Upload className={`w-12 h-12 mx-auto fluid-mb-3 ${isDragging ? 'text-emerald-500' : 'text-gray-400'}`} />
                <p className="text-gray-600 font-medium fluid-text-base">
                  {isDragging ? 'Suelta los archivos aquí' : 'Arrastra archivos o haz clic para seleccionar'}
                </p>
                <p className="fluid-text-sm text-gray-500 fluid-mt-1">
                  PDF, Word, Excel, imágenes, etc. • Máximo 100MB total
                </p>
                {selectedFiles.length > 1 && (
                  <p className="fluid-text-sm text-emerald-600 fluid-mt-2 font-medium">
                    Se creará un archivo ZIP automáticamente con todos los archivos
                  </p>
                )}
              </div>
              
              {/* Lista de archivos seleccionados */}
              {selectedFiles.length > 0 && (
                <div className="fluid-mt-4 space-y-2">
                  <div className="flex items-center justify-between fluid-text-sm text-gray-600">
                    <span>{selectedFiles.length} archivo(s) seleccionado(s)</span>
                    <span>{formatFileSize(totalSize)}</span>
                  </div>
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 rounded-lg">
                      {getFileIcon(file.name)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate fluid-text-base">{file.name}</p>
                        <p className="fluid-text-sm text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Barra de progreso */}
              {isUploading && (
                <div className="fluid-mt-4">
                  <div className="flex justify-between fluid-text-sm text-gray-600 fluid-mb-1">
                    <span>Subiendo...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DownloadableEditorPage;
