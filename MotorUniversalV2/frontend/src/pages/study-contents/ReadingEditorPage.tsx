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
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Combine,
  SplitSquareHorizontal,
  Grid3X3,
  Code2,
  X,
  ClipboardPaste,
  Replace,
  Plus,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import DOMPurify from 'dompurify';
import { sanitizeReadingHtml, READING_SANITIZE_CONFIG } from '../../utils/sanitizeReading';

interface ReadingForm {
  title: string;
  content: string;
}

// Extensión de Image personalizada con alineación, redimensionado (arrastrar bordes) y movimiento
const CustomImage = Image.extend({
  draggable: true,
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
  // NodeView que dibuja la imagen con manijas en las esquinas para redimensionar
  // arrastrando los bordes (estilo Microsoft Word) y permite moverla.
  addNodeView() {
    return ({ node, editor, getPos }: any) => {
      let currentNode = node;

      const container = document.createElement('div');
      container.className = 'tiptap-image';
      container.draggable = true;

      const img = document.createElement('img');
      img.draggable = false;
      container.appendChild(img);

      // Al hacer clic en la imagen, seleccionarla para mostrar su configuración
      img.addEventListener('mousedown', () => {
        if (typeof getPos === 'function') {
          editor.commands.setNodeSelection(getPos());
        }
      });

      const applyAttrs = (n: any) => {
        img.src = n.attrs.src;
        img.alt = n.attrs.alt || '';
        if (n.attrs.title) img.title = n.attrs.title; else img.removeAttribute('title');
        img.style.width = n.attrs.width || '';
        container.setAttribute('data-align', n.attrs.align || 'center');
      };

      const corners = ['nw', 'ne', 'sw', 'se'];
      corners.forEach(corner => {
        const handle = document.createElement('div');
        handle.className = `tiptap-image-handle tiptap-image-handle-${corner}`;
        handle.addEventListener('mousedown', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          container.draggable = false; // evita iniciar arrastre mientras se redimensiona
          const startX = e.clientX;
          const startWidth = img.offsetWidth;
          const parentWidth = container.parentElement?.offsetWidth || startWidth;
          const growsRight = corner === 'ne' || corner === 'se';

          const onMove = (ev: MouseEvent) => {
            const dx = ev.clientX - startX;
            let newWidth = startWidth + (growsRight ? dx : -dx);
            newWidth = Math.max(40, Math.min(newWidth, parentWidth));
            img.style.width = `${Math.round(newWidth)}px`;
          };
          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            container.draggable = true;
            if (typeof getPos === 'function') {
              const pos = getPos();
              editor.view.dispatch(
                editor.view.state.tr.setNodeMarkup(pos, undefined, {
                  ...currentNode.attrs,
                  width: img.style.width,
                })
              );
            }
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
        container.appendChild(handle);
      });

      applyAttrs(currentNode);

      return {
        dom: container,
        selectNode() {
          container.classList.add('tiptap-image-selected');
        },
        deselectNode() {
          container.classList.remove('tiptap-image-selected');
        },
        update(updatedNode: any) {
          if (updatedNode.type.name !== currentNode.type.name) return false;
          currentNode = updatedNode;
          applyAttrs(updatedNode);
          return true;
        },
        ignoreMutation() {
          return true;
        },
      };
    };
  },
});


// TextStyle extendido con fuente y tamaño.
// Se renderizan como estilos inline (font-family / font-size) que sobreviven a
// DOMPurify y, por su mayor especificidad, se ven igual en la página de preview.
const CustomTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: element => (element as HTMLElement).style.fontSize || null,
        renderHTML: attributes => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
      fontFamily: {
        default: null,
        parseHTML: element => (element as HTMLElement).style.fontFamily?.replace(/['"]/g, '') || null,
        renderHTML: attributes => {
          if (!attributes.fontFamily) return {};
          return { style: `font-family: ${attributes.fontFamily}` };
        },
      },
    };
  },
});

