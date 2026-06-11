/**
 * Página de Editor de Material Descargable
 * Pantalla completa para crear/editar archivos descargables
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useUnsavedChanges, UnsavedChangesModal } from '../../components/ui/UnsavedChangesModal';
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

  // Aviso de cambios sin guardar
  const initialFormRef = useRef<string | null>(null);
  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);
  const isDirty = initialFormRef.current !== null &&
    (JSON.stringify(form) !== initialFormRef.current || selectedFiles.length > 0);
  useUnsavedChanges(isDirty);
  const tryNavigate = (go: () => void) => { if (isDirty) setPendingNav(() => go); else go(); };
  useEffect(() => {
    if (!loading && initialFormRef.current === null) initialFormRef.current = JSON.stringify(form);
  }, [loading, form]);

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

  // Descarga un archivo individual del desglose (uno por uno).
  const downloadSingleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      <UnsavedChangesModal
        open={!!pendingNav}
        onStay={() => setPendingNav(null)}
        onLeave={() => { const go = pendingNav; setPendingNav(null); go?.(); }}
      />

      {/* Header flotante (sin barra rectangular) */}
      <header className="sticky top-0 z-40 pointer-events-none">
        <div className="flex items-center gap-3 px-4 sm:px-6 pt-3 pb-2">
          {/* Izquierda: pastilla de navegación + identidad (toda clicable) */}
          <button
            type="button"
            onClick={() => tryNavigate(() => navigate(`/study-contents/${materialId}`))}
            title="Volver al material"
            className="group pointer-events-auto flex items-center gap-2 rounded-2xl bg-white/90 backdrop-blur-md shadow-lg shadow-gray-900/5 ring-1 ring-gray-900/5 pl-1.5 pr-3.5 py-1.5 min-w-0 shrink-0 hover:ring-emerald-200 transition-all text-left"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </span>
            <span className="flex flex-col min-w-0 leading-tight pr-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                {topic?.downloadable_exercise ? 'Editar descargable' : 'Nuevo descargable'}
              </span>
              <span className="text-sm font-semibold text-gray-900 truncate max-w-[120px] sm:max-w-[180px]">
                {topic?.title || 'Descargable'}
              </span>
            </span>
          </button>

          {/* Centro: chip de identidad del material */}
          <div className="pointer-events-auto hidden md:flex items-center gap-2.5 rounded-2xl bg-white/90 backdrop-blur-md shadow-lg shadow-gray-900/5 ring-1 ring-gray-900/5 px-6 py-2.5">
            <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <Download className="w-4 h-4" />
            </span>
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Material descargable</span>
          </div>

          {/* Derecha: guardar */}
          <div className="pointer-events-auto flex items-center gap-2 shrink-0 ml-auto">
            <button
              onClick={handleSave}
              disabled={saving || !isFormComplete || isUploading}
              className={`flex items-center gap-2 h-11 px-5 rounded-2xl text-sm font-semibold transition-all ${
                isFormComplete && !isUploading
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700'
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
        <div className="w-full bg-white border border-gray-200 shadow-xl rounded-2xl overflow-hidden">
          <div className="grid lg:grid-cols-2">
            {/* Columna izquierda: formulario y carga de archivos */}
            <div className="px-6 sm:px-8 py-7 space-y-6 lg:border-r lg:border-gray-100">
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
              
              {/* Lista de archivos seleccionados (se muestra en la columna derecha) */}

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

            {/* Columna derecha: desglose de archivos del paquete */}
            <div className="px-6 sm:px-8 py-7 bg-gray-50/70 lg:flex lg:flex-col">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-semibold text-gray-800">
                  {selectedFiles.length > 1 ? 'Archivos en el ZIP' : 'Archivos del paquete'}
                </h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                {selectedFiles.length > 1
                  ? 'Estos archivos se empaquetarán en un ZIP. Puedes descargarlos uno por uno.'
                  : 'Desglose de los archivos del material descargable.'}
              </p>

              {selectedFiles.length > 0 ? (
                <div className="space-y-2 lg:flex-1 lg:overflow-y-auto">
                  <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                    <span>{selectedFiles.length} archivo(s)</span>
                    <span>{formatFileSize(totalSize)}</span>
                  </div>
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-xl ring-1 ring-gray-200/70 shadow-sm">
                      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 shrink-0">
                        {getFileIcon(file.name)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate text-sm">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadSingleFile(file)}
                        title="Descargar este archivo"
                        className="flex items-center justify-center w-9 h-9 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors shrink-0"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        title="Quitar del paquete"
                        className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : form.file_url ? (
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl ring-1 ring-gray-200/70 shadow-sm">
                  <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 shrink-0">
                    {form.file_name ? getFileIcon(form.file_name) : <Package className="w-5 h-5 text-emerald-600" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate text-sm">{form.file_name || 'Archivo actual'}</p>
                    <p className="text-xs text-gray-500">Archivo ya subido</p>
                  </div>
                  <a
                    href={form.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Descargar archivo"
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors shrink-0"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <div className="lg:flex-1 flex flex-col items-center justify-center text-center text-gray-400 py-10">
                  <Package className="w-10 h-10 mb-3 text-gray-300" />
                  <p className="text-sm">Aún no has agregado archivos</p>
                  <p className="text-xs text-gray-400 mt-1">Los archivos que selecciones aparecerán aquí.</p>
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
