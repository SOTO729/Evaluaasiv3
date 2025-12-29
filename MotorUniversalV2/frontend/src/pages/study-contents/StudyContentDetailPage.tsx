/**
 * Página de detalle de Material de Estudio
 * Muestra la jerarquía completa: Material → Sesiones → Temas → Elementos
 * v2.1 - Soporte para subida de archivos descargables con compresión ZIP
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  getMaterial,
  createSession,
  updateSession,
  deleteSession,
  createTopic,
  updateTopic,
  deleteTopic,
  upsertReading,
  deleteReading,
  upsertVideo,
  uploadVideo,
  deleteVideo,
  uploadDownloadable,
  deleteDownloadable,
  StudyMaterial,
  StudySession,
  StudyTopic,
  CreateSessionData,
  CreateTopicData,
  CreateReadingData,
  CreateVideoData,
  CreateDownloadableData,
} from '../../services/studyContentService';
import {
  BookOpen,
  ArrowLeft,
  Edit2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Layers,
  Hash,
  FileText,
  Video,
  Download,
  Gamepad2,
  Loader2,
  Save,
  X,
  Eye,
  EyeOff,
  Upload,
  Link,
} from 'lucide-react';

// Modal genérico
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  const sizeClasses = {
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg ${sizeClasses[size]} w-full max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

// Componente de notificación toast
interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-[100] animate-pulse">
      <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg ${
        type === 'success' 
          ? 'bg-green-600 text-white' 
          : 'bg-red-600 text-white'
      }`}>
        {type === 'success' ? (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 hover:opacity-80 transition-opacity"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const StudyContentDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const materialId = parseInt(id || '0');

  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set());

  // Modals
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [readingModalOpen, setReadingModalOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [downloadableModalOpen, setDownloadableModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Edit states
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [editingTopic, setEditingTopic] = useState<StudyTopic | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{type: string; id: number; sessionId?: number; name: string} | null>(null);

  // Form states
  const [sessionForm, setSessionForm] = useState<CreateSessionData>({ title: '' });
  const [topicForm, setTopicForm] = useState<CreateTopicData>({ title: '' });
  const [readingForm, setReadingForm] = useState<CreateReadingData>({ title: '', content: '' });
  const [videoForm, setVideoForm] = useState<CreateVideoData>({ title: '', video_url: '' });
  const [downloadableForm, setDownloadableForm] = useState<CreateDownloadableData>({ title: '', file_url: '', file_name: '' });
  const [saving, setSaving] = useState(false);
  
  // Video upload states
  const [videoMode, setVideoMode] = useState<'url' | 'upload'>('url');
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // Downloadable upload states
  const [selectedDownloadableFiles, setSelectedDownloadableFiles] = useState<File[]>([]);
  const [downloadableUploadProgress, setDownloadableUploadProgress] = useState(0);
  const [isUploadingDownloadable, setIsUploadingDownloadable] = useState(false);
  
  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Success modal state
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{ title: string; fileName: string; fileSize: string; contentType?: 'video' | 'file' } | null>(null);

  useEffect(() => {
    if (materialId) {
      loadMaterial();
    }
  }, [materialId]);

  const loadMaterial = async () => {
    setLoading(true);
    try {
      const data = await getMaterial(materialId);
      setMaterial(data);
    } catch (error) {
      console.error('Error loading material:', error);
      navigate('/study-contents');
    } finally {
      setLoading(false);
    }
  };

  const toggleSession = (sessionId: number) => {
    setExpandedSessions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const toggleTopic = (topicId: number) => {
    setExpandedTopics((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      return newSet;
    });
  };

  // Session handlers
  const openSessionModal = (session?: StudySession) => {
    if (session) {
      setEditingSession(session);
      setSessionForm({ title: session.title, description: session.description });
    } else {
      setEditingSession(null);
      setSessionForm({ title: '', description: '' });
    }
    setSessionModalOpen(true);
  };

  const handleSaveSession = async () => {
    if (!sessionForm.title.trim()) return;
    setSaving(true);
    try {
      if (editingSession) {
        await updateSession(materialId, editingSession.id, sessionForm);
      } else {
        await createSession(materialId, sessionForm);
      }
      await loadMaterial();
      setSessionModalOpen(false);
    } catch (error) {
      console.error('Error saving session:', error);
    } finally {
      setSaving(false);
    }
  };

  // Topic handlers
  const openTopicModal = (sessionId: number, topic?: StudyTopic) => {
    setSelectedSessionId(sessionId);
    if (topic) {
      setEditingTopic(topic);
      setTopicForm({ title: topic.title, description: topic.description });
    } else {
      setEditingTopic(null);
      setTopicForm({ title: '', description: '' });
    }
    setTopicModalOpen(true);
  };

  const handleSaveTopic = async () => {
    if (!topicForm.title.trim() || !selectedSessionId) return;
    setSaving(true);
    try {
      if (editingTopic) {
        await updateTopic(materialId, selectedSessionId, editingTopic.id, topicForm);
      } else {
        await createTopic(materialId, selectedSessionId, topicForm);
      }
      await loadMaterial();
      setTopicModalOpen(false);
    } catch (error) {
      console.error('Error saving topic:', error);
    } finally {
      setSaving(false);
    }
  };

  // Element handlers
  const openReadingModal = (sessionId: number, topic: StudyTopic) => {
    setSelectedSessionId(sessionId);
    setSelectedTopicId(topic.id);
    if (topic.reading) {
      setReadingForm({
        title: topic.reading.title,
        content: topic.reading.content,
        estimated_time_minutes: topic.reading.estimated_time_minutes,
      });
    } else {
      setReadingForm({ title: '', content: '' });
    }
    setReadingModalOpen(true);
  };

  const handleSaveReading = async () => {
    if (!readingForm.title.trim() || !selectedSessionId || !selectedTopicId) return;
    setSaving(true);
    try {
      await upsertReading(materialId, selectedSessionId, selectedTopicId, readingForm);
      await loadMaterial();
      setReadingModalOpen(false);
    } catch (error) {
      console.error('Error saving reading:', error);
    } finally {
      setSaving(false);
    }
  };

  const openVideoModal = (sessionId: number, topic: StudyTopic) => {
    setSelectedSessionId(sessionId);
    setSelectedTopicId(topic.id);
    // Reset upload states
    setVideoMode('url');
    setSelectedVideoFile(null);
    setUploadProgress(0);
    setIsUploading(false);
    
    if (topic.video) {
      setVideoForm({
        title: topic.video.title,
        description: topic.video.description,
        video_url: topic.video.video_url,
        video_type: topic.video.video_type,
        thumbnail_url: topic.video.thumbnail_url,
        duration_minutes: topic.video.duration_minutes,
      });
    } else {
      setVideoForm({ title: '', video_url: '' });
    }
    setVideoModalOpen(true);
  };

  const handleSaveVideo = async () => {
    if (!videoForm.title.trim() || !selectedSessionId || !selectedTopicId) {
      setToast({ message: 'Por favor completa el título del video', type: 'error' });
      return;
    }
    
    // Validar según el modo
    if (videoMode === 'url' && !videoForm.video_url.trim()) {
      setToast({ message: 'Por favor ingresa la URL del video', type: 'error' });
      return;
    }
    if (videoMode === 'upload' && !selectedVideoFile) {
      setToast({ message: 'Por favor selecciona un archivo de video', type: 'error' });
      return;
    }
    
    setSaving(true);
    try {
      if (videoMode === 'upload' && selectedVideoFile) {
        // Subir archivo de video
        setIsUploading(true);
        const fileName = selectedVideoFile.name;
        const fileSize = selectedVideoFile.size;
        
        await uploadVideo(
          materialId,
          selectedSessionId,
          selectedTopicId,
          selectedVideoFile,
          videoForm.title,
          videoForm.description || '',
          videoForm.duration_minutes || 0,
          (progress) => setUploadProgress(progress)
        );
        setIsUploading(false);
        await loadMaterial();
        setVideoModalOpen(false);
        
        // Mostrar modal de éxito
        setSuccessModalData({
          title: videoForm.title,
          fileName: fileName,
          fileSize: formatFileSize(fileSize),
          contentType: 'video'
        });
        setSuccessModalOpen(true);
      } else {
        // Guardar URL de video
        await upsertVideo(materialId, selectedSessionId, selectedTopicId, videoForm);
        await loadMaterial();
        setVideoModalOpen(false);
        setToast({ message: '¡Video guardado exitosamente!', type: 'success' });
      }
    } catch (error: any) {
      console.error('Error saving video:', error);
      setIsUploading(false);
      const errorMessage = error.response?.data?.error || 'Error al subir el video. Por favor intenta de nuevo.';
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
      if (!validTypes.includes(file.type)) {
        alert('Tipo de archivo no válido. Use MP4, WebM, OGG, MOV o AVI.');
        return;
      }
      // Validar tamaño (máximo 500MB)
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('El archivo es demasiado grande. El tamaño máximo es 500MB.');
        return;
      }
      setSelectedVideoFile(file);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const openDownloadableModal = (sessionId: number, topic: StudyTopic) => {
    setSelectedSessionId(sessionId);
    setSelectedTopicId(topic.id);
    if (topic.downloadable_exercise) {
      setDownloadableForm({
        title: topic.downloadable_exercise.title,
        description: topic.downloadable_exercise.description,
        file_url: topic.downloadable_exercise.file_url,
        file_name: topic.downloadable_exercise.file_name,
        file_type: topic.downloadable_exercise.file_type,
        file_size_bytes: topic.downloadable_exercise.file_size_bytes,
      });
    } else {
      setDownloadableForm({ title: '', file_url: '', file_name: '', description: '' });
    }
    setSelectedDownloadableFiles([]);
    setDownloadableUploadProgress(0);
    setDownloadableModalOpen(true);
  };

  const handleSaveDownloadable = async () => {
    if (!downloadableForm.title.trim() || !selectedSessionId || !selectedTopicId) {
      setToast({ message: 'Por favor completa el título del ejercicio', type: 'error' });
      return;
    }
    if (selectedDownloadableFiles.length === 0 && !downloadableForm.file_url) {
      setToast({ message: 'Por favor selecciona al menos un archivo', type: 'error' });
      return;
    }
    
    setSaving(true);
    try {
      // Subir archivos
      setIsUploadingDownloadable(true);
      
      // Calcular tamaño total para mostrar en el modal de éxito
      const totalSize = selectedDownloadableFiles.reduce((acc, file) => acc + file.size, 0);
      const filesCount = selectedDownloadableFiles.length;
      
      await uploadDownloadable(
        materialId,
        selectedSessionId,
        selectedTopicId,
        selectedDownloadableFiles,
        downloadableForm.title,
        downloadableForm.description || '',
        (progress) => setDownloadableUploadProgress(progress)
      );
      setIsUploadingDownloadable(false);
      await loadMaterial();
      setDownloadableModalOpen(false);
      
      // Mostrar modal de éxito
      setSuccessModalData({
        title: downloadableForm.title,
        fileName: filesCount === 1 ? selectedDownloadableFiles[0].name : `${filesCount} archivos (ZIP)`,
        fileSize: formatFileSize(totalSize),
        contentType: 'file'
      });
      setSuccessModalOpen(true);
    } catch (error: any) {
      console.error('Error saving downloadable:', error);
      setIsUploadingDownloadable(false);
      const errorMessage = error.response?.data?.error || 'Error al subir el archivo. Por favor intenta de nuevo.';
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadableFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // Validar tamaño total (máximo 100MB)
      const totalSize = files.reduce((acc, file) => acc + file.size, 0);
      const maxSize = 100 * 1024 * 1024;
      if (totalSize > maxSize) {
        alert('Los archivos exceden el tamaño máximo de 100MB.');
        return;
      }
      setSelectedDownloadableFiles(files);
      setDownloadableUploadProgress(0);
      // Auto-completar título si está vacío
      if (!downloadableForm.title.trim() && files.length === 1) {
        setDownloadableForm({ ...downloadableForm, title: files[0].name.replace(/\.[^/.]+$/, '') });
      }
    }
  };

  const removeDownloadableFile = (index: number) => {
    setSelectedDownloadableFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Delete handlers
  const openDeleteModal = (type: string, id: number, name: string, sessionId?: number) => {
    setDeleteTarget({ type, id, name, sessionId });
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      switch (deleteTarget.type) {
        case 'session':
          await deleteSession(materialId, deleteTarget.id);
          break;
        case 'topic':
          if (deleteTarget.sessionId) {
            await deleteTopic(materialId, deleteTarget.sessionId, deleteTarget.id);
          }
          break;
        case 'reading':
          if (deleteTarget.sessionId && selectedTopicId) {
            await deleteReading(materialId, deleteTarget.sessionId, selectedTopicId);
          }
          break;
        case 'video':
          if (deleteTarget.sessionId && selectedTopicId) {
            await deleteVideo(materialId, deleteTarget.sessionId, selectedTopicId);
          }
          break;
        case 'downloadable':
          if (deleteTarget.sessionId && selectedTopicId) {
            await deleteDownloadable(materialId, deleteTarget.sessionId, selectedTopicId);
          }
          break;
      }
      await loadMaterial();
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando material...</p>
        </div>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="p-6">
        <p className="text-red-600">Material no encontrado</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/study-contents')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Volver a la lista
        </button>

        <div className="flex justify-between items-start">
          <div className="flex gap-4">
            {material.image_url ? (
              <img src={material.image_url} alt={material.title} className="h-20 w-20 rounded-lg object-cover" />
            ) : (
              <div className="h-20 w-20 rounded-lg bg-blue-100 flex items-center justify-center">
                <BookOpen className="h-10 w-10 text-blue-600" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{material.title}</h1>
              {material.description && <p className="text-gray-600 mt-1">{material.description}</p>}
              <div className="flex items-center gap-4 mt-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${material.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {material.is_published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {material.is_published ? 'Publicado' : 'Borrador'}
                </span>
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <Layers className="h-4 w-4" />
                  {material.sessions?.length || 0} sesiones
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate(`/study-contents/${materialId}/edit`)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Edit2 className="h-5 w-5" />
            Editar Material
          </button>
        </div>
      </div>

      {/* Sessions */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Sesiones</h2>
          <button
            onClick={() => openSessionModal()}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Nueva Sesión
          </button>
        </div>

        {!material.sessions?.length ? (
          <div className="p-8 text-center">
            <Layers className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay sesiones aún</p>
            <button
              onClick={() => openSessionModal()}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Crear Primera Sesión
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {material.sessions.map((session) => (
              <div key={session.id} className="border-b last:border-b-0">
                {/* Session Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleSession(session.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedSessions.has(session.id) ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Hash className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        Sesión {session.session_number}: {session.title}
                      </h3>
                      {session.description && (
                        <p className="text-sm text-gray-500">{session.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-sm text-gray-500">{session.topics?.length || 0} temas</span>
                    <button
                      onClick={() => openSessionModal(session)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openDeleteModal('session', session.id, session.title)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Topics */}
                {expandedSessions.has(session.id) && (
                  <div className="bg-gray-50 border-t">
                    <div className="p-3 flex justify-between items-center border-b bg-gray-100">
                      <span className="text-sm font-medium text-gray-600">Temas de la sesión</span>
                      <button
                        onClick={() => openTopicModal(session.id)}
                        className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1 text-sm"
                      >
                        <Plus className="h-4 w-4" />
                        Nuevo Tema
                      </button>
                    </div>

                    {!session.topics?.length ? (
                      <div className="p-6 text-center">
                        <p className="text-gray-500 text-sm">No hay temas en esta sesión</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {session.topics.map((topic) => (
                          <div key={topic.id} className="bg-white">
                            {/* Topic Header */}
                            <div
                              className="flex items-center justify-between p-3 pl-8 cursor-pointer hover:bg-gray-50"
                              onClick={() => toggleTopic(topic.id)}
                            >
                              <div className="flex items-center gap-3">
                                {expandedTopics.has(topic.id) ? (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-400" />
                                )}
                                <span className="font-medium text-gray-800">{topic.title}</span>
                              </div>
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                {/* Element indicators */}
                                <div className="flex gap-1">
                                  <span className={`p-1 rounded ${topic.reading ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`} title="Lectura">
                                    <FileText className="h-3.5 w-3.5" />
                                  </span>
                                  <span className={`p-1 rounded ${topic.video ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`} title="Video">
                                    <Video className="h-3.5 w-3.5" />
                                  </span>
                                  <span className={`p-1 rounded ${topic.downloadable_exercise ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`} title="Descargable">
                                    <Download className="h-3.5 w-3.5" />
                                  </span>
                                  <span className={`p-1 rounded ${topic.interactive_exercise ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`} title="Interactivo">
                                    <Gamepad2 className="h-3.5 w-3.5" />
                                  </span>
                                </div>
                                <button
                                  onClick={() => openTopicModal(session.id, topic)}
                                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openDeleteModal('topic', topic.id, topic.title, session.id)}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            {/* Topic Elements */}
                            {expandedTopics.has(topic.id) && (
                              <div className="bg-gray-50 p-4 pl-16 grid grid-cols-2 gap-3">
                                {/* Lectura */}
                                <div
                                  onClick={() => openReadingModal(session.id, topic)}
                                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                    topic.reading ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-white hover:bg-gray-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <FileText className={`h-5 w-5 ${topic.reading ? 'text-green-600' : 'text-gray-400'}`} />
                                    <span className="font-medium text-sm">Lectura</span>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    {topic.reading ? topic.reading.title : 'Sin contenido'}
                                  </p>
                                </div>

                                {/* Video */}
                                <div
                                  onClick={() => openVideoModal(session.id, topic)}
                                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                    topic.video ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-white hover:bg-gray-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <Video className={`h-5 w-5 ${topic.video ? 'text-green-600' : 'text-gray-400'}`} />
                                    <span className="font-medium text-sm">Video</span>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    {topic.video ? topic.video.title : 'Sin contenido'}
                                  </p>
                                </div>

                                {/* Descargable */}
                                <div
                                  onClick={() => openDownloadableModal(session.id, topic)}
                                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                    topic.downloadable_exercise ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-white hover:bg-gray-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <Download className={`h-5 w-5 ${topic.downloadable_exercise ? 'text-green-600' : 'text-gray-400'}`} />
                                    <span className="font-medium text-sm">Ejercicio Descargable</span>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    {topic.downloadable_exercise ? topic.downloadable_exercise.title : 'Sin contenido'}
                                  </p>
                                </div>

                                {/* Interactivo */}
                                <div
                                  onClick={() => navigate(`/study-contents/${materialId}/sessions/${session.id}/topics/${topic.id}/interactive`)}
                                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                    topic.interactive_exercise ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-white hover:bg-gray-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <Gamepad2 className={`h-5 w-5 ${topic.interactive_exercise ? 'text-green-600' : 'text-gray-400'}`} />
                                    <span className="font-medium text-sm">Ejercicio Interactivo</span>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    {topic.interactive_exercise ? topic.interactive_exercise.title : 'Sin contenido'}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Modal */}
      <Modal
        isOpen={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        title={editingSession ? 'Editar Sesión' : 'Nueva Sesión'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              value={sessionForm.title}
              onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Introducción al tema"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={sessionForm.description || ''}
              onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button onClick={() => setSessionModalOpen(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={handleSaveSession}
              disabled={saving || !sessionForm.title.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Topic Modal */}
      <Modal
        isOpen={topicModalOpen}
        onClose={() => setTopicModalOpen(false)}
        title={editingTopic ? 'Editar Tema' : 'Nuevo Tema'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              value={topicForm.title}
              onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={topicForm.description || ''}
              onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button onClick={() => setTopicModalOpen(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={handleSaveTopic}
              disabled={saving || !topicForm.title.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Reading Modal */}
      <Modal
        isOpen={readingModalOpen}
        onClose={() => setReadingModalOpen(false)}
        title="Lectura"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              value={readingForm.title}
              onChange={(e) => setReadingForm({ ...readingForm, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contenido *</label>
            <div className="border rounded-lg overflow-hidden">
              <ReactQuill
                theme="snow"
                value={readingForm.content}
                onChange={(content) => setReadingForm({ ...readingForm, content })}
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'indent': '-1'}, { 'indent': '+1' }],
                    [{ 'align': [] }],
                    ['link', 'image'],
                    ['blockquote', 'code-block'],
                    ['clean']
                  ],
                }}
                formats={[
                  'header',
                  'bold', 'italic', 'underline', 'strike',
                  'color', 'background',
                  'list', 'bullet', 'indent',
                  'align',
                  'link', 'image',
                  'blockquote', 'code-block'
                ]}
                placeholder="Escribe el contenido de la lectura aquí..."
                style={{ minHeight: '300px' }}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tiempo estimado (minutos)</label>
            <input
              type="number"
              value={readingForm.estimated_time_minutes || ''}
              onChange={(e) => setReadingForm({ ...readingForm, estimated_time_minutes: parseInt(e.target.value) || undefined })}
              className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button onClick={() => setReadingModalOpen(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={handleSaveReading}
              disabled={saving || !readingForm.title.trim() || !readingForm.content.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Video Modal */}
      <Modal
        isOpen={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        title="Video"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              value={videoForm.title}
              onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Tabs para elegir entre URL o Subir archivo */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setVideoMode('url')}
                className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 ${
                  videoMode === 'url'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Link className="h-4 w-4" />
                URL
              </button>
              <button
                onClick={() => setVideoMode('upload')}
                className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 ${
                  videoMode === 'upload'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Upload className="h-4 w-4" />
                Subir archivo
              </button>
            </nav>
          </div>
          
          {/* Contenido según el modo seleccionado */}
          {videoMode === 'url' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL del video *</label>
                <input
                  type="url"
                  value={videoForm.video_url}
                  onChange={(e) => setVideoForm({ ...videoForm, video_url: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de video</label>
                <select
                  value={videoForm.video_type || 'youtube'}
                  onChange={(e) => setVideoForm({ ...videoForm, video_type: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="youtube">YouTube</option>
                  <option value="vimeo">Vimeo</option>
                  <option value="direct">Enlace Directo</option>
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Archivo de video *</label>
              <div className="mt-1">
                {!selectedVideoFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">
                        <span className="font-medium text-blue-600">Click para seleccionar</span> o arrastre un archivo
                      </p>
                      <p className="text-xs text-gray-400 mt-1">MP4, WebM, OGG, MOV, AVI (máx. 500MB)</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo"
                      onChange={handleVideoFileChange}
                    />
                  </label>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Video className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">{selectedVideoFile.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(selectedVideoFile.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedVideoFile(null)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <X className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                    {isUploading && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">Subiendo...</span>
                          <span className="text-blue-600 font-medium">{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={videoForm.description || ''}
              onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duración (minutos)</label>
            <input
              type="number"
              min="0"
              value={videoForm.duration_minutes || ''}
              onChange={(e) => setVideoForm({ ...videoForm, duration_minutes: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: 15"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button 
              onClick={() => setVideoModalOpen(false)} 
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              disabled={isUploading}
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveVideo}
              disabled={saving || isUploading || !videoForm.title.trim() || (videoMode === 'url' ? !videoForm.video_url.trim() : !selectedVideoFile)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving || isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isUploading ? 'Subiendo...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Downloadable Modal - Formulario mejorado con editor de instrucciones */}
      <Modal
        isOpen={downloadableModalOpen}
        onClose={() => setDownloadableModalOpen(false)}
        title="Ejercicio Descargable"
        size="lg"
      >
        <div className="space-y-5">
          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título del ejercicio *</label>
            <input
              type="text"
              value={downloadableForm.title}
              onChange={(e) => setDownloadableForm({ ...downloadableForm, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre del ejercicio"
            />
          </div>
          
          {/* Instrucciones con editor de texto enriquecido */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones</label>
            <div className="border rounded-lg overflow-hidden">
              <ReactQuill
                theme="snow"
                value={downloadableForm.description || ''}
                onChange={(content) => setDownloadableForm({ ...downloadableForm, description: content })}
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'indent': '-1'}, { 'indent': '+1' }],
                    [{ 'align': [] }],
                    ['link'],
                    ['clean']
                  ],
                }}
                formats={[
                  'header',
                  'bold', 'italic', 'underline', 'strike',
                  'color', 'background',
                  'list', 'bullet', 'indent',
                  'align',
                  'link'
                ]}
                className="bg-white"
                style={{ minHeight: '150px' }}
                placeholder="Escribe las instrucciones para realizar el ejercicio..."
              />
            </div>
          </div>
          
          {/* Archivo actual si existe */}
          {downloadableForm.file_url && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-800 mb-1">Archivo actual:</p>
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-blue-600" />
                <a 
                  href={downloadableForm.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {downloadableForm.file_name || 'Descargar archivo'}
                </a>
              </div>
              <p className="text-xs text-blue-600 mt-1">Sube nuevos archivos para reemplazar el actual</p>
            </div>
          )}
          
          {/* Área de subida de archivos */}
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivos {!downloadableForm.file_url && '*'} <span className="text-gray-400 text-xs">(Máximo 100MB total. Múltiples archivos se comprimen en ZIP)</span>
              </label>
              
              {/* Área de drop */}
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => document.getElementById('downloadable-file-input')?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50'); }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50'); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length > 0) {
                    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
                    if (totalSize > 100 * 1024 * 1024) {
                      alert('Los archivos exceden el tamaño máximo de 100MB.');
                      return;
                    }
                    setSelectedDownloadableFiles(files);
                    if (!downloadableForm.title.trim() && files.length === 1) {
                      setDownloadableForm({ ...downloadableForm, title: files[0].name.replace(/\.[^/.]+$/, '') });
                    }
                  }
                }}
              >
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Arrastra archivos aquí o haz clic para seleccionar</p>
                <p className="text-gray-400 text-sm mt-1">PDF, DOC, XLS, ZIP, etc.</p>
                <input
                  id="downloadable-file-input"
                  type="file"
                  multiple
                  onChange={handleDownloadableFileChange}
                  className="hidden"
                />
              </div>
              
              {/* Lista de archivos seleccionados */}
              {selectedDownloadableFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    {selectedDownloadableFiles.length} archivo(s) seleccionado(s)
                    {selectedDownloadableFiles.length > 1 && ' (se comprimirán en ZIP)'}
                  </p>
                  {selectedDownloadableFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Download className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeDownloadableFile(index)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <X className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                  ))}
                  
                  {/* Barra de progreso */}
                  {isUploadingDownloadable && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Subiendo...</span>
                        <span className="text-blue-600 font-medium">{downloadableUploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${downloadableUploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button 
              onClick={() => setDownloadableModalOpen(false)} 
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              disabled={isUploadingDownloadable}
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveDownloadable}
              disabled={saving || isUploadingDownloadable || !downloadableForm.title.trim() || (selectedDownloadableFiles.length === 0 && !downloadableForm.file_url)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving || isUploadingDownloadable ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isUploadingDownloadable ? 'Subiendo...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Success Modal - Confirmación de archivo/video subido */}
      <Modal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title=""
      >
        <div className="text-center py-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            ¡{successModalData?.contentType === 'video' ? 'Video' : 'Archivo'} cargado exitosamente!
          </h3>
          <p className="text-gray-600 mb-4">
            {successModalData?.contentType === 'video' 
              ? 'Tu video ha sido subido y procesado correctamente.'
              : 'Tu ejercicio descargable ha sido guardado correctamente.'}
          </p>
          
          {successModalData && (
            <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Título:</span>
                  <span className="text-sm font-medium text-gray-900">{successModalData.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{successModalData.contentType === 'video' ? 'Video:' : 'Archivo:'}</span>
                  <span className="text-sm font-medium text-gray-900">{successModalData.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Tamaño original:</span>
                  <span className="text-sm font-medium text-gray-900">{successModalData.fileSize}</span>
                </div>
              </div>
            </div>
          )}
          
          <button
            onClick={() => setSuccessModalOpen(false)}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            Aceptar
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        title="Confirmar eliminación"
      >
        <div>
          <p className="text-gray-600 mb-4">
            ¿Estás seguro de que deseas eliminar "{deleteTarget?.name}"?
            {deleteTarget?.type === 'session' && ' Esto también eliminará todos los temas asociados.'}
            {deleteTarget?.type === 'topic' && ' Esto también eliminará todos los elementos del tema.'}
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setDeleteTarget(null);
              }}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Eliminar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StudyContentDetailPage;
