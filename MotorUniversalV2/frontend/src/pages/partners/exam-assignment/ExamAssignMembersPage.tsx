/**
 * Página 3/4: Asignación de Miembros
 * Recibe SelectMaterialsState de la página anterior
 * Para 'all' y 'selected': Navega a → /assign-exam/review con AssignMembersState
 * Para 'bulk': Proceso completo se maneja aquí (carga masiva por ECM)
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Users, UserCheck, ClipboardList,
  CheckCircle2, AlertCircle, X, Loader2, Search,
  FileSpreadsheet, Upload, Download, DollarSign,
  ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../../components/PartnersBreadcrumb';
import {
  getGroup, getGroupMembers,
  downloadBulkExamAssignTemplate, bulkAssignExamsByECM,
  CandidateGroup, GroupMember, BulkExamAssignResult,
} from '../../../services/partnersService';
// balance service not needed here - cost preview is on review page
import type { SelectMaterialsState, AssignMembersState } from './types';

export default function ExamAssignMembersPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const prevState = location.state as SelectMaterialsState | undefined;

  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assignment type
  const [assignmentType, setAssignmentType] = useState<'all' | 'selected' | 'bulk'>('all');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Bulk
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<BulkExamAssignResult | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkExamAssignResult | null>(null);
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Result table controls
  const [resultSearch, setResultSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<Record<string, { key: string; dir: 'asc' | 'desc' }>>({
    assigned: { key: 'row', dir: 'asc' },
    skipped: { key: 'row', dir: 'asc' },
    errors: { key: 'row', dir: 'asc' },
  });

  // Cost preview loading
  const [loadingCostPreview] = useState(false);

  // Redirect if no state
  useEffect(() => {
    if (!prevState?.selectedExam) {
      navigate(`/partners/groups/${groupId}/assign-exam`, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (!prevState?.selectedExam) return;
    (async () => {
      try {
        setLoading(true);
        const [groupData, membersData] = await Promise.all([
          getGroup(Number(groupId)),
          getGroupMembers(Number(groupId)),
        ]);
        setGroup(groupData);
        setMembers(membersData.members);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const handleSelectAllMembers = () => {
    if (selectedMemberIds.length === members.length) setSelectedMemberIds([]);
    else setSelectedMemberIds(members.map(m => m.user_id));
  };

  const handleGoToReview = async () => {
    if (!prevState || assignmentType === 'bulk') return;
    if (assignmentType === 'selected' && selectedMemberIds.length === 0) {
      setError('Debes seleccionar al menos un candidato');
      return;
    }
    const state: AssignMembersState = {
      ...prevState,
      assignmentType: assignmentType as 'all' | 'selected',
      selectedMemberIds: assignmentType === 'selected' ? selectedMemberIds : undefined,
    };
    navigate(`/partners/groups/${groupId}/assign-exam/review`, { state });
  };

  // Bulk functions
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await downloadBulkExamAssignTemplate(Number(groupId));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla_asignacion_examenes_${group?.name || groupId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al descargar la plantilla');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBulkFile(file);
      setBulkPreview(null);
      setBulkResult(null);
      // Previsualizar al seleccionar archivo (dry_run)
      previewFile(file);
    }
  };

  const previewFile = async (file: File) => {
    if (!prevState?.selectedExam) return;
    const ecmCode = prevState.selectedExam.ecm_code || prevState.selectedExam.standard;
    if (!ecmCode) { setError('El examen seleccionado no tiene código ECM'); return; }
    setBulkUploading(true);
    setBulkPreview(null);
    try {
      const { config } = prevState;
      const result = await bulkAssignExamsByECM(Number(groupId), file, ecmCode, {
        time_limit_minutes: config.useExamDefaultTime ? undefined : (config.timeLimitMinutes || undefined),
        passing_score: config.useExamDefaultScore ? undefined : config.passingScore,
        max_attempts: config.maxAttempts,
        max_disconnections: config.maxDisconnections,
        exam_content_type: config.examContentType,
      }, true); // dry_run = true
      setBulkPreview(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar el archivo');
    } finally {
      setBulkUploading(false);
    }
  };

  const handleConfirmBulkAssign = async () => {
    if (!prevState?.selectedExam || !bulkFile) return;
    const ecmCode = prevState.selectedExam.ecm_code || prevState.selectedExam.standard;
    if (!ecmCode) { setError('El examen seleccionado no tiene código ECM'); return; }
    setBulkConfirming(true);
    try {
      const { config } = prevState;
      const result = await bulkAssignExamsByECM(Number(groupId), bulkFile, ecmCode, {
        time_limit_minutes: config.useExamDefaultTime ? undefined : (config.timeLimitMinutes || undefined),
        passing_score: config.useExamDefaultScore ? undefined : config.passingScore,
        max_attempts: config.maxAttempts,
        max_disconnections: config.maxDisconnections,
        exam_content_type: config.examContentType,
      }, false); // dry_run = false → asignación real
      setBulkResult(result);
      setBulkPreview(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al confirmar la asignación');
    } finally {
      setBulkConfirming(false);
    }
  };

  const handleClearFile = () => {
    setBulkFile(null);
    setBulkPreview(null);
    setBulkResult(null);
    setResultSearch('');
  };

  const toggleSort = (table: string, key: string) => {
    setSortConfig(prev => ({
      ...prev,
      [table]: prev[table]?.key === key && prev[table]?.dir === 'asc'
        ? { key, dir: 'desc' as const }
        : { key, dir: 'asc' as const },
    }));
  };

  const sortItems = <T extends Record<string, any>>(items: T[], table: string): T[] => {
    const cfg = sortConfig[table];
    if (!cfg) return items;
    return [...items].sort((a, b) => {
      const aVal = a[cfg.key] ?? '';
      const bVal = b[cfg.key] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') return cfg.dir === 'asc' ? aVal - bVal : bVal - aVal;
      return cfg.dir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
  };

  const SortIcon = ({ table, column }: { table: string; column: string }) => {
    const cfg = sortConfig[table];
    if (cfg?.key !== column) return <ArrowUpDown className="inline fluid-icon-xs ml-1 text-gray-400" />;
    return cfg.dir === 'asc' ? <ArrowUp className="inline fluid-icon-xs ml-1" /> : <ArrowDown className="inline fluid-icon-xs ml-1" />;
  };

  const filteredAssigned = useMemo(() => {
    const source = bulkResult || bulkPreview;
    if (!source) return [];
    const q = resultSearch.toLowerCase();
    const filtered = q ? source.results.assigned.filter(item =>
      (item.user_name || '').toLowerCase().includes(q) ||
      (item.email || '').toLowerCase().includes(q) ||
      (item.curp || '').toLowerCase().includes(q) ||
      (item.exam_name || '').toLowerCase().includes(q)
    ) : source.results.assigned;
    return sortItems(filtered, 'assigned');
  }, [bulkResult, bulkPreview, resultSearch, sortConfig]);

  const filteredSkipped = useMemo(() => {
    const source = bulkResult || bulkPreview;
    if (!source) return [];
    const q = resultSearch.toLowerCase();
    const filtered = q ? source.results.skipped.filter(item =>
      (item.user_name || '').toLowerCase().includes(q) ||
      (item.email || '').toLowerCase().includes(q) ||
      (item.reason || '').toLowerCase().includes(q)
    ) : source.results.skipped;
    return sortItems(filtered, 'skipped');
  }, [bulkResult, bulkPreview, resultSearch, sortConfig]);

  const filteredErrors = useMemo(() => {
    const source = bulkResult || bulkPreview;
    if (!source) return [];
    const q = resultSearch.toLowerCase();
    const filtered = q ? source.results.errors.filter(item =>
      (item.user_name || item.identifier || '').toLowerCase().includes(q) ||
      (item.error || '').toLowerCase().includes(q)
    ) : source.results.errors;
    return sortItems(filtered, 'errors');
  }, [bulkResult, bulkPreview, resultSearch, sortConfig]);

  const filteredMembers = members.filter(m => {
    if (!memberSearchQuery.trim()) return true;
    const q = memberSearchQuery.toLowerCase();
    return (m.user?.full_name?.toLowerCase() || '').includes(q) || (m.user?.email?.toLowerCase() || '').includes(q) || (m.user?.curp?.toLowerCase() || '').includes(q);
  });

  if (!prevState?.selectedExam) return null;
  if (loading) return <LoadingSpinner message="Cargando miembros..." fullScreen />;
  if (!group) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4"><p className="text-red-600">Grupo no encontrado</p></div></div>;

  const { selectedExam, config, selectedMaterialIds } = prevState;
  const stepLabels = ['ECM', 'Examen', 'Materiales', 'Miembros', 'Confirmar'];

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      <PartnersBreadcrumb items={[
        { label: group.campus?.partner?.name || 'Partner', path: `/partners/${group.campus?.partner_id}` },
        { label: group.campus?.name || 'Plantel', path: `/partners/campuses/${group.campus_id}` },
        { label: group.name, path: `/partners/groups/${groupId}` },
        { label: 'Asignar Candidatos' },
      ]} />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex items-center fluid-gap-4">
          <button onClick={() => navigate(-1)} className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors"><ArrowLeft className="fluid-icon-lg" /></button>
          <div>
            <div className="flex items-center fluid-gap-2 fluid-text-sm text-white/80 fluid-mb-1">
              <ClipboardList className="fluid-icon-sm" /><span>{group.name}</span><span>•</span><span>{selectedExam.name}</span>
            </div>
            <h1 className="fluid-text-2xl font-bold">Paso 4: Asignar Miembros</h1>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center fluid-mb-6">
        <div className="flex items-center">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center fluid-text-sm font-semibold transition-all ${
                i < 3 ? 'bg-green-500 text-white' : i === 3 ? 'bg-blue-600 text-white ring-4 ring-blue-200 shadow-lg' : 'bg-gray-200 text-gray-600'
              }`}>{i < 3 ? <CheckCircle2 className="fluid-icon-base" /> : i + 1}</div>
              <span className={`ml-2 font-medium hidden sm:inline fluid-text-sm ${i === 3 ? 'text-blue-600' : i < 3 ? 'text-green-600' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < stepLabels.length - 1 && <div className={`w-8 md:w-12 h-1 rounded-full mx-2 transition-all ${i < 3 ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="fluid-mb-6 bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-start fluid-gap-3">
          <AlertCircle className="fluid-icon-base text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 fluid-text-base flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="fluid-icon-base" /></button>
        </div>
      )}

      {/* Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-p-5 fluid-mb-6">
        <div className="flex items-center justify-between flex-wrap fluid-gap-2">
          <div>
            <p className="fluid-text-sm text-gray-500">Examen</p>
            <p className="font-medium fluid-text-base">{selectedExam.name}</p>
          </div>
          <div className="text-center fluid-text-sm">
            <p className="text-gray-500">Materiales</p>
            <p className="font-medium text-blue-600">{selectedMaterialIds.length} seleccionados</p>
          </div>
          <div className="text-right fluid-text-sm text-gray-500">
            <p>{config.examContentType === 'questions_only' ? 'Solo preguntas' : config.examContentType === 'exercises_only' ? 'Solo ejercicios' : 'Mixto'}</p>
            <p>{config.maxAttempts} intento(s) • {config.maxDisconnections} desconexiones</p>
          </div>
        </div>
      </div>

      {/* Assignment type cards */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
        <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-4">¿A quién asignar el examen?</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4 fluid-mb-6">
          <div onClick={() => setAssignmentType('all')}
            className={`fluid-p-4 border-2 rounded-fluid-xl cursor-pointer transition-all ${assignmentType === 'all' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
            <div className="flex items-center fluid-gap-3">
              <Users className={`fluid-icon-lg ${assignmentType === 'all' ? 'text-blue-600' : 'text-gray-400'}`} />
              <div><h4 className="font-medium text-gray-900 fluid-text-base">Todo el Grupo</h4><p className="fluid-text-sm text-gray-500">Asignar a los {members.length} miembros</p></div>
            </div>
          </div>
          <div onClick={() => setAssignmentType('selected')}
            className={`fluid-p-4 border-2 rounded-fluid-xl cursor-pointer transition-all ${assignmentType === 'selected' ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
            <div className="flex items-center fluid-gap-3">
              <UserCheck className={`fluid-icon-lg ${assignmentType === 'selected' ? 'text-purple-600' : 'text-gray-400'}`} />
              <div><h4 className="font-medium text-gray-900 fluid-text-base">Candidatos Específicos</h4><p className="fluid-text-sm text-gray-500">Seleccionar manualmente</p></div>
            </div>
          </div>
          <div onClick={() => setAssignmentType('bulk')}
            className={`fluid-p-4 border-2 rounded-fluid-xl cursor-pointer transition-all ${assignmentType === 'bulk' ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
            <div className="flex items-center fluid-gap-3">
              <FileSpreadsheet className={`fluid-icon-lg ${assignmentType === 'bulk' ? 'text-green-600' : 'text-gray-400'}`} />
              <div><h4 className="font-medium text-gray-900 fluid-text-base">Carga Masiva</h4><p className="fluid-text-sm text-gray-500">Asignar por código ECM</p></div>
            </div>
          </div>
        </div>

        {/* Selected members list */}
        {assignmentType === 'selected' && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between fluid-mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 fluid-icon-sm" />
                <input type="text" placeholder="Buscar por nombre, email o CURP..." value={memberSearchQuery} onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm" />
              </div>
              <button onClick={handleSelectAllMembers} className="ml-4 fluid-text-sm text-blue-600 hover:text-blue-800 font-medium">
                {selectedMemberIds.length === members.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-fluid-xl">
              {filteredMembers.length > 0 ? filteredMembers.map((member) => (
                <div key={member.id} onClick={() => handleToggleMember(member.user_id)}
                  className={`fluid-p-3 flex items-center fluid-gap-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${selectedMemberIds.includes(member.user_id) ? 'bg-purple-50' : ''}`}>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedMemberIds.includes(member.user_id) ? 'bg-purple-500 border-purple-500 text-white' : 'border-gray-300'}`}>
                    {selectedMemberIds.includes(member.user_id) && <CheckCircle2 className="fluid-icon-sm" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium fluid-text-sm">{member.user?.full_name}</p>
                    <p className="fluid-text-xs text-gray-500">{member.user?.email}</p>
                    {member.user?.curp && <p className="fluid-text-xs text-gray-400 font-mono">{member.user.curp}</p>}
                  </div>
                </div>
              )) : (
                <div className="fluid-p-4 text-center text-gray-500 fluid-text-sm">No se encontraron miembros</div>
              )}
            </div>

            {selectedMemberIds.length > 0 && <p className="mt-2 fluid-text-sm text-purple-600">{selectedMemberIds.length} candidato(s) seleccionado(s)</p>}
          </div>
        )}

        {/* Bulk upload */}
        {assignmentType === 'bulk' && (
          <div className="border-t pt-4">
            <div className="bg-green-50 border border-green-200 rounded-fluid-xl fluid-p-4 fluid-mb-4">
              <h4 className="font-medium text-green-800 fluid-mb-2 flex items-center fluid-gap-2"><FileSpreadsheet className="fluid-icon-base" />Asignación Masiva por Código ECM</h4>
              <p className="fluid-text-sm text-green-700">Con esta opción puedes asignar diferentes exámenes a diferentes candidatos usando un archivo Excel. Cada candidato puede tener un código ECM distinto.</p>
            </div>

            {/* Step 1: Download template */}
            <div className="fluid-mb-4">
              <h5 className="font-medium text-gray-700 fluid-mb-2 fluid-text-base">1. Descarga la plantilla</h5>
              <button onClick={handleDownloadTemplate} disabled={downloadingTemplate}
                className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white border border-green-600 text-green-600 rounded-fluid-xl hover:bg-green-50 disabled:opacity-50 transition-all fluid-text-sm">
                {downloadingTemplate ? <><Loader2 className="fluid-icon-sm animate-spin" />Descargando...</> : <><Download className="fluid-icon-sm" />Descargar Plantilla Excel</>}
              </button>
              <p className="fluid-text-xs text-gray-500 mt-1">La plantilla incluye los miembros del grupo y un catálogo de códigos ECM disponibles.</p>
            </div>

            {/* Step 2: Upload file - auto-processes on selection */}
            <div className="fluid-mb-4">
              <h5 className="font-medium text-gray-700 fluid-mb-2 fluid-text-base">2. Completa y sube el archivo</h5>
              <div className="flex items-center fluid-gap-3">
                <label className={`flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-fluid-xl transition-all fluid-text-sm ${bulkUploading ? 'bg-gray-400 cursor-wait' : 'bg-green-600 hover:bg-green-700 cursor-pointer'} text-white`}>
                  {bulkUploading ? <><Loader2 className="fluid-icon-sm animate-spin" />Procesando...</> : <><Upload className="fluid-icon-sm" />Seleccionar Archivo</>}
                  <input type="file" accept=".xlsx,.xls" onChange={handleBulkFileChange} className="hidden" disabled={bulkUploading} />
                </label>
                {bulkFile && !bulkUploading && (
                  <div className="flex items-center fluid-gap-2 bg-gray-100 rounded-fluid-lg fluid-px-3 fluid-py-1.5">
                    <FileSpreadsheet className="fluid-icon-sm text-green-600" />
                    <span className="fluid-text-sm text-gray-700">{bulkFile.name}</span>
                    <button onClick={handleClearFile} className="ml-1 text-gray-400 hover:text-red-500 transition-colors" title="Quitar archivo">
                      <X className="fluid-icon-sm" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Preview / Results */}
            {(bulkPreview || bulkResult) && (() => {
              const source = bulkResult || bulkPreview!;
              const isPreview = !bulkResult && !!bulkPreview;
              return (
              <div className="mt-4 space-y-4">
                {/* Preview banner */}
                {isPreview && (
                  <div className="bg-blue-50 border-2 border-blue-300 rounded-fluid-xl fluid-p-4 flex items-start fluid-gap-3">
                    <AlertCircle className="fluid-icon-base text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h5 className="font-semibold text-blue-800 fluid-text-base">Vista Previa — Aún no se han creado asignaciones</h5>
                      <p className="fluid-text-sm text-blue-700 mt-1">Revisa el resumen a continuación. Cuando estés conforme, presiona <strong>"Confirmar Asignación"</strong> para aplicar los cambios.</p>
                    </div>
                  </div>
                )}

                <div className={`fluid-p-4 rounded-fluid-xl ${source.summary.errors > 0 ? 'bg-yellow-50 border border-yellow-200' : isPreview ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'}`}>
                  <h5 className={`font-medium fluid-mb-2 fluid-text-base ${source.summary.errors > 0 ? 'text-yellow-800' : isPreview ? 'text-blue-800' : 'text-green-800'}`}>
                    {isPreview ? `Vista previa: ${source.summary.assigned} asignaciones pendientes` : source.message}
                  </h5>
                  <div className="grid grid-cols-4 fluid-gap-4 fluid-text-sm">
                    <div><p className="text-gray-500">Procesados</p><p className="font-semibold fluid-text-lg">{source.summary.total_processed}</p></div>
                    <div><p className={isPreview ? 'text-blue-600' : 'text-green-600'}>{isPreview ? 'Se asignarán' : 'Asignados'}</p><p className={`font-semibold fluid-text-lg ${isPreview ? 'text-blue-700' : 'text-green-700'}`}>{source.summary.assigned}</p></div>
                    <div><p className="text-yellow-600">Omitidos</p><p className="font-semibold fluid-text-lg text-yellow-700">{source.summary.skipped}</p></div>
                    <div><p className="text-red-600">Errores</p><p className="font-semibold fluid-text-lg text-red-700">{source.summary.errors}</p></div>
                  </div>
                </div>

                {/* Barra de búsqueda global para tablas */}
                {(source.results.assigned.length > 0 || source.results.skipped.length > 0 || source.results.errors.length > 0) && (
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 fluid-icon-sm" />
                    <input type="text" placeholder="Buscar en resultados..." value={resultSearch} onChange={(e) => setResultSearch(e.target.value)}
                      className="w-full pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
                    {resultSearch && (
                      <button onClick={() => setResultSearch('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="fluid-icon-sm" />
                      </button>
                    )}
                  </div>
                )}

                {/* Tabla de asignaciones exitosas */}
                {source.results.assigned.length > 0 && (
                  <div className="bg-white border border-green-200 rounded-fluid-xl overflow-hidden">
                    <div className="bg-green-50 fluid-px-4 fluid-py-3 border-b border-green-200 flex items-center justify-between">
                      <div className="flex items-center fluid-gap-2">
                        <CheckCircle2 className="fluid-icon-base text-green-600" />
                        <h5 className="font-medium text-green-800 fluid-text-sm">{isPreview ? 'Candidatos que se Asignarán' : 'Candidatos Asignados Exitosamente'} ({filteredAssigned.length}{resultSearch ? ` de ${source.results.assigned.length}` : ''})</h5>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="max-h-72 overflow-y-auto">
                        <table className="w-full fluid-text-sm min-w-[600px]">
                          <thead className="bg-green-50/50 sticky top-0 z-10">
                            <tr>
                              <th onClick={() => toggleSort('assigned', 'row')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Fila<SortIcon table="assigned" column="row" /></th>
                              <th onClick={() => toggleSort('assigned', 'user_name')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Nombre<SortIcon table="assigned" column="user_name" /></th>
                              <th onClick={() => toggleSort('assigned', 'email')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Email<SortIcon table="assigned" column="email" /></th>
                              <th onClick={() => toggleSort('assigned', 'curp')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">CURP<SortIcon table="assigned" column="curp" /></th>
                              <th onClick={() => toggleSort('assigned', 'exam_name')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Examen<SortIcon table="assigned" column="exam_name" /></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-green-100">
                            {filteredAssigned.map((item, i) => (
                              <tr key={i} className="hover:bg-green-50/30">
                                <td className="fluid-px-4 fluid-py-2 text-gray-500 font-mono">{item.row}</td>
                                <td className="fluid-px-4 fluid-py-2 font-medium text-gray-900 whitespace-nowrap">{item.user_name || item.username || '-'}</td>
                                <td className="fluid-px-4 fluid-py-2 text-gray-600">{item.email || '-'}</td>
                                <td className="fluid-px-4 fluid-py-2 text-gray-500 font-mono text-xs">{item.curp || '-'}</td>
                                <td className="fluid-px-4 fluid-py-2 text-green-700">{item.exam_name}</td>
                              </tr>
                            ))}
                            {filteredAssigned.length === 0 && resultSearch && (
                              <tr><td colSpan={5} className="fluid-px-4 fluid-py-3 text-center text-gray-400 fluid-text-sm">Sin coincidencias</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tabla de omitidos */}
                {source.results.skipped.length > 0 && (
                  <div className="bg-white border border-yellow-200 rounded-fluid-xl overflow-hidden">
                    <div className="bg-yellow-50 fluid-px-4 fluid-py-3 border-b border-yellow-200 flex items-center justify-between">
                      <div className="flex items-center fluid-gap-2">
                        <AlertCircle className="fluid-icon-base text-yellow-600" />
                        <h5 className="font-medium text-yellow-800 fluid-text-sm">Candidatos Omitidos ({filteredSkipped.length}{resultSearch ? ` de ${source.results.skipped.length}` : ''})</h5>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="max-h-56 overflow-y-auto">
                        <table className="w-full fluid-text-sm min-w-[500px]">
                          <thead className="bg-yellow-50/50 sticky top-0 z-10">
                            <tr>
                              <th onClick={() => toggleSort('skipped', 'row')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Fila<SortIcon table="skipped" column="row" /></th>
                              <th onClick={() => toggleSort('skipped', 'user_name')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Nombre<SortIcon table="skipped" column="user_name" /></th>
                              <th onClick={() => toggleSort('skipped', 'email')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Email<SortIcon table="skipped" column="email" /></th>
                              <th onClick={() => toggleSort('skipped', 'reason')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Motivo<SortIcon table="skipped" column="reason" /></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-yellow-100">
                            {filteredSkipped.map((item, i) => (
                              <tr key={i} className="hover:bg-yellow-50/30">
                                <td className="fluid-px-4 fluid-py-2 text-gray-500 font-mono">{item.row}</td>
                                <td className="fluid-px-4 fluid-py-2 font-medium text-gray-900 whitespace-nowrap">{item.user_name || item.username || '-'}</td>
                                <td className="fluid-px-4 fluid-py-2 text-gray-600">{item.email || '-'}</td>
                                <td className="fluid-px-4 fluid-py-2 text-yellow-700">{item.reason}</td>
                              </tr>
                            ))}
                            {filteredSkipped.length === 0 && resultSearch && (
                              <tr><td colSpan={4} className="fluid-px-4 fluid-py-3 text-center text-gray-400 fluid-text-sm">Sin coincidencias</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tabla de errores */}
                {source.results.errors.length > 0 && (
                  <div className="bg-white border border-red-200 rounded-fluid-xl overflow-hidden">
                    <div className="bg-red-50 fluid-px-4 fluid-py-3 border-b border-red-200 flex items-center justify-between">
                      <div className="flex items-center fluid-gap-2">
                        <AlertCircle className="fluid-icon-base text-red-600" />
                        <h5 className="font-medium text-red-800 fluid-text-sm">Candidatos No Encontrados ({filteredErrors.length}{resultSearch ? ` de ${source.results.errors.length}` : ''})</h5>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="max-h-56 overflow-y-auto">
                        <table className="w-full fluid-text-sm min-w-[400px]">
                          <thead className="bg-red-50/50 sticky top-0 z-10">
                            <tr>
                              <th onClick={() => toggleSort('errors', 'row')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Fila<SortIcon table="errors" column="row" /></th>
                              <th onClick={() => toggleSort('errors', 'user_name')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Candidato<SortIcon table="errors" column="user_name" /></th>
                              <th onClick={() => toggleSort('errors', 'error')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Error<SortIcon table="errors" column="error" /></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100">
                            {filteredErrors.map((item, i) => (
                              <tr key={i} className="hover:bg-red-50/30">
                                <td className="fluid-px-4 fluid-py-2 text-gray-500 font-mono">{item.row}</td>
                                <td className="fluid-px-4 fluid-py-2 font-medium text-gray-900 whitespace-nowrap">{item.user_name || item.identifier || '-'}</td>
                                <td className="fluid-px-4 fluid-py-2 text-red-600">{item.error}</td>
                              </tr>
                            ))}
                            {filteredErrors.length === 0 && resultSearch && (
                              <tr><td colSpan={3} className="fluid-px-4 fluid-py-3 text-center text-gray-400 fluid-text-sm">Sin coincidencias</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botones de acción */}
                {isPreview && source.summary.assigned > 0 && (
                  <div className="flex items-center justify-center fluid-gap-4 mt-6 pt-4 border-t border-gray-200">
                    <button onClick={handleClearFile} className="fluid-px-5 fluid-py-3 border border-gray-300 text-gray-700 rounded-fluid-xl hover:bg-gray-50 fluid-text-sm font-medium transition-all">
                      Cancelar y Cambiar Archivo
                    </button>
                    <button onClick={handleConfirmBulkAssign} disabled={bulkConfirming}
                      className="fluid-px-8 fluid-py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-fluid-xl hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center fluid-gap-2 fluid-text-sm font-semibold shadow-lg transition-all">
                      {bulkConfirming ? <><Loader2 className="fluid-icon-sm animate-spin" />Asignando candidatos...</> : <><CheckCircle2 className="fluid-icon-sm" />Confirmar Asignación ({source.summary.assigned} candidatos)</>}
                    </button>
                  </div>
                )}

                {!isPreview && source.summary.assigned > 0 && (
                  <div className="flex justify-center mt-4">
                    <Link to={`/partners/groups/${groupId}`} className="fluid-px-6 fluid-py-3 bg-blue-600 text-white rounded-fluid-xl hover:bg-blue-700 fluid-text-sm font-medium shadow-lg transition-all">
                      Volver al Detalle del Grupo
                    </Link>
                  </div>
                )}
              </div>
              );
            })()}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-6 mt-6 border-t">
          <button onClick={() => navigate(-1)} className="fluid-px-4 fluid-py-2 text-gray-600 hover:text-gray-900 fluid-text-sm font-medium transition-colors">← Volver</button>
          {assignmentType !== 'bulk' && (
            <button onClick={handleGoToReview} disabled={loadingCostPreview || (assignmentType === 'selected' && selectedMemberIds.length === 0)}
              className="fluid-px-6 fluid-py-3 bg-blue-600 text-white rounded-fluid-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center fluid-gap-2 fluid-text-sm font-medium shadow-lg transition-all">
              {loadingCostPreview ? <><Loader2 className="fluid-icon-sm animate-spin" />Calculando costo...</> : <><DollarSign className="fluid-icon-sm" />Revisar Costo y Confirmar</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
