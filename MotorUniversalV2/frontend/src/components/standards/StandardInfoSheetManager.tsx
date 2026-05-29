/**
 * Modal para gestionar la ficha informativa (PDF "Conoce más") de un Estándar.
 * Permite vista previa página-a-página, subir / reemplazar y eliminar.
 */
import { useRef, useState } from 'react'
import { X, Upload, Trash2, FileText, Download } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import {
  uploadStandardInfoSheet,
  deleteStandardInfoSheet,
  CompetencyStandard,
} from '../../services/standardsService'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface Props {
  standard: CompetencyStandard
  onClose: () => void
  onUpdated: (updated: CompetencyStandard) => void
}

export default function StandardInfoSheetManager({ standard, onClose, onUpdated }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSelectFile = () => fileRef.current?.click()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Solo se permiten archivos PDF')
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('El PDF no debe superar 20 MB')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await uploadStandardInfoSheet(standard.id, f)
      onUpdated(res.standard)
      setPageNumber(1)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al subir el PDF')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    if (!standard.info_sheet_url) return
    if (!confirm('¿Eliminar la ficha informativa de este estándar?')) return
    setBusy(true)
    setError(null)
    try {
      const res = await deleteStandardInfoSheet(standard.id)
      onUpdated(res.standard)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al eliminar la ficha')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Ficha informativa · {standard.code}
            </h3>
            <p className="text-sm text-gray-500 line-clamp-1">{standard.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800">
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b bg-gray-50">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={handleSelectFile}
            disabled={busy}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Upload size={16} />
            {standard.info_sheet_url ? 'Reemplazar PDF' : 'Subir PDF'}
          </button>
          {standard.info_sheet_url && (
            <>
              <a
                href={standard.info_sheet_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <Download size={16} /> Descargar
              </a>
              <button
                onClick={handleDelete}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={16} /> Eliminar
              </button>
            </>
          )}
          {numPages > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
                className="px-3 py-1 text-sm border rounded disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página {pageNumber} de {numPages}
              </span>
              <button
                onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                disabled={pageNumber >= numPages}
                className="px-3 py-1 text-sm border rounded disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-4">
          {error && (
            <div className="self-start w-full mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {error}
            </div>
          )}
          {!standard.info_sheet_url ? (
            <div className="text-center text-gray-500 py-16">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-sm">Este estándar aún no tiene ficha informativa.</p>
              <p className="text-xs mt-1">Sube un PDF (máx 20 MB) para que los candidatos puedan consultarlo desde el catálogo.</p>
            </div>
          ) : (
            <Document
              file={standard.info_sheet_url}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={<div className="py-10 text-sm text-gray-500">Cargando PDF...</div>}
              error={<div className="py-10 text-sm text-red-600">No se pudo cargar el PDF</div>}
            >
              <Page
                pageNumber={pageNumber}
                width={Math.min(900, Math.max(320, window.innerWidth - 120))}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          )}
        </div>
      </div>
    </div>
  )
}
