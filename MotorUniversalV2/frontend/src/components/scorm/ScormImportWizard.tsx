import { useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, Package, Layers, FileText, AlertCircle, Loader2 } from 'lucide-react';
import {
  initScormUpload,
  uploadScormToBlob,
  extractScormForImport,
  type ScormManifestNode,
  type ScormImportPreview,
} from '../../services/scormService';
import { createMaterialFromScorm } from '../../services/studyContentService';

interface Props {
  /** Llamado cuando el material se creó OK; recibe el id del material. */
  onCreated: (materialId: number) => void;
}

type Phase = 'upload' | 'uploading' | 'extracting' | 'preview' | 'submitting' | 'error';

const MAX_BYTES = 2 * 1024 * 1024 * 1024;

// Clona el árbol y le añade un id estable a cada nodo
let _nodeSeq = 0;
type EditableNode = Omit<ScormManifestNode, 'children'> & { _id: string; children?: EditableNode[] };
function decorate(tree: ScormManifestNode[]): EditableNode[] {
  return tree.map((n) => ({
    ...n,
    _id: `n${++_nodeSeq}`,
    children: n.children ? decorate(n.children) : undefined,
  }));
}
function stripIds(tree: EditableNode[]): ScormManifestNode[] {
  return tree.map((n) => ({
    title: n.title,
    type: n.type,
    entry_point: n.entry_point,
    children: n.children && n.children.length ? stripIds(n.children) : undefined,
  }));
}

function deleteById(tree: EditableNode[], id: string): EditableNode[] {
  return tree
    .filter((n) => n._id !== id)
    .map((n) => ({ ...n, children: n.children ? deleteById(n.children, id) : undefined }));
}
function renameById(tree: EditableNode[], id: string, newTitle: string): EditableNode[] {
  return tree.map((n) => {
    if (n._id === id) return { ...n, title: newTitle };
    return { ...n, children: n.children ? renameById(n.children, id, newTitle) : undefined };
  });
}

function countLeaves(tree: ScormManifestNode[]): number {
  let n = 0;
  for (const node of tree) {
    if (!node.children || node.children.length === 0) n += node.entry_point ? 1 : 0;
    else n += countLeaves(node.children);
  }
  return n;
}

