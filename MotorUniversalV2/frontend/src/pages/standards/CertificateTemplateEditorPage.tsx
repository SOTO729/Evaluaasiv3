/**
 * Editor visual de plantilla de certificado por ECM.
 * Soporta PDF e imágenes. Drag & drop. Carga, posiciona campos y previsualiza.
 *
 * Mejoras v2:
 *  - Soporte para imágenes (PNG/JPG/WebP) además de PDF
 *  - Zona de drag-and-drop para subir archivos
 *  - Reemplazar plantilla sin eliminar primero
 *  - Overlays con texto de muestra real
 *  - Panel lateral mejorado con secciones claras
 *  - Controles de zoom mejorados
 *  - Toast-style notifications
 *  - Mejor responsive
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useAuthStore } from '../../store/authStore';
import {
  getCertificateTemplate,
  uploadCertificateTemplate,
  updateCertificateTemplate,
  deleteCertificateTemplate,
  downloadPreview,
  CertificateTemplate,
  TemplateConfig,
  FieldConfig,
  QrFieldConfig,
  ACCEPTED_TEMPLATE_FORMATS,
} from '../../services/certificateTemplateService';
import {
  ArrowLeft,
  Upload,
  Eye,
  Trash2,
  Save,
  User as UserIcon,
  ScrollText,
  QrCode,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertCircle,
  CheckCircle2,
  Plus,
  CloudUpload,
  Loader2,
  X,
} from 'lucide-react';

// Worker local de pdfjs-dist (evita carga desde CDN bloqueada por CSP)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// ─── Tipos ──────────────────────────────────────────────────
type FieldKey = 'name_field' | 'cert_name_field' | 'qr_field';
type DragTarget = FieldKey | null;
type ResizeEdge = 'right' | 'bottom' | 'corner' | null;

interface DragState {
  target: FieldKey;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

interface ResizeState {
  target: FieldKey;
  edge: ResizeEdge;
  startX: number;
  startY: number;
  origW: number;
  origH: number;
  origSize?: number;
}

// ─── Constantes ─────────────────────────────────────────────
const FIELDS: { key: FieldKey; label: string; shortLabel: string; color: string; bgClass: string; textClass: string; borderClass: string; icon: React.ReactNode }[] = [
  {
    key: 'name_field',
    label: 'Nombre del participante',
    shortLabel: 'Nombre',
    color: '#3b82f6',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-500',
    icon: <UserIcon className="w-3.5 h-3.5" />,
  },
  {
    key: 'cert_name_field',
    label: 'Nombre del certificado / Estándar',
    shortLabel: 'Certificado',
    color: '#10b981',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-500',
    icon: <ScrollText className="w-3.5 h-3.5" />,
  },
  {
    key: 'qr_field',
    label: 'Código QR de verificación',
    shortLabel: 'QR',
    color: '#f59e0b',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-500',
    icon: <QrCode className="w-3.5 h-3.5" />,
  },
];

const FIELD_MAP = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<FieldKey, typeof FIELDS[0]>;

const SAMPLE_TEXT: Record<FieldKey, string> = {
  name_field: 'Juan Pérez García',
  cert_name_field: 'EC0217 – IMPARTICIÓN DE CURSOS',
  qr_field: '',
};

// ─── Componente principal ───────────────────────────────────
export default function CertificateTemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const standardId = Number(id);

  // Estado
  const [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const [config, setConfig] = useState<TemplateConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedThisSession, setUploadedThisSession] = useState(false);

  // Drag & resize
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [selected, setSelected] = useState<DragTarget>('name_field');
  const [activePanel, setActivePanel] = useState<FieldKey>('name_field');

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit =
    user?.role === 'admin' ||
    user?.role === 'developer' ||
    user?.role === 'editor' ||
    user?.role === 'coordinator';

  // ─── Cargar ───────────────────────────────────────────────
  useEffect(() => {
    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standardId]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCertificateTemplate(standardId);
      if (data.has_template && data.template) {
        setTemplate(data.template);
        setConfig(data.template.config);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar plantilla');
    } finally {
      setLoading(false);
    }
  };

  // ─── Subir / reemplazar ───────────────────────────────────
  const processUpload = async (file: File) => {
    const validExts = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExts.includes(ext)) {
      setError('Formato no soportado. Use PDF, PNG, JPG o WebP.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('El archivo supera el límite de 50 MB.');
      return;
    }
    try {
      setUploading(true);
      setError(null);
      setPdfLoaded(false);
      const replace = !!template;
      const data = await uploadCertificateTemplate(standardId, file, replace);
      setTemplate(data.template);
      setConfig(data.template.config);
      setDirty(false);
      setUploadedThisSession(true);
      setSuccess(replace ? 'Plantilla reemplazada. Ajuste las posiciones.' : 'Plantilla subida. Ajuste las posiciones de los campos.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al subir plantilla');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUpload(file);
    e.target.value = '';
  };

  // ─── Drag and drop ───────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processUpload(file);
  };

  // ─── Guardar ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      setError(null);
      const data = await updateCertificateTemplate(standardId, config);
      setTemplate(data.template);
      setConfig(data.template.config);
      setDirty(false);
      setUploadedThisSession(false);
      setSuccess('Posiciones guardadas correctamente');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // ─── Eliminar ─────────────────────────────────────────────
  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteCertificateTemplate(standardId);
      setTemplate(null);
      setConfig(null);
      setPdfLoaded(false);
      setDirty(false);
      setUploadedThisSession(false);
      setShowDeleteConfirm(false);
      setSuccess('Plantilla eliminada');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Vista previa ─────────────────────────────────────────
  const handlePreview = async () => {
    try {
      setPreviewing(true);
      setError(null);
      const blob = await downloadPreview(standardId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al generar vista previa');
    } finally {
      setPreviewing(false);
    }
  };

  // ─── Escala ───────────────────────────────────────────────
  const recalcScale = useCallback(() => {
    if (!template || !containerRef.current) return;
    const cw = containerRef.current.clientWidth - 48;
    setScale(Math.min(cw / template.pdf_width, 1.2));
  }, [template]);

  const onPdfLoadSuccess = () => {
    setPdfLoaded(true);
    recalcScale();
  };

  useEffect(() => {
    window.addEventListener('resize', recalcScale);
    return () => window.removeEventListener('resize', recalcScale);
  }, [recalcScale]);

  // ─── Drag & resize handlers ──────────────────────────────
  const startDrag = (e: React.MouseEvent, target: FieldKey) => {
    e.preventDefault();
    e.stopPropagation();
    if (!config) return;
    setSelected(target);
    setActivePanel(target);
    const field = config[target];
    setDragState({ target, startX: e.clientX, startY: e.clientY, origX: field.x, origY: field.y });
  };

  const startResize = (e: React.MouseEvent, target: FieldKey, edge: ResizeEdge) => {
    e.preventDefault();
    e.stopPropagation();
    if (!config) return;
    setSelected(target);
    setActivePanel(target);
    const field = config[target];
    setResizeState({
      target,
      edge,
      startX: e.clientX,
      startY: e.clientY,
      origW: 'width' in field ? (field as FieldConfig).width : 0,
      origH: 'height' in field ? (field as FieldConfig).height : 0,
      origSize: 'size' in field ? (field as QrFieldConfig).size : undefined,
    });
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!config || !template) return;

      if (dragState) {
        const dx = (e.clientX - dragState.startX) / scale;
        const dy = -(e.clientY - dragState.startY) / scale;
        const key = dragState.target;
        setConfig((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            [key]: {
              ...prev[key],
              x: Math.round(Math.max(0, dragState.origX + dx) * 10) / 10,
              y: Math.round((dragState.origY + dy) * 10) / 10,
            },
          };
        });
        setDirty(true);
      }

      if (resizeState) {
        const key = resizeState.target;
        const dxPx = e.clientX - resizeState.startX;
        const dyPx = e.clientY - resizeState.startY;

        setConfig((prev) => {
          if (!prev) return prev;
          const field = { ...prev[key] };

          if (key === 'qr_field') {
            const dSize = (dxPx + dyPx) / 2 / scale;
            const qr = field as QrFieldConfig;
            return { ...prev, [key]: { ...qr, size: Math.round(Math.max(20, (resizeState.origSize ?? qr.size) + dSize) * 10) / 10 } };
          }

          const f = field as FieldConfig;
          if (resizeState.edge === 'right' || resizeState.edge === 'corner') {
            f.width = Math.round(Math.max(40, resizeState.origW + dxPx / scale) * 10) / 10;
          }
          if (resizeState.edge === 'bottom' || resizeState.edge === 'corner') {
            f.height = Math.round(Math.max(15, resizeState.origH + dyPx / scale) * 10) / 10;
          }
          return { ...prev, [key]: f };
        });
        setDirty(true);
      }
    };

    const onUp = () => {
      setDragState(null);
      setResizeState(null);
    };

    if (dragState || resizeState) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragState, resizeState, config, template, scale]);

  // ─── Auto-hide mensajes ───────────────────────────────────
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(t);
    }
  }, [success]);
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // ─── Bloqueo de navegación (cambios sin guardar) ──────────
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleBack = () => {
    if (dirty) {
      setShowLeaveConfirm(true);
    } else {
      navigate(`/standards/${standardId}`);
    }
  };

  const handleConfirmLeave = async () => {
    if (uploadedThisSession && template) {
      try { await deleteCertificateTemplate(standardId); } catch { /* best-effort cleanup */ }
    }
    setDirty(false);
    setShowLeaveConfirm(false);
    navigate(`/standards/${standardId}`);
  };

  // ─── Helpers de config ────────────────────────────────────
  const updateFieldProp = (key: FieldKey, prop: string, value: number | string | boolean) => {
    setConfig((prev) => (prev ? { ...prev, [key]: { ...prev[key], [prop]: value } } : prev));
    setDirty(true);
  };

  // ─── Render overlay de un campo ───────────────────────────
  const renderOverlay = (fieldDef: typeof FIELDS[0]) => {
    if (!config || !template) return null;
    const { key, label, bgClass, borderClass, textClass, color } = fieldDef;
    const field = config[key];
    const isQr = key === 'qr_field';

    const w = isQr ? (field as QrFieldConfig).size : (field as FieldConfig).width;
    const h = isQr ? (field as QrFieldConfig).size : (field as FieldConfig).height;

    const screenX = field.x * scale;
    const screenY = (template.pdf_height - field.y - h) * scale;
    const screenW = w * scale;
    const screenH = h * scale;
    const isSelected = selected === key;

    return (
      <div
        key={key}
        className={`absolute border-2 border-dashed ${borderClass} ${bgClass} transition-shadow ${
          isSelected ? 'shadow-lg ring-2 ring-offset-1 z-20' : 'z-10 hover:shadow-md'
        }`}
        style={{
          left: screenX,
          top: screenY,
          width: screenW,
          height: screenH,
          cursor: dragState?.target === key ? 'grabbing' : 'grab',
          // @ts-ignore - ring color override
          '--tw-ring-color': isSelected ? color : undefined,
        }}
        onMouseDown={(e) => startDrag(e, key)}
        onClick={(e) => {
          e.stopPropagation();
          setSelected(key);
          setActivePanel(key);
        }}
      >
        {/* Label encima */}
        <span
          className={`absolute -top-5 left-0 font-semibold whitespace-nowrap pointer-events-none ${textClass}`}
          style={{ fontSize: Math.max(9, 10 * scale) }}
        >
          {label}
        </span>

        {/* Texto de muestra para campos de texto */}
        {!isQr && (
          <div
            className="w-full h-full flex items-center justify-center overflow-hidden pointer-events-none px-1"
            style={{
              color: (field as FieldConfig).color ?? '#1a365d',
              fontSize: Math.min(screenH * 0.6, ((field as FieldConfig).maxFontSize ?? 36) * scale * 0.5),
              fontWeight: 600,
              opacity: 0.45,
              lineHeight: 1,
            }}
          >
            {SAMPLE_TEXT[key]}
          </div>
        )}

        {/* QR icon */}
        {isQr && (
          <div className="w-full h-full flex items-center justify-center pointer-events-none opacity-35">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3/5 h-3/5 text-amber-600">
              <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm11-2h2v2h-2v-2zm-4 0h2v2h-2v-2zm0 4h2v2h-2v-2zm4 0h2v2h-2v-2zm2-4h2v2h-2v-2zm0 4h2v2h-2v-2zm2-2h2v2h-2v-2z" />
            </svg>
          </div>
        )}

        {/* Resize handles (selected only) */}
        {isSelected && !isQr && (
          <>
            <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-400/30" onMouseDown={(e) => startResize(e, key, 'right')} />
            <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-400/30" onMouseDown={(e) => startResize(e, key, 'bottom')} />
            <div
              className="absolute -right-1 -bottom-1 w-3.5 h-3.5 rounded-full cursor-nwse-resize border-2 border-white"
              style={{ backgroundColor: color }}
              onMouseDown={(e) => startResize(e, key, 'corner')}
            />
          </>
        )}
        {isSelected && isQr && (
          <div
            className="absolute -right-1 -bottom-1 w-3.5 h-3.5 rounded-full cursor-nwse-resize border-2 border-white"
            style={{ backgroundColor: color }}
            onMouseDown={(e) => startResize(e, key, 'corner')}
          />
        )}
      </div>
    );
  };

  // ─── RENDER ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[1920px] mx-auto">
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
          <span className="text-sm text-gray-500">Cargando editor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[1920px] mx-auto animate-fade-in-up">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TEMPLATE_FORMATS}
        className="hidden"
        onChange={handleFileInput}
      />

      {/* ─── Toast messages ─── */}
      {(error || success) && (
        <div className="fixed top-4 right-4 z-50 max-w-md" style={{ animation: 'slideDown 0.3s ease-out' }}>
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-3 shadow-lg mb-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-fluid-xl fluid-p-3 shadow-lg">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 flex-1">{success}</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Header ─── */}
      <div className="fluid-mb-6">
        <button
          onClick={handleBack}
          className="inline-flex items-center fluid-gap-2 fluid-text-sm text-gray-500 hover:text-primary-600 transition-colors group fluid-mb-3"
        >
          <ArrowLeft className="fluid-icon-sm transition-transform group-hover:-translate-x-0.5" />
          Volver al estándar
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-3">
          <div>
            <h1 className="fluid-text-2xl font-bold text-gray-900">
              Editor de Plantilla de Certificado
            </h1>
            <p className="fluid-text-sm text-gray-500 fluid-mt-1">
              {template ? 'Arrastre los campos para posicionarlos sobre la plantilla' : 'Suba un archivo PDF o imagen para comenzar'}
            </p>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap items-center fluid-gap-2">
            {template && canEdit && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Reemplazar
              </button>
            )}
            {template && (
              <button
                onClick={handlePreview}
                disabled={previewing}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                {previewing ? 'Generando...' : 'Vista previa'}
              </button>
            )}
            {template && canEdit && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 border border-red-200 rounded-fluid-lg fluid-text-sm font-medium text-red-600 bg-white hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            )}
            {template && canEdit && dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-fluid-lg fluid-text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Guardar posiciones
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Unsaved changes indicator */}
        {dirty && (
          <div className="fluid-mt-2 inline-flex items-center fluid-gap-1.5 fluid-text-xs text-amber-600 bg-amber-50 fluid-px-3 fluid-py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
            Cambios sin guardar
          </div>
        )}
      </div>

      {/* ─── Upload zone (sin plantilla) ─── */}
      {!template && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative bg-white border-2 border-dashed rounded-fluid-xl fluid-p-12 text-center transition-all shadow-sm ${
            dragOver
              ? 'border-primary-400 bg-primary-50 scale-[1.01]'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center fluid-gap-4">
              <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
              <p className="text-gray-600 font-medium">Procesando archivo...</p>
              <p className="fluid-text-sm text-gray-400">Las imagenes se convierten a PDF automaticamente</p>
            </div>
          ) : (
            <>
              <div className="mx-auto w-20 h-20 bg-gray-100 rounded-fluid-xl flex items-center justify-center fluid-mb-5">
                <CloudUpload className="w-10 h-10 text-gray-400" />
              </div>
              <h2 className="fluid-text-lg font-semibold text-gray-700 fluid-mb-2">
                Suba la plantilla del certificado
              </h2>
              <p className="fluid-text-sm text-gray-500 fluid-mb-6 max-w-lg mx-auto">
                Arrastre un archivo aqui o haga clic para seleccionar.
                Se aceptan <strong>PDF, PNG, JPG y WebP</strong>. Las imagenes se convierten a PDF
                automaticamente para el certificado final.
              </p>
              {canEdit && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-fluid-xl fluid-text-sm font-medium transition-colors shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  Seleccionar archivo
                </button>
              )}

              {/* Format badges */}
              <div className="flex flex-wrap justify-center fluid-gap-2 fluid-mt-6">
                {['PDF', 'PNG', 'JPG', 'WebP'].map((fmt) => (
                  <span key={fmt} className="inline-flex items-center fluid-px-3 fluid-py-1 rounded-full fluid-text-xs font-medium bg-gray-100 text-gray-600">
                    {fmt}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Editor visual ─── */}
      {template && config && (
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Canvas */}
          <div className="flex-1 min-w-0" ref={containerRef}>
            <div className="bg-white shadow-sm rounded-fluid-xl overflow-hidden border border-gray-200">
              {/* Toolbar */}
              <div className="bg-gray-50 fluid-px-4 fluid-py-2 border-b flex items-center justify-between">
                <div className="flex items-center fluid-gap-3">
                  <span className="fluid-text-xs text-gray-500 hidden sm:inline">
                    {template.pdf_width.toFixed(0)} &times; {template.pdf_height.toFixed(0)} pts
                  </span>
                  <span className="fluid-text-xs text-gray-400 hidden sm:inline">|</span>
                  <div className="flex items-center fluid-gap-1">
                    <button
                      onClick={() => setScale((s) => Math.max(0.2, +(s - 0.1).toFixed(1)))}
                      className="w-7 h-7 flex items-center justify-center rounded-fluid-md text-gray-600 hover:bg-gray-200 transition-colors"
                      title="Alejar"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-14 text-center fluid-text-xs text-gray-600 font-medium tabular-nums">
                      {(scale * 100).toFixed(0)}%
                    </span>
                    <button
                      onClick={() => setScale((s) => Math.min(2.5, +(s + 0.1).toFixed(1)))}
                      className="w-7 h-7 flex items-center justify-center rounded-fluid-md text-gray-600 hover:bg-gray-200 transition-colors"
                      title="Acercar"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={recalcScale}
                      className="ml-1 w-7 h-7 flex items-center justify-center rounded-fluid-md text-gray-500 hover:bg-gray-200 transition-colors"
                      title="Ajustar a ventana"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Field quick toggles */}
                <div className="hidden sm:flex items-center fluid-gap-1">
                  {FIELDS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => { setSelected(f.key); setActivePanel(f.key); }}
                      className={`inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 rounded-fluid-md fluid-text-xs font-medium transition-colors ${
                        selected === f.key
                          ? `${f.bgClass} ${f.textClass}`
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {f.icon} {f.shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Canvas area */}
              <div
                className="relative overflow-auto p-5"
                style={{ maxHeight: '75vh', backgroundColor: '#e5e7eb' }}
                onClick={() => setSelected(null)}
                onDragOver={template ? handleDragOver : undefined}
                onDragLeave={template ? handleDragLeave : undefined}
                onDrop={template ? handleDrop : undefined}
              >
                {/* Drag overlay for replace */}
                {dragOver && template && (
                  <div className="absolute inset-0 bg-primary-500/10 backdrop-blur-sm z-30 flex items-center justify-center rounded-fluid-lg border-2 border-dashed border-primary-400">
                    <div className="text-center">
                      <Upload className="w-12 h-12 text-primary-500 mx-auto fluid-mb-2" />
                      <p className="fluid-text-sm font-medium text-primary-700">Soltar para reemplazar plantilla</p>
                    </div>
                  </div>
                )}

                {/* Uploading overlay */}
                {uploading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-30 flex items-center justify-center">
                    <div className="flex flex-col items-center fluid-gap-3">
                      <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
                      <p className="fluid-text-sm text-gray-600 font-medium">Procesando...</p>
                    </div>
                  </div>
                )}

                <div
                  className="relative inline-block shadow-xl rounded-sm"
                  style={{
                    width: template.pdf_width * scale,
                    height: template.pdf_height * scale,
                  }}
                >
                  <Document
                    file={template.template_blob_url}
                    onLoadSuccess={onPdfLoadSuccess}
                    onLoadError={() => {
                      setError('Error al cargar el PDF. Intente reemplazar la plantilla.');
                    }}
                    loading={
                      <div className="flex flex-col items-center justify-center h-full fluid-gap-2">
                        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                        <span className="fluid-text-xs text-gray-500">Cargando PDF...</span>
                      </div>
                    }
                  >
                    <Page
                      pageNumber={1}
                      width={template.pdf_width * scale}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>

                  {pdfLoaded && FIELDS.map((f) => renderOverlay(f))}
                </div>
              </div>
            </div>
          </div>

          {/* ─── Panel de propiedades ─── */}
          <div className="lg:w-80 xl:w-96 flex-shrink-0">
            <div className="bg-white shadow-sm rounded-fluid-xl overflow-hidden border border-gray-200 sticky top-4">
              {/* Panel header */}
              <div className="bg-gray-50 fluid-px-4 fluid-py-3 border-b">
                <h3 className="font-semibold fluid-text-sm text-gray-700">Propiedades de campos</h3>
              </div>

              {/* Tabs */}
              <div className="flex border-b bg-white">
                {FIELDS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => { setActivePanel(f.key); setSelected(f.key); }}
                    className={`flex-1 fluid-py-2.5 fluid-text-xs font-medium border-b-2 transition-all ${
                      activePanel === f.key
                        ? `${f.textClass} border-current bg-gray-50/50`
                        : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50/30'
                    }`}
                  >
                    <span className="flex items-center justify-center">{f.icon}</span>
                    <span className="block fluid-mt-0.5">{f.shortLabel}</span>
                  </button>
                ))}
              </div>

              {/* Active field props */}
              {activePanel && config[activePanel] && (
                <div className="p-4 space-y-4">
                  {/* Title */}
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: FIELD_MAP[activePanel].color }}
                    />
                    <p className={`font-semibold text-sm ${FIELD_MAP[activePanel].textClass}`}>
                      {FIELD_MAP[activePanel].label}
                    </p>
                  </div>

                  {/* Posición */}
                  <fieldset>
                    <legend className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      Posición
                    </legend>
                    <div className="grid grid-cols-2 gap-2">
                      <NumInput label="X (pts)" value={config[activePanel].x} onChange={(v) => updateFieldProp(activePanel, 'x', v)} />
                      <NumInput label="Y (pts)" value={config[activePanel].y} onChange={(v) => updateFieldProp(activePanel, 'y', v)} />
                    </div>
                  </fieldset>

                  {/* Tamaño - Texto */}
                  {activePanel !== 'qr_field' && (
                    <fieldset>
                      <legend className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Tamaño
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        <NumInput label="Ancho" value={(config[activePanel] as FieldConfig).width} onChange={(v) => updateFieldProp(activePanel, 'width', v)} />
                        <NumInput label="Alto" value={(config[activePanel] as FieldConfig).height} onChange={(v) => updateFieldProp(activePanel, 'height', v)} />
                      </div>
                    </fieldset>
                  )}

                  {/* Tipografía - Texto */}
                  {activePanel !== 'qr_field' && (
                    <fieldset>
                      <legend className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Tipografía
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        <NumInput
                          label="Tamaño máx."
                          value={(config[activePanel] as FieldConfig).maxFontSize ?? 36}
                          onChange={(v) => updateFieldProp(activePanel, 'maxFontSize', v)}
                          step={1}
                        />
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={(config[activePanel] as FieldConfig).color ?? '#1a365d'}
                              onChange={(e) => updateFieldProp(activePanel, 'color', e.target.value)}
                              className="w-8 h-8 rounded-lg border cursor-pointer p-0.5"
                            />
                            <span className="text-xs text-gray-500 font-mono">
                              {(config[activePanel] as FieldConfig).color ?? '#1a365d'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </fieldset>
                  )}

                  {/* QR props */}
                  {activePanel === 'qr_field' && (
                    <>
                      <fieldset>
                        <legend className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                          Tamaño
                        </legend>
                        <NumInput label="Tamaño (pts)" value={(config.qr_field as QrFieldConfig).size} onChange={(v) => updateFieldProp('qr_field', 'size', v)} />
                      </fieldset>

                      <fieldset>
                        <legend className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                          Apariencia
                        </legend>
                        <div className="flex gap-2 mb-3">
                          {(['white', 'transparent'] as const).map((bg) => (
                            <button
                              key={bg}
                              onClick={() => updateFieldProp('qr_field', 'background', bg)}
                              className={`flex-1 py-2 text-xs rounded-lg border font-medium transition-all ${
                                (config.qr_field as QrFieldConfig).background === bg
                                  ? 'bg-primary-50 border-primary-400 text-primary-700 shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {bg === 'white' ? 'Blanco' : 'Transparente'}
                            </button>
                          ))}
                        </div>
                        <div className="space-y-2.5">
                          <Checkbox
                            checked={(config.qr_field as QrFieldConfig).showCode ?? true}
                            onChange={(v) => updateFieldProp('qr_field', 'showCode', v)}
                            label="Mostrar código debajo"
                          />
                          <Checkbox
                            checked={(config.qr_field as QrFieldConfig).showText ?? true}
                            onChange={(v) => updateFieldProp('qr_field', 'showText', v)}
                            label='Mostrar "Escanea para verificar"'
                          />
                        </div>
                      </fieldset>
                    </>
                  )}
                </div>
              )}

              {/* Help */}
              <div className="border-t fluid-p-4 fluid-text-xs text-gray-400 space-y-1.5 bg-gray-50/50">
                <p className="font-medium text-gray-500 fluid-mb-1">Atajos</p>
                <p>&bull; Arrastre un campo para moverlo</p>
                <p>&bull; Use el punto de la esquina para redimensionar</p>
                <p>&bull; Edite valores exactos en el panel</p>
                <p>&bull; Coordenadas en puntos PDF (72 pts = 1 pulg)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal confirmar eliminación ─── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-xl shadow-2xl w-full max-w-md fluid-p-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto fluid-mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="fluid-text-lg font-semibold text-gray-900 text-center fluid-mb-2">
              Eliminar plantilla?
            </h3>
            <p className="fluid-text-sm text-gray-500 text-center fluid-mb-6">
              Los certificados ya generados no se veran afectados.
              Los nuevos certificados usaran la plantilla por defecto.
            </p>
            <div className="flex fluid-gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 fluid-px-4 fluid-py-2.5 border border-gray-300 text-gray-700 rounded-fluid-xl hover:bg-gray-50 font-medium fluid-text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-fluid-xl font-medium fluid-text-sm transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal cambios sin guardar ─── */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-xl shadow-2xl w-full max-w-md fluid-p-6">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto fluid-mb-4">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="fluid-text-lg font-semibold text-gray-900 text-center fluid-mb-2">
              Cambios sin guardar
            </h3>
            <p className="fluid-text-sm text-gray-500 text-center fluid-mb-6">
              {uploadedThisSession
                ? 'Tiene una plantilla subida sin guardar. Si sale, se eliminará del servidor.'
                : 'Tiene cambios de posición sin guardar. ¿Desea guardar antes de salir?'}
            </p>
            <div className="flex fluid-gap-3">
              <button
                onClick={handleConfirmLeave}
                className="flex-1 fluid-px-4 fluid-py-2.5 border border-gray-300 text-gray-700 rounded-fluid-xl hover:bg-gray-50 font-medium fluid-text-sm transition-colors"
              >
                Salir sin guardar
              </button>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 fluid-px-4 fluid-py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-fluid-xl font-medium fluid-text-sm transition-colors"
              >
                Seguir editando
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componentes auxiliares ──────────────────────────────────

function NumInput({
  label,
  value,
  onChange,
  step = 0.5,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        value={Math.round(value * 10) / 10}
        step={step}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all tabular-nums"
      />
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div className="w-4 h-4 border-2 border-gray-300 rounded transition-colors peer-checked:bg-primary-600 peer-checked:border-primary-600 group-hover:border-gray-400" />
        <svg
          className="absolute top-0.5 left-0.5 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <span className="text-xs text-gray-700">{label}</span>
    </label>
  );
}
