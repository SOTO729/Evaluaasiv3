/**
 * Página de detalle de Material de Estudio
 * Muestra la jerarquía completa: Material → Sesiones → Temas → Elementos
 * v2.1 - Soporte para subida de archivos descargables con compresión ZIP
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import html2canvas from 'html2canvas';
import {
  getMaterial,
  updateMaterial,
  deleteMaterial,
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
  updateDownloadable,
  deleteDownloadable,
  createInteractive,
  updateInteractive,
  getInteractive,
  StudyMaterial,
  StudySession,
  StudyTopic,
  CreateSessionData,
  CreateTopicData,
  CreateReadingData,
  CreateVideoData,
  CreateDownloadableData,
  StudyInteractiveExerciseStep,
  StudyInteractiveExerciseAction,
} from '../../services/studyContentService';
import {
  ArrowLeft,
  Edit2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Layers,
  FolderOpen,
  FileText,
  Video,
  Download,
  Gamepad2,
  Loader2,
  X,
  Eye,
  EyeOff,
  Upload,
  ClipboardList,
  Link,
  AlertCircle,
  PlayCircle,
  Check,
  Clock,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { isAzureUrl } from '../../lib/urlHelpers';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`bg-white rounded-lg ${sizeClasses[size]} w-full max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
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
    }, 3000); // Auto-dismiss after 3 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-in">
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
  const [dominantColor, setDominantColor] = useState<string>('#1e3a5f');

  // Function to extract dominant color from image
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

      // Sample from the bottom half of the image (where the gradient will blend)
      const startY = Math.floor(img.height * 0.5);
      const imageData = ctx.getImageData(0, startY, img.width, img.height - startY);
      const data = imageData.data;

      let r = 0, g = 0, b = 0, count = 0;

      // Sample every 10th pixel for performance
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
        
        // Darken the color to 60% for better contrast with white text
        const darkenFactor = 0.6;
        r = Math.floor(r * darkenFactor);
        g = Math.floor(g * darkenFactor);
        b = Math.floor(b * darkenFactor);
        
        setDominantColor(`rgb(${r}, ${g}, ${b})`);
      }
    };
    img.onerror = () => {
      setDominantColor('#1e3a5f'); // Fallback to dark blue
    };
    img.src = imageUrl;
  };

  // Extract dominant color when material image changes
  useEffect(() => {
    if (material?.image_url) {
      extractDominantColor(material.image_url);
    }
  }, [material?.image_url]);

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
  
  // Delete material modal state
  const [showDeleteMaterialModal, setShowDeleteMaterialModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Confirm change video source modal state
  const [showChangeVideoSourceModal, setShowChangeVideoSourceModal] = useState(false);
  
  // Auth store
  const { user } = useAuthStore();
  
  // Success modal state
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{ title: string; fileName: string; fileSize: string; contentType?: 'video' | 'file' } | null>(null);

  // Interactive exercise config modal state
  const [interactiveConfigOpen, setInteractiveConfigOpen] = useState(false);
  const [interactiveConfigData, setInteractiveConfigData] = useState<{
    topicId: number;
    sessionId: number;
    isNew: boolean;
  } | null>(null);
  const [interactiveForm, setInteractiveForm] = useState({
    title: '',
    description: ''
  });
  const [savingInteractive, setSavingInteractive] = useState(false);
  
  // Estados para descarga de imágenes del ejercicio interactivo
  const [isDownloadingImages, setIsDownloadingImages] = useState(false);
  const [interactiveSteps, setInteractiveSteps] = useState<StudyInteractiveExerciseStep[]>([]);
  const [loadingInteractiveSteps, setLoadingInteractiveSteps] = useState(false);

  // Validation modal state
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    is_valid: boolean;
    errors: { session: string; topic: string; element: string; message: string }[];
    summary: {
      total_sessions: number;
      total_topics: number;
      complete_topics: number;
      incomplete_topics: number;
    };
  } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Validation function
  const validateMaterialForPublish = () => {
    if (!material) return null;

    const errors: { session: string; topic: string; element: string; message: string }[] = [];
    let totalTopics = 0;
    let completeTopics = 0;
    let incompleteTopics = 0;

    // Check if there are sessions
    if (!material.sessions || material.sessions.length === 0) {
      errors.push({
        session: 'General',
        topic: '',
        element: 'Sesiones',
        message: 'El material debe tener al menos una sesión'
      });
    } else {
      material.sessions.forEach((session) => {
        // Check if session has topics
        if (!session.topics || session.topics.length === 0) {
          errors.push({
            session: `Sesión ${session.session_number}: ${session.title}`,
            topic: '',
            element: 'Temas',
            message: 'La sesión debe tener al menos un tema'
          });
        } else {
          session.topics.forEach((topic) => {
            totalTopics++;
            const missingElements: string[] = [];

            // Solo validar los tipos de contenido que están activos para este tema
            if (topic.allow_reading !== false && !topic.reading) missingElements.push('Lectura');
            if (topic.allow_video !== false && !topic.video) missingElements.push('Video');
            if (topic.allow_downloadable !== false && !topic.downloadable_exercise) missingElements.push('Ejercicio Descargable');
            if (topic.allow_interactive !== false && !topic.interactive_exercise) missingElements.push('Ejercicio Interactivo');

            if (missingElements.length > 0) {
              incompleteTopics++;
              errors.push({
                session: `Sesión ${session.session_number}: ${session.title}`,
                topic: topic.title,
                element: missingElements.join(', '),
                message: `Faltan elementos: ${missingElements.join(', ')}`
              });
            } else {
              completeTopics++;
            }
          });
        }
      });
    }

    return {
      is_valid: errors.length === 0,
      errors,
      summary: {
        total_sessions: material.sessions?.length || 0,
        total_topics: totalTopics,
        complete_topics: completeTopics,
        incomplete_topics: incompleteTopics
      }
    };
  };

  // Handle validate and publish
  const handleValidateAndPublish = () => {
    const result = validateMaterialForPublish();
    setValidationResult(result);
    setShowValidationModal(true);
  };

  // Handle publish
  const handlePublish = async () => {
    if (!validationResult?.is_valid) return;
    
    setIsPublishing(true);
    try {
      await updateMaterial(Number(materialId), { is_published: true });
      setShowValidationModal(false);
      setToast({ message: '¡Material publicado exitosamente! Ya está disponible para los estudiantes.', type: 'success' });
      loadMaterial();
    } catch (error) {
      console.error('Error publishing material:', error);
      setToast({ message: 'Error al publicar el material', type: 'error' });
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle delete material
  const handleDeleteMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    
    if (!deletePassword.trim()) return;
    
    setIsDeleting(true);
    try {
      // Verify password first
      await api.post('/auth/verify-password', { password: deletePassword });
      
      // Delete material
      await deleteMaterial(materialId);
      
      // Redirect to materials list
      navigate('/study-contents');
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Contraseña incorrecta';
      setDeleteError(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (materialId) {
      loadMaterial();
    }
  }, [materialId]);

  const loadMaterial = async () => {
    setLoading(true);
    try {
      console.log('📚 Loading material with ID:', materialId);
      const data = await getMaterial(materialId);
      console.log('📚 Material loaded successfully:', data?.title);
      setMaterial(data);
    } catch (error: any) {
      console.error('❌ Error loading material:', error);
      console.error('❌ Error response:', error?.response?.data);
      console.error('❌ Error status:', error?.response?.status);
      // Only redirect if it's a 404 (material not found)
      if (error?.response?.status === 404) {
        navigate('/study-contents');
      } else {
        // For other errors, show toast and stay on page
        setToast({ 
          message: error?.response?.data?.message || 'Error al cargar el material. Intenta de nuevo.', 
          type: 'error' 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Cargar pasos del ejercicio interactivo para la descarga
  const loadInteractiveSteps = async (sessionId: number, topicId: number) => {
    setLoadingInteractiveSteps(true);
    try {
      const data = await getInteractive(materialId, sessionId, topicId);
      setInteractiveSteps(data?.steps || []);
    } catch (error) {
      console.error('Error loading interactive steps:', error);
      setInteractiveSteps([]);
    } finally {
      setLoadingInteractiveSteps(false);
    }
  };

  // Función auxiliar para convertir imagen URL a base64
  const imageUrlToBase64 = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  };

  // Función auxiliar para generar imagen de un paso con overlays
  const generateStepImageWithOverlays = async (step: StudyInteractiveExerciseStep): Promise<HTMLCanvasElement | null> => {
    if (!step?.image_url) return null;
    
    // Filtrar acciones que deben mostrarse (comentarios + no-invisibles)
    const visibleActions = (step.actions || []).filter((action: StudyInteractiveExerciseAction) => {
      if (action.action_type === 'comment') return true;
      return action.label_style && action.label_style !== 'invisible';
    });
    
    // Convertir imagen a base64 para evitar problemas de CORS
    let imageBase64: string;
    try {
      imageBase64 = await imageUrlToBase64(step.image_url);
    } catch (error) {
      console.error('Error loading image:', error);
      return null;
    }
    
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    document.body.appendChild(tempContainer);
    
    const img = new Image();
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Error cargando la imagen'));
      img.src = imageBase64;
    });
    
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    
    tempContainer.innerHTML = `
      <div style="position: relative; width: ${imgWidth}px; height: ${imgHeight}px; background: white;">
        <img src="${imageBase64}" style="width: 100%; height: 100%; display: block;" />
        ${visibleActions.map((action: StudyInteractiveExerciseAction) => {
          const left = (action.position_x / 100) * imgWidth;
          const top = (action.position_y / 100) * imgHeight;
          const width = (action.width / 100) * imgWidth;
          const height = (action.height / 100) * imgHeight;
          
          if (action.action_type === 'comment') {
            const bgColor = action.comment_bg_color || '#3b82f6';
            const textColor = action.comment_text_color || '#ffffff';
            const fontSize = action.comment_font_size || 14;
            
            return `
              <div style="
                position: absolute;
                left: ${left}px;
                top: ${top}px;
                width: ${width}px;
                height: ${height}px;
                background-color: ${bgColor};
                border: 2px solid ${textColor};
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 8px;
                box-sizing: border-box;
                color: ${textColor};
                font-size: ${fontSize}px;
                font-weight: 500;
                text-align: center;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              ">
                ${action.comment_text || action.label || 'Comentario'}
              </div>
            `;
          } else {
            const labelStyle = action.label_style;
            const isTextInput = action.action_type === 'text_input';
            const label = action.label || action.placeholder || '';
            
            let bgColor = 'transparent';
            let textBg = 'transparent';
            let textColor = '#1f2937';
            let showText = false;
            let showShadow = false;
            
            if (labelStyle === 'text_only') {
              showText = true;
              textBg = 'rgba(255, 255, 255, 0.9)';
            } else if (labelStyle === 'text_with_shadow') {
              showText = true;
              showShadow = true;
              bgColor = isTextInput ? 'rgba(101, 163, 13, 0.3)' : 'rgba(20, 184, 166, 0.3)';
              textBg = 'rgba(255, 255, 255, 0.95)';
            } else if (labelStyle === 'shadow_only') {
              showShadow = true;
              bgColor = isTextInput ? 'rgba(101, 163, 13, 0.3)' : 'rgba(20, 184, 166, 0.3)';
            }
            
            if (!showText && !showShadow) return '';
            
            return `
              <div style="
                position: absolute;
                left: ${left}px;
                top: ${top}px;
                width: ${width}px;
                height: ${height}px;
                ${showShadow ? `
                  background-color: ${bgColor};
                  border: 2px solid ${isTextInput ? '#65a30d' : '#14b8a6'};
                  border-radius: 6px;
                ` : ''}
                display: flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
              ">
                ${showText && label ? `
                  <span style="
                    background: ${textBg};
                    color: ${textColor};
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 500;
                    max-width: 90%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  ">
                    ${label}
                  </span>
                ` : ''}
              </div>
            `;
          }
        }).join('')}
      </div>
    `;
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const targetElement = tempContainer.firstChild as HTMLElement;
    const canvas = await html2canvas(targetElement, {
      useCORS: true,
      allowTaint: true,
      scale: 2,
      backgroundColor: '#ffffff',
    });
    
    document.body.removeChild(tempContainer);
    return canvas;
  };

  // Descargar todas las imágenes con overlays
  const handleDownloadAllImagesWithOverlays = async () => {
    if (!interactiveSteps.length) return;
    
    setIsDownloadingImages(true);
    
    try {
      const stepsWithImages = interactiveSteps.filter(step => step.image_url);
      
      for (let i = 0; i < stepsWithImages.length; i++) {
        const step = stepsWithImages[i];
        const canvas = await generateStepImageWithOverlays(step);
        
        if (canvas) {
          const link = document.createElement('a');
          link.download = `paso_${step.step_number}_con_acciones.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          
          if (i < stepsWithImages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      setToast({ message: `${stepsWithImages.length} imágenes descargadas`, type: 'success' });
    } catch (error) {
      console.error('Error al descargar las imágenes:', error);
      setToast({ message: 'Error al descargar las imágenes', type: 'error' });
    } finally {
      setIsDownloadingImages(false);
    }
  };

  const toggleSession = (sessionId: number) => {
    // Siempre hacer scroll al elemento
    setTimeout(() => {
      const element = document.getElementById(`session-${sessionId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    
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
    // Siempre hacer scroll al elemento
    setTimeout(() => {
      const element = document.getElementById(`topic-${topicId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    
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
      setSessionForm({ 
        title: session.title, 
        description: session.description
      });
    } else {
      setEditingSession(null);
      setSessionForm({ 
        title: '', 
        description: ''
      });
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
      setTopicForm({ 
        title: topic.title, 
        description: topic.description,
        estimated_time_minutes: topic.estimated_time_minutes,
        allow_reading: topic.allow_reading ?? true,
        allow_video: topic.allow_video ?? true,
        allow_downloadable: topic.allow_downloadable ?? true,
        allow_interactive: topic.allow_interactive ?? true
      });
    } else {
      setEditingTopic(null);
      setTopicForm({ 
        title: '', 
        description: '',
        estimated_time_minutes: undefined,
        allow_reading: true,
        allow_video: true,
        allow_downloadable: true,
        allow_interactive: true
      });
    }
    setTopicModalOpen(true);
  };

  const handleSaveTopic = async () => {
    if (!topicForm.title.trim() || !selectedSessionId) return;
    
    // DEBUG: Mostrar qué datos se envían
    const dataToSend = {
      title: topicForm.title,
      description: topicForm.description,
      estimated_time_minutes: topicForm.estimated_time_minutes,
      allow_reading: topicForm.allow_reading,
      allow_video: topicForm.allow_video,
      allow_downloadable: topicForm.allow_downloadable,
      allow_interactive: topicForm.allow_interactive
    };
    console.log('=== DATOS A ENVIAR ===');
    console.log(JSON.stringify(dataToSend, null, 2));
    
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
      // Mostrar error detallado del servidor
      let errorMessage = 'Error al subir el video. Por favor intenta de nuevo.';
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'La subida tardó demasiado tiempo. Verifica tu conexión a internet.';
      } else if (error.message === 'Network Error') {
        errorMessage = 'Error de red al subir el video. Esto puede deberse a un problema de conexión. Por favor intenta de nuevo.';
      } else if (error.response?.status === 413) {
        errorMessage = 'El servidor rechazó el archivo por ser muy grande. Contacta al administrador.';
      } else if (error.response?.data?.error) {
        errorMessage = `Error: ${error.response.data.error}`;
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/mpeg', 'video/3gpp', 'video/x-matroska'];
      if (!validTypes.includes(file.type)) {
        alert('Tipo de archivo no válido. Use MP4, WebM, OGG, MOV, AVI, MKV o MPEG.');
        return;
      }
      // Validar tamaño (máximo 2GB)
      const maxSize = 2 * 1024 * 1024 * 1024;
      if (file.size > maxSize) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(0);
        alert(`El archivo es demasiado grande (${fileSizeMB}MB). El tamaño máximo es 2GB.`);
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
      // Si no hay archivos nuevos pero ya existe un archivo, solo actualizar título/descripción
      if (selectedDownloadableFiles.length === 0 && downloadableForm.file_url) {
        await updateDownloadable(
          materialId,
          selectedSessionId,
          selectedTopicId,
          {
            title: downloadableForm.title,
            description: downloadableForm.description || ''
          }
        );
        await loadMaterial();
        setDownloadableModalOpen(false);
        setToast({ message: 'Ejercicio actualizado exitosamente', type: 'success' });
      } else {
        // Subir archivos nuevos
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
      }
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
        <LoadingSpinner message="Cargando material..." />
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
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-12 3xl:p-14 4xl:p-16 max-w-[1920px] 3xl:max-w-[2400px] 4xl:max-w-[2800px] mx-auto">
      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* Back button */}
      <div className="mb-4">
        <button
          onClick={() => navigate('/study-contents')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
          Volver a la lista
        </button>
      </div>

      {/* Header with Image Background */}
      <div className="relative rounded-xl overflow-hidden mb-6 shadow-lg">
        {/* Background Image */}
        {material.image_url ? (
          <div className="absolute inset-0">
            <img 
              src={material.image_url} 
              alt={material.title}
              className="w-full h-full object-cover"
            />
            <div 
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to top, ${dominantColor} 0%, ${dominantColor}99 30%, transparent 100%)`
              }}
            />
          </div>
        ) : (
          <div 
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${dominantColor} 0%, ${dominantColor}dd 100%)`
            }}
          />
        )}

        {/* Content */}
        <div className="relative z-10 p-6">
          {/* Top row with status badge only */}
          <div className="flex justify-between items-start mb-20">
            <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${material.is_published ? 'bg-green-500/90 text-white' : 'bg-white/90 text-gray-700'}`}>
              {material.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {material.is_published ? 'Publicado' : 'Borrador'}
            </span>
          </div>

          {/* Title and description */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-md">{material.title}</h1>
            {material.description && (
              <div 
                className="text-white/90 prose prose-sm max-w-none prose-invert drop-shadow"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(material.description) }}
              />
            )}
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="h-5 w-5 text-white/80" />
                <span className="text-white/80 text-sm">Sesiones</span>
              </div>
              <span className="text-2xl font-bold text-white">{material.sessions?.length || 0}</span>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-5 w-5 text-white/80" />
                <span className="text-white/80 text-sm">Temas</span>
              </div>
              <span className="text-2xl font-bold text-white">
                {material.sessions?.reduce((acc, s) => acc + (s.topics?.length || 0), 0) || 0}
              </span>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="h-5 w-5 text-white/80" />
                <span className="text-white/80 text-sm">Exámenes vinculados</span>
              </div>
              <span className="text-2xl font-bold text-white">{material.linked_exams?.length || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons bar - Fondo blanco */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botón Probar Contenido - solo visible cuando está publicado */}
          {material.is_published && material.sessions && material.sessions.length > 0 && material.sessions[0].topics && material.sessions[0].topics.length > 0 && (
            <button
              onClick={() => navigate(`/study-contents/${materialId}/preview`)}
              className="px-4 py-2 btn-animated-gradient text-white rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 transition-all duration-300"
            >
              <PlayCircle className="w-5 h-5" />
              Probar Contenido
            </button>
          )}
          {/* Botón Publicar/Cambiar a Borrador */}
          {material.is_published ? (
            <button
              onClick={async () => {
                try {
                  await updateMaterial(Number(materialId), { is_published: false });
                  setToast({ message: 'El material ha sido cambiado a borrador.', type: 'success' });
                  loadMaterial();
                } catch (error) {
                  console.error('Error updating material:', error);
                  setToast({ message: 'Error al cambiar a borrador', type: 'error' });
                }
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium flex items-center gap-2 border border-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Cambiar a Borrador
            </button>
          ) : (
            <button
              onClick={handleValidateAndPublish}
              className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 rounded-lg transition-colors font-medium flex items-center gap-2 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Publicar
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              if (material.is_published) {
                setToast({ message: 'Cambie el material a borrador para poder editarlo', type: 'error' });
                return;
              }
              navigate(`/study-contents/${materialId}/edit`);
            }}
            disabled={material.is_published}
            className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 border ${
              material.is_published
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
            }`}
          >
            <Edit2 className="h-5 w-5" />
            Editar Material
          </button>
          {/* Botón Eliminar Material (solo admin) */}
          {user?.role === 'admin' && (
            <button
              onClick={() => {
                if (material.is_published) {
                  setToast({ message: 'Cambie el material a borrador para poder eliminarlo', type: 'error' });
                  return;
                }
                setShowDeleteMaterialModal(true);
              }}
              disabled={material.is_published}
              className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 ${
                material.is_published
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              <Trash2 className="h-5 w-5" />
              Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Warning when published */}
      {material.is_published && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-amber-800 font-medium">Contenido publicado</p>
            <p className="text-amber-700 text-sm">Para editar el contenido, primero cambia el material a borrador.</p>
          </div>
        </div>
      )}

      {/* Sessions */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Sesiones</h2>
          <button
            onClick={() => openSessionModal()}
            disabled={material.is_published}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors shadow-sm ${
              material.is_published
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
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
              disabled={material.is_published}
              className={`mt-3 px-4 py-2 rounded-lg inline-flex items-center gap-2 ${
                material.is_published
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Plus className="h-5 w-5" />
              Crear Primera Sesión
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {material.sessions.map((session) => (
              <div id={`session-${session.id}`} key={session.id} className={`border-b last:border-b-0 scroll-mt-24 ${expandedSessions.has(session.id) ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/30' : ''}`}>
                {/* Session Header */}
                <div
                  className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${expandedSessions.has(session.id) ? 'bg-blue-100/50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
                  onClick={() => toggleSession(session.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedSessions.has(session.id) ? (
                      <ChevronDown className="h-5 w-5 text-blue-600" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${expandedSessions.has(session.id) ? 'bg-blue-600' : 'bg-blue-100'}`}>
                      <FolderOpen className={`h-4 w-4 ${expandedSessions.has(session.id) ? 'text-white' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <h3 className={`font-medium ${expandedSessions.has(session.id) ? 'text-blue-900' : 'text-gray-900'}`}>
                        Sesión {session.session_number}: {session.title}
                      </h3>
                      {session.description && (
                        <p className="text-sm text-gray-500">{session.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-sm text-gray-500">
                      {session.topics?.length || 0} temas
                      {session.topics && session.topics.reduce((sum, t) => sum + (t.estimated_time_minutes || 0), 0) > 0 && (
                        <> · <Clock className="w-3 h-3 inline-block mb-0.5" /> {session.topics.reduce((sum, t) => sum + (t.estimated_time_minutes || 0), 0)}m</>
                      )}
                    </span>
                    {!material.is_published && (
                      <>
                        <button
                          onClick={() => openSessionModal(session)}
                          className="p-2 text-primary-600 hover:bg-primary-100 rounded-lg transition-colors"
                          title="Editar sesión"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openDeleteModal('session', session.id, session.title)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Eliminar sesión"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Topics */}
                {expandedSessions.has(session.id) && (
                  <div className="bg-gray-50 border-t">
                    <div className="p-3 flex justify-between items-center border-b bg-gray-100">
                      <span className="text-sm font-medium text-gray-600">Temas de la sesión</span>
                      <button
                        onClick={() => openTopicModal(session.id)}
                        disabled={material.is_published}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors shadow-sm ${
                          material.is_published
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
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
                          <div id={`topic-${topic.id}`} key={topic.id} className={`scroll-mt-24 ${expandedTopics.has(topic.id) ? 'ring-2 ring-slate-300 ring-inset bg-slate-50' : 'bg-white'}`}>
                            {/* Topic Header */}
                            <div
                              className={`flex items-center justify-between p-3 pl-8 cursor-pointer transition-colors ${expandedTopics.has(topic.id) ? 'bg-slate-100 hover:bg-slate-200' : 'hover:bg-gray-50'}`}
                              onClick={() => toggleTopic(topic.id)}
                            >
                              <div className="flex items-center gap-3">
                                {expandedTopics.has(topic.id) ? (
                                  <ChevronDown className="h-4 w-4 text-slate-600" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-400" />
                                )}
                                <span className={`font-medium ${expandedTopics.has(topic.id) ? 'text-slate-900' : 'text-gray-800'}`}>{topic.title}</span>
                                {topic.estimated_time_minutes && (
                                  <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                    <Clock className="w-3 h-3" />
                                    {topic.estimated_time_minutes}m
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                {/* Element indicators - solo mostrar los tipos permitidos */}
                                <div className="flex gap-1">
                                  {topic.allow_reading !== false && (
                                    <span className={`p-1 rounded ${topic.reading ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`} title="Lectura">
                                      <FileText className="h-3.5 w-3.5" />
                                    </span>
                                  )}
                                  {topic.allow_video !== false && (
                                    <span className={`p-1 rounded ${topic.video ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`} title="Video">
                                      <Video className="h-3.5 w-3.5" />
                                    </span>
                                  )}
                                  {topic.allow_downloadable !== false && (
                                    <span className={`p-1 rounded ${topic.downloadable_exercise ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`} title="Descargable">
                                      <Download className="h-3.5 w-3.5" />
                                    </span>
                                  )}
                                  {topic.allow_interactive !== false && (
                                    <span className={`p-1 rounded ${topic.interactive_exercise ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`} title="Interactivo">
                                      <Gamepad2 className="h-3.5 w-3.5" />
                                    </span>
                                  )}
                                </div>
                                {!material.is_published && (
                                  <>
                                    <button
                                      onClick={() => openTopicModal(session.id, topic)}
                                      className="p-2 text-primary-600 hover:bg-primary-100 rounded-lg transition-colors"
                                      title="Editar tema"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => openDeleteModal('topic', topic.id, topic.title, session.id)}
                                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                      title="Eliminar tema"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Topic Elements */}
                            {expandedTopics.has(topic.id) && (
                              <div className="bg-gray-50 p-4 pl-16 grid grid-cols-2 gap-3">
                                {/* Lectura - solo si allow_reading es true */}
                                {(topic.allow_reading !== false) && (
                                  <div
                                    onClick={() => {
                                      if (material.is_published) {
                                        setToast({ message: 'Cambie el material a borrador para editar el contenido', type: 'error' });
                                        return;
                                      }
                                      openReadingModal(session.id, topic);
                                    }}
                                    className={`p-3 rounded-lg border transition-colors ${
                                      material.is_published
                                        ? 'cursor-not-allowed opacity-60'
                                        : 'cursor-pointer'
                                    } ${
                                      topic.reading ? 'bg-green-50 border-green-200' : 'bg-white'
                                    } ${
                                      !material.is_published && (topic.reading ? 'hover:bg-green-100' : 'hover:bg-gray-100')
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
                                )}

                                {/* Video - solo si allow_video es true */}
                                {(topic.allow_video !== false) && (
                                  <div
                                    onClick={() => {
                                      if (material.is_published) {
                                        setToast({ message: 'Cambie el material a borrador para editar el contenido', type: 'error' });
                                        return;
                                      }
                                      openVideoModal(session.id, topic);
                                    }}
                                    className={`p-3 rounded-lg border transition-colors ${
                                      material.is_published
                                        ? 'cursor-not-allowed opacity-60'
                                        : 'cursor-pointer'
                                    } ${
                                      topic.video ? 'bg-green-50 border-green-200' : 'bg-white'
                                    } ${
                                      !material.is_published && (topic.video ? 'hover:bg-green-100' : 'hover:bg-gray-100')
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
                                )}

                                {/* Descargable - solo si allow_downloadable es true */}
                                {(topic.allow_downloadable !== false) && (
                                  <div
                                    onClick={() => {
                                      if (material.is_published) {
                                        setToast({ message: 'Cambie el material a borrador para editar el contenido', type: 'error' });
                                        return;
                                      }
                                      openDownloadableModal(session.id, topic);
                                    }}
                                    className={`p-3 rounded-lg border transition-colors ${
                                      material.is_published
                                        ? 'cursor-not-allowed opacity-60'
                                        : 'cursor-pointer'
                                    } ${
                                      topic.downloadable_exercise ? 'bg-green-50 border-green-200' : 'bg-white'
                                    } ${
                                      !material.is_published && (topic.downloadable_exercise ? 'hover:bg-green-100' : 'hover:bg-gray-100')
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
                                )}

                                {/* Interactivo - solo si allow_interactive es true */}
                                {(topic.allow_interactive !== false) && (
                                  <div
                                    onClick={() => {
                                      if (material.is_published) {
                                        setToast({ message: 'Cambie el material a borrador para editar el contenido', type: 'error' });
                                        return;
                                      }
                                      const isNew = !topic.interactive_exercise;
                                      setInteractiveConfigData({
                                        topicId: topic.id,
                                        sessionId: session.id,
                                        isNew
                                      });
                                      setInteractiveForm({
                                        title: topic.interactive_exercise?.title || 'Ejercicio Interactivo',
                                        description: topic.interactive_exercise?.description || ''
                                      });
                                      // Cargar los pasos si ya existe el ejercicio
                                      if (!isNew) {
                                        loadInteractiveSteps(session.id, topic.id);
                                      } else {
                                        setInteractiveSteps([]);
                                      }
                                      setInteractiveConfigOpen(true);
                                    }}
                                    className={`p-3 rounded-lg border transition-colors ${
                                      material.is_published
                                        ? 'cursor-not-allowed opacity-60'
                                        : 'cursor-pointer'
                                    } ${
                                      topic.interactive_exercise ? 'bg-green-50 border-green-200' : 'bg-white'
                                    } ${
                                      !material.is_published && (topic.interactive_exercise ? 'hover:bg-green-100' : 'hover:bg-gray-100')
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
                                )}
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
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
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
          
          {/* Tiempo estimado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tiempo estimado de estudio
              <span className="text-gray-400 text-xs font-normal ml-1">(opcional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={topicForm.estimated_time_minutes || ''}
                onChange={(e) => setTopicForm({ ...topicForm, estimated_time_minutes: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="30"
              />
              <span className="text-sm text-gray-500">minutos</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Tiempo aproximado que tomará completar este tema</p>
          </div>
          
          {/* Tipos de contenido permitidos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tipos de contenido para este tema
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                topicForm.allow_reading 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="checkbox"
                  checked={topicForm.allow_reading ?? true}
                  onChange={(e) => setTopicForm({ ...topicForm, allow_reading: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-gray-700">Lectura</span>
                </div>
              </label>
              
              <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                topicForm.allow_video 
                  ? 'border-red-500 bg-red-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="checkbox"
                  checked={topicForm.allow_video ?? true}
                  onChange={(e) => setTopicForm({ ...topicForm, allow_video: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                />
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-gray-700">Video</span>
                </div>
              </label>
              
              <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                topicForm.allow_downloadable 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="checkbox"
                  checked={topicForm.allow_downloadable ?? true}
                  onChange={(e) => setTopicForm({ ...topicForm, allow_downloadable: e.target.checked })}
                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                />
                <div className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-gray-700">Ejercicio Descargable</span>
                </div>
              </label>
              
              <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                topicForm.allow_interactive 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="checkbox"
                  checked={topicForm.allow_interactive ?? true}
                  onChange={(e) => setTopicForm({ ...topicForm, allow_interactive: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5 text-purple-600" />
                  <span className="font-medium text-gray-700">Ejercicio Interactivo</span>
                </div>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Solo se mostrarán los tipos de contenido seleccionados en la lista del tema.
            </p>
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
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Reading Modal */}
      <Modal
        isOpen={readingModalOpen}
        onClose={() => setReadingModalOpen(false)}
        title={readingForm.title ? "Editar Material de Lectura" : "Crear Material de Lectura"}
        size="lg"
      >
        <div className="space-y-6">
          {/* Header visual mejorado */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 rounded-xl p-6 text-white">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-white/20 rounded-lg backdrop-blur-sm">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold">Material de Lectura</h4>
                  <p className="text-white/80 text-sm">Contenido textual para el tema</p>
                </div>
              </div>
              <p className="text-sm text-white/90 leading-relaxed">
                Crea contenido de lectura enriquecido con formato, imágenes y enlaces para que los estudiantes puedan estudiar el tema.
              </p>
            </div>
          </div>

          {/* Indicador de progreso */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
              readingForm.title.trim() ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              {readingForm.title.trim() ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <div className={`h-1 flex-1 rounded-full transition-colors ${
              readingForm.title.trim() ? 'bg-blue-600' : 'bg-gray-200'
            }`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
              readingForm.content.trim() && readingForm.content !== '<p><br></p>' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              {readingForm.content.trim() && readingForm.content !== '<p><br></p>' ? <Check className="w-4 h-4" /> : '2'}
            </div>
            <div className="text-xs text-gray-500 ml-2">Título + Contenido</div>
          </div>

          {/* Botón de acceso rápido - visible cuando el formulario está completo */}
          {readingForm.title.trim() && readingForm.content.trim() && readingForm.content !== '<p><br></p>' && (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 rounded-2xl blur-lg opacity-30 animate-pulse"></div>
              <button
                onClick={() => {
                  const modal = document.querySelector('.reading-modal-save-btn');
                  if (modal) {
                    modal.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="relative w-full bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 text-white rounded-2xl p-4 flex items-center justify-between group hover:from-blue-600 hover:via-cyan-600 hover:to-teal-600 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Check className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-base">¡Formulario completo!</p>
                    <p className="text-sm text-white/80">Haz clic para ir al botón de guardar</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">Guardar</span>
                  <div className="p-2 bg-white/20 rounded-full group-hover:translate-y-1 transition-transform duration-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Formulario */}
          <div className="space-y-5">
            {/* Título */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-600 rounded text-xs font-bold">1</span>
                Título de la lectura <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={readingForm.title}
                  onChange={(e) => setReadingForm({ ...readingForm, title: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 outline-none ${
                    readingForm.title.trim() 
                      ? 'border-green-300 bg-green-50/50 focus:border-green-500 focus:ring-2 focus:ring-green-200' 
                      : 'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                  }`}
                  placeholder="Ej: Introducción a los conceptos básicos"
                />
                {readingForm.title.trim() && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1.5 ml-7">
                Un título descriptivo ayuda a los estudiantes a identificar el contenido
              </p>
            </div>
          
            {/* Contenido */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-600 rounded text-xs font-bold">2</span>
                Contenido <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-3 ml-7">
                Utiliza el editor para dar formato al texto, agregar imágenes, enlaces y más.
              </p>
              <div className={`border-2 rounded-xl overflow-hidden transition-all duration-200 ${
                readingForm.content.trim() && readingForm.content !== '<p><br></p>'
                  ? 'border-green-300 ring-2 ring-green-100' 
                  : 'border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100'
              }`}>
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
                    'list', 'indent',
                    'align',
                    'link', 'image',
                    'blockquote', 'code-block'
                  ]}
                  placeholder="Escribe el contenido de la lectura aquí..."
                  style={{ minHeight: '280px' }}
                />
              </div>
              <div className="flex items-start gap-2 mt-2 ml-7">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-600">Tip:</span> Usa encabezados para organizar el contenido y facilitar la lectura.
                </p>
              </div>
            </div>
          </div>

          {/* Botones de acción mejorados */}
          <div className="flex flex-col gap-4 pt-4 border-t border-gray-200">
            {/* Botón principal - Guardar */}
            <button
              onClick={handleSaveReading}
              disabled={saving || !readingForm.title.trim() || !readingForm.content.trim() || readingForm.content === '<p><br></p>'}
              className={`reading-modal-save-btn w-full py-3.5 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-3 ${
                !readingForm.title.trim() || !readingForm.content.trim() || readingForm.content === '<p><br></p>'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:from-blue-600 hover:to-cyan-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  <span>Guardar Material de Lectura</span>
                </>
              )}
            </button>

            {/* Botón Cancelar */}
            <button 
              onClick={() => setReadingModalOpen(false)} 
              className="w-full px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-colors"
            >
              Cancelar
            </button>

            {/* Mensaje de ayuda */}
            {(!readingForm.title.trim() || !readingForm.content.trim() || readingForm.content === '<p><br></p>') && (
              <div className="flex items-center gap-2 justify-center text-amber-600 bg-amber-50 rounded-lg py-2 px-3">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm">
                  {!readingForm.title.trim() 
                    ? 'Ingresa un título para la lectura' 
                    : 'Escribe el contenido de la lectura'
                  }
                </span>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Video Modal */}
      <Modal
        isOpen={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        title={videoForm.title ? "Editar Video Educativo" : "Crear Video Educativo"}
        size="lg"
      >
        <div className="space-y-6">
          {/* Header visual mejorado */}
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-500 rounded-xl p-6 text-white">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Video className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold">Video Educativo</h4>
                  <p className="text-white/80 text-sm">Contenido multimedia para el tema</p>
                </div>
              </div>
              <p className="text-sm text-white/90 leading-relaxed">
                Agrega videos de YouTube, Vimeo o sube tu propio archivo de video para enriquecer el contenido del tema.
              </p>
            </div>
          </div>

          {/* Indicador de progreso */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
              videoForm.title.trim() ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              {videoForm.title.trim() ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <div className={`h-1 flex-1 rounded-full transition-colors ${
              videoForm.title.trim() ? 'bg-purple-600' : 'bg-gray-200'
            }`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
              (videoMode === 'url' ? videoForm.video_url.trim() : selectedVideoFile) ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              {(videoMode === 'url' ? videoForm.video_url.trim() : selectedVideoFile) ? <Check className="w-4 h-4" /> : '2'}
            </div>
            <div className="text-xs text-gray-500 ml-2">Título + Video</div>
          </div>

          {/* Botón de acceso rápido - visible cuando el formulario está completo */}
          {videoForm.title.trim() && (videoMode === 'url' ? videoForm.video_url.trim() : selectedVideoFile) && (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 rounded-2xl blur-lg opacity-30 animate-pulse"></div>
              <button
                onClick={() => {
                  const modal = document.querySelector('.video-modal-save-btn');
                  if (modal) {
                    modal.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="relative w-full bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 text-white rounded-2xl p-4 flex items-center justify-between group hover:from-purple-600 hover:via-violet-600 hover:to-indigo-600 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Check className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-base">¡Formulario completo!</p>
                    <p className="text-sm text-white/80">Haz clic para ir al botón de guardar</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">Guardar</span>
                  <div className="p-2 bg-white/20 rounded-full group-hover:translate-y-1 transition-transform duration-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Formulario */}
          <div className="space-y-5">
            {/* Título */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-purple-100 text-purple-600 rounded text-xs font-bold">1</span>
                Título del video <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={videoForm.title}
                  onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 outline-none ${
                    videoForm.title.trim() 
                      ? 'border-green-300 bg-green-50/50 focus:border-green-500 focus:ring-2 focus:ring-green-200' 
                      : 'border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                  }`}
                  placeholder="Ej: Tutorial paso a paso del proceso"
                />
                {videoForm.title.trim() && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1.5 ml-7">
                Un título descriptivo ayuda a los estudiantes a identificar el contenido
              </p>
            </div>
          
            {/* Tabs para elegir entre URL o Subir archivo */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-purple-100 text-purple-600 rounded text-xs font-bold">2</span>
                Fuente del video <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
                <nav className="flex bg-gray-50">
                  <button
                    onClick={() => setVideoMode('url')}
                    className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 ${
                      videoMode === 'url'
                        ? 'bg-white text-purple-600 border-b-2 border-purple-500 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Link className="h-4 w-4" />
                    Enlace URL
                  </button>
                  <button
                    onClick={() => setVideoMode('upload')}
                    className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 ${
                      videoMode === 'upload'
                        ? 'bg-white text-purple-600 border-b-2 border-purple-500 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    Subir archivo
                  </button>
                </nav>
              </div>
            </div>
          
            {/* Contenido según el modo seleccionado */}
            {videoMode === 'url' ? (
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <PlayCircle className="w-4 h-4 text-purple-500" />
                  URL del video
                </label>
                {/* Si el video está en Azure (Blob o CDN), mostrar mensaje informativo con opción de cambiar a enlace */}
                {(videoForm.video_url && isAzureUrl(videoForm.video_url)) ? (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                        <Video className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-purple-800 mb-1">Video almacenado en la nube</p>
                        <p className="text-xs text-purple-600">
                          Este video fue subido directamente a la plataforma. El enlace está protegido.
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-xs text-green-700 font-medium">Video disponible</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Opciones para cambiar el video */}
                    <div className="mt-4 pt-4 border-t border-purple-200">
                      <p className="text-xs text-purple-700 font-medium mb-3">¿Deseas reemplazar este video?</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => setShowChangeVideoSourceModal(true)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-purple-700 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
                        >
                          <Link className="w-4 h-4" />
                          Cambiar a enlace URL
                        </button>
                        <button
                          type="button"
                          onClick={() => setVideoMode('upload')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Subir nuevo archivo
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <input
                        type="url"
                        value={videoForm.video_url}
                        onChange={(e) => {
                          const url = e.target.value;
                          let detectedType = 'direct';
                          if (url.includes('youtube.com') || url.includes('youtu.be')) {
                            detectedType = 'youtube';
                          } else if (url.includes('vimeo.com')) {
                            detectedType = 'vimeo';
                          }
                          setVideoForm({ ...videoForm, video_url: url, video_type: detectedType as any });
                        }}
                        className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 outline-none ${
                          videoForm.video_url.trim() 
                            ? 'border-green-300 bg-green-50/50 focus:border-green-500 focus:ring-2 focus:ring-green-200' 
                            : 'border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                        }`}
                        placeholder="https://youtube.com/watch?v=... o https://vimeo.com/..."
                      />
                      {videoForm.video_url.trim() && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 ml-1">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                        YouTube
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-1 16.5v-9l6 4.5-6 4.5z"/></svg>
                        Vimeo
                      </span>
                      <span className="text-xs text-gray-400">MP4/WebM directo</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Upload className="w-4 h-4 text-purple-500" />
                  Archivo de video
                </label>
                <div className="mt-1">
                  {!selectedVideoFile ? (
                    <label className={`flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                      'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                    }`}>
                      <div className="flex flex-col items-center justify-center py-6">
                        <div className="p-4 bg-purple-100 rounded-full mb-4">
                          <Upload className="h-8 w-8 text-purple-500" />
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          <span className="font-semibold text-purple-600">Haz clic para seleccionar</span> o arrastra un archivo
                        </p>
                        <p className="text-xs text-gray-400 mt-2">Formatos: MP4, WebM, OGG, MOV, AVI</p>
                        <p className="text-xs text-gray-400">Tamaño máximo: 500MB</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo"
                        onChange={handleVideoFileChange}
                      />
                    </label>
                  ) : (
                    <div className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                      'border-green-300 bg-green-50/50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Video className="h-6 w-6 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">{selectedVideoFile.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(selectedVideoFile.size)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                          <button
                            onClick={() => setSelectedVideoFile(null)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors group"
                          >
                            <X className="h-4 w-4 text-gray-400 group-hover:text-red-500" />
                          </button>
                        </div>
                      </div>
                      {isUploading && (
                        <div className="mt-4 bg-blue-50 rounded-xl p-3 border border-blue-200">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-blue-700 font-medium flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Subiendo video...
                            </span>
                            <span className="text-blue-600 font-bold">{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-2.5">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-300"
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
          
            {/* Descripción del video */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-purple-100 text-purple-600 rounded text-xs font-bold">3</span>
                Descripción del video <span className="text-gray-400 text-xs font-normal">(opcional)</span>
              </label>
              <div className={`border-2 rounded-xl overflow-hidden transition-all duration-200 ${
                videoForm.description && videoForm.description.trim() && videoForm.description !== '<p><br></p>'
                  ? 'border-green-300 ring-2 ring-green-100' 
                  : 'border-gray-200 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100'
              }`}>
                <ReactQuill
                  theme="snow"
                  value={videoForm.description || ''}
                  onChange={(content) => setVideoForm({ ...videoForm, description: content })}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline'],
                      [{ 'color': [] }],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      ['link'],
                      ['clean']
                    ],
                  }}
                  formats={[
                    'header',
                    'bold', 'italic', 'underline',
                    'color',
                    'list',
                    'link'
                  ]}
                  placeholder="Describe brevemente de qué trata el video, qué aprenderán los estudiantes..."
                  style={{ minHeight: '100px' }}
                />
              </div>
              <div className="flex items-start gap-2 mt-2 ml-7">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-600">Tip:</span> Incluye los temas principales que se cubren en el video.
                </p>
              </div>
            </div>
          </div>

          {/* Botones de acción mejorados */}
          <div className="flex flex-col gap-4 pt-4 border-t border-gray-200">
            {/* Botón principal - Guardar */}
            <button
              onClick={handleSaveVideo}
              disabled={saving || isUploading || !videoForm.title.trim() || (videoMode === 'url' ? !videoForm.video_url.trim() : !selectedVideoFile)}
              className={`video-modal-save-btn w-full py-3.5 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-3 ${
                !videoForm.title.trim() || (videoMode === 'url' ? !videoForm.video_url.trim() : !selectedVideoFile)
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:from-purple-600 hover:to-violet-700 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40'
              }`}
            >
              {(saving || isUploading) ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{isUploading ? 'Subiendo...' : 'Guardando...'}</span>
                </>
              ) : (
                <>
                  <Video className="h-5 w-5" />
                  <span>Guardar Video Educativo</span>
                </>
              )}
            </button>

            {/* Botón Cancelar */}
            <button 
              onClick={() => setVideoModalOpen(false)} 
              className="w-full px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-colors"
              disabled={isUploading}
            >
              Cancelar
            </button>

            {/* Mensaje de ayuda */}
            {(!videoForm.title.trim() || (videoMode === 'url' ? !videoForm.video_url.trim() : !selectedVideoFile)) && (
              <div className="flex items-center gap-2 justify-center text-amber-600 bg-amber-50 rounded-lg py-2 px-3">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm">
                  {!videoForm.title.trim() 
                    ? 'Ingresa un título para el video' 
                    : videoMode === 'url' 
                      ? 'Ingresa la URL del video' 
                      : 'Selecciona un archivo de video'
                  }
                </span>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Downloadable Modal - Formulario mejorado con editor de instrucciones */}
      <Modal
        isOpen={downloadableModalOpen}
        onClose={() => setDownloadableModalOpen(false)}
        title={downloadableForm.title ? "Editar Ejercicio Descargable" : "Crear Ejercicio Descargable"}
        size="lg"
      >
        <div className="space-y-6">
          {/* Header visual mejorado */}
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 rounded-xl p-6 text-white">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Download className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold">Ejercicio Descargable</h4>
                  <p className="text-white/80 text-sm">Archivos para práctica offline</p>
                </div>
              </div>
              <p className="text-sm text-white/90 leading-relaxed">
                Sube archivos como PDF, Word, Excel o ZIP para que los estudiantes puedan descargar y completar ejercicios prácticos fuera de la plataforma.
              </p>
            </div>
          </div>

          {/* Indicador de progreso */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
              downloadableForm.title.trim() ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              {downloadableForm.title.trim() ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <div className={`h-1 flex-1 rounded-full transition-colors ${
              downloadableForm.title.trim() ? 'bg-orange-600' : 'bg-gray-200'
            }`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
              (selectedDownloadableFiles.length > 0 || downloadableForm.file_url) ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              {(selectedDownloadableFiles.length > 0 || downloadableForm.file_url) ? <Check className="w-4 h-4" /> : '2'}
            </div>
            <div className="text-xs text-gray-500 ml-2">Título + Archivos</div>
          </div>

          {/* Botón de acceso rápido - visible cuando el formulario está completo */}
          {downloadableForm.title.trim() && (selectedDownloadableFiles.length > 0 || downloadableForm.file_url) && (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-2xl blur-lg opacity-30 animate-pulse"></div>
              <button
                onClick={() => {
                  const modal = document.querySelector('.downloadable-modal-save-btn');
                  if (modal) {
                    modal.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="relative w-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white rounded-2xl p-4 flex items-center justify-between group hover:from-orange-600 hover:via-amber-600 hover:to-yellow-600 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Check className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-base">¡Formulario completo!</p>
                    <p className="text-sm text-white/80">Haz clic para ir al botón de guardar</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">Guardar</span>
                  <div className="p-2 bg-white/20 rounded-full group-hover:translate-y-1 transition-transform duration-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Formulario */}
          <div className="space-y-5">
            {/* Título */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-orange-100 text-orange-600 rounded text-xs font-bold">1</span>
                Título del ejercicio <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={downloadableForm.title}
                  onChange={(e) => setDownloadableForm({ ...downloadableForm, title: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 outline-none ${
                    downloadableForm.title.trim() 
                      ? 'border-green-300 bg-green-50/50 focus:border-green-500 focus:ring-2 focus:ring-green-200' 
                      : 'border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200'
                  }`}
                  placeholder="Ej: Ejercicio práctico - Cálculos básicos"
                />
                {downloadableForm.title.trim() && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1.5 ml-7">
                Un título descriptivo ayuda a los estudiantes a identificar el ejercicio
              </p>
            </div>
            
            {/* Instrucciones con editor de texto enriquecido */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-orange-100 text-orange-600 rounded text-xs font-bold">2</span>
                Instrucciones <span className="text-gray-400 text-xs font-normal">(opcional)</span>
              </label>
              <div className={`border-2 rounded-xl overflow-hidden transition-all duration-200 ${
                downloadableForm.description && downloadableForm.description.trim() && downloadableForm.description !== '<p><br></p>'
                  ? 'border-green-300 ring-2 ring-green-100' 
                  : 'border-gray-200 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100'
              }`}>
                <ReactQuill
                  theme="snow"
                  value={downloadableForm.description || ''}
                  onChange={(content) => setDownloadableForm({ ...downloadableForm, description: content })}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline'],
                      [{ 'color': [] }],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      ['link'],
                      ['clean']
                    ],
                  }}
                  formats={[
                    'header',
                    'bold', 'italic', 'underline',
                    'color',
                    'list',
                    'link'
                  ]}
                  className="bg-white"
                  style={{ minHeight: '120px' }}
                  placeholder="Escribe las instrucciones para realizar el ejercicio..."
                />
              </div>
              <div className="flex items-start gap-2 mt-2 ml-7">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-600">Tip:</span> Incluye instrucciones claras sobre cómo completar y entregar el ejercicio.
                </p>
              </div>
            </div>
          
            {/* Archivo actual si existe */}
            {downloadableForm.file_url && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <Download className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold text-blue-800">Archivo actual</p>
                </div>
                <a 
                  href={downloadableForm.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
                >
                  <FileText className="h-4 w-4" />
                  {downloadableForm.file_name || 'Descargar archivo'}
                </a>
                <p className="text-xs text-blue-500 mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Sube nuevos archivos para reemplazar el actual
                </p>
              </div>
            )}
          
            {/* Área de subida de archivos */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-orange-100 text-orange-600 rounded text-xs font-bold">3</span>
                Archivos {!downloadableForm.file_url && <span className="text-red-500">*</span>}
              </label>
              <p className="text-xs text-gray-500 mb-3 ml-7">Máximo 100MB total. Si subes múltiples archivos se comprimirán automáticamente en ZIP.</p>
              
              {/* Área de drop mejorada */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ${
                  selectedDownloadableFiles.length > 0 
                    ? 'border-green-300 bg-green-50/50' 
                    : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50'
                }`}
                onClick={() => document.getElementById('downloadable-file-input')?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-orange-400', 'bg-orange-50'); }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-orange-400', 'bg-orange-50'); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-orange-400', 'bg-orange-50');
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
                <div className={`p-4 rounded-full mx-auto mb-4 w-fit ${
                  selectedDownloadableFiles.length > 0 ? 'bg-green-100' : 'bg-orange-100'
                }`}>
                  {selectedDownloadableFiles.length > 0 ? (
                    <Check className="h-8 w-8 text-green-500" />
                  ) : (
                    <Upload className="h-8 w-8 text-orange-500" />
                  )}
                </div>
                <p className="text-gray-600 font-medium mb-1">
                  {selectedDownloadableFiles.length > 0 
                    ? `${selectedDownloadableFiles.length} archivo(s) seleccionado(s)` 
                    : 'Arrastra archivos aquí o haz clic para seleccionar'
                  }
                </p>
                <p className="text-gray-400 text-sm">Formatos: PDF, DOC, DOCX, XLS, XLSX, PPT, ZIP, RAR</p>
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
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-500" />
                    {selectedDownloadableFiles.length > 1 && 'Se comprimirán en ZIP'}
                  </p>
                  {selectedDownloadableFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 p-3 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Download className="h-4 w-4 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeDownloadableFile(index)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors group"
                      >
                        <X className="h-4 w-4 text-gray-400 group-hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                  
                  {/* Barra de progreso mejorada */}
                  {isUploadingDownloadable && (
                    <div className="mt-4 bg-blue-50 rounded-xl p-4 border border-blue-200">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-blue-700 font-medium flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Subiendo archivos...
                        </span>
                        <span className="text-blue-600 font-bold">{downloadableUploadProgress}%</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2.5">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${downloadableUploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Botones de acción mejorados */}
          <div className="flex flex-col gap-4 pt-4 border-t border-gray-200">
            {/* Botón principal - Guardar */}
            <button
              onClick={handleSaveDownloadable}
              disabled={saving || isUploadingDownloadable || !downloadableForm.title.trim() || (selectedDownloadableFiles.length === 0 && !downloadableForm.file_url)}
              className={`downloadable-modal-save-btn w-full py-3.5 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-3 ${
                !downloadableForm.title.trim() || (selectedDownloadableFiles.length === 0 && !downloadableForm.file_url)
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40'
              }`}
            >
              {(saving || isUploadingDownloadable) ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{isUploadingDownloadable ? 'Subiendo...' : 'Guardando...'}</span>
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  <span>Guardar Ejercicio Descargable</span>
                </>
              )}
            </button>

            {/* Botón Cancelar */}
            <button 
              onClick={() => setDownloadableModalOpen(false)} 
              className="w-full px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-colors"
              disabled={isUploadingDownloadable}
            >
              Cancelar
            </button>

            {/* Mensaje de ayuda */}
            {(!downloadableForm.title.trim() || (selectedDownloadableFiles.length === 0 && !downloadableForm.file_url)) && (
              <div className="flex items-center gap-2 justify-center text-amber-600 bg-amber-50 rounded-lg py-2 px-3">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm">
                  {!downloadableForm.title.trim() 
                    ? 'Ingresa un título para el ejercicio' 
                    : 'Sube al menos un archivo para continuar'
                  }
                </span>
              </div>
            )}
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

      {/* Interactive Exercise Config Modal */}
      <Modal
        isOpen={interactiveConfigOpen}
        onClose={() => {
          setInteractiveConfigOpen(false);
          setInteractiveConfigData(null);
        }}
        title={interactiveConfigData?.isNew ? "Crear Ejercicio Interactivo" : "Configurar Ejercicio Interactivo"}
        size="lg"
      >
        <div className="space-y-6">
          {/* Header visual mejorado */}
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl p-6 text-white">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Gamepad2 className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold">Ejercicio Interactivo</h4>
                  <p className="text-white/80 text-sm">Paso 1 de 2: Configuración básica</p>
                </div>
              </div>
              <p className="text-sm text-white/90 leading-relaxed">
                Define el título y las instrucciones que verán los estudiantes antes de realizar el ejercicio. 
                En el siguiente paso podrás diseñar los pasos interactivos.
              </p>
            </div>
          </div>

          {/* Indicador de progreso */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1">
              <div className="flex items-center justify-center w-8 h-8 bg-indigo-600 text-white rounded-full text-sm font-semibold">
                1
              </div>
              <div className="h-1 flex-1 bg-indigo-600 rounded-full"></div>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
                interactiveForm.title.trim() && interactiveForm.description.trim() && interactiveForm.description !== '<p><br></p>'
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-200 text-gray-400'
              }`}>
                2
              </div>
              <div className={`h-1 flex-1 rounded-full transition-colors ${
                interactiveForm.title.trim() && interactiveForm.description.trim() && interactiveForm.description !== '<p><br></p>'
                  ? 'bg-indigo-600' 
                  : 'bg-gray-200'
              }`}></div>
            </div>
            <div className="text-xs text-gray-500 ml-2">Editor de Pasos</div>
          </div>

          {/* Botón de acceso rápido al Editor - visible cuando el formulario está completo */}
          {interactiveForm.title.trim() && interactiveForm.description.trim() && interactiveForm.description !== '<p><br></p>' && (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 rounded-2xl blur-lg opacity-30 animate-pulse"></div>
              <button
                onClick={() => {
                  const modal = document.querySelector('.interactive-config-modal-actions');
                  if (modal) {
                    modal.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="relative w-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white rounded-2xl p-4 flex items-center justify-between group hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Check className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-base">¡Formulario completo!</p>
                    <p className="text-sm text-white/80">Haz clic para ir al botón del Editor de Pasos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">Continuar</span>
                  <div className="p-2 bg-white/20 rounded-full group-hover:translate-y-1 transition-transform duration-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Formulario */}
          <div className="space-y-5">
            {/* Título */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-indigo-100 text-indigo-600 rounded text-xs font-bold">1</span>
                Título del ejercicio <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={interactiveForm.title}
                  onChange={(e) => setInteractiveForm({ ...interactiveForm, title: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 outline-none ${
                    interactiveForm.title.trim() 
                      ? 'border-green-300 bg-green-50/50 focus:border-green-500 focus:ring-2 focus:ring-green-200' 
                      : 'border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
                  }`}
                  placeholder="Ej: Identifica las partes del motor"
                />
                {interactiveForm.title.trim() && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1.5 ml-7">
                Un título claro ayuda a los estudiantes a entender qué van a practicar
              </p>
            </div>

            {/* Instrucciones con editor de texto enriquecido */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-indigo-100 text-indigo-600 rounded text-xs font-bold">2</span>
                Instrucciones del ejercicio <span className="text-red-500">*</span>
              </label>
              <div className={`border-2 rounded-xl overflow-hidden transition-all duration-200 ${
                interactiveForm.description.trim() && interactiveForm.description !== '<p><br></p>'
                  ? 'border-green-300 ring-2 ring-green-100' 
                  : 'border-gray-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100'
              }`}>
                <ReactQuill
                  theme="snow"
                  value={interactiveForm.description}
                  onChange={(content) => setInteractiveForm({ ...interactiveForm, description: content })}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline'],
                      [{ 'color': [] }],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      ['link'],
                      ['clean']
                    ],
                  }}
                  formats={[
                    'header',
                    'bold', 'italic', 'underline',
                    'color',
                    'list',
                    'link'
                  ]}
                  placeholder="Ej: Haz clic en cada parte señalada para identificar correctamente los componentes..."
                  style={{ minHeight: '150px' }}
                />
              </div>
              <div className="flex items-start gap-2 mt-2 ml-7">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-600">Tip:</span> Sé específico. Indica qué acciones debe realizar el estudiante, 
                  cuántos elementos debe identificar y cómo sabrá que ha completado el ejercicio.
                </p>
              </div>
            </div>
          </div>

          {/* Preview card - muestra cómo se verá */}
          {(interactiveForm.title.trim() || (interactiveForm.description.trim() && interactiveForm.description !== '<p><br></p>')) && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vista previa</span>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                <h5 className="font-semibold text-gray-900 mb-2">
                  {interactiveForm.title || 'Título del ejercicio'}
                </h5>
                {interactiveForm.description && interactiveForm.description !== '<p><br></p>' ? (
                  <div 
                    className="text-sm text-gray-600 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: interactiveForm.description }}
                  />
                ) : (
                  <p className="text-sm text-gray-400 italic">Las instrucciones aparecerán aquí...</p>
                )}
              </div>
            </div>
          )}

          {/* Sección de descarga de imágenes para videos - solo cuando ya existe el ejercicio */}
          {!interactiveConfigData?.isNew && (
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <div className="flex items-start gap-3">
                <Download className="h-5 w-5 text-purple-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-purple-800">Descargar Imágenes para Videos</h4>
                  <p className="text-sm text-purple-600 mt-1">
                    Descarga las imágenes de los pasos con los comentarios y acciones visibles superpuestas. Útil para crear videos explicativos.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {loadingInteractiveSteps ? (
                      <div className="flex items-center gap-2 text-sm text-purple-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando pasos...
                      </div>
                    ) : interactiveSteps.length > 0 ? (
                      <button
                        onClick={handleDownloadAllImagesWithOverlays}
                        disabled={isDownloadingImages}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium transition-colors"
                      >
                        {isDownloadingImages ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Descargando...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4" />
                            Descargar Todas ({interactiveSteps.filter(s => s.image_url).length} imágenes)
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-purple-500 italic">
                        No hay pasos con imágenes. Accede al Editor de Pasos para crear contenido.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botones de acción mejorados */}
          <div className="flex flex-col gap-4 pt-4 border-t border-gray-200">
            {/* Botón principal - Ir al Editor */}
            <button
              onClick={async () => {
                if (!interactiveConfigData) return;
                
                setSavingInteractive(true);
                try {
                  if (interactiveConfigData.isNew) {
                    await createInteractive(
                      materialId,
                      interactiveConfigData.sessionId,
                      interactiveConfigData.topicId,
                      { title: interactiveForm.title, description: interactiveForm.description }
                    );
                  } else {
                    await updateInteractive(
                      materialId,
                      interactiveConfigData.sessionId,
                      interactiveConfigData.topicId,
                      { title: interactiveForm.title, description: interactiveForm.description }
                    );
                  }
                  navigate(`/study-contents/${materialId}/sessions/${interactiveConfigData.sessionId}/topics/${interactiveConfigData.topicId}/interactive`);
                  setInteractiveConfigOpen(false);
                  setInteractiveConfigData(null);
                } catch (error) {
                  console.error('Error saving interactive:', error);
                  setToast({ message: 'Error al guardar el ejercicio', type: 'error' });
                } finally {
                  setSavingInteractive(false);
                }
              }}
              disabled={savingInteractive || !interactiveForm.title.trim() || !interactiveForm.description.trim() || interactiveForm.description === '<p><br></p>'}
              className={`interactive-config-modal-actions w-full py-3.5 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-3 ${
                !interactiveForm.title.trim() || !interactiveForm.description.trim() || interactiveForm.description === '<p><br></p>'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/25 hover:shadow-green-500/40'
              }`}
            >
              {savingInteractive ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Edit2 className="h-5 w-5" />
                  <span>Continuar al Editor de Pasos</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>

            {/* Botones secundarios */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setInteractiveConfigOpen(false);
                  setInteractiveConfigData(null);
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!interactiveForm.title.trim()) {
                    alert('El título es requerido');
                    return;
                  }
                  if (!interactiveConfigData) return;
                  
                  setSavingInteractive(true);
                  try {
                    if (interactiveConfigData.isNew) {
                      await createInteractive(
                        materialId,
                        interactiveConfigData.sessionId,
                        interactiveConfigData.topicId,
                        { title: interactiveForm.title, description: interactiveForm.description }
                      );
                    } else {
                      await updateInteractive(
                        materialId,
                        interactiveConfigData.sessionId,
                        interactiveConfigData.topicId,
                        { title: interactiveForm.title, description: interactiveForm.description }
                      );
                    }
                    await loadMaterial();
                    setInteractiveConfigOpen(false);
                    setInteractiveConfigData(null);
                    setToast({ message: 'Ejercicio guardado correctamente', type: 'success' });
                  } catch (error) {
                    console.error('Error saving interactive:', error);
                    setToast({ message: 'Error al guardar el ejercicio', type: 'error' });
                  } finally {
                    setSavingInteractive(false);
                  }
                }}
                disabled={savingInteractive || !interactiveForm.title.trim()}
                className="flex-1 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-colors border border-indigo-200"
              >
                {savingInteractive && <Loader2 className="h-4 w-4 animate-spin" />}
                Solo Guardar
              </button>
            </div>

            {/* Mensaje de ayuda */}
            {(!interactiveForm.title.trim() || !interactiveForm.description.trim() || interactiveForm.description === '<p><br></p>') && (
              <div className="flex items-center gap-2 justify-center text-amber-600 bg-amber-50 rounded-lg py-2 px-3">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm">Completa el título y las instrucciones para continuar al editor</span>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal de confirmación para cambiar video de Azure a enlace externo */}
      {showChangeVideoSourceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowChangeVideoSourceModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Cambiar fuente del video</h3>
                  <p className="text-white/80 text-sm">Esta acción no se puede deshacer</p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                ¿Estás seguro de que deseas reemplazar el video almacenado en la nube por un enlace externo?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-red-100 rounded-lg flex-shrink-0">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-800">El video actual será eliminado</p>
                    <p className="text-xs text-red-600 mt-1">
                      El archivo de video almacenado en la nube se eliminará permanentemente al guardar los cambios.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowChangeVideoSourceModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setVideoForm({ ...videoForm, video_url: '', video_type: 'youtube' });
                    setShowChangeVideoSourceModal(false);
                  }}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 font-medium transition-colors shadow-lg shadow-amber-500/25"
                >
                  Sí, cambiar a enlace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Validación para Publicar */}
      <Modal
        isOpen={showValidationModal}
        onClose={() => !isPublishing && setShowValidationModal(false)}
        title={validationResult?.is_valid ? '¡Material Listo para Publicar!' : 'Validación del Material'}
        size="lg"
      >
        <div className="space-y-4">
          {validationResult && (
            <>
              {/* Resumen */}
              <div className={`p-4 rounded-xl ${validationResult.is_valid ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="flex items-center gap-3 mb-3">
                  {validationResult.is_valid ? (
                    <>
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-green-800">Todo el contenido está completo</h3>
                        <p className="text-sm text-green-600">El material cumple con todos los requisitos para ser publicado</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-amber-800">Contenido incompleto</h3>
                        <p className="text-sm text-amber-600">Completa todos los elementos antes de publicar</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-white/60 rounded-lg p-2">
                    <div className="text-lg font-bold text-gray-800">{validationResult.summary.total_sessions}</div>
                    <div className="text-xs text-gray-500">Sesiones</div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-2">
                    <div className="text-lg font-bold text-gray-800">{validationResult.summary.total_topics}</div>
                    <div className="text-xs text-gray-500">Temas</div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-2">
                    <div className="text-lg font-bold text-green-600">{validationResult.summary.complete_topics}</div>
                    <div className="text-xs text-gray-500">Completos</div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-2">
                    <div className={`text-lg font-bold ${validationResult.summary.incomplete_topics > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {validationResult.summary.incomplete_topics}
                    </div>
                    <div className="text-xs text-gray-500">Incompletos</div>
                  </div>
                </div>
              </div>

              {/* Lista de errores */}
              {!validationResult.is_valid && validationResult.errors.length > 0 && (
                <div className="border-2 border-red-200 rounded-xl overflow-hidden">
                  <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                    <h4 className="text-sm font-bold text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      ⚠️ Material Incompleto - {validationResult.errors.length} elemento{validationResult.errors.length > 1 ? 's' : ''} faltante{validationResult.errors.length > 1 ? 's' : ''}
                    </h4>
                    <p className="text-xs text-red-600 mt-1">Debes completar los siguientes elementos antes de publicar:</p>
                  </div>
                  <div className="max-h-52 overflow-y-auto bg-white">
                    {validationResult.errors.map((error, index) => (
                      <div key={index} className={`p-3 flex items-start gap-3 ${index > 0 ? 'border-t border-red-100' : ''}`}>
                        <div className="w-6 h-6 rounded-full bg-red-500 flex-shrink-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900">{error.session}</div>
                          {error.topic && (
                            <div className="text-sm text-gray-600">→ {error.topic}</div>
                          )}
                          <div className="text-sm text-red-600 mt-1 font-medium flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded inline-flex">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                            Falta: {error.element}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowValidationModal(false)}
                  disabled={isPublishing}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
                >
                  {validationResult.is_valid ? 'Cancelar' : 'Cerrar'}
                </button>
                {validationResult.is_valid && (
                  <button
                    onClick={handlePublish}
                    disabled={isPublishing}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Publicando...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        Publicar Ahora
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal de Confirmación de Eliminación del Material */}
      {showDeleteMaterialModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Confirmar Eliminación del Material
              </h3>
            </div>
            
            <p className="text-gray-700 mb-2">
              ¿Estás seguro de que deseas eliminar el material <strong>"{material?.title}"</strong>?
            </p>
            
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800 font-medium">
                    Esta acción no se puede deshacer. Se eliminarán permanentemente:
                  </p>
                  <ul className="list-disc list-inside text-sm text-red-700 mt-2">
                    <li>Todas las sesiones ({material?.sessions?.length || 0})</li>
                    <li>Todos los temas, lecturas, videos y ejercicios</li>
                    <li>Todos los archivos descargables asociados</li>
                  </ul>
                </div>
              </div>
            </div>

            <form onSubmit={handleDeleteMaterial}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Para confirmar, ingresa tu contraseña:
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    setDeleteError('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Tu contraseña"
                  required
                  autoFocus
                />
                {deleteError && (
                  <p className="mt-2 text-sm text-red-600">{deleteError}</p>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteMaterialModal(false);
                    setDeletePassword('');
                    setDeleteError('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={isDeleting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Eliminar Material
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyContentDetailPage;
