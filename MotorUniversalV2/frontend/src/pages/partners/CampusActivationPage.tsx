/**
 * Página de Activación de Plantel
 * Guía al usuario a través del proceso de activación paso a paso
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  UserCog,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Shield,
  Users,
  GraduationCap,
  Zap,
  Check,
  User,
  Mail,
  Copy,
  Eye,
  EyeOff,
  Settings,
  Calendar,
  DollarSign,
  Monitor,
  CreditCard,
  Award,
  FileText,
  BadgeCheck,
  Sparkles,
  Clock,
  UserPlus,
  UserCheck,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import DatePickerInput from '../../components/DatePickerInput';
import StyledSelect from '../../components/StyledSelect';
import {
  getCampus,
  Campus,
  CampusResponsable,
  CreateResponsableData,
  createCampusResponsable,
  configureCampus,
  ConfigureCampusRequest,
  getAvailableResponsables,
  assignExistingResponsable,
  AvailableResponsable,
  getAvailableCompetencyStandards,
  AvailableCompetencyStandard,
  getCampusCompetencyStandards,
  addCampusResponsable,
  type CampusResponsableItem,
} from '../../services/partnersService';

interface ActivationStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'completed' | 'current' | 'pending';
}

export default function CampusActivationPage() {
  const { campusId } = useParams();
  const navigate = useNavigate();
  
  const [campus, setCampus] = useState<Campus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado del formulario de responsable
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [createdResponsable, setCreatedResponsable] = useState<CampusResponsable | null>(null);
  
  // Estado para asignar responsable existente
  const [assignMode, setAssignMode] = useState<'create' | 'existing'>('existing');
  const [availableResponsables, setAvailableResponsables] = useState<AvailableResponsable[]>([]);
  const [loadingResponsables, setLoadingResponsables] = useState(false);
  const [selectedResponsableId, setSelectedResponsableId] = useState<string | null>(null);
  const [assignPerms, setAssignPerms] = useState({ can_bulk_create_candidates: false, can_manage_groups: false });
  
  const [formData, setFormData] = useState<CreateResponsableData>({
    name: '',
    first_surname: '',
    second_surname: '',
    email: '',
    curp: '',
    gender: 'M',
    date_of_birth: '',
    can_bulk_create_candidates: false,
    can_manage_groups: false
  });

  // Estado para responsables adicionales
  const [additionalResps, setAdditionalResps] = useState<CampusResponsableItem[]>([]);
  const [showAddMore, setShowAddMore] = useState(false);
  const [addMoreLoading, setAddMoreLoading] = useState(false);
  const [addMoreError, setAddMoreError] = useState<string | null>(null);
  const [addMorePassword, setAddMorePassword] = useState<string | null>(null);
  const [showAddMorePwd, setShowAddMorePwd] = useState(false);
  const [addMoreForm, setAddMoreForm] = useState({
    name: '', first_surname: '', second_surname: '',
    email: '', curp: '', gender: '' as '' | 'M' | 'F' | 'O',
    date_of_birth: '',
    can_bulk_create_candidates: false, can_manage_groups: false,
  });

  // Estado del formulario de configuración
  const [configError, setConfigError] = useState<string | null>(null);
  const [isConfiguringCampus, setIsConfiguringCampus] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null); // Para navegación manual entre pasos
  const [configData, setConfigData] = useState<ConfigureCampusRequest>({
    office_version: 'office_365',
    enable_tier_basic: true,
    enable_tier_standard: true,
    enable_tier_advanced: false,
    enable_digital_badge: false,
    enable_partial_evaluations: false,
    enable_unscheduled_partials: false,
    enable_virtual_machines: false,
    enable_online_payments: false,
    license_start_date: new Date().toISOString().split('T')[0],
    license_end_date: null,
    certification_cost: 0,
    retake_cost: 0,
    competency_standard_ids: [],
  });
  
  // Estado para campos de costo (strings para mejor UX)
  const [certificationCostInput, setCertificationCostInput] = useState('0');
  const [retakeCostInput, setRetakeCostInput] = useState('0');
  
  // Estado para ECM (Estándares de Competencia)
  const [availableEcm, setAvailableEcm] = useState<AvailableCompetencyStandard[]>([]);
  const [loadingEcm, setLoadingEcm] = useState(false);
  const [selectedEcmIds, setSelectedEcmIds] = useState<number[]>([]);

  useEffect(() => {
    loadCampus();
  }, [campusId]);

  // Cargar responsables disponibles al inicio
  useEffect(() => {
    if (campusId) {
      loadAvailableResponsables();
    }
  }, [campusId]);

  // Cargar ECM disponibles cuando el campus tiene responsable y entramos al paso 2
  useEffect(() => {
    if (campus?.responsable_id) {
      loadAvailableEcm();
      loadCampusEcm();
    }
  }, [campus?.responsable_id, campusId]);

  const loadAvailableEcm = async () => {
    try {
      setLoadingEcm(true);
      const result = await getAvailableCompetencyStandards();
      setAvailableEcm(result.competency_standards);
    } catch (err: any) {
      console.error('Error loading available ECM:', err);
    } finally {
      setLoadingEcm(false);
    }
  };

  const loadCampusEcm = async () => {
    try {
      const result = await getCampusCompetencyStandards(Number(campusId));
      const ids = result.competency_standards.map(s => s.competency_standard_id);
      setSelectedEcmIds(ids);
      setConfigData(prev => ({ ...prev, competency_standard_ids: ids }));
    } catch (err: any) {
      console.error('Error loading campus ECM:', err);
    }
  };

  const loadCampus = async () => {
    try {
      setLoading(true);
      const data = await getCampus(Number(campusId));
      setCampus(data);
      
      // Si el plantel ya está activo, redirigir a la página de detalle
      if (data.is_active) {
        navigate(`/partners/campuses/${campusId}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el plantel');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableResponsables = async () => {
    try {
      setLoadingResponsables(true);
      const result = await getAvailableResponsables(Number(campusId));
      setAvailableResponsables(result.available_responsables);
      
      // Pre-seleccionar al director si existe y no hay ninguno seleccionado
      if (!selectedResponsableId && result.available_responsables.length > 0) {
        const director = result.available_responsables.find(r => r.is_director);
        if (director) {
          setSelectedResponsableId(director.id);
        }
      }
    } catch (err: any) {
      console.error('Error loading available responsables:', err);
      setFormError('Error al cargar los responsables disponibles');
    } finally {
      setLoadingResponsables(false);
    }
  };

  const handleAssignExistingResponsable = async () => {
    if (!selectedResponsableId) {
      setFormError('Debe seleccionar un responsable');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      
      const result = await assignExistingResponsable(Number(campusId), {
        responsable_id: selectedResponsableId,
        can_bulk_create_candidates: assignPerms.can_bulk_create_candidates,
        can_manage_groups: assignPerms.can_manage_groups,
      });

      // Actualizar el estado del campus
      setCampus(prev => prev ? {
        ...prev,
        responsable_id: result.responsable.id,
        responsable: result.responsable,
        activation_status: 'configuring'
      } : null);
      
      // Mostrar éxito (sin contraseña temporal porque es usuario existente)
      setCreatedResponsable({ ...result.responsable, temporary_password: undefined });
      
    } catch (err: any) {
      console.error('Error assigning responsable:', err);
      setFormError(err.response?.data?.error || 'Error al asignar el responsable');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      // Para CURP, convertir a mayúsculas
      const processedValue = name === 'curp' ? value.toUpperCase() : value;
      setFormData(prev => ({ ...prev, [name]: processedValue }));
    }
    
    // Limpiar error al escribir
    if (formError) setFormError(null);
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'El nombre es requerido';
    if (!formData.first_surname.trim()) return 'El apellido paterno es requerido';
    if (!formData.second_surname.trim()) return 'El apellido materno es requerido';
    if (!formData.email.trim()) return 'El correo electrónico es requerido';
    if (!formData.curp.trim()) return 'El CURP es requerido';
    if (!formData.date_of_birth) return 'La fecha de nacimiento es requerida';
    
    // Validar formato de email
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(formData.email)) {
      return 'Formato de correo electrónico inválido';
    }
    
    // Validar formato de CURP
    const curpPattern = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$/;
    if (!curpPattern.test(formData.curp)) {
      return 'Formato de CURP inválido (18 caracteres)';
    }
    
    return null;
  };

  const handleSubmitResponsable = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    
    try {
      setIsSubmitting(true);
      setFormError(null);
      
      // Si el campus ya tiene un responsable, pasar replace_existing: true
      const dataToSend = {
        ...formData,
        replace_existing: campus?.responsable_id ? true : false
      };
      
      const result = await createCampusResponsable(Number(campusId), dataToSend);
      
      setCreatedResponsable(result.responsable);
      setCampus(prev => prev ? {
        ...prev,
        responsable_id: result.responsable.id,
        responsable: result.responsable,
        activation_status: 'configuring'
      } : null);
      
    } catch (err: any) {
      console.error('Error creating responsable:', err);
      setFormError(err.response?.data?.error || 'Error al crear el responsable');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleResponsableCreated = (responsable: CampusResponsable) => {
    setCampus(prev => prev ? {
      ...prev,
      responsable_id: responsable.id,
      responsable: responsable,
      activation_status: 'configuring'
    } : null);
  };

  // Función para volver a editar el responsable
  const handleEditResponsable = () => {
    // Resetear el responsable creado para mostrar el formulario nuevamente
    setCreatedResponsable(null);
    // Si hay un responsable existente en el campus, pre-llenar el formulario
    if (campus?.responsable) {
      setFormData({
        name: campus.responsable.full_name?.split(' ')[0] || '',
        first_surname: campus.responsable.full_name?.split(' ')[1] || '',
        second_surname: campus.responsable.full_name?.split(' ').slice(2).join(' ') || '',
        email: campus.responsable.email || '',
        curp: '',
        gender: 'M',
        date_of_birth: '',
        can_bulk_create_candidates: campus.responsable.can_bulk_create_candidates || false,
        can_manage_groups: campus.responsable.can_manage_groups || false
      });
    }
    // Navegar al paso 1
    setActiveStep(1);
  };

  // Manejar cambios en la configuración
  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setConfigData(prev => ({ ...prev, [name]: checked }));
    } else {
      setConfigData(prev => ({ ...prev, [name]: value }));
    }
    
    if (configError) setConfigError(null);
  };

  // Manejar cambios en campos de costo con mejor UX
  const handleCostChange = (field: 'certification_cost' | 'retake_cost', value: string) => {
    // Permitir vacío, números y decimales
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      if (field === 'certification_cost') {
        setCertificationCostInput(value);
        setConfigData(prev => ({ ...prev, certification_cost: value === '' ? 0 : parseFloat(value) }));
      } else {
        setRetakeCostInput(value);
        setConfigData(prev => ({ ...prev, retake_cost: value === '' ? 0 : parseFloat(value) }));
      }
    }
    if (configError) setConfigError(null);
  };

  // Manejar blur en campos de costo para formatear
  const handleCostBlur = (field: 'certification_cost' | 'retake_cost') => {
    if (field === 'certification_cost') {
      const value = certificationCostInput === '' ? 0 : parseFloat(certificationCostInput);
      setCertificationCostInput(value.toString());
      setConfigData(prev => ({ ...prev, certification_cost: value }));
    } else {
      const value = retakeCostInput === '' ? 0 : parseFloat(retakeCostInput);
      setRetakeCostInput(value.toString());
      setConfigData(prev => ({ ...prev, retake_cost: value }));
    }
  };

  // Navegar a un paso específico (solo si está completado o es el actual)
  const goToStep = (stepId: number) => {
    const steps = getSteps();
    const targetStep = steps.find(s => s.id === stepId);
    if (targetStep && (targetStep.status === 'completed' || targetStep.status === 'current')) {
      setActiveStep(stepId);
    }
  };

  // Validar configuración
  const validateConfig = (): string | null => {
    // Debe seleccionar al menos un tier
    if (!configData.enable_tier_basic && !configData.enable_tier_standard && 
        !configData.enable_tier_advanced && !configData.enable_digital_badge) {
      return 'Debe seleccionar al menos un nivel de certificación';
    }
    
    // Debe seleccionar al menos un ECM
    if (!selectedEcmIds || selectedEcmIds.length === 0) {
      return 'Debe seleccionar al menos un Estándar de Competencia (ECM)';
    }
    
    // Fecha de inicio es requerida
    if (!configData.license_start_date) {
      return 'La fecha de inicio de vigencia es requerida';
    }
    
    // Fecha fin debe ser mayor a fecha inicio si está definida
    if (configData.license_end_date && configData.license_start_date) {
      if (new Date(configData.license_end_date) <= new Date(configData.license_start_date)) {
        return 'La fecha de fin debe ser posterior a la fecha de inicio';
      }
    }
    
    return null;
  };

  // Toggle ECM seleccionado
  const toggleEcmSelection = (ecmId: number) => {
    setSelectedEcmIds(prev => {
      const newIds = prev.includes(ecmId) 
        ? prev.filter(id => id !== ecmId)
        : [...prev, ecmId];
      setConfigData(prevConfig => ({ ...prevConfig, competency_standard_ids: newIds }));
      return newIds;
    });
  };

  // Enviar configuración
  const handleSubmitConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateConfig();
    if (validationError) {
      setConfigError(validationError);
      return;
    }
    
    try {
      setIsConfiguringCampus(true);
      setConfigError(null);
      
      const result = await configureCampus(Number(campusId), {
        ...configData,
        complete_configuration: true
      });
      
      setCampus(result.campus);
      
    } catch (err: any) {
      console.error('Error configuring campus:', err);
      setConfigError(err.response?.data?.error || 'Error al configurar el plantel');
    } finally {
      setIsConfiguringCampus(false);
    }
  };

  // Determinar el paso actual basado en el estado del plantel
  const getSteps = (): ActivationStep[] => {
    const hasResponsable = !!campus?.responsable_id;
    const hasConfiguration = campus?.configuration_completed === true;
    const isActive = campus?.is_active;
    
    return [
      {
        id: 1,
        title: 'Crear Responsable del Plantel',
        description: 'Asigna un usuario responsable que administrará el plantel',
        icon: <UserCog className="w-6 h-6" />,
        status: hasResponsable ? 'completed' : 'current'
      },
      {
        id: 2,
        title: 'Configurar Plantel',
        description: 'Define versión de Office, certificaciones, vigencia y costos',
        icon: <Settings className="w-6 h-6" />,
        status: hasResponsable ? (hasConfiguration ? 'completed' : 'current') : 'pending'
      },
      {
        id: 3,
        title: 'Activar Plantel',
        description: 'Finaliza el proceso y activa el plantel',
        icon: <Zap className="w-6 h-6" />,
        status: hasConfiguration ? (isActive ? 'completed' : 'current') : 'pending'
      }
    ];
  };

  if (loading) {
    return (
      <div className="fluid-p-6 fluid-p-8 w-full">
        <LoadingSpinner message="Cargando plantel..." />
      </div>
    );
  }

  if (error || !campus) {
    return (
      <div className="fluid-p-6 fluid-p-8 w-full">
        <div className="bg-red-50 border border-red-200 fluid-rounded-xl fluid-p-6 flex items-center fluid-gap-4">
          <AlertCircle className="fluid-w-8 fluid-h-8 text-red-600" />
          <div>
            <p className="text-red-700 font-medium fluid-text-base">{error || 'Plantel no encontrado'}</p>
            <Link to="/partners" className="text-red-600 underline fluid-text-sm mt-1 inline-block">
              Volver a la lista
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const steps = getSteps();
  const naturalStep = steps.find(s => s.status === 'current')?.id || 1;
  const currentStep = activeStep !== null ? activeStep : naturalStep;

  return (
    <div className="fluid-p-4 fluid-p-6 fluid-p-8 w-full animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb 
        items={[
          { label: campus.partner?.name || 'Partner', path: `/partners/${campus.partner_id}` },
          { label: campus.name, path: `/partners/campuses/${campusId}` },
          { label: 'Activación' }
        ]} 
      />
      
      {/* Header */}
      <div className="flex items-center fluid-gap-4 fluid-mb-6 fluid-mb-8">
        <Link
          to={`/partners/campuses/${campusId}`}
          className="fluid-p-2 hover:bg-gray-100 fluid-rounded-xl transition-colors"
        >
          <ArrowLeft className="fluid-w-6 fluid-h-6 text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center fluid-gap-2 fluid-text-sm text-gray-500 fluid-mb-1">
            <Building2 className="fluid-w-4 fluid-h-4" />
            <span>{campus.partner?.name}</span>
            <ChevronRight className="fluid-w-4 fluid-h-4" />
            <span>{campus.name}</span>
          </div>
          <h1 className="fluid-text-xl fluid-text-2xl font-bold text-gray-800">
            Activación del Plantel
          </h1>
        </div>
        <span className="inline-flex items-center fluid-gap-1 fluid-text-sm font-medium text-blue-700 bg-blue-50 fluid-px-3 fluid-py-1 fluid-rounded-full border border-blue-200 font-mono">
          {campus.code}
        </span>
      </div>

      <div className="grid lg:grid-cols-4 fluid-gap-6">
        {/* Panel de Progreso */}
        <div className="lg:col-span-1">
          <div className="bg-white fluid-rounded-2xl shadow-sm border border-gray-200 fluid-p-4 fluid-p-6 sticky top-6">
            <h2 className="font-semibold text-gray-800 fluid-mb-6 fluid-text-base">Progreso de Activación</h2>
            
            <div className="fluid-space-y-4">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => goToStep(step.id)}
                  disabled={step.status === 'pending'}
                  className={`flex fluid-gap-3 w-full text-left transition-all ${
                    step.status !== 'pending' ? 'cursor-pointer hover:bg-gray-50 fluid-rounded-xl fluid-p-2 -fluid-mx-2' : 'cursor-not-allowed'
                  } ${currentStep === step.id ? 'bg-blue-50 fluid-rounded-xl fluid-p-2 -fluid-mx-2' : ''}`}
                >
                  {/* Línea de conexión */}
                  <div className="flex flex-col items-center">
                    <div className={`fluid-w-10 fluid-h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      step.status === 'completed' 
                        ? 'bg-green-100 text-green-600' 
                        : step.status === 'current' || currentStep === step.id
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {step.status === 'completed' && currentStep !== step.id ? (
                        <Check className="fluid-w-5 fluid-h-5" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`w-0.5 flex-1 mt-2 ${
                        step.status === 'completed' ? 'bg-green-200' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                  
                  <div className="fluid-pb-6">
                    <h3 className={`font-medium fluid-text-sm ${
                      currentStep === step.id
                        ? 'text-blue-700' 
                        : step.status === 'completed' 
                        ? 'text-green-700' 
                        : 'text-gray-500'
                    }`}>
                      {step.title}
                      {step.status === 'completed' && currentStep !== step.id && (
                        <span className="fluid-ml-2 fluid-text-xs text-green-600">(editar)</span>
                      )}
                    </h3>
                    <p className="fluid-text-xs text-gray-500 fluid-mt-1">{step.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="lg:col-span-3 fluid-space-y-6">
          {/* Paso 1: Crear/Asignar Responsable */}
          {currentStep === 1 && !createdResponsable && (
            <div className="bg-white fluid-rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 fluid-px-6 fluid-py-4 text-white">
                <div className="flex items-center fluid-gap-3">
                  <div className="fluid-w-10 fluid-h-10 bg-white/20 fluid-rounded-xl flex items-center justify-center">
                    <UserCog className="fluid-w-5 fluid-h-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold fluid-text-base">Paso 1: Asignar Responsable del Plantel</h2>
                    <p className="text-blue-100 fluid-text-sm">Cree un nuevo responsable o asigne uno existente del mismo partner</p>
                  </div>
                </div>
              </div>

              {/* Pestañas para elegir modo */}
              <div className="border-b border-gray-200">
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => setAssignMode('existing')}
                    className={`flex-1 fluid-py-3 fluid-px-4 fluid-text-sm font-medium transition-all flex items-center justify-center fluid-gap-2 ${
                      assignMode === 'existing'
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <UserCheck className="fluid-w-4 fluid-h-4" />
                    Seleccionar Responsable Existente
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignMode('create')}
                    className={`flex-1 fluid-py-3 fluid-px-4 fluid-text-sm font-medium transition-all flex items-center justify-center fluid-gap-2 ${
                      assignMode === 'create'
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <UserPlus className="fluid-w-4 fluid-h-4" />
                    Crear Nuevo Responsable
                  </button>
                </div>
              </div>

              {/* Error message */}
              {formError && (
                <div className="fluid-mx-6 fluid-mt-4 bg-red-50 border border-red-200 fluid-rounded-xl fluid-p-4 flex items-center fluid-gap-3">
                  <AlertCircle className="fluid-w-5 fluid-h-5 text-red-600 flex-shrink-0" />
                  <p className="fluid-text-sm text-red-700">{formError}</p>
                </div>
              )}

              {/* Modo: Asignar Responsable Existente */}
              {assignMode === 'existing' && (
                <div className="fluid-p-6 fluid-space-y-6">
                  {loadingResponsables ? (
                    <div className="flex items-center justify-center fluid-py-12">
                      <div className="fluid-w-8 fluid-h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                      <span className="fluid-ml-3 text-gray-500">Cargando responsables disponibles...</span>
                    </div>
                  ) : availableResponsables.length === 0 ? (
                    <div className="text-center fluid-py-12">
                      <Users className="fluid-w-12 fluid-h-12 text-gray-300 mx-auto fluid-mb-4" />
                      <p className="text-gray-500 fluid-text-base font-medium">No hay responsables disponibles</p>
                      <p className="text-gray-400 fluid-text-sm fluid-mt-2">
                        No hay usuarios con rol "responsable" disponibles para este partner.
                        <br />
                        Cree uno nuevo usando la pestaña "Crear Nuevo Responsable".
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="fluid-text-sm font-semibold text-gray-700 fluid-mb-4 flex items-center fluid-gap-2">
                          <Users className="fluid-w-4 fluid-h-4" />
                          Seleccione un responsable ({availableResponsables.length} disponibles)
                        </h3>
                        
                        <div className="fluid-space-y-3 max-h-[400px] overflow-y-auto">
                          {availableResponsables.map((resp) => (
                            <label
                              key={resp.id}
                              className={`flex items-center fluid-gap-4 fluid-p-4 border fluid-rounded-xl cursor-pointer transition-all ${
                                selectedResponsableId === resp.id
                                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="selectedResponsable"
                                value={resp.id}
                                checked={selectedResponsableId === resp.id}
                                onChange={() => setSelectedResponsableId(resp.id)}
                                className="fluid-w-5 fluid-h-5 text-blue-600"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900">{resp.full_name}</p>
                                <p className="fluid-text-sm text-gray-500">{resp.email}</p>
                                {resp.curp && (
                                  <p className="fluid-text-xs text-gray-400 font-mono fluid-mt-1">{resp.curp}</p>
                                )}
                              </div>
                              <div className="flex flex-col fluid-gap-1 items-end">
                                {resp.is_director && (
                                  <span className="fluid-text-xs bg-purple-100 text-purple-700 fluid-px-2 fluid-py-1 fluid-rounded-full font-medium">
                                    Director del Plantel
                                  </span>
                                )}
                                {resp.is_current && (
                                  <span className="fluid-text-xs bg-green-100 text-green-700 fluid-px-2 fluid-py-1 fluid-rounded-full font-medium">
                                    Actual
                                  </span>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Permisos para responsable existente */}
                      <div>
                        <h3 className="fluid-text-sm font-semibold text-gray-700 fluid-mb-4 flex items-center fluid-gap-2">
                          <Shield className="fluid-w-4 fluid-h-4" />
                          Permisos del Responsable
                        </h3>
                        
                        <div className="fluid-space-y-3">
                          <label className="flex items-start fluid-gap-3 fluid-p-3 border border-gray-200 fluid-rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={assignPerms.can_bulk_create_candidates}
                              onChange={(e) => setAssignPerms(prev => ({ ...prev, can_bulk_create_candidates: e.target.checked }))}
                              className="fluid-w-5 fluid-h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                            />
                            <div>
                              <span className="font-medium text-gray-800">Altas masivas de candidatos</span>
                              <p className="fluid-text-sm text-gray-500">
                                Puede crear múltiples usuarios candidato a través de importación de archivos
                              </p>
                            </div>
                          </label>
                          
                          <label className="flex items-start fluid-gap-3 fluid-p-3 border border-gray-200 fluid-rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={assignPerms.can_manage_groups}
                              onChange={(e) => setAssignPerms(prev => ({ ...prev, can_manage_groups: e.target.checked }))}
                              className="fluid-w-5 fluid-h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                            />
                            <div>
                              <span className="font-medium text-gray-800">Gestión de grupos</span>
                              <p className="fluid-text-sm text-gray-500">
                                Puede crear grupos de alumnos y asignar exámenes o materiales de estudio
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Botón de asignar */}
                      <div className="fluid-pt-4 border-t">
                        <button
                          type="button"
                          onClick={handleAssignExistingResponsable}
                          disabled={isSubmitting || !selectedResponsableId}
                          className="w-full fluid-py-3 bg-blue-600 hover:bg-blue-700 text-white fluid-rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center fluid-gap-2"
                        >
                          {isSubmitting ? (
                            <>
                              <div className="fluid-w-5 fluid-h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Asignando responsable...
                            </>
                          ) : (
                            <>
                              <UserCheck className="fluid-w-5 fluid-h-5" />
                              Asignar Responsable Seleccionado
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Modo: Crear Nuevo Responsable */}
              {assignMode === 'create' && (
              <form onSubmit={handleSubmitResponsable} className="fluid-p-6 fluid-space-y-6">
                {/* Datos personales */}
                <div>
                  <h3 className="fluid-text-sm font-semibold text-gray-700 fluid-mb-4 flex items-center fluid-gap-2">
                    <User className="fluid-w-4 fluid-h-4" />
                    Datos Personales
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 fluid-gap-4">
                    <div>
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                        Nombre(s) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full fluid-px-3 fluid-py-2 border border-gray-300 fluid-rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ej: Juan Carlos"
                      />
                    </div>
                    
                    <div>
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                        Apellido Paterno <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="first_surname"
                        value={formData.first_surname}
                        onChange={handleChange}
                        className="w-full fluid-px-3 fluid-py-2 border border-gray-300 fluid-rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ej: García"
                      />
                    </div>
                    
                    <div>
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                        Apellido Materno <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="second_surname"
                        value={formData.second_surname}
                        onChange={handleChange}
                        className="w-full fluid-px-3 fluid-py-2 border border-gray-300 fluid-rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ej: López"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                        <User className="w-4 h-4 text-purple-500" />
                        Género <span className="text-red-500">*</span>
                      </label>
                      <StyledSelect
                        name="gender"
                        value={formData.gender}
                        onChange={(value) => setFormData(prev => ({ ...prev, gender: value as 'M' | 'F' | 'O' }))}
                        options={[
                          { value: 'M', label: 'Masculino' },
                          { value: 'F', label: 'Femenino' },
                          { value: 'O', label: 'Otro' },
                        ]}
                        icon={User}
                        colorScheme="purple"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        Fecha de Nacimiento <span className="text-red-500">*</span>
                      </label>
                      <DatePickerInput
                        value={formData.date_of_birth ? new Date(formData.date_of_birth + 'T00:00:00') : null}
                        onChange={(date) => setFormData(prev => ({ ...prev, date_of_birth: date ? date.toISOString().split('T')[0] : '' }))}
                        placeholder="Seleccionar fecha de nacimiento"
                        maxDate={new Date()}
                        colorScheme="blue"
                      />
                      {formData.date_of_birth && (
                        <p className="text-xs text-blue-600 mt-1 font-medium">
                          {new Date(formData.date_of_birth + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                        CURP <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="curp"
                        value={formData.curp}
                        onChange={handleChange}
                        maxLength={18}
                        className="w-full fluid-px-3 fluid-py-2 border border-gray-300 fluid-rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-mono"
                        placeholder="GARL850101HDFRRL09"
                      />
                      <p className="fluid-text-xs text-gray-500 fluid-mt-1">{formData.curp.length}/18 caracteres</p>
                    </div>
                  </div>
                </div>

                {/* Datos de contacto */}
                <div>
                  <h3 className="fluid-text-sm font-semibold text-gray-700 fluid-mb-4 flex items-center fluid-gap-2">
                    <Mail className="fluid-w-4 fluid-h-4" />
                    Contacto
                  </h3>
                  
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                      Correo Electrónico <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full fluid-px-3 fluid-py-2 border border-gray-300 fluid-rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="responsable@ejemplo.com"
                    />
                  </div>
                </div>

                {/* Permisos */}
                <div>
                  <h3 className="fluid-text-sm font-semibold text-gray-700 fluid-mb-4 flex items-center fluid-gap-2">
                    <Shield className="fluid-w-4 fluid-h-4" />
                    Permisos del Responsable
                  </h3>
                  
                  <div className="fluid-space-y-3">
                    <label className="flex items-start fluid-gap-3 fluid-p-3 border border-gray-200 fluid-rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        name="can_bulk_create_candidates"
                        checked={formData.can_bulk_create_candidates}
                        onChange={handleChange}
                        className="fluid-w-5 fluid-h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                      />
                      <div>
                        <span className="font-medium text-gray-800">Altas masivas de candidatos</span>
                        <p className="fluid-text-sm text-gray-500">
                          Puede crear múltiples usuarios candidato a través de importación de archivos
                        </p>
                      </div>
                    </label>
                    
                    <label className="flex items-start fluid-gap-3 fluid-p-3 border border-gray-200 fluid-rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        name="can_manage_groups"
                        checked={formData.can_manage_groups}
                        onChange={handleChange}
                        className="fluid-w-5 fluid-h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                      />
                      <div>
                        <span className="font-medium text-gray-800">Gestión de grupos</span>
                        <p className="fluid-text-sm text-gray-500">
                          Puede crear grupos de alumnos y asignar exámenes o materiales de estudio
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Botón de enviar */}
                <div className="fluid-pt-4 border-t">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full fluid-py-3 bg-blue-600 hover:bg-blue-700 text-white fluid-rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center fluid-gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="fluid-w-5 fluid-h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creando responsable...
                      </>
                    ) : (
                      <>
                        <UserCog className="fluid-w-5 fluid-h-5" />
                        Crear Responsable
                      </>
                    )}
                  </button>
                </div>
              </form>
              )}
            </div>
          )}

          {/* Responsable recién creado - Mostrar credenciales */}
          {currentStep === 1 && createdResponsable && (
            <div className="bg-white fluid-rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Header de éxito */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 fluid-px-6 fluid-py-4 text-white">
                <div className="flex items-center fluid-gap-3">
                  <div className="fluid-w-10 fluid-h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="fluid-w-5 fluid-h-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold fluid-text-base">
                      {createdResponsable.temporary_password ? '¡Responsable Creado Exitosamente!' : '¡Responsable Asignado Exitosamente!'}
                    </h2>
                    <p className="text-green-100 text-sm">
                      {createdResponsable.temporary_password ? 'Guarda las credenciales de acceso' : 'El responsable ya tiene credenciales existentes'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Info del responsable */}
                <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
                    <UserCog className="w-7 h-7 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-lg">{createdResponsable.full_name}</p>
                    <p className="text-gray-500">{createdResponsable.email}</p>
                  </div>
                </div>

                {/* Credenciales - Solo si hay contraseña temporal */}
                {createdResponsable.temporary_password && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">Credenciales de acceso</p>
                      <p className="text-sm text-amber-700 mt-1">
                        Guarda esta información, la contraseña solo se muestra una vez
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 bg-white/50 rounded-lg p-4">
                    {/* Usuario */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-medium">ID de Usuario</p>
                        <p className="font-mono text-lg font-bold text-gray-800">
                          {createdResponsable.username}
                        </p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(createdResponsable.username || '', 'username')}
                        className="p-2 hover:bg-white rounded-lg transition-colors"
                        title="Copiar"
                      >
                        {copiedField === 'username' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <Copy className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </div>

                    {/* Contraseña */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-medium">Contraseña Temporal</p>
                        <p className="font-mono text-lg font-bold text-gray-800">
                          {showPassword ? createdResponsable.temporary_password : '••••••••'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-2 hover:bg-white rounded-lg transition-colors"
                          title={showPassword ? 'Ocultar' : 'Mostrar'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-5 h-5 text-gray-400" />
                          ) : (
                            <Eye className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(createdResponsable.temporary_password || '', 'password')}
                          className="p-2 hover:bg-white rounded-lg transition-colors"
                          title="Copiar"
                        >
                          {copiedField === 'password' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <Copy className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* Mensaje para responsable existente */}
                {!createdResponsable.temporary_password && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <UserCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">Responsable existente asignado</p>
                      <p className="text-sm text-blue-700 mt-1">
                        Este responsable ya tiene credenciales de acceso. Si necesita recuperar su contraseña, contacte al administrador.
                      </p>
                      <p className="text-sm text-blue-600 mt-2 font-mono">
                        Usuario: {createdResponsable.username}
                      </p>
                    </div>
                  </div>
                </div>
                )}

                {/* Agregar más responsables */}
                <div className="border-t border-gray-200 pt-4 mt-2">
                  {additionalResps.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Responsables adicionales creados</p>
                      <div className="space-y-2">
                        {additionalResps.map(r => (
                          <div key={r.id} className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                            <div className="w-8 h-8 bg-indigo-400 rounded-full flex items-center justify-center"><UserCog className="w-4 h-4 text-white" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{r.full_name}</p>
                              <p className="text-xs text-gray-500 truncate">{r.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!showAddMore ? (
                    <button
                      type="button"
                      onClick={() => { setShowAddMore(true); setAddMoreError(null); setAddMorePassword(null); }}
                      className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      Agregar otro responsable al plantel
                    </button>
                  ) : addMorePassword ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <p className="text-sm font-bold text-green-800">Responsable adicional creado</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-green-200 font-mono text-sm space-y-1">
                        <div className="flex justify-between"><span className="text-gray-500">Usuario:</span><span className="font-bold">{additionalResps[additionalResps.length - 1]?.username}</span></div>
                        <div className="flex items-center justify-between"><span className="text-gray-500">Contraseña:</span><div className="flex items-center gap-1"><span className="font-bold">{showAddMorePwd ? addMorePassword : '••••••••'}</span><button type="button" onClick={() => setShowAddMorePwd(!showAddMorePwd)} className="p-0.5 hover:bg-gray-100 rounded">{showAddMorePwd ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button><button type="button" onClick={() => navigator.clipboard.writeText(addMorePassword || '')} className="p-0.5 hover:bg-gray-100 rounded"><Copy className="w-3 h-3" /></button></div></div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button type="button" onClick={() => { setAddMorePassword(null); setShowAddMore(false); setShowAddMorePwd(false); }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">Entendido</button>
                        <button type="button" onClick={() => { setAddMorePassword(null); setAddMoreForm({ name: '', first_surname: '', second_surname: '', email: '', curp: '', gender: '', date_of_birth: '', can_bulk_create_candidates: false, can_manage_groups: false }); }} className="px-3 py-1.5 border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors">Agregar otro</button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2"><UserPlus className="w-4 h-4 text-indigo-600" />Nuevo Responsable Adicional</h4>
                        <button type="button" onClick={() => setShowAddMore(false)} className="p-1 hover:bg-gray-200 rounded"><span className="sr-only">Cerrar</span>✕</button>
                      </div>
                      {addMoreError && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{addMoreError}</div>}
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <input type="text" placeholder="Nombre(s)*" value={addMoreForm.name} onChange={e => setAddMoreForm(p => ({...p, name: e.target.value}))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                        <input type="text" placeholder="Ap. Paterno*" value={addMoreForm.first_surname} onChange={e => setAddMoreForm(p => ({...p, first_surname: e.target.value}))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                        <input type="text" placeholder="Ap. Materno*" value={addMoreForm.second_surname} onChange={e => setAddMoreForm(p => ({...p, second_surname: e.target.value}))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <input type="email" placeholder="Correo*" value={addMoreForm.email} onChange={e => setAddMoreForm(p => ({...p, email: e.target.value}))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                        <input type="text" maxLength={18} placeholder="CURP*" value={addMoreForm.curp} onChange={e => setAddMoreForm(p => ({...p, curp: e.target.value.toUpperCase()}))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <select value={addMoreForm.gender} onChange={e => setAddMoreForm(p => ({...p, gender: e.target.value as any}))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                          <option value="">Género*</option><option value="M">Masculino</option><option value="F">Femenino</option><option value="O">Otro</option>
                        </select>
                        <input type="date" value={addMoreForm.date_of_birth} onChange={e => setAddMoreForm(p => ({...p, date_of_birth: e.target.value}))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div className="flex gap-4 mb-3 p-2 bg-indigo-50 rounded-lg">
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={addMoreForm.can_manage_groups} onChange={e => setAddMoreForm(p => ({...p, can_manage_groups: e.target.checked}))} className="w-4 h-4 text-indigo-600 rounded" /><span className="text-xs text-gray-700">Gestionar Grupos</span></label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={addMoreForm.can_bulk_create_candidates} onChange={e => setAddMoreForm(p => ({...p, can_bulk_create_candidates: e.target.checked}))} className="w-4 h-4 text-indigo-600 rounded" /><span className="text-xs text-gray-700">Altas Masivas</span></label>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setShowAddMore(false)} className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-100">Cancelar</button>
                        <button type="button" disabled={addMoreLoading} onClick={async () => {
                          if (!addMoreForm.name || !addMoreForm.first_surname || !addMoreForm.second_surname || !addMoreForm.email || !addMoreForm.curp || !addMoreForm.gender || !addMoreForm.date_of_birth) { setAddMoreError('Todos los campos son requeridos'); return; }
                          setAddMoreLoading(true); setAddMoreError(null);
                          try {
                            const res = await addCampusResponsable(Number(campusId), { name: addMoreForm.name, first_surname: addMoreForm.first_surname, second_surname: addMoreForm.second_surname, email: addMoreForm.email, curp: addMoreForm.curp, gender: addMoreForm.gender as 'M'|'F'|'O', date_of_birth: addMoreForm.date_of_birth, can_bulk_create_candidates: addMoreForm.can_bulk_create_candidates, can_manage_groups: addMoreForm.can_manage_groups });
                            setAdditionalResps(prev => [...prev, res.responsable]);
                            setAddMorePassword(res.responsable.temporary_password || null);
                          } catch (err: any) { setAddMoreError(err?.response?.data?.error || 'Error al crear'); }
                          finally { setAddMoreLoading(false); }
                        }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                          {addMoreLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
                          {addMoreLoading ? 'Creando...' : 'Crear'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Botón para continuar */}
                <button
                  onClick={() => {
                    handleResponsableCreated(createdResponsable);
                  }}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <ChevronRight className="w-5 h-5" />
                  Continuar al siguiente paso
                </button>
              </div>
            </div>
          )}

          {/* Paso 2: Configurar Plantel */}
          {currentStep === 2 && campus.responsable && !campus.configuration_completed && (
            <>
              {/* Resumen del Responsable */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    Responsable Asignado
                  </h2>
                  <button
                    type="button"
                    onClick={handleEditResponsable}
                    className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <UserCog className="w-4 h-4" />
                    Cambiar responsable
                  </button>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
                    <UserCog className="w-7 h-7 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-lg">{campus.responsable.full_name}</p>
                    <p className="text-gray-500">{campus.responsable.email}</p>
                    <p className="text-xs text-gray-400 font-mono mt-1">ID: {campus.responsable.username}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {campus.responsable.can_bulk_create_candidates && (
                      <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
                        Altas masivas
                      </span>
                    )}
                    {campus.responsable.can_manage_groups && (
                      <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-full">
                        Gestión de grupos
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Formulario de Configuración */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Settings className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold">Paso 2: Configuración del Plantel</h2>
                      <p className="text-indigo-100 text-sm">Define las opciones disponibles para este plantel</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmitConfig} className="p-6 space-y-8">
                  {/* Error message */}
                  {configError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      <p className="text-sm text-red-700">{configError}</p>
                    </div>
                  )}

                  {/* Versión de Office */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      Versión de Microsoft Office
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { value: 'office_2016', label: 'Office 2016', desc: 'Versión clásica' },
                        { value: 'office_2019', label: 'Office 2019', desc: 'Licencia perpetua' },
                        { value: 'office_365', label: 'Microsoft 365', desc: 'Última versión (Recomendado)' },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all ${
                            configData.office_version === option.value
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="office_version"
                            value={option.value}
                            checked={configData.office_version === option.value}
                            onChange={handleConfigChange}
                            className="sr-only"
                          />
                          <span className={`font-medium ${
                            configData.office_version === option.value ? 'text-indigo-700' : 'text-gray-800'
                          }`}>
                            {option.label}
                          </span>
                          <span className="text-xs text-gray-500 mt-1">{option.desc}</span>
                          {configData.office_version === option.value && (
                            <div className="absolute top-2 right-2">
                              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Niveles de Certificación */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      Niveles de Certificación / Constancias
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">Selecciona los tipos de certificación que estarán disponibles para este plantel</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Tier Básico - Siempre habilitado */}
                      <div className="flex items-start gap-3 p-4 border-2 rounded-xl border-blue-500 bg-blue-50">
                        <input
                          type="checkbox"
                          name="enable_tier_basic"
                          checked={true}
                          disabled
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5 cursor-not-allowed"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="font-medium text-gray-800">Tier Básico</span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Incluido</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Constancia de participación (Eduit)
                          </p>
                        </div>
                      </div>

                      {/* Tier Estándar */}
                      <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        configData.enable_tier_standard ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="checkbox"
                          name="enable_tier_standard"
                          checked={configData.enable_tier_standard}
                          onChange={handleConfigChange}
                          className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-gray-800">Tier Estándar</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Certificado Eduit oficial
                          </p>
                        </div>
                      </label>

                      {/* Tier Avanzado (CONOCER) */}
                      <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        configData.enable_tier_advanced ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="checkbox"
                          name="enable_tier_advanced"
                          checked={configData.enable_tier_advanced}
                          onChange={handleConfigChange}
                          className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <BadgeCheck className="w-4 h-4 text-purple-600" />
                            <span className="font-medium text-gray-800">Tier Avanzado (CONOCER)</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Certificado avalado por CONOCER
                          </p>
                        </div>
                      </label>

                      {/* Insignia Digital */}
                      <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        configData.enable_digital_badge ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="checkbox"
                          name="enable_digital_badge"
                          checked={configData.enable_digital_badge}
                          onChange={handleConfigChange}
                          className="w-5 h-5 text-amber-600 border-gray-300 rounded focus:ring-amber-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-600" />
                            <span className="font-medium text-gray-800">Insignia Digital</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Reconocimiento digital verificable
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Estándares de Competencia (ECM) */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      Estándares de Competencia (ECM)
                      <span className="text-red-500">*</span>
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      Selecciona los estándares de competencia que podrán certificarse en este plantel. 
                      Esto determinará qué exámenes estarán disponibles.
                    </p>
                    
                    {loadingEcm ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        <span className="ml-2 text-gray-500 text-sm">Cargando ECM disponibles...</span>
                      </div>
                    ) : availableEcm.length === 0 ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <p className="text-yellow-700 text-sm">
                          No hay estándares de competencia disponibles. Contacte al administrador para crear ECM.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                        {availableEcm.map((ecm) => (
                          <label
                            key={ecm.id}
                            className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                              selectedEcmIds.includes(ecm.id) 
                                ? 'border-indigo-500 bg-indigo-50' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedEcmIds.includes(ecm.id)}
                              onChange={() => toggleEcmSelection(ecm.id)}
                              className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                  {ecm.code}
                                </span>
                                {ecm.brand && (
                                  <span className="text-xs text-gray-500">{ecm.brand}</span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-gray-800 mt-1 truncate">
                                {ecm.name}
                              </p>
                              {ecm.sector && (
                                <p className="text-xs text-gray-500 truncate">{ecm.sector}</p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                    
                    {selectedEcmIds.length > 0 && (
                      <p className="text-xs text-indigo-600 mt-3 font-medium">
                        {selectedEcmIds.length} ECM seleccionado{selectedEcmIds.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Evaluaciones Parciales */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Evaluaciones Parciales de Office
                    </h3>
                    <div className="space-y-3">
                      <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        configData.enable_partial_evaluations ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="checkbox"
                          name="enable_partial_evaluations"
                          checked={configData.enable_partial_evaluations}
                          onChange={handleConfigChange}
                          className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-gray-800">Habilitar Evaluaciones Parciales</span>
                          <p className="text-xs text-gray-500 mt-1">
                            El profesor programa fecha, grupo y unidad para evaluar
                          </p>
                        </div>
                      </label>

                      {configData.enable_partial_evaluations && (
                        <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ml-6 ${
                          configData.enable_unscheduled_partials ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 hover:border-gray-300'
                        }`}>
                          <input
                            type="checkbox"
                            name="enable_unscheduled_partials"
                            checked={configData.enable_unscheduled_partials}
                            onChange={handleConfigChange}
                            className="w-5 h-5 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500 mt-0.5"
                          />
                          <div className="flex-1">
                            <span className="font-medium text-gray-800">Permitir Parciales sin Agendar</span>
                            <p className="text-xs text-gray-500 mt-1">
                              El alumno puede seleccionar la unidad a evaluar sin programación previa
                            </p>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Características Adicionales */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Características Adicionales
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Calendario de Sesiones */}
                      <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        configData.enable_virtual_machines ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="checkbox"
                          name="enable_virtual_machines"
                          checked={configData.enable_virtual_machines}
                          onChange={handleConfigChange}
                          className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4 text-emerald-600" />
                            <span className="font-medium text-gray-800">Calendario de Sesiones</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Permite a los candidatos agendar sesiones de práctica
                          </p>
                        </div>
                      </label>

                      {/* Pagos en Línea */}
                      <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        configData.enable_online_payments ? 'border-rose-500 bg-rose-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="checkbox"
                          name="enable_online_payments"
                          checked={configData.enable_online_payments}
                          onChange={handleConfigChange}
                          className="w-5 h-5 text-rose-600 border-gray-300 rounded focus:ring-rose-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-rose-600" />
                            <span className="font-medium text-gray-800">Pagos en Línea</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Permite pagos de certificación en línea
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Vigencia del Plantel */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Vigencia del Plantel
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-green-500" />
                          Fecha de Inicio <span className="text-red-500">*</span>
                        </label>
                        <DatePickerInput
                          value={configData.license_start_date ? new Date(configData.license_start_date + 'T00:00:00') : null}
                          onChange={(date) => setConfigData(prev => ({ ...prev, license_start_date: date ? date.toISOString().split('T')[0] : '' }))}
                          placeholder="Seleccionar fecha de inicio"
                          colorScheme="green"
                        />
                        {configData.license_start_date && (
                          <p className="text-xs text-green-600 mt-1 font-medium">
                            {new Date(configData.license_start_date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-indigo-500" />
                          Fecha de Fin <span className="text-gray-400 text-xs">(opcional)</span>
                        </label>
                        <DatePickerInput
                          value={configData.license_end_date ? new Date(configData.license_end_date + 'T00:00:00') : null}
                          onChange={(date) => setConfigData(prev => ({ ...prev, license_end_date: date ? date.toISOString().split('T')[0] : '' }))}
                          placeholder="Seleccionar fecha de fin"
                          minDate={configData.license_start_date ? new Date(configData.license_start_date + 'T00:00:00') : null}
                          colorScheme="indigo"
                        />
                        {configData.license_end_date ? (
                          <p className="text-xs text-indigo-600 mt-1 font-medium">
                            {new Date(configData.license_end_date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 mt-1">Deja vacío para vigencia indefinida</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Costos */}
                  <div>
                    <h3 className="fluid-text-sm font-semibold text-gray-700 fluid-mb-4 flex items-center fluid-gap-2">
                      <DollarSign className="fluid-w-4 fluid-h-4" />
                      Costos
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-4">
                      <div>
                        <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                          Costo por Certificación (MXN)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            name="certification_cost"
                            value={certificationCostInput}
                            onChange={(e) => handleCostChange('certification_cost', e.target.value)}
                            onBlur={() => handleCostBlur('certification_cost')}
                            onFocus={(e) => e.target.select()}
                            className="w-full fluid-pl-8 fluid-pr-3 fluid-py-2 border border-gray-300 fluid-rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                          Costo por Retoma (MXN)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            name="retake_cost"
                            value={retakeCostInput}
                            onChange={(e) => handleCostChange('retake_cost', e.target.value)}
                            onBlur={() => handleCostBlur('retake_cost')}
                            onFocus={(e) => e.target.select()}
                            className="w-full fluid-pl-8 fluid-pr-3 fluid-py-2 border border-gray-300 fluid-rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botón de enviar */}
                  <div className="fluid-pt-4 border-t">
                    <button
                      type="submit"
                      disabled={isConfiguringCampus}
                      className="w-full fluid-py-3 bg-indigo-600 hover:bg-indigo-700 text-white fluid-rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center fluid-gap-2"
                    >
                      {isConfiguringCampus ? (
                        <>
                          <div className="fluid-w-5 fluid-h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Guardando configuración...
                        </>
                      ) : (
                        <>
                          <Settings className="w-5 h-5" />
                          Guardar Configuración y Continuar
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}

          {/* Paso 3: Activar Plantel */}
          {currentStep === 3 && campus.responsable && campus.configuration_completed && (
            <>
              {/* Resumen del Responsable */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    Responsable Asignado
                  </h2>
                  <button
                    type="button"
                    onClick={handleEditResponsable}
                    className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <UserCog className="w-4 h-4" />
                    Cambiar responsable
                  </button>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
                    <UserCog className="w-7 h-7 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-lg">{campus.responsable.full_name}</p>
                    <p className="text-gray-500">{campus.responsable.email}</p>
                    <p className="text-xs text-gray-400 font-mono mt-1">ID: {campus.responsable.username}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {campus.responsable.can_bulk_create_candidates && (
                      <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
                        Altas masivas
                      </span>
                    )}
                    {campus.responsable.can_manage_groups && (
                      <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-full">
                        Gestión de grupos
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Resumen de Configuración */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    Configuración del Plantel
                  </h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Versión Office</p>
                    <p className="font-medium">
                      {campus.office_version === 'office_365' ? 'Microsoft 365' : 
                       campus.office_version === 'office_2019' ? 'Office 2019' : 'Office 2016'}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Certificaciones</p>
                    <div className="flex flex-wrap gap-1">
                      {campus.enable_tier_basic && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Básico</span>}
                      {campus.enable_tier_standard && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Estándar</span>}
                      {campus.enable_tier_advanced && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">CONOCER</span>}
                      {campus.enable_digital_badge && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Insignia</span>}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Vigencia</p>
                    <p className="font-medium">
                      {campus.license_start_date ? new Date(campus.license_start_date).toLocaleDateString('es-MX') : '-'}
                      {campus.license_end_date ? ` - ${new Date(campus.license_end_date).toLocaleDateString('es-MX')}` : ' - Indefinida'}
                    </p>
                  </div>

                  {campus.enable_partial_evaluations && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-500 text-xs mb-1">Parciales</p>
                      <p className="font-medium text-indigo-600">Habilitados</p>
                    </div>
                  )}

                  {campus.enable_virtual_machines && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-500 text-xs mb-1">Calendario de Sesiones</p>
                      <p className="font-medium text-emerald-600">Habilitado</p>
                    </div>
                  )}

                  {campus.enable_online_payments && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-500 text-xs mb-1">Pagos en Línea</p>
                      <p className="font-medium text-rose-600">Habilitados</p>
                    </div>
                  )}
                </div>

                {/* ECM Asignados */}
                {selectedEcmIds.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-gray-500 text-xs mb-2">Estándares de Competencia (ECM) asignados</p>
                    <div className="flex flex-wrap gap-2">
                      {availableEcm
                        .filter(ecm => selectedEcmIds.includes(ecm.id))
                        .map(ecm => (
                          <span 
                            key={ecm.id} 
                            className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg"
                          >
                            <span className="font-mono font-medium">{ecm.code}</span>
                            <span className="text-indigo-500">-</span>
                            <span className="max-w-32 truncate">{ecm.name}</span>
                          </span>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>

              {/* Activar Plantel */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">
                      Paso Final: Activar Plantel
                    </h2>
                    <p className="text-gray-600 mt-1">
                      Una vez activado, podrás crear ciclos escolares, grupos y asignar exámenes o materiales de estudio.
                    </p>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                  <h3 className="font-medium text-green-800 mb-2">Al activar el plantel podrás:</h3>
                  <ul className="space-y-2 text-sm text-green-700">
                    <li className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      Crear ciclos escolares (anuales o semestrales)
                    </li>
                    <li className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Crear grupos de candidatos
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Asignar exámenes y materiales de estudio a los grupos
                    </li>
                  </ul>
                </div>

                <ActivateCampusButton 
                  campusId={campus.id} 
                  onSuccess={() => {
                    // Redirigir a la página de detalle
                    navigate(`/partners/campuses/${campusId}`);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente para el botón de activar plantel
function ActivateCampusButton({ 
  campusId, 
  onSuccess 
}: { 
  campusId: number;
  onSuccess: () => void;
}) {
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    try {
      setActivating(true);
      setError(null);
      
      // Importar la función aquí para evitar dependencias circulares
      const { activateCampus } = await import('../../services/partnersService');
      await activateCampus(campusId);
      
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al activar el plantel');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      
      <button
        onClick={handleActivate}
        disabled={activating}
        className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
      >
        {activating ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Activando...
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            Activar Plantel
          </>
        )}
      </button>
    </div>
  );
}
