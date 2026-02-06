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
  ChevronRight,
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
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getCampus,
  getSchoolCycles,
  createSchoolCycle,
  deleteSchoolCycle,
  deleteGroup,
  getGroups,
  deactivateCampus,
  permanentDeleteCampus,
  Campus,
  SchoolCycle,
  CandidateGroup,
} from '../../services/partnersService';
import { useAuthStore } from '../../store/authStore';

export default function CampusDetailPage() {
  const { campusId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  
  const [campus, setCampus] = useState<Campus | null>(null);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [legacyGroups, setLegacyGroups] = useState<CandidateGroup[]>([]);
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
  
  // Estado para eliminación permanente (solo admin)
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
  const [isDeletingPermanently, setIsDeletingPermanently] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const permanentDeleteModalRef = useRef<HTMLDivElement>(null);

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
        try {
          const groupsData = await getGroups(Number(campusId));
          setLegacyGroups(groupsData.groups);
        } catch (groupsError) {
          console.log('Groups endpoint error:', groupsError);
          setLegacyGroups(campusData.groups || []);
        }
      }
    } catch (err: any) {
      console.error('Error loading campus:', err);
      setError(err.response?.data?.error || err.message || 'Error al cargar el plantel');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCycle = async () => {
    if (!newCycleForm.name || !newCycleForm.start_date || !newCycleForm.end_date) return;
    
    try {
      setIsCreatingCycle(true);
      const newCycle = await createSchoolCycle(Number(campusId), newCycleForm);
      setCycles(prev => [newCycle, ...prev]);
      setSelectedCycleId(newCycle.id);
      setCreatedCycleName(newCycleForm.name);
      setShowNewCycleModal(false);
      setNewCycleForm({ name: '', cycle_type: 'annual', start_date: '', end_date: '', is_current: true });
      setShowCycleSuccessModal(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear el ciclo escolar');
    } finally {
      setIsCreatingCycle(false);
    }
  };

  const handleDeleteCycle = async (cycleId: number) => {
    if (!confirm('¿Estás seguro de desactivar este ciclo escolar?')) return;
    try {
      await deleteSchoolCycle(cycleId);
      setCycles(prev => prev.map(c => c.id === cycleId ? { ...c, is_active: false, is_current: false } : c));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al desactivar el ciclo');
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('¿Estás seguro de desactivar este grupo?')) return;
    try {
      await deleteGroup(groupId);
      setCycles(prev => prev.map(c => ({
        ...c,
        groups: c.groups?.map(g => g.id === groupId ? { ...g, is_active: false } : g)
      })));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al desactivar el grupo');
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
      
      // Mostrar resumen y redirigir
      alert(`${result.message}\n\nResumen:\n- Grupos eliminados: ${result.stats.groups_deleted}\n- Ciclos eliminados: ${result.stats.cycles_deleted}\n- Miembros desvinculados: ${result.stats.members_removed}\n- Exámenes desasignados: ${result.stats.exams_unassigned}\n- Materiales desasignados: ${result.stats.materials_unassigned}\n- Usuarios desvinculados: ${result.stats.users_unlinked}`);
      
      navigate(`/partners/${result.partner_id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar el plantel permanentemente');
    } finally {
      setIsDeletingPermanently(false);
      setShowPermanentDeleteModal(false);
      setDeleteConfirmText('');
    }
  };

  const handleModalBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      setShowNewCycleModal(false);
    }
  };

  const selectedCycle = cycles.find(c => c.id === selectedCycleId);
  const orphanGroups = campus?.groups?.filter(g => !g.school_cycle_id) || [];

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
          <div className="fluid-space-y-3">
            <div className="flex items-start fluid-gap-3 fluid-p-3 bg-gray-50 rounded-fluid-xl hover:bg-gray-100 transition-colors">
              <MapPin className="fluid-icon-base text-gray-400 fluid-mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="fluid-text-sm font-semibold text-gray-900">{campus.state_name}{campus.city ? `, ${campus.city}` : ''}</p>
                {campus.address && <p className="fluid-text-xs text-gray-500 truncate fluid-mt-0.5">{campus.address}</p>}
              </div>
            </div>
            {campus.email && (
              <div className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 rounded-fluid-xl hover:bg-blue-50 transition-colors group">
                <Mail className="fluid-icon-base text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                <a href={`mailto:${campus.email}`} className="fluid-text-sm text-blue-600 hover:underline truncate">{campus.email}</a>
              </div>
            )}
            {campus.phone && (
              <div className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 rounded-fluid-xl hover:bg-green-50 transition-colors group">
                <Phone className="fluid-icon-base text-gray-400 group-hover:text-green-500 transition-colors flex-shrink-0" />
                <span className="fluid-text-sm font-medium text-gray-900">{campus.phone}</span>
              </div>
            )}
            {campus.director_name && (
              <div className="fluid-p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-fluid-xl border border-purple-100">
                <div className="flex items-center fluid-gap-2 fluid-mb-2">
                  <UserCog className="fluid-icon-base text-purple-500" />
                  <span className="fluid-text-xs font-bold text-purple-700 uppercase">Director</span>
                </div>
                <p className="fluid-text-sm font-semibold text-gray-900">{campus.director_full_name || campus.director_name}</p>
                {campus.director_email && (
                  <p className="fluid-text-xs text-gray-500 fluid-mt-1">{campus.director_email}</p>
                )}
                {campus.director_curp && (
                  <p className="fluid-text-xs text-gray-400 fluid-mt-0.5 font-mono">{campus.director_curp}</p>
                )}
              </div>
            )}
            {campus.created_at && (
              <div className="flex items-center fluid-gap-3 fluid-p-3 border-t border-gray-100 fluid-mt-2">
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
          <div className="fluid-space-y-4">
            {/* Versión de Office */}
            <div className="flex items-center fluid-gap-3 fluid-p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-fluid-xl border border-blue-100">
              <Monitor className="fluid-icon-base text-blue-600" />
              <span className="fluid-text-sm font-bold text-gray-900">{formatOfficeVersion(campus.office_version)}</span>
            </div>
            
            {/* Niveles de Certificación */}
            <div>
              <p className="fluid-text-xs font-bold text-gray-500 uppercase tracking-wide fluid-mb-2">Niveles de Certificación</p>
              <div className="grid grid-cols-2 fluid-gap-2">
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
              <p className="fluid-text-xs font-bold text-gray-500 uppercase tracking-wide fluid-mb-2">Funcionalidades</p>
              <div className="grid grid-cols-2 fluid-gap-2">
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
          <div className="fluid-space-y-4">
            <div className="grid grid-cols-2 fluid-gap-3">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-fluid-xl fluid-p-4 text-center border border-green-100 hover:shadow-md transition-all duration-200">
                <p className="fluid-text-2xl font-bold text-green-700">${campus.certification_cost || 0}</p>
                <p className="fluid-text-xs text-green-600 font-semibold fluid-mt-1">Certificación</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-fluid-xl fluid-p-4 text-center border border-blue-100 hover:shadow-md transition-all duration-200">
                <p className="fluid-text-2xl font-bold text-blue-700">${campus.retake_cost || 0}</p>
                <p className="fluid-text-xs text-blue-600 font-semibold fluid-mt-1">Retoma</p>
              </div>
            </div>
            {(campus.license_start_date || campus.license_end_date) ? (
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-fluid-xl fluid-p-4 border border-purple-100">
                <div className="flex items-center fluid-gap-2 fluid-mb-2">
                  <CalendarRange className="fluid-icon-base text-purple-600" />
                  <span className="fluid-text-sm font-bold text-purple-700">Vigencia</span>
                </div>
                <p className="fluid-text-sm text-purple-900 font-medium">
                  {campus.license_start_date ? new Date(campus.license_start_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} - {campus.license_end_date ? new Date(campus.license_end_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 text-center border border-gray-100">
                <CalendarRange className="fluid-icon-lg text-gray-300 mx-auto" />
                <p className="fluid-text-xs text-gray-400 fluid-mt-2 font-medium">Sin vigencia configurada</p>
              </div>
            )}
            <div className="grid grid-cols-2 fluid-gap-3 fluid-pt-3 border-t border-gray-100">
              <div className="text-center fluid-p-3 bg-blue-50/50 rounded-fluid-xl hover:bg-blue-50 transition-colors border border-blue-100/50">
                <p className="fluid-text-2xl font-bold text-blue-700">{cycles.filter(c => c.is_active).length}</p>
                <p className="fluid-text-xs text-gray-600 font-semibold">Ciclos Activos</p>
              </div>
              <div className="text-center fluid-p-3 bg-amber-50/50 rounded-fluid-xl hover:bg-amber-50 transition-colors border border-amber-100/50">
                <p className="fluid-text-2xl font-bold text-amber-700">{cycles.reduce((acc, c) => acc + (c.groups?.length || 0), 0) + orphanGroups.length}</p>
                <p className="fluid-text-xs text-gray-600 font-semibold">Grupos Totales</p>
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
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-fluid-xl fluid-p-4 border border-indigo-100">
              <div className="flex items-center fluid-gap-4 fluid-mb-3">
                <div className="fluid-w-12 fluid-h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                  <UserCog className="fluid-icon-base text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="fluid-text-sm font-bold text-gray-900 truncate">{campus.responsable.full_name}</p>
                  <p className="fluid-text-xs text-gray-500 truncate fluid-mt-0.5">{campus.responsable.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap fluid-gap-2">
                {campus.responsable.can_manage_groups && <span className="fluid-text-xs bg-indigo-100 text-indigo-700 fluid-px-3 fluid-py-1 rounded-full font-semibold border border-indigo-200">Grupos</span>}
                {campus.responsable.can_bulk_create_candidates && <span className="fluid-text-xs bg-indigo-100 text-indigo-700 fluid-px-3 fluid-py-1 rounded-full font-semibold border border-indigo-200">Altas masivas</span>}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-fluid-xl fluid-p-5 text-center border border-amber-200">
              <AlertCircle className="fluid-icon-xl text-amber-400 mx-auto fluid-mb-3" />
              <p className="fluid-text-sm font-bold text-amber-800">Sin responsable asignado</p>
              <Link to={`/partners/campuses/${campus.id}/activate`} className="inline-flex items-center fluid-gap-2 fluid-text-sm text-indigo-600 hover:text-indigo-700 fluid-mt-3 font-semibold hover:underline">
                <Plus className="fluid-icon-sm" />Asignar responsable
              </Link>
            </div>
          )}
          {campus.activated_at && (
            <div className="fluid-mt-4 fluid-pt-4 border-t border-gray-100">
              <div className="flex items-center fluid-gap-3 fluid-p-3 bg-green-50 rounded-fluid-xl border border-green-100">
                <CheckCircle2 className="fluid-icon-base text-green-500" />
                <span className="fluid-text-xs text-green-700 font-semibold">Activado: {new Date(campus.activated_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN INFERIOR: Ciclos y Grupos lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6">
        {/* Ciclos Escolares */}
        {campus.is_active && cyclesAvailable ? (
          <>
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300">
              <div className="fluid-p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
                <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-3">
                  <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg">
                    <GraduationCap className="fluid-icon-base text-blue-600" />
                  </div>
                  Ciclos Escolares
                  <span className="fluid-text-sm font-medium text-gray-400 bg-gray-100 fluid-px-2 fluid-py-1 rounded-full">{cycles.length}</span>
                </h3>
                <button
                  onClick={() => setShowNewCycleModal(true)}
                  className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl fluid-text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-md"
                >
                  <Plus className="fluid-icon-sm" />Nuevo
                </button>
              </div>
              <div className="max-h-[350px] overflow-y-auto">
                {cycles.length === 0 ? (
                  <div className="fluid-p-8 text-center">
                    <GraduationCap className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-3" />
                    <p className="fluid-text-base font-medium text-gray-500">No hay ciclos escolares</p>
                    <p className="fluid-text-sm text-gray-400 fluid-mt-1">Crea un ciclo para organizar tus grupos</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {cycles.map((cycle) => (
                      <div
                        key={cycle.id}
                        onClick={() => setSelectedCycleId(cycle.id)}
                        className={`fluid-p-4 cursor-pointer transition-all duration-200 ${selectedCycleId === cycle.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50 border-l-4 border-transparent'} ${!cycle.is_active ? 'opacity-50' : ''}`}
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
                          {cycle.is_active && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteCycle(cycle.id); }}
                              className="fluid-p-2 hover:bg-red-50 rounded-fluid-xl text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="fluid-icon-base" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Grupos del ciclo seleccionado */}
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300">
              <div className="fluid-p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
                <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-3">
                  <div className="fluid-p-2 bg-amber-100 rounded-fluid-lg">
                    <Layers className="fluid-icon-base text-amber-600" />
                  </div>
                  {selectedCycle ? `Grupos de ${selectedCycle.name}` : 'Grupos'}
                </h3>
                {selectedCycle && (
                  <Link
                    to={`/partners/campuses/${campusId}/groups/new?cycle=${selectedCycle.id}`}
                    className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-fluid-xl fluid-text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-md"
                  >
                    <Plus className="fluid-icon-sm" />Nuevo
                  </Link>
                )}
              </div>
              <div className="max-h-[350px] overflow-y-auto">
                {!selectedCycle ? (
                  <div className="fluid-p-8 text-center">
                    <Layers className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-3" />
                    <p className="fluid-text-base font-medium text-gray-500">Selecciona un ciclo escolar</p>
                    <p className="fluid-text-sm text-gray-400 fluid-mt-1">Para ver sus grupos</p>
                  </div>
                ) : (!selectedCycle.groups || selectedCycle.groups.length === 0) ? (
                  <div className="fluid-p-8 text-center">
                    <Layers className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-3" />
                    <p className="fluid-text-base font-medium text-gray-500">No hay grupos en este ciclo</p>
                    <Link
                      to={`/partners/campuses/${campusId}/groups/new?cycle=${selectedCycle.id}`}
                      className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-fluid-xl fluid-text-sm font-semibold transition-all fluid-mt-4 shadow-md"
                    >
                      <Plus className="fluid-icon-sm" />Crear Grupo
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {selectedCycle.groups.map((group) => (
                      <div key={group.id} className={`fluid-p-4 transition-all hover:bg-gray-50 ${!group.is_active ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center fluid-gap-2 flex-wrap">
                              <span className="fluid-text-base font-semibold text-gray-900">{group.name}</span>
                              {group.code && <span className="fluid-text-xs font-mono bg-gray-100 text-gray-600 fluid-px-2 fluid-py-0.5 rounded-full font-semibold border border-gray-200">{group.code}</span>}
                              {!group.is_active && <span className="fluid-text-xs bg-red-100 text-red-600 fluid-px-2 fluid-py-0.5 rounded-full font-semibold border border-red-200">Inactivo</span>}
                            </div>
                            <div className="flex items-center fluid-gap-3 fluid-text-sm text-gray-500 fluid-mt-1">
                              <span className="flex items-center fluid-gap-1 font-medium">
                                <Users className="fluid-icon-xs text-purple-500" />{group.member_count || 0} miembros
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center fluid-gap-2">
                            <Link to={`/partners/groups/${group.id}`} className="fluid-p-2 hover:bg-amber-50 rounded-fluid-xl text-amber-600 transition-colors">
                              <ChevronRight className="fluid-icon-lg" />
                            </Link>
                            {group.is_active && (
                              <button onClick={() => handleDeleteGroup(group.id)} className="fluid-p-2 hover:bg-red-50 rounded-fluid-xl text-gray-400 hover:text-red-500 transition-colors">
                                <Trash2 className="fluid-icon-base" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {orphanGroups.length > 0 && (
                <div className="border-t border-amber-200 bg-amber-50 fluid-p-4">
                  <div className="flex items-center fluid-gap-2 fluid-mb-3">
                    <AlertCircle className="fluid-icon-base text-amber-600" />
                    <span className="fluid-text-sm font-bold text-amber-800">{orphanGroups.length} grupo(s) sin ciclo</span>
                  </div>
                  <div className="fluid-space-y-2 max-h-[120px] overflow-y-auto">
                    {orphanGroups.map((group) => (
                      <div key={group.id} className="flex items-center justify-between bg-white rounded-fluid-xl fluid-p-3 border border-amber-200">
                        <span className="fluid-text-sm font-medium text-gray-800">{group.name}</span>
                        <Link to={`/partners/groups/${group.id}/edit`} className="fluid-text-xs text-blue-600 hover:underline font-semibold">Asignar</Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : campus.is_active ? (
          <div className="lg:col-span-2 bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300">
            <div className="fluid-p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
              <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-3">
                <div className="fluid-p-2 bg-amber-100 rounded-fluid-lg">
                  <Layers className="fluid-icon-base text-amber-600" />
                </div>
                Grupos
              </h3>
              <Link
                to={`/partners/campuses/${campusId}/groups/new`}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-fluid-xl fluid-text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-md"
              >
                <Plus className="fluid-icon-sm" />Nuevo Grupo
              </Link>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {legacyGroups.length === 0 ? (
                <div className="fluid-p-8 text-center">
                  <Layers className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-3" />
                  <p className="fluid-text-base font-medium text-gray-500">No hay grupos registrados</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {legacyGroups.filter(g => g.is_active).map((group) => (
                    <div key={group.id} className="flex items-center justify-between fluid-p-4 hover:bg-gray-50 transition-colors">
                      <div>
                        <span className="fluid-text-base font-semibold text-gray-900">{group.name}</span>
                        <div className="fluid-text-sm text-gray-500 flex items-center fluid-gap-1 fluid-mt-1">
                          <Users className="fluid-icon-xs" />{group.member_count || 0} miembros
                        </div>
                      </div>
                      <Link to={`/partners/groups/${group.id}`} className="fluid-p-2 hover:bg-amber-50 rounded-fluid-xl text-amber-600 transition-colors">
                        <ChevronRight className="fluid-icon-lg" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Modal para crear ciclo escolar */}
      {showNewCycleModal && campus.is_active && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4" onClick={handleModalBackdropClick}>
          <div ref={modalRef} className="bg-white rounded-fluid-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in-up">
            <div className="fluid-p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h3 className="fluid-text-xl font-bold text-gray-900 flex items-center fluid-gap-3">
                <div className="fluid-p-2 bg-blue-100 rounded-fluid-xl">
                  <CalendarRange className="fluid-icon-lg text-blue-600" />
                </div>
                Nuevo Ciclo Escolar
              </h3>
              <p className="fluid-text-sm text-gray-500 fluid-mt-2">Crea un nuevo ciclo escolar para organizar los grupos del plantel</p>
            </div>
            <div className="fluid-p-6 fluid-space-y-5">
              <div>
                <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2">Nombre del ciclo *</label>
                <input
                  type="text"
                  value={newCycleForm.name}
                  onChange={(e) => setNewCycleForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: 2026-2027"
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all hover:border-blue-300"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 fluid-gap-5">
                <div>
                  <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2">Fecha inicio *</label>
                  <input
                    type="date"
                    value={newCycleForm.start_date}
                    onChange={(e) => setNewCycleForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all hover:border-blue-300"
                  />
                </div>
                <div>
                  <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2">Fecha fin *</label>
                  <input
                    type="date"
                    value={newCycleForm.end_date}
                    onChange={(e) => setNewCycleForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all hover:border-blue-300"
                  />
                </div>
              </div>
            </div>
            <div className="fluid-p-6 border-t border-gray-200 flex justify-end fluid-gap-4 bg-gray-50">
              <button
                onClick={() => setShowNewCycleModal(false)}
                className="fluid-px-6 fluid-py-3 text-gray-700 hover:bg-gray-200 rounded-fluid-xl transition-all fluid-text-sm font-bold hover:shadow-md"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCycle}
                disabled={isCreatingCycle || !newCycleForm.name || !newCycleForm.start_date || !newCycleForm.end_date}
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
    </div>
  );
}
