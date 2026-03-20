/**
 * Página de Edición de Miembros de Asignación (con paginación server-side)
 * Muestra los candidatos asignados a un examen con su número de asignación.
 * Solo permite reasignar (swap) si el candidato no tiene >=15% de avance ni ha abierto examen/simulador.
 * Paginación, búsqueda, filtros y ordenamiento server-side idénticos a GroupMembersPage.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  X,
  Search,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock,
  Repeat2,
  ClipboardList,
  Shield,
  AlertTriangle,
  Hash,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Filter,
  RotateCcw,
  Eye,
  UserPlus,
  Upload,
  Download,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import { useGroupBasePath } from '../../hooks/useGroupBasePath';
import {
  getGroup,
  getExamMembersDetail,
  swapExamMember,
  bulkSwapExamMembers,
  previewEcmRetake,
  applyEcmRetake,
  CandidateGroup,
  GroupMember,
  ExamMemberDetail,
  ExamMembersDetailResponse,
  RetakePreviewResponse,
  BulkSwapPair,
  BulkSwapResponse,
  addAssignmentsToExam,
  AddAssignmentsResult,
  bulkAssignExamsByECM,
  BulkExamAssignResult,
  downloadBulkExamAssignTemplate,
} from '../../services/partnersService';

type SortField = 'name' | 'email' | 'curp' | 'assignment_number' | 'progress' | 'status';
type SortDir = 'asc' | 'desc';

export default function GroupEditAssignmentMembersPage() {
  const { groupId, assignmentId } = useParams();
  const [searchParams] = useSearchParams();
  const assignmentName = searchParams.get('name') || '';
  const { isResponsable, canManage, basePath } = useGroupBasePath(groupId);
  const navigate = useNavigate();

  useEffect(() => {
    if (isResponsable && !canManage) navigate(basePath, { replace: true });
  }, [isResponsable, canManage, navigate, basePath]);

  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [detailData, setDetailData] = useState<ExamMembersDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Búsqueda y filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'locked' | 'swappable'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Paginación server-side
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(150);
  const [pageSizeInput, setPageSizeInput] = useState('150');
  const [pageInputValue, setPageInputValue] = useState('1');
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Ordenamiento server-side
  const [sortCol, setSortCol] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Swap modal
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapFrom, setSwapFrom] = useState<ExamMemberDetail | null>(null);
  const [swapToUserId, setSwapToUserId] = useState<string>('');
  const [swapSearch, setSwapSearch] = useState('');
  const [swapping, setSwapping] = useState(false);
  const [swapCandidates, setSwapCandidates] = useState<GroupMember[]>([]);
  const [swapSearching, setSwapSearching] = useState(false);
  const [swapTotalResults, setSwapTotalResults] = useState(0);

  // Retake modal
  const [showRetakeModal, setShowRetakeModal] = useState(false);
  const [retakeTarget, setRetakeTarget] = useState<ExamMemberDetail | null>(null);
  const [retakePreview, setRetakePreview] = useState<RetakePreviewResponse | null>(null);
  const [retakeLoading, setRetakeLoading] = useState(false);
  const [applyingRetake, setApplyingRetake] = useState(false);

  // Bulk swap
  const [selectedForSwap, setSelectedForSwap] = useState<Set<string>>(new Set());
  const [showBulkSwapModal, setShowBulkSwapModal] = useState(false);
  const [bulkSwapStep, setBulkSwapStep] = useState<1 | 2>(1);
  const [bulkReplacements, setBulkReplacements] = useState<string[]>([]);
  const [bulkSwapping, setBulkSwapping] = useState(false);
  const [bulkSwapResults, setBulkSwapResults] = useState<BulkSwapResponse | null>(null);
  const [bulkSwapSearch, setBulkSwapSearch] = useState('');
  const [bulkSwapCandidates, setBulkSwapCandidates] = useState<GroupMember[]>([]);
  const [bulkSwapSearching, setBulkSwapSearching] = useState(false);
  const [bulkSwapTotalResults, setBulkSwapTotalResults] = useState(0);

  // Assign modal (agregar asignaciones nuevas)
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignCandidates, setAssignCandidates] = useState<GroupMember[]>([]);
  const [assignSearching, setAssignSearching] = useState(false);
  const [assignTotalResults, setAssignTotalResults] = useState(0);
  const [selectedForAssign, setSelectedForAssign] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [assignResults, setAssignResults] = useState<AddAssignmentsResult | null>(null);

  // Bulk upload modal (carga masiva Excel)
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);
  const [bulkUploadPreview, setBulkUploadPreview] = useState<BulkExamAssignResult | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<BulkExamAssignResult | null>(null);
  const [bulkUploadStep, setBulkUploadStep] = useState<1 | 2 | 3>(1);

  // Race condition prevention
  const searchRequestRef = useRef(0);
  const swapSearchRef = useRef(0);
  const bulkSwapSearchRef = useRef(0);
  const assignSearchRef = useRef(0);

  // Carga inicial del grupo
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const groupData = await getGroup(Number(groupId));
        setGroup(groupData);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar el grupo');
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  // Búsqueda server-side de candidatos para swap — solo miembros SIN número de asignación
  const loadSwapCandidates = useCallback(async (search: string) => {
    const reqId = ++swapSearchRef.current;
    try {
      setSwapSearching(true);
      const res = await getExamMembersDetail(Number(groupId), Number(assignmentId), {
        per_page: 200,
        search: search || undefined,
      });
      if (reqId !== swapSearchRef.current) return;
      // Only show candidates WITHOUT assignment_number AND not locked (eligible to receive one)
      const eligible = res.members
        .filter(m => !m.assignment_number && !m.is_locked)
        .map(m => ({
          id: 0,
          group_id: Number(groupId),
          user_id: m.user_id,
          status: 'active' as const,
          joined_at: '',
          user: m.user ? {
            id: m.user.id,
            email: m.user.email,
            name: m.user.name,
            first_surname: m.user.first_surname,
            second_surname: m.user.second_surname || '',
            full_name: m.user.full_name,
            curp: m.user.curp || undefined,
            is_active: true,
          } : undefined,
        }));
      setSwapCandidates(eligible);
      setSwapTotalResults(eligible.length);
    } catch {
      if (reqId !== swapSearchRef.current) return;
    } finally {
      if (reqId === swapSearchRef.current) setSwapSearching(false);
    }
  }, [groupId, assignmentId]);

  // Cargar candidatos cuando se abre el modal o cambia la búsqueda
  useEffect(() => {
    if (!showSwapModal) return;
    const timer = setTimeout(() => loadSwapCandidates(swapSearch), 400);
    return () => clearTimeout(timer);
  }, [showSwapModal, swapSearch, loadSwapCandidates]);

  // Búsqueda de candidatos para bulk swap — solo miembros SIN número de asignación
  const loadBulkSwapCandidates = useCallback(async (search: string) => {
    const reqId = ++bulkSwapSearchRef.current;
    try {
      setBulkSwapSearching(true);
      const res = await getExamMembersDetail(Number(groupId), Number(assignmentId), {
        per_page: 200,
        search: search || undefined,
      });
      if (reqId !== bulkSwapSearchRef.current) return;
      const eligible = res.members
        .filter(m => !m.assignment_number && !m.is_locked)
        .map(m => ({
          id: 0,
          group_id: Number(groupId),
          user_id: m.user_id,
          status: 'active' as const,
          joined_at: '',
          user: m.user ? {
            id: m.user.id,
            email: m.user.email,
            name: m.user.name,
            first_surname: m.user.first_surname,
            second_surname: m.user.second_surname || '',
            full_name: m.user.full_name,
            curp: m.user.curp || undefined,
            is_active: true,
          } : undefined,
        }));
      setBulkSwapCandidates(eligible);
      setBulkSwapTotalResults(eligible.length);
    } catch {
      if (reqId !== bulkSwapSearchRef.current) return;
    } finally {
      if (reqId === bulkSwapSearchRef.current) setBulkSwapSearching(false);
    }
  }, [groupId, assignmentId]);

  useEffect(() => {
    if (!showBulkSwapModal || bulkSwapStep !== 1) return;
    const timer = setTimeout(() => loadBulkSwapCandidates(bulkSwapSearch), 400);
    return () => clearTimeout(timer);
  }, [showBulkSwapModal, bulkSwapStep, bulkSwapSearch, loadBulkSwapCandidates]);

  // Limpiar selección al cambiar página/filtros/búsqueda
  useEffect(() => {
    setSelectedForSwap(new Set());
  }, [currentPage, pageSize, filterStatus, searchQuery, sortCol, sortDir]);

  // Búsqueda server-side con paginación
  const handleSearch = useCallback(async (page: number = 1, perPage: number = pageSize) => {
    const requestId = ++searchRequestRef.current;
    try {
      setSearching(true);

      const detail = await getExamMembersDetail(Number(groupId), Number(assignmentId), {
        page,
        per_page: perPage,
        search: searchQuery || undefined,
        sort_by: sortCol,
        sort_dir: sortDir,
        filter_status: filterStatus !== 'all' ? filterStatus : undefined,
      });

      if (requestId !== searchRequestRef.current) return;

      setDetailData(detail);
      setTotalPages(detail.pages);
      setTotalResults(detail.total);
      setCurrentPage(page);
    } catch (err: any) {
      if (requestId !== searchRequestRef.current) return;
      setError(err.response?.data?.error || 'Error al cargar los miembros');
    } finally {
      if (requestId === searchRequestRef.current) {
        setSearching(false);
      }
    }
  }, [groupId, assignmentId, searchQuery, pageSize, sortCol, sortDir, filterStatus]);

  // Debounce de búsqueda (400ms)
  useEffect(() => {
    const timer = setTimeout(() => handleSearch(1, pageSize), 400);
    return () => clearTimeout(timer);
  }, [handleSearch, pageSize]);

  // Sincronizar pageInputValue con currentPage
  useEffect(() => {
    setPageInputValue(String(currentPage));
  }, [currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      handleSearch(newPage, pageSize);
    }
  };

  const handlePageInputSubmit = () => {
    const val = parseInt(pageInputValue, 10);
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      handlePageChange(val);
    } else {
      setPageInputValue(String(currentPage));
    }
  };

  const handlePageSizeInputSubmit = () => {
    const val = parseInt(pageSizeInput, 10);
    if (!isNaN(val) && val >= 1 && val <= 1000) {
      setPageSize(val);
      setPageSizeInput(String(val));
    } else {
      setPageSizeInput(String(pageSize));
    }
  };

  const handleSort = (col: SortField) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const renderSortIcon = (col: SortField) => {
    if (sortCol === col) {
      return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
    }
    return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-30" />;
  };



  // ---- Retake handlers ----
  const handleInitRetake = async (member: ExamMemberDetail) => {
    setRetakeTarget(member);
    setRetakePreview(null);
    setShowRetakeModal(true);
    try {
      setRetakeLoading(true);
      const preview = await previewEcmRetake(Number(groupId), Number(assignmentId), member.user_id);
      setRetakePreview(preview);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al obtener vista previa de retoma');
      setShowRetakeModal(false);
    } finally {
      setRetakeLoading(false);
    }
  };

  const handleConfirmRetake = async () => {
    if (!retakeTarget) return;
    try {
      setApplyingRetake(true);
      setError(null);
      const result = await applyEcmRetake(Number(groupId), Number(assignmentId), retakeTarget.user_id);
      setSuccessMessage(`${result.message} — Nuevo saldo: $${result.new_balance.toFixed(2)}. Intentos totales: ${result.total_allowed_attempts}`);
      setShowRetakeModal(false);
      setRetakeTarget(null);
      setRetakePreview(null);
      await handleSearch(currentPage, pageSize);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al aplicar retoma');
    } finally {
      setApplyingRetake(false);
    }
  };

  const handleInitSwap = (member: ExamMemberDetail) => {
    setSwapFrom(member);
    setSwapToUserId('');
    setSwapSearch('');
    setShowSwapModal(true);
  };

  const handleConfirmSwap = async () => {
    if (!swapFrom || !swapToUserId) return;
    try {
      setSwapping(true);
      setError(null);
      const result = await swapExamMember(
        Number(groupId),
        Number(assignmentId),
        swapFrom.user_id,
        swapToUserId
      );
      const msg = result.assignment_number
        ? `${result.message} (N° Asignación: ${result.assignment_number})`
        : result.message;
      setSuccessMessage(msg);
      setShowSwapModal(false);
      setSwapFrom(null);
      setSwapToUserId('');
      await handleSearch(currentPage, pageSize);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al realizar la reasignación');
    } finally {
      setSwapping(false);
    }
  };

  // ---- Bulk swap handlers ----
  const swappableMembers = (detailData?.members || []).filter(m => !m.is_locked && m.assignment_number);

  const handleToggleSelect = (userId: string) => {
    setSelectedForSwap(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSelectAllSwappable = () => {
    const allSwappableIds = swappableMembers.map(m => m.user_id);
    const allSelected = allSwappableIds.length > 0 && allSwappableIds.every(id => selectedForSwap.has(id));
    if (allSelected) {
      setSelectedForSwap(new Set());
    } else {
      setSelectedForSwap(new Set(allSwappableIds));
    }
  };

  const handleBulkSwapInit = () => {
    setBulkSwapStep(1);
    setBulkReplacements([]);
    setBulkSwapSearch('');
    setBulkSwapResults(null);
    setShowBulkSwapModal(true);
  };

  const handleToggleBulkReplacement = (userId: string) => {
    setBulkReplacements(prev => {
      if (prev.includes(userId)) return prev.filter(id => id !== userId);
      if (prev.length >= selectedForSwap.size) return prev; // max N replacements
      return [...prev, userId];
    });
  };

  const handleConfirmBulkSwap = async () => {
    // Pair them in order: selectedMembers[i] → bulkReplacements[i]
    const selectedMembersOrdered = members.filter(m => selectedForSwap.has(m.user_id));
    const swaps: BulkSwapPair[] = selectedMembersOrdered.map((m, i) => ({
      from_user_id: m.user_id,
      to_user_id: bulkReplacements[i],
    }));

    try {
      setBulkSwapping(true);
      setError(null);
      const result = await bulkSwapExamMembers(Number(groupId), Number(assignmentId), swaps);
      setBulkSwapResults(result);

      if (result.success_count > 0) {
        setSuccessMessage(
          `Reasignación masiva: ${result.success_count} exitosa(s)${result.error_count > 0 ? `, ${result.error_count} con error` : ''}`
        );
      }
      if (result.error_count > 0 && result.success_count === 0) {
        setError(`Todas las reasignaciones fallaron. ${result.errors.map(e => e.error).join('; ')}`);
      }

      // Go to step 3 (results) or close
      if (result.error_count === 0) {
        setShowBulkSwapModal(false);
        setSelectedForSwap(new Set());
        await handleSearch(currentPage, pageSize);
      } else {
        // Stay on modal to show partial results
        setBulkSwapStep(2);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al realizar la reasignación masiva');
    } finally {
      setBulkSwapping(false);
    }
  };

  // ---- Assign (agregar asignaciones nuevas) handlers ----
  const loadAssignCandidates = useCallback(async (search: string) => {
    const reqId = ++assignSearchRef.current;
    try {
      setAssignSearching(true);
      const res = await getExamMembersDetail(Number(groupId), Number(assignmentId), {
        per_page: 200,
        search: search || undefined,
      });
      if (reqId !== assignSearchRef.current) return;
      // Solo miembros SIN número de asignación (elegibles para recibir uno)
      const eligible = res.members
        .filter(m => !m.assignment_number)
        .map(m => ({
          id: 0,
          group_id: Number(groupId),
          user_id: m.user_id,
          status: 'active' as const,
          joined_at: '',
          user: m.user ? {
            id: m.user.id,
            email: m.user.email,
            name: m.user.name,
            first_surname: m.user.first_surname,
            second_surname: m.user.second_surname || '',
            full_name: m.user.full_name,
            curp: m.user.curp || undefined,
            is_active: true,
          } : undefined,
        }));
      setAssignCandidates(eligible);
      setAssignTotalResults(eligible.length);
    } catch {
      if (reqId !== assignSearchRef.current) return;
    } finally {
      if (reqId === assignSearchRef.current) setAssignSearching(false);
    }
  }, [groupId, assignmentId]);

  useEffect(() => {
    if (!showAssignModal) return;
    const timer = setTimeout(() => loadAssignCandidates(assignSearch), 400);
    return () => clearTimeout(timer);
  }, [showAssignModal, assignSearch, loadAssignCandidates]);

  const handleToggleAssign = (userId: string) => {
    setSelectedForAssign(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSelectAllAssign = () => {
    const allIds = assignCandidates.map(c => c.user_id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedForAssign.has(id));
    if (allSelected) {
      setSelectedForAssign(new Set());
    } else {
      setSelectedForAssign(new Set(allIds));
    }
  };

  const handleConfirmAssign = async () => {
    if (selectedForAssign.size === 0) return;
    try {
      setAssigning(true);
      setError(null);
      const result = await addAssignmentsToExam(
        Number(groupId),
        Number(assignmentId),
        Array.from(selectedForAssign)
      );
      setAssignResults(result);
      if (result.assigned_count > 0) {
        setSuccessMessage(result.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear las asignaciones');
    } finally {
      setAssigning(false);
    }
  };

  const handleCloseAssignModal = () => {
    const hadAssignments = assignResults && assignResults.assigned_count > 0;
    setShowAssignModal(false);
    setSelectedForAssign(new Set());
    setAssignSearch('');
    setAssignResults(null);
    if (hadAssignments) {
      handleSearch(currentPage, pageSize);
    }
  };

  // ---- Bulk upload (carga masiva Excel) handlers ----
  const handleBulkUploadInit = () => {
    setBulkUploadFile(null);
    setBulkUploadPreview(null);
    setBulkUploadResult(null);
    setBulkUploadStep(1);
    setShowBulkUploadModal(true);
  };

  const handleBulkUploadPreview = async () => {
    if (!bulkUploadFile) return;
    try {
      setBulkUploading(true);
      setError(null);
      const preview = await bulkAssignExamsByECM(
        Number(groupId),
        bulkUploadFile,
        detailData?.ecm_code || '',
        undefined,
        true
      );
      setBulkUploadPreview(preview);
      setBulkUploadStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al previsualizar el archivo');
    } finally {
      setBulkUploading(false);
    }
  };

  const handleBulkUploadConfirm = async () => {
    if (!bulkUploadFile) return;
    try {
      setBulkUploading(true);
      setError(null);
      const result = await bulkAssignExamsByECM(
        Number(groupId),
        bulkUploadFile,
        detailData?.ecm_code || '',
        undefined,
        false
      );
      setBulkUploadResult(result);
      setBulkUploadStep(3);
      if (result.summary.assigned > 0) {
        setSuccessMessage(result.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar la carga masiva');
    } finally {
      setBulkUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadBulkExamAssignTemplate(Number(groupId));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla_asignacion_masiva.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al descargar la plantilla');
    }
  };

  const handleCloseBulkUploadModal = () => {
    const hadAssignments = bulkUploadResult && bulkUploadResult.summary.assigned > 0;
    setShowBulkUploadModal(false);
    setBulkUploadFile(null);
    setBulkUploadPreview(null);
    setBulkUploadResult(null);
    setBulkUploadStep(1);
    if (hadAssignments) {
      handleSearch(currentPage, pageSize);
    }
  };

  const members = detailData?.members || [];

  if (loading) {
    return <LoadingSpinner message="Cargando candidatos asignados..." fullScreen />;
  }

  if (!group) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700 fluid-text-base">{error || 'Datos no encontrados'}</p>
          <Link to={basePath} className="ml-auto text-red-700 underline">Volver</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      {!isResponsable && (
        <PartnersBreadcrumb
          items={[
            { label: group.campus?.partner?.name || 'Partner', path: `/partners/${group.campus?.partner_id}` },
            { label: group.campus?.name || 'Plantel', path: `/partners/campuses/${group.campus_id}` },
            { label: group.name, path: basePath },
            { label: 'Candidatos Asignados' },
          ]}
        />
      )}

      {/* ===== HEADER CON GRADIENTE ===== */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
            <div className="flex items-center fluid-gap-4">
              <Link
                to={basePath}
                className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors"
              >
                <ArrowLeft className="fluid-icon-lg" />
              </Link>
              <div>
                <p className="fluid-text-sm text-white/80 fluid-mb-1">{group.name}</p>
                <h1 className="fluid-text-2xl font-bold flex items-center fluid-gap-3">
                  <ClipboardList className="fluid-icon-lg" />
                  Candidatos Asignados
                </h1>
                <p className="fluid-text-sm text-white/70 fluid-mt-1">
                  {assignmentName}
                  {detailData?.ecm_code && (
                    <span className="ml-2 inline-flex items-center fluid-px-2 fluid-py-0.5 bg-white/20 rounded-fluid-lg text-white/90 font-medium">
                      {detailData.ecm_code}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Stats en header */}
          <div className="grid grid-cols-3 fluid-gap-4 fluid-mt-5">
            <div className="bg-white/10 rounded-fluid-xl fluid-p-3 text-center backdrop-blur-sm">
              <p className="fluid-text-xl font-bold">{detailData?.total ?? 0}</p>
              <p className="fluid-text-xs text-white/70">Asignados</p>
            </div>
            <div className="bg-white/10 rounded-fluid-xl fluid-p-3 text-center backdrop-blur-sm">
              <p className="fluid-text-xl font-bold">{detailData?.swappable_count ?? 0}</p>
              <p className="fluid-text-xs text-white/70">Reasignables</p>
            </div>
            <div className="bg-white/10 rounded-fluid-xl fluid-p-3 text-center backdrop-blur-sm">
              <p className="fluid-text-xl font-bold">{detailData?.locked_count ?? 0}</p>
              <p className="fluid-text-xs text-white/70">Bloqueados</p>
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

      {/* ===== POLÍTICA DE PROTECCIÓN ===== */}
      <div className="bg-amber-50 border border-amber-200 rounded-fluid-xl fluid-p-4 fluid-mb-5 flex items-start fluid-gap-3">
        <Shield className="fluid-icon-base text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-amber-800 fluid-text-sm">Política de Protección de Asignaciones</p>
          <p className="text-amber-700 fluid-text-xs fluid-mt-1">
            Las asignaciones son <strong>inmutables</strong>: no se pueden retirar candidatos.
            Solo se permite <strong>reasignar</strong> el lugar de un candidato a otro del mismo grupo,
            siempre que no tenga al menos 15% de avance en material de estudio ni haya abierto el examen o simulador.
          </p>
        </div>
        <Link
          to={`${basePath}/assignments/${assignmentId}/swap-history?name=${encodeURIComponent(assignmentName)}`}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Historial
        </Link>
      </div>

      {/* ===== BARRA DE HERRAMIENTAS ===== */}
      <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 fluid-mb-5">
        <div className="flex flex-wrap items-center fluid-gap-3">
          {/* Búsqueda */}
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, email, CURP o n° de asignación..."
              className="w-full fluid-pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Botón filtros */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center fluid-gap-1.5 fluid-px-3 fluid-py-2 border rounded-fluid-lg fluid-text-sm font-medium transition-colors ${
              filterStatus !== 'all'
                ? 'bg-blue-100 border-blue-300 text-blue-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="fluid-icon-sm" />
            Filtros
          </button>

          {/* Registros por página */}
          <div className="flex items-center fluid-gap-1.5">
            <span className="fluid-text-xs text-gray-500">Mostrar</span>
            <input
              type="text"
              inputMode="numeric"
              value={pageSizeInput}
              onChange={(e) => setPageSizeInput(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePageSizeInputSubmit(); }}
              onBlur={handlePageSizeInputSubmit}
              className="w-16 text-center py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              title="Registros por página (máx 1000)"
            />
          </div>

          {/* Botón refrescar */}
          <button
            onClick={() => handleSearch(currentPage, pageSize)}
            disabled={searching}
            className="fluid-p-2 border border-gray-300 rounded-fluid-lg hover:bg-gray-50 transition-colors"
            title="Refrescar"
          >
            <RefreshCw className={`fluid-icon-sm text-gray-600 ${searching ? 'animate-spin' : ''}`} />
          </button>

          {/* Separador */}
          <div className="h-6 w-px bg-gray-300" />

          {/* Botón asignar candidatos */}
          <button
            onClick={() => { setShowAssignModal(true); setSelectedForAssign(new Set()); setAssignSearch(''); setAssignResults(null); }}
            className="inline-flex items-center fluid-gap-1.5 fluid-px-3 fluid-py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-fluid-lg fluid-text-sm font-medium transition-colors shadow-sm"
          >
            <UserPlus className="fluid-icon-sm" />
            Asignar
          </button>

          {/* Botón carga masiva */}
          <button
            onClick={handleBulkUploadInit}
            className="inline-flex items-center fluid-gap-1.5 fluid-px-3 fluid-py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-fluid-lg fluid-text-sm font-medium transition-colors shadow-sm"
          >
            <Upload className="fluid-icon-sm" />
            Carga masiva
          </button>
        </div>

        {/* Filtros avanzados */}
        {showFilters && (
          <div className="fluid-mt-3 fluid-pt-3 border-t border-gray-100 flex flex-wrap items-center fluid-gap-4">
            <div className="flex items-center fluid-gap-2">
              <label className="fluid-text-sm text-gray-600">Estado:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'locked' | 'swappable')}
                className="fluid-px-3 py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm"
              >
                <option value="all">Todos</option>
                <option value="swappable">Reasignables</option>
                <option value="locked">Bloqueados</option>
              </select>
            </div>

            {filterStatus !== 'all' && (
              <button
                onClick={() => setFilterStatus('all')}
                className="fluid-text-sm text-blue-600 hover:text-blue-700"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* ===== BARRA DE SELECCIÓN MASIVA ===== */}
      {selectedForSwap.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-fluid-xl fluid-p-3 fluid-mb-4 flex flex-wrap items-center justify-between fluid-gap-3 animate-fade-in-up">
          <div className="flex items-center fluid-gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="fluid-text-sm font-semibold text-indigo-800">
                {selectedForSwap.size} candidato{selectedForSwap.size > 1 ? 's' : ''} seleccionado{selectedForSwap.size > 1 ? 's' : ''}
              </p>
              <p className="fluid-text-xs text-indigo-600">Selecciona los que deseas reasignar en lote</p>
            </div>
          </div>
          <div className="flex items-center fluid-gap-2">
            <button
              onClick={() => setSelectedForSwap(new Set())}
              className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-2 border border-indigo-300 text-indigo-700 rounded-fluid-lg hover:bg-indigo-100 fluid-text-sm font-medium transition-colors"
            >
              <X className="h-4 w-4" />
              Deseleccionar
            </button>
            <button
              onClick={handleBulkSwapInit}
              className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-fluid-lg fluid-text-sm font-medium transition-colors shadow-sm"
            >
              <Repeat2 className="h-4 w-4" />
              Reasignar {selectedForSwap.size} seleccionado{selectedForSwap.size > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* ===== TABLA DE CANDIDATOS ASIGNADOS ===== */}
      {totalResults === 0 && !searching && !searchQuery && filterStatus === 'all' ? (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 text-center fluid-py-12">
          <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <Users className="w-10 h-10 text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Sin candidatos asignados</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            No hay candidatos asignados a esta certificación.
          </p>
        </div>
      ) : members.length === 0 && !searching ? (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 text-center fluid-py-8">
          <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No se encontraron candidatos con estas características</p>
          <p className="text-gray-400 text-sm mt-1">Intenta ajustar los filtros o el término de búsqueda</p>
        </div>
      ) : (
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Paginación arriba de la tabla */}
          <div className="bg-white border-b border-gray-200 px-6 py-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="fluid-text-sm text-gray-600">
                {searching ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </span>
                ) : totalResults > 0 ? (
                  <>
                    Mostrando <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span>
                    {' - '}
                    <span className="font-medium">{Math.min(currentPage * pageSize, totalResults)}</span>
                    {' de '}
                    <span className="font-medium">{totalResults.toLocaleString()}</span> candidatos
                  </>
                ) : (
                  <span>0 candidatos</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 fluid-text-xs font-medium text-gray-600"
                  title="Primera página"
                >
                  1
                </button>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="fluid-icon-sm" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pageInputValue}
                  onChange={(e) => setPageInputValue(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlePageInputSubmit(); }}
                  onBlur={handlePageInputSubmit}
                  className="w-14 text-center py-1 border border-gray-300 rounded fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  title="Escribe el número de página y presiona Enter"
                />
                <span className="fluid-text-sm text-gray-400">/ {totalPages}</span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight className="fluid-icon-sm" />
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 fluid-text-xs font-medium text-gray-600"
                  title="Última página"
                >
                  {totalPages}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="fluid-px-3 fluid-py-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={swappableMembers.length > 0 && swappableMembers.every(m => selectedForSwap.has(m.user_id))}
                      onChange={handleSelectAllSwappable}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                      title="Seleccionar/deseleccionar todos los reasignables"
                    />
                  </th>
                  <th onClick={() => handleSort('name')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none">
                    Candidato{renderSortIcon('name')}
                  </th>
                  <th onClick={() => handleSort('assignment_number')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none">
                    N° Asignación{renderSortIcon('assignment_number')}
                  </th>
                  <th onClick={() => handleSort('email')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden md:table-cell cursor-pointer hover:bg-gray-100 select-none">
                    Email{renderSortIcon('email')}
                  </th>
                  <th onClick={() => handleSort('curp')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell cursor-pointer hover:bg-gray-100 select-none">
                    CURP{renderSortIcon('curp')}
                  </th>
                  <th onClick={() => handleSort('progress')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none">
                    Avance{renderSortIcon('progress')}
                  </th>
                  <th onClick={() => handleSort('status')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none">
                    Estado{renderSortIcon('status')}
                  </th>
                  <th className="fluid-px-4 fluid-py-3 text-center fluid-text-xs font-semibold text-gray-600 uppercase">
                    Intentos
                  </th>
                  <th className="fluid-px-4 fluid-py-3 text-center fluid-text-xs font-semibold text-gray-600 uppercase w-36">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {searching && members.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Cargando candidatos...</p>
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr key={member.user_id} className={`transition-colors ${selectedForSwap.has(member.user_id) ? 'bg-indigo-50/60' : member.is_locked ? 'bg-gray-50/50' : 'hover:bg-blue-50/30'}`}>
                      {/* Checkbox */}
                      <td className="fluid-px-3 fluid-py-3 text-center w-10">
                        {!member.is_locked && member.assignment_number ? (
                          <input
                            type="checkbox"
                            checked={selectedForSwap.has(member.user_id)}
                            onChange={() => handleToggleSelect(member.user_id)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                        ) : (
                          <span className="w-4 h-4 inline-block" />
                        )}
                      </td>
                      {/* Candidato */}
                      <td className="fluid-px-4 fluid-py-3">
                        <div className="flex items-center fluid-gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold fluid-text-sm flex-shrink-0 ${
                            member.is_locked
                              ? 'bg-gradient-to-br from-gray-400 to-gray-500'
                              : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                          }`}>
                            {member.user?.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{member.user?.full_name || 'Desconocido'}</p>
                            <p className="fluid-text-xs text-gray-500 md:hidden">{member.user?.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Número de asignación */}
                      <td className="fluid-px-4 fluid-py-3">
                        {member.assignment_number ? (
                          <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-indigo-50 border border-indigo-200 rounded-fluid-lg font-mono fluid-text-xs font-bold text-indigo-700">
                            <Hash className="h-3 w-3" />
                            {member.assignment_number}
                          </span>
                        ) : (
                          <span className="text-gray-400 fluid-text-xs">Sin asignación</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 hidden md:table-cell">
                        {member.user?.email || '-'}
                      </td>

                      {/* CURP */}
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 hidden lg:table-cell font-mono">
                        {member.user?.curp || <span className="text-gray-400">-</span>}
                      </td>

                      {/* Avance */}
                      <td className="fluid-px-4 fluid-py-3">
                        <div className="flex items-center fluid-gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                member.material_progress >= 15 ? 'bg-emerald-500' : member.material_progress > 0 ? 'bg-amber-400' : 'bg-gray-300'
                              }`}
                              style={{ width: `${Math.min(member.material_progress, 100)}%` }}
                            />
                          </div>
                          <span className="fluid-text-xs font-medium text-gray-700 w-10 text-right">
                            {member.material_progress}%
                          </span>
                        </div>
                        {member.has_opened_exam && (
                          <span className="inline-flex items-center fluid-gap-1 fluid-text-xs text-blue-600 fluid-mt-0.5">
                            <FileSpreadsheet className="h-3 w-3" />
                            Examen abierto
                          </span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="fluid-px-4 fluid-py-3">
                        {member.is_locked ? (
                          <div>
                            <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-medium bg-red-100 text-red-700">
                              <Lock className="h-3 w-3" />
                              Bloqueado
                            </span>
                            <div className="fluid-mt-1">
                              {member.lock_reasons.map((r, i) => (
                                <p key={i} className="fluid-text-xs text-red-500">{r}</p>
                              ))}
                            </div>
                          </div>
                        ) : member.assignment_number ? (
                          <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-medium bg-green-100 text-green-700">
                            <Repeat2 className="h-3 w-3" />
                            Reasignable
                          </span>
                        ) : (
                          <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-medium bg-gray-100 text-gray-500">
                            Sin asignación
                          </span>
                        )}
                      </td>

                      {/* Intentos */}
                      <td className="fluid-px-4 fluid-py-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-0.5 rounded-full fluid-text-xs font-semibold ${
                            member.attempts_exhausted
                              ? 'bg-red-100 text-red-700'
                              : member.results_count > 0
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}>
                            {member.results_count} / {member.total_allowed_attempts}
                          </span>
                          {member.retakes_count > 0 && (
                            <span className="fluid-text-xs text-purple-600 fluid-mt-0.5">
                              +{member.retakes_count} retoma{member.retakes_count > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Acción */}
                      <td className="fluid-px-4 fluid-py-3 text-center">
                        <div className="flex items-center justify-center fluid-gap-1">
                          {member.ecm_assignment_id && (
                            <Link
                              to={`/asignaciones-ecm/candidato/${member.ecm_assignment_id}`}
                              className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1.5 text-sky-600 hover:bg-sky-50 rounded-fluid-lg transition-colors fluid-text-xs font-medium border border-sky-200 hover:border-sky-300"
                              title="Ver detalle de la asignación"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden xl:inline">Detalle</span>
                            </Link>
                          )}
                          {!member.is_locked && member.assignment_number && (
                            <button
                              onClick={() => handleInitSwap(member)}
                              className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-fluid-lg transition-colors fluid-text-xs font-medium border border-indigo-200 hover:border-indigo-300"
                              title="Reasignar a otro candidato"
                            >
                              <Repeat2 className="h-3.5 w-3.5" />
                              <span className="hidden xl:inline">Reasignar</span>
                            </button>
                          )}
                          {member.can_retake && (
                            <button
                              onClick={() => handleInitRetake(member)}
                              className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1.5 text-purple-600 hover:bg-purple-50 rounded-fluid-lg transition-colors fluid-text-xs font-medium border border-purple-200 hover:border-purple-300"
                              title="Aplicar retoma (1 intento adicional)"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span className="hidden xl:inline">Retoma</span>
                            </button>
                          )}
                          {!member.ecm_assignment_id && !member.can_retake && (!member.assignment_number || member.is_locked) && (
                            <span className="fluid-text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación abajo de la tabla */}
          {totalPages > 1 && (
            <div className="bg-white border-t border-gray-200 px-6 py-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="fluid-text-sm text-gray-600">
                  Mostrando <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span>
                  {' - '}
                  <span className="font-medium">{Math.min(currentPage * pageSize, totalResults)}</span>
                  {' de '}
                  <span className="font-medium">{totalResults.toLocaleString()}</span> candidatos
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 fluid-text-xs font-medium text-gray-600"
                  >
                    1
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="fluid-icon-sm" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pageInputValue}
                    onChange={(e) => setPageInputValue(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePageInputSubmit(); }}
                    onBlur={handlePageInputSubmit}
                    className="w-14 text-center py-1 border border-gray-300 rounded fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="fluid-text-sm text-gray-400">/ {totalPages}</span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="fluid-icon-sm" />
                  </button>
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 fluid-text-xs font-medium text-gray-600"
                  >
                    {totalPages}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== LEYENDA ===== */}
      <div className="fluid-mt-4 flex flex-wrap items-center fluid-gap-6 fluid-text-xs text-gray-500">
        <div className="flex items-center fluid-gap-2">
          <Lock className="h-3.5 w-3.5 text-red-500" />
          <span>Bloqueado: tiene avance ≥15% o abrió examen</span>
        </div>
        <div className="flex items-center fluid-gap-2">
          <Repeat2 className="h-3.5 w-3.5 text-green-600" />
          <span>Reasignable: sin avance significativo</span>
        </div>
        <div className="flex items-center fluid-gap-2">
          <Hash className="h-3.5 w-3.5 text-indigo-500" />
          <span>N° Asignación: identificador ECM permanente</span>
        </div>
      </div>

      {/* ===== MODAL DE REASIGNACIÓN (SWAP) ===== */}
      {showSwapModal && swapFrom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !swapping && setShowSwapModal(false)}
        >
          <div
            className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Repeat2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Reasignar Candidato</h2>
                  <p className="text-sm text-gray-500">
                    Transferir asignación de <strong>{swapFrom.user?.full_name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => !swapping && setShowSwapModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Info del candidato origen */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Candidato Actual</p>
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {swapFrom.user?.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{swapFrom.user?.full_name}</p>
                  <p className="text-xs text-gray-500">{swapFrom.user?.email}</p>
                </div>
                {swapFrom.assignment_number && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-lg font-mono text-xs font-bold text-indigo-700">
                    <Hash className="h-3 w-3" />
                    {swapFrom.assignment_number}
                  </span>
                )}
              </div>

              {/* Advertencia */}
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  El número de asignación <strong>{swapFrom.assignment_number || '—'}</strong> será transferido
                  al nuevo candidato. <strong>{swapFrom.user?.full_name}</strong> perderá el acceso a esta certificación.
                </p>
              </div>
            </div>

            {/* Búsqueda de candidato destino */}
            <div className="p-4 border-b border-gray-100 flex-shrink-0">
              <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Seleccionar Nuevo Candidato</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={swapSearch}
                  onChange={(e) => setSwapSearch(e.target.value)}
                  placeholder="Buscar miembro del grupo..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
              {swapTotalResults > 0 && (
                <p className="text-xs text-gray-400 mt-2">{swapTotalResults.toLocaleString()} miembros encontrados{swapTotalResults > 50 ? ' (mostrando primeros 50)' : ''}</p>
              )}
            </div>

            {/* Lista de candidatos disponibles */}
            <div className="overflow-y-auto flex-1" style={{ maxHeight: '320px' }}>
              {swapSearching ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Buscando candidatos...</p>
                </div>
              ) : swapCandidates.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">{swapSearch ? 'No se encontraron candidatos para esa búsqueda' : 'Escribe para buscar candidatos'}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {swapCandidates.map((member) => {
                    const selected = swapToUserId === member.user_id;
                    return (
                      <button
                        key={member.user_id}
                        onClick={() => setSwapToUserId(selected ? '' : member.user_id)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                          selected ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                          selected ? 'bg-gradient-to-br from-indigo-500 to-purple-500' : 'bg-gradient-to-br from-gray-400 to-gray-500'
                        }`}>
                          {member.user?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${selected ? 'text-indigo-900' : 'text-gray-900'}`}>
                            {member.user?.full_name || 'Desconocido'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{member.user?.email || '-'}</p>
                        </div>
                        {member.user?.curp && (
                          <span className="text-xs text-gray-400 font-mono hidden lg:block">{member.user.curp}</span>
                        )}
                        {selected && (
                          <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => !swapping && setShowSwapModal(false)}
                disabled={swapping}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-fluid-xl hover:bg-gray-100 disabled:opacity-50 font-medium text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSwap}
                disabled={swapping || !swapToUserId}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-fluid-xl font-medium text-sm transition-colors"
              >
                {swapping ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Repeat2 className="w-4 h-4" />
                )}
                {swapping ? 'Reasignando...' : 'Confirmar Reasignación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL DE RETOMA ===== */}
      {showRetakeModal && retakeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !applyingRetake && setShowRetakeModal(false)}
        >
          <div
            className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Aplicar Retoma</h2>
                  <p className="text-sm text-gray-500">
                    1 intento adicional para <strong>{retakeTarget.user?.full_name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => !applyingRetake && setShowRetakeModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {retakeLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Calculando retoma...</p>
                </div>
              ) : retakePreview ? (
                <div className="space-y-4">
                  {/* Info candidato */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {retakeTarget.user?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{retakePreview.user_name}</p>
                      <p className="text-xs text-gray-500">
                        N° Asignación: <span className="font-mono font-bold">{retakePreview.assignment_number || '—'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Detalles */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 rounded-xl">
                      <p className="text-xs text-blue-600 font-medium">Intentos usados</p>
                      <p className="text-lg font-bold text-blue-800">
                        {retakePreview.results_count} / {retakePreview.max_attempts + retakePreview.retakes_count}
                      </p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-xl">
                      <p className="text-xs text-purple-600 font-medium">Retomas aplicadas</p>
                      <p className="text-lg font-bold text-purple-800">
                        {retakePreview.retakes_count} / {retakePreview.max_retakes === 0 ? '∞' : retakePreview.max_retakes}
                      </p>
                    </div>
                  </div>

                  {/* Costo y saldo */}
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-amber-700">Costo de retoma</span>
                      <span className="text-lg font-bold text-amber-800">${retakePreview.retake_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-amber-700">Saldo actual</span>
                      <span className="text-sm font-medium text-amber-800">${retakePreview.coordinator_balance.toFixed(2)}</span>
                    </div>
                    <hr className="border-amber-300 my-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-amber-700">Saldo después</span>
                      <span className={`text-sm font-bold ${retakePreview.balance_after >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${retakePreview.balance_after.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Razones de bloqueo */}
                  {!retakePreview.can_apply && retakePreview.reasons.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-sm font-medium text-red-700 mb-1">No se puede aplicar la retoma:</p>
                      {retakePreview.reasons.map((r, i) => (
                        <p key={i} className="text-xs text-red-600 flex items-center gap-1">
                          <XCircle className="h-3 w-3 flex-shrink-0" /> {r}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => !applyingRetake && setShowRetakeModal(false)}
                disabled={applyingRetake}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-fluid-xl hover:bg-gray-100 disabled:opacity-50 font-medium text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRetake}
                disabled={applyingRetake || retakeLoading || !retakePreview?.can_apply}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-fluid-xl font-medium text-sm transition-colors"
              >
                {applyingRetake ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                {applyingRetake ? 'Aplicando...' : 'Confirmar Retoma'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL DE REASIGNACIÓN MASIVA (BULK SWAP) ===== */}
      {showBulkSwapModal && selectedForSwap.size > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !bulkSwapping && setShowBulkSwapModal(false)}
        >
          <div
            className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Repeat2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Reasignación Masiva</h2>
                  <p className="text-sm text-gray-500">
                    {bulkSwapStep === 1
                      ? `Selecciona ${selectedForSwap.size} reemplazo${selectedForSwap.size > 1 ? 's' : ''}`
                      : 'Confirma los emparejamientos'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                  Paso {bulkSwapStep} de 2
                </span>
                <button
                  onClick={() => !bulkSwapping && setShowBulkSwapModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Resumen de seleccionados */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <p className="text-xs text-gray-500 font-semibold uppercase mb-2">
                Candidatos a Reasignar ({selectedForSwap.size})
              </p>
              <div className="flex flex-wrap gap-2">
                {members.filter(m => selectedForSwap.has(m.user_id)).map(m => (
                  <span key={m.user_id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                      {m.user?.name?.charAt(0).toUpperCase() || '?'}
                    </span>
                    <span className="font-medium text-gray-700 max-w-[120px] truncate">{m.user?.full_name || 'Desconocido'}</span>
                    {m.assignment_number && (
                      <span className="text-indigo-500 font-mono text-[10px]">#{m.assignment_number}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* PASO 1: Seleccionar reemplazos */}
            {bulkSwapStep === 1 && (
              <>
                <div className="p-4 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500 font-semibold uppercase">
                      Seleccionar Reemplazos ({bulkReplacements.length} / {selectedForSwap.size})
                    </p>
                    {bulkReplacements.length === selectedForSwap.size && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completo
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={bulkSwapSearch}
                      onChange={(e) => setBulkSwapSearch(e.target.value)}
                      placeholder="Buscar miembro del grupo..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                  </div>
                  {bulkSwapTotalResults > 0 && (
                    <p className="text-xs text-gray-400 mt-2">
                      {bulkSwapTotalResults.toLocaleString()} miembros encontrados
                      {bulkSwapTotalResults > 50 ? ' (mostrando primeros 50)' : ''}
                    </p>
                  )}
                </div>

                {/* Progress bar */}
                <div className="px-4 pt-2 flex-shrink-0">
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${selectedForSwap.size > 0 ? (bulkReplacements.length / selectedForSwap.size) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Lista de candidatos */}
                <div className="overflow-y-auto flex-1" style={{ maxHeight: '320px' }}>
                  {bulkSwapSearching ? (
                    <div className="p-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Buscando candidatos...</p>
                    </div>
                  ) : bulkSwapCandidates.length === 0 ? (
                    <div className="p-8 text-center">
                      <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">
                        {bulkSwapSearch ? 'No se encontraron candidatos' : 'Escribe para buscar candidatos'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {bulkSwapCandidates
                        .filter(c => !selectedForSwap.has(c.user_id)) // exclude members being replaced
                        .map((candidate) => {
                          const isSelected = bulkReplacements.includes(candidate.user_id);
                          const orderIndex = bulkReplacements.indexOf(candidate.user_id);
                          const isFull = bulkReplacements.length >= selectedForSwap.size && !isSelected;
                          return (
                            <button
                              key={candidate.user_id}
                              onClick={() => handleToggleBulkReplacement(candidate.user_id)}
                              disabled={isFull}
                              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                                isSelected
                                  ? 'bg-indigo-50 border-l-4 border-l-indigo-500'
                                  : isFull
                                    ? 'opacity-40 cursor-not-allowed border-l-4 border-l-transparent'
                                    : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                                isSelected ? 'bg-gradient-to-br from-indigo-500 to-purple-500' : 'bg-gradient-to-br from-gray-400 to-gray-500'
                              }`}>
                                {isSelected ? orderIndex + 1 : candidate.user?.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                                  {candidate.user?.full_name || 'Desconocido'}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{candidate.user?.email || '-'}</p>
                              </div>
                              {candidate.user?.curp && (
                                <span className="text-xs text-gray-400 font-mono hidden lg:block">{candidate.user.curp}</span>
                              )}
                              {isSelected && (
                                <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* PASO 2: Confirmar emparejamientos */}
            {bulkSwapStep === 2 && (
              <div className="overflow-y-auto flex-1 p-4" style={{ maxHeight: '400px' }}>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-3">Emparejamientos</p>

                {/* Show results if we have them (partial failure) */}
                {bulkSwapResults && (
                  <div className={`mb-4 p-3 rounded-xl border ${bulkSwapResults.error_count > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                    <p className={`text-sm font-medium ${bulkSwapResults.error_count > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                      {bulkSwapResults.success_count} exitosa(s), {bulkSwapResults.error_count} con error
                    </p>
                    {bulkSwapResults.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <XCircle className="w-3 h-3 flex-shrink-0" />
                        {err.error}
                      </p>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  {members.filter(m => selectedForSwap.has(m.user_id)).map((fromMember, idx) => {
                    const toUserId = bulkReplacements[idx];
                    const toCandidate = bulkSwapCandidates.find(c => c.user_id === toUserId);
                    return (
                      <div key={fromMember.user_id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
                        {/* FROM */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {fromMember.user?.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{fromMember.user?.full_name}</p>
                            {fromMember.assignment_number && (
                              <p className="text-[10px] text-indigo-500 font-mono">#{fromMember.assignment_number}</p>
                            )}
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                          <Repeat2 className="w-4 h-4 text-indigo-600" />
                        </div>

                        {/* TO */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {toCandidate?.user?.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{toCandidate?.user?.full_name || 'Desconocido'}</p>
                            <p className="text-[10px] text-gray-500 truncate">{toCandidate?.user?.email}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Warning */}
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Los números de asignación serán transferidos a los nuevos candidatos.
                    Los candidatos actuales perderán el acceso a esta certificación.
                    <strong> Esta acción no se puede deshacer.</strong>
                  </p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div>
                {bulkSwapStep === 2 && !bulkSwapResults && (
                  <button
                    onClick={() => setBulkSwapStep(1)}
                    disabled={bulkSwapping}
                    className="inline-flex items-center gap-1 px-4 py-2.5 text-gray-600 hover:text-gray-800 font-medium text-sm transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Volver
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (!bulkSwapping) {
                      setShowBulkSwapModal(false);
                      if (bulkSwapResults && bulkSwapResults.success_count > 0) {
                        setSelectedForSwap(new Set());
                        handleSearch(currentPage, pageSize);
                      }
                    }
                  }}
                  disabled={bulkSwapping}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-fluid-xl hover:bg-gray-100 disabled:opacity-50 font-medium text-sm transition-colors"
                >
                  {bulkSwapResults ? 'Cerrar' : 'Cancelar'}
                </button>

                {bulkSwapStep === 1 && (
                  <button
                    onClick={() => setBulkSwapStep(2)}
                    disabled={bulkReplacements.length !== selectedForSwap.size}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-fluid-xl font-medium text-sm transition-colors"
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {bulkSwapStep === 2 && !bulkSwapResults && (
                  <button
                    onClick={handleConfirmBulkSwap}
                    disabled={bulkSwapping}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-fluid-xl font-medium text-sm transition-colors"
                  >
                    {bulkSwapping ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Repeat2 className="w-4 h-4" />
                    )}
                    {bulkSwapping ? 'Reasignando...' : `Confirmar ${selectedForSwap.size} Reasignaciones`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL DE ASIGNAR CANDIDATOS ===== */}
      {showAssignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !assigning && handleCloseAssignModal()}
        >
          <div
            className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Asignar Candidatos</h2>
                  <p className="text-sm text-gray-500">
                    Selecciona miembros del grupo para generar números de asignación
                  </p>
                </div>
              </div>
              <button
                onClick={() => !assigning && handleCloseAssignModal()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Resultados de asignación */}
            {assignResults ? (
              <div className="p-6 overflow-y-auto flex-1">
                {assignResults.assigned_count > 0 && (
                  <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <p className="font-semibold text-emerald-800">{assignResults.assigned_count} asignación(es) creada(s)</p>
                    </div>
                    {assignResults.total_cost > 0 && (
                      <p className="text-sm text-emerald-700 mb-3">
                        Costo: {assignResults.assigned_count} x ${assignResults.unit_cost.toFixed(2)} = <strong>${assignResults.total_cost.toFixed(2)}</strong>
                      </p>
                    )}
                    <div className="space-y-2">
                      {assignResults.assigned.map((a) => (
                        <div key={a.user_id} className="flex items-center gap-2 text-sm">
                          <Hash className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-mono font-bold text-emerald-700">{a.assignment_number}</span>
                          <span className="text-gray-700">{a.user_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {assignResults.already_assigned_count > 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <p className="font-medium text-amber-800">{assignResults.already_assigned_count} ya tenía(n) asignación</p>
                    </div>
                    <div className="space-y-1">
                      {assignResults.already_assigned.map((a) => (
                        <p key={a.user_id} className="text-xs text-amber-700">
                          {a.user_name} — #{a.assignment_number}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Búsqueda + seleccionar todos */}
                <div className="p-4 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        placeholder="Buscar miembro sin asignación..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                      />
                    </div>
                    {assignCandidates.length > 0 && (
                      <button
                        onClick={handleSelectAllAssign}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium whitespace-nowrap"
                      >
                        {assignCandidates.every(c => selectedForAssign.has(c.user_id))
                          ? 'Deseleccionar todos'
                          : 'Seleccionar todos'}
                      </button>
                    )}
                  </div>
                  {assignTotalResults > 0 && (
                    <p className="text-xs text-gray-400">
                      {assignTotalResults} miembro(s) sin asignación
                      {selectedForAssign.size > 0 && (
                        <span className="text-emerald-600 font-medium"> — {selectedForAssign.size} seleccionado(s)</span>
                      )}
                    </p>
                  )}
                </div>

                {/* Lista de candidatos */}
                <div className="overflow-y-auto flex-1" style={{ maxHeight: '380px' }}>
                  {assignSearching ? (
                    <div className="p-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Buscando candidatos...</p>
                    </div>
                  ) : assignCandidates.length === 0 ? (
                    <div className="p-8 text-center">
                      <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">
                        {assignSearch ? 'No se encontraron miembros sin asignación' : 'No hay miembros sin asignación en este examen'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {assignCandidates.map((candidate) => {
                        const isSelected = selectedForAssign.has(candidate.user_id);
                        return (
                          <button
                            key={candidate.user_id}
                            onClick={() => handleToggleAssign(candidate.user_id)}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                              isSelected
                                ? 'bg-emerald-50 border-l-4 border-l-emerald-500'
                                : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                            />
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                              isSelected ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gradient-to-br from-gray-400 to-gray-500'
                            }`}>
                              {candidate.user?.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium text-sm ${isSelected ? 'text-emerald-900' : 'text-gray-900'}`}>
                                {candidate.user?.full_name || 'Desconocido'}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{candidate.user?.email || '-'}</p>
                            </div>
                            {candidate.user?.curp && (
                              <span className="text-xs text-gray-400 font-mono hidden lg:block">{candidate.user.curp}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => !assigning && handleCloseAssignModal()}
                disabled={assigning}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-fluid-xl hover:bg-gray-100 disabled:opacity-50 font-medium text-sm transition-colors"
              >
                {assignResults ? 'Cerrar' : 'Cancelar'}
              </button>
              {!assignResults && (
                <button
                  onClick={handleConfirmAssign}
                  disabled={assigning || selectedForAssign.size === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-fluid-xl font-medium text-sm transition-colors"
                >
                  {assigning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  {assigning ? 'Asignando...' : `Asignar ${selectedForAssign.size} candidato${selectedForAssign.size !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL DE CARGA MASIVA (EXCEL) ===== */}
      {showBulkUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !bulkUploading && handleCloseBulkUploadModal()}
        >
          <div
            className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Carga Masiva de Asignaciones</h2>
                  <p className="text-sm text-gray-500">
                    {bulkUploadStep === 1
                      ? 'Sube un archivo Excel con los usuarios a asignar'
                      : bulkUploadStep === 2
                        ? 'Vista previa de asignaciones'
                        : 'Resultado de la carga'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-semibold">
                  Paso {bulkUploadStep} de 3
                </span>
                <button
                  onClick={() => !bulkUploading && handleCloseBulkUploadModal()}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* PASO 1: Seleccionar archivo */}
            {bulkUploadStep === 1 && (
              <div className="p-6 overflow-y-auto flex-1">
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-800 font-medium mb-2">Instrucciones:</p>
                  <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                    <li>El archivo debe ser Excel (.xlsx)</li>
                    <li>Debe contener la columna "Nombre de Usuario" (username)</li>
                    <li>Los usuarios deben ser miembros activos del grupo</li>
                    <li>Se generará un número de asignación único para cada candidato</li>
                  </ul>
                </div>

                <button
                  onClick={handleDownloadTemplate}
                  className="w-full mb-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-violet-300 text-violet-700 rounded-xl hover:bg-violet-50 font-medium text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Descargar plantilla Excel
                </button>

                <label className="block">
                  <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    bulkUploadFile
                      ? 'border-violet-400 bg-violet-50'
                      : 'border-gray-300 hover:border-violet-400 hover:bg-gray-50'
                  }`}>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => setBulkUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    {bulkUploadFile ? (
                      <div>
                        <FileSpreadsheet className="w-10 h-10 text-violet-500 mx-auto mb-2" />
                        <p className="font-medium text-violet-900">{bulkUploadFile.name}</p>
                        <p className="text-xs text-violet-600 mt-1">
                          {(bulkUploadFile.size / 1024).toFixed(1)} KB
                        </p>
                        <p className="text-xs text-violet-500 mt-2">Haz clic para cambiar archivo</p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                        <p className="font-medium text-gray-700">Haz clic para seleccionar archivo</p>
                        <p className="text-xs text-gray-500 mt-1">Excel (.xlsx, .xls)</p>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            )}

            {/* PASO 2: Vista previa */}
            {bulkUploadStep === 2 && bulkUploadPreview && (
              <div className="p-6 overflow-y-auto flex-1" style={{ maxHeight: '450px' }}>
                {/* Resumen */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                    <p className="text-xl font-bold text-emerald-700">{bulkUploadPreview.summary.assigned}</p>
                    <p className="text-xs text-emerald-600">Por asignar</p>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                    <p className="text-xl font-bold text-amber-700">{bulkUploadPreview.summary.skipped}</p>
                    <p className="text-xs text-amber-600">Omitidos</p>
                  </div>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                    <p className="text-xl font-bold text-red-700">{bulkUploadPreview.summary.errors}</p>
                    <p className="text-xs text-red-600">Errores</p>
                  </div>
                </div>

                {/* Lista de asignaciones previstas */}
                {bulkUploadPreview.results.assigned.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Se asignarán:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {bulkUploadPreview.results.assigned.map((a) => (
                        <div key={a.row} className="flex items-center gap-2 text-sm p-2 bg-emerald-50 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span className="text-gray-700">{a.user_name}</span>
                          <span className="text-xs text-gray-400">({a.username})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Omitidos */}
                {bulkUploadPreview.results.skipped.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Omitidos:</p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {bulkUploadPreview.results.skipped.map((s) => (
                        <div key={s.row} className="flex items-center gap-2 text-sm p-2 bg-amber-50 rounded-lg">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          <span className="text-gray-700">{s.user_name || s.username}</span>
                          <span className="text-xs text-amber-600">— {s.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Errores */}
                {bulkUploadPreview.results.errors.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Errores:</p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {bulkUploadPreview.results.errors.map((e) => (
                        <div key={e.row} className="flex items-center gap-2 text-sm p-2 bg-red-50 rounded-lg">
                          <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                          <span className="text-gray-700">{e.user_name || e.identifier}</span>
                          <span className="text-xs text-red-600">— {e.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PASO 3: Resultado final */}
            {bulkUploadStep === 3 && bulkUploadResult && (
              <div className="p-6 overflow-y-auto flex-1">
                <div className={`p-4 rounded-xl border mb-4 ${
                  bulkUploadResult.summary.errors > 0
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <p className={`font-semibold ${
                    bulkUploadResult.summary.errors > 0 ? 'text-amber-800' : 'text-emerald-800'
                  }`}>
                    {bulkUploadResult.message}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                    <p className="text-xl font-bold text-emerald-700">{bulkUploadResult.summary.assigned}</p>
                    <p className="text-xs text-emerald-600">Asignados</p>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                    <p className="text-xl font-bold text-amber-700">{bulkUploadResult.summary.skipped}</p>
                    <p className="text-xs text-amber-600">Omitidos</p>
                  </div>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                    <p className="text-xl font-bold text-red-700">{bulkUploadResult.summary.errors}</p>
                    <p className="text-xs text-red-600">Errores</p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div>
                {bulkUploadStep === 2 && (
                  <button
                    onClick={() => { setBulkUploadStep(1); setBulkUploadPreview(null); }}
                    disabled={bulkUploading}
                    className="inline-flex items-center gap-1 px-4 py-2.5 text-gray-600 hover:text-gray-800 font-medium text-sm transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Volver
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => !bulkUploading && handleCloseBulkUploadModal()}
                  disabled={bulkUploading}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-fluid-xl hover:bg-gray-100 disabled:opacity-50 font-medium text-sm transition-colors"
                >
                  {bulkUploadStep === 3 ? 'Cerrar' : 'Cancelar'}
                </button>

                {bulkUploadStep === 1 && (
                  <button
                    onClick={handleBulkUploadPreview}
                    disabled={bulkUploading || !bulkUploadFile}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-fluid-xl font-medium text-sm transition-colors"
                  >
                    {bulkUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                    {bulkUploading ? 'Procesando...' : 'Previsualizar'}
                  </button>
                )}

                {bulkUploadStep === 2 && (
                  <button
                    onClick={handleBulkUploadConfirm}
                    disabled={bulkUploading || (bulkUploadPreview?.summary.assigned ?? 0) === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-fluid-xl font-medium text-sm transition-colors"
                  >
                    {bulkUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {bulkUploading ? 'Asignando...' : `Confirmar ${bulkUploadPreview?.summary.assigned ?? 0} asignaciones`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
