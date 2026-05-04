import { useRef, useState } from 'react';
import { uploadScormPackage, ScormPackage } from '../../services/scormService';

interface Props {
  onUploaded: (pkg: ScormPackage) => void;
  onCancel?: () => void;
  defaultTitle?: string;
  className?: string;
}

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export default function ScormUploader({ onUploaded, onCancel, defaultTitle = '', className = '' }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (f: File | null) => {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!/\.zip$/i.test(f.name)) {
      setError('Solo se aceptan archivos .zip');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(`El archivo supera 2 GB (${(f.size / 1024 / 1024 / 1024).toFixed(2)} GB)`);
      return;
    }
    setFile(f);
    if (!title) {
      setTitle(f.name.replace(/\.zip$/i, ''));
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setError(null);
    setProgress(0);
    setPhase('uploading');
    try {
      const pkg = await uploadScormPackage(
        file,
        { title: title || undefined, description: description || undefined },
        (pct) => {
          setProgress(pct);
          if (pct >= 100) setPhase('processing');
        },
      );
      setPhase('done');
      onUploaded(pkg);
    } catch (e: unknown) {
      setPhase('error');
      const msg = (e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        || (e as { message?: string })?.message
        || 'Error desconocido al subir';
      setError(String(msg));
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0] ?? null;
    handleSelect(f);
  };

  const isBusy = phase === 'uploading' || phase === 'processing';

  return (
    <div className={`space-y-4 ${className}`}>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition cursor-pointer"
        onClick={() => !isBusy && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="hidden"
          onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
          disabled={isBusy}
        />
        {file ? (
          <div className="text-sm text-gray-700">
            <div className="font-medium">{file.name}</div>
            <div className="text-xs text-gray-500">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </div>
          </div>
        ) : (
          <div className="text-gray-500">
            <p className="font-medium">Arrastra el .zip SCORM aquí</p>
            <p className="text-xs">o haz clic para seleccionar (máx. 2 GB)</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título del paquete"
          disabled={isBusy}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción (opcional)"
          disabled={isBusy}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>

      {phase === 'uploading' && (
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Subiendo al storage…</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {phase === 'processing' && (
        <div className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded">
          Procesando paquete (extrayendo y validando manifest)…
        </div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded">{error}</div>
      )}

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || isBusy}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {phase === 'uploading' ? 'Subiendo…' : phase === 'processing' ? 'Procesando…' : 'Subir paquete'}
        </button>
      </div>
    </div>
  );
}