// Opciones para los selectores del toolbar
const FONT_FAMILIES = [
  { label: 'Predeterminada', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
];

const FONT_SIZES = [
  { label: 'Tamaño', value: '' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '30', value: '30px' },
  { label: '36', value: '36px' },
];

// Toolbar Component
const EditorToolbar = ({ editor, onImageUpload, isUploading, inline = false, onCustomImageSize }: { 
  editor: ReturnType<typeof useEditor>; 
  onImageUpload: () => void;
  isUploading: boolean;
  inline?: boolean;
  onCustomImageSize?: () => void;
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

  // Tipo de bloque actual (para el selector de estilo de párrafo)
  const currentBlockType = editor.isActive('heading', { level: 1 })
    ? 'h1'
    : editor.isActive('heading', { level: 2 })
    ? 'h2'
    : editor.isActive('heading', { level: 3 })
    ? 'h3'
    : 'paragraph';

  const applyBlockType = (value: string) => {
    if (value === 'paragraph') {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = Number(value.replace('h', '')) as 1 | 2 | 3;
      editor.chain().focus().setHeading({ level }).run();
    }
  };

  const currentFontFamily = (editor.getAttributes('textStyle').fontFamily as string) || '';
  const currentFontSize = (editor.getAttributes('textStyle').fontSize as string) || '';

  const applyFontFamily = (value: string) => {
    editor.chain().focus().setMark('textStyle', { fontFamily: value || null }).run();
  };
  const applyFontSize = (value: string) => {
    editor.chain().focus().setMark('textStyle', { fontSize: value || null }).run();
  };

  const selectClass = 'h-8 pl-2.5 pr-7 text-sm bg-white border border-gray-200 rounded-md text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer transition-colors';

  return (
    <div className={inline ? 'flex flex-col min-w-0' : 'border-b border-gray-200 bg-gradient-to-b from-white to-gray-50/80 z-30'}>
      {/* Primera fila: Formato básico */}
      <div className={inline ? 'flex flex-nowrap items-center gap-0.5 px-1.5 py-1 overflow-x-auto' : 'flex flex-wrap items-center gap-1 p-2 border-b border-gray-100'}>
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

        {/* Estilo de párrafo / Fuente / Tamaño */}
        <select
          value={currentBlockType}
          onChange={(e) => applyBlockType(e.target.value)}
          className={`${selectClass} font-medium`}
          title="Estilo de texto"
        >
          <option value="paragraph">Normal</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
        </select>
        <select
          value={currentFontFamily}
          onChange={(e) => applyFontFamily(e.target.value)}
          className={`${selectClass} max-w-[140px]`}
          title="Fuente"
          style={currentFontFamily ? { fontFamily: currentFontFamily } : undefined}
        >
          {FONT_FAMILIES.map(f => (
            <option key={f.label} value={f.value} style={f.value ? { fontFamily: f.value } : undefined}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={currentFontSize}
          onChange={(e) => applyFontSize(e.target.value)}
          className={`${selectClass} w-[72px]`}
          title="Tamaño de fuente"
        >
          {FONT_SIZES.map(s => (
            <option key={s.label} value={s.value}>{s.label}</option>
          ))}
        </select>

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
        <div className="flex flex-wrap items-center gap-1 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
          <div className="flex items-center gap-1.5 mr-3">
            <Grid3X3 className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">Tabla</span>
          </div>
          
          {/* Grupo: Filas */}
          <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <span className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border-r">Filas</span>
            <button
              onClick={() => editor.chain().focus().addRowBefore().run()}
              className="flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-blue-50 hover:text-blue-600 transition-colors border-r border-gray-100"
              title="Agregar fila arriba"
            >
              <ArrowUpToLine className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-blue-50 hover:text-blue-600 transition-colors border-r border-gray-100"
              title="Agregar fila abajo"
            >
              <ArrowDownToLine className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().deleteRow().run()}
              className="flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors"
              title="Eliminar fila"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Grupo: Columnas */}
          <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <span className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border-r">Cols</span>
            <button
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              className="flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-blue-50 hover:text-blue-600 transition-colors border-r border-gray-100"
              title="Agregar columna a la izquierda"
            >
              <ArrowLeftToLine className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className="flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-blue-50 hover:text-blue-600 transition-colors border-r border-gray-100"
              title="Agregar columna a la derecha"
            >
              <ArrowRightToLine className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().deleteColumn().run()}
              className="flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors"
              title="Eliminar columna"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Grupo: Celdas */}
          <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <span className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border-r">Celdas</span>
            <button
              onClick={() => editor.chain().focus().mergeCells().run()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm hover:bg-purple-50 hover:text-purple-600 transition-colors border-r border-gray-100"
              title="Combinar celdas seleccionadas"
            >
              <Combine className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().splitCell().run()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm hover:bg-purple-50 hover:text-purple-600 transition-colors"
              title="Dividir celda"
            >
              <SplitSquareHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Eliminar tabla */}
          <button
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 hover:text-red-700 transition-colors shadow-sm ml-auto"
            title="Eliminar tabla completa"
          >
            <Trash className="w-4 h-4" />
            <span className="hidden sm:inline">Eliminar</span>
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
            onClick={() => onCustomImageSize?.()}
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

  // Importar HTML
  const [showHtmlModal, setShowHtmlModal] = useState(false);
  const [htmlInput, setHtmlInput] = useState('');
  const [htmlMode, setHtmlMode] = useState<'replace' | 'append'>('replace');

  // Tamaño personalizado de imagen
  const [showImageSizeModal, setShowImageSizeModal] = useState(false);
  const [imageSizeInput, setImageSizeInput] = useState('');

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
      CustomTextStyle,
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

  // Insertar / reemplazar el cuerpo de la lectura desde HTML pegado
  const handleApplyHtml = useCallback(() => {
    if (!editor) return;
    const raw = htmlInput.trim();
    if (!raw) {
      setToast({ message: 'Pega algún HTML primero', type: 'error' });
      return;
    }
    // Sanitizar para evitar scripts/estilos peligrosos antes de insertarlo,
    // preservando imágenes referenciadas (http/https, data:base64, blob:).
    const clean = DOMPurify.sanitize(raw, READING_SANITIZE_CONFIG) as string;
    if (htmlMode === 'replace') {
      editor.commands.setContent(clean, true);
    } else {
      editor.commands.focus('end');
      editor.commands.insertContent(clean);
    }
    setForm(prev => ({ ...prev, content: editor.getHTML() }));
    setShowHtmlModal(false);
    setHtmlInput('');
    setToast({
      message: htmlMode === 'replace' ? 'Contenido reemplazado desde HTML' : 'HTML agregado al final',
      type: 'success',
    });
  }, [editor, htmlInput, htmlMode]);

  // Pegar desde el portapapeles dentro del modal
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setHtmlInput(prev => (prev ? prev + '\n' + text : text));
    } catch {
      setToast({ message: 'No se pudo leer el portapapeles. Pega manualmente (Ctrl+V).', type: 'error' });
    }
  }, []);

  // Conteo de palabras y caracteres del contenido (sin etiquetas)
  const { wordCount, charCount } = (() => {
    const text = (form.content || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
    const trimmed = text.replace(/\s+/g, ' ').trim();
    return {
      wordCount: trimmed ? trimmed.split(' ').length : 0,
      charCount: trimmed.length,
    };
  })();

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
        .reading-page {
          max-width: 100%;
        }
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
        /* Imagen redimensionable (node view) */
        .tiptap-editor .tiptap-image {
          position: relative;
          display: inline-block;
          max-width: 100%;
          line-height: 0;
        }
        .tiptap-editor .tiptap-image[data-align="center"] {
          display: block;
          margin-left: auto;
          margin-right: auto;
          width: fit-content;
        }
        .tiptap-editor .tiptap-image[data-align="left"] {
          display: block;
          margin-left: 0;
          margin-right: auto;
          width: fit-content;
        }
        .tiptap-editor .tiptap-image[data-align="right"] {
          display: block;
          margin-left: auto;
          margin-right: 0;
          width: fit-content;
        }
        .tiptap-editor .tiptap-image img {
          display: block;
          max-width: 100%;
          height: auto;
          cursor: move;
        }
        .tiptap-editor .tiptap-image.tiptap-image-selected img {
          outline: 2px solid #3b82f6;
          outline-offset: 1px;
        }
        .tiptap-editor .tiptap-image-handle {
          position: absolute;
          width: 12px;
          height: 12px;
          background: #3b82f6;
          border: 2px solid #ffffff;
          border-radius: 9999px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.2);
          display: none;
          z-index: 20;
        }
        .tiptap-editor .tiptap-image.tiptap-image-selected .tiptap-image-handle {
          display: block;
        }
        .tiptap-editor .tiptap-image-handle-nw { top: -7px; left: -7px; cursor: nwse-resize; }
        .tiptap-editor .tiptap-image-handle-ne { top: -7px; right: -7px; cursor: nesw-resize; }
        .tiptap-editor .tiptap-image-handle-sw { bottom: -7px; left: -7px; cursor: nesw-resize; }
        .tiptap-editor .tiptap-image-handle-se { bottom: -7px; right: -7px; cursor: nwse-resize; }
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

      {/* Header flotante (sin barra rectangular) */}
      <header className="sticky top-0 z-40 pointer-events-none">
        <div className="flex items-center gap-3 px-4 sm:px-6 pt-3 pb-2">
          {/* Izquierda: pastilla de navegación + identidad (toda clicable) */}
          <button
            type="button"
            onClick={() => navigate(`/study-contents/${materialId}`)}
            title="Volver al material"
            className="group pointer-events-auto flex items-center gap-2 rounded-2xl bg-white/90 backdrop-blur-md shadow-lg shadow-gray-900/5 ring-1 ring-gray-900/5 pl-1.5 pr-3.5 py-1.5 min-w-0 shrink-0 hover:ring-blue-200 transition-all text-left"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </span>
            <span className="flex flex-col min-w-0 leading-tight pr-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                {hasExistingReading ? 'Editar lectura' : 'Nueva lectura'}
              </span>
              <span className="text-sm font-semibold text-gray-900 truncate max-w-[120px] sm:max-w-[180px]">
                {topic?.title || 'Lectura'}
              </span>
            </span>
          </button>

          {/* Centro: barra de formato flotante (en preview se muestra atenuada y deshabilitada) */}
          {editorReady && (
            <div
              className={`flex-1 min-w-0 rounded-2xl bg-white/90 backdrop-blur-md shadow-lg shadow-gray-900/5 ring-1 ring-gray-900/5 overflow-hidden transition-opacity ${
                showPreview ? 'opacity-40 pointer-events-none select-none' : 'pointer-events-auto'
              }`}
              aria-hidden={showPreview}
            >
              <EditorToolbar
                editor={editor}
                onImageUpload={handleImageUpload}
                isUploading={isUploadingImage}
                inline
                onCustomImageSize={() => {
                  setImageSizeInput((editor?.getAttributes('image').width as string) || '');
                  setShowImageSizeModal(true);
                }}
              />
            </div>
          )}

          {/* Derecha: acciones flotantes circulares + guardar */}
          <div className="pointer-events-auto flex items-center gap-2 shrink-0 ml-auto">
            <button
              onClick={() => { setHtmlMode(form.content.trim() ? 'append' : 'replace'); setShowHtmlModal(true); }}
              className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/90 backdrop-blur-md shadow-lg shadow-gray-900/5 ring-1 ring-gray-900/5 text-gray-600 hover:text-violet-600 hover:ring-violet-200 transition-all"
              title="Pegar código HTML para crear el cuerpo de la lectura"
            >
              <Code2 className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center justify-center w-11 h-11 rounded-2xl shadow-lg transition-all ring-1 ${
                showPreview
                  ? 'bg-blue-600 text-white ring-blue-600/30 shadow-blue-600/25'
                  : 'bg-white/90 backdrop-blur-md text-gray-600 ring-gray-900/5 shadow-gray-900/5 hover:text-blue-600 hover:ring-blue-200'
              }`}
              title={showPreview ? 'Volver a editar' : 'Ver vista previa'}
            >
              {showPreview ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>

            {isAdmin && hasExistingReading && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/90 backdrop-blur-md shadow-lg shadow-gray-900/5 ring-1 ring-gray-900/5 text-gray-600 hover:text-red-600 hover:ring-red-200 transition-all"
                title="Eliminar lectura"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className={`flex items-center gap-2 h-11 px-5 rounded-2xl text-sm font-semibold transition-all ${
                !saving && form.title.trim()
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-sm'
              }`}
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>{saving ? 'Guardando...' : 'Guardar'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 flex flex-col">
        {showPreview ? (
          /* ---------- VISTA PREVIA (tal cual la verá el candidato) ---------- */
          <div className="px-4 py-6">
            <div className="w-full">
              <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
                <Eye className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-gray-700">Vista previa</span>
                <span className="text-gray-400">— así se verá la lectura en el material de estudio</span>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
                {form.content.trim() || form.title.trim() ? (
                  <article className="px-8 sm:px-14 py-12">
                    <h1 className="text-3xl font-bold text-gray-900 pb-3 mb-6 border-b border-gray-200">
                      {form.title || 'Sin título'}
                    </h1>
                    <div
                      className="reading-content prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-semibold prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-blue-600 prose-strong:text-gray-900 [&_img]:rounded-lg"
                      dangerouslySetInnerHTML={{ __html: sanitizeReadingHtml(form.content) }}
                    />
                  </article>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center min-h-[500px] text-gray-400">
                    <FileText className="w-12 h-12 mb-3 text-gray-300" />
                    <p className="text-sm">Aún no hay contenido para previsualizar</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ---------- EDITOR (estilo documento profesional) ---------- */
          <>
            {/* Lienzo: hoja del documento (la barra de formato vive en el header) */}
            <div className="flex-1 px-4 pt-4 pb-6">
              <div className="reading-page mx-auto bg-white border border-gray-200 shadow-xl rounded-xl px-8 sm:px-14 py-12">
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Título de la lectura..."
                  className="w-full text-3xl font-bold text-gray-900 placeholder-gray-300 bg-transparent border-0 border-b border-gray-100 focus:border-blue-300 focus:outline-none px-0 pb-3 mb-6 transition-colors"
                />
                <EditorContent
                  editor={editor}
                  className="tiptap-editor prose prose-lg max-w-none focus:outline-none"
                />
              </div>

              {/* Barra de estado inferior */}
              <div className="w-full mt-3 flex items-center justify-between px-1 text-xs text-gray-500">
                <span>{wordCount} palabra{wordCount === 1 ? '' : 's'} · {charCount} caracteres</span>
                <button
                  onClick={() => { setHtmlMode(form.content.trim() ? 'append' : 'replace'); setShowHtmlModal(true); }}
                  className="flex items-center gap-1.5 font-medium text-violet-600 hover:text-violet-700 transition-colors"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  Pegar HTML
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modal: Tamaño personalizado de imagen */}
      {showImageSizeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full flex flex-col shadow-2xl">
            {/* Header del modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <ImageIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Tamaño de imagen</h3>
                  <p className="text-xs text-gray-500">Define un ancho en porcentaje o píxeles</p>
                </div>
              </div>
              <button
                onClick={() => setShowImageSizeModal(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del modal */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Ancho</label>
                <input
                  type="text"
                  value={imageSizeInput}
                  onChange={(e) => setImageSizeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && imageSizeInput.trim()) {
                      editor?.chain().focus().updateAttributes('image', { width: imageSizeInput.trim() }).run();
                      setShowImageSizeModal(false);
                    }
                  }}
                  placeholder="Ej: 50% o 300px"
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1.5 text-xs text-gray-400">Usa un porcentaje (ej: 50%) o un valor en píxeles (ej: 300px).</p>
              </div>

              {/* Presets rápidos */}
              <div className="flex flex-wrap gap-2">
                {['25%', '50%', '75%', '100%'].map(preset => (
                  <button
                    key={preset}
                    onClick={() => setImageSizeInput(preset)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      imageSizeInput === preset
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer del modal */}
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowImageSizeModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (imageSizeInput.trim()) {
                    editor?.chain().focus().updateAttributes('image', { width: imageSizeInput.trim() }).run();
                  }
                  setShowImageSizeModal(false);
                }}
                disabled={!imageSizeInput.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all text-sm font-medium shadow-sm"
              >
                <Check className="w-4 h-4" />
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pegar HTML */}
      {showHtmlModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header del modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <Code2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Pegar HTML</h3>
                  <p className="text-xs text-gray-500">Crea el cuerpo de la lectura a partir de código HTML</p>
                </div>
              </div>
              <button
                onClick={() => setShowHtmlModal(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del modal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Modo: reemplazar / agregar */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setHtmlMode('replace')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    htmlMode === 'replace'
                      ? 'bg-violet-50 border-violet-300 text-violet-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Replace className="w-4 h-4" />
                  Reemplazar contenido
                </button>
                <button
                  onClick={() => setHtmlMode('append')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    htmlMode === 'append'
                      ? 'bg-violet-50 border-violet-300 text-violet-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Agregar al final
                </button>
                <button
                  onClick={handlePasteFromClipboard}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all ml-auto"
                >
                  <ClipboardPaste className="w-4 h-4" />
                  Pegar del portapapeles
                </button>
              </div>

              {/* Editor de HTML + Vista previa */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Código HTML</label>
                  <textarea
                    value={htmlInput}
                    onChange={(e) => setHtmlInput(e.target.value)}
                    placeholder={'<h2>Mi título</h2>\n<p>Escribe o pega aquí tu HTML...</p>'}
                    spellCheck={false}
                    className="w-full h-64 px-3 py-2 font-mono text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Vista previa</label>
                  <div className="h-64 overflow-y-auto px-3 py-2 border border-gray-200 rounded-xl bg-white">
                    {htmlInput.trim() ? (
                      <div
                        className="reading-content prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: sanitizeReadingHtml(htmlInput) }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        La vista previa aparecerá aquí
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-400">
                El HTML se limpia automáticamente por seguridad (se eliminan scripts). Se conservan textos, encabezados,
                listas, tablas, enlaces, imágenes y formato básico.
              </p>
            </div>

            {/* Footer del modal */}
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowHtmlModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyHtml}
                disabled={!htmlInput.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 transition-all text-sm font-medium shadow-sm"
              >
                <Check className="w-4 h-4" />
                {htmlMode === 'replace' ? 'Reemplazar contenido' : 'Agregar al final'}
              </button>
            </div>
          </div>
        </div>
      )}

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
