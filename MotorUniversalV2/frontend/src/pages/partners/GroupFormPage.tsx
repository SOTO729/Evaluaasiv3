/**
 * Formulario para Crear/Editar Grupo de Candidatos
 * Incluye configuración heredada del campus (solo visible al editar)
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Layers,
  Building2,
  AlertCircle,
  FileText,
  GraduationCap,
  Settings,
  Monitor,
  Award,
  CreditCard,
  Calendar,
  Shield,
  Zap,
  RefreshCw,
  Info,
  DollarSign,
  CheckCircle2,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import DatePickerInput from '../../components/DatePickerInput';
import {
  getCampus,
  getGroup,
  createGroup,
  updateGroup,
  getSchoolCycles,
  getGroupConfig,
  updateGroupConfig,
  resetGroupConfig,
  Campus,
  SchoolCycle,
  GroupConfigResponse,
} from '../../services/partnersService';

export default function GroupFormPage() {
  const { campusId, groupId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = Boolean(groupId);
  
  // Obtener el ciclo desde la URL si viene desde un ciclo específico
  const defaultCycleId = searchParams.get('cycle');
  
  const [campus, setCampus] = useState<Partial<Campus> | null>(null);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Configuración del grupo
  const [groupConfig, setGroupConfig] = useState<GroupConfigResponse | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configChanged, setConfigChanged] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    is_active: true,
    school_cycle_id: defaultCycleId ? parseInt(defaultCycleId) : undefined as number | undefined,
  });

  // Estados para los overrides de configuración
  const [configOverrides, setConfigOverrides] = useState({
    use_custom_config: false,
    office_version_override: null as string | null,
    enable_tier_basic_override: null as boolean | null,
    enable_tier_standard_override: null as boolean | null,
    enable_tier_advanced_override: null as boolean | null,
    enable_digital_badge_override: null as boolean | null,
    enable_partial_evaluations_override: null as boolean | null,
    enable_unscheduled_partials_override: null as boolean | null,
    enable_virtual_machines_override: null as boolean | null,
    enable_online_payments_override: null as boolean | null,
    certification_cost_override: null as number | null,
    retake_cost_override: null as number | null,
    group_start_date: null as string | null,
    group_end_date: null as string | null,
  });

  useEffect(() => {
    loadData();
  }, [campusId, groupId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (isEditing && groupId) {
        const group = await getGroup(Number(groupId));
        setCampus({
          id: group.campus_id,
          partner_id: group.campus?.partner_id || 0,
          name: group.campus?.name || '',
          state_name: group.campus?.state_name || '',
          is_active: true,
        });
        
        // Cargar ciclos del campus
        if (group.campus_id) {
          const cyclesData = await getSchoolCycles(group.campus_id, { active_only: true });
          setCycles(cyclesData.cycles);
        }
        
        setFormData({
          name: group.name,
          code: group.code || '',
          description: group.description || '',
          is_active: group.is_active,
          school_cycle_id: group.school_cycle_id || undefined,
        });

        // Cargar configuración del grupo
        await loadGroupConfig(Number(groupId));
        
      } else if (campusId) {
        const [campusData, cyclesData] = await Promise.all([
          getCampus(Number(campusId)),
          getSchoolCycles(Number(campusId), { active_only: true }),
        ]);
        setCampus(campusData);
        setCycles(cyclesData.cycles);
        
        // Si viene un ciclo por URL, usarlo
        if (defaultCycleId) {
          setFormData(prev => ({
            ...prev,
            school_cycle_id: parseInt(defaultCycleId),
          }));
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupConfig = async (gId: number) => {
    try {
      setLoadingConfig(true);
      const config = await getGroupConfig(gId);
      console.log('Loaded config from server:', config);
      console.log('Group overrides from server:', config.group_overrides);
      setGroupConfig(config);
      
      // Establecer valores de override
      setConfigOverrides({
        use_custom_config: config.use_custom_config,
        office_version_override: config.group_overrides.office_version_override || null,
        enable_tier_basic_override: config.group_overrides.enable_tier_basic_override ?? null,
        enable_tier_standard_override: config.group_overrides.enable_tier_standard_override ?? null,
        enable_tier_advanced_override: config.group_overrides.enable_tier_advanced_override ?? null,
        enable_digital_badge_override: config.group_overrides.enable_digital_badge_override ?? null,
        enable_partial_evaluations_override: config.group_overrides.enable_partial_evaluations_override ?? null,
        enable_unscheduled_partials_override: config.group_overrides.enable_unscheduled_partials_override ?? null,
        enable_virtual_machines_override: config.group_overrides.enable_virtual_machines_override ?? null,
        enable_online_payments_override: config.group_overrides.enable_online_payments_override ?? null,
        certification_cost_override: config.group_overrides.certification_cost_override ?? null,
        retake_cost_override: config.group_overrides.retake_cost_override ?? null,
        group_start_date: config.group_overrides.group_start_date || null,
        group_end_date: config.group_overrides.group_end_date || null,
      });
    } catch (err: any) {
      console.error('Error loading group config:', err);
      // No mostrar error crítico, solo log - la config podría no existir aún
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('El nombre del grupo es obligatorio');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      if (isEditing && groupId) {
        await updateGroup(Number(groupId), formData);
        navigate(`/partners/groups/${groupId}`);
      } else if (campusId) {
        const newGroup = await createGroup(Number(campusId), formData);
        navigate(`/partners/groups/${newGroup.id}?created=true`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar el grupo');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!groupId) return;
    
    try {
      setSavingConfig(true);
      setError(null);
      
      console.log('Saving config:', configOverrides);
      await updateGroupConfig(Number(groupId), configOverrides);
      setSuccessMessage('Configuración guardada exitosamente');
      setConfigChanged(false);
      
      // Recargar configuración
      await loadGroupConfig(Number(groupId));
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar configuración');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleResetConfig = async () => {
    if (!groupId) return;
    if (!confirm('¿Estás seguro de restablecer la configuración a los valores del plantel?')) return;
    
    try {
      setSavingConfig(true);
      setError(null);
      
      await resetGroupConfig(Number(groupId));
      setSuccessMessage('Configuración restablecida a valores del plantel');
      setConfigChanged(false);
      
      // Recargar configuración
      await loadGroupConfig(Number(groupId));
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al restablecer configuración');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleConfigChange = (field: string, value: any) => {
    console.log('handleConfigChange:', { field, value, type: typeof value });
    setConfigOverrides(prev => ({ ...prev, [field]: value }));
    setConfigChanged(true);
  };

  // Componente de select para funcionalidades y niveles de certificación
  const ConfigSelect = ({ 
    field, 
    label, 
    icon: Icon,
    description 
  }: { 
    field: keyof typeof configOverrides;
    label: string;
    icon: React.ComponentType<any>;
    description?: string;
  }) => {
    const overrideKey = field as keyof typeof configOverrides;
    const campusKey = field.replace('_override', '') as keyof NonNullable<typeof groupConfig>['campus_config'];
    const currentValue = configOverrides[overrideKey];
    const campusValue = groupConfig?.campus_config[campusKey];
    
    // Determinar el valor del select: "inherited", "enabled", "disabled"
    const selectValue = currentValue === null ? 'inherited' : (currentValue ? 'enabled' : 'disabled');
    
    const handleSelectChange = (value: string) => {
      if (value === 'inherited') {
        handleConfigChange(overrideKey, null);
      } else {
        handleConfigChange(overrideKey, value === 'enabled');
      }
    };
    
    return (
      <div className={`flex items-center fluid-gap-3 fluid-p-3 rounded-fluid-lg transition-all duration-300 ease-in-out ${
        selectValue === 'inherited'
          ? 'bg-blue-50 border border-blue-200'
          : selectValue === 'enabled'
            ? 'bg-green-50 border border-green-200'
            : 'bg-gray-100 border border-gray-200'
      }`}>
        <div className={`fluid-p-2 rounded-fluid-lg transition-all duration-300 ease-in-out ${
          selectValue === 'inherited' 
            ? (campusValue ? 'bg-blue-100 text-blue-600 scale-100' : 'bg-gray-200 text-gray-400 scale-100')
            : (selectValue === 'enabled' ? 'bg-green-100 text-green-600 scale-110' : 'bg-gray-200 text-gray-400 scale-95')
        }`}>
          <Icon className="fluid-icon-base" />
        </div>
        <div className="flex-1 min-w-0">
          <span className={`font-medium fluid-text-sm transition-colors duration-300 ${
            selectValue === 'enabled' ? 'text-green-800' : selectValue === 'disabled' ? 'text-gray-500' : 'text-gray-800'
          }`}>{label}</span>
          {description && (
            <p className="fluid-text-xs text-gray-500">{description}</p>
          )}
        </div>
        <select
          value={selectValue}
          onChange={(e) => handleSelectChange(e.target.value)}
          className={`fluid-px-3 fluid-py-2 border rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-500 min-w-[140px] cursor-pointer transition-all duration-300 ease-in-out transform hover:scale-105 ${
            selectValue === 'inherited' 
              ? 'border-blue-300 bg-white text-blue-700 shadow-sm'
              : selectValue === 'enabled'
                ? 'border-green-400 bg-green-100 text-green-800 shadow-md'
                : 'border-gray-300 bg-gray-50 text-gray-600'
          }`}
        >
          <option value="inherited">Heredado {campusValue ? '(Sí)' : '(No)'}</option>
          <option value="enabled">✓ Habilitado</option>
          <option value="disabled">✗ Deshabilitado</option>
        </select>
      </div>
    );
  };

  // Componente de solo lectura para configuraciones no editables
  const ConfigReadOnly = ({ 
    label, 
    icon: Icon,
    value,
    description 
  }: { 
    label: string;
    icon: React.ComponentType<any>;
    value: boolean;
    description?: string;
  }) => {
    return (
      <div className="flex items-center fluid-gap-3 fluid-p-3 rounded-fluid-lg bg-gray-100 opacity-75">
        <div className={`fluid-p-2 rounded-fluid-lg ${value ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
          <Icon className="fluid-icon-base" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-600 fluid-text-sm">{label}</span>
          {description && (
            <p className="fluid-text-xs text-gray-400">{description}</p>
          )}
        </div>
        <div className="fluid-px-3 fluid-py-2 bg-gray-200 text-gray-500 rounded-fluid-lg fluid-text-sm min-w-[140px] text-center cursor-not-allowed">
          {value ? 'Siempre Activo' : 'Inactivo'}
        </div>
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

  if (!campus && !isEditing) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700 fluid-text-base">Plantel no encontrado</p>
          <Link to="/partners" className="ml-auto text-red-700 underline fluid-text-base">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb 
        items={isEditing 
          ? [
              { label: campus?.partner?.name || 'Partner', path: `/partners/${campus?.partner_id}` },
              { label: campus?.name || 'Plantel', path: `/partners/campuses/${campusId}` },
              { label: formData.name || 'Grupo', path: `/partners/groups/${groupId}` },
              { label: 'Editar' }
            ]
          : [
              { label: campus?.partner?.name || 'Partner', path: `/partners/${campus?.partner_id}` },
              { label: campus?.name || 'Plantel', path: `/partners/campuses/${campusId}` },
              { label: 'Nuevo Grupo' }
            ]
        } 
      />
      
      {/* Header */}
      <div className="flex items-center fluid-gap-5 fluid-mb-6">
        <Link
          to={isEditing ? `/partners/groups/${groupId}` : `/partners/campuses/${campusId}`}
          className="fluid-p-2 hover:bg-gray-100 rounded-fluid-xl transition-colors"
        >
          <ArrowLeft className="fluid-icon-lg text-gray-600" />
        </Link>
        <div>
          {campus && (
            <div className="flex items-center gap-2 fluid-text-base text-gray-500 mb-1">
              <Building2 className="fluid-icon-sm" />
              <span>{campus.name}</span>
            </div>
          )}
          <h1 className="fluid-text-3xl font-bold text-gray-800">
            {isEditing ? 'Configuración del Grupo' : 'Nuevo Grupo'}
          </h1>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="fluid-mb-6 bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600 flex-shrink-0" />
          <p className="text-red-700 fluid-text-base">{error}</p>
        </div>
      )}
      
      {successMessage && (
        <div className="fluid-mb-6 bg-green-50 border border-green-200 rounded-fluid-xl fluid-p-4 flex items-center fluid-gap-3">
          <CheckCircle2 className="fluid-icon-lg text-green-600 flex-shrink-0" />
          <p className="text-green-700 fluid-text-base">{successMessage}</p>
        </div>
      )}

      {/* Contenido principal */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
        <form onSubmit={handleSubmit}>
          {/* Información del Grupo */}
          <div className="fluid-mb-8">
            <div className="flex items-center justify-between fluid-mb-5">
              <h2 className="fluid-text-lg font-semibold text-gray-800 flex items-center fluid-gap-2">
                <Layers className="fluid-icon-lg text-blue-600" />
                Información del Grupo
              </h2>
              <div className="flex fluid-gap-3">
                <Link
                  to={isEditing ? `/partners/groups/${groupId}` : `/partners/campuses/${campusId}`}
                  className="inline-flex items-center justify-center fluid-px-5 fluid-py-2 border border-gray-300 text-gray-600 hover:bg-gray-100 rounded-fluid-lg font-medium fluid-text-sm transition-colors"
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-fluid-lg font-medium fluid-text-sm transition-colors"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Guardando...
                    </>
                  ) : (
                    isEditing ? 'Guardar Cambios' : 'Crear Grupo'
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 fluid-gap-5">
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                  Nombre del Grupo *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Grupo 2024-A"
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base"
                  required
                />
              </div>

              {cycles.length > 0 && (
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                    <GraduationCap className="inline fluid-icon-sm mr-1" />
                    Ciclo Escolar
                  </label>
                  <select
                    value={formData.school_cycle_id || ''}
                    onChange={(e) => setFormData({ ...formData, school_cycle_id: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base"
                  >
                    <option value="">Sin ciclo asignado</option>
                    {cycles.map((cycle) => (
                      <option key={cycle.id} value={cycle.id}>
                        {cycle.name} {cycle.is_current ? '(Actual)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="xl:col-span-2">
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                  <FileText className="inline fluid-icon-sm mr-1" />
                  Descripción
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción breve del grupo"
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base"
                />
              </div>
            </div>

          </div>

          {/* Configuración heredada (solo al editar) */}
          {isEditing && groupConfig && (
            <>
              <div className="border-t border-gray-200 fluid-my-8" />
              
              <div>
                <div className="flex items-center justify-between fluid-mb-5">
                  <h2 className="fluid-text-lg font-semibold text-gray-800 flex items-center fluid-gap-2">
                    <Settings className="fluid-icon-lg text-blue-600" />
                    Configuración Heredada del Plantel
                  </h2>
                  <button
                    type="button"
                    onClick={handleResetConfig}
                    disabled={savingConfig}
                    className="inline-flex items-center fluid-gap-2 fluid-px-3 fluid-py-2 fluid-text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-fluid-lg transition-colors"
                    title="Restablecer a valores del plantel"
                  >
                    <RefreshCw className="fluid-icon-sm" />
                    Restablecer
                  </button>
                </div>

                {/* Info */}
                <div className="flex items-start fluid-gap-3 fluid-p-4 fluid-mb-6 bg-blue-50 rounded-fluid-xl border border-blue-200">
                  <Info className="fluid-icon-lg text-blue-500 flex-shrink-0 fluid-mt-1" />
                  <div className="fluid-text-sm text-blue-700">
                    <p>Puedes personalizar opciones para este grupo. Los valores marcados con <span className="fluid-px-2 fluid-py-1 bg-blue-100 text-blue-600 rounded-fluid fluid-text-xs font-medium">H</span> heredan la configuración de <strong>{groupConfig.campus_name}</strong>.</p>
                  </div>
                </div>

                {/* Advertencias de candidatos sin CURP o Email */}
                {groupConfig.warnings && groupConfig.warnings.length > 0 && (
                  <div className="fluid-space-y-4 fluid-mb-6">
                    {groupConfig.warnings.map((warning, idx) => (
                      <div key={idx} className="flex items-start fluid-gap-3 fluid-p-4 bg-amber-50 rounded-fluid-xl border border-amber-200">
                        <AlertCircle className="fluid-icon-lg text-amber-500 flex-shrink-0 fluid-mt-1" />
                        <div className="fluid-text-sm text-amber-700">
                          <p className="font-medium fluid-mb-2">{warning.message}</p>
                          <p className="fluid-text-xs text-amber-600">
                            Candidatos afectados: {warning.affected_members.map(m => `${m.name} ${m.first_surname}`).join(', ')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {loadingConfig ? (
                  <div className="py-8 text-center">
                    <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto" />
                    <p className="text-gray-500 mt-2">Cargando configuración...</p>
                  </div>
                ) : (
                  <div className="fluid-space-y-6">
                    {/* Primera fila: Opciones generales y Costos */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 fluid-gap-4">
                      {/* Versión de Office */}
                      <div className="fluid-p-4 rounded-fluid-xl bg-gray-50">
                        <div className="flex items-center fluid-gap-3 fluid-mb-3">
                          <div className="fluid-p-2 rounded-fluid-lg bg-blue-100 text-blue-600">
                            <Monitor className="fluid-icon-base" />
                          </div>
                          <span className="font-medium text-gray-800 fluid-text-sm">Versión de Office</span>
                          {!configOverrides.office_version_override && (
                            <span className="fluid-text-xs fluid-px-2 fluid-py-1 bg-blue-100 text-blue-600 rounded-fluid">H</span>
                          )}
                        </div>
                        <select
                          value={configOverrides.office_version_override || groupConfig.campus_config.office_version}
                          onChange={(e) => handleConfigChange('office_version_override', e.target.value === groupConfig.campus_config.office_version ? null : e.target.value)}
                          className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="office_2016">Office 2016</option>
                          <option value="office_2019">Office 2019</option>
                          <option value="office_365">Office 365</option>
                        </select>
                      </div>

                      {/* Costo Certificación */}
                      <div className="fluid-p-4 rounded-fluid-xl bg-gray-50">
                        <div className="flex items-center fluid-gap-3 fluid-mb-3">
                          <div className="fluid-p-2 rounded-fluid-lg bg-green-100 text-green-600">
                            <DollarSign className="fluid-icon-base" />
                          </div>
                          <span className="font-medium text-gray-800 fluid-text-sm">Costo Certificación</span>
                          {configOverrides.certification_cost_override === null && (
                            <span className="fluid-text-xs fluid-px-2 fluid-py-1 bg-blue-100 text-blue-600 rounded-fluid">H</span>
                          )}
                        </div>
                        <div className="flex items-center fluid-gap-2">
                          <span className="text-gray-500">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={configOverrides.certification_cost_override ?? groupConfig.campus_config.certification_cost ?? ''}
                            onChange={(e) => handleConfigChange('certification_cost_override', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                          />
                        </div>
                      </div>

                      {/* Costo Retoma */}
                      <div className="fluid-p-4 rounded-fluid-xl bg-gray-50">
                        <div className="flex items-center fluid-gap-3 fluid-mb-3">
                          <div className="fluid-p-2 rounded-fluid-lg bg-blue-100 text-blue-600">
                            <DollarSign className="fluid-icon-base" />
                          </div>
                          <span className="font-medium text-gray-800 fluid-text-sm">Costo Retoma</span>
                          {configOverrides.retake_cost_override === null && (
                            <span className="fluid-text-xs fluid-px-2 fluid-py-1 bg-blue-100 text-blue-600 rounded-fluid">H</span>
                          )}
                        </div>
                        <div className="flex items-center fluid-gap-2">
                          <span className="text-gray-500">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={configOverrides.retake_cost_override ?? groupConfig.campus_config.retake_cost ?? ''}
                            onChange={(e) => handleConfigChange('retake_cost_override', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                          />
                        </div>
                      </div>

                      {/* Vigencia */}
                      <div className="fluid-p-4 rounded-fluid-xl bg-gray-50">
                        <div className="flex items-center fluid-gap-3 fluid-mb-3">
                          <div className="fluid-p-2 rounded-fluid-lg bg-purple-100 text-purple-600">
                            <Calendar className="fluid-icon-base" />
                          </div>
                          <span className="font-medium text-gray-800 fluid-text-sm">Vigencia</span>
                        </div>
                        <div className="grid grid-cols-2 fluid-gap-2">
                          <div>
                            <label className="block fluid-text-xs text-gray-500 fluid-mb-1">Inicio</label>
                            <DatePickerInput
                              value={configOverrides.group_start_date ? new Date(configOverrides.group_start_date + 'T00:00:00') : 
                                     groupConfig.campus_config.license_start_date ? new Date(groupConfig.campus_config.license_start_date + 'T00:00:00') : null}
                              onChange={(date) => handleConfigChange('group_start_date', date ? date.toISOString().split('T')[0] : null)}
                              placeholder="Fecha inicio"
                              colorScheme="green"
                            />
                          </div>
                          <div>
                            <label className="block fluid-text-xs text-gray-500 fluid-mb-1">Fin</label>
                            <DatePickerInput
                              value={configOverrides.group_end_date ? new Date(configOverrides.group_end_date + 'T00:00:00') : 
                                     groupConfig.campus_config.license_end_date ? new Date(groupConfig.campus_config.license_end_date + 'T00:00:00') : null}
                              onChange={(date) => handleConfigChange('group_end_date', date ? date.toISOString().split('T')[0] : null)}
                              placeholder="Fecha fin"
                              minDate={configOverrides.group_start_date ? new Date(configOverrides.group_start_date + 'T00:00:00') : null}
                              colorScheme="indigo"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Segunda fila: Niveles de Certificación y Funcionalidades */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6">
                      {/* Niveles de Certificación */}
                      <div className="fluid-p-4 rounded-fluid-xl bg-white border border-gray-200">
                        <h3 className="fluid-text-sm font-semibold text-gray-700 uppercase tracking-wide fluid-mb-4 flex items-center fluid-gap-2">
                          <Award className="fluid-icon-sm text-blue-600" />
                          Niveles de Certificación
                        </h3>
                        <div className="fluid-space-y-2">
                          <ConfigReadOnly 
                            label="Constancia de Evaluación" 
                            icon={Award} 
                            value={true}
                          />
                          <ConfigSelect field="enable_tier_standard_override" label="Certificado Eduit" icon={Award} />
                          <ConfigSelect field="enable_tier_advanced_override" label="Certificado CONOCER" icon={Shield} />
                          <ConfigSelect field="enable_digital_badge_override" label="Insignia Digital" icon={Zap} />
                        </div>
                      </div>

                      {/* Funcionalidades */}
                      <div className="fluid-p-4 rounded-fluid-xl bg-white border border-gray-200">
                        <h3 className="fluid-text-sm font-semibold text-gray-700 uppercase tracking-wide fluid-mb-4 flex items-center fluid-gap-2">
                          <Settings className="fluid-icon-sm text-blue-600" />
                          Funcionalidades
                        </h3>
                        <div className="fluid-space-y-2">
                          <ConfigSelect field="enable_partial_evaluations_override" label="Evaluaciones Parciales" icon={FileText} />
                          <ConfigSelect field="enable_unscheduled_partials_override" label="Parciales Sin Agendar" icon={Calendar} />
                          <ConfigSelect field="enable_virtual_machines_override" label="Calendario de Sesiones" icon={Calendar} />
                          <ConfigSelect field="enable_online_payments_override" label="Pagos en Línea" icon={CreditCard} />
                        </div>
                      </div>
                    </div>

                    {/* Botón guardar configuración */}
                    {configChanged && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleSaveConfig}
                          disabled={savingConfig}
                          className="inline-flex items-center justify-center fluid-gap-2 fluid-px-8 fluid-py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-fluid-xl font-semibold fluid-text-base transition-colors"
                        >
                          {savingConfig ? (
                            <>
                              <div className="animate-spin fluid-icon-lg border-2 border-white border-t-transparent rounded-full" />
                              Guardando...
                            </>
                          ) : (
                            <>
                              <Save className="fluid-icon-lg" />
                              Guardar Configuración
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
