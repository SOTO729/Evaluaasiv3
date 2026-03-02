/**
 * Modal para carga masiva de candidatos desde Excel
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Users,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Building2,
  Layers,
  MapPin,
  Eye,
  ArrowLeft,
  UserPlus,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  bulkUploadCandidates,
  downloadBulkUploadTemplate,
  previewBulkUpload,
  BulkUploadResult,
  BulkUploadPreviewResult
} from '../../services/userManagementService';
import {
  getPartners,
  getCampuses,
  getGroups,
} from '../../services/partnersService';
import { useNotificationStore } from '../../store/notificationStore';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkUploadModal({ isOpen, onClose, onSuccess }: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Preview state
  const [preview, setPreview] = useState<BulkUploadPreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'ready' | 'name_match' | 'duplicate' | 'error' | 'skipped'>('all');
  const [includedSkippedIds, setIncludedSkippedIds] = useState<Set<string>>(new Set());
  const [skipNameMatchRows, setSkipNameMatchRows] = useState<Set<number>>(new Set());
  const [expandedNameMatch, setExpandedNameMatch] = useState<number | null>(null);
  
  // Notificaciones globales
  const { addNotification, updateNotification } = useNotificationStore();
  
  // Estados para expandir/colapsar secciones de resultados
  const [showCreated, setShowCreated] = useState(true);
  const [showErrors, setShowErrors] = useState(true);
  const [showSkipped, setShowSkipped] = useState(false);
  const [showExistingAssigned, setShowExistingAssigned] = useState(true);
  
  // Estado para copiar contraseñas
  const [copiedRow, setCopiedRow] = useState<number | null>(null);

  // Estado para selector de grupo (opcional)
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | ''>('');
  const [selectedCampusId, setSelectedCampusId] = useState<number | ''>('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | ''>('');
  const [partners, setPartners] = useState<Array<{ id: number; name: string }>>([]);
  const [campuses, setCampuses] = useState<Array<{ id: number; name: string }>>([]);
  const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [loadingCampuses, setLoadingCampuses] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [showGroupSelector, setShowGroupSelector] = useState(false);

  // Cargar partners al abrir el selector
  useEffect(() => {
    if (showGroupSelector && partners.length === 0) {
      setLoadingPartners(true);
      getPartners({ page: 1, per_page: 500 })
        .then(res => setPartners((res.partners || []).map((p: any) => ({ id: p.id, name: p.name }))))
        .catch(() => {})
        .finally(() => setLoadingPartners(false));
    }
  }, [showGroupSelector]);

  // Cargar campuses cuando cambia el partner
  useEffect(() => {
    setCampuses([]);
    setGroups([]);
    setSelectedCampusId('');
    setSelectedGroupId('');
    if (selectedPartnerId) {
      setLoadingCampuses(true);
      getCampuses(Number(selectedPartnerId))
        .then(res => setCampuses((res.campuses || []).map((c: any) => ({ id: c.id, name: c.name }))))
        .catch(() => {})
        .finally(() => setLoadingCampuses(false));
    }
  }, [selectedPartnerId]);

  // Cargar grupos cuando cambia el campus
  useEffect(() => {
    setGroups([]);
    setSelectedGroupId('');
    if (selectedCampusId) {
      setLoadingGroups(true);
      getGroups(Number(selectedCampusId))
        .then(res => setGroups((res.groups || []).map((g: any) => ({ id: g.id, name: g.name }))))
        .catch(() => {})
        .finally(() => setLoadingGroups(false));
    }
  }, [selectedCampusId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile);
      setError(null);
      setResult(null);
    } else {
      setError('Por favor selecciona un archivo Excel (.xlsx o .xls)');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
        setError(null);
        setResult(null);
      } else {
        setError('Por favor selecciona un archivo Excel (.xlsx o .xls)');
      }
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setPreviewing(true);
    setError(null);
    try {
      const data = await previewBulkUpload(file, selectedGroupId ? Number(selectedGroupId) : undefined);
      setPreview(data);
      // Pre-seleccionar usuarios existentes para agregar al grupo cuando hay grupo seleccionado
      if (selectedGroupId && data.preview) {
        const existingIds = data.preview
          .filter((r: any) => r.status === 'skipped' && r.existing_user)
          .map((r: any) => r.existing_user.id);
        if (existingIds.length > 0) {
          setIncludedSkippedIds(new Set(existingIds));
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al generar la previsualización');
    } finally {
      setPreviewing(false);
    }
  };

  const handleUpload = async (runInBackground: boolean = false) => {
    if (!file) return;

    if (runInBackground) {
      // Proceso en segundo plano - cerrar modal y mostrar notificación
      const notificationId = addNotification({
        type: 'loading',
        title: 'Procesando archivo',
        message: `Cargando ${file.name}...`,
        dismissible: false,
        duration: 0,
      });
      
      handleClose();
      
      try {
        const uploadResult = await bulkUploadCandidates(file, selectedGroupId ? Number(selectedGroupId) : undefined, includedSkippedIds.size > 0 ? Array.from(includedSkippedIds) : undefined, skipNameMatchRows.size > 0 ? Array.from(skipNameMatchRows) : undefined);
        
        // Actualizar notificación con resultado
        if (uploadResult.summary.created > 0 || uploadResult.summary.existing_assigned > 0) {
          const groupMsg = uploadResult.group_assignment
            ? ` | ${uploadResult.group_assignment.assigned} asignados a ${uploadResult.group_assignment.group_name}`
            : '';
          const existingMsg = uploadResult.summary.existing_assigned > 0
            ? `, ${uploadResult.summary.existing_assigned} existentes asignados al grupo`
            : '';
          updateNotification(notificationId, {
            type: 'success',
            title: 'Carga masiva completada',
            message: `${uploadResult.summary.created} candidatos creados${existingMsg}, ${uploadResult.summary.errors} errores${groupMsg}`,
            dismissible: true,
            duration: 10000,
          });
          onSuccess();
        } else if (uploadResult.summary.errors > 0) {
          updateNotification(notificationId, {
            type: 'error',
            title: 'Error en carga masiva',
            message: `${uploadResult.summary.errors} errores encontrados. Revisa el archivo.`,
            dismissible: true,
            duration: 10000,
          });
        } else {
          updateNotification(notificationId, {
            type: 'warning',
            title: 'Sin cambios',
            message: 'No se crearon candidatos nuevos.',
            dismissible: true,
            duration: 8000,
          });
        }
      } catch (err: any) {
        updateNotification(notificationId, {
          type: 'error',
          title: 'Error al procesar archivo',
          message: err.response?.data?.error || 'Error desconocido',
          dismissible: true,
          duration: 10000,
        });
      }
    } else {
      // Proceso normal - mantener modal abierto
      setUploading(true);
      setError(null);
      setResult(null);
      
      try {
        const uploadResult = await bulkUploadCandidates(file, selectedGroupId ? Number(selectedGroupId) : undefined, includedSkippedIds.size > 0 ? Array.from(includedSkippedIds) : undefined, skipNameMatchRows.size > 0 ? Array.from(skipNameMatchRows) : undefined);
        setResult(uploadResult);
        
        if (uploadResult.summary.created > 0 || uploadResult.summary.existing_assigned > 0) {
          onSuccess();
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al procesar el archivo');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadBulkUploadTemplate();
    } catch (err: any) {
      setError('Error al descargar la plantilla. Intenta de nuevo.');
    }
  };

  const handleDownloadResults = () => {
    if (!result || result.details.created.length === 0) return;
    
    // Crear datos para el Excel
    const data = result.details.created.map((item) => ({
      'Fila Original': item.row,
      'Email': item.email || '(sin email)',
      'Nombre': item.name,
      'Usuario': item.username,
      'Contraseña': item.password || '(no disponible)',
    }));
    
    // Crear workbook y worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 12 }, // Fila Original
      { wch: 35 }, // Email
      { wch: 25 }, // Nombre
      { wch: 20 }, // Usuario
      { wch: 15 }, // Contraseña
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Candidatos Creados');
    
    // Descargar
    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Candidatos_Creados_${fecha}.xlsx`);
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setPreview(null);
    setPreviewFilter('all');
    setIncludedSkippedIds(new Set());
    setSkipNameMatchRows(new Set());
    setExpandedNameMatch(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleResetGroup = () => {
    setSelectedPartnerId('');
    setSelectedCampusId('');
    setSelectedGroupId('');
    setCampuses([]);
    setGroups([]);
  };

  const handleCopyPassword = (row: number, password: string) => {
    navigator.clipboard.writeText(password);
    setCopiedRow(row);
    setTimeout(() => setCopiedRow(null), 2000);
  };

  const handleClose = () => {
    handleReset();
    handleResetGroup();
    setShowGroupSelector(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50  p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-all ${preview ? 'max-w-5xl' : 'max-w-3xl'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Carga Masiva de Candidatos</h2>
              <p className="text-sm text-gray-600">Importa múltiples candidatos desde un archivo Excel</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Selector de grupo (opcional) */}
          {!result && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => {
                  setShowGroupSelector(!showGroupSelector);
                  if (showGroupSelector) handleResetGroup();
                }}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  showGroupSelector
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${showGroupSelector ? 'bg-purple-100' : 'bg-gray-200'}`}>
                    <Layers className={`h-5 w-5 ${showGroupSelector ? 'text-purple-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="text-left">
                    <p className={`font-medium ${showGroupSelector ? 'text-purple-800' : 'text-gray-700'}`}>
                      Asignar a un grupo
                      <span className="ml-2 text-xs font-normal text-gray-400">(Opcional)</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedGroupId
                        ? `Grupo: ${groups.find(g => g.id === selectedGroupId)?.name || '...'}`
                        : 'Los candidatos se crearán sin grupo asignado'}
                    </p>
                  </div>
                </div>
                {showGroupSelector ? (
                  <ChevronUp className="h-5 w-5 text-purple-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {showGroupSelector && (
                <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
                  {/* Partner */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      Partner
                    </label>
                    <select
                      value={selectedPartnerId}
                      onChange={e => setSelectedPartnerId(e.target.value ? Number(e.target.value) : '')}
                      disabled={loadingPartners}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                    >
                      <option value="">
                        {loadingPartners ? 'Cargando partners...' : '-- Selecciona un partner --'}
                      </option>
                      {partners.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Campus */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      Campus
                    </label>
                    <select
                      value={selectedCampusId}
                      onChange={e => setSelectedCampusId(e.target.value ? Number(e.target.value) : '')}
                      disabled={!selectedPartnerId || loadingCampuses}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                    >
                      <option value="">
                        {loadingCampuses
                          ? 'Cargando campus...'
                          : !selectedPartnerId
                          ? '-- Selecciona un partner primero --'
                          : '-- Selecciona un campus --'}
                      </option>
                      {campuses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Grupo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-gray-400" />
                      Grupo
                    </label>
                    <select
                      value={selectedGroupId}
                      onChange={e => setSelectedGroupId(e.target.value ? Number(e.target.value) : '')}
                      disabled={!selectedCampusId || loadingGroups}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                    >
                      <option value="">
                        {loadingGroups
                          ? 'Cargando grupos...'
                          : !selectedCampusId
                          ? '-- Selecciona un campus primero --'
                          : '-- Selecciona un grupo --'}
                      </option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selected group summary */}
                  {selectedGroupId && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                        <span className="text-purple-800 font-medium">
                          {groups.find(g => g.id === selectedGroupId)?.name}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500 text-xs">
                          {partners.find(p => p.id === selectedPartnerId)?.name} / {campuses.find(c => c.id === selectedCampusId)?.name}
                        </span>
                      </div>
                      <button
                        onClick={handleResetGroup}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Quitar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Paso 1: Descargar plantilla */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">1</span>
              Descargar Plantilla
            </h3>
            <p className="text-sm text-blue-700 mb-3">
              Descarga la plantilla Excel con el formato correcto para agregar los candidatos.
            </p>
            
            {/* Info de campos */}
            <div className="mb-4 p-3 bg-white rounded-lg border border-blue-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">Campos de la plantilla:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  <span className="text-gray-600"><strong>nombre</strong> - Requerido</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  <span className="text-gray-600"><strong>primer_apellido</strong> - Requerido</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  <span className="text-gray-600"><strong>segundo_apellido</strong> - Requerido</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  <span className="text-gray-600"><strong>genero</strong> - Requerido (M/F/O)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  <span className="text-gray-600"><strong>email</strong> - Opcional</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  <span className="text-gray-600"><strong>curp</strong> - Opcional</span>
                </div>
              </div>
              <div className="mt-3 p-2 bg-amber-50 rounded border border-amber-200">
                <p className="text-xs text-amber-700">
                  <AlertCircle className="inline h-3 w-3 mr-1" />
                  <strong>Importante:</strong> Sin email no recibe insignia digital. Sin CURP no recibe certificado CONOCER.
                </p>
              </div>
            </div>
            
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Download className="h-4 w-4" />
              Descargar Plantilla
            </button>
          </div>

          {/* Paso 2: Subir archivo */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-600 text-white text-sm flex items-center justify-center">2</span>
              Subir Archivo Excel
            </h3>
            
            {!result && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-green-500 bg-green-50'
                    : file
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="h-12 w-12 text-green-600" />
                    <div>
                      <p className="font-medium text-gray-800">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReset();
                      }}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Cambiar archivo
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="h-12 w-12 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-700">
                        Arrastra tu archivo aquí o haz clic para seleccionar
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Archivos permitidos: .xlsx, .xls
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Upload button / Preview button */}
            {file && !result && !preview && (
              <div className="mt-4 flex flex-col gap-3">
                {previewing ? (
                  <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-800">Analizando archivo...</p>
                      <p className="text-sm text-blue-600">Validando datos y buscando duplicados</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={handlePreview}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                    >
                      <Eye className="h-5 w-5" />
                      Previsualizar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Preview table */}
            {preview && !result && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-sm flex items-center justify-center">3</span>
                    Previsualización
                  </h3>
                  {preview.group_info && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                      Grupo: {preview.group_info.name}
                    </span>
                  )}
                </div>

                {/* Summary badges */}
                <div className={`grid gap-2 ${preview.summary.name_matches > 0 ? 'grid-cols-6' : 'grid-cols-5'}`}>
                  <button onClick={() => setPreviewFilter('all')}
                    className={`p-2 rounded-lg text-center transition-colors ${previewFilter === 'all' ? 'ring-2 ring-gray-400 bg-gray-100' : 'bg-gray-50 hover:bg-gray-100'}`}>
                    <p className="text-lg font-bold text-gray-800">{preview.summary.total_rows}</p>
                    <p className="text-[10px] text-gray-500">Total</p>
                  </button>
                  <button onClick={() => setPreviewFilter('ready')}
                    className={`p-2 rounded-lg text-center transition-colors ${previewFilter === 'ready' ? 'ring-2 ring-green-400 bg-green-100' : 'bg-green-50 hover:bg-green-100'}`}>
                    <p className="text-lg font-bold text-green-600">{preview.summary.ready}</p>
                    <p className="text-[10px] text-green-700">Listos</p>
                  </button>
                  {preview.summary.name_matches > 0 && (
                    <button onClick={() => setPreviewFilter('name_match')}
                      className={`p-2 rounded-lg text-center transition-colors ${previewFilter === 'name_match' ? 'ring-2 ring-orange-400 bg-orange-100' : 'bg-orange-50 hover:bg-orange-100'}`}>
                      <p className="text-lg font-bold text-orange-600">{preview.summary.name_matches}</p>
                      <p className="text-[10px] text-orange-700">Coincidencias</p>
                    </button>
                  )}
                  <button onClick={() => setPreviewFilter('duplicate')}
                    className={`p-2 rounded-lg text-center transition-colors ${previewFilter === 'duplicate' ? 'ring-2 ring-blue-400 bg-blue-100' : 'bg-blue-50 hover:bg-blue-100'}`}>
                    <p className="text-lg font-bold text-blue-600">{preview.summary.duplicates}</p>
                    <p className="text-[10px] text-blue-700">Existentes</p>
                  </button>
                  <button onClick={() => setPreviewFilter('error')}
                    className={`p-2 rounded-lg text-center transition-colors ${previewFilter === 'error' ? 'ring-2 ring-red-400 bg-red-100' : 'bg-red-50 hover:bg-red-100'}`}>
                    <p className="text-lg font-bold text-red-600">{preview.summary.errors}</p>
                    <p className="text-[10px] text-red-700">Errores</p>
                  </button>
                  <button onClick={() => setPreviewFilter('skipped')}
                    className={`p-2 rounded-lg text-center transition-colors ${previewFilter === 'skipped' ? 'ring-2 ring-yellow-400 bg-yellow-100' : 'bg-yellow-50 hover:bg-yellow-100'}`}>
                    <p className="text-lg font-bold text-yellow-600">{preview.summary.skipped}</p>
                    <p className="text-[10px] text-yellow-700">Omitidos</p>
                  </button>
                </div>

                {/* Banner: add skipped existing users to group */}
                {(() => {
                  const skippedWithUser = preview.preview.filter(r => r.status === 'skipped' && r.existing_user);
                  if (!selectedGroupId || skippedWithUser.length === 0) return null;
                  const allSelected = skippedWithUser.every(r => includedSkippedIds.has(r.existing_user!.id));
                  const groupName = groups.find(g => g.id === selectedGroupId)?.name || 'el grupo';
                  return (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <UserPlus className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <span className="text-amber-800">
                          <strong>{skippedWithUser.length}</strong> usuario(s) omitido(s) ya existen.
                          {includedSkippedIds.size > 0 && (
                            <span className="text-green-700 font-medium"> ({includedSkippedIds.size} se agregarán a {groupName})</span>
                          )}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (allSelected) {
                            setIncludedSkippedIds(new Set());
                          } else {
                            setIncludedSkippedIds(new Set(skippedWithUser.map(r => r.existing_user!.id)));
                          }
                        }}
                        className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          allSelected
                            ? 'bg-amber-200 text-amber-800 hover:bg-amber-300'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {allSelected ? 'Deseleccionar todos' : 'Agregar todos al grupo'}
                      </button>
                    </div>
                  );
                })()}

                {/* Banner: name+gender matches */}
                {(() => {
                  const nameMatchRows = preview.preview.filter(r => r.status === 'name_match');
                  if (nameMatchRows.length === 0) return null;
                  const allSkipped = nameMatchRows.every(r => skipNameMatchRows.has(r.row));
                  const noneSkipped = skipNameMatchRows.size === 0;
                  return (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                          <span className="text-orange-800">
                            <strong>{nameMatchRows.length}</strong> fila(s) coinciden en nombre y género con usuarios existentes.
                            {skipNameMatchRows.size > 0 && (
                              <span className="text-red-600 font-medium"> ({skipNameMatchRows.size} se omitirán)</span>
                            )}
                          </span>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => {
                              if (allSkipped) {
                                setSkipNameMatchRows(new Set());
                              } else {
                                setSkipNameMatchRows(new Set(nameMatchRows.map(r => r.row)));
                              }
                            }}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                              allSkipped
                                ? 'bg-orange-200 text-orange-800 hover:bg-orange-300'
                                : 'bg-red-600 text-white hover:bg-red-700'
                            }`}
                          >
                            {allSkipped ? 'Crear todos' : 'Omitir todos'}
                          </button>
                          {!noneSkipped && !allSkipped && (
                            <button
                              onClick={() => setSkipNameMatchRows(new Set())}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                            >
                              Crear todos
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-orange-600">
                        Revisa cada fila para decidir si deseas crear un nuevo usuario o si es un duplicado. Por defecto se crearán.
                      </p>
                    </div>
                  );
                })()}

                {/* Preview rows table */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-600">Fila</th>
                          <th className="px-3 py-2 text-left text-gray-600">Estado</th>
                          <th className="px-3 py-2 text-left text-gray-600">Email</th>
                          <th className="px-3 py-2 text-left text-gray-600">Nombre</th>
                          <th className="px-3 py-2 text-left text-gray-600">Usuario</th>
                          <th className="px-3 py-2 text-left text-gray-600">Detalle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {preview.preview
                          .filter(r => previewFilter === 'all' || r.status === previewFilter)
                          .map((r) => (
                          <tr key={r.row} className={`hover:bg-gray-50/50 ${r.status === 'name_match' && skipNameMatchRows.has(r.row) ? 'opacity-40' : ''}`}>
                            <td className="px-3 py-1.5 text-gray-500">{r.row}</td>
                            <td className="px-3 py-1.5">
                              {r.status === 'ready' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
                                  <CheckCircle2 className="h-3 w-3" /> Listo
                                </span>
                              )}
                              {r.status === 'name_match' && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  skipNameMatchRows.has(r.row)
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}>
                                  <AlertCircle className="h-3 w-3" />
                                  {skipNameMatchRows.has(r.row) ? 'Omitido' : 'Coincide'}
                                </span>
                              )}
                              {r.status === 'duplicate' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium">
                                  <Users className="h-3 w-3" /> Existente
                                </span>
                              )}
                              {r.status === 'error' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-medium">
                                  <XCircle className="h-3 w-3" /> Error
                                </span>
                              )}
                              {r.status === 'skipped' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-medium">
                                  <AlertCircle className="h-3 w-3" /> Omitido
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-gray-700 truncate max-w-[140px]">{r.email || '-'}</td>
                            <td className="px-3 py-1.5 text-gray-700 truncate max-w-[140px]">
                              {(r.status === 'duplicate' || r.status === 'skipped') && r.existing_user
                                ? r.existing_user.name
                                : r.nombre
                                  ? `${r.nombre} ${r.primer_apellido || ''}`
                                  : '-'
                              }
                            </td>
                            <td className="px-3 py-1.5 text-gray-500 font-mono">
                              {r.username_preview || ((r.status === 'duplicate' || r.status === 'skipped') && r.existing_user ? r.existing_user.username : '-')}
                            </td>
                            <td className="px-3 py-1.5 text-gray-500 max-w-[220px]">
                              {r.status === 'name_match' && r.name_matches ? (
                                <div className="space-y-1">
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={skipNameMatchRows.has(r.row)}
                                      onChange={() => {
                                        setSkipNameMatchRows(prev => {
                                          const next = new Set(prev);
                                          if (next.has(r.row)) {
                                            next.delete(r.row);
                                          } else {
                                            next.add(r.row);
                                          }
                                          return next;
                                        });
                                      }}
                                      className="rounded border-gray-300 text-red-600 focus:ring-red-500 h-3.5 w-3.5"
                                    />
                                    <span className={`text-[10px] font-medium ${skipNameMatchRows.has(r.row) ? 'text-red-600' : 'text-orange-600'}`}>
                                      {skipNameMatchRows.has(r.row) ? 'No se creará' : 'Omitir (no crear)'}
                                    </span>
                                  </label>
                                  <button
                                    onClick={() => setExpandedNameMatch(expandedNameMatch === r.row ? null : r.row)}
                                    className="text-[10px] text-orange-600 hover:text-orange-800 underline"
                                  >
                                    {expandedNameMatch === r.row ? 'Ocultar coincidencias' : `Ver ${r.name_matches.length} coincidencia(s)`}
                                  </button>
                                  {expandedNameMatch === r.row && (
                                    <div className="mt-1 p-1.5 bg-orange-50 rounded border border-orange-200 space-y-1">
                                      {r.name_matches.map(m => (
                                        <div key={m.id} className="text-[9px] text-orange-800 flex gap-2">
                                          <span className="font-medium">{m.full_name}</span>
                                          <span className="text-orange-500">@{m.username}</span>
                                          {m.email && <span className="text-orange-400">{m.email}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : r.status === 'skipped' && r.existing_user && selectedGroupId ? (
                                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={includedSkippedIds.has(r.existing_user.id)}
                                    onChange={() => {
                                      setIncludedSkippedIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(r.existing_user!.id)) {
                                          next.delete(r.existing_user!.id);
                                        } else {
                                          next.add(r.existing_user!.id);
                                        }
                                        return next;
                                      });
                                    }}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500 h-3.5 w-3.5"
                                  />
                                  <span className={`text-[10px] font-medium ${includedSkippedIds.has(r.existing_user.id) ? 'text-green-700' : 'text-gray-400'}`}>
                                    {includedSkippedIds.has(r.existing_user.id) ? 'Se agregará al grupo' : 'Agregar al grupo'}
                                  </span>
                                </label>
                              ) : r.error || (r.status === 'ready' && r.eligibility ? (
                                <span className="flex gap-1">
                                  {r.eligibility.conocer && <span className="px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px]">CC</span>}
                                  {r.eligibility.insignia && <span className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px]">ID</span>}
                                </span>
                              ) : '')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => { setPreview(null); setPreviewFilter('all'); setIncludedSkippedIds(new Set()); setSkipNameMatchRows(new Set()); setExpandedNameMatch(null); }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Cambiar archivo
                  </button>
                  <div className="flex gap-3">
                    {preview.can_proceed && (
                      <>
                        {uploading ? (
                          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                            <span className="text-sm text-blue-700">Procesando...</span>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleUpload(true)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                            >
                              Procesar en segundo plano
                            </button>
                            <button
                              onClick={() => handleUpload(false)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              <Upload className="h-4 w-4" />
                              Confirmar Carga ({preview.summary.ready + preview.summary.name_matches - skipNameMatchRows.size} nuevos{preview.summary.duplicates > 0 ? ` + ${preview.summary.duplicates} existentes` : ''}{includedSkippedIds.size > 0 ? ` + ${includedSkippedIds.size} omitidos` : ''})
                            </button>
                          </>
                        )}
                      </>
                    )}
                    {!preview.can_proceed && (
                      <p className="text-sm text-red-600 font-medium">No hay registros válidos para procesar</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Resultados */}
          {result && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className={`grid gap-3 ${result.summary.existing_assigned > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
                <div className="p-3 bg-gray-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-gray-800">{result.summary.total_processed}</p>
                  <p className="text-xs text-gray-500">Procesados</p>
                </div>
                <div className="p-3 bg-green-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-green-600">{result.summary.created}</p>
                  <p className="text-xs text-green-700">Creados</p>
                </div>
                {result.summary.existing_assigned > 0 && (
                  <div className="p-3 bg-blue-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-blue-600">{result.summary.existing_assigned}</p>
                    <p className="text-xs text-blue-700">Ya existían</p>
                  </div>
                )}
                <div className="p-3 bg-yellow-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-yellow-600">{result.summary.skipped}</p>
                  <p className="text-xs text-yellow-700">Omitidos</p>
                </div>
                <div className="p-3 bg-red-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-red-600">{result.summary.errors}</p>
                  <p className="text-xs text-red-700">Errores</p>
                </div>
              </div>

              {/* Group assignment result */}
              {result.group_assignment && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="h-5 w-5 text-purple-600" />
                    <span className="font-medium text-purple-800">
                      Asignación a grupo: {result.group_assignment.group_name}
                    </span>
                  </div>
                  <p className="text-sm text-purple-700">
                    {result.group_assignment.assigned} candidato(s) asignados exitosamente
                    {result.group_assignment.assigned_new > 0 && (
                      <span className="text-green-600 ml-1">
                        ({result.group_assignment.assigned_new} nuevos)
                      </span>
                    )}
                    {result.group_assignment.assigned_existing > 0 && (
                      <span className="text-blue-600 ml-1">
                        ({result.group_assignment.assigned_existing} ya existían)
                      </span>
                    )}
                    {result.group_assignment.errors && result.group_assignment.errors.length > 0 && (
                      <span className="text-red-600 ml-2">
                        • {result.group_assignment.errors.length} error(es)
                      </span>
                    )}
                  </p>
                  {result.group_assignment.errors && result.group_assignment.errors.length > 0 && (
                    <div className="mt-2 text-xs text-red-600 space-y-1">
                      {result.group_assignment.errors.map((e, i) => (
                        <p key={i}>{e.username}: {e.error}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Botón descargar Excel */}
              {result.details.created.length > 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={handleDownloadResults}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg"
                  >
                    <Download className="h-5 w-5" />
                    Descargar Excel con usuarios y contraseñas
                  </button>
                </div>
              )}

              {/* Usuarios creados */}
              {result.details.created.length > 0 && (
                <div className="border border-green-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowCreated(!showCreated)}
                    className="w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">
                        Usuarios Creados ({result.details.created.length})
                      </span>
                    </div>
                    {showCreated ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                  
                  {showCreated && (
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-green-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-green-800">Fila</th>
                            <th className="px-4 py-2 text-left text-green-800">Email</th>
                            <th className="px-4 py-2 text-left text-green-800">Nombre</th>
                            <th className="px-4 py-2 text-left text-green-800">Contraseña</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-green-100">
                          {result.details.created.map((item) => (
                            <tr key={item.row} className="hover:bg-green-50/50">
                              <td className="px-4 py-2 text-gray-600">{item.row}</td>
                              <td className="px-4 py-2 text-gray-800">{item.email}</td>
                              <td className="px-4 py-2 text-gray-800">{item.name}</td>
                              <td className="px-4 py-2">
                                {item.password ? (
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                      {item.password}
                                    </code>
                                    <button
                                      onClick={() => handleCopyPassword(item.row, item.password!)}
                                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                                      title="Copiar contraseña"
                                    >
                                      {copiedRow === item.row ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Copy className="h-4 w-4 text-gray-500" />
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-xs">(proporcionada)</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Usuarios existentes asignados al grupo */}
              {result.details.existing_assigned && result.details.existing_assigned.length > 0 && (
                <div className="border border-blue-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowExistingAssigned(!showExistingAssigned)}
                    className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-800">
                        Ya existían y se asignaron al grupo ({result.details.existing_assigned.length})
                      </span>
                    </div>
                    {showExistingAssigned ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                  
                  {showExistingAssigned && (
                    <div className="max-h-60 overflow-y-auto">
                      <div className="p-3 bg-blue-50/50 border-b border-blue-100">
                        <p className="text-xs text-blue-700">
                          <AlertCircle className="inline h-3 w-3 mr-1" />
                          Estos candidatos ya tenían cuenta en la plataforma. Se asignaron al grupo seleccionado.
                        </p>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-blue-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-blue-800">Fila</th>
                            <th className="px-4 py-2 text-left text-blue-800">Email</th>
                            <th className="px-4 py-2 text-left text-blue-800">Nombre</th>
                            <th className="px-4 py-2 text-left text-blue-800">Usuario</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-100">
                          {result.details.existing_assigned.map((item, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/50">
                              <td className="px-4 py-2 text-gray-600">{item.row}</td>
                              <td className="px-4 py-2 text-gray-800">{item.email || '(sin email)'}</td>
                              <td className="px-4 py-2 text-gray-800">{item.name}</td>
                              <td className="px-4 py-2 text-gray-600">{item.username}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Errores */}
              {result.details.errors.length > 0 && (
                <div className="border border-red-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowErrors(!showErrors)}
                    className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-800">
                        Errores ({result.details.errors.length})
                      </span>
                    </div>
                    {showErrors ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                  
                  {showErrors && (
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-red-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-red-800">Fila</th>
                            <th className="px-4 py-2 text-left text-red-800">Email</th>
                            <th className="px-4 py-2 text-left text-red-800">Error</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-100">
                          {result.details.errors.map((item, idx) => (
                            <tr key={idx} className="hover:bg-red-50/50">
                              <td className="px-4 py-2 text-gray-600">{item.row}</td>
                              <td className="px-4 py-2 text-gray-800">{item.email}</td>
                              <td className="px-4 py-2 text-red-700">{item.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Omitidos */}
              {result.details.skipped.length > 0 && (
                <div className="border border-yellow-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowSkipped(!showSkipped)}
                    className="w-full flex items-center justify-between p-4 bg-yellow-50 hover:bg-yellow-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <span className="font-medium text-yellow-800">
                        Omitidos ({result.details.skipped.length})
                      </span>
                    </div>
                    {showSkipped ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                  
                  {showSkipped && (
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-yellow-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-yellow-800">Fila</th>
                            <th className="px-4 py-2 text-left text-yellow-800">Email</th>
                            <th className="px-4 py-2 text-left text-yellow-800">Razón</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-yellow-100">
                          {result.details.skipped.map((item, idx) => (
                            <tr key={idx} className="hover:bg-yellow-50/50">
                              <td className="px-4 py-2 text-gray-600">{item.row}</td>
                              <td className="px-4 py-2 text-gray-800">{item.email}</td>
                              <td className="px-4 py-2 text-yellow-700">{item.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Botón para nueva carga */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                >
                  <Upload className="h-5 w-5" />
                  Cargar otro archivo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-colors"
          >
            {result ? 'Cerrar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}