interface TreeNodeProps {
  node: EditableNode;
  depth: number;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

function TreeNode({ node, depth, onRename, onDelete }: TreeNodeProps) {
  const [open, setOpen] = useState(true);
  const hasChildren = !!(node.children && node.children.length);
  const icon =
    node.type === 'sco' ? <FileText className="w-4 h-4 text-emerald-600" /> :
    node.type === 'asset' ? <Package className="w-4 h-4 text-gray-500" /> :
    <Layers className="w-4 h-4 text-blue-600" />;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded group"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-gray-500 hover:text-gray-700">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        {icon}
        <input
          type="text"
          value={node.title}
          onChange={(e) => onRename(node._id, e.target.value)}
          className="flex-1 px-2 py-1 text-sm border border-transparent hover:border-gray-200 focus:border-blue-400 rounded outline-none"
        />
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            node.type === 'sco'
              ? 'bg-emerald-100 text-emerald-700'
              : node.type === 'asset'
              ? 'bg-gray-100 text-gray-600'
              : 'bg-blue-100 text-blue-700'
          }`}
          title={node.entry_point || ''}
        >
          {node.type.toUpperCase()}
        </span>
        <button
          type="button"
          onClick={() => onDelete(node._id)}
          className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
          title="Eliminar este nodo"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {hasChildren && open && (
        <div>
          {node.children!.map((c) => (
            <TreeNode key={c._id} node={c} depth={depth + 1} onRename={onRename} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScormImportWizard({ onCreated }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>('upload');
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<ScormImportPreview | null>(null);
  const [editTree, setEditTree] = useState<EditableNode[]>([]);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  const handleFile = (f: File | null) => {
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
  };

  const handleUploadAndExtract = async () => {
    if (!file) return;
    setError(null);
    setProgress(0);
    setPhase('uploading');
    try {
      const init = await initScormUpload(file.name, file.size);
      await uploadScormToBlob(init.upload_url, file, (pct) => {
        setProgress(pct);
        if (pct >= 100) setPhase('extracting');
      });
      const result = await extractScormForImport({
        upload_id: init.upload_id,
        blob_name: init.blob_name,
      });
      setPreview(result);
      setEditTree(decorate(result.tree));
      setMaterialTitle(result.title || file.name.replace(/\.zip$/i, ''));
      setPhase('preview');
    } catch (e: unknown) {
      setPhase('error');
      const msg =
        (e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ||
        (e as { message?: string })?.message ||
        'Error desconocido durante la importación';
      setError(String(msg));
    }
  };

  const handleSubmit = async () => {
    if (!preview) return;
    if (!materialTitle.trim()) {
      setError('El título del material es obligatorio');
      return;
    }
    if (editTree.length === 0) {
      setError('Debes conservar al menos una sesión');
      return;
    }
    setError(null);
    setPhase('submitting');
    try {
      const material = await createMaterialFromScorm({
        prefix: preview.prefix,
        base_url: preview.base_url,
        manifest_path: preview.manifest_path,
        version: preview.version,
        title: materialTitle.trim(),
        description: materialDescription.trim() || undefined,
        is_published: isPublished,
        tree: stripIds(editTree),
      });
      onCreated(material.id);
    } catch (e: unknown) {
      setPhase('preview');
      const msg =
        (e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ||
        (e as { message?: string })?.message ||
        'Error al crear el material';
      setError(String(msg));
    }
  };

  // ---- RENDER ----------------------------------------------------------------

  if (phase === 'upload' || phase === 'uploading' || phase === 'extracting' || phase === 'error') {
    const busy = phase === 'uploading' || phase === 'extracting';
    return (
      <div className="space-y-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => !busy && inputRef.current?.click()}
          className="border-2 border-dashed border-amber-300 rounded-lg p-8 text-center hover:border-amber-500 transition cursor-pointer bg-amber-50/30"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
          <Package className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          {file ? (
            <div className="text-sm text-gray-700">
              <div className="font-medium">{file.name}</div>
              <div className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
            </div>
          ) : (
            <div className="text-gray-600">
              <p className="font-medium">Arrastra el .zip SCORM aquí</p>
              <p className="text-xs">o haz clic para seleccionar (máx. 2 GB)</p>
            </div>
          )}
        </div>

        {busy && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>
                {phase === 'uploading' ? `Subiendo... ${progress}%` : 'Procesando manifest SCORM...'}
              </span>
              {phase === 'extracting' && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{ width: phase === 'extracting' ? '100%' : `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleUploadAndExtract}
            disabled={!file || busy}
            className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {busy ? 'Procesando...' : 'Subir y analizar'}
          </button>
        </div>
      </div>
    );
  }

  // ---- PREVIEW / SUBMITTING ---------------------------------------------------
  const submitting = phase === 'submitting';
  const leafCount = countLeaves(stripIds(editTree));

  return (
    <div className="space-y-5">
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 flex items-start gap-2">
        <Package className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <strong>SCORM analizado correctamente.</strong>{' '}
          {preview?.file_count ?? 0} archivos · versión {preview?.version} ·{' '}
          {editTree.length} sesión(es) · {leafCount} contenido(s) SCO.
        </div>
      </div>

      {/* Material meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Título del material <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={materialTitle}
            onChange={(e) => setMaterialTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
          <input
            type="text"
            value={materialDescription}
            onChange={(e) => setMaterialDescription(e.target.value)}
            placeholder="Opcional"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          className="rounded"
        />
        Publicar inmediatamente
      </label>

      {/* Tree editor */}
      <div className="border border-gray-200 rounded-lg">
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 text-xs text-gray-600 flex items-center justify-between">
          <span>
            Estructura propuesta — los nodos de nivel 0 serán <strong>sesiones</strong>,
            los demás se aplanan como <strong>temas</strong>. Renombra o elimina lo que no quieras importar.
          </span>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {editTree.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-4">
              No quedan nodos. Vuelve a subir el paquete para reiniciar.
            </div>
          ) : (
            editTree.map((n) => (
              <TreeNode
                key={n._id}
                node={n}
                depth={0}
                onRename={(id, t) => setEditTree((prev) => renameById(prev, id, t))}
                onDelete={(id) => setEditTree((prev) => deleteById(prev, id))}
              />
            ))
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || editTree.length === 0 || !materialTitle.trim()}
          className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium inline-flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Creando material...' : 'Crear material'}
        </button>
      </div>
    </div>
  );
}
