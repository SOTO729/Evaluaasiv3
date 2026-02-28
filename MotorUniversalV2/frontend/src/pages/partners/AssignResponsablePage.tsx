/**
 * Asignar Responsable a un Plantel (Campus) ya activado
 * Basado en el Paso 1 de CampusActivationPage
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  UserCog,
  CheckCircle2,
  AlertCircle,
  Shield,
  Users,
  User,
  Mail,
  Copy,
  Eye,
  EyeOff,
  Calendar,
  UserPlus,
  UserCheck,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import DatePickerInput from '../../components/DatePickerInput';
import StyledSelect from '../../components/StyledSelect';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import {
  getCampus,
  Campus,
  CampusResponsable,
  CreateResponsableData,
  createCampusResponsable,
  getAvailableResponsables,
  assignExistingResponsable,
  AvailableResponsable,
} from '../../services/partnersService';

// CURP genérica para planteles en el extranjero
const FOREIGN_CURP_MALE = 'XEXX010101HNEXXXA4';
const FOREIGN_CURP_FEMALE = 'XEXX010101MNEXXXA8';
const getForeignCurp = (gender: string) => gender === 'M' ? FOREIGN_CURP_MALE : FOREIGN_CURP_FEMALE;

export default function AssignResponsablePage() {
  const { campusId } = useParams();

  const [campus, setCampus] = useState<Campus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulario
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [createdResponsable, setCreatedResponsable] = useState<CampusResponsable | null>(null);

  // Modo: existente o crear
  const [assignMode, setAssignMode] = useState<'create' | 'existing'>('existing');
  const [availableResponsables, setAvailableResponsables] = useState<AvailableResponsable[]>([]);
  const [loadingResponsables, setLoadingResponsables] = useState(false);
  const [selectedResponsableId, setSelectedResponsableId] = useState<string | null>(null);
  const [assignPerms, setAssignPerms] = useState({ can_bulk_create_candidates: false, can_manage_groups: false, can_view_reports: true });

  const [formData, setFormData] = useState<CreateResponsableData>({
    name: '',
    first_surname: '',
    second_surname: '',
    email: '',
    curp: '',
    gender: 'M',
    date_of_birth: '',
    can_bulk_create_candidates: false,
    can_manage_groups: false,
    can_view_reports: true,
  });

  const isForeign = campus?.country !== 'México';

  useEffect(() => { loadCampus(); }, [campusId]);
  useEffect(() => { if (campusId) loadAvailableResponsables(); }, [campusId]);

  useEffect(() => {
    if (isForeign && formData.gender) {
      setFormData(prev => ({ ...prev, curp: getForeignCurp(prev.gender) }));
    }
  }, [isForeign, formData.gender]);

  const loadCampus = async () => {
    try {
      setLoading(true);
      const data = await getCampus(Number(campusId));
      setCampus(data);
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
      if (result.available_responsables.length > 0) {
        const director = result.available_responsables.find(r => r.is_director);
        if (director) setSelectedResponsableId(director.id);
      }
    } catch (err: any) {
      console.error('Error loading responsables:', err);
    } finally {
      setLoadingResponsables(false);
    }
  };

  const handleAssignExisting = async () => {
    if (!selectedResponsableId) { setFormError('Debe seleccionar un responsable'); return; }
    try {
      setIsSubmitting(true);
      setFormError(null);
      const result = await assignExistingResponsable(Number(campusId), {
        responsable_id: selectedResponsableId,
        ...assignPerms,
      });
      setCreatedResponsable({ ...result.responsable, temporary_password: undefined });
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Error al asignar el responsable');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const processedValue = name === 'curp' ? value.toUpperCase() : value;
    setFormData(prev => ({ ...prev, [name]: processedValue }));
    if (formError) setFormError(null);
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'El nombre es requerido';
    if (!formData.first_surname.trim()) return 'El apellido paterno es requerido';
    if (!formData.second_surname.trim()) return 'El apellido materno es requerido';
    if (!formData.email.trim()) return 'El correo electrónico es requerido';
    if (!isForeign && !formData.curp.trim()) return 'El CURP es requerido';
    if (!formData.date_of_birth) return 'La fecha de nacimiento es requerida';
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(formData.email)) return 'Formato de correo inválido';
    if (!isForeign) {
      const curpPattern = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$/;
      if (!curpPattern.test(formData.curp)) return 'Formato de CURP inválido (18 caracteres)';
    }
    return null;
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateForm();
    if (v) { setFormError(v); return; }
    try {
      setIsSubmitting(true);
      setFormError(null);
      const result = await createCampusResponsable(Number(campusId), { ...formData, replace_existing: true });
      setCreatedResponsable(result.responsable);
    } catch (err: any) {
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

  if (loading) return <div className="fluid-p-6 max-w-[2800px] mx-auto"><LoadingSpinner message="Cargando plantel..." /></div>;

  if (error || !campus) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-2xl fluid-p-6 flex items-center fluid-gap-4">
          <AlertCircle className="fluid-icon-xl text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="fluid-text-lg font-semibold text-red-800">Error</p>
            <p className="fluid-text-base text-red-700">{error || 'Plantel no encontrado'}</p>
          </div>
          <Link to={`/partners/campuses/${campusId}`} className="fluid-px-4 fluid-py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-fluid-xl fluid-text-base font-medium transition-colors">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-3xl mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb
        items={[
          { label: campus.partner?.name || 'Partner', path: `/partners/${campus.partner_id}` },
          { label: campus.name, path: `/partners/campuses/${campusId}` },
          { label: 'Asignar Responsable' },
        ]}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 shadow-lg">
        <div className="flex items-center fluid-gap-4">
          <Link to={`/partners/campuses/${campusId}`} className="fluid-p-3 bg-white/20 hover:bg-white/30 rounded-fluid-xl transition-all">
            <ArrowLeft className="fluid-icon-lg text-white" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="fluid-text-2xl font-bold text-white">Asignar Responsable</h1>
            <p className="fluid-text-sm text-white/80 fluid-mt-1">{campus.name}</p>
          </div>
        </div>
      </div>

      {/* Success - Responsable asignado */}
      {createdResponsable ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-4 text-white rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-base">
                  {createdResponsable.temporary_password ? '¡Responsable Creado Exitosamente!' : '¡Responsable Asignado Exitosamente!'}
                </h2>
                <p className="text-green-100 text-sm">
                  {createdResponsable.temporary_password ? 'Guarda las credenciales de acceso' : 'El responsable ya tiene credenciales existentes'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
                <UserCog className="w-7 h-7 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-lg">{createdResponsable.full_name}</p>
                <p className="text-gray-500">{createdResponsable.email}</p>
              </div>
            </div>

            {createdResponsable.temporary_password && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Credenciales de acceso</p>
                    <p className="text-sm text-amber-700 mt-1">Guarda esta información, la contraseña solo se muestra una vez</p>
                  </div>
                </div>
                <div className="space-y-3 bg-white/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium">ID de Usuario</p>
                      <p className="font-mono text-lg font-bold text-gray-800">{createdResponsable.username}</p>
                    </div>
                    <button onClick={() => copyToClipboard(createdResponsable.username || '', 'username')} className="p-2 hover:bg-white rounded-lg transition-colors">
                      {copiedField === 'username' ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-gray-400" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium">Contraseña Temporal</p>
                      <p className="font-mono text-lg font-bold text-gray-800">{showPassword ? createdResponsable.temporary_password : '••••••••'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setShowPassword(!showPassword)} className="p-2 hover:bg-white rounded-lg transition-colors">
                        {showPassword ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                      </button>
                      <button onClick={() => copyToClipboard(createdResponsable.temporary_password || '', 'password')} className="p-2 hover:bg-white rounded-lg transition-colors">
                        {copiedField === 'password' ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-gray-400" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!createdResponsable.temporary_password && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <UserCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800">Responsable existente asignado</p>
                    <p className="text-sm text-blue-700 mt-1">Este responsable ya tiene credenciales de acceso.</p>
                    <p className="text-sm text-blue-600 mt-2 font-mono">Usuario: {createdResponsable.username}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <Link
                to={`/partners/campuses/${campusId}`}
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Volver al Plantel
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Formulario de asignación */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <UserCog className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Asignar Responsable del Plantel</h2>
                <p className="text-blue-100 text-sm">Cree un nuevo responsable o asigne uno existente del mismo partner</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button type="button" onClick={() => setAssignMode('existing')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${assignMode === 'existing' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                <UserCheck className="w-4 h-4" /> Seleccionar Existente
              </button>
              <button type="button" onClick={() => setAssignMode('create')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${assignMode === 'create' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                <UserPlus className="w-4 h-4" /> Crear Nuevo
              </button>
            </div>
          </div>

          {/* Error modal */}
          {formError && createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setFormError(null)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="w-7 h-7 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Error</h3>
                    <p className="text-sm text-gray-600">{formError}</p>
                  </div>
                  <button onClick={() => setFormError(null)} className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-6 rounded-xl transition-colors">
                    Entendido
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Modo: Existente */}
          {assignMode === 'existing' && (
            <div className="p-6 space-y-6">
              {loadingResponsables ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                  <span className="ml-3 text-gray-500">Cargando responsables disponibles...</span>
                </div>
              ) : availableResponsables.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-base font-medium">No hay responsables disponibles</p>
                  <p className="text-gray-400 text-sm mt-2">Cree uno nuevo usando la pestaña "Crear Nuevo".</p>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Seleccione un responsable ({availableResponsables.length} disponibles)
                    </h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto overscroll-contain">
                      {availableResponsables.map((resp) => (
                        <label key={resp.id}
                          className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${selectedResponsableId === resp.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:bg-gray-50'}`}>
                          <input type="radio" name="selectedResponsable" value={resp.id} checked={selectedResponsableId === resp.id}
                            onChange={() => setSelectedResponsableId(resp.id)} className="w-5 h-5 text-blue-600" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">{resp.full_name}</p>
                            <p className="text-sm text-gray-500">{resp.email}</p>
                            {resp.curp && <p className="text-xs text-gray-400 font-mono mt-1">{resp.curp}</p>}
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            {resp.is_director && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">Director</span>}
                            {resp.is_current && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Actual</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Permisos */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Permisos del Responsable
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div><span className="font-medium text-gray-800">Altas masivas de candidatos</span><p className="text-sm text-gray-500">Importar archivos con múltiples candidatos</p></div>
                        <ToggleSwitch checked={assignPerms.can_bulk_create_candidates} onChange={(v) => setAssignPerms(p => ({ ...p, can_bulk_create_candidates: v }))} colorScheme="blue" />
                      </div>
                      <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div><span className="font-medium text-gray-800">Gestión de grupos</span><p className="text-sm text-gray-500">Crear grupos y asignar exámenes/materiales</p></div>
                        <ToggleSwitch checked={assignPerms.can_manage_groups} onChange={(v) => setAssignPerms(p => ({ ...p, can_manage_groups: v }))} colorScheme="blue" />
                      </div>
                      <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div><span className="font-medium text-gray-800">Ver Reportes</span><p className="text-sm text-gray-500">Acceder a reportes de evaluación</p></div>
                        <ToggleSwitch checked={assignPerms.can_view_reports} onChange={(v) => setAssignPerms(p => ({ ...p, can_view_reports: v }))} colorScheme="blue" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <button type="button" onClick={handleAssignExisting} disabled={isSubmitting || !selectedResponsableId}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {isSubmitting ? (
                        <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Asignando...</>
                      ) : (
                        <><UserCheck className="w-5 h-5" /> Asignar Responsable Seleccionado</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Modo: Crear nuevo */}
          {assignMode === 'create' && (
            <form onSubmit={handleSubmitCreate} className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><User className="w-4 h-4" /> Datos Personales</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre(s) <span className="text-red-500">*</span></label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Ej: Juan Carlos" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Apellido Paterno <span className="text-red-500">*</span></label>
                    <input type="text" name="first_surname" value={formData.first_surname} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Ej: García" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Apellido Materno <span className="text-red-500">*</span></label>
                    <input type="text" name="second_surname" value={formData.second_surname} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Ej: López" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2"><User className="w-4 h-4 text-purple-500" /> Género <span className="text-red-500">*</span></label>
                    <StyledSelect name="gender" value={formData.gender}
                      onChange={(value) => setFormData(prev => ({ ...prev, gender: value as 'M' | 'F' | 'O' }))}
                      options={[{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }, { value: 'O', label: 'Otro' }]}
                      icon={User} colorScheme="purple" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-500" /> Fecha de Nacimiento <span className="text-red-500">*</span></label>
                    <DatePickerInput
                      value={formData.date_of_birth ? new Date(formData.date_of_birth + 'T00:00:00') : null}
                      onChange={(date) => setFormData(prev => ({ ...prev, date_of_birth: date ? date.toISOString().split('T')[0] : '' }))}
                      placeholder="Seleccionar fecha" maxDate={new Date()} colorScheme="blue" />
                    {formData.date_of_birth && (
                      <p className="text-xs text-blue-600 mt-1 font-medium">
                        {new Date(formData.date_of_birth + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CURP {!isForeign && <span className="text-red-500">*</span>}</label>
                    <input type="text" name="curp" value={formData.curp} onChange={isForeign ? undefined : handleChange}
                      readOnly={isForeign} maxLength={18}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-mono ${isForeign ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      placeholder="GARL850101HDFRRL09" />
                    {isForeign
                      ? <p className="text-xs text-amber-600 mt-1">CURP asignada automáticamente (extranjero)</p>
                      : <p className="text-xs text-gray-500 mt-1">{formData.curp.length}/18 caracteres</p>
                    }
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Mail className="w-4 h-4" /> Contacto</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico <span className="text-red-500">*</span></label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="responsable@ejemplo.com" />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Shield className="w-4 h-4" /> Permisos del Responsable</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div><span className="font-medium text-gray-800">Altas masivas de candidatos</span><p className="text-sm text-gray-500">Importar archivos con múltiples candidatos</p></div>
                    <ToggleSwitch checked={formData.can_bulk_create_candidates} onChange={(v) => setFormData(p => ({ ...p, can_bulk_create_candidates: v }))} colorScheme="blue" />
                  </div>
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div><span className="font-medium text-gray-800">Gestión de grupos</span><p className="text-sm text-gray-500">Crear grupos y asignar exámenes/materiales</p></div>
                    <ToggleSwitch checked={formData.can_manage_groups} onChange={(v) => setFormData(p => ({ ...p, can_manage_groups: v }))} colorScheme="blue" />
                  </div>
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div><span className="font-medium text-gray-800">Ver Reportes</span><p className="text-sm text-gray-500">Acceder a reportes de evaluación</p></div>
                    <ToggleSwitch checked={formData.can_view_reports} onChange={(v) => setFormData(p => ({ ...p, can_view_reports: v }))} colorScheme="blue" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <button type="submit" disabled={isSubmitting}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creando responsable...</>
                  ) : (
                    <><UserCog className="w-5 h-5" /> Crear Responsable</>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
