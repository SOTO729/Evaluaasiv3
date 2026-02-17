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
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  bulkUploadCandidates,
  downloadBulkUploadTemplate,
  BulkUploadResult
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
  
  // Notificaciones globales
  const { addNotification, updateNotification } = useNotificationStore();
  
  // Estados para expandir/colapsar secciones de resultados
  const [showCreated, setShowCreated] = useState(true);
  const [showErrors, setShowErrors] = useState(true);
  const [showSkipped, setShowSkipped] = useState(false);
  
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
        const uploadResult = await bulkUploadCandidates(file, selectedGroupId ? Number(selectedGroupId) : undefined);
        
        // Actualizar notificación con resultado
        if (uploadResult.summary.created > 0) {
          const groupMsg = uploadResult.group_assignment
            ? ` | ${uploadResult.group_assignment.assigned} asignados a ${uploadResult.group_assignment.group_name}`
            : '';
          updateNotification(notificationId, {
            type: 'success',
            title: 'Carga masiva completada',
            message: `${uploadResult.summary.created} candidatos creados, ${uploadResult.summary.errors} errores${groupMsg}`,
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
        const uploadResult = await bulkUploadCandidates(file, selectedGroupId ? Number(selectedGroupId) : undefined);
        setResult(uploadResult);
        
        if (uploadResult.summary.created > 0) {
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
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

            {/* Upload button */}
            {file && !result && (
              <div className="mt-4 flex flex-col gap-3">
                {uploading ? (
                  <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-800">Procesando archivo...</p>
                      <p className="text-sm text-blue-600">Esto puede tomar unos segundos</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => handleUpload(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      Procesar en segundo plano
                    </button>
                    <button
                      onClick={() => handleUpload(false)}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                    >
                      <Upload className="h-5 w-5" />
                      Procesar y ver resultados
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resultados */}
          {result && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-gray-800">{result.summary.total_processed}</p>
                  <p className="text-xs text-gray-500">Procesados</p>
                </div>
                <div className="p-3 bg-green-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-green-600">{result.summary.created}</p>
                  <p className="text-xs text-green-700">Creados</p>
                </div>
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
