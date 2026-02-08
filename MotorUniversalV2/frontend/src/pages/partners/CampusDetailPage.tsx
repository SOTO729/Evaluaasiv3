/**
 * Detalle de Plantel (Campus) - Diseño Mejorado con Fluid
 * Con header con gradiente, listas scrolleables y mejor UX
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  Plus,
  Trash2,
  Users,
  Layers,
  AlertCircle,
  CheckCircle2,
  Building2,
  Calendar,
  GraduationCap,
  CalendarRange,
  Shield,
  UserCog,
  Zap,
  Settings,
  Monitor,
  Award,
  CreditCard,
  DollarSign,
  FileText,
  Clock,
  Globe,
  AlertTriangle,
  Search,
  X,
  Power,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import DatePickerInput from '../../components/DatePickerInput';
import {
  getCampus,
  getSchoolCycles,
  createSchoolCycle,
  deleteSchoolCycle,
  deactivateCampus,
  permanentDeleteCampus,
  permanentDeleteCycle,
  CyclePermanentDeleteStats,
  Campus,
  SchoolCycle,
} from '../../services/partnersService';
import { useAuthStore } from '../../store/authStore';

export default function CampusDetailPage() {
  const { campusId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  
  const [campus, setCampus] = useState<Campus | null>(null);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [showNewCycleModal, setShowNewCycleModal] = useState(false);
  const [newCycleForm, setNewCycleForm] = useState({
    name: '',
    cycle_type: 'annual' as 'annual' | 'semester',
    start_date: '',
    end_date: '',
    is_current: true,
  });
  const [isCreatingCycle, setIsCreatingCycle] = useState(false);
  const [cyclesAvailable, setCyclesAvailable] = useState(true);
  const [showCycleSuccessModal, setShowCycleSuccessModal] = useState(false);
  const [createdCycleName, setCreatedCycleName] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Estados para modal de confirmación de desactivar/borrar ciclo
  const [showCycleDeleteModal, setShowCycleDeleteModal] = useState(false);
  const [cycleToDelete, setCycleToDelete] = useState<SchoolCycle | null>(null);
  const [isDeletingCycle, setIsDeletingCycle] = useState(false);
  const [showCycleDeleteSuccessModal, setShowCycleDeleteSuccessModal] = useState(false);
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);
  
  // Búsqueda de ciclos
  const [cycleSearchTerm, setCycleSearchTerm] = useState('');
  const [cycleDeleteStats, setCycleDeleteStats] = useState<CyclePermanentDeleteStats | null>(null);
  const [deletedCycleName, setDeletedCycleName] = useState('');
  
  // Función para generar el nombre del ciclo basado en las fechas
  const generateCycleName = (startDate: string, endDate: string): string => {
    if (!startDate || !endDate) return '';
    
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    
    // Calcular diferencia en meses
    const diffMonths = (endYear - startYear) * 12 + (end.getMonth() - start.getMonth());
    
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    // Si es un año o más, usar formato "Ciclo Escolar YYYY - YYYY"
    if (diffMonths >= 12) {
      if (startYear === endYear) {
        return `Ciclo Escolar ${startYear}`;
      }
      return `Ciclo Escolar ${startYear} - ${endYear}`;
    }
    
    // Si es menor a un año
    const startMonth = meses[start.getMonth()];
    const endMonth = meses[end.getMonth()];
    
    if (startYear === endYear) {
      // Mismo año: "Ciclo Escolar Enero - Junio 2026"
      return `Ciclo Escolar ${startMonth} - ${endMonth} ${startYear}`;
    } else {
      // Diferente año: "Ciclo Escolar Septiembre 2025 - Enero 2026"
      return `Ciclo Escolar ${startMonth} ${startYear} - ${endMonth} ${endYear}`;
    }
  };
  
  // Actualizar nombre del ciclo cuando cambien las fechas
  useEffect(() => {
    if (newCycleForm.start_date && newCycleForm.end_date) {
      const generatedName = generateCycleName(newCycleForm.start_date, newCycleForm.end_date);
      setNewCycleForm(prev => ({ ...prev, name: generatedName }));
    }
  }, [newCycleForm.start_date, newCycleForm.end_date]);
  
  // Estado para eliminación permanente (solo admin)
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
  const [isDeletingPermanently, setIsDeletingPermanently] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const permanentDeleteModalRef = useRef<HTMLDivElement>(null);
  
  // Estado para modal de éxito de eliminación
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{
    message: string;
    partner_id: number;
    stats: {
      groups_deleted: number;
      cycles_deleted: number;
      members_removed: number;
      exams_unassigned: number;
      materials_unassigned: number;
      users_unlinked: number;
    };
  } | null>(null);
  const deleteSuccessModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, [campusId]);

  useEffect(() => {
    if (campus && !campus.is_active) {
      setShowNewCycleModal(false);
    }
  }, [campus?.is_active]);

  const loadData = async () => {
    try {
      setLoading(true);
      const campusData = await getCampus(Number(campusId));
      setCampus(campusData);
      
      try {
        const cyclesData = await getSchoolCycles(Number(campusId), { active_only: false });
        setCycles(cyclesData.cycles);
        setCyclesAvailable(true);
        
        const currentCycle = cyclesData.cycles.find(c => c.is_current);
        if (currentCycle) {
          setSelectedCycleId(currentCycle.id);
        } else if (cyclesData.cycles.length > 0) {
          setSelectedCycleId(cyclesData.cycles[0].id);
        }
      } catch {
        console.log('Cycles endpoint not available');
        setCyclesAvailable(false);
        setCycles([]);
      }
    } catch (err: any) {
      console.error('Error loading campus:', err);
      setError(err.response?.data?.error || err.message || 'Error al cargar el plantel');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCycle = async () => {
    if (!newCycleForm.start_date || !newCycleForm.end_date) return;
    
    // Asegurar que el nombre esté generado
    const cycleName = newCycleForm.name || generateCycleName(newCycleForm.start_date, newCycleForm.end_date);
    
    try {
      setIsCreatingCycle(true);
      const cycleData = { ...newCycleForm, name: cycleName };
      const newCycle = await createSchoolCycle(Number(campusId), cycleData);
      setCycles(prev => [newCycle, ...prev]);
      setSelectedCycleId(newCycle.id);
      setCreatedCycleName(cycleName);
      setShowNewCycleModal(false);
      setNewCycleForm({ name: '', cycle_type: 'annual', start_date: '', end_date: '', is_current: true });
      setShowCycleSuccessModal(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear el ciclo escolar');
    } finally {
      setIsCreatingCycle(false);
    }
  };

  // Abrir modal de confirmación para desactivar ciclo
  const openCycleDeleteModal = (cycle: SchoolCycle) => {
    setCycleToDelete(cycle);
    setIsPermanentDelete(false);
    setShowCycleDeleteModal(true);
  };

  // Abrir modal de confirmación para borrar permanentemente
  const openCyclePermanentDeleteModal = (cycle: SchoolCycle) => {
    setCycleToDelete(cycle);
    setIsPermanentDelete(true);
    setShowCycleDeleteModal(true);
  };

  // Desactivar ciclo (soft delete)
  const handleDeactivateCycle = async () => {
    if (!cycleToDelete) return;
    try {
      setIsDeletingCycle(true);
      await deleteSchoolCycle(cycleToDelete.id);
      setCycles(prev => prev.map(c => c.id === cycleToDelete.id ? { ...c, is_active: false, is_current: false } : c));
      setDeletedCycleName(cycleToDelete.name);
      setShowCycleDeleteModal(false);
      setCycleDeleteStats(null);
      setShowCycleDeleteSuccessModal(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al desactivar el ciclo');
    } finally {
      setIsDeletingCycle(false);
    }
  };

  // Eliminar permanentemente ciclo (solo admin)
  const handlePermanentDeleteCycle = async () => {
    if (!cycleToDelete) return;
    try {
      setIsDeletingCycle(true);
      const result = await permanentDeleteCycle(cycleToDelete.id);
      setCycles(prev => prev.filter(c => c.id !== cycleToDelete.id));
      if (selectedCycleId === cycleToDelete.id) {
        setSelectedCycleId(null);
      }
      setDeletedCycleName(result.cycle_name);
      setCycleDeleteStats(result.stats);
      setShowCycleDeleteModal(false);
      setShowCycleDeleteSuccessModal(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar el ciclo permanentemente');
    } finally {
      setIsDeletingCycle(false);
    }
  };

  const handleDeactivateCampus = async () => {
    if (!campus) return;
    if (!confirm('¿Deseas desactivar este plantel?')) return;
    try {
      await deactivateCampus(campus.id);
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al desactivar el plantel');
    }
  };

  const handlePermanentDeleteCampus = async () => {
    if (!campus || !isAdmin) return;
    if (deleteConfirmText !== campus.name) {
      setError('Debe escribir el nombre exacto del plantel para confirmar');
      return;
    }
    
    try {
      setIsDeletingPermanently(true);
      const result = await permanentDeleteCampus(campus.id);
      
      // Mostrar modal de éxito
      setDeleteResult(result);
      setShowDeleteSuccessModal(true);
      setShowPermanentDeleteModal(false);
      setDeleteConfirmText('');
      
      // Redirigir después de 5 segundos
      setTimeout(() => {
        navigate(`/partners/${result.partner_id}`);
      }, 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar el plantel permanentemente');
    } finally {
      setIsDeletingPermanently(false);
      setShowPermanentDeleteModal(false);
      setDeleteConfirmText('');
    }
  };

  const handleModalBackdropClick = (e: React.MouseEvent) => {
    // Solo cerrar si el clic fue directamente en el backdrop (no en elementos hijos)
    if (e.target !== e.currentTarget) {
      return;
    }
    
    // Verificar si hay un datepicker abierto
    const datepickerOpen = document.querySelector('.react-datepicker-popper');
    if (datepickerOpen) {
      return; // No cerrar si hay un calendario abierto
    }
    
    setShowNewCycleModal(false);
  };

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando plantel..." />
      </div>
    );
  }

  if (error || !campus) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-2xl fluid-p-6 flex items-center fluid-gap-4">
          <AlertCircle className="fluid-icon-xl text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="fluid-text-lg font-semibold text-red-800">Error</p>
            <p className="fluid-text-base text-red-700">{error || 'Plantel no encontrado'}</p>
          </div>
          <Link to="/partners" className="fluid-px-4 fluid-py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-fluid-xl fluid-text-base font-medium transition-colors">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  const formatOfficeVersion = (version?: string) => {
    switch (version) {
      case 'office_2016': return 'Office 2016';
      case 'office_2019': return 'Office 2019';
      case 'office_365': return 'Microsoft 365';
      default: return 'No configurado';
    }
  };

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb 
        items={[
          { label: campus.partner?.name || 'Partner', path: `/partners/${campus.partner_id}` },
          { label: campus.name }
        ]} 
      />
      
      {/* Header con Gradiente */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 shadow-lg">
        <div className="flex items-center fluid-gap-5 flex-wrap">
          <Link
            to={`/partners/${campus.partner_id}`}
            className="fluid-p-3 bg-white/20 hover:bg-white/30 rounded-fluid-xl transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="fluid-icon-lg text-white" />
          </Link>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center fluid-gap-2 fluid-text-sm text-white/80 fluid-mb-1">
              <Building2 className="fluid-icon-sm" />
              <Link to={`/partners/${campus.partner_id}`} className="hover:text-white transition-colors">{campus.partner?.name}</Link>
            </div>
            <div className="flex items-center fluid-gap-3 flex-wrap">
              <h1 className="fluid-text-3xl font-bold text-white flex items-center fluid-gap-3">
                <MapPin className="fluid-icon-xl" />
                {campus.name}
              </h1>
              <span className="fluid-text-sm font-mono font-semibold text-blue-100 bg-white/20 fluid-px-3 fluid-py-1 rounded-full border border-white/30">{campus.code}</span>
              {campus.is_active ? (
                <span className="inline-flex items-center fluid-gap-1 fluid-text-sm font-medium text-green-100 bg-green-500/30 fluid-px-3 fluid-py-1 rounded-full border border-green-400/50">
                  <CheckCircle2 className="fluid-icon-sm" />Activo
                </span>
              ) : (
                <span className="inline-flex items-center fluid-gap-1 fluid-text-sm font-medium text-amber-100 bg-amber-500/30 fluid-px-3 fluid-py-1 rounded-full border border-amber-400/50">
                  <Zap className="fluid-icon-sm" />Pendiente
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center fluid-gap-3">
            <Link
              to={`/partners/campuses/${campusId}/edit`}
              className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-3 bg-white hover:bg-gray-100 text-blue-600 rounded-fluid-xl font-semibold fluid-text-base transition-all duration-300 hover:scale-105 shadow-lg"
            >
              <Edit className="fluid-icon-base" />
              Editar
            </Link>
            {campus.is_active && (
              <button
                onClick={handleDeactivateCampus}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-3 bg-white/20 hover:bg-white/30 text-white rounded-fluid-xl font-medium fluid-text-base transition-all duration-300"
              >
                <AlertCircle className="fluid-icon-base" />
                Desactivar
              </button>
            )}
            {/* Botón de eliminación permanente - Solo visible para administradores */}
            {isAdmin && (
              <button
                onClick={() => setShowPermanentDeleteModal(true)}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-3 bg-red-500/80 hover:bg-red-600 text-white rounded-fluid-xl font-medium fluid-text-base transition-all duration-300"
                title="Eliminar permanentemente (Solo Administrador)"
              >
                <Trash2 className="fluid-icon-base" />
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Banner de Activación Pendiente */}
      {!campus.is_active && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-fluid-2xl border border-amber-200 fluid-p-6 fluid-mb-6 shadow-sm">
          <div className="flex items-start fluid-gap-5 fluid-mb-5">
            <div className="fluid-p-3 bg-amber-100 rounded-fluid-xl">
              <Zap className="fluid-icon-xl text-amber-600" />
            </div>
            <div>
              <h2 className="fluid-text-xl font-bold text-gray-900 fluid-mb-1">Plantel Pendiente de Activación</h2>
              <p className="fluid-text-base text-gray-600">Completa el proceso de activación para gestionar ciclos escolares, grupos y exámenes.</p>
            </div>
          </div>
          <Link
            to={`/partners/campuses/${campus.id}/activate`}
            className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-fluid-xl font-semibold fluid-text-base transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            <Zap className="fluid-icon-lg" />Iniciar Activación
          </Link>
        </div>
      )}

      {/* SECCIÓN SUPERIOR: Información, Configuración, Costos, Responsable */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 fluid-gap-6 fluid-mb-6">
        {/* Información del plantel */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-lg hover:border-blue-200 transition-all duration-300">
          <h3 className="fluid-text-sm font-bold text-gray-700 uppercase tracking-wide fluid-mb-4 flex items-center fluid-gap-2">
            <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg">
              <Building2 className="fluid-icon-sm text-blue-600" />
            </div>
            Información
          </h3>
          <div className="fluid-space-y-4">
            <div className="flex items-start fluid-gap-4 fluid-p-4 bg-gray-50 rounded-fluid-xl hover:bg-gray-100 transition-colors">
              <MapPin className="fluid-icon-base text-gray-400 fluid-mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="fluid-text-sm font-semibold text-gray-900">{campus.state_name}{campus.city ? `, ${campus.city}` : ''}</p>
                {campus.address && <p className="fluid-text-xs text-gray-500 truncate fluid-mt-0.5">{campus.address}</p>}
              </div>
            </div>
            {campus.email && (
              <div className="flex items-center fluid-gap-4 fluid-p-4 bg-gray-50 rounded-fluid-xl hover:bg-blue-50 transition-colors group">
                <Mail className="fluid-icon-base text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                <a href={`mailto:${campus.email}`} className="fluid-text-sm text-blue-600 hover:underline truncate">{campus.email}</a>
              </div>
            )}
            {campus.phone && (
              <div className="flex items-center fluid-gap-4 fluid-p-4 bg-gray-50 rounded-fluid-xl hover:bg-green-50 transition-colors group">
                <Phone className="fluid-icon-base text-gray-400 group-hover:text-green-500 transition-colors flex-shrink-0" />
                <span className="fluid-text-sm font-medium text-gray-900">{campus.phone}</span>
              </div>
            )}
            {campus.director_name && (
              <div className="fluid-p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-fluid-xl border border-purple-100">
                <div className="flex items-center fluid-gap-2 fluid-mb-2">
                  <UserCog className="fluid-icon-base text-purple-500" />
                  <span className="fluid-text-xs font-bold text-purple-700 uppercase">Director</span>
                </div>
                <p className="fluid-text-sm font-semibold text-gray-900">{campus.director_full_name || campus.director_name}</p>
                {campus.director_email && (
                  <p className="fluid-text-xs text-gray-500 fluid-mt-2">{campus.director_email}</p>
                )}
                {campus.director_curp && (
                  <p className="fluid-text-xs text-gray-400 fluid-mt-1.5 font-mono">{campus.director_curp}</p>
                )}
              </div>
            )}
            {campus.created_at && (
              <div className="flex items-center fluid-gap-4 fluid-p-4 border-t border-gray-100 fluid-mt-3">
                <Clock className="fluid-icon-base text-gray-400 flex-shrink-0" />
                <div>
                  <p className="fluid-text-xs text-gray-500">Creado</p>
                  <p className="fluid-text-xs font-medium text-gray-700">{new Date(campus.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Configuración - Niveles y Funcionalidades */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-lg hover:border-gray-300 transition-all duration-300">
          <h3 className="fluid-text-sm font-bold text-gray-700 uppercase tracking-wide fluid-mb-4 flex items-center fluid-gap-2">
            <div className="fluid-p-2 bg-gray-100 rounded-fluid-lg">
              <Settings className="fluid-icon-sm text-gray-600" />
            </div>
            Configuración
          </h3>
          <div className="fluid-space-y-5">
            {/* Versión de Office */}
            <div className="flex items-center fluid-gap-4 fluid-p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-fluid-xl border border-blue-100">
              <Monitor className="fluid-icon-base text-blue-600" />
              <span className="fluid-text-sm font-bold text-gray-900">{formatOfficeVersion(campus.office_version)}</span>
            </div>
            
            {/* Niveles de Certificación */}
            <div>
              <p className="fluid-text-xs font-bold text-gray-500 uppercase tracking-wide fluid-mb-4">Niveles de Certificación</p>
              <div className="grid grid-cols-2 fluid-gap-4">
                <div className={`flex items-center justify-between fluid-gap-2 fluid-p-2.5 rounded-fluid-lg transition-all duration-200 ${campus.enable_tier_basic !== false ? 'bg-green-100 text-green-800 border-2 border-green-400' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                  <div className="flex items-center fluid-gap-2">
                    <Award className="fluid-icon-sm" />
                    <span className="fluid-text-xs font-semibold">Constancia</span>
                  </div>
                  {campus.enable_tier_basic !== false && <CheckCircle2 className="fluid-icon-sm text-green-600" />}
                </div>
                <div className={`flex items-center justify-between fluid-gap-2 fluid-p-2.5 rounded-fluid-lg transition-all duration-200 ${campus.enable_tier_standard ? 'bg-green-100 text-green-800 border-2 border-green-400' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                  <div className="flex items-center fluid-gap-2">
                    <Award className="fluid-icon-sm" />
                    <span className="fluid-text-xs font-semibold">Eduit</span>
                  </div>
                  {campus.enable_tier_standard && <CheckCircle2 className="fluid-icon-sm text-green-600" />}
                </div>
                <div className={`flex items-center justify-between fluid-gap-2 fluid-p-2.5 rounded-fluid-lg transition-all duration-200 ${campus.enable_tier_advanced ? 'bg-green-100 text-green-800 border-2 border-green-400' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                  <div className="flex items-center fluid-gap-2">
                    <Shield className="fluid-icon-sm" />
                    <span className="fluid-text-xs font-semibold">CONOCER</span>
                  </div>
                  {campus.enable_tier_advanced && <CheckCircle2 className="fluid-icon-sm text-green-600" />}
                </div>
                <div className={`flex items-center justify-between fluid-gap-2 fluid-p-2.5 rounded-fluid-lg transition-all duration-200 ${campus.enable_digital_badge ? 'bg-green-100 text-green-800 border-2 border-green-400' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                  <div className="flex items-center fluid-gap-2">
                    <Zap className="fluid-icon-sm" />
                    <span className="fluid-text-xs font-semibold">Insignia</span>
                  </div>
                  {campus.enable_digital_badge && <CheckCircle2 className="fluid-icon-sm text-green-600" />}
                </div>
              </div>
            </div>
            
            {/* Funcionalidades */}
            <div>
              <p className="fluid-text-xs font-bold text-gray-500 uppercase tracking-wide fluid-mb-4">Funcionalidades</p>
              <div className="grid grid-cols-2 fluid-gap-4">
                <div className={`flex items-center justify-between fluid-gap-2 fluid-p-2.5 rounded-fluid-lg transition-all duration-200 ${campus.enable_partial_evaluations ? 'bg-green-100 text-green-800 border-2 border-green-400' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                  <div className="flex items-center fluid-gap-2">
                    <FileText className="fluid-icon-sm" />
                    <span className="fluid-text-xs font-semibold">Parciales</span>
                  </div>
                  {campus.enable_partial_evaluations && <CheckCircle2 className="fluid-icon-sm text-green-600" />}
                </div>
                <div className={`flex items-center justify-between fluid-gap-2 fluid-p-2.5 rounded-fluid-lg transition-all duration-200 ${campus.enable_virtual_machines ? 'bg-green-100 text-green-800 border-2 border-green-400' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                  <div className="flex items-center fluid-gap-2">
                    <Globe className="fluid-icon-sm" />
                    <span className="fluid-text-xs font-semibold">VMs</span>
                  </div>
                  {campus.enable_virtual_machines && <CheckCircle2 className="fluid-icon-sm text-green-600" />}
                </div>
                <div className={`flex items-center justify-between fluid-gap-2 fluid-p-2.5 rounded-fluid-lg transition-all duration-200 ${campus.enable_unscheduled_partials ? 'bg-green-100 text-green-800 border-2 border-green-400' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                  <div className="flex items-center fluid-gap-2">
                    <Calendar className="fluid-icon-sm" />
                    <span className="fluid-text-xs font-semibold">Sin Agendar</span>
                  </div>
                  {campus.enable_unscheduled_partials && <CheckCircle2 className="fluid-icon-sm text-green-600" />}
                </div>
                <div className={`flex items-center justify-between fluid-gap-2 fluid-p-2.5 rounded-fluid-lg transition-all duration-200 ${campus.enable_online_payments ? 'bg-green-100 text-green-800 border-2 border-green-400' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                  <div className="flex items-center fluid-gap-2">
                    <CreditCard className="fluid-icon-sm" />
                    <span className="fluid-text-xs font-semibold">Pagos</span>
                  </div>
                  {campus.enable_online_payments && <CheckCircle2 className="fluid-icon-sm text-green-600" />}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Costos y Vigencia */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-lg hover:border-green-200 transition-all duration-300">
          <h3 className="fluid-text-sm font-bold text-gray-700 uppercase tracking-wide fluid-mb-4 flex items-center fluid-gap-2">
            <div className="fluid-p-2 bg-green-100 rounded-fluid-lg">
              <DollarSign className="fluid-icon-sm text-green-600" />
            </div>
            Costos y Vigencia
          </h3>
          <div className="fluid-space-y-6">
            <div className="grid grid-cols-2 fluid-gap-5">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-fluid-xl fluid-p-5 text-center border border-green-100 hover:shadow-md transition-all duration-200">
                <p className="fluid-text-2xl font-bold text-green-700">${campus.certification_cost || 0}</p>
                <p className="fluid-text-sm text-green-600 font-semibold fluid-mt-2">Certificación</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-fluid-xl fluid-p-5 text-center border border-blue-100 hover:shadow-md transition-all duration-200">
                <p className="fluid-text-2xl font-bold text-blue-700">${campus.retake_cost || 0}</p>
                <p className="fluid-text-sm text-blue-600 font-semibold fluid-mt-2">Retoma</p>
              </div>
            </div>
            {(campus.license_start_date || campus.license_end_date) ? (
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-fluid-xl fluid-p-5 border border-purple-100">
                <div className="flex items-center fluid-gap-3 fluid-mb-4">
                  <CalendarRange className="fluid-icon-base text-purple-600" />
                  <span className="fluid-text-sm font-bold text-purple-700">Vigencia</span>
                </div>
                <p className="fluid-text-sm text-purple-900 font-medium">
                  {campus.license_start_date ? new Date(campus.license_start_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} - {campus.license_end_date ? new Date(campus.license_end_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-fluid-xl fluid-p-5 text-center border border-gray-100">
                <CalendarRange className="fluid-icon-lg text-gray-300 mx-auto" />
                <p className="fluid-text-sm text-gray-400 fluid-mt-4 font-medium">Sin vigencia configurada</p>
              </div>
            )}
            <div className="fluid-pt-5 border-t border-gray-100">
              <div className="text-center fluid-p-5 bg-blue-50/50 rounded-fluid-xl hover:bg-blue-50 transition-colors border border-blue-100/50">
                <p className="fluid-text-2xl font-bold text-blue-700">{cycles.filter(c => c.is_active).length}</p>
                <p className="fluid-text-sm text-gray-600 font-semibold fluid-mt-2">Ciclos Activos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Responsable */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-lg hover:border-indigo-200 transition-all duration-300">
          <h3 className="fluid-text-sm font-bold text-gray-700 uppercase tracking-wide fluid-mb-4 flex items-center fluid-gap-2">
            <div className="fluid-p-2 bg-indigo-100 rounded-fluid-lg">
              <Shield className="fluid-icon-sm text-indigo-600" />
            </div>
            Responsable
          </h3>
          {campus.responsable ? (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-fluid-xl fluid-p-5 border border-indigo-100">
              <div className="flex items-center fluid-gap-4 fluid-mb-4">
                <div className="fluid-w-12 fluid-h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                  <UserCog className="fluid-icon-base text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="fluid-text-sm font-bold text-gray-900 truncate">{campus.responsable.full_name}</p>
                  <p className="fluid-text-xs text-gray-500 truncate fluid-mt-1">{campus.responsable.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap fluid-gap-3">
                {campus.responsable.can_manage_groups && <span className="fluid-text-xs bg-indigo-100 text-indigo-700 fluid-px-3 fluid-py-1.5 rounded-full font-semibold border border-indigo-200">Grupos</span>}
                {campus.responsable.can_bulk_create_candidates && <span className="fluid-text-xs bg-indigo-100 text-indigo-700 fluid-px-3 fluid-py-1.5 rounded-full font-semibold border border-indigo-200">Altas masivas</span>}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-fluid-xl fluid-p-6 text-center border border-amber-200">
              <AlertCircle className="fluid-icon-xl text-amber-400 mx-auto fluid-mb-4" />
              <p className="fluid-text-sm font-bold text-amber-800">Sin responsable asignado</p>
              <Link to={`/partners/campuses/${campus.id}/activate`} className="inline-flex items-center fluid-gap-2 fluid-text-sm text-indigo-600 hover:text-indigo-700 fluid-mt-4 font-semibold hover:underline">
                <Plus className="fluid-icon-sm" />Asignar responsable
              </Link>
            </div>
          )}
          {campus.activated_at && (
            <div className="fluid-mt-5 fluid-pt-5 border-t border-gray-100">
              <div className="flex items-center fluid-gap-4 fluid-p-4 bg-green-50 rounded-fluid-xl border border-green-100">
                <CheckCircle2 className="fluid-icon-base text-green-500" />
                <span className="fluid-text-sm text-green-700 font-semibold">Activado: {new Date(campus.activated_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN INFERIOR: Ciclos Escolares */}
      <div className="fluid-space-y-6">
        {/* Ciclos Escolares */}
        {campus.is_active && cyclesAvailable ? (
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300">
              <div className="fluid-p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
                  <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-3">
                    <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg">
                      <GraduationCap className="fluid-icon-base text-blue-600" />
                    </div>
                    Ciclos Escolares
                    <span className="fluid-text-sm font-medium text-gray-400 bg-gray-100 fluid-px-2 fluid-py-1 rounded-full">{cycles.length}</span>
                  </h3>
                  <div className="flex flex-col sm:flex-row fluid-gap-3">
                    {/* Campo de búsqueda */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar ciclo..."
                        value={cycleSearchTerm}
                        onChange={(e) => setCycleSearchTerm(e.target.value)}
                        className="w-full sm:w-64 fluid-pl-10 fluid-pr-8 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-sm"
                      />
                      {cycleSearchTerm && (
                        <button
                          onClick={() => setCycleSearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="fluid-icon-xs" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setShowNewCycleModal(true)}
                      className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl fluid-text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-md"
                    >
                      <Plus className="fluid-icon-sm" />Nuevo
                    </button>
                  </div>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto border-t border-gray-100">
                {cycles.length === 0 ? (
                  <div className="fluid-p-8 text-center">
                    <GraduationCap className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-3" />
                    <p className="fluid-text-base font-medium text-gray-500">No hay ciclos escolares</p>
                    <p className="fluid-text-sm text-gray-400 fluid-mt-1">Crea un ciclo para organizar tus grupos</p>
                  </div>
                ) : (
                  (() => {
                    const filteredCycles = cycleSearchTerm 
                      ? cycles.filter(c => c.name.toLowerCase().includes(cycleSearchTerm.toLowerCase()))
                      : cycles;
                    
                    return filteredCycles.length === 0 ? (
                      <div className="fluid-p-8 text-center">
                        <Search className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-3" />
                        <p className="fluid-text-base font-medium text-gray-500">No se encontraron ciclos</p>
                        <p className="fluid-text-sm text-gray-400 fluid-mt-1">No hay resultados para "{cycleSearchTerm}"</p>
                        <button
                          onClick={() => setCycleSearchTerm('')}
                          className="fluid-mt-3 fluid-text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Limpiar búsqueda
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {filteredCycles.map((cycle) => (
                      <div
                        key={cycle.id}
                        onClick={() => navigate(`/partners/cycles/${cycle.id}`)}
                        className={`fluid-p-4 cursor-pointer transition-all duration-200 hover:bg-blue-50 border-l-4 border-transparent hover:border-blue-500 ${!cycle.is_active ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center fluid-gap-2 flex-wrap">
                              <span className="fluid-text-base font-semibold text-gray-900 truncate">{cycle.name}</span>
                              {cycle.is_current && <span className="fluid-text-xs bg-blue-100 text-blue-700 fluid-px-2 fluid-py-0.5 rounded-full font-semibold border border-blue-200">Actual</span>}
                              {!cycle.is_active && <span className="fluid-text-xs bg-red-100 text-red-600 fluid-px-2 fluid-py-0.5 rounded-full font-semibold border border-red-200">Inactivo</span>}
                            </div>
                            <div className="flex items-center fluid-gap-4 fluid-text-sm text-gray-500 fluid-mt-1">
                              <span className="flex items-center fluid-gap-1">
                                <Calendar className="fluid-icon-xs" />
                                {new Date(cycle.start_date).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })} - {new Date(cycle.end_date).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}
                              </span>
                              <span className="flex items-center fluid-gap-1 font-medium">
                                <Layers className="fluid-icon-xs text-amber-500" />{cycle.groups?.length || 0} grupos
                              </span>
                            </div>
                          </div>
                          {/* Botones de acción: desactivar y borrar */}
                          <div className="flex items-center fluid-gap-1">
                            {cycle.is_active && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openCycleDeleteModal(cycle); }}
                                className="fluid-p-2 hover:bg-amber-50 rounded-fluid-xl text-gray-400 hover:text-amber-600 transition-colors"
                                title="Desactivar ciclo"
                              >
                                <Power className="fluid-icon-base" />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openCyclePermanentDeleteModal(cycle); }}
                                className="fluid-p-2 hover:bg-red-50 rounded-fluid-xl text-gray-400 hover:text-red-600 transition-colors"
                                title="Eliminar permanentemente (los grupos quedarán sin ciclo)"
                              >
                                <Trash2 className="fluid-icon-base" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                    );
                  })()
                )}
              </div>
            </div>
        ) : null}
      </div>

      {/* Modal para crear ciclo escolar */}
      {showNewCycleModal && campus.is_active && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:fluid-p-4 overflow-y-auto" onClick={handleModalBackdropClick}>
          <div ref={modalRef} className="bg-white rounded-3xl shadow-2xl max-w-xl w-full my-auto overflow-visible animate-fade-in-up border border-gray-100">
            <div className="fluid-p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-3xl">
              <h3 className="fluid-text-xl font-bold text-gray-900 flex items-center fluid-gap-3">
                <div className="fluid-p-2 bg-blue-100 rounded-fluid-xl">
                  <CalendarRange className="fluid-icon-lg text-blue-600" />
                </div>
                Nuevo Ciclo Escolar
              </h3>
              <p className="fluid-text-sm text-gray-500 fluid-mt-2">Crea un nuevo ciclo escolar para organizar los grupos del plantel</p>
            </div>
            <div className="fluid-p-6 fluid-space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 fluid-gap-5">
                <div>
                  <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2 flex items-center fluid-gap-2">
                    <Calendar className="fluid-icon-sm text-green-500" />
                    Fecha inicio *
                  </label>
                  <DatePickerInput
                    value={newCycleForm.start_date ? new Date(newCycleForm.start_date + 'T00:00:00') : null}
                    onChange={(date) => setNewCycleForm(prev => ({ 
                      ...prev, 
                      start_date: date ? date.toISOString().split('T')[0] : '' 
                    }))}
                    placeholder="Seleccionar fecha de inicio"
                    colorScheme="green"
                  />
                  {newCycleForm.start_date && (
                    <p className="fluid-text-xs text-green-600 fluid-mt-2 font-medium">
                      {new Date(newCycleForm.start_date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2 flex items-center fluid-gap-2">
                    <Calendar className="fluid-icon-sm text-indigo-500" />
                    Fecha fin *
                  </label>
                  <DatePickerInput
                    value={newCycleForm.end_date ? new Date(newCycleForm.end_date + 'T00:00:00') : null}
                    onChange={(date) => setNewCycleForm(prev => ({ 
                      ...prev, 
                      end_date: date ? date.toISOString().split('T')[0] : '' 
                    }))}
                    placeholder="Seleccionar fecha de fin"
                    minDate={newCycleForm.start_date ? new Date(newCycleForm.start_date + 'T00:00:00') : null}
                    colorScheme="indigo"
                  />
                  {newCycleForm.end_date && (
                    <p className="fluid-text-xs text-indigo-600 fluid-mt-2 font-medium">
                      {new Date(newCycleForm.end_date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
              {newCycleForm.start_date && newCycleForm.end_date && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-fluid-xl fluid-p-4 border border-blue-200">
                  <div className="flex items-center justify-between fluid-mb-2">
                    <label className="fluid-text-sm font-medium text-blue-700">Nombre del ciclo (generado automáticamente)</label>
                    <span className="fluid-text-xs bg-blue-100 text-blue-700 fluid-px-2 fluid-py-1 rounded-full font-semibold">
                      {Math.ceil((new Date(newCycleForm.end_date).getTime() - new Date(newCycleForm.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30))} meses
                    </span>
                  </div>
                  <p className="fluid-text-lg font-bold text-blue-900">{newCycleForm.name || 'Selecciona las fechas'}</p>
                </div>
              )}
            </div>
            <div className="fluid-p-6 border-t border-gray-200 flex justify-end fluid-gap-4 bg-gray-50 rounded-b-3xl">
              <button
                onClick={() => setShowNewCycleModal(false)}
                className="fluid-px-6 fluid-py-3 text-gray-700 hover:bg-gray-200 rounded-fluid-xl transition-all fluid-text-sm font-bold hover:shadow-md"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCycle}
                disabled={isCreatingCycle || !newCycleForm.start_date || !newCycleForm.end_date}
                className="fluid-px-6 fluid-py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-fluid-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center fluid-gap-2 fluid-text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                {isCreatingCycle ? (
                  <>
                    <div className="fluid-w-4 fluid-h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="fluid-icon-sm" />Crear Ciclo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de ciclo creado */}
      {showCycleSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up">
            <div className="fluid-p-8 text-center">
              <div className="fluid-w-20 fluid-h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto fluid-mb-5 shadow-lg animate-bounce-once">
                <CheckCircle2 className="fluid-icon-2xl text-white" />
              </div>
              <h3 className="fluid-text-2xl font-bold text-gray-900 fluid-mb-3">¡Ciclo Escolar Creado!</h3>
              <p className="fluid-text-base text-gray-600 fluid-mb-2">
                El ciclo escolar <span className="font-bold text-blue-600">"{createdCycleName}"</span> ha sido creado exitosamente.
              </p>
              <p className="fluid-text-sm text-gray-500 fluid-mb-6">Ya puedes agregar grupos a este ciclo escolar.</p>
              <div className="flex flex-col fluid-gap-3">
                <Link
                  to={`/partners/campuses/${campusId}/groups/new?cycle=${selectedCycleId}`}
                  className="fluid-px-6 fluid-py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-fluid-xl transition-all fluid-text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center fluid-gap-2"
                >
                  <Plus className="fluid-icon-sm" />Crear Primer Grupo
                </Link>
                <button
                  onClick={() => setShowCycleSuccessModal(false)}
                  className="fluid-px-6 fluid-py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-xl transition-all fluid-text-sm font-bold"
                >
                  Continuar sin crear grupo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Desactivar/Eliminar Ciclo */}
      {showCycleDeleteModal && cycleToDelete && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4"
          onClick={() => !isDeletingCycle && setShowCycleDeleteModal(false)}
        >
          <div 
            className="bg-white rounded-fluid-2xl w-full max-w-lg shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera diferente según acción */}
            <div className={`fluid-p-6 border-b rounded-t-fluid-2xl ${isPermanentDelete ? 'border-red-100 bg-red-50' : 'border-amber-100 bg-amber-50'}`}>
              <div className="flex items-center fluid-gap-3">
                <div className={`fluid-p-3 rounded-fluid-xl ${isPermanentDelete ? 'bg-red-100' : 'bg-amber-100'}`}>
                  {isPermanentDelete ? (
                    <Trash2 className="fluid-icon-xl text-red-600" />
                  ) : (
                    <Power className="fluid-icon-xl text-amber-600" />
                  )}
                </div>
                <div>
                  <h3 className={`fluid-text-xl font-bold ${isPermanentDelete ? 'text-red-900' : 'text-amber-900'}`}>
                    {isPermanentDelete ? 'Eliminar Ciclo Escolar' : 'Desactivar Ciclo Escolar'}
                  </h3>
                  <p className={`fluid-text-base font-medium ${isPermanentDelete ? 'text-red-800' : 'text-amber-800'}`}>"{cycleToDelete.name}"</p>
                </div>
              </div>
            </div>
            
            <div className="fluid-p-6">
              {isPermanentDelete ? (
                /* Mensaje para eliminar permanentemente */
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4">
                    <p className="fluid-text-base text-red-800 font-bold fluid-mb-2">⚠️ Esta acción NO se puede deshacer</p>
                    <p className="fluid-text-sm text-red-700 fluid-mb-3">Se eliminará el ciclo escolar permanentemente.</p>
                    <p className="fluid-text-sm text-red-700 font-medium">Los grupos del ciclo quedarán sin ciclo asignado.</p>
                  </div>
                  {(cycleToDelete.groups?.length || 0) > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-fluid-xl fluid-p-4">
                      <p className="fluid-text-sm text-amber-800 font-medium">
                        <Users className="fluid-icon-sm inline fluid-mr-1" />
                        {cycleToDelete.groups?.length} grupo(s) quedarán sin ciclo asignado
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Mensaje para desactivar ciclo */
                <div className="bg-amber-50 border border-amber-200 rounded-fluid-xl fluid-p-4">
                  <p className="fluid-text-base text-amber-800 font-medium fluid-mb-2">¿Deseas desactivar este ciclo?</p>
                  <p className="fluid-text-sm text-amber-700">El ciclo y sus grupos permanecerán en el sistema pero no estarán activos. Podrás reactivarlos después si es necesario.</p>
                </div>
              )}
            </div>

            <div className="fluid-p-6 border-t border-gray-200 flex justify-end fluid-gap-4 bg-gray-50 rounded-b-fluid-2xl">
              <button
                onClick={() => setShowCycleDeleteModal(false)}
                disabled={isDeletingCycle}
                className="fluid-px-6 fluid-py-3 text-gray-700 hover:bg-gray-200 rounded-fluid-xl transition-all fluid-text-sm font-bold disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={isPermanentDelete ? handlePermanentDeleteCycle : handleDeactivateCycle}
                disabled={isDeletingCycle}
                className={`fluid-px-6 fluid-py-3 rounded-fluid-xl transition-all fluid-text-sm font-bold flex items-center fluid-gap-2 disabled:opacity-50 shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${isPermanentDelete ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'}`}
              >
                {isDeletingCycle ? (
                  <>
                    <div className="fluid-w-4 fluid-h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isPermanentDelete ? 'Eliminando...' : 'Desactivando...'}
                  </>
                ) : (
                  <>
                    {isPermanentDelete ? <Trash2 className="fluid-icon-sm" /> : <Power className="fluid-icon-sm" />}
                    {isPermanentDelete ? 'Eliminar Permanentemente' : 'Desactivar Ciclo'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Éxito de Ciclo Eliminado/Desactivado */}
      {showCycleDeleteSuccessModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4"
          onClick={() => setShowCycleDeleteSuccessModal(false)}
        >
          <div 
            className="bg-white rounded-fluid-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fluid-p-8 text-center">
              <div className={`fluid-w-20 fluid-h-20 rounded-full flex items-center justify-center mx-auto fluid-mb-5 shadow-lg animate-bounce-once ${cycleDeleteStats ? 'bg-gradient-to-br from-red-400 to-red-600' : 'bg-gradient-to-br from-amber-400 to-orange-500'}`}>
                {cycleDeleteStats ? <AlertTriangle className="fluid-icon-2xl text-white" /> : <CheckCircle2 className="fluid-icon-2xl text-white" />}
              </div>
              <h3 className="fluid-text-2xl font-bold text-gray-900 fluid-mb-3">
                {cycleDeleteStats ? '¡Ciclo Eliminado!' : '¡Ciclo Desactivado!'}
              </h3>
              <p className="fluid-text-base text-gray-600 fluid-mb-4">
                El ciclo escolar <span className="font-bold text-blue-600">"{deletedCycleName}"</span> ha sido {cycleDeleteStats ? 'eliminado permanentemente' : 'desactivado'}.
              </p>
              
              {cycleDeleteStats && (
                <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 fluid-mb-4 text-left">
                  <p className="fluid-text-sm font-bold text-gray-700 fluid-mb-2">Resumen de la operación:</p>
                  <ul className="fluid-text-sm text-gray-600 space-y-1">
                    <li className="flex items-center fluid-gap-2">
                      <Layers className="fluid-icon-xs text-amber-500" />
                      <span><strong>{cycleDeleteStats.groups_deleted}</strong> grupos eliminados</span>
                    </li>
                    <li className="flex items-center fluid-gap-2">
                      <Users className="fluid-icon-xs text-blue-500" />
                      <span><strong>{cycleDeleteStats.members_removed}</strong> membresías de grupo eliminadas</span>
                    </li>
                    <li className="flex items-center fluid-gap-2">
                      <FileText className="fluid-icon-xs text-green-500" />
                      <span><strong>{cycleDeleteStats.exams_unassigned}</strong> exámenes desasignados</span>
                    </li>
                    <li className="flex items-center fluid-gap-2">
                      <GraduationCap className="fluid-icon-xs text-purple-500" />
                      <span><strong>{cycleDeleteStats.materials_unassigned}</strong> materiales desasignados</span>
                    </li>
                  </ul>
                </div>
              )}

              <button
                onClick={() => setShowCycleDeleteSuccessModal(false)}
                className="fluid-px-6 fluid-py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-fluid-xl transition-all fluid-text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación Permanente (Solo Admin) */}
      {showPermanentDeleteModal && campus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4">
          <div 
            ref={permanentDeleteModalRef}
            className="bg-white rounded-fluid-2xl w-full max-w-lg shadow-2xl animate-scale-in"
          >
            <div className="fluid-p-6 border-b border-red-100 bg-red-50 rounded-t-fluid-2xl">
              <div className="flex items-center fluid-gap-3">
                <div className="fluid-p-3 bg-red-100 rounded-fluid-xl">
                  <AlertTriangle className="fluid-icon-xl text-red-600" />
                </div>
                <div>
                  <h3 className="fluid-text-xl font-bold text-red-900">Eliminar Plantel Permanentemente</h3>
                  <p className="fluid-text-sm text-red-700">Esta acción no se puede deshacer</p>
                </div>
              </div>
            </div>
            
            <div className="fluid-p-6">
              <div className="bg-amber-50 border border-amber-200 rounded-fluid-xl fluid-p-4 fluid-mb-4">
                <p className="fluid-text-sm text-amber-800 font-medium fluid-mb-2">Se eliminarán permanentemente:</p>
                <ul className="fluid-text-sm text-amber-700 space-y-1 list-disc list-inside">
                  <li>El plantel y toda su información</li>
                  <li>Todos los ciclos escolares</li>
                  <li>Todos los grupos del plantel</li>
                  <li>Todas las asignaciones de exámenes y materiales</li>
                </ul>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-fluid-xl fluid-p-4 fluid-mb-4">
                <p className="fluid-text-sm text-green-800 font-medium fluid-mb-2">Se conservarán (no se eliminan):</p>
                <ul className="fluid-text-sm text-green-700 space-y-1 list-disc list-inside">
                  <li>Los usuarios candidatos (solo se desvinculan)</li>
                  <li>Los vouchers/certificaciones ya asignados</li>
                  <li>Los resultados de exámenes</li>
                </ul>
              </div>
              
              <div className="fluid-mb-4">
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                  Para confirmar, escriba el nombre del plantel: <span className="font-bold text-red-600">"{campus.name}"</span>
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Escriba el nombre del plantel"
                  className="w-full fluid-p-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              
              <div className="flex fluid-gap-3 fluid-mt-6">
                <button
                  onClick={() => {
                    setShowPermanentDeleteModal(false);
                    setDeleteConfirmText('');
                  }}
                  className="flex-1 fluid-px-4 fluid-py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-xl font-medium transition-colors"
                  disabled={isDeletingPermanently}
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePermanentDeleteCampus}
                  disabled={deleteConfirmText !== campus.name || isDeletingPermanently}
                  className="flex-1 fluid-px-4 fluid-py-3 bg-red-600 hover:bg-red-700 text-white rounded-fluid-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center fluid-gap-2"
                >
                  {isDeletingPermanently ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="fluid-icon-base" />
                      Eliminar Permanentemente
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Éxito de Eliminación */}
      {showDeleteSuccessModal && deleteResult && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4"
          onClick={(e) => {
            if (deleteSuccessModalRef.current && !deleteSuccessModalRef.current.contains(e.target as Node)) {
              setShowDeleteSuccessModal(false);
              navigate(`/partners/${deleteResult.partner_id}`);
            }
          }}
        >
          <div 
            ref={deleteSuccessModalRef}
            className="bg-white rounded-fluid-2xl w-full max-w-lg shadow-2xl animate-scale-in"
          >
            <div className="fluid-p-6 border-b border-green-100 bg-green-50 rounded-t-fluid-2xl">
              <div className="flex items-center fluid-gap-3">
                <div className="fluid-p-3 bg-green-100 rounded-fluid-xl">
                  <CheckCircle2 className="fluid-icon-xl text-green-600" />
                </div>
                <div>
                  <h3 className="fluid-text-xl font-bold text-green-900">Plantel Eliminado</h3>
                  <p className="fluid-text-sm text-green-700">La operación se completó exitosamente</p>
                </div>
              </div>
            </div>
            
            <div className="fluid-p-6">
              <p className="fluid-text-base text-gray-700 fluid-mb-4">{deleteResult.message}</p>
              
              <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 fluid-mb-4">
                <h4 className="fluid-text-sm font-semibold text-gray-700 fluid-mb-3">Resumen de la operación:</h4>
                <div className="grid grid-cols-2 gap-3 fluid-text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Grupos eliminados:</span>
                    <span className="font-medium text-gray-900">{deleteResult.stats.groups_deleted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ciclos eliminados:</span>
                    <span className="font-medium text-gray-900">{deleteResult.stats.cycles_deleted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Miembros desvinculados:</span>
                    <span className="font-medium text-gray-900">{deleteResult.stats.members_removed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Exámenes desasignados:</span>
                    <span className="font-medium text-gray-900">{deleteResult.stats.exams_unassigned}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Materiales desasignados:</span>
                    <span className="font-medium text-gray-900">{deleteResult.stats.materials_unassigned}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Usuarios desvinculados:</span>
                    <span className="font-medium text-gray-900">{deleteResult.stats.users_unlinked}</span>
                  </div>
                </div>
              </div>
              
              <p className="fluid-text-sm text-gray-500 text-center fluid-mb-4">
                Redirigiendo automáticamente en unos segundos...
              </p>
              
              <button
                onClick={() => {
                  setShowDeleteSuccessModal(false);
                  navigate(`/partners/${deleteResult.partner_id}`);
                }}
                className="w-full fluid-px-4 fluid-py-3 bg-green-600 hover:bg-green-700 text-white rounded-fluid-xl font-medium transition-colors"
              >
                Ir al Partner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
