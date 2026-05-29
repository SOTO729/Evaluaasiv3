/**
 * Modal para mostrar la "Ficha informativa" (PDF) de una certificación.
 * - Renderiza una página a la vez con react-pdf.
 * - Navegación con botones Anterior/Siguiente + atajos de teclado.
 * - Indicador de página y opción de descargar.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { X, ChevronLeft, ChevronRight, Download, Loader2, AlertCircle } from 'lucide-react'

// Worker local de pdfjs-dist (mismo patrón que CertificateTemplateEditorPage)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface Props {
  open: boolean
  pdfUrl: string | null | undefined
  title?: string
  onClose: () => void
}

export default function InfoSheetModal({ open, pdfUrl, title, onClose }: Props) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNum, setPageNum] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [pageOrig, setPageOrig] = useState<{ w: number; h: number } | null>(null)
  const [viewport, setViewport] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  })

  useEffect(() => {
    if (open) {
      setPageNum(1)
      setLoading(true)
      setError(null)
      setPageOrig(null)
    }
  }, [open, pdfUrl])

  // Reset original-page-size cuando cambia de página para recalcular fit.
  useEffect(() => {
    setPageOrig(null)
  }, [pageNum])

  // Observa el tamaño de la ventana para dimensionar el modal completo.
  useEffect(() => {
    if (!open) return
    const onR = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    onR()
    window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [open])

  const goPrev = useCallback(() => setPageNum(p => Math.max(1, p - 1)), [])
  const goNext = useCallback(() => setPageNum(p => Math.min(numPages || p, p + 1)), [numPages])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, goPrev, goNext])

  if (!open) return null

  // Cálculo de dimensiones: el MODAL completo se ajusta al aspecto de la
  // página actual del PDF, sin exceder el viewport y sin requerir scroll.
  const OUTER_MARGIN = 32 // p-4 del overlay (16px * 2)
  const CHROME_H = 116 // header (~56) + footer (~60)
  const BODY_PAD = 24 // p-3 del body (12px * 2)

  const maxModalW = Math.max(320, viewport.w - OUTER_MARGIN)
  const maxModalH = Math.max(320, viewport.h - OUTER_MARGIN)
  const maxBodyW = maxModalW - 0 // body ocupa todo el ancho del modal
  const maxBodyH = Math.max(160, maxModalH - CHROME_H)
  const maxPageW = maxBodyW - BODY_PAD
  const maxPageH = maxBodyH - BODY_PAD

  let pageW = maxPageW
  let pageH = maxPageH
  if (pageOrig && pageOrig.h > 0 && pageOrig.w > 0) {
    const aspect = pageOrig.w / pageOrig.h
    // Ajusta primero a la altura disponible.
    let w = maxPageH * aspect
    let h = maxPageH
    if (w > maxPageW) {
      // Si no cabe a lo ancho, ajusta al ancho disponible.
      w = maxPageW
      h = maxPageW / aspect
    }
    pageW = Math.max(120, w)
    pageH = Math.max(120, h)
  }

  // Mientras se mide el body real para el render del Page, usamos el cálculo
  // anterior basado en pageOrig + viewport.
  const renderWidth = pageW

  const modalWidth = Math.round(pageW + BODY_PAD)
  const modalHeight = Math.round(pageH + BODY_PAD + CHROME_H)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden transition-[width,height] duration-200"
        style={{ width: modalWidth, height: modalHeight, maxWidth: '95vw', maxHeight: '95vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {title || 'Ficha informativa'}
            </h3>
            {numPages > 0 && (
              <p className="text-xs text-gray-500">
                Página {pageNum} de {numPages}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 rounded-lg"
                title="Descargar PDF"
              >
                <Download size={16} /> Descargar
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          ref={bodyRef}
          className="flex-1 min-h-0 overflow-hidden bg-gray-100 flex items-center justify-center p-3"
        >
          {!pdfUrl ? (
            <div className="text-gray-500 py-20 text-center">
              <AlertCircle className="mx-auto mb-2" />
              No hay ficha informativa disponible.
            </div>
          ) : (
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages: n }) => {
                setNumPages(n)
                setLoading(false)
                setError(null)
              }}
              onLoadError={(e) => {
                setError(e?.message || 'No se pudo cargar el PDF')
                setLoading(false)
              }}
              loading={
                <div className="text-gray-500 py-20 flex flex-col items-center">
                  <Loader2 className="animate-spin mb-2" />
                  Cargando ficha...
                </div>
              }
              error={
                <div className="text-red-600 py-20 text-center">
                  <AlertCircle className="mx-auto mb-2" />
                  {error || 'No se pudo cargar el PDF'}
                </div>
              }
            >
              {!loading && !error && (
                <Page
                  pageNumber={pageNum}
                  width={renderWidth}
                  onLoadSuccess={(p: any) => {
                    // p.originalWidth / originalHeight vienen en puntos PDF.
                    if (p && p.originalWidth && p.originalHeight) {
                      setPageOrig({ w: p.originalWidth, h: p.originalHeight })
                    }
                  }}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  className="shadow-lg"
                />
              )}
            </Document>
          )}
        </div>

        {/* Footer / navegación */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-white">
          <button
            onClick={goPrev}
            disabled={pageNum <= 1}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft size={18} /> Anterior
          </button>
          <span className="text-sm text-gray-600">
            {numPages > 0 ? `${pageNum} / ${numPages}` : '—'}
          </span>
          <button
            onClick={goNext}
            disabled={numPages > 0 && pageNum >= numPages}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700"
          >
            Siguiente <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
