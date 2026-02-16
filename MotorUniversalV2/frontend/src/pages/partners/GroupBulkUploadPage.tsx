/**
 * Página de Carga Masiva de Candidatos desde Excel
 * Permite descargar plantilla, subir archivo y previsualizar antes de confirmar
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Download,
  Upload,
  UserPlus,
  Mail,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  FileSpreadsheet,
  AlertTriangle,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import CandidateAssignmentSuccessModal from './CandidateAssignmentSuccessModal';
import type { BulkUploadResult } from './CandidateAssignmentSuccessModal';
import {
  getGroup,
  getGroupMembersCount,
  uploadGroupMembersExcel,
  downloadGroupMembersTemplate,
  previewGroupMembersExcel,
  CandidateGroup,
  ExcelPreviewResult,
} from '../../services/partnersService';

export default function GroupBulkUploadPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  // Estado del grupo
  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [currentMemberCount, setCurrentMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Estado de carga masiva con preview
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState<ExcelPreviewResult | null>(null);
  const [processingUpload, setProcessingUpload] = useState(false);

  // Mensajes
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Ref para scroll automático al preview
  const previewRef = useRef<HTMLDivElement>(null);

  // Modal de éxito
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bulkModalResult, setBulkModalResult] = useState<BulkUploadResult | null>(null);
  const [candidateInfoMap, setCandidateInfoMap] = useState<Map<string, { full_name: string; email: string; curp?: string }>>(new Map());

  // Estado de búsqueda y ordenamiento en preview
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewSortCol, setPreviewSortCol] = useState<string>('row');
  const [previewSortDir, setPreviewSortDir] = useState<'asc' | 'desc'>('asc');

  // Cargar grupo
  useEffect(() => {
    const loadGroup = async () => {
      try {
        const [groupData, memberCountData] = await Promise.all([
          getGroup(Number(groupId)),
          getGroupMembersCount(Number(groupId)),
        ]);
        setGroup(groupData);
        setCurrentMemberCount(memberCountData.count);
      } catch (err: any) {
        setError('Error al cargar el grupo');
      } finally {
        setLoading(false);
      }
    };
    if (groupId) loadGroup();
  }, [groupId]);

  // Preview: filtrar y ordenar
  const filteredPreview = useMemo(() => {
    if (!previewData) return [];
    let rows = [...previewData.preview];
    if (previewSearch) {
      const s = previewSearch.toLowerCase();
      rows = rows.filter(r =>
        r.identifier.toLowerCase().includes(s) ||
        r.user?.full_name?.toLowerCase().includes(s) ||
        r.user?.email?.toLowerCase().includes(s) ||
        r.user?.curp?.toLowerCase().includes(s) ||
        r.user?.username?.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s) ||
        (r.error || '').toLowerCase().includes(s)
      );
    }
    rows.sort((a, b) => {
      let va: string | number = 0, vb: string | number = 0;
      switch (previewSortCol) {
        case 'row': va = a.row; vb = b.row; break;
        case 'status': va = a.status; vb = b.status; break;
        case 'identifier': va = a.identifier; vb = b.identifier; break;
        case 'name': va = a.user?.name || ''; vb = b.user?.name || ''; break;
        case 'first_surname': va = a.user?.first_surname || ''; vb = b.user?.first_surname || ''; break;
        case 'second_surname': va = a.user?.second_surname || ''; vb = b.user?.second_surname || ''; break;
        case 'email': va = a.user?.email || ''; vb = b.user?.email || ''; break;
        case 'curp': va = a.user?.curp || ''; vb = b.user?.curp || ''; break;
        case 'gender': va = a.user?.gender || ''; vb = b.user?.gender || ''; break;
        default: va = a.row; vb = b.row;
      }
      if (typeof va === 'string') {
        return previewSortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      }
      return previewSortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return rows;
  }, [previewData, previewSearch, previewSortCol, previewSortDir]);

  const handlePreviewSort = (col: string) => {
    if (previewSortCol === col) {
      setPreviewSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setPreviewSortCol(col);
      setPreviewSortDir('asc');
    }
  };

  const renderEligibilityBadges = (email?: string | null, curp?: string | null) => {
    const badges = [
      { label: 'RE', title: 'Reporte de Evaluación', eligible: true },
      { label: 'CE', title: 'Certificado EDUIT', eligible: true },
      { label: 'CC', title: 'Certificado CONOCER', eligible: !!curp, requirement: 'Requiere CURP' },
      { label: 'ID', title: 'Insignia Digital', eligible: !!email, requirement: 'Requiere email' },
    ];
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {badges.map(b => (
          <span
            key={b.label}
            title={b.eligible ? `${b.title}: Elegible` : `${b.title}: No elegible — ${b.requirement}`}
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none ${
              b.eligible
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-400 border border-red-200 line-through'
            }`}
          >
            {b.label}
          </span>
        ))}
      </div>
    );
  };

  // Handlers
  const handleDownloadTemplate = async () => {
    try {
      await downloadGroupMembersTemplate();
    } catch (err: any) {
      setError('Error al descargar la plantilla');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setUploadFile(file);
      setPreviewData(null);

      try {
        setUploading(true);
        setError(null);
        const preview = await previewGroupMembersExcel(Number(groupId), file);
        setPreviewData(preview);

        setTimeout(() => {
          previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al procesar el archivo');
      } finally {
        setUploading(false);
      }
    } else if (file) {
      setError('Por favor selecciona un archivo Excel (.xlsx o .xls)');
    }
    e.target.value = '';
  };

  const handleProcessExcel = async () => {
    if (!uploadFile) return;

    try {
      setProcessingUpload(true);
      setError(null);

      const result = await uploadGroupMembersExcel(Number(groupId), uploadFile, 'add');

      const addedCount = result.added?.length || 0;
      const errorsCount = result.errors?.length || 0;

      if (addedCount > 0) {
        // Build candidate info map from preview data
        const infoMap = new Map<string, { full_name: string; email: string; curp?: string }>();
        if (previewData) {
          for (const row of previewData.preview) {
            if (row.user && row.status === 'ready') {
              infoMap.set(row.user.id, {
                full_name: row.user.full_name,
                email: row.user.email,
                curp: row.user.curp,
              });
            }
          }
        }
        setCandidateInfoMap(infoMap);
        setBulkModalResult({
          added: result.added || [],
          errors: result.errors || [],
          total_processed: result.total_processed || 0,
        });
        setShowSuccessModal(true);
        setCurrentMemberCount(prev => prev + addedCount);
        setUploadFile(null);
        setPreviewData(null);
      } else if (errorsCount > 0) {
        setError(`${errorsCount} candidato(s) con errores. Ninguno fue agregado.`);
      } else {
        setSuccessMessage('Todos los candidatos del archivo ya eran miembros del grupo.');
        setUploadFile(null);
        setPreviewData(null);
      }

      if (addedCount > 0 && errorsCount > 0) {
        setError(`${errorsCount} candidato(s) con errores`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar el archivo');
    } finally {
      setProcessingUpload(false);
    }
  };

  const handleResetUpload = () => {
    setUploadFile(null);
    setPreviewData(null);
  };

  if (loading) {
    return <LoadingSpinner message="Cargando grupo..." fullScreen />;
  }

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <PartnersBreadcrumb
        items={[
          { label: group?.campus?.partner?.name || 'Partner', path: `/partners/${group?.campus?.partner_id}` },
          { label: group?.campus?.name || 'Plantel', path: `/partners/campuses/${group?.campus_id}` },
          { label: group?.name || 'Grupo', path: `/partners/groups/${groupId}` },
          { label: 'Asignar Candidatos', path: `/partners/groups/${groupId}/assign-candidates` },
          { label: 'Carga Masiva Excel' },
        ]}
      />

      {/* ===== HEADER CON GRADIENTE ===== */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
            <div className="flex items-center fluid-gap-4">
              <Link
                to={`/partners/groups/${groupId}/assign-candidates`}
                className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors"
              >
                <ArrowLeft className="fluid-icon-lg" />
              </Link>
              <div>
                <p className="fluid-text-sm text-white/80 fluid-mb-1">{group?.name}</p>
                <h1 className="fluid-text-2xl font-bold flex items-center fluid-gap-3">
                  <FileSpreadsheet className="fluid-icon-lg" />
                  Carga Masiva desde Excel
                </h1>
              </div>
            </div>
          </div>

          {/* Stats en header */}
          <div className="grid grid-cols-2 fluid-gap-4 fluid-mt-5">
            <div className="bg-white/10 rounded-fluid-xl fluid-p-3 text-center backdrop-blur-sm">
              <p className="fluid-text-xl font-bold">{currentMemberCount}</p>
              <p className="fluid-text-xs text-white/70">Miembros Actuales</p>
            </div>
            <div className="bg-white/10 rounded-fluid-xl fluid-p-3 text-center backdrop-blur-sm">
              <p className="fluid-text-xl font-bold">{previewData?.summary.ready || 0}</p>
              <p className="fluid-text-xs text-white/70">Listos para asignar</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== MENSAJES DE ESTADO ===== */}
      {(error || successMessage) && (
        <div className="fluid-mb-4">
          {error && (
            <div className="fluid-p-3 bg-red-50 border border-red-200 rounded-fluid-lg flex items-center fluid-gap-2 text-red-700">
              <XCircle className="fluid-icon flex-shrink-0" />
              <p className="fluid-text-sm flex-1">{error}</p>
              <button onClick={() => setError(null)}>
                <X className="fluid-icon-sm" />
              </button>
            </div>
          )}
          {successMessage && (
            <div className="fluid-p-3 bg-green-50 border border-green-200 rounded-fluid-lg flex items-center fluid-gap-2 text-green-700">
              <CheckCircle2 className="fluid-icon flex-shrink-0" />
              <p className="fluid-text-sm flex-1">{successMessage}</p>
              <button onClick={() => setSuccessMessage(null)}>
                <X className="fluid-icon-sm" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== PASOS ===== */}
      <div className="max-w-4xl mx-auto">
        {/* Paso 1: Descargar plantilla */}
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-6 fluid-mb-6">
          <div className="flex items-start fluid-gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Download className="fluid-icon text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 fluid-mb-1">Paso 1: Descargar Plantilla</h3>
              <p className="fluid-text-sm text-gray-600 fluid-mb-4">
                Descarga la plantilla Excel, llena la columna con el identificador de cada candidato: email, CURP, nombre de usuario o nombre completo.
              </p>
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-fluid-lg font-medium transition-colors"
              >
                <Download className="fluid-icon-sm" />
                Descargar Plantilla
              </button>
            </div>
          </div>
        </div>

        {/* Paso 2: Subir archivo */}
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-6 fluid-mb-6">
          <div className="flex items-start fluid-gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Upload className="fluid-icon text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 fluid-mb-1">Paso 2: Subir Archivo</h3>
              <p className="fluid-text-sm text-gray-600 fluid-mb-4">
                Selecciona el archivo Excel completado. La previsualización se carga automáticamente.
                Los candidatos se agregarán a este grupo (pueden pertenecer a otros grupos simultáneamente).
              </p>

              {/* Selector de archivo */}
              <div className="flex items-center fluid-gap-4">
                <label className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-fluid-lg font-medium transition-colors cursor-pointer">
                  <Upload className="fluid-icon-sm" />
                  {uploadFile ? 'Cambiar archivo' : 'Seleccionar archivo'}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {uploadFile && (
                  <div className="flex items-center fluid-gap-3">
                    <span className="fluid-text-sm text-gray-600 bg-gray-100 fluid-px-3 py-1.5 rounded-fluid-lg flex items-center fluid-gap-2">
                      <FileSpreadsheet className="fluid-icon-sm text-purple-600" />
                      {uploadFile.name}
                    </span>
                    {uploading && <Loader2 className="fluid-icon-sm animate-spin text-purple-600" />}
                    <button
                      onClick={handleResetUpload}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="fluid-icon-sm" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Paso 3: Preview y confirmar */}
        {previewData && (
          <div ref={previewRef} className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-6">
            <div className="flex items-start fluid-gap-4 fluid-mb-6">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="fluid-icon text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 fluid-mb-1">Paso 3: Confirmar Asignación</h3>
                <p className="fluid-text-sm text-gray-600">
                  Revisa el resumen antes de confirmar. Solo se asignarán los candidatos marcados como "Listo".
                </p>
              </div>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 fluid-gap-4 fluid-mb-6">
              <div className="bg-gray-50 rounded-fluid-lg fluid-p-4 text-center">
                <p className="fluid-text-2xl font-bold text-gray-900">{previewData.summary.total}</p>
                <p className="fluid-text-xs text-gray-500">Total filas</p>
              </div>
              <div className="bg-green-50 rounded-fluid-lg fluid-p-4 text-center">
                <p className="fluid-text-2xl font-bold text-green-600">{previewData.summary.ready}</p>
                <p className="fluid-text-xs text-green-600">Listos</p>
              </div>
              <div className="bg-yellow-50 rounded-fluid-lg fluid-p-4 text-center">
                <p className="fluid-text-2xl font-bold text-yellow-600">{previewData.summary.already_member}</p>
                <p className="fluid-text-xs text-yellow-600">Ya miembros</p>
              </div>
              <div className="bg-red-50 rounded-fluid-lg fluid-p-4 text-center">
                <p className="fluid-text-2xl font-bold text-red-600">{previewData.summary.not_found}</p>
                <p className="fluid-text-xs text-red-600">No encontrados</p>
              </div>
            </div>

            {/* Buscador en preview */}
            <div className="relative fluid-mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
              <input
                type="text"
                value={previewSearch}
                onChange={(e) => setPreviewSearch(e.target.value)}
                placeholder="Buscar en la previsualización por nombre, email, CURP..."
                className="w-full pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              {previewSearch && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 fluid-text-xs text-gray-400">
                  {filteredPreview.length} de {previewData.preview.length}
                </span>
              )}
            </div>

            {/* Lista de preview — tabla completa */}
            <div className="border border-gray-200 rounded-fluid-lg overflow-hidden fluid-mb-6">
              <div className="max-h-[28rem] overflow-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {[
                        { key: 'row', label: '#', cls: 'w-12' },
                        { key: 'status', label: 'Estado', cls: 'w-20' },
                        { key: 'identifier', label: 'Identificador', cls: '' },
                        { key: 'name', label: 'Nombre', cls: '' },
                        { key: 'first_surname', label: 'Ap. Paterno', cls: '' },
                        { key: 'second_surname', label: 'Ap. Materno', cls: '' },
                        { key: 'email', label: 'Email', cls: '' },
                        { key: 'curp', label: 'CURP', cls: '' },
                        { key: 'gender', label: 'Género', cls: 'w-20' },
                      ].map(col => (
                        <th
                          key={col.key}
                          onClick={() => handlePreviewSort(col.key)}
                          className={`fluid-px-3 fluid-py-2 fluid-text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap ${col.cls}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            {previewSortCol === col.key ? (
                              previewSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-30" />
                            )}
                          </span>
                        </th>
                      ))}
                      <th className="fluid-px-3 fluid-py-2 fluid-text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Elegibilidad</th>
                      <th className="fluid-px-3 fluid-py-2 fluid-text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Mensaje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredPreview.map((row) => (
                      <tr key={row.row} className={
                        row.status === 'ready' ? 'bg-green-50' :
                        row.status === 'already_member' ? 'bg-yellow-50' : 'bg-red-50'
                      }>
                        <td className="fluid-px-3 fluid-py-2 fluid-text-xs text-gray-500 font-mono">{row.row}</td>
                        <td className="fluid-px-3 fluid-py-2">
                          {row.status === 'ready' && <span className="inline-flex items-center gap-1 text-green-600 fluid-text-xs font-medium"><Check className="h-3.5 w-3.5" /> Listo</span>}
                          {row.status === 'already_member' && <span className="inline-flex items-center gap-1 text-yellow-600 fluid-text-xs font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Ya</span>}
                          {row.status === 'not_found' && <span className="inline-flex items-center gap-1 text-red-600 fluid-text-xs font-medium"><XCircle className="h-3.5 w-3.5" /> No</span>}
                        </td>
                        <td className="fluid-px-3 fluid-py-2 fluid-text-xs font-mono text-gray-700 whitespace-nowrap">{row.identifier}</td>
                        <td className="fluid-px-3 fluid-py-2 fluid-text-sm text-gray-900 whitespace-nowrap">{row.user?.name || '-'}</td>
                        <td className="fluid-px-3 fluid-py-2 fluid-text-sm text-gray-900 whitespace-nowrap">{row.user?.first_surname || '-'}</td>
                        <td className="fluid-px-3 fluid-py-2 fluid-text-sm text-gray-900 whitespace-nowrap">{row.user?.second_surname || '-'}</td>
                        <td className="fluid-px-3 fluid-py-2 fluid-text-xs text-gray-600 whitespace-nowrap">
                          {row.user?.email ? (
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-gray-400" />{row.user.email}</span>
                          ) : '-'}
                        </td>
                        <td className="fluid-px-3 fluid-py-2 fluid-text-xs text-gray-600 font-mono whitespace-nowrap">
                          {row.user?.curp || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="fluid-px-3 fluid-py-2 fluid-text-xs text-gray-600 whitespace-nowrap">
                          {row.user?.gender === 'M' ? 'Masc' : row.user?.gender === 'F' ? 'Fem' : row.user?.gender === 'O' ? 'Otro' : '-'}
                        </td>
                        <td className="fluid-px-3 fluid-py-2">
                          {row.user ? renderEligibilityBadges(row.user.email, row.user.curp) : '-'}
                        </td>
                        <td className="fluid-px-3 fluid-py-2 fluid-text-xs text-gray-500 max-w-[200px] truncate" title={row.status === 'ready' ? 'Listo para asignar' : row.error}>
                          {row.status === 'ready' ? 'Listo para asignar' : row.error}
                        </td>
                      </tr>
                    ))}
                    {filteredPreview.length === 0 && previewSearch && (
                      <tr>
                        <td colSpan={11} className="fluid-px-4 fluid-py-8 text-center text-gray-400 fluid-text-sm">
                          No se encontraron filas que coincidan con "{previewSearch}"
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Botón de confirmación */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleResetUpload}
                className="fluid-px-4 fluid-py-2 border border-gray-300 text-gray-700 rounded-fluid-lg hover:bg-gray-50"
              >
                Cancelar
              </button>

              <button
                onClick={handleProcessExcel}
                disabled={!previewData.can_proceed || processingUpload}
                className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-fluid-lg font-medium transition-colors"
              >
                {processingUpload ? (
                  <Loader2 className="fluid-icon-sm animate-spin" />
                ) : (
                  <UserPlus className="fluid-icon-sm" />
                )}
                Asignar {previewData.summary.ready} candidato(s)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de éxito */}
      <CandidateAssignmentSuccessModal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        groupName={group?.name || ''}
        bulkResult={bulkModalResult || undefined}
        candidateInfoMap={candidateInfoMap}
        onNavigateToGroup={() => navigate(`/partners/groups/${groupId}`)}
      />
    </div>
  );
}
