/**
 * Editor visual de plantilla de certificado por ECM.
 * Permite subir un PDF, arrastrar/redimensionar 3 zonas (nombre, certificado, QR)
 * y guardar la configuración de posiciones.
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
  CertificateTemplate,
  TemplateConfig,
  FieldConfig,
  QrFieldConfig,
} from '../../services/certificateTemplateService';

// Configurar worker de PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ────────────────────────────────────────────────────────────
//  Tipos auxiliares
// ────────────────────────────────────────────────────────────

type DragTarget = 'name_field' | 'cert_name_field' | 'qr_field' | null;
type ResizeEdge = 'right' | 'bottom' | 'corner' | null;

interface DragState {
  target: DragTarget;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

interface ResizeState {
  target: DragTarget;
  edge: ResizeEdge;
  startX: number;
  startY: number;
  origW: number;
  origH: number;
  origSize?: number;
}

const FIELD_LABELS: Record<string, string> = {
  name_field: 'Nombre del participante',
  cert_name_field: 'Nombre del certificado / ECM',
  qr_field: 'Código QR',
};

const FIELD_COLORS: Record<string, string> = {
  name_field: 'border-blue-500 bg-blue-500/15',
  cert_name_field: 'border-emerald-500 bg-emerald-500/15',
  qr_field: 'border-amber-500 bg-amber-500/15',
};

const FIELD_TEXT_COLORS: Record<string, string> = {
  name_field: 'text-blue-700',
  cert_name_field: 'text-emerald-700',
  qr_field: 'text-amber-700',
};

// ────────────────────────────────────────────────────────────
//  Componente principal
// ────────────────────────────────────────────────────────────

export default function CertificateTemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  const standardId = Number(id);

  // Estado principal
  const [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const [config, setConfig] = useState<TemplateConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // PDF rendering
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  // Arrastrar / redimensionar
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [selected, setSelected] = useState<DragTarget>(null);

  // Panel lateral
  const [activePanel, setActivePanel] = useState<DragTarget>('name_field');

  // ── Permisos ──
  const canEdit =
    user?.role === 'admin' ||
    user?.role === 'developer' ||
    user?.role === 'editor';

  // ── Cargar datos ──
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
        setPdfUrl(data.template.template_blob_url);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar plantilla');
    } finally {
      setLoading(false);
    }
  };

  // ── Subir PDF ──
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Solo se permiten archivos PDF');
      return;
    }
    try {
      setUploading(true);
      setError(null);
      const data = await uploadCertificateTemplate(standardId, file);
      setTemplate(data.template);
      setConfig(data.template.config);
      setPdfUrl(data.template.template_blob_url);
      setSuccess('Plantilla subida. Ajuste las posiciones de los campos.');
      setDirty(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al subir plantilla');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ── Guardar config ──
  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      setError(null);
      const data = await updateCertificateTemplate(standardId, config);
      setTemplate(data.template);
      setConfig(data.template.config);
      setDirty(false);
      setSuccess('Posiciones guardadas correctamente');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // ── Eliminar ──
  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteCertificateTemplate(standardId);
      setTemplate(null);
      setConfig(null);
      setPdfUrl(null);
      setPdfLoaded(false);
      setDirty(false);
      setShowDeleteConfirm(false);
      setSuccess('Plantilla eliminada');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  // ── Vista previa ──
  const handlePreview = () => {
    const baseURL =
      import.meta.env.VITE_API_URL ||
      (import.meta.env.MODE === 'production'
        ? 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api'
        : '/api');
    const url = `${baseURL}/competency-standards/${standardId}/certificate-template/preview`;
    window.open(`${url}?token=${accessToken}`, '_blank');
  };

  // ── PDF cargado → calcular escala ──
  const onPdfLoadSuccess = () => {
    setPdfLoaded(true);
    recalcScale();
  };

  const recalcScale = useCallback(() => {
    if (!template || !containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 32; // padding
    const s = Math.min(containerWidth / template.pdf_width, 1.2);
    setScale(s);
  }, [template]);

  useEffect(() => {
    window.addEventListener('resize', recalcScale);
    return () => window.removeEventListener('resize', recalcScale);
  }, [recalcScale]);

  // ── Drag & resize handlers ──
  const startDrag = (
    e: React.MouseEvent,
    target: DragTarget
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!config || !target) return;
    setSelected(target);
    setActivePanel(target);
    const field = config[target];
    setDragState({
      target,
      startX: e.clientX,
      startY: e.clientY,
      origX: field.x,
      origY: field.y,
    });
  };

  const startResize = (
    e: React.MouseEvent,
    target: DragTarget,
    edge: ResizeEdge
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!config || !target) return;
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
    const onMouseMove = (e: MouseEvent) => {
      if (!config || !template) return;

      if (dragState) {
        const dx = (e.clientX - dragState.startX) / scale;
        // Pantalla Y va hacia abajo, PDF Y va hacia arriba
        const dy = -(e.clientY - dragState.startY) / scale;
        const key = dragState.target!;
        const newX = Math.max(0, dragState.origX + dx);
        const newY = dragState.origY + dy;

        setConfig((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            [key]: { ...prev[key], x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 },
          };
        });
        setDirty(true);
      }

      if (resizeState) {
        const key = resizeState.target!;
        const dxPx = e.clientX - resizeState.startX;
        const dyPx = e.clientY - resizeState.startY;

        setConfig((prev) => {
          if (!prev) return prev;
          const field = { ...prev[key] };

          if (key === 'qr_field') {
            // QR: solo size (cuadrado)
            const dSize = (dxPx + dyPx) / 2 / scale;
            const qr = field as QrFieldConfig;
            const ns = Math.max(20, (resizeState.origSize ?? qr.size) + dSize);
            return { ...prev, [key]: { ...qr, size: Math.round(ns * 10) / 10 } };
          }

          const f = field as FieldConfig;
          if (resizeState.edge === 'right' || resizeState.edge === 'corner') {
            f.width = Math.max(40, resizeState.origW + dxPx / scale);
            f.width = Math.round(f.width * 10) / 10;
          }
          if (resizeState.edge === 'bottom' || resizeState.edge === 'corner') {
            f.height = Math.max(15, resizeState.origH + dyPx / scale);
            f.height = Math.round(f.height * 10) / 10;
          }
          return { ...prev, [key]: f };
        });
        setDirty(true);
      }
    };

    const onMouseUp = () => {
      setDragState(null);
      setResizeState(null);
    };

    if (dragState || resizeState) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragState, resizeState, config, template, scale]);

  // ── Ocultar mensajes ──
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // ── Render de un campo sobre el PDF ──
  const renderOverlay = (key: 'name_field' | 'cert_name_field' | 'qr_field') => {
    if (!config || !template) return null;
    const field = config[key];
    const isQr = key === 'qr_field';

    const w = isQr ? (field as QrFieldConfig).size : (field as FieldConfig).width;
    const h = isQr ? (field as QrFieldConfig).size : (field as FieldConfig).height;

    // Convertir coordenada PDF a pantalla
    // PDF origin: bottom-left. Screen origin: top-left.
    // La posición "y" en PDF es la base del texto; en pantalla queremos la esquina superior.
    const screenX = field.x * scale;
    const screenY = (template.pdf_height - field.y - h) * scale;
    const screenW = w * scale;
    const screenH = h * scale;

    const isSelected = selected === key;
    const borderWidth = isSelected ? 2 : 1.5;

    return (
      <div
        key={key}
        className={`absolute cursor-move border-2 border-dashed ${FIELD_COLORS[key]} ${
          isSelected ? 'ring-2 ring-offset-1 ring-blue-300 z-20' : 'z-10'
        }`}
        style={{
          left: screenX,
          top: screenY,
          width: screenW,
          height: screenH,
          borderWidth,
        }}
        onMouseDown={(e) => startDrag(e, key)}
        onClick={(e) => {
          e.stopPropagation();
          setSelected(key);
          setActivePanel(key);
        }}
      >
        {/* Label */}
        <span
          className={`absolute -top-5 left-0 fluid-text-xs font-semibold whitespace-nowrap ${FIELD_TEXT_COLORS[key]}`}
          style={{ fontSize: Math.max(9, 11 * scale) }}
        >
          {FIELD_LABELS[key]}
        </span>

        {/* QR icon */}
        {isQr && (
          <div className="w-full h-full flex items-center justify-center opacity-40">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-1/2 h-1/2 text-amber-600">
              <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm11-2h2v2h-2v-2zm-4 0h2v2h-2v-2zm0 4h2v2h-2v-2zm4 0h2v2h-2v-2zm2-4h2v2h-2v-2zm0 4h2v2h-2v-2zm2-2h2v2h-2v-2z" />
            </svg>
          </div>
        )}

        {/* Resize handles (only for selected) */}
        {isSelected && !isQr && (
          <>
            <div
              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-400/30"
              onMouseDown={(e) => startResize(e, key, 'right')}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-400/30"
              onMouseDown={(e) => startResize(e, key, 'bottom')}
            />
            <div
              className="absolute right-0 bottom-0 w-3 h-3 cursor-nwse-resize bg-blue-500/60 rounded-tl"
              onMouseDown={(e) => startResize(e, key, 'corner')}
            />
          </>
        )}

        {/* QR resize handle */}
        {isSelected && isQr && (
          <div
            className="absolute right-0 bottom-0 w-3 h-3 cursor-nwse-resize bg-amber-500/60 rounded-tl"
            onMouseDown={(e) => startResize(e, key, 'corner')}
          />
        )}
      </div>
    );
  };

  // ── Update numérico desde panel ──
  const updateFieldProp = (
    key: 'name_field' | 'cert_name_field' | 'qr_field',
    prop: string,
    value: number | string | boolean
  ) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: { ...prev[key], [prop]: value },
      };
    });
    setDirty(true);
  };

  // ──────────────────────────────────────────────────────────
  //  RENDER
  // ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto fluid-px-4 fluid-py-6">
      {/* ─── Header ─── */}
      <div className="fluid-mb-6">
        <button
          onClick={() => navigate(`/standards/${standardId}`)}
          className="inline-flex items-center fluid-text-sm text-gray-500 hover:text-gray-700 fluid-mb-3"
        >
          <svg className="fluid-mr-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver al ECM
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-3">
          <h1 className="fluid-text-2xl font-bold text-gray-900">
            Editor de Plantilla de Certificado
          </h1>

          <div className="flex flex-wrap items-center fluid-gap-2">
            {template && (
              <>
                <button
                  onClick={handlePreview}
                  className="inline-flex items-center fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-md fluid-text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <svg className="w-4 h-4 fluid-mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Vista previa
                </button>

                {canEdit && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center fluid-px-3 fluid-py-2 border border-red-300 rounded-fluid-md fluid-text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                  >
                    <svg className="w-4 h-4 fluid-mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Eliminar
                  </button>
                )}

                {canEdit && dirty && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center fluid-px-4 fluid-py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-fluid-md fluid-text-sm font-medium disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin fluid-mr-2" />
                        Guardando…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 fluid-mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Guardar posiciones
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Mensajes ─── */}
      {error && (
        <div className="fluid-mb-4 bg-red-50 border border-red-200 rounded-fluid-md fluid-p-3 flex items-center fluid-gap-2">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="fluid-text-sm text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {success && (
        <div className="fluid-mb-4 bg-green-50 border border-green-200 rounded-fluid-md fluid-p-3 flex items-center fluid-gap-2">
          <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="fluid-text-sm text-green-700">{success}</span>
        </div>
      )}

      {/* ─── Sin plantilla: subir PDF ─── */}
      {!template && (
        <div className="bg-white shadow rounded-fluid-lg fluid-p-8 text-center">
          <svg className="mx-auto w-16 h-16 text-gray-300 fluid-mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="fluid-text-lg font-semibold text-gray-700 fluid-mb-2">
            No hay plantilla configurada
          </h2>
          <p className="fluid-text-sm text-gray-500 fluid-mb-6 max-w-md mx-auto">
            Suba un archivo PDF que servirá como fondo del certificado.
            Después podrá arrastrar las áreas de texto y QR sobre la plantilla.
          </p>
          {canEdit && (
            <label className="inline-flex items-center fluid-px-5 fluid-py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-fluid-lg fluid-text-sm font-medium cursor-pointer disabled:opacity-50">
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin fluid-mr-2" />
                  Subiendo…
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Subir plantilla PDF
                </>
              )}
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          )}
        </div>
      )}

      {/* ─── Editor visual ─── */}
      {template && config && (
        <div className="flex flex-col lg:flex-row fluid-gap-6">
          {/* ── Canvas del PDF ── */}
          <div className="flex-1 min-w-0" ref={containerRef}>
            <div className="bg-white shadow rounded-fluid-lg overflow-hidden">
              <div className="bg-gray-100 fluid-px-4 fluid-py-2 border-b flex items-center justify-between">
                <span className="fluid-text-xs text-gray-500">
                  PDF {template.pdf_width.toFixed(0)} × {template.pdf_height.toFixed(0)} pts
                  &nbsp;|&nbsp; Escala: {(scale * 100).toFixed(0)}%
                </span>
                <div className="flex items-center fluid-gap-2">
                  <button
                    onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
                    className="w-7 h-7 flex items-center justify-center rounded border text-gray-600 hover:bg-gray-200 fluid-text-sm"
                  >
                    −
                  </button>
                  <button
                    onClick={() => setScale((s) => Math.min(2, s + 0.1))}
                    className="w-7 h-7 flex items-center justify-center rounded border text-gray-600 hover:bg-gray-200 fluid-text-sm"
                  >
                    +
                  </button>
                </div>
              </div>
              <div
                className="relative overflow-auto bg-gray-200 fluid-p-4"
                style={{ maxHeight: '80vh' }}
                onClick={() => setSelected(null)}
              >
                <div
                  ref={canvasWrapRef}
                  className="relative inline-block shadow-lg"
                  style={{
                    width: template.pdf_width * scale,
                    height: template.pdf_height * scale,
                  }}
                >
                  {/* PDF renderizado */}
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={onPdfLoadSuccess}
                    loading={
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
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

                  {/* Overlays arrastrables */}
                  {pdfLoaded && (
                    <>
                      {renderOverlay('name_field')}
                      {renderOverlay('cert_name_field')}
                      {renderOverlay('qr_field')}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Panel de propiedades ── */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white shadow rounded-fluid-lg overflow-hidden sticky top-4">
              <div className="bg-gray-50 fluid-px-4 fluid-py-3 border-b">
                <h3 className="font-semibold fluid-text-sm text-gray-700">
                  Propiedades de campos
                </h3>
              </div>

              {/* Tabs */}
              <div className="flex border-b">
                {(['name_field', 'cert_name_field', 'qr_field'] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setActivePanel(key);
                      setSelected(key);
                    }}
                    className={`flex-1 fluid-py-2 fluid-text-xs font-medium border-b-2 transition-colors ${
                      activePanel === key
                        ? `${FIELD_TEXT_COLORS[key]} border-current`
                        : 'text-gray-400 border-transparent hover:text-gray-600'
                    }`}
                  >
                    {key === 'name_field' && 'Nombre'}
                    {key === 'cert_name_field' && 'Cert.'}
                    {key === 'qr_field' && 'QR'}
                  </button>
                ))}
              </div>

              {/* Props del campo activo */}
              {activePanel && config[activePanel] && (
                <div className="fluid-p-4 space-y-3">
                  <p className={`font-semibold fluid-text-sm ${FIELD_TEXT_COLORS[activePanel]}`}>
                    {FIELD_LABELS[activePanel]}
                  </p>

                  {/* Posición */}
                  <div className="grid grid-cols-2 fluid-gap-2">
                    <NumericInput
                      label="X (pts)"
                      value={config[activePanel].x}
                      onChange={(v) => updateFieldProp(activePanel, 'x', v)}
                    />
                    <NumericInput
                      label="Y (pts)"
                      value={config[activePanel].y}
                      onChange={(v) => updateFieldProp(activePanel, 'y', v)}
                    />
                  </div>

                  {/* Tamaño - texto */}
                  {activePanel !== 'qr_field' && (
                    <div className="grid grid-cols-2 fluid-gap-2">
                      <NumericInput
                        label="Ancho"
                        value={(config[activePanel] as FieldConfig).width}
                        onChange={(v) => updateFieldProp(activePanel, 'width', v)}
                      />
                      <NumericInput
                        label="Alto"
                        value={(config[activePanel] as FieldConfig).height}
                        onChange={(v) => updateFieldProp(activePanel, 'height', v)}
                      />
                    </div>
                  )}

                  {/* Font size - texto */}
                  {activePanel !== 'qr_field' && (
                    <div className="grid grid-cols-2 fluid-gap-2">
                      <NumericInput
                        label="Font máx."
                        value={(config[activePanel] as FieldConfig).maxFontSize ?? 36}
                        onChange={(v) => updateFieldProp(activePanel, 'maxFontSize', v)}
                        step={1}
                      />
                      <div>
                        <label className="block fluid-text-xs text-gray-500 fluid-mb-1">Color</label>
                        <input
                          type="color"
                          value={(config[activePanel] as FieldConfig).color ?? '#1a365d'}
                          onChange={(e) => updateFieldProp(activePanel, 'color', e.target.value)}
                          className="w-full h-8 rounded border cursor-pointer"
                        />
                      </div>
                    </div>
                  )}

                  {/* QR props */}
                  {activePanel === 'qr_field' && (
                    <>
                      <NumericInput
                        label="Tamaño (pts)"
                        value={(config.qr_field as QrFieldConfig).size}
                        onChange={(v) => updateFieldProp('qr_field', 'size', v)}
                      />
                      <div>
                        <label className="block fluid-text-xs text-gray-500 fluid-mb-1">
                          Fondo del QR
                        </label>
                        <div className="flex fluid-gap-2">
                          {(['white', 'transparent'] as const).map((bg) => (
                            <button
                              key={bg}
                              onClick={() => updateFieldProp('qr_field', 'background', bg)}
                              className={`flex-1 fluid-py-2 fluid-text-xs rounded-fluid-md border font-medium transition-colors ${
                                (config.qr_field as QrFieldConfig).background === bg
                                  ? 'bg-primary-50 border-primary-500 text-primary-700'
                                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {bg === 'white' ? '⬜ Blanco' : '🔲 Transparente'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center fluid-gap-2 fluid-text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={(config.qr_field as QrFieldConfig).showCode ?? true}
                            onChange={(e) =>
                              updateFieldProp('qr_field', 'showCode', e.target.checked)
                            }
                            className="rounded border-gray-300"
                          />
                          Mostrar código debajo
                        </label>
                        <label className="flex items-center fluid-gap-2 fluid-text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={(config.qr_field as QrFieldConfig).showText ?? true}
                            onChange={(e) =>
                              updateFieldProp('qr_field', 'showText', e.target.checked)
                            }
                            className="rounded border-gray-300"
                          />
                          Mostrar "Escanea para verificar"
                        </label>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Leyenda */}
              <div className="border-t fluid-p-4 fluid-text-xs text-gray-400 space-y-1">
                <p>• Arrastre los campos sobre el PDF</p>
                <p>• Use las esquinas para redimensionar</p>
                <p>• Coordenadas en puntos PDF (72 pts = 1 pulg)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal confirmar eliminación ─── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-xl shadow-xl w-full max-w-md fluid-p-6">
            <h3 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-2">
              Eliminar plantilla
            </h3>
            <p className="fluid-text-sm text-gray-600 fluid-mb-6">
              ¿Está seguro? Los certificados ya generados no se verán afectados, pero los
              nuevos usarán la plantilla por defecto.
            </p>
            <div className="flex justify-end fluid-gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="fluid-px-4 fluid-py-2 border border-gray-300 text-gray-700 rounded-fluid-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-red-600 hover:bg-red-700 text-white rounded-fluid-lg font-medium disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Eliminando…
                  </>
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Componente auxiliar: Input numérico compacto
// ────────────────────────────────────────────────────────────

function NumericInput({
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
      <label className="block fluid-text-xs text-gray-500 fluid-mb-1">{label}</label>
      <input
        type="number"
        value={Math.round(value * 10) / 10}
        step={step}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        className="w-full fluid-px-2 fluid-py-1.5 border border-gray-300 rounded fluid-text-sm text-gray-800 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>
  );
}
