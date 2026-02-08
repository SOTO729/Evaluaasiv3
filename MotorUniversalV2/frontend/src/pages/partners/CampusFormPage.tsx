/**
 * Formulario de Plantel (Campus) - Versión completa con configuración
 * Permite editar TODOS los parámetros del plantel incluyendo configuración
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  MapPin,
  ArrowLeft,
  AlertCircle,
  X,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  MapPinned,
  FileText,
  CheckCircle2,
  Settings,
  Monitor,
  Award,
  Shield,
  Zap,
  Calendar,
  CreditCard,
  DollarSign,
  Info,
  Power,
  Home,
  Hash,
  FileCheck,
  Loader2,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import DatePickerInput from '../../components/DatePickerInput';
import StyledSelect from '../../components/StyledSelect';
import {
  getCampus,
  createCampus,
  updateCampus,
  getMexicanStates,
  getCountries,
  getPartner,
  configureCampus,
  OfficeVersion,
  getAvailableCompetencyStandards,
  getCampusCompetencyStandards,
  AvailableCompetencyStandard,
} from '../../services/partnersService';

export default function CampusFormPage() {
  const { partnerId: urlPartnerId, campusId } = useParams();
  const navigate = useNavigate();
  const isEditing = !!campusId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mexicanStates, setMexicanStates] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [partnerName, setPartnerName] = useState('');
  const [partnerCountry, setPartnerCountry] = useState('México');
  const [actualPartnerId, setActualPartnerId] = useState<number | null>(null);
  const [configChanged, setConfigChanged] = useState(false);
  
  // ECM (Estándares de Competencia)
  const [availableEcm, setAvailableEcm] = useState<AvailableCompetencyStandard[]>([]);
  const [selectedEcmIds, setSelectedEcmIds] = useState<number[]>([]);
  const [loadingEcm, setLoadingEcm] = useState(false);

  // Datos básicos del plantel
  const [formData, setFormData] = useState({
    name: '',
    country: 'México',
    state_name: '',
    postal_code: '',
    email: '',
    phone: '',
    city: '',
    address: '',
    website: '',
    // Director del plantel (datos completos como candidato)
    director_name: '',
    director_first_surname: '',
    director_second_surname: '',
    director_email: '',
    director_phone: '',
    director_curp: '',
    director_gender: '',
    director_date_of_birth: '',
    is_active: true,
  });

  // Datos de configuración (solo para edición)
  const [configData, setConfigData] = useState({
    office_version: 'office_365' as OfficeVersion,
    enable_tier_basic: true,
    enable_tier_standard: false,
    enable_tier_advanced: false,
    enable_digital_badge: false,
    enable_partial_evaluations: false,
    enable_unscheduled_partials: false,
    enable_virtual_machines: false,
    enable_online_payments: false,
    license_start_date: '' as string,
    license_end_date: '' as string,
    certification_cost: 0,
    retake_cost: 0,
  });

  useEffect(() => {
    loadInitialData();
  }, [urlPartnerId, campusId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Cargar los estados mexicanos y países
      const [states, countriesList] = await Promise.all([
        getMexicanStates(),
        getCountries()
      ]);
      setMexicanStates(states);
      setCountries(countriesList);

      let partnerId: number;

      if (isEditing && campusId) {
        // Si estamos editando, primero obtener el campus para saber el partner_id
        const campus = await getCampus(Number(campusId));
        partnerId = campus.partner_id;
        setActualPartnerId(partnerId);
        
        setFormData({
          name: campus.name || '',
          country: campus.country || 'México',
          state_name: campus.state_name || '',
          postal_code: campus.postal_code || '',
          email: campus.email || '',
          phone: campus.phone || '',
          city: campus.city || '',
          address: campus.address || '',
          website: campus.website || '',
          // Director del plantel (datos completos)
          director_name: campus.director_name || '',
          director_first_surname: campus.director_first_surname || '',
          director_second_surname: campus.director_second_surname || '',
          director_email: campus.director_email || '',
          director_phone: campus.director_phone || '',
          director_curp: campus.director_curp || '',
          director_gender: campus.director_gender || '',
          director_date_of_birth: campus.director_date_of_birth || '',
          is_active: campus.is_active,
        });
        
        // Cargar configuración directamente del objeto campus (ya viene incluida)
        setConfigData({
          office_version: (campus.office_version as OfficeVersion) || 'office_365',
          enable_tier_basic: campus.enable_tier_basic ?? true,
          enable_tier_standard: campus.enable_tier_standard ?? false,
          enable_tier_advanced: campus.enable_tier_advanced ?? false,
          enable_digital_badge: campus.enable_digital_badge ?? false,
          enable_partial_evaluations: campus.enable_partial_evaluations ?? false,
          enable_unscheduled_partials: campus.enable_unscheduled_partials ?? false,
          enable_virtual_machines: campus.enable_virtual_machines ?? false,
          enable_online_payments: campus.enable_online_payments ?? false,
          license_start_date: campus.license_start_date || '',
          license_end_date: campus.license_end_date || '',
          certification_cost: campus.certification_cost || 0,
          retake_cost: campus.retake_cost || 0,
        });
        
        // Cargar ECMs disponibles y asignados
        await loadEcmData(Number(campusId));
        
        // Ahora cargar el partner
        const partner = await getPartner(partnerId);
        setPartnerName(partner.name);
        setPartnerCountry(partner.country || 'México');
      } else {
        // Si estamos creando, usar el partnerId de la URL
        partnerId = Number(urlPartnerId);
        setActualPartnerId(partnerId);
        const partner = await getPartner(partnerId);
        setPartnerName(partner.name);
        setPartnerCountry(partner.country || 'México');
        // Heredar el país del partner al crear un nuevo campus
        setFormData(prev => ({ ...prev, country: partner.country || 'México' }));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadEcmData = async (campusId: number) => {
    try {
      setLoadingEcm(true);
      
      // Cargar ECMs disponibles y asignados en paralelo
      const [availableResponse, assignedResponse] = await Promise.all([
        getAvailableCompetencyStandards(),
        getCampusCompetencyStandards(campusId)
      ]);
      
      setAvailableEcm(availableResponse.competency_standards);
      
      // Extraer los IDs de los ECM ya asignados
      const assignedIds = assignedResponse.competency_standards.map(
        (cs: any) => cs.competency_standard_id
      );
      setSelectedEcmIds(assignedIds);
    } catch (err) {
      console.error('Error al cargar ECMs:', err);
    } finally {
      setLoadingEcm(false);
    }
  };

  const toggleEcmSelection = (ecmId: number) => {
    setSelectedEcmIds(prev => {
      if (prev.includes(ecmId)) {
        return prev.filter(id => id !== ecmId);
      } else {
        return [...prev, ecmId];
      }
    });
    setConfigChanged(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('El nombre es requerido');
      return;
    }
    // El estado solo es requerido para México
    if (formData.country === 'México' && !formData.state_name) {
      setError('El estado es requerido para México');
      return;
    }
    // Código postal es opcional
    if (!formData.phone.trim()) {
      setError('El teléfono de contacto es requerido');
      return;
    }
    if (!formData.email.trim()) {
      setError('El correo de contacto es requerido');
      return;
    }
    
    // Validaciones del director
    if (!formData.director_name.trim()) {
      setError('El nombre del director es requerido');
      return;
    }
    if (!formData.director_first_surname.trim()) {
      setError('El primer apellido del director es requerido');
      return;
    }
    if (!formData.director_second_surname.trim()) {
      setError('El segundo apellido del director es requerido');
      return;
    }
    if (!formData.director_curp.trim()) {
      setError('El CURP del director es requerido');
      return;
    }
    if (formData.director_curp.trim().length !== 18) {
      setError('El CURP del director debe tener 18 caracteres');
      return;
    }
    if (!formData.director_gender) {
      setError('El género del director es requerido');
      return;
    }
    if (!formData.director_date_of_birth) {
      setError('La fecha de nacimiento del director es requerida');
      return;
    }
    if (!formData.director_email.trim()) {
      setError('El correo del director es requerido');
      return;
    }
    if (!formData.director_phone.trim()) {
      setError('El teléfono del director es requerido');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEditing) {
        await updateCampus(Number(campusId), formData);
        setSuccessMessage('Información del plantel guardada exitosamente');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const result = await createCampus(actualPartnerId!, formData);
        // Si se auto-creó el estado, mostrar mensaje especial
        if (result.state_auto_created) {
          navigate(`/partners/${actualPartnerId}`, {
            state: {
              successMessage: `Plantel creado exitosamente. Se registró automáticamente la presencia en ${formData.state_name}.`,
            },
          });
        } else {
          navigate(`/partners/campuses/${result.campus.id}`);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar el plantel');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!campusId) return;
    
    try {
      setSavingConfig(true);
      setError(null);
      
      await configureCampus(Number(campusId), {
        office_version: configData.office_version,
        enable_tier_basic: configData.enable_tier_basic,
        enable_tier_standard: configData.enable_tier_standard,
        enable_tier_advanced: configData.enable_tier_advanced,
        enable_digital_badge: configData.enable_digital_badge,
        enable_partial_evaluations: configData.enable_partial_evaluations,
        enable_unscheduled_partials: configData.enable_unscheduled_partials,
        enable_virtual_machines: configData.enable_virtual_machines,
        enable_online_payments: configData.enable_online_payments,
        license_start_date: configData.license_start_date || null,
        license_end_date: configData.license_end_date || null,
        certification_cost: configData.certification_cost,
        retake_cost: configData.retake_cost,
        competency_standard_ids: selectedEcmIds,
      });
      
      setSuccessMessage('Configuración guardada exitosamente');
      setConfigChanged(false);
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar configuración');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleConfigChange = (field: string, value: any) => {
    setConfigData(prev => ({ ...prev, [field]: value }));
    setConfigChanged(true);
  };

  // Componente de toggle para configuraciones
  const ConfigToggle = ({ 
    field, 
    label, 
    icon: Icon,
    description,
    colorClass = 'blue'
  }: { 
    field: keyof typeof configData;
    label: string;
    icon: React.ComponentType<any>;
    description?: string;
    colorClass?: 'blue' | 'green' | 'purple' | 'orange';
  }) => {
    const value = configData[field] as boolean;
    const colors = {
      blue: { bg: 'bg-blue-100', text: 'text-blue-600', activeBg: 'bg-blue-600' },
      green: { bg: 'bg-green-100', text: 'text-green-600', activeBg: 'bg-green-600' },
      purple: { bg: 'bg-purple-100', text: 'text-purple-600', activeBg: 'bg-purple-600' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-600', activeBg: 'bg-orange-600' },
    };
    const color = colors[colorClass];
    
    return (
      <div className={`flex items-center fluid-gap-3 fluid-p-4 rounded-fluid-xl transition-all duration-300 hover:shadow-md ${
        value ? 'bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200' : 'bg-gray-50 border border-gray-200'
      }`}>
        <div className={`fluid-p-2.5 rounded-fluid-lg transition-all duration-300 ${
          value ? `${color.bg} ${color.text} scale-110` : 'bg-gray-200 text-gray-400 scale-100'
        }`}>
          <Icon className="fluid-icon-base" />
        </div>
        <div className="flex-1 min-w-0">
          <span className={`font-semibold fluid-text-sm transition-colors duration-300 ${
            value ? 'text-gray-800' : 'text-gray-500'
          }`}>{label}</span>
          {description && (
            <p className="fluid-text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => handleConfigChange(field, !value)}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            value ? `${color.activeBg} focus:ring-${colorClass}-500` : 'bg-gray-300 focus:ring-gray-500'
          }`}
        >
          <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando..." />
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb 
        items={isEditing 
          ? [
              { label: partnerName || 'Partner', path: `/partners/${actualPartnerId}` },
              { label: formData.name || 'Plantel', path: `/partners/campuses/${campusId}` },
              { label: 'Editar' }
            ]
          : [
              { label: partnerName || 'Partner', path: `/partners/${actualPartnerId}` },
              { label: 'Nuevo Plantel' }
            ]
        } 
      />
      
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 shadow-lg">
        <div className="flex items-center fluid-gap-5 flex-wrap">
          <Link
            to={isEditing ? `/partners/campuses/${campusId}` : `/partners/${actualPartnerId}`}
            className="fluid-p-2.5 bg-white/20 hover:bg-white/30 rounded-fluid-xl transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="fluid-icon-lg text-white" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 fluid-text-base text-white/80 mb-1">
              <Building2 className="fluid-icon-sm" />
              <span className="truncate">{partnerName}</span>
            </div>
            <h1 className="fluid-text-3xl font-bold text-white flex items-center fluid-gap-3">
              <MapPin className="fluid-icon-xl" />
              {isEditing ? 'Editar Plantel' : 'Nuevo Plantel'}
            </h1>
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="fluid-mb-6 fluid-p-4 bg-red-50 border border-red-200 rounded-fluid-xl flex items-center fluid-gap-3 animate-fade-in-up">
          <AlertCircle className="fluid-icon-lg text-red-600 flex-shrink-0" />
          <p className="fluid-text-base text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="hover:bg-red-100 rounded-full p-1 transition-colors">
            <X className="h-5 w-5 text-red-600" />
          </button>
        </div>
      )}
      
      {successMessage && (
        <div className="fluid-mb-6 fluid-p-4 bg-green-50 border border-green-200 rounded-fluid-xl flex items-center fluid-gap-3 animate-fade-in-up">
          <CheckCircle2 className="fluid-icon-lg text-green-600 flex-shrink-0" />
          <p className="fluid-text-base text-green-700">{successMessage}</p>
        </div>
      )}

      {/* Formulario principal */}
      <form onSubmit={handleSubmit} className="fluid-space-y-6">
        
        {/* Sección: Información del Plantel */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center fluid-gap-3 fluid-mb-6">
            <div className="fluid-p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-fluid-xl text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
              <Building2 className="fluid-icon-lg" />
            </div>
            <div>
              <h2 className="fluid-text-xl font-bold text-gray-800">Información del Plantel</h2>
              <p className="fluid-text-sm text-gray-500">Datos básicos del plantel educativo</p>
            </div>
            <span className="ml-auto fluid-px-3 fluid-py-1 bg-red-100 text-red-600 rounded-full fluid-text-xs font-medium">
              * Campos obligatorios
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 fluid-gap-5">
            {/* Nombre del plantel - Ocupa 2 columnas */}
            <div className="md:col-span-2">
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <Home className="fluid-icon-sm text-gray-400" />
                Nombre del Plantel <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all duration-200 hover:border-gray-400"
                placeholder="Ej: Plantel Centro Histórico"
                required
              />
            </div>

            {/* País - Heredado del partner, solo editable si el partner es de México */}
            <div>
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <Globe className="fluid-icon-sm text-blue-500" />
                País <span className="text-red-500">*</span>
              </label>
              {partnerCountry === 'México' ? (
                <StyledSelect
                  value={formData.country}
                  onChange={(value) => setFormData({ ...formData, country: value, state_name: value === 'México' ? formData.state_name : '' })}
                  options={countries.map(country => ({ value: country, label: country }))}
                  placeholder="Seleccionar país..."
                  icon={Globe}
                  colorScheme="blue"
                  required
                />
              ) : (
                <div className="w-full fluid-px-4 fluid-py-3 bg-gray-100 border border-gray-300 rounded-fluid-xl fluid-text-base text-gray-700 flex items-center fluid-gap-2">
                  <Globe className="fluid-icon-sm text-blue-500" />
                  <span className="font-medium">{partnerCountry}</span>
                  <span className="fluid-text-xs text-gray-500 ml-auto">(heredado del partner)</span>
                </div>
              )}
            </div>

            {/* Estado (solo para México) */}
            {formData.country === 'México' && partnerCountry === 'México' && (
              <div>
                <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                  <MapPinned className="fluid-icon-sm text-indigo-500" />
                  Estado <span className="text-red-500">*</span>
                </label>
                <StyledSelect
                  value={formData.state_name}
                  onChange={(value) => setFormData({ ...formData, state_name: value })}
                  options={mexicanStates.map(state => ({ value: state, label: state }))}
                  placeholder="Seleccionar estado..."
                  icon={MapPinned}
                  colorScheme="indigo"
                  required
                />
              </div>
            )}

            {/* Código Postal */}
            <div>
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <Hash className="fluid-icon-sm text-gray-400" />
                Código Postal
              </label>
              <input
                type="text"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all duration-200 hover:border-gray-400"
                placeholder="12345"
                maxLength={5}
              />
            </div>

            {/* Ciudad */}
            <div>
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <MapPin className="fluid-icon-sm text-gray-400" />
                Ciudad
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all duration-200 hover:border-gray-400"
                placeholder="Ciudad"
              />
            </div>

            {/* Dirección - Ocupa 3 columnas */}
            <div className="xl:col-span-3">
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <FileText className="fluid-icon-sm text-gray-400" />
                Dirección Completa
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all duration-200 hover:border-gray-400"
                placeholder="Calle, número, colonia, etc."
              />
            </div>
          </div>
        </div>

        {/* Sección: Contacto del Plantel */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center fluid-gap-3 fluid-mb-6">
            <div className="fluid-p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-fluid-xl text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
              <Phone className="fluid-icon-lg" />
            </div>
            <div>
              <h2 className="fluid-text-xl font-bold text-gray-800">Contacto del Plantel</h2>
              <p className="fluid-text-sm text-gray-500">Información de contacto general</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 fluid-gap-5">
            {/* Correo */}
            <div>
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <Mail className="fluid-icon-sm text-gray-400" />
                Correo Electrónico <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all duration-200 hover:border-gray-400"
                placeholder="plantel@ejemplo.com"
                required
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <Phone className="fluid-icon-sm text-gray-400" />
                Teléfono <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all duration-200 hover:border-gray-400"
                placeholder="(55) 1234-5678"
                required
              />
            </div>

            {/* Sitio Web */}
            <div>
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <Globe className="fluid-icon-sm text-gray-400" />
                Sitio Web
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all duration-200 hover:border-gray-400"
                placeholder="https://www.ejemplo.com"
              />
            </div>
          </div>
        </div>

        {/* Sección: Director del Plantel */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center fluid-gap-3 fluid-mb-6">
            <div className="fluid-p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-fluid-xl text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
              <User className="fluid-icon-lg" />
            </div>
            <div>
              <h2 className="fluid-text-xl font-bold text-gray-800">Director del Plantel</h2>
              <p className="fluid-text-sm text-gray-500">Datos completos del responsable académico</p>
            </div>
            <span className="ml-auto fluid-px-3 fluid-py-1 bg-red-100 text-red-600 rounded-full fluid-text-xs font-medium">
              * Todos los campos son obligatorios
            </span>
          </div>
          
          {/* Fila 1: Nombre(s), Primer Apellido, Segundo Apellido */}
          <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-5 fluid-mb-5">
            {/* Nombre(s) del Director */}
            <div>
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <User className="fluid-icon-sm text-gray-400" />
                Nombre(s) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.director_name}
                onChange={(e) => setFormData({ ...formData, director_name: e.target.value })}
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all duration-200 hover:border-gray-400"
                placeholder="Juan Carlos"
                required
              />
            </div>

            {/* Primer Apellido */}
            <div>
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                Primer Apellido <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.director_first_surname}
                onChange={(e) => setFormData({ ...formData, director_first_surname: e.target.value })}
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all duration-200 hover:border-gray-400"
                placeholder="González"
                required
              />
            </div>

            {/* Segundo Apellido */}
            <div>
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                Segundo Apellido <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.director_second_surname}
                onChange={(e) => setFormData({ ...formData, director_second_surname: e.target.value })}
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all duration-200 hover:border-gray-400"
                placeholder="Martínez"
                required
              />
            </div>
          </div>

          {/* Fila 2: CURP, Género, Fecha de Nacimiento */}
          <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-5 fluid-mb-5">
            {/* CURP del Director */}
            <div>
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <FileText className="fluid-icon-sm text-gray-400" />
                CURP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.director_curp}
                onChange={(e) => setFormData({ ...formData, director_curp: e.target.value.toUpperCase() })}
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all duration-200 hover:border-gray-400 uppercase"
                placeholder="XXXX000000XXXXXX00"
                maxLength={18}
                required
              />
              <p className="fluid-text-xs text-gray-500 fluid-mt-1">18 caracteres exactos</p>
            </div>

            {/* Género del Director */}
            <div>
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <User className="fluid-icon-sm text-purple-500" />
                Género <span className="text-red-500">*</span>
              </label>
              <StyledSelect
                value={formData.director_gender}
                onChange={(value) => setFormData({ ...formData, director_gender: value })}
                options={[
                  { value: '', label: 'Seleccionar...' },
                  { value: 'M', label: 'Masculino' },
                  { value: 'F', label: 'Femenino' },
                  { value: 'O', label: 'Otro' },
                ]}
                icon={User}
                colorScheme="purple"
                required
              />
            </div>

            {/* Fecha de Nacimiento del Director */}
            <div>
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <Calendar className="fluid-icon-sm text-blue-500" />
                Fecha de Nacimiento <span className="text-red-500">*</span>
              </label>
              <DatePickerInput
                value={formData.director_date_of_birth ? new Date(formData.director_date_of_birth + 'T00:00:00') : null}
                onChange={(date) => setFormData({ ...formData, director_date_of_birth: date ? date.toISOString().split('T')[0] : '' })}
                placeholder="Seleccionar fecha de nacimiento"
                maxDate={new Date()}
                colorScheme="blue"
              />
              {formData.director_date_of_birth && (
                <p className="fluid-text-xs text-blue-600 fluid-mt-2 font-medium">
                  {new Date(formData.director_date_of_birth + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>

          {/* Fila 3: Email y Teléfono */}
          <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-5">
            {/* Correo del Director */}
            <div>
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <Mail className="fluid-icon-sm text-gray-400" />
                Correo Electrónico <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.director_email}
                onChange={(e) => setFormData({ ...formData, director_email: e.target.value })}
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all duration-200 hover:border-gray-400"
                placeholder="director@ejemplo.com"
                required
              />
            </div>

            {/* Teléfono del Director */}
            <div>
              <label className="flex items-center fluid-gap-2 fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <Phone className="fluid-icon-sm text-gray-400" />
                Teléfono <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.director_phone}
                onChange={(e) => setFormData({ ...formData, director_phone: e.target.value })}
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all duration-200 hover:border-gray-400"
                placeholder="(55) 1234-5678"
                required
              />
            </div>
          </div>
        </div>

        {/* Sección: Estado del Plantel (solo al editar) */}
        {isEditing && (
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300 group">
            <div className="flex items-center fluid-gap-3 fluid-mb-6">
              <div className={`fluid-p-3 rounded-fluid-xl text-white shadow-lg group-hover:scale-110 transition-transform duration-300 ${
                formData.is_active ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-gray-400 to-gray-500'
              }`}>
                <Power className="fluid-icon-lg" />
              </div>
              <div>
                <h2 className="fluid-text-xl font-bold text-gray-800">Estado del Plantel</h2>
                <p className="fluid-text-sm text-gray-500">Control de activación del plantel</p>
              </div>
            </div>
            
            <div className={`flex items-center fluid-gap-4 fluid-p-5 rounded-fluid-xl transition-all duration-300 ${
              formData.is_active ? 'bg-green-50 border-2 border-green-200' : 'bg-gray-50 border-2 border-gray-200'
            }`}>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  formData.is_active ? 'bg-green-600 focus:ring-green-500' : 'bg-gray-300 focus:ring-gray-500'
                }`}
              >
                <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${
                  formData.is_active ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
              <div>
                <p className={`font-semibold fluid-text-base ${formData.is_active ? 'text-green-700' : 'text-gray-600'}`}>
                  {formData.is_active ? 'Plantel Activo' : 'Plantel Inactivo'}
                </p>
                <p className="fluid-text-sm text-gray-500">
                  {formData.is_active 
                    ? 'El plantel puede operar normalmente y crear ciclos escolares' 
                    : 'El plantel está desactivado y no puede realizar operaciones'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================= CONFIGURACIÓN DEL PLANTEL (Solo al editar) ================= */}
        {isEditing && (
          <>
            <div className="border-t-2 border-dashed border-gray-300 fluid-my-8" />
            
            <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 rounded-fluid-2xl shadow-sm border border-indigo-200 fluid-p-6">
              <div className="flex items-center justify-between fluid-mb-6 flex-wrap fluid-gap-4">
                <div className="flex items-center fluid-gap-3">
                  <div className="fluid-p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-fluid-xl text-white shadow-lg">
                    <Settings className="fluid-icon-lg" />
                  </div>
                  <div>
                    <h2 className="fluid-text-xl font-bold text-gray-800">Configuración del Plantel</h2>
                    <p className="fluid-text-sm text-gray-600">Opciones avanzadas y niveles de certificación</p>
                  </div>
                </div>
                
                {configChanged && (
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                    className="fluid-px-5 fluid-py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-fluid-xl font-semibold fluid-text-base transition-all duration-300 hover:scale-105 flex items-center fluid-gap-2 shadow-lg disabled:opacity-50"
                  >
                    {savingConfig ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Configuración'
                    )}
                  </button>
                )}
              </div>

              {/* Info */}
              <div className="flex items-start fluid-gap-3 fluid-p-4 fluid-mb-6 bg-blue-50 rounded-fluid-xl border border-blue-200">
                <Info className="fluid-icon-lg text-blue-500 flex-shrink-0 fluid-mt-1" />
                <div className="fluid-text-sm text-blue-700">
                  <p>Esta configuración define las opciones disponibles para todos los grupos de este plantel. Los grupos pueden heredar o personalizar estas opciones.</p>
                </div>
              </div>

              <div className="fluid-space-y-6">
                
                {/* Fila 1: Versión Office, Costos y Vigencia */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 fluid-gap-5">
                  {/* Versión de Office */}
                  <div className="bg-white fluid-p-5 rounded-fluid-xl border border-gray-200 hover:shadow-lg transition-all duration-300 hover:border-blue-300">
                    <div className="flex items-center fluid-gap-3 fluid-mb-4">
                      <div className="fluid-p-2.5 rounded-fluid-lg bg-blue-100 text-blue-600">
                        <Monitor className="fluid-icon-base" />
                      </div>
                      <span className="font-semibold text-gray-800 fluid-text-sm">Versión de Office</span>
                    </div>
                    <select
                      value={configData.office_version}
                      onChange={(e) => handleConfigChange('office_version', e.target.value)}
                      className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl fluid-text-base focus:ring-2 focus:ring-blue-500 transition-all duration-200 hover:border-blue-400"
                    >
                      <option value="office_2016">Office 2016</option>
                      <option value="office_2019">Office 2019</option>
                      <option value="office_365">Office 365</option>
                    </select>
                  </div>

                  {/* Costo Certificación */}
                  <div className="bg-white fluid-p-5 rounded-fluid-xl border border-gray-200 hover:shadow-lg transition-all duration-300 hover:border-green-300">
                    <div className="flex items-center fluid-gap-3 fluid-mb-4">
                      <div className="fluid-p-2.5 rounded-fluid-lg bg-green-100 text-green-600">
                        <DollarSign className="fluid-icon-base" />
                      </div>
                      <span className="font-semibold text-gray-800 fluid-text-sm">Costo Certificación</span>
                    </div>
                    <div className="flex items-center fluid-gap-2">
                      <span className="text-gray-500 font-medium">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={configData.certification_cost}
                        onChange={(e) => handleConfigChange('certification_cost', parseFloat(e.target.value) || 0)}
                        className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl fluid-text-base focus:ring-2 focus:ring-green-500 transition-all duration-200"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Costo Retoma */}
                  <div className="bg-white fluid-p-5 rounded-fluid-xl border border-gray-200 hover:shadow-lg transition-all duration-300 hover:border-orange-300">
                    <div className="flex items-center fluid-gap-3 fluid-mb-4">
                      <div className="fluid-p-2.5 rounded-fluid-lg bg-orange-100 text-orange-600">
                        <DollarSign className="fluid-icon-base" />
                      </div>
                      <span className="font-semibold text-gray-800 fluid-text-sm">Costo Retoma</span>
                    </div>
                    <div className="flex items-center fluid-gap-2">
                      <span className="text-gray-500 font-medium">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={configData.retake_cost}
                        onChange={(e) => handleConfigChange('retake_cost', parseFloat(e.target.value) || 0)}
                        className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl fluid-text-base focus:ring-2 focus:ring-orange-500 transition-all duration-200"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Vigencia de Licencia */}
                  <div className="bg-white fluid-p-5 rounded-fluid-xl border border-gray-200 hover:shadow-lg transition-all duration-300 hover:border-purple-300">
                    <div className="flex items-center fluid-gap-3 fluid-mb-4">
                      <div className="fluid-p-2.5 rounded-fluid-lg bg-purple-100 text-purple-600">
                        <Calendar className="fluid-icon-base" />
                      </div>
                      <span className="font-semibold text-gray-800 fluid-text-sm">Vigencia de Licencia</span>
                    </div>
                    <div className="grid grid-cols-2 fluid-gap-4">
                      <div>
                        <label className="block fluid-text-xs text-gray-500 fluid-mb-2 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-green-500" />
                          Inicio
                        </label>
                        <DatePickerInput
                          value={configData.license_start_date ? new Date(configData.license_start_date + 'T00:00:00') : null}
                          onChange={(date) => handleConfigChange('license_start_date', date ? date.toISOString().split('T')[0] : '')}
                          placeholder="Fecha inicio"
                          colorScheme="green"
                        />
                        {configData.license_start_date && (
                          <p className="fluid-text-xs text-green-600 fluid-mt-1 font-medium">
                            {new Date(configData.license_start_date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block fluid-text-xs text-gray-500 fluid-mb-2 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-500" />
                          Fin
                        </label>
                        <DatePickerInput
                          value={configData.license_end_date ? new Date(configData.license_end_date + 'T00:00:00') : null}
                          onChange={(date) => handleConfigChange('license_end_date', date ? date.toISOString().split('T')[0] : '')}
                          placeholder="Fecha fin"
                          minDate={configData.license_start_date ? new Date(configData.license_start_date + 'T00:00:00') : null}
                          colorScheme="indigo"
                        />
                        {configData.license_end_date && (
                          <p className="fluid-text-xs text-indigo-600 fluid-mt-1 font-medium">
                            {new Date(configData.license_end_date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fila 2: Niveles de Certificación y Funcionalidades */}
                <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6">
                  {/* Niveles de Certificación */}
                  <div className="bg-white fluid-p-5 rounded-fluid-xl border border-gray-200 hover:shadow-lg transition-all duration-300">
                    <h3 className="fluid-text-base font-bold text-gray-800 uppercase tracking-wide fluid-mb-5 flex items-center fluid-gap-2 pb-3 border-b border-gray-200">
                      <Award className="fluid-icon-base text-indigo-600" />
                      Niveles de Certificación
                    </h3>
                    <div className="fluid-space-y-4">
                      <ConfigToggle 
                        field="enable_tier_basic" 
                        label="Constancia de Evaluación" 
                        icon={Award}
                        description="Constancia básica de participación"
                        colorClass="blue"
                      />
                      <ConfigToggle 
                        field="enable_tier_standard" 
                        label="Certificado Eduit" 
                        icon={Award}
                        description="Certificación oficial Eduit"
                        colorClass="green"
                      />
                      <ConfigToggle 
                        field="enable_tier_advanced" 
                        label="Certificado CONOCER" 
                        icon={Shield}
                        description="Certificación avalada por CONOCER"
                        colorClass="purple"
                      />
                      <ConfigToggle 
                        field="enable_digital_badge" 
                        label="Insignia Digital" 
                        icon={Zap}
                        description="Badge verificable digitalmente"
                        colorClass="orange"
                      />
                    </div>
                  </div>

                  {/* Funcionalidades */}
                  <div className="bg-white fluid-p-5 rounded-fluid-xl border border-gray-200 hover:shadow-lg transition-all duration-300">
                    <h3 className="fluid-text-base font-bold text-gray-800 uppercase tracking-wide fluid-mb-5 flex items-center fluid-gap-2 pb-3 border-b border-gray-200">
                      <Settings className="fluid-icon-base text-indigo-600" />
                      Funcionalidades Disponibles
                    </h3>
                    <div className="fluid-space-y-4">
                      <ConfigToggle 
                        field="enable_partial_evaluations" 
                        label="Evaluaciones Parciales" 
                        icon={FileText}
                        description="Permite evaluar por partes"
                        colorClass="blue"
                      />
                      <ConfigToggle 
                        field="enable_unscheduled_partials" 
                        label="Parciales Sin Agendar" 
                        icon={Calendar}
                        description="El alumno elige cuándo presentar"
                        colorClass="green"
                      />
                      <ConfigToggle 
                        field="enable_virtual_machines" 
                        label="Máquinas Virtuales" 
                        icon={Monitor}
                        description="Exámenes en ambiente virtual"
                        colorClass="purple"
                      />
                      <ConfigToggle 
                        field="enable_online_payments" 
                        label="Pagos en Línea" 
                        icon={CreditCard}
                        description="Aceptar pagos electrónicos"
                        colorClass="orange"
                      />
                    </div>
                  </div>
                </div>

                {/* Sección: Estándares de Competencia (ECM) */}
                <div className="bg-white fluid-p-5 rounded-fluid-xl border border-gray-200 hover:shadow-lg transition-all duration-300">
                  <h3 className="fluid-text-base font-bold text-gray-800 uppercase tracking-wide fluid-mb-5 flex items-center fluid-gap-2 pb-3 border-b border-gray-200">
                    <FileCheck className="fluid-icon-base text-emerald-600" />
                    Estándares de Competencia (ECM)
                    <span className="ml-auto fluid-text-xs font-normal normal-case text-gray-500">
                      {selectedEcmIds.length} seleccionado(s)
                    </span>
                  </h3>
                  
                  {loadingEcm ? (
                    <div className="flex items-center justify-center fluid-py-8">
                      <Loader2 className="fluid-icon-lg text-emerald-600 animate-spin" />
                      <span className="ml-2 text-gray-500">Cargando ECMs...</span>
                    </div>
                  ) : availableEcm.length === 0 ? (
                    <div className="text-center fluid-py-8 text-gray-500">
                      <FileCheck className="fluid-icon-xl mx-auto mb-2 text-gray-300" />
                      <p>No hay estándares de competencia disponibles</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 fluid-gap-4">
                      {availableEcm.map((ecm) => {
                        const isSelected = selectedEcmIds.includes(ecm.id);
                        return (
                          <button
                            key={ecm.id}
                            type="button"
                            onClick={() => toggleEcmSelection(ecm.id)}
                            className={`flex items-start fluid-gap-3 fluid-p-4 rounded-fluid-xl border-2 transition-all duration-300 text-left ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50 shadow-md'
                                : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white'
                            }`}
                          >
                            <div className={`fluid-p-2 rounded-fluid-lg flex-shrink-0 transition-all duration-300 ${
                              isSelected
                                ? 'bg-emerald-500 text-white'
                                : 'bg-gray-200 text-gray-400'
                            }`}>
                              <FileCheck className="fluid-icon-base" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-semibold fluid-text-sm truncate ${
                                isSelected ? 'text-emerald-700' : 'text-gray-700'
                              }`}>
                                {ecm.code}
                              </div>
                              <div className="fluid-text-xs text-gray-500 line-clamp-2">
                                {ecm.name}
                              </div>
                              {ecm.sector && (
                                <div className="fluid-text-xs text-gray-400 mt-1">
                                  {ecm.sector}
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <div className="flex-shrink-0">
                                <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Botones de acción finales */}
        <div className="flex flex-col sm:flex-row fluid-gap-3 justify-end fluid-mt-8 fluid-pt-6 border-t border-gray-200">
          <Link
            to={isEditing ? `/partners/campuses/${campusId}` : `/partners/${actualPartnerId}`}
            className="inline-flex items-center justify-center fluid-px-6 fluid-py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-xl font-medium fluid-text-base transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center fluid-px-6 fluid-py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-fluid-xl font-semibold fluid-text-base transition-all duration-300 shadow-lg"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Guardando...
              </>
            ) : (
              isEditing ? 'Guardar Cambios' : 'Crear Plantel'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
