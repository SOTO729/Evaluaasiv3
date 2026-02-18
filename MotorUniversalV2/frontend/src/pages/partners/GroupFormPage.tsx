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
  Lock,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import StyledSelect from '../../components/StyledSelect';
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
  const defaultCycleId = searchParams.get('cycleId') || searchParams.get('cycle');
  
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
    require_exam_pin_override: null as boolean | null,
    certification_cost_override: null as number | null,
    retake_cost_override: null as number | null,
    max_retakes_override: null as number | null,
    assignment_validity_months_override: null as number | null,
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
        
        // Si viene un ciclo por URL, usarlo; si no, seleccionar el más reciente
        if (defaultCycleId) {
          setFormData(prev => ({
            ...prev,
            school_cycle_id: parseInt(defaultCycleId),
          }));
        } else if (cyclesData.cycles.length > 0) {
          // Ordenar por created_at descendente y tomar el primero
          const sorted = [...cyclesData.cycles].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setFormData(prev => ({
            ...prev,
            school_cycle_id: sorted[0].id,
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
        require_exam_pin_override: config.group_overrides.require_exam_pin_override ?? null,
        certification_cost_override: config.group_overrides.certification_cost_override ?? null,
        retake_cost_override: config.group_overrides.retake_cost_override ?? null,
        max_retakes_override: (config.group_overrides as any).max_retakes_override ?? null,
        assignment_validity_months_override: config.group_overrides.assignment_validity_months_override ?? null,
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

    if (!formData.school_cycle_id) {
      setError('Debes seleccionar un ciclo escolar para el grupo');
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
      
      {/* Header con Gradiente */}
      <div className={`bg-gradient-to-r ${isEditing ? 'from-indigo-600 via-purple-600 to-blue-600' : 'from-blue-600 via-indigo-600 to-purple-600'} rounded-fluid-2xl fluid-p-6 fluid-mb-6 shadow-lg`}>
        <div className="flex items-center fluid-gap-5 flex-wrap">
          <Link
            to={isEditing ? `/partners/groups/${groupId}` : `/partners/campuses/${campusId}`}
            className="fluid-p-3 bg-white/20 hover:bg-white/30 rounded-fluid-xl transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="fluid-icon-lg text-white" />
          </Link>
          
          <div className="flex-1 min-w-0">
            {campus && (
              <div className="flex items-center fluid-gap-2 fluid-text-sm text-white/80 fluid-mb-1">
                <Building2 className="fluid-icon-sm" />
                <Link to={`/partners/campuses/${campusId}`} className="hover:text-white transition-colors">{campus.name}</Link>
              </div>
            )}
            <h1 className="fluid-text-3xl font-bold text-white flex items-center fluid-gap-3">
              <Layers className="fluid-icon-xl" />
              {isEditing ? 'Configuración del Grupo' : 'Nuevo Grupo'}
            </h1>
          </div>

          <div className="flex items-center fluid-gap-3">
            <Link
              to={isEditing ? `/partners/groups/${groupId}` : `/partners/campuses/${campusId}`}
              className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-3 bg-white/20 hover:bg-white/30 text-white rounded-fluid-xl font-medium fluid-text-base transition-all duration-300"
            >
              Cancelar
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                const form = document.getElementById('group-form') as HTMLFormElement;
                if (form) form.requestSubmit();
              }}
              disabled={saving}
              className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-3 bg-white hover:bg-gray-100 text-blue-600 rounded-fluid-xl font-semibold fluid-text-base transition-all duration-300 hover:scale-105 shadow-lg disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                  Guardando...
                </>
              ) : (
                <>
                  {isEditing ? 'Guardar Cambios' : 'Crear Grupo'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Error */}
      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setError(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">{error}</p>
              <button onClick={() => setError(null)} className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-6 rounded-xl transition-colors">Entendido</button>
            </div>
          </div>
        </div>
      )}
      
      {successMessage && (
        <div className="fluid-mb-6 bg-green-50 border border-green-200 rounded-fluid-xl fluid-p-4 flex items-center fluid-gap-3 animate-fade-in-up">
          <CheckCircle2 className="fluid-icon-lg text-green-600 flex-shrink-0" />
          <p className="text-green-700 fluid-text-base">{successMessage}</p>
        </div>
      )}

      {/* Formulario */}
      <form id="group-form" onSubmit={handleSubmit}>
        {/* Card: Información del Grupo */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-mb-6 hover:shadow-lg transition-all duration-300">
          <div className="fluid-p-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white rounded-t-fluid-2xl">
            <h2 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg">
                <Layers className="fluid-icon-base text-blue-600" />
              </div>
              Información del Grupo
            </h2>
          </div>
          <div className="fluid-p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 fluid-gap-6">
              {/* Nombre */}
              <div>
                <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2 flex items-center fluid-gap-2">
                  <Layers className="fluid-icon-sm text-blue-500" />
                  Nombre del Grupo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Grupo 2026-A"
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all"
                  required
                />
              </div>

              {/* Ciclo Escolar */}
              <div>
                <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2 flex items-center fluid-gap-2">
                  <GraduationCap className="fluid-icon-sm text-indigo-500" />
                  Ciclo Escolar <span className="text-red-500">*</span>
                </label>
                {cycles.length > 0 ? (
                  <StyledSelect
                    value={formData.school_cycle_id ? String(formData.school_cycle_id) : ''}
                    onChange={(val) => setFormData({ ...formData, school_cycle_id: val ? parseInt(val) : undefined })}
                    options={cycles.map((cycle) => ({
                      value: String(cycle.id),
                      label: cycle.name,
                    }))}
                    icon={GraduationCap}
                    colorScheme="indigo"
                    placeholder="Seleccionar ciclo"
                    required
                  />
                ) : (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-fluid-xl fluid-px-4 fluid-py-3 flex items-center fluid-gap-3">
                    <AlertCircle className="fluid-icon-base text-amber-500 flex-shrink-0" />
                    <div>
                      <p className="fluid-text-sm font-medium text-amber-800">No hay ciclos escolares</p>
                      <p className="fluid-text-xs text-amber-600">Debes crear un ciclo escolar en el plantel antes de crear un grupo.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2 flex items-center fluid-gap-2">
                  <FileText className="fluid-icon-sm text-gray-500" />
                  Descripción
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción breve del grupo (opcional)"
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card: Configuración heredada (solo al editar) */}
        {isEditing && groupConfig && (
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-mb-6 overflow-hidden hover:shadow-lg transition-all duration-300">
            <div className="fluid-p-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
              <div className="flex items-center justify-between">
                <h2 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-3">
                  <div className={`fluid-p-2 rounded-fluid-lg ${groupConfig.has_assignments ? 'bg-amber-100' : 'bg-purple-100'}`}>
                    {groupConfig.has_assignments
                      ? <Lock className="fluid-icon-base text-amber-600" />
                      : <Settings className="fluid-icon-base text-purple-600" />}
                  </div>
                  Configuración Heredada del Plantel
                  {groupConfig.has_assignments && (
                    <span className="fluid-text-xs fluid-px-2 fluid-py-1 bg-amber-100 text-amber-700 rounded-full font-medium">Bloqueada</span>
                  )}
                </h2>
                {!groupConfig.has_assignments && (
                  <button
                    type="button"
                    onClick={handleResetConfig}
                    disabled={savingConfig}
                    className="inline-flex items-center fluid-gap-2 fluid-px-3 fluid-py-2 fluid-text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-fluid-lg transition-colors"
                    title="Restablecer a valores del plantel"
                  >
                    <RefreshCw className="fluid-icon-sm" />
                    Restablecer
                  </button>
                )}
              </div>
            </div>
            <div className="fluid-p-6">

                {/* Aviso de configuración bloqueada */}
                {groupConfig.has_assignments && (
                  <div className="flex items-start fluid-gap-3 fluid-p-4 fluid-mb-6 bg-amber-50 rounded-fluid-xl border border-amber-300">
                    <Lock className="fluid-icon-lg text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="fluid-text-sm text-amber-800">
                      <p className="font-semibold fluid-mb-1">Configuración bloqueada</p>
                      <p>Este grupo ya tiene <strong>{groupConfig.assignment_count} certificación(es) asignada(s)</strong>. La configuración no se puede modificar una vez que existen asignaciones. Si necesitas cambiar la configuración, contacta al administrador.</p>
                    </div>
                  </div>
                )}

                {/* Info */}
                {!groupConfig.has_assignments && (
                  <div className="flex items-start fluid-gap-3 fluid-p-4 fluid-mb-6 bg-blue-50 rounded-fluid-xl border border-blue-200">
                    <Info className="fluid-icon-lg text-blue-500 flex-shrink-0 fluid-mt-1" />
                    <div className="fluid-text-sm text-blue-700">
                      <p>Puedes personalizar opciones para este grupo. Los valores marcados con <span className="fluid-px-2 fluid-py-1 bg-blue-100 text-blue-600 rounded-fluid fluid-text-xs font-medium">H</span> heredan la configuración de <strong>{groupConfig.campus_name}</strong>.</p>
                    </div>
                  </div>
                )}

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
                  <div className={`fluid-space-y-6 ${groupConfig.has_assignments ? 'pointer-events-none opacity-60 select-none' : ''}`}>
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

                      {/* Máx. Retomas */}
                      <div className="fluid-p-4 rounded-fluid-xl bg-gray-50">
                        <div className="flex items-center fluid-gap-3 fluid-mb-3">
                          <div className="fluid-p-2 rounded-fluid-lg bg-purple-100 text-purple-600">
                            <RefreshCw className="fluid-icon-base" />
                          </div>
                          <span className="font-medium text-gray-800 fluid-text-sm">Máx. Retomas por Asignación</span>
                          {configOverrides.max_retakes_override === null && (
                            <span className="fluid-text-xs fluid-px-2 fluid-py-1 bg-blue-100 text-blue-600 rounded-fluid">H</span>
                          )}
                        </div>
                        <p className="fluid-text-xs text-gray-500 fluid-mb-2">
                          Número máximo de retomas permitidas por candidato.
                          {(groupConfig?.campus_config as any)?.max_retakes != null && (
                            <span className="text-purple-600 font-medium"> (Campus: {(groupConfig.campus_config as any).max_retakes})</span>
                          )}
                        </p>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={configOverrides.max_retakes_override ?? (groupConfig?.campus_config as any)?.max_retakes ?? 1}
                          onChange={(e) => handleConfigChange('max_retakes_override', e.target.value ? parseInt(e.target.value, 10) : null)}
                          className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                        />
                      </div>

                      {/* Vigencia de Asignaciones */}
                      <div className="fluid-p-4 rounded-fluid-xl bg-gray-50">
                        <div className="flex items-center fluid-gap-3 fluid-mb-3">
                          <div className="fluid-p-2 rounded-fluid-lg bg-purple-100 text-purple-600">
                            <Calendar className="fluid-icon-base" />
                          </div>
                          <span className="font-medium text-gray-800 fluid-text-sm">Vigencia de Asignaciones</span>
                        </div>
                        <p className="fluid-text-xs text-gray-500 fluid-mb-2">
                          Meses que tiene un candidato para aprovechar materiales y exámenes tras una asignación.
                          {groupConfig?.campus_config?.assignment_validity_months && (
                            <span className="text-purple-600 font-medium"> (Campus: {groupConfig.campus_config.assignment_validity_months} meses)</span>
                          )}
                        </p>
                        <div className="flex items-center gap-0 border border-gray-300 rounded-fluid-lg overflow-hidden bg-white shadow-sm">
                          <button
                            type="button"
                            onClick={() => {
                              const current = configOverrides.assignment_validity_months_override ?? groupConfig?.campus_config?.assignment_validity_months ?? 12;
                              handleConfigChange('assignment_validity_months_override', Math.max(1, current - 1));
                            }}
                            className="flex items-center justify-center w-11 h-10 bg-gray-50 hover:bg-purple-50 text-gray-500 hover:text-purple-600 transition-colors border-r border-gray-300 text-lg font-bold select-none active:bg-purple-100"
                          >
                            −
                          </button>
                          <div className="flex-1 flex items-center justify-center h-10 px-3">
                            <input
                              type="number"
                              min="1"
                              max="120"
                              value={configOverrides.assignment_validity_months_override ?? groupConfig?.campus_config?.assignment_validity_months ?? ''}
                              onChange={(e) => handleConfigChange('assignment_validity_months_override', e.target.value ? Math.min(120, Math.max(1, parseInt(e.target.value))) : null)}
                              placeholder={String(groupConfig?.campus_config?.assignment_validity_months || 12)}
                              className="w-full text-center font-semibold text-gray-800 border-none focus:ring-0 focus:outline-none p-0 fluid-text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const current = configOverrides.assignment_validity_months_override ?? groupConfig?.campus_config?.assignment_validity_months ?? 12;
                              handleConfigChange('assignment_validity_months_override', Math.min(120, current + 1));
                            }}
                            className="flex items-center justify-center w-11 h-10 bg-gray-50 hover:bg-purple-50 text-gray-500 hover:text-purple-600 transition-colors border-l border-gray-300 text-lg font-bold select-none active:bg-purple-100"
                          >
                            +
                          </button>
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
                          <ConfigSelect field="enable_tier_basic_override" label="Constancia de Evaluación" icon={Award} />
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
                          <ConfigSelect field="require_exam_pin_override" label="PIN de Examen" icon={Lock} />
                        </div>
                      </div>
                    </div>

                    {/* Botón guardar configuración */}
                    {configChanged && !groupConfig.has_assignments && (
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
          </div>
        )}
      </form>
    </div>
  );
}
