/**
 * Detalle de Plantel (Campus) - Vista Mejorada
 * Con listas scrolleables, configuración visible y mejor UX
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  Campus,
  SchoolCycle,
  CandidateGroup,
} from '../../services/partnersService';

export default function CampusDetailPage() {
  const { campusId } = useParams();
  
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
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700 fluid-text-base">{error || 'Plantel no encontrado'}</p>
          <Link to="/partners" className="ml-auto text-red-700 underline">Volver</Link>
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
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4 fluid-mb-6">
        <div className="flex items-center fluid-gap-4">
          <Link to={`/partners/${campus.partner_id}`} className="fluid-p-2 hover:bg-gray-100 rounded-fluid-xl transition-colors">
            <ArrowLeft className="fluid-icon-lg text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center fluid-gap-2 fluid-text-sm text-gray-500 fluid-mb-1">
              <Building2 className="fluid-icon-sm" />
              <Link to={`/partners/${campus.partner_id}`} className="hover:text-blue-600">{campus.partner?.name}</Link>
            </div>
            <div className="flex items-center fluid-gap-3 flex-wrap">
              <h1 className="fluid-text-2xl font-bold text-gray-800">{campus.name}</h1>
              <span className="fluid-text-xs font-mono font-semibold text-blue-700 bg-blue-50 fluid-px-2 fluid-py-1 rounded-full border border-blue-200">{campus.code}</span>
              {campus.is_active ? (
                <span className="inline-flex items-center gap-1 fluid-text-xs font-medium text-green-700 bg-green-50 fluid-px-2 fluid-py-1 rounded-full">
                  <CheckCircle2 className="fluid-icon-xs" />Activo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 fluid-text-xs font-medium text-amber-700 bg-amber-50 fluid-px-2 fluid-py-1 rounded-full">
                  <Zap className="fluid-icon-xs" />Pendiente
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center fluid-gap-3">
          <Link to={`/partners/campuses/${campusId}/edit`} className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-lg font-medium fluid-text-sm transition-colors">
            <Edit className="fluid-icon-sm" />Editar
          </Link>
          {campus.is_active && (
            <button onClick={handleDeactivateCampus} className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-lg font-medium fluid-text-sm transition-colors">
              <AlertCircle className="fluid-icon-sm" />Desactivar
            </button>
          )}
        </div>
      </div>

      {!campus.is_active && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-fluid-2xl border border-amber-200 fluid-p-6 fluid-mb-6">
          <div className="flex items-start fluid-gap-4 fluid-mb-6">
            <div className="fluid-p-3 bg-amber-100 rounded-fluid-xl"><Zap className="fluid-icon-xl text-amber-600" /></div>
            <div>
              <h2 className="fluid-text-xl font-bold text-gray-900 fluid-mb-1">Plantel Pendiente de Activación</h2>
              <p className="fluid-text-base text-gray-600">Completa el proceso de activación para gestionar ciclos escolares, grupos y exámenes.</p>
            </div>
          </div>
          <Link to={`/partners/campuses/${campus.id}/activate`} className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-fluid-xl font-semibold fluid-text-base transition-all shadow-lg">
            <Zap className="fluid-icon-lg" />Iniciar Activación
          </Link>
        </div>
      )}

      {/* SECCIÓN SUPERIOR: Información, Configuración, Responsable */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 fluid-gap-6 fluid-mb-8">
        {/* Información del plantel */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 group">
          <h3 className="fluid-text-sm font-semibold text-gray-600 uppercase tracking-wide fluid-mb-4 flex items-center fluid-gap-2 group-hover:text-blue-600 transition-colors">
            <Building2 className="fluid-icon-sm text-blue-600" />Información
          </h3>
          <div className="fluid-space-y-3">
            <div className="flex items-start fluid-gap-3 fluid-p-2 rounded-fluid-lg hover:bg-gray-50 transition-colors">
              <MapPin className="fluid-icon-sm text-gray-400 fluid-mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="fluid-text-sm font-medium text-gray-900">{campus.state_name}{campus.city ? `, ${campus.city}` : ''}</p>
                {campus.address && <p className="fluid-text-xs text-gray-500 truncate fluid-mt-0.5">{campus.address}</p>}
              </div>
            </div>
            {campus.email && (
              <div className="flex items-center fluid-gap-3 fluid-p-2 rounded-fluid-lg hover:bg-gray-50 transition-colors">
                <Mail className="fluid-icon-sm text-gray-400 flex-shrink-0" />
                <a href={`mailto:${campus.email}`} className="fluid-text-sm text-blue-600 hover:underline truncate">{campus.email}</a>
              </div>
            )}
            {campus.phone && (
              <div className="flex items-center fluid-gap-3 fluid-p-2 rounded-fluid-lg hover:bg-gray-50 transition-colors">
                <Phone className="fluid-icon-sm text-gray-400 flex-shrink-0" />
                <span className="fluid-text-sm text-gray-900">{campus.phone}</span>
              </div>
            )}
            {campus.director_name && (
              <div className="flex items-center fluid-gap-3 fluid-p-2 rounded-fluid-lg hover:bg-gray-50 transition-colors">
                <UserCog className="fluid-icon-sm text-gray-400 flex-shrink-0" />
                <span className="fluid-text-sm text-gray-900">{campus.director_name}</span>
              </div>
            )}
            {campus.created_at && (
              <div className="flex items-center fluid-gap-3 fluid-p-2 fluid-mt-2 border-t border-gray-100">
                <Clock className="fluid-icon-sm text-gray-400 flex-shrink-0" />
                <span className="fluid-text-xs text-gray-500">Creado: {new Date(campus.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Configuración - Niveles y Funcionalidades */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-lg hover:border-gray-300 hover:-translate-y-1 transition-all duration-300 group">
          <h3 className="fluid-text-sm font-semibold text-gray-600 uppercase tracking-wide fluid-mb-4 flex items-center fluid-gap-2 group-hover:text-gray-800 transition-colors">
            <Settings className="fluid-icon-sm text-gray-600" />Configuración
          </h3>
          <div className="fluid-space-y-4">
            <div className="flex items-center fluid-gap-3 fluid-p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-fluid-xl border border-blue-100">
              <Monitor className="fluid-icon-base text-blue-600" />
              <span className="fluid-text-sm font-semibold text-gray-900">{formatOfficeVersion(campus.office_version)}</span>
            </div>
            <div className="grid grid-cols-2 fluid-gap-2">
              <div className={`flex items-center fluid-gap-2 fluid-p-2 rounded-fluid-lg transition-all duration-200 hover:scale-105 ${campus.enable_tier_basic !== false ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                <Award className="fluid-icon-sm" /><span className="fluid-text-xs font-medium">Constancia</span>
              </div>
              <div className={`flex items-center fluid-gap-2 fluid-p-2 rounded-fluid-lg transition-all duration-200 hover:scale-105 ${campus.enable_tier_standard ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                <Award className="fluid-icon-sm" /><span className="fluid-text-xs font-medium">Eduit</span>
              </div>
              <div className={`flex items-center fluid-gap-2 fluid-p-2 rounded-fluid-lg transition-all duration-200 hover:scale-105 ${campus.enable_tier_advanced ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                <Shield className="fluid-icon-sm" /><span className="fluid-text-xs font-medium">CONOCER</span>
              </div>
              <div className={`flex items-center fluid-gap-2 fluid-p-2 rounded-fluid-lg transition-all duration-200 hover:scale-105 ${campus.enable_digital_badge ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                <Zap className="fluid-icon-sm" /><span className="fluid-text-xs font-medium">Insignia</span>
              </div>
            </div>
            <div className="grid grid-cols-2 fluid-gap-2">
              <div className={`flex items-center fluid-gap-2 fluid-p-2 rounded-fluid-lg transition-all duration-200 hover:scale-105 ${campus.enable_partial_evaluations ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                <FileText className="fluid-icon-sm" /><span className="fluid-text-xs font-medium">Parciales</span>
              </div>
              <div className={`flex items-center fluid-gap-2 fluid-p-2 rounded-fluid-lg transition-all duration-200 hover:scale-105 ${campus.enable_virtual_machines ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                <Globe className="fluid-icon-sm" /><span className="fluid-text-xs font-medium">VMs</span>
              </div>
              <div className={`flex items-center fluid-gap-2 fluid-p-2 rounded-fluid-lg transition-all duration-200 hover:scale-105 ${campus.enable_unscheduled_partials ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                <Calendar className="fluid-icon-sm" /><span className="fluid-text-xs font-medium">Sin Agendar</span>
              </div>
              <div className={`flex items-center fluid-gap-2 fluid-p-2 rounded-fluid-lg transition-all duration-200 hover:scale-105 ${campus.enable_online_payments ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                <CreditCard className="fluid-icon-sm" /><span className="fluid-text-xs font-medium">Pagos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Costos y Vigencia */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-lg hover:border-green-200 hover:-translate-y-1 transition-all duration-300 group">
          <h3 className="fluid-text-sm font-semibold text-gray-600 uppercase tracking-wide fluid-mb-4 flex items-center fluid-gap-2 group-hover:text-green-600 transition-colors">
            <DollarSign className="fluid-icon-sm text-green-600" />Costos y Vigencia
          </h3>
          <div className="fluid-space-y-4">
            <div className="grid grid-cols-2 fluid-gap-3">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-fluid-xl fluid-p-3 text-center border border-green-100 hover:shadow-md transition-all duration-200">
                <p className="fluid-text-xl font-bold text-green-700">${campus.certification_cost || 0}</p>
                <p className="fluid-text-xs text-green-600 font-medium">Certificación</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-fluid-xl fluid-p-3 text-center border border-blue-100 hover:shadow-md transition-all duration-200">
                <p className="fluid-text-xl font-bold text-blue-700">${campus.retake_cost || 0}</p>
                <p className="fluid-text-xs text-blue-600 font-medium">Retoma</p>
              </div>
            </div>
            {(campus.license_start_date || campus.license_end_date) ? (
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-fluid-xl fluid-p-4 border border-purple-100">
                <div className="flex items-center fluid-gap-2 fluid-mb-2">
                  <CalendarRange className="fluid-icon-sm text-purple-600" />
                  <span className="fluid-text-sm font-semibold text-purple-700">Vigencia</span>
                </div>
                <p className="fluid-text-sm text-purple-900 font-medium">
                  {campus.license_start_date ? new Date(campus.license_start_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} - {campus.license_end_date ? new Date(campus.license_end_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 text-center border border-gray-100">
                <CalendarRange className="fluid-icon-lg text-gray-300 mx-auto" />
                <p className="fluid-text-xs text-gray-400 fluid-mt-2">Sin vigencia configurada</p>
              </div>
            )}
            <div className="grid grid-cols-2 fluid-gap-3 fluid-pt-3 border-t border-gray-100">
              <div className="text-center fluid-p-2 bg-blue-50/50 rounded-fluid-lg hover:bg-blue-50 transition-colors">
                <p className="fluid-text-2xl font-bold text-blue-700">{cycles.filter(c => c.is_active).length}</p>
                <p className="fluid-text-xs text-gray-600 font-medium">Ciclos Activos</p>
              </div>
              <div className="text-center fluid-p-2 bg-amber-50/50 rounded-fluid-lg hover:bg-amber-50 transition-colors">
                <p className="fluid-text-2xl font-bold text-amber-700">{cycles.reduce((acc, c) => acc + (c.groups?.length || 0), 0) + orphanGroups.length}</p>
                <p className="fluid-text-xs text-gray-600 font-medium">Grupos Totales</p>
              </div>
            </div>
          </div>
        </div>

        {/* Responsable */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-lg hover:border-indigo-200 hover:-translate-y-1 transition-all duration-300 group">
          <h3 className="fluid-text-sm font-semibold text-gray-600 uppercase tracking-wide fluid-mb-4 flex items-center fluid-gap-2 group-hover:text-indigo-600 transition-colors">
            <Shield className="fluid-icon-sm text-indigo-600" />Responsable
          </h3>
          {campus.responsable ? (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-fluid-xl fluid-p-4 border border-indigo-100">
              <div className="flex items-center fluid-gap-4 fluid-mb-3">
                <div className="fluid-w-12 fluid-h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                  <UserCog className="fluid-icon-base text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="fluid-text-sm font-semibold text-gray-900 truncate">{campus.responsable.full_name}</p>
                  <p className="fluid-text-xs text-gray-500 truncate fluid-mt-0.5">{campus.responsable.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap fluid-gap-2">
                {campus.responsable.can_manage_groups && <span className="fluid-text-xs bg-indigo-100 text-indigo-700 fluid-px-3 fluid-py-1 rounded-full font-medium">Grupos</span>}
                {campus.responsable.can_bulk_create_candidates && <span className="fluid-text-xs bg-indigo-100 text-indigo-700 fluid-px-3 fluid-py-1 rounded-full font-medium">Altas masivas</span>}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-fluid-xl fluid-p-5 text-center border border-amber-200">
              <AlertCircle className="fluid-icon-xl text-amber-400 mx-auto fluid-mb-3" />
              <p className="fluid-text-sm font-semibold text-amber-800">Sin responsable asignado</p>
              <Link to={`/partners/campuses/${campus.id}/activate`} className="inline-flex items-center fluid-gap-2 fluid-text-sm text-indigo-600 hover:text-indigo-700 fluid-mt-3 font-medium hover:underline">
                <Plus className="fluid-icon-sm" />Asignar responsable
              </Link>
            </div>
          )}
          {campus.activated_at && (
            <div className="fluid-mt-4 fluid-pt-4 border-t border-gray-100">
              <div className="flex items-center fluid-gap-3 fluid-p-2 bg-green-50 rounded-fluid-lg">
                <CheckCircle2 className="fluid-icon-sm text-green-500" />
                <span className="fluid-text-xs text-green-700 font-medium">Activado: {new Date(campus.activated_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
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
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="fluid-p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="fluid-text-base font-semibold text-gray-800 flex items-center fluid-gap-2">
                  <GraduationCap className="fluid-icon-base text-blue-600" />Ciclos Escolares
                </h3>
                <button onClick={() => setShowNewCycleModal(true)} className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-lg fluid-text-sm font-medium transition-colors">
                  <Plus className="fluid-icon-sm" />Nuevo
                </button>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {cycles.length === 0 ? (
                  <div className="fluid-p-6 text-center">
                    <GraduationCap className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-2" />
                    <p className="fluid-text-sm text-gray-500">No hay ciclos escolares</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {cycles.map((cycle) => (
                      <div key={cycle.id} onClick={() => setSelectedCycleId(cycle.id)} className={`fluid-p-3 cursor-pointer transition-all ${selectedCycleId === cycle.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50 border-l-4 border-transparent'} ${!cycle.is_active ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center fluid-gap-2">
                              <span className="fluid-text-sm font-medium text-gray-900 truncate">{cycle.name}</span>
                              {cycle.is_current && <span className="fluid-text-xs bg-blue-100 text-blue-700 fluid-px-1.5 fluid-py-0.5 rounded">Actual</span>}
                              {!cycle.is_active && <span className="fluid-text-xs bg-red-100 text-red-600 fluid-px-1.5 fluid-py-0.5 rounded">Inactivo</span>}
                            </div>
                            <div className="flex items-center fluid-gap-3 fluid-text-xs text-gray-500 fluid-mt-1">
                              <span>{new Date(cycle.start_date).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })} - {new Date(cycle.end_date).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}</span>
                              <span className="flex items-center fluid-gap-1"><Layers className="fluid-icon-xs" />{cycle.groups?.length || 0}</span>
                            </div>
                          </div>
                          {cycle.is_active && (
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteCycle(cycle.id); }} className="fluid-p-1.5 hover:bg-red-50 rounded-fluid-lg text-gray-400 hover:text-red-500 transition-colors">
                              <Trash2 className="fluid-icon-sm" />
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
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="fluid-p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="fluid-text-base font-semibold text-gray-800 flex items-center fluid-gap-2">
                  <Layers className="fluid-icon-base text-amber-600" />{selectedCycle ? `Grupos de ${selectedCycle.name}` : 'Grupos'}
                </h3>
                {selectedCycle && (
                  <Link to={`/partners/campuses/${campusId}/groups/new?cycle=${selectedCycle.id}`} className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-fluid-lg fluid-text-sm font-medium transition-colors">
                    <Plus className="fluid-icon-sm" />Nuevo
                  </Link>
                )}
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {!selectedCycle ? (
                  <div className="fluid-p-6 text-center">
                    <Layers className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-2" />
                    <p className="fluid-text-sm text-gray-500">Selecciona un ciclo escolar</p>
                  </div>
                ) : (!selectedCycle.groups || selectedCycle.groups.length === 0) ? (
                  <div className="fluid-p-6 text-center">
                    <Layers className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-2" />
                    <p className="fluid-text-sm text-gray-500">No hay grupos en este ciclo</p>
                    <Link to={`/partners/campuses/${campusId}/groups/new?cycle=${selectedCycle.id}`} className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-fluid-lg fluid-text-sm font-medium transition-colors fluid-mt-3">
                      <Plus className="fluid-icon-sm" />Crear Grupo
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {selectedCycle.groups.map((group) => (
                      <div key={group.id} className={`fluid-p-4 transition-all hover:bg-gray-50 ${!group.is_active ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center fluid-gap-2">
                              <span className="fluid-text-sm font-medium text-gray-900">{group.name}</span>
                              {group.code && <span className="fluid-text-xs font-mono bg-gray-100 text-gray-600 fluid-px-1.5 fluid-py-0.5 rounded">{group.code}</span>}
                              {!group.is_active && <span className="fluid-text-xs bg-red-100 text-red-600 fluid-px-1.5 fluid-py-0.5 rounded">Inactivo</span>}
                            </div>
                            <div className="flex items-center fluid-gap-3 fluid-text-xs text-gray-500 fluid-mt-1">
                              <span className="flex items-center fluid-gap-1"><Users className="fluid-icon-xs text-purple-500" />{group.member_count || 0} miembros</span>
                            </div>
                          </div>
                          <div className="flex items-center fluid-gap-1">
                            <Link to={`/partners/groups/${group.id}`} className="fluid-p-2 hover:bg-amber-50 rounded-fluid-lg text-amber-600">
                              <ChevronRight className="fluid-icon-base" />
                            </Link>
                            {group.is_active && (
                              <button onClick={() => handleDeleteGroup(group.id)} className="fluid-p-2 hover:bg-red-50 rounded-fluid-lg text-gray-400 hover:text-red-500 transition-colors">
                                <Trash2 className="fluid-icon-sm" />
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
                  <div className="flex items-center fluid-gap-2 fluid-mb-2">
                    <AlertCircle className="fluid-icon-sm text-amber-600" />
                    <span className="fluid-text-sm font-semibold text-amber-800">{orphanGroups.length} grupo(s) sin ciclo</span>
                  </div>
                  <div className="fluid-space-y-1 max-h-[100px] overflow-y-auto">
                    {orphanGroups.map((group) => (
                      <div key={group.id} className="flex items-center justify-between bg-white rounded-fluid-lg fluid-p-2">
                        <span className="fluid-text-sm text-gray-800">{group.name}</span>
                        <Link to={`/partners/groups/${group.id}/edit`} className="fluid-text-xs text-blue-600 hover:underline">Asignar</Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : campus.is_active ? (
          <div className="lg:col-span-2 bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-4">
            <div className="flex items-center justify-between fluid-mb-4">
              <h3 className="fluid-text-base font-semibold text-gray-800 flex items-center fluid-gap-2">
                <Layers className="fluid-icon-base text-amber-600" />Grupos
              </h3>
              <Link to={`/partners/campuses/${campusId}/groups/new`} className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-fluid-lg fluid-text-sm font-medium transition-colors">
                <Plus className="fluid-icon-sm" />Nuevo Grupo
              </Link>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {legacyGroups.length === 0 ? (
                <div className="fluid-p-6 text-center">
                  <Layers className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-2" />
                  <p className="fluid-text-sm text-gray-500">No hay grupos registrados</p>
                </div>
              ) : (
                <div className="fluid-space-y-2">
                  {legacyGroups.filter(g => g.is_active).map((group) => (
                    <div key={group.id} className="flex items-center justify-between fluid-p-3 bg-gray-50 rounded-fluid-lg hover:bg-gray-100 transition-colors">
                      <div>
                        <span className="fluid-text-sm font-medium text-gray-900">{group.name}</span>
                        <div className="fluid-text-xs text-gray-500 flex items-center fluid-gap-1">
                          <Users className="fluid-icon-xs" />{group.member_count || 0} miembros
                        </div>
                      </div>
                      <Link to={`/partners/groups/${group.id}`} className="fluid-p-2 hover:bg-amber-50 rounded-fluid-lg text-amber-600">
                        <ChevronRight className="fluid-icon-base" />
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
                <label className="block fluid-text-sm font-semibold text-gray-700 fluid-mb-2">Nombre del ciclo *</label>
                <input type="text" value={newCycleForm.name} onChange={(e) => setNewCycleForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Ej: 2026-2027" className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all hover:border-blue-300" autoFocus />
              </div>
              <div className="grid grid-cols-2 fluid-gap-5">
                <div>
                  <label className="block fluid-text-sm font-semibold text-gray-700 fluid-mb-2">Fecha inicio *</label>
                  <input type="date" value={newCycleForm.start_date} onChange={(e) => setNewCycleForm(prev => ({ ...prev, start_date: e.target.value }))} className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all hover:border-blue-300" />
                </div>
                <div>
                  <label className="block fluid-text-sm font-semibold text-gray-700 fluid-mb-2">Fecha fin *</label>
                  <input type="date" value={newCycleForm.end_date} onChange={(e) => setNewCycleForm(prev => ({ ...prev, end_date: e.target.value }))} className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all hover:border-blue-300" />
                </div>
              </div>
            </div>
            <div className="fluid-p-6 border-t border-gray-200 flex justify-end fluid-gap-4 bg-gray-50">
              <button onClick={() => setShowNewCycleModal(false)} className="fluid-px-6 fluid-py-2.5 text-gray-700 hover:bg-gray-200 rounded-fluid-xl transition-all fluid-text-sm font-semibold hover:shadow-md">Cancelar</button>
              <button onClick={handleCreateCycle} disabled={isCreatingCycle || !newCycleForm.name || !newCycleForm.start_date || !newCycleForm.end_date} className="fluid-px-6 fluid-py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-fluid-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center fluid-gap-2 fluid-text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                {isCreatingCycle ? (<><div className="fluid-w-4 fluid-h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creando...</>) : (<><Plus className="fluid-icon-sm" />Crear Ciclo</>)}
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
              <p className="fluid-text-base text-gray-600 fluid-mb-2">El ciclo escolar <span className="font-semibold text-blue-600">"{createdCycleName}"</span> ha sido creado exitosamente.</p>
              <p className="fluid-text-sm text-gray-500 fluid-mb-6">Ya puedes agregar grupos a este ciclo escolar.</p>
              <div className="flex flex-col fluid-gap-3">
                <Link to={`/partners/campuses/${campusId}/groups/new?cycle=${selectedCycleId}`} className="fluid-px-6 fluid-py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-fluid-xl transition-all fluid-text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center fluid-gap-2">
                  <Plus className="fluid-icon-sm" />Crear Primer Grupo
                </Link>
                <button onClick={() => setShowCycleSuccessModal(false)} className="fluid-px-6 fluid-py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-xl transition-all fluid-text-sm font-semibold">
                  Continuar sin crear grupo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
