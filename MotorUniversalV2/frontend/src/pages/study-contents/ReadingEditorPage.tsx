/**
 * Página de Editor de Lectura
 * Pantalla completa para crear/editar material de lectura
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  getMaterial,
  upsertReading,
  uploadReadingImage,
  StudyTopic,
} from '../../services/studyContentService';
import {
  ArrowLeft,
  FileText,
  Loader2,
  Check,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import DOMPurify from 'dompurify';

interface ReadingForm {
  title: string;
  content: string;
}

const ReadingEditorPage = () => {
  const navigate = useNavigate();
  const { id: materialId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const topicId = searchParams.get('topicId');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [topic, setTopic] = useState<StudyTopic | null>(null);
  const [form, setForm] = useState<ReadingForm>({ title: '', content: '' });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const quillRef = useRef<ReactQuill>(null);
  const isProcessingPaste = useRef(false);
  const selectedImageRef = useRef<HTMLImageElement | null>(null);
  const createResizeHandlesFnRef = useRef<((img: HTMLImageElement) => void) | null>(null);
  const resizeHandlesRef = useRef<HTMLDivElement[]>([]);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startWidth = useRef(0);
  const startHeight = useRef(0);
  const currentHandle = useRef<string>('');
  
  // Módulos de Quill
  const quillModules = useMemo(() => ({
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
    clipboard: {
      matchVisual: false,
    },
  }), []);

  // Formatos permitidos en Quill
  const quillFormats = useMemo(() => [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'indent',
    'align',
    'link', 'image',
    'blockquote', 'code-block'
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
        
        // Buscar el topic
        const session = data.sessions?.find(s => s.id === parseInt(sessionId));
        const foundTopic = session?.topics?.find(t => t.id === parseInt(topicId));
        
        if (foundTopic) {
          setTopic(foundTopic);
          if (foundTopic.reading) {
            setForm({
              title: foundTopic.reading.title,
              content: foundTopic.reading.content,
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

  // Manejar pegado de imágenes - evitar duplicados
  const handleImagePaste = useCallback(async (e: ClipboardEvent) => {
    // Evitar procesamiento doble
    if (isProcessingPaste.current) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        e.stopPropagation();
        isProcessingPaste.current = true;
        
        const file = item.getAsFile();
        if (!file) {
          isProcessingPaste.current = false;
          continue;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Data = event.target?.result as string;
          if (!base64Data) {
            isProcessingPaste.current = false;
            return;
          }

          setIsUploadingImage(true);
          try {
            const imageUrl = await uploadReadingImage(base64Data);
            
            const quill = quillRef.current?.getEditor();
            if (quill) {
              const range = quill.getSelection(true);
              const insertIndex = range.index;
              quill.insertEmbed(insertIndex, 'image', imageUrl);
              quill.setSelection(insertIndex + 1, 0);
              // MutationObserver detectará la nueva imagen y mostrará handles automáticamente
            }
            
            setToast({ message: 'Imagen pegada exitosamente', type: 'success' });
          } catch (error) {
            console.error('Error uploading pasted image:', error);
            setToast({ message: 'Error al subir la imagen', type: 'error' });
          } finally {
            setIsUploadingImage(false);
            setTimeout(() => {
              isProcessingPaste.current = false;
            }, 100);
          }
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  // Registrar listener de pegado con captura para interceptar antes que Quill
  useEffect(() => {
    const quillEditor = quillRef.current?.getEditor()?.root;
    if (!quillEditor) return;
    
    const pasteHandler = (e: Event) => {
      if (e instanceof ClipboardEvent) {
        handleImagePaste(e);
      }
    };
    
    // Usar capture: true para interceptar el evento antes que Quill
    quillEditor.addEventListener('paste', pasteHandler, true);
    
    return () => {
      quillEditor.removeEventListener('paste', pasteHandler, true);
    };
  }, [handleImagePaste, loading]);

  // Remover handles de resize existentes
  const removeResizeHandles = useCallback(() => {
    resizeHandlesRef.current.forEach(handle => handle.remove());
    resizeHandlesRef.current = [];
  }, []);

  // Actualizar posición de los handles (usando coordenadas fijas del viewport)
  const updateHandlePositions = useCallback(() => {
    if (!selectedImageRef.current || resizeHandlesRef.current.length === 0) return;
    
    const img = selectedImageRef.current;
    const rect = img.getBoundingClientRect();
    
    // Posiciones basadas en viewport (position: fixed)
    const positions = [
      { handle: 'nw', left: rect.left, top: rect.top },
      { handle: 'n', left: rect.left + rect.width / 2, top: rect.top },
      { handle: 'ne', left: rect.right, top: rect.top },
      { handle: 'w', left: rect.left, top: rect.top + rect.height / 2 },
      { handle: 'e', left: rect.right, top: rect.top + rect.height / 2 },
      { handle: 'sw', left: rect.left, top: rect.bottom },
      { handle: 's', left: rect.left + rect.width / 2, top: rect.bottom },
      { handle: 'se', left: rect.right, top: rect.bottom },
    ];
    
    resizeHandlesRef.current.forEach((el, i) => {
      if (positions[i]) {
        el.style.left = `${positions[i].left}px`;
        el.style.top = `${positions[i].top}px`;
      }
    });
  }, []);

  // Manejar movimiento durante resize
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !selectedImageRef.current) return;
    e.preventDefault();

    // Factor de sensibilidad (0.5 = 50% más lento/suave)
    const sensitivity = 0.5;
    
    const deltaX = (e.clientX - startX.current) * sensitivity;
    const deltaY = (e.clientY - startY.current) * sensitivity;
    const aspectRatio = startWidth.current / startHeight.current;
    
    let newWidth = startWidth.current;
    let newHeight = startHeight.current;
    
    const handle = currentHandle.current;
    
    // Calcular nuevas dimensiones según el handle
    if (handle.includes('e')) {
      newWidth = Math.max(50, startWidth.current + deltaX);
    }
    if (handle.includes('w')) {
      newWidth = Math.max(50, startWidth.current - deltaX);
    }
    if (handle.includes('s')) {
      newHeight = Math.max(50, startHeight.current + deltaY);
    }
    if (handle.includes('n')) {
      newHeight = Math.max(50, startHeight.current - deltaY);
    }

    // Mantener proporción para esquinas (a menos que Shift esté presionado)
    if ((handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se') && !e.shiftKey) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        newHeight = newWidth / aspectRatio;
      } else {
        newWidth = newHeight * aspectRatio;
      }
    }

    // Aplicar tamaño
    selectedImageRef.current.style.width = `${Math.round(newWidth)}px`;
    selectedImageRef.current.style.height = `${Math.round(newHeight)}px`;

    // Actualizar posición de handles para que sigan la imagen
    updateHandlePositions();
  }, [updateHandlePositions]);

  // Manejar fin de resize
  const handleResizeEnd = useCallback(() => {
    if (!isResizing.current) return;
    
    isResizing.current = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Guardar dimensiones finales en atributos
    if (selectedImageRef.current) {
      const finalWidth = selectedImageRef.current.offsetWidth;
      const finalHeight = selectedImageRef.current.offsetHeight;
      selectedImageRef.current.setAttribute('width', String(finalWidth));
      selectedImageRef.current.setAttribute('height', String(finalHeight));
      
      // Actualizar contenido del form
      const quill = quillRef.current?.getEditor();
      if (quill) {
        const html = quill.root.innerHTML;
        setForm(prev => ({ ...prev, content: html }));
      }
      
      console.log('[Resize] Tamaño final:', finalWidth, 'x', finalHeight);
    }
  }, [handleResizeMove]);

  // Manejar inicio de resize
  const handleResizeStart = useCallback((e: MouseEvent, corner: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedImageRef.current) return;

    isResizing.current = true;
    currentHandle.current = corner;
    startX.current = e.clientX;
    startY.current = e.clientY;
    startWidth.current = selectedImageRef.current.offsetWidth;
    startHeight.current = selectedImageRef.current.offsetHeight;
    
    // Cambiar cursor y deshabilitar selección de texto
    const cursors: Record<string, string> = {
      'nw': 'nwse-resize', 'se': 'nwse-resize',
      'ne': 'nesw-resize', 'sw': 'nesw-resize',
      'n': 'ns-resize', 's': 'ns-resize',
      'e': 'ew-resize', 'w': 'ew-resize'
    };
    document.body.style.cursor = cursors[corner] || 'nwse-resize';
    document.body.style.userSelect = 'none';
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    
    console.log('[Resize] Iniciando desde:', corner);
  }, [handleResizeMove, handleResizeEnd]);

  // Crear handles de resize como overlay fijo sobre la imagen
  const createResizeHandles = useCallback((_img: HTMLImageElement) => {
    removeResizeHandles();
    
    // Guardar referencia a la imagen
    selectedImageRef.current = _img;
    
    const corners = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
    const cursors: Record<string, string> = {
      'nw': 'nwse-resize', 'se': 'nwse-resize',
      'ne': 'nesw-resize', 'sw': 'nesw-resize',
      'n': 'ns-resize', 's': 'ns-resize',
      'e': 'ew-resize', 'w': 'ew-resize'
    };

    // Crear contenedor de overlay si no existe
    let overlayContainer = document.getElementById('image-resize-overlay');
    if (!overlayContainer) {
      overlayContainer = document.createElement('div');
      overlayContainer.id = 'image-resize-overlay';
      overlayContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 99999;
      `;
      document.body.appendChild(overlayContainer);
    }

    corners.forEach(corner => {
      const handle = document.createElement('div');
      handle.className = 'image-resize-handle';
      handle.dataset.corner = corner;
      handle.style.cssText = `
        position: fixed;
        width: 12px;
        height: 12px;
        background: #3b82f6;
        border: 2px solid white;
        border-radius: 3px;
        cursor: ${cursors[corner]};
        z-index: 99999;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        pointer-events: auto;
        transform: translate(-50%, -50%);
      `;
      
      handle.addEventListener('mousedown', (e) => handleResizeStart(e, corner));
      
      overlayContainer!.appendChild(handle);
      resizeHandlesRef.current.push(handle);
    });
    
    // Posicionar handles usando coordenadas del viewport
    updateHandlePositions();
    
    console.log('[Handles] Creados', corners.length, 'handles en overlay fijo');
  }, [removeResizeHandles, handleResizeStart, updateHandlePositions]);

  // Seleccionar/deseleccionar imagen (añadir clase y crear handles de resize)
  const selectImage = useCallback((img: HTMLImageElement | null) => {
    // Quitar selección anterior y remover handles
    removeResizeHandles();
    const quillEditor = quillRef.current?.getEditor()?.root;
    if (quillEditor) {
      quillEditor.querySelectorAll('img.image-selected').forEach(el => {
        el.classList.remove('image-selected');
      });
    }
    
    // Seleccionar nueva imagen y crear handles
    if (img) {
      img.classList.add('image-selected');
      selectedImageRef.current = img;
      createResizeHandles(img);
      console.log('[Image] Imagen seleccionada:', img.offsetWidth, 'x', img.offsetHeight);
    } else {
      selectedImageRef.current = null;
    }
  }, [removeResizeHandles, createResizeHandles]);

  // Remover selección de imagen
  const deselectImage = useCallback(() => {
    removeResizeHandles();
    selectImage(null);
  }, [selectImage, removeResizeHandles]);

  // Guardar referencia a la función para usarla desde el paste handler
  useEffect(() => {
    createResizeHandlesFnRef.current = selectImage;
  }, [selectImage]);

  // Manejar click en imágenes para seleccionarlas y permitir redimensionamiento
  useEffect(() => {
    const quillEditor = quillRef.current?.getEditor()?.root;
    if (!quillEditor) return;

    const handleImageClick = (e: Event) => {
      const target = e.target as HTMLElement;
      
      if (target.tagName === 'IMG') {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Click] Imagen seleccionada');
        selectImage(target as HTMLImageElement);
      } else {
        // Clic fuera de imagen, deseleccionar
        deselectImage();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        deselectImage();
      }
    };

    // Detectar nuevas imágenes y seleccionarlas automáticamente después de pegar
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLImageElement) {
            // Seleccionar imagen cuando esté cargada
            const selectWhenLoaded = () => {
              if (node.complete && node.naturalWidth > 10) {
                selectImage(node);
              } else {
                node.addEventListener('load', () => selectImage(node), { once: true });
              }
            };
            setTimeout(selectWhenLoaded, 100);
          }
        }
      }
    });

    observer.observe(quillEditor, {
      childList: true,
      subtree: true
    });

    quillEditor.addEventListener('click', handleImageClick);
    document.addEventListener('keydown', handleKeyDown);
    
    // Actualizar posición de handles al hacer scroll
    const handleScroll = () => {
      if (selectedImageRef.current && resizeHandlesRef.current.length > 0) {
        updateHandlePositions();
      }
    };
    
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      observer.disconnect();
      quillEditor.removeEventListener('click', handleImageClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [loading, selectImage, deselectImage, updateHandlePositions]);

  // Guardar
  const handleSave = async () => {
    if (!form.title.trim() || !materialId || !sessionId || !topicId) return;
    setSaving(true);
    try {
      await upsertReading(parseInt(materialId), parseInt(sessionId), parseInt(topicId), form);
      setToast({ message: 'Lectura guardada exitosamente', type: 'success' });
      setTimeout(() => navigate(`/study-contents/${materialId}`), 1000);
    } catch (error) {
      console.error('Error saving reading:', error);
      setToast({ message: 'Error al guardar la lectura', type: 'error' });
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

  const isFormComplete = form.title.trim() && form.content.trim() && form.content !== '<p><br></p>';

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
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : null}
          {toast.message}
        </div>
      )}

      {/* Header fijo */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto fluid-px-4">
          <div className="flex items-center justify-between h-16">
            {/* Botón volver */}
            <button
              onClick={() => navigate(`/study-contents/${materialId}`)}
              className="flex items-center fluid-gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline fluid-text-sm">Volver al material</span>
            </button>

            {/* Título */}
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="hidden sm:block">
                <h1 className="fluid-text-lg font-semibold text-gray-900">
                  {topic?.reading ? 'Editar Lectura' : 'Crear Lectura'}
                </h1>
                <p className="fluid-text-sm text-gray-500">{topic?.title}</p>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center fluid-gap-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="fluid-p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title={showPreview ? 'Ocultar vista previa' : 'Ver vista previa'}
              >
                {showPreview ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !isFormComplete}
                className={`flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-lg font-medium transition-all fluid-text-sm ${
                  isFormComplete
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                <span className="hidden sm:inline">Guardar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 max-w-7xl mx-auto w-full fluid-px-4 fluid-py-6">
        <div className={`grid fluid-gap-6 ${showPreview ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Editor */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Indicador de progreso */}
            <div className="fluid-px-6 fluid-py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center fluid-gap-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full fluid-text-sm font-semibold transition-colors ${
                  form.title.trim() ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {form.title.trim() ? <Check className="w-4 h-4" /> : '1'}
                </div>
                <div className={`h-1 flex-1 rounded-full transition-colors ${
                  form.title.trim() ? 'bg-blue-600' : 'bg-gray-200'
                }`}></div>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full fluid-text-sm font-semibold transition-colors ${
                  form.content.trim() && form.content !== '<p><br></p>' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {form.content.trim() && form.content !== '<p><br></p>' ? <Check className="w-4 h-4" /> : '2'}
                </div>
                <span className="fluid-text-xs text-gray-500 ml-2">Título + Contenido</span>
              </div>
            </div>

            {/* Campo título */}
            <div className="fluid-px-6 fluid-py-4 border-b border-gray-100">
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <span className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center text-blue-600 fluid-text-xs font-bold">1</span>
                Título <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ej: Introducción a los conceptos básicos"
                className="w-full fluid-px-4 fluid-py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all fluid-text-base"
              />
            </div>

            {/* Editor Quill */}
            <div className="fluid-px-6 fluid-py-4">
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <span className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center text-blue-600 fluid-text-xs font-bold">2</span>
                Contenido <span className="text-red-500">*</span>
              </label>
              <p className="fluid-text-xs text-gray-500 fluid-mb-3">
                Utiliza el editor para dar formato al texto. <strong>Pega imágenes</strong> con Ctrl+V. <strong>Haz clic en una imagen</strong> y arrastra los puntos azules para redimensionarla.
              </p>
              
              {isUploadingImage && (
                <div className="fluid-mb-2 flex items-center fluid-gap-2 fluid-text-sm text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Subiendo imagen...</span>
                </div>
              )}
              
              <div className={`border-2 rounded-xl overflow-hidden transition-all quill-image-clickable ${
                form.content.trim() && form.content !== '<p><br></p>'
                  ? 'border-green-300 ring-2 ring-green-100' 
                  : 'border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100'
              }`}>
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={form.content}
                  onChange={(content) => setForm({ ...form, content })}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Escribe el contenido de la lectura aquí..."
                  style={{ minHeight: '400px' }}
                />
              </div>
            </div>
          </div>

          {/* Vista previa */}
          {showPreview && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="fluid-px-6 fluid-py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-900 flex items-center fluid-gap-2 fluid-text-base">
                  <Eye className="w-5 h-5 text-gray-500" />
                  Vista Previa
                </h3>
              </div>
              <div className="fluid-p-6">
                {form.title && (
                  <h2 className="fluid-text-2xl font-bold text-gray-900 fluid-mb-4">{form.title}</h2>
                )}
                <div 
                  className="prose prose-sm max-w-none fluid-text-base"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(form.content || '<p class="text-gray-400 italic">El contenido aparecerá aquí...</p>') 
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ReadingEditorPage;
