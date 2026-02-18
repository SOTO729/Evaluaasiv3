/**
 * Página de Carga Masiva de Certificados CONOCER
 *
 * Permite subir un ZIP con PDFs de certificados CONOCER.
 * Muestra progreso del upload y del procesamiento en segundo plano.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  FileArchive,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  SkipForward,
  Replace,
  FileText,
  X,
} from 'lucide-react';
import {
  uploadConocerBatch,
  getConocerUploadBatchDetail,
  ConocerUploadBatch,
} from '../../services/partnersService';

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

export default function ConocerUploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [batch, setBatch] = useState<ConocerUploadBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Polling del estado del batch
  const pollBatchStatus = useCallback(async (id: number) => {
    try {
      const data = await getConocerUploadBatchDetail(id);
      setBatch(data.batch);
      if (data.batch.status === 'completed') {
        setPhase('completed');
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      } else if (data.batch.status === 'failed') {
        setPhase('failed');
        setError(data.batch.error_message || 'El procesamiento falló');
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      }
    } catch {
      // Silently retry
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
      setError('Solo se aceptan archivos ZIP');
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    setPhase('uploading');
    setUploadProgress(0);
    setError(null);

    try {
      const result = await uploadConocerBatch(file, (pct) => setUploadProgress(pct));
      setBatchId(result.batch_id);
      setPhase('processing');
      // Iniciar polling
      pollBatchStatus(result.batch_id);
      pollIntervalRef.current = setInterval(() => pollBatchStatus(result.batch_id), 3000);
    } catch (err: any) {
      setPhase('failed');
      setError(err.response?.data?.error || 'Error al subir el archivo');
    }
  };

  const handleReset = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setPhase('idle');
    setFile(null);
    setUploadProgress(0);
    setBatchId(null);
    setBatch(null);
    setError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const progressPct = batch
    ? batch.total_files > 0
      ? Math.round((batch.processed_files / batch.total_files) * 100)
      : 0
    : 0;

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="fluid-mb-6">
        <Link
          to="/tramites-conocer"
          className="inline-flex items-center fluid-gap-2 text-gray-500 hover:text-gray-700 fluid-text-sm fluid-mb-4 transition-colors"
        >
          <ArrowLeft className="fluid-icon-sm" />
          Volver a Trámites CONOCER
        </Link>
        <h1 className="fluid-text-2xl font-bold text-gray-900 fluid-mb-1">
          Cargar Certificados CONOCER
        </h1>
        <p className="text-gray-500 fluid-text-sm">
          Sube un archivo ZIP con los PDFs de certificados CONOCER. El sistema
          extraerá automáticamente la CURP y el ECM de cada certificado para
          vincularlos con los candidatos correspondientes.
        </p>
      </div>

      {/* Upload Zone */}
      {phase === 'idle' && (
        <div className="animate-fade-in">
          {/* Drag & Drop Area */}
          <div
            className={`
              border-2 border-dashed rounded-fluid-xl fluid-p-10 text-center
              transition-all duration-200 cursor-pointer
              ${dragOver
                ? 'border-emerald-500 bg-emerald-50'
                : file
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
              }
            `}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />

            {file ? (
              <div className="flex flex-col items-center fluid-gap-3">
                <div className="fluid-icon-2xl rounded-fluid-xl bg-emerald-100 flex items-center justify-center">
                  <FileArchive className="fluid-icon-lg text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 fluid-text-base">{file.name}</p>
                  <p className="text-gray-500 fluid-text-sm">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="fluid-icon-sm" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center fluid-gap-3">
                <div className="fluid-icon-2xl rounded-fluid-xl bg-gray-200 flex items-center justify-center">
                  <Upload className="fluid-icon-lg text-gray-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-700 fluid-text-base">
                    Arrastra un archivo ZIP aquí
                  </p>
                  <p className="text-gray-500 fluid-text-sm">
                    o haz clic para seleccionarlo
                  </p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="fluid-mt-4 bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-3 flex items-center fluid-gap-2">
              <XCircle className="fluid-icon-sm text-red-500 flex-shrink-0" />
              <p className="text-red-700 fluid-text-sm">{error}</p>
            </div>
          )}

          {/* Upload button */}
          {file && (
            <div className="fluid-mt-6 flex justify-center">
              <button
                onClick={handleUpload}
                className="inline-flex items-center fluid-gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold fluid-px-6 fluid-py-3 rounded-fluid-lg transition-colors shadow-sm"
              >
                <Upload className="fluid-icon-sm" />
                Iniciar Procesamiento
              </button>
            </div>
          )}

          {/* Info Cards */}
          <div className="fluid-mt-8 grid grid-cols-1 sm:grid-cols-3 fluid-gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-fluid-lg fluid-p-4">
              <FileText className="fluid-icon-sm text-blue-500 fluid-mb-2" />
              <p className="font-semibold text-blue-900 fluid-text-sm">PDFs de certificados</p>
              <p className="text-blue-700 fluid-text-xs fluid-mt-1">
                El ZIP debe contener los PDFs originales emitidos por CONOCER
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-fluid-lg fluid-p-4">
              <AlertTriangle className="fluid-icon-sm text-amber-500 fluid-mb-2" />
              <p className="font-semibold text-amber-900 fluid-text-sm">Se extraen datos automáticamente</p>
              <p className="text-amber-700 fluid-text-xs fluid-mt-1">
                Se lee la CURP y el código ECM de cada PDF para hacer el match
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-fluid-lg fluid-p-4">
              <CheckCircle2 className="fluid-icon-sm text-emerald-500 fluid-mb-2" />
              <p className="font-semibold text-emerald-900 fluid-text-sm">Procesamiento en segundo plano</p>
              <p className="text-emerald-700 fluid-text-xs fluid-mt-1">
                Puedes cerrar la página y revisar el avance después
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Uploading Phase */}
      {phase === 'uploading' && (
        <div className="animate-fade-in bg-white border border-gray-200 rounded-fluid-xl fluid-p-8 text-center">
          <Loader2 className="fluid-icon-xl text-emerald-500 animate-spin mx-auto fluid-mb-4" />
          <h2 className="font-bold text-gray-900 fluid-text-lg fluid-mb-2">Subiendo archivo...</h2>
          <p className="text-gray-500 fluid-text-sm fluid-mb-6">{file?.name}</p>
          <div className="max-w-md mx-auto">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-gray-600 fluid-text-sm fluid-mt-2 font-medium">{uploadProgress}%</p>
          </div>
        </div>
      )}

      {/* Processing Phase */}
      {phase === 'processing' && batch && (
        <div className="animate-fade-in">
          <div className="bg-white border border-gray-200 rounded-fluid-xl fluid-p-6 fluid-mb-6">
            <div className="flex items-center fluid-gap-3 fluid-mb-4">
              <Loader2 className="fluid-icon-md text-emerald-500 animate-spin" />
              <div>
                <h2 className="font-bold text-gray-900 fluid-text-lg">Procesando certificados...</h2>
                <p className="text-gray-500 fluid-text-sm">
                  {batch.processed_files} de {batch.total_files} archivos procesados
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 fluid-mb-2">
              <div
                className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-gray-500 fluid-text-xs text-right">{progressPct}%</p>
          </div>

          {/* Live counters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 fluid-gap-3">
            <CounterCard icon={<CheckCircle2 className="fluid-icon-sm" />} label="Nuevos" value={batch.matched_files} color="emerald" />
            <CounterCard icon={<Replace className="fluid-icon-sm" />} label="Reemplazados" value={batch.replaced_files} color="blue" />
            <CounterCard icon={<SkipForward className="fluid-icon-sm" />} label="Omitidos" value={batch.skipped_files} color="gray" />
            <CounterCard icon={<XCircle className="fluid-icon-sm" />} label="Descartados" value={batch.discarded_files} color="amber" />
            <CounterCard icon={<AlertTriangle className="fluid-icon-sm" />} label="Errores" value={batch.error_files} color="red" />
          </div>
        </div>
      )}

      {/* Completed Phase */}
      {phase === 'completed' && batch && (
        <div className="animate-fade-in">
          <div className="bg-emerald-50 border border-emerald-200 rounded-fluid-xl fluid-p-6 fluid-mb-6 text-center">
            <CheckCircle2 className="fluid-icon-xl text-emerald-500 mx-auto fluid-mb-3" />
            <h2 className="font-bold text-gray-900 fluid-text-lg fluid-mb-1">¡Procesamiento completado!</h2>
            <p className="text-gray-600 fluid-text-sm">
              Se procesaron {batch.total_files} archivos en total
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 fluid-gap-3 fluid-mb-6">
            <CounterCard icon={<CheckCircle2 className="fluid-icon-sm" />} label="Nuevos" value={batch.matched_files} color="emerald" />
            <CounterCard icon={<Replace className="fluid-icon-sm" />} label="Reemplazados" value={batch.replaced_files} color="blue" />
            <CounterCard icon={<SkipForward className="fluid-icon-sm" />} label="Omitidos" value={batch.skipped_files} color="gray" />
            <CounterCard icon={<XCircle className="fluid-icon-sm" />} label="Descartados" value={batch.discarded_files} color="amber" />
            <CounterCard icon={<AlertTriangle className="fluid-icon-sm" />} label="Errores" value={batch.error_files} color="red" />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center fluid-gap-3">
            <button
              onClick={() => navigate(`/tramites-conocer/historial/${batchId}`)}
              className="inline-flex items-center fluid-gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold fluid-px-5 fluid-py-2.5 rounded-fluid-lg transition-colors"
            >
              <FileText className="fluid-icon-sm" />
              Ver Detalle
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center fluid-gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold fluid-px-5 fluid-py-2.5 rounded-fluid-lg transition-colors"
            >
              <Upload className="fluid-icon-sm" />
              Subir otro ZIP
            </button>
          </div>
        </div>
      )}

      {/* Failed Phase */}
      {phase === 'failed' && (
        <div className="animate-fade-in">
          <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-6 text-center fluid-mb-6">
            <XCircle className="fluid-icon-xl text-red-500 mx-auto fluid-mb-3" />
            <h2 className="font-bold text-gray-900 fluid-text-lg fluid-mb-1">Error en el procesamiento</h2>
            <p className="text-red-600 fluid-text-sm">{error || 'Ocurrió un error inesperado'}</p>
          </div>

          {batch && (
            <div className="grid grid-cols-2 sm:grid-cols-5 fluid-gap-3 fluid-mb-6">
              <CounterCard icon={<CheckCircle2 className="fluid-icon-sm" />} label="Nuevos" value={batch.matched_files} color="emerald" />
              <CounterCard icon={<Replace className="fluid-icon-sm" />} label="Reemplazados" value={batch.replaced_files} color="blue" />
              <CounterCard icon={<SkipForward className="fluid-icon-sm" />} label="Omitidos" value={batch.skipped_files} color="gray" />
              <CounterCard icon={<XCircle className="fluid-icon-sm" />} label="Descartados" value={batch.discarded_files} color="amber" />
              <CounterCard icon={<AlertTriangle className="fluid-icon-sm" />} label="Errores" value={batch.error_files} color="red" />
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center fluid-gap-3">
            {batchId && (
              <button
                onClick={() => navigate(`/tramites-conocer/historial/${batchId}`)}
                className="inline-flex items-center fluid-gap-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold fluid-px-5 fluid-py-2.5 rounded-fluid-lg transition-colors"
              >
                <FileText className="fluid-icon-sm" />
                Ver Detalle
              </button>
            )}
            <button
              onClick={handleReset}
              className="inline-flex items-center fluid-gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold fluid-px-5 fluid-py-2.5 rounded-fluid-lg transition-colors"
            >
              <RefreshCw className="fluid-icon-sm" />
              Intentar de nuevo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Counter Card component
function CounterCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode; label: string; value: number;
  color: 'emerald' | 'blue' | 'gray' | 'amber' | 'red';
}) {
  const styles: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-600',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  const numStyles: Record<string, string> = {
    emerald: 'text-emerald-900',
    blue: 'text-blue-900',
    gray: 'text-gray-900',
    amber: 'text-amber-900',
    red: 'text-red-900',
  };

  return (
    <div className={`border rounded-fluid-lg fluid-p-3 ${styles[color]}`}>
      <div className="flex items-center fluid-gap-2 fluid-mb-1">
        {icon}
        <span className="fluid-text-xs font-medium">{label}</span>
      </div>
      <p className={`fluid-text-xl font-bold ${numStyles[color]}`}>{value || 0}</p>
    </div>
  );
}
