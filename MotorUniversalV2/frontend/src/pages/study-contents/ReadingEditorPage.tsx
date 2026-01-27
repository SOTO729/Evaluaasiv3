/**
 * Página de Editor de Lectura con Tiptap
 * Pantalla completa para crear/editar material de lectura
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import {
  getMaterial,
  upsertReading,
  uploadReadingImage,
  deleteReading,
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
  Trash2,
  AlertTriangle,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Plus,
  Minus,
  Trash,
  Undo,
  Redo,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Palette,
  Highlighter,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import DOMPurify from 'dompurify';

interface ReadingForm {
  title: string;
  content: string;
}

// Extensión de Image personalizada con alineación
const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: 'center',
        parseHTML: element => element.getAttribute('data-align') || 'center',
        renderHTML: attributes => {
          return {
            'data-align': attributes.align,
            style: attributes.align === 'left' 
              ? 'display: block; margin-left: 0; margin-right: auto;'
              : attributes.align === 'right'
              ? 'display: block; margin-left: auto; margin-right: 0;'
              : 'display: block; margin-left: auto; margin-right: auto;',
          };
        },
      },
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width') || element.style.width || null,
        renderHTML: attributes => {
          if (!attributes.width) return {};
          return {
            width: attributes.width,
            style: `width: ${attributes.width}; height: auto;`,
          };
        },
      },
    };
  },
});

// Toolbar Component
const EditorToolbar = ({ editor, onImageUpload, isUploading }: { 
  editor: ReturnType<typeof useEditor>; 
  onImageUpload: () => void;
  isUploading: boolean;
}) => {
  if (!editor) return null;

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL del enlace:', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const insertTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const setColor = useCallback((color: string) => {
    editor.chain().focus().setColor(color).run();
  }, [editor]);

  const setHighlight = useCallback((color: string) => {
    editor.chain().focus().toggleHighlight({ color }).run();
  }, [editor]);

  const colors = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
  const highlightColors = ['#fef08a', '#bbf7d0', '#bfdbfe', '#f5d0fe', '#fed7aa', '#e5e7eb'];

  return (
    <div className="border-b border-gray-200 bg-white sticky top-0 z-30">
      {/* Primera fila: Formato básico */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-100">
        {/* Deshacer/Rehacer */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
          title="Deshacer"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
          title="Rehacer"
        >
          <Redo className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Encabezados */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Título 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Título 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('heading', { level: 3 }) ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Título 3"
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Formato de texto */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('bold') ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Negrita"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('italic') ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Cursiva"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('underline') ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Subrayado"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('strike') ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Tachado"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Colores */}
        <div className="relative group">
          <button className="p-2 rounded hover:bg-gray-100" title="Color de texto">
            <Palette className="w-4 h-4" />
          </button>
          <div className="absolute top-full left-0 mt-1 hidden group-hover:flex flex-wrap gap-1 p-2 bg-white border rounded-lg shadow-lg z-50 w-32">
            {colors.map(color => (
              <button
                key={color}
                onClick={() => setColor(color)}
                className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <div className="relative group">
          <button className="p-2 rounded hover:bg-gray-100" title="Resaltado">
            <Highlighter className="w-4 h-4" />
          </button>
          <div className="absolute top-full left-0 mt-1 hidden group-hover:flex flex-wrap gap-1 p-2 bg-white border rounded-lg shadow-lg z-50 w-32">
            {highlightColors.map(color => (
              <button
                key={color}
                onClick={() => setHighlight(color)}
                className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Alineación */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive({ textAlign: 'left' }) ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Alinear izquierda"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive({ textAlign: 'center' }) ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Centrar"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive({ textAlign: 'right' }) ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Alinear derecha"
        >
          <AlignRight className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Listas */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('bulletList') ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Lista con viñetas"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('orderedList') ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Lista numerada"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Bloques */}
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('blockquote') ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Cita"
        >
          <Quote className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('codeBlock') ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Bloque de código"
        >
          <Code className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Enlaces e Imágenes */}
        <button
          onClick={setLink}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('link') ? 'bg-blue-100 text-blue-600' : ''}`}
          title="Enlace"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onImageUpload}
          disabled={isUploading}
          className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
          title="Insertar imagen"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        </button>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Tabla */}
        <button
          onClick={insertTable}
          className="p-2 rounded hover:bg-gray-100"
          title="Insertar tabla"
        >
          <TableIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Segunda fila: Controles de tabla (solo visible cuando hay tabla seleccionada) */}
      {editor.isActive('table') && (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-blue-50 border-b border-blue-100">
          <span className="text-sm font-medium text-blue-700 mr-2">Tabla:</span>
          
          {/* Filas */}
          <button
            onClick={() => editor.chain().focus().addRowBefore().run()}
            className="flex items-center gap-1 px-2 py-1 text-sm rounded bg-white border hover:bg-gray-50"
            title="Agregar fila arriba"
          >
            <Plus className="w-3 h-3" /> Fila ↑
          </button>
          <button
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className="flex items-center gap-1 px-2 py-1 text-sm rounded bg-white border hover:bg-gray-50"
            title="Agregar fila abajo"
          >
            <Plus className="w-3 h-3" /> Fila ↓
          </button>
          <button
            onClick={() => editor.chain().focus().deleteRow().run()}
            className="flex items-center gap-1 px-2 py-1 text-sm rounded bg-white border hover:bg-red-50 text-red-600"
            title="Eliminar fila"
          >
            <Minus className="w-3 h-3" /> Fila
          </button>

          <div className="w-px h-6 bg-blue-200 mx-2" />

          {/* Columnas */}
          <button
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            className="flex items-center gap-1 px-2 py-1 text-sm rounded bg-white border hover:bg-gray-50"
            title="Agregar columna izquierda"
          >
            <Plus className="w-3 h-3" /> Col ←
          </button>
          <button
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className="flex items-center gap-1 px-2 py-1 text-sm rounded bg-white border hover:bg-gray-50"
            title="Agregar columna derecha"
          >
            <Plus className="w-3 h-3" /> Col →
          </button>
          <button
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className="flex items-center gap-1 px-2 py-1 text-sm rounded bg-white border hover:bg-red-50 text-red-600"
            title="Eliminar columna"
          >
            <Minus className="w-3 h-3" /> Col
          </button>

          <div className="w-px h-6 bg-blue-200 mx-2" />

          {/* Eliminar tabla */}
          <button
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="flex items-center gap-1 px-2 py-1 text-sm rounded bg-red-100 border border-red-200 hover:bg-red-200 text-red-700"
            title="Eliminar tabla"
          >
            <Trash className="w-3 h-3" /> Eliminar tabla
          </button>

          <div className="w-px h-6 bg-blue-200 mx-2" />

          {/* Merge/Split */}
          <button
            onClick={() => editor.chain().focus().mergeCells().run()}
            className="flex items-center gap-1 px-2 py-1 text-sm rounded bg-white border hover:bg-gray-50"
            title="Combinar celdas"
          >
            Combinar
          </button>
          <button
            onClick={() => editor.chain().focus().splitCell().run()}
            className="flex items-center gap-1 px-2 py-1 text-sm rounded bg-white border hover:bg-gray-50"
            title="Dividir celda"
          >
            Dividir
          </button>
        </div>
      )}

      {/* Tercera fila: Controles de imagen (solo visible cuando hay imagen seleccionada) */}
      {editor.isActive('image') && (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-green-50 border-b border-green-100">
          <span className="text-sm font-medium text-green-700 mr-2">Imagen:</span>
          
          {/* Alineación */}
          <button
            onClick={() => editor.chain().focus().updateAttributes('image', { align: 'left' }).run()}
            className="flex items-center gap-1 px-2 py-1 text-sm rounded bg-white border hover:bg-gray-50"
            title="Alinear izquierda"
          >
            <AlignLeft className="w-3 h-3" /> Izquierda
          </button>
          <button
            onClick={() => editor.chain().focus().updateAttributes('image', { align: 'center' }).run()}
            className="flex items-center gap-1 px-2 py-1 text-sm rounded bg-white border hover:bg-gray-50"
            title="Centrar"
          >
            <AlignCenter className="w-3 h-3" /> Centro
          </button>
          <button
            onClick={() => editor.chain().focus().updateAttributes('image', { align: 'right' }).run()}
            className="flex items-center gap-1 px-2 py-1 text-sm rounded bg-white border hover:bg-gray-50"
            title="Alinear derecha"
          >
            <AlignRight className="w-3 h-3" /> Derecha
          </button>

          <div className="w-px h-6 bg-green-200 mx-2" />

          {/* Tamaños */}
          <button
            onClick={() => editor.chain().focus().updateAttributes('image', { width: '25%' }).run()}
            className="px-2 py-1 text-sm rounded bg-white border hover:bg-gray-50"
          >
            25%
          </button>
          <button
            onClick={() => editor.chain().focus().updateAttributes('image', { width: '50%' }).run()}
            className="px-2 py-1 text-sm rounded bg-white border hover:bg-gray-50"
          >
            50%
          </button>
          <button
            onClick={() => editor.chain().focus().updateAttributes('image', { width: '75%' }).run()}
            className="px-2 py-1 text-sm rounded bg-white border hover:bg-gray-50"
          >
            75%
          </button>
          <button
            onClick={() => editor.chain().focus().updateAttributes('image', { width: '100%' }).run()}
            className="px-2 py-1 text-sm rounded bg-white border hover:bg-gray-50"
          >
            100%
          </button>
          <button
            onClick={() => {
              const width = window.prompt('Ancho de imagen (ej: 300px, 50%):', '');
              if (width) {
                editor.chain().focus().updateAttributes('image', { width }).run();
              }
            }}
            className="px-2 py-1 text-sm rounded bg-white border hover:bg-gray-50"
          >
            Personalizado...
          </button>
        </div>
      )}
    </div>
  );
};

const ReadingEditorPage = () => {
  const navigate = useNavigate();
  const { id: materialId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const topicId = searchParams.get('topicId');
  
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [hasExistingReading, setHasExistingReading] = useState(false);
  const [topic, setTopic] = useState<StudyTopic | null>(null);
  const [form, setForm] = useState<ReadingForm>({ title: '', content: '' });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  // Configurar editor Tiptap
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'tiptap-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      CustomImage.configure({
        inline: false,
        allowBase64: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setForm(prev => ({ ...prev, content: editor.getHTML() }));
    },
    onCreate: () => {
      setEditorReady(true);
    },
  });

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
          if (foundTopic.reading) {
            setHasExistingReading(true);
            setForm({
              title: foundTopic.reading.title,
              content: foundTopic.reading.content,
            });
          }
        }
      } catch (error) {
        console.error('Error loading material:', error);
        setToast({ message: 'Error al cargar el material', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [materialId, sessionId, topicId, navigate]);

  // Establecer contenido inicial cuando el editor esté listo
  useEffect(() => {
    if (editor && editorReady && form.content && !editor.getHTML().includes(form.content.slice(0, 50))) {
      editor.commands.setContent(form.content);
    }
  }, [editor, editorReady, form.content]);

  // Manejar subida de imagen
  const handleImageUpload = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !materialId) return;
      
      setIsUploadingImage(true);
      try {
        // Convertir el archivo a base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const base64Data = await base64Promise;
        
        const imageUrl = await uploadReadingImage(base64Data);
        editor?.chain().focus().setImage({ src: imageUrl }).run();
        setToast({ message: 'Imagen subida correctamente', type: 'success' });
      } catch (error) {
        console.error('Error uploading image:', error);
        setToast({ message: 'Error al subir la imagen', type: 'error' });
      } finally {
        setIsUploadingImage(false);
      }
    };
    
    input.click();
  }, [editor, materialId]);

  // Auto-ocultar toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Guardar
  const handleSave = async () => {
    if (!form.title.trim() || !materialId || !sessionId || !topicId) return;
    setSaving(true);
    try {
      const currentContent = editor?.getHTML() || form.content;
      
      await upsertReading(parseInt(materialId), parseInt(sessionId), parseInt(topicId), {
        ...form,
        content: currentContent
      });
      setToast({ message: 'Lectura guardada exitosamente', type: 'success' });
      setTimeout(() => navigate(`/study-contents/${materialId}`), 1000);
    } catch (error) {
      console.error('Error saving reading:', error);
      setToast({ message: 'Error al guardar la lectura', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Eliminar lectura
  const handleDelete = async () => {
    if (!materialId || !sessionId || !topicId) return;
    setDeleting(true);
    try {
      await deleteReading(parseInt(materialId), parseInt(sessionId), parseInt(topicId));
      setToast({ message: 'Lectura eliminada exitosamente', type: 'success' });
      setShowDeleteModal(false);
      setTimeout(() => navigate(`/study-contents/${materialId}`), 1000);
    } catch (error) {
      console.error('Error deleting reading:', error);
      setToast({ message: 'Error al eliminar la lectura', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando editor..." fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Estilos CSS para Tiptap */}
      <style>{`
        .tiptap-editor {
          min-height: 500px;
          outline: none;
        }
        .tiptap-editor > .ProseMirror {
          outline: none;
          min-height: 500px;
        }
        .tiptap-editor p {
          margin: 0.5em 0;
        }
        .tiptap-editor h1 {
          font-size: 2em;
          font-weight: bold;
          margin: 0.67em 0;
        }
        .tiptap-editor h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.75em 0;
        }
        .tiptap-editor h3 {
          font-size: 1.17em;
          font-weight: bold;
          margin: 0.83em 0;
        }
        .tiptap-editor ul {
          list-style-type: disc;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .tiptap-editor ol {
          list-style-type: decimal;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .tiptap-editor blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1em;
          margin: 1em 0;
          color: #6b7280;
        }
        .tiptap-editor pre {
          background: #1f2937;
          color: #f9fafb;
          padding: 1em;
          border-radius: 0.5em;
          overflow-x: auto;
          margin: 1em 0;
        }
        .tiptap-editor code {
          background: #f3f4f6;
          padding: 0.2em 0.4em;
          border-radius: 0.25em;
          font-family: monospace;
        }
        .tiptap-editor pre code {
          background: none;
          padding: 0;
        }
        .tiptap-editor a {
          color: #3b82f6;
          text-decoration: underline;
        }
        .tiptap-editor img {
          max-width: 100%;
          height: auto;
          cursor: pointer;
        }
        .tiptap-editor img.ProseMirror-selectednode {
          outline: 3px solid #3b82f6;
          outline-offset: 2px;
        }
        /* Estilos de tabla */
        .tiptap-table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          table-layout: fixed;
        }
        .tiptap-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        .tiptap-editor th,
        .tiptap-editor td {
          border: 1px solid #d1d5db;
          padding: 8px 12px;
          min-width: 50px;
          vertical-align: top;
          position: relative;
        }
        .tiptap-editor th {
          background-color: #f3f4f6;
          font-weight: 600;
        }
        .tiptap-editor .selectedCell {
          background-color: #dbeafe !important;
        }
        .tiptap-editor .selectedCell::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(59, 130, 246, 0.1);
          pointer-events: none;
        }
        /* Resize handle para columnas */
        .tiptap-editor .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          background-color: #3b82f6;
          cursor: col-resize;
        }
        .tiptap-editor .tableWrapper {
          overflow-x: auto;
        }
        .tiptap-editor .resize-cursor {
          cursor: col-resize;
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : null}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 px-4 pt-4">
        <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-sm px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate(`/study-contents/${materialId}`)}
                className="group flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-medium hidden sm:block">Volver</span>
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-sm font-semibold text-gray-900">
                    {hasExistingReading ? 'Editar' : 'Crear'} Lectura
                  </h1>
                  {topic && (
                    <p className="text-xs text-gray-500 truncate max-w-[200px]">
                      {topic.title}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  showPreview 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden sm:inline">{showPreview ? 'Editar' : 'Vista previa'}</span>
              </button>

              {isAdmin && hasExistingReading && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Eliminar</span>
                </button>
              )}

              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{saving ? 'Guardando...' : 'Guardar'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 px-4 py-4">
        <div className="max-w-5xl mx-auto">
          {/* Campo de título */}
          <div className="mb-4">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Título de la lectura..."
              className="w-full px-4 py-3 text-xl font-semibold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Editor o Preview */}
          {showPreview ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[500px]">
              <div 
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(form.content) }}
              />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <EditorToolbar 
                editor={editor} 
                onImageUpload={handleImageUpload}
                isUploading={isUploadingImage}
              />
              <div className="p-4">
                <EditorContent 
                  editor={editor} 
                  className="tiptap-editor prose prose-lg max-w-none focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Eliminar lectura</h3>
                <p className="text-sm text-gray-500">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar esta lectura? Todo el contenido se perderá permanentemente.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingEditorPage;
