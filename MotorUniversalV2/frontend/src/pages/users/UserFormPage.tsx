/**
 * Página para crear o editar usuarios
 * Flujo UX mejorado: primero seleccionar tipo de usuario, luego mostrar campos relevantes
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Users,
  Save,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Building2,
  Key,
  Copy,
  Eye,
  EyeOff,
  Shield,
  User,
  AlertTriangle,
  X,
  GraduationCap,
  UserCog,
  Briefcase,
  PenTool,
  Pencil,
  HeadphonesIcon,
  DollarSign,
  BarChart3,
  UserCheck,
  ArrowRight,
  RotateCcw,
  Lock,
  MapPin,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import StyledSelect from '../../components/StyledSelect';
import DatePickerInput from '../../components/DatePickerInput';
import {
  getUser,
  createUser,
  updateUser,
  getAvailableRoles,
  getAvailableCampuses,
  getAvailablePartners,
  getAvailableCoordinators,
  getAvailableStates,
  checkNameSimilarity,
  validateCurpRenapo,
  CreateUserData,
  UpdateUserData,
  RoleOption,
  AvailableCampus,
  AvailablePartner,
  AvailableCoordinator,
  SimilarUser,
  CurpValidationResult,
} from '../../services/userManagementService';
import { useAuthStore } from '../../store/authStore';
import CurpVerificationBadge from '../../components/users/CurpVerificationBadge';
import CurpValidationSpinner from '../../components/users/CurpValidationSpinner';
import CurpValidationResultDisplay from '../../components/users/CurpValidationResult';

// ─── Configuración visual de roles ─────────────────────────────────────────
interface RoleCardConfig {
  icon: React.ElementType;
  gradient: string;
  ring: string;
  description: string;
  shortDesc: string;
}

const ROLE_CONFIG: Record<string, RoleCardConfig> = {
  candidato: {
    icon: GraduationCap,
    gradient: 'from-emerald-500 to-teal-600',
    ring: 'ring-emerald-500',
    description: 'Persona que realiza evaluaciones y obtiene certificaciones.',
    shortDesc: 'Realiza evaluaciones',
  },
  responsable: {
    icon: UserCog,
    gradient: 'from-blue-500 to-indigo-600',
    ring: 'ring-blue-500',
    description: 'Coordinador de plantel que gestiona candidatos y grupos.',
    shortDesc: 'Gestiona un plantel',
  },
  responsable_partner: {
    icon: Briefcase,
    gradient: 'from-violet-500 to-purple-600',
    ring: 'ring-violet-500',
    description: 'Administrador de un partner/institución y sus planteles.',
    shortDesc: 'Supervisa un partner',
  },
  responsable_estatal: {
    icon: MapPin,
    gradient: 'from-pink-500 to-rose-600',
    ring: 'ring-pink-500',
    description: 'Administrador de un estado con alcance a los planteles de esa región.',
    shortDesc: 'Supervisa un estado',
  },
  editor: {
    icon: PenTool,
    gradient: 'from-amber-500 to-orange-600',
    ring: 'ring-amber-500',
    description: 'Crea y edita contenido de exámenes y materiales de estudio.',
    shortDesc: 'Crea contenido',
  },
  editor_invitado: {
    icon: Pencil,
    gradient: 'from-orange-400 to-amber-500',
    ring: 'ring-orange-400',
    description: 'Editor con acceso temporal y contenido aislado.',
    shortDesc: 'Acceso temporal',
  },
  gerente: {
    icon: BarChart3,
    gradient: 'from-rose-500 to-pink-600',
    ring: 'ring-rose-500',
    description: 'Supervisa operaciones generales y aprobación de procesos.',
    shortDesc: 'Supervisión general',
  },
  financiero: {
    icon: DollarSign,
    gradient: 'from-cyan-500 to-sky-600',
    ring: 'ring-cyan-500',
    description: 'Gestiona saldos, transacciones y aprobaciones financieras.',
    shortDesc: 'Gestión financiera',
  },
  soporte: {
    icon: HeadphonesIcon,
    gradient: 'from-teal-500 to-emerald-600',
    ring: 'ring-teal-500',
    description: 'Atención a usuarios, vouchers y soporte técnico.',
    shortDesc: 'Atención a usuarios',
  },
  coordinator: {
    icon: Shield,
    gradient: 'from-indigo-500 to-blue-600',
    ring: 'ring-indigo-500',
    description: 'Gestión de partners, responsables y candidatos.',
    shortDesc: 'Gestiona partners',
  },
  developer: {
    icon: Shield,
    gradient: 'from-gray-600 to-gray-800',
    ring: 'ring-gray-600',
    description: 'Acceso de desarrollador con permisos extendidos.',
    shortDesc: 'Desarrollador',
  },
  auxiliar: {
    icon: UserCheck,
    gradient: 'from-slate-400 to-slate-600',
    ring: 'ring-slate-400',
    description: 'Acceso de solo lectura al sistema.',
    shortDesc: 'Solo lectura',
  },
};

const ROLE_LABELS: Record<string, string> = {
  candidato: 'Candidato',
  responsable: 'Responsable de Plantel',
  responsable_partner: 'Responsable del Partner',
  responsable_estatal: 'Responsable Estatal',
  editor: 'Editor',
  editor_invitado: 'Editor Invitado',
  gerente: 'Gerente',
  financiero: 'Financiero',
  soporte: 'Soporte',
  coordinator: 'Coordinador',
  developer: 'Desarrollador',
  auxiliar: 'Auxiliar',
};

// ─── Componente principal ──────────────────────────────────────────────────
export default function UserFormPage() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user: currentUser } = useAuthStore();
  const isEditing = !!userId;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [existingUsername, setExistingUsername] = useState<string>('');

  // Paso actual: 'select-role' o 'fill-form'
  const [step, setStep] = useState<'select-role' | 'fill-form'>(isEditing ? 'fill-form' : 'select-role');
  const [formVisible, setFormVisible] = useState(isEditing);

  // Estados para responsable
  const [availableCampuses, setAvailableCampuses] = useState<AvailableCampus[]>([]);
  const [loadingCampuses, setLoadingCampuses] = useState(false);
  // Estados para responsable_partner / responsable_estatal
  const [availablePartners, setAvailablePartners] = useState<AvailablePartner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  // Estados disponibles para responsable_estatal
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  // Estados para coordinadores (asignar a responsables)
  const [availableCoordinators, setAvailableCoordinators] = useState<AvailableCoordinator[]>([]);
  const [loadingCoordinators, setLoadingCoordinators] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ username: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  // Similitud de nombre
  const [similarUsers, setSimilarUsers] = useState<SimilarUser[]>([]);
  const [showSimilarityWarning, setShowSimilarityWarning] = useState(false);
  const [checkingSimilarity, setCheckingSimilarity] = useState(false);
  const [similarityBypass, setSimilarityBypass] = useState(false);

  // Validación CURP RENAPO
  const [validatingCurp, setValidatingCurp] = useState(false);
  const [curpValidationResult, setCurpValidationResult] = useState<CurpValidationResult | null>(null);
  // Datos RENAPO del usuario existente (para edición)
  const [existingCurpVerified, setExistingCurpVerified] = useState(false);
  const [existingCurpVerifiedAt, setExistingCurpVerifiedAt] = useState<string | undefined>();

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    first_surname: '',
    second_surname: '',
    curp: '',
    role: '',
    is_active: true,
    gender: '',
    date_of_birth: '',
    campus_id: 0,
    can_bulk_create_candidates: false,
    can_manage_groups: false,
    can_view_reports: true,
    coordinator_id: '',
    partner_id: 0,
    assigned_state: '',
  });

  useEffect(() => {
    loadRoles();
    if (isEditing) {
      loadUser();
    }
  }, [userId]);

  // Cargar campuses/partners/coordinadores según rol
  useEffect(() => {
    if (formData.role === 'responsable' && !isEditing) {
      loadCampuses();
    }
    if (formData.role === 'responsable_partner' && !isEditing) {
      loadPartners();
    }
    if (formData.role === 'responsable_estatal' && !isEditing) {
      loadPartners();
      loadStates();
    }
    // Cargar coordinadores si el creador NO es coordinador (coordinador se asigna automáticamente)
    if (formData.role === 'responsable' && currentUser?.role !== 'coordinator') {
      loadCoordinators();
    }
  }, [formData.role, isEditing]);

  const loadCampuses = async () => {
    try {
      setLoadingCampuses(true);
      const data = await getAvailableCampuses();
      setAvailableCampuses(data.campuses);
    } catch (err) {
      console.error('Error loading campuses:', err);
    } finally {
      setLoadingCampuses(false);
    }
  };

  const loadPartners = async () => {
    try {
      setLoadingPartners(true);
      const data = await getAvailablePartners();
      setAvailablePartners(data.partners);
    } catch (err) {
      console.error('Error loading partners:', err);
    } finally {
      setLoadingPartners(false);
    }
  };

  const loadStates = async () => {
    try {
      setLoadingStates(true);
      const data = await getAvailableStates();
      setAvailableStates(data.states);
    } catch (err) {
      console.error('Error loading states:', err);
    } finally {
      setLoadingStates(false);
    }
  };

  const loadCoordinators = async () => {
    try {
      setLoadingCoordinators(true);
      const data = await getAvailableCoordinators();
      setAvailableCoordinators(data.coordinators);
    } catch (err) {
      console.error('Error loading coordinators:', err);
    } finally {
      setLoadingCoordinators(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const loadRoles = async () => {
    try {
      const data = await getAvailableRoles();
      setRoles(data.roles);
      if (data.roles.length === 1) {
        setFormData(prev => ({ ...prev, role: data.roles[0].value }));
        // Si solo hay un rol, saltar la selección
        setStep('fill-form');
        setFormVisible(true);
      }
    } catch (err) {
      console.error('Error loading roles:', err);
    }
  };

  const loadUser = async () => {
    try {
      setLoading(true);
      const data = await getUser(userId!);
      // El username se guarda por separado ya que es solo lectura
      setExistingUsername(data.username || '');
      setFormData({
        email: data.email || '',
        name: data.name || '',
        first_surname: data.first_surname || '',
        second_surname: data.second_surname || '',
        curp: data.curp || '',
        role: data.role || 'candidato',
        is_active: data.is_active ?? true,
        gender: data.gender || '',
        date_of_birth: data.date_of_birth || '',
        campus_id: data.campus_id || 0,
        can_bulk_create_candidates: data.can_bulk_create_candidates ?? false,
        can_manage_groups: data.can_manage_groups ?? false,
        can_view_reports: data.can_view_reports ?? true,
        coordinator_id: data.coordinator_id || '',
        partner_id: data.partners?.[0]?.id || 0,
        assigned_state: data.assigned_state || '',
      });
      // Guardar estado de verificación CURP
      setExistingCurpVerified(data.curp_verified ?? false);
      setExistingCurpVerifiedAt(data.curp_verified_at);
      // Load campuses/partners if editing responsable/responsable_partner
      if (data.role === 'responsable') {
        loadCampuses();
        if (currentUser?.role !== 'coordinator') {
          loadCoordinators();
        }
      }
      if (data.role === 'responsable_partner') {
        loadPartners();
      }
      if (data.role === 'responsable_estatal') {
        loadPartners();
        loadStates();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Email es requerido para todos excepto candidatos (solo al crear)
    if (!isEditing && formData.role !== 'candidato' && !formData.email.trim()) {
      setError('El email es requerido');
      return;
    }
    // Al editar: email es opcional, pero si se proporciona debe ser válido
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setError('El formato del email es inválido');
      return;
    }
    if (!formData.name.trim()) {
      setError('El nombre es requerido');
      return;
    }
    if (!formData.first_surname.trim()) {
      setError('El primer apellido es requerido');
      return;
    }
    
    // CURP: si se proporciona, debe tener 18 caracteres (aplica siempre)
    if (formData.curp.trim() && formData.curp.trim().length !== 18) {
      setError('El CURP debe tener exactamente 18 caracteres');
      return;
    }

    // Validaciones específicas solo al CREAR (no al editar)
    if (!isEditing) {
      // Para candidatos: CURP y email son opcionales
      if (formData.role === 'candidato') {
        if (!formData.second_surname.trim()) {
          setError('El segundo apellido es requerido para candidatos');
          return;
        }
        if (!formData.gender) {
          setError('El género es requerido para candidatos');
          return;
        }
      }

      // Para responsables, campos adicionales son obligatorios al crear
      if (formData.role === 'responsable') {
        if (!formData.second_surname.trim()) {
          setError('El segundo apellido es requerido para responsables');
          return;
        }
        if (!formData.curp.trim()) {
          setError('El CURP es requerido para responsables');
          return;
        }
        if (!formData.gender) {
          setError('El género es requerido para responsables');
          return;
        }
        if (!formData.date_of_birth) {
          setError('La fecha de nacimiento es requerida para responsables');
          return;
        }
        if (!formData.campus_id || formData.campus_id === 0) {
          setError('Debe seleccionar un plantel para el responsable');
          return;
        }
      }

      // Para responsable_partner, partner_id es obligatorio al crear
      if (formData.role === 'responsable_partner') {
        if (!formData.partner_id || formData.partner_id === 0) {
          setError('Debe seleccionar un partner para el responsable del partner');
          return;
        }
      }

      // Para responsable_estatal, partner_id y assigned_state son obligatorios al crear
      if (formData.role === 'responsable_estatal') {
        if (!formData.partner_id || formData.partner_id === 0) {
          setError('Debe seleccionar un partner para el responsable estatal');
          return;
        }
        if (!formData.assigned_state) {
          setError('Debe seleccionar un estado para el responsable estatal');
          return;
        }
      }
    }

    // Verificación de similitud de nombre (solo al crear, no al editar)
    if (!isEditing && !similarityBypass) {
      try {
        setCheckingSimilarity(true);
        const result = await checkNameSimilarity({
          name: formData.name.trim(),
          first_surname: formData.first_surname.trim(),
          second_surname: formData.second_surname.trim() || undefined,
        });
        if (result.similar_users.length > 0) {
          setSimilarUsers(result.similar_users);
          setShowSimilarityWarning(true);
          return; // No continuar hasta que el usuario confirme
        }
      } catch {
        // Si falla la verificación, continuar con la creación
      } finally {
        setCheckingSimilarity(false);
      }
    }

    try {
      setSaving(true);

      if (isEditing) {
        const updateData: UpdateUserData = {
          email: formData.email.trim() || undefined,
          name: formData.name,
          first_surname: formData.first_surname,
          second_surname: formData.second_surname || undefined,
          curp: formData.curp || undefined,
          is_active: formData.is_active,
          gender: formData.gender || undefined,
        };

        if (currentUser?.role === 'admin') {
          updateData.role = formData.role;
        }

        // Campos adicionales para responsables
        if (formData.role === 'responsable') {
          updateData.date_of_birth = formData.date_of_birth || undefined;
          updateData.campus_id = formData.campus_id || undefined;
          updateData.can_bulk_create_candidates = formData.can_bulk_create_candidates;
          updateData.can_manage_groups = formData.can_manage_groups;
          updateData.can_view_reports = formData.can_view_reports;
          if (formData.coordinator_id) {
            updateData.coordinator_id = formData.coordinator_id;
          }
        }

        // Campos adicionales para responsable_partner
        if (formData.role === 'responsable_partner') {
          updateData.partner_id = formData.partner_id || undefined;
        }

        // Campos adicionales para responsable_estatal
        if (formData.role === 'responsable_estatal') {
          updateData.partner_id = formData.partner_id || undefined;
          updateData.assigned_state = formData.assigned_state || undefined;
        }

        await updateUser(userId!, updateData);
        setSuccess('Usuario actualizado correctamente');
      } else {
        const createData: CreateUserData = {
          email: formData.email,
          name: formData.name,
          first_surname: formData.first_surname,
          second_surname: formData.second_surname || undefined,
          role: formData.role,
          curp: formData.curp || undefined,
          gender: formData.gender || undefined,
        };

        // Campos adicionales para responsables
        if (formData.role === 'responsable') {
          createData.date_of_birth = formData.date_of_birth;
          createData.campus_id = formData.campus_id;
          createData.can_bulk_create_candidates = formData.can_bulk_create_candidates;
          createData.can_manage_groups = formData.can_manage_groups;
          createData.can_view_reports = formData.can_view_reports;
          if (currentUser?.role !== 'coordinator') {
            createData.coordinator_id = formData.coordinator_id || undefined;
          }
        }

        // Campos adicionales para responsable_partner
        if (formData.role === 'responsable_partner') {
          createData.partner_id = formData.partner_id;
        }

        // Campos adicionales para responsable_estatal
        if (formData.role === 'responsable_estatal') {
          createData.partner_id = formData.partner_id;
          createData.assigned_state = formData.assigned_state;
        }

        const result = await createUser(createData);
        
        // Mostrar credenciales temporales para TODOS los roles
        if ((result as any).temporary_password) {
          setCreatedCredentials({
            username: result.user.username,
            password: (result as any).temporary_password
          });
          setSuccess('Usuario creado exitosamente. Guarda las credenciales de acceso.');
        } else {
          setSuccess('Usuario creado correctamente');
        }
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Error al guardar usuario';
      const isRenapoError = err.response?.data?.renapo_error;
      if (isRenapoError) {
        setCurpValidationResult({
          valid: false,
          curp: formData.curp,
          error: errorMsg,
        });
      }
      setError(errorMsg);
    } finally {
      setSaving(false);
      setSimilarityBypass(false);
    }
  };

  const handleConfirmCreateDespiteSimilarity = () => {
    setShowSimilarityWarning(false);
    setSimilarityBypass(true);
    // Re-submit programáticamente
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    }, 50);
  };


  // ─── Selección de rol (paso 1 → 2) ──────────────────────────────────────
  const handleSelectRole = (selectedRole: string) => {
    setFormData(prev => ({ ...prev, role: selectedRole }));
    setStep('fill-form');
    setTimeout(() => setFormVisible(true), 50);
  };

  const handleChangeRole = () => {
    setFormVisible(false);
    setTimeout(() => {
      setStep('select-role');
      setFormData(prev => ({ ...prev, role: '' }));
    }, 300);
  };

  // ─── Helpers derivados del rol ───────────────────────────────────────────
  const roleConfig = ROLE_CONFIG[formData.role] || ROLE_CONFIG.candidato;
  const roleLabel = ROLE_LABELS[formData.role] || formData.role;
  const needsCurp = ['candidato', 'responsable'].includes(formData.role);
  const needsGender = ['candidato', 'responsable'].includes(formData.role);
  const needsSecondSurname = ['candidato', 'responsable'].includes(formData.role);
  const needsEmail = formData.role !== 'candidato';
  const isEmailOptional = formData.role === 'candidato' || isEditing;
  // Bloquear CURP y datos personales si CURP verificada (excepto soporte)
  const curpLocked = isEditing && existingCurpVerified && currentUser?.role !== 'soporte';

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando usuario..." />
      </div>
    );
  }

  const RoleIcon = roleConfig.icon;

  return (
    <div className="fluid-p-6 max-w-4xl mx-auto animate-fade-in-up">
      {/* Spinner de validación CURP RENAPO */}
      {validatingCurp && (
        <CurpValidationSpinner
          curp={formData.curp}
          onCancel={() => setValidatingCurp(false)}
        />
      )}
      
      {/* Back link */}
      <div className="fluid-mb-6">
        <Link
          to="/user-management"
          className="inline-flex items-center fluid-gap-2 text-gray-600 hover:text-gray-800 fluid-mb-4 group"
        >
          <ArrowLeft className="fluid-icon-sm group-hover:-translate-x-1 transition-transform" />
          Volver a usuarios
        </Link>
      </div>

      {/* ── Header con gradiente dinámico ── */}
      <div
        className={`bg-gradient-to-r ${
          formData.role ? roleConfig.gradient : 'from-blue-600 to-indigo-600'
        } rounded-fluid-xl fluid-p-6 fluid-mb-6 text-white shadow-lg transition-all duration-500`}
      >
        <div className="flex items-center fluid-gap-4">
          <div className="fluid-p-3 bg-white/20 rounded-fluid-xl">
            {formData.role ? <RoleIcon className="fluid-icon-lg" /> : <Users className="fluid-icon-lg" />}
          </div>
          <div className="flex-1">
            <h1 className="fluid-text-2xl font-bold">
              {isEditing ? 'Editar Usuario' : formData.role ? `Nuevo ${roleLabel}` : 'Nuevo Usuario'}
            </h1>
            <p className="fluid-text-sm text-white/80 fluid-mt-1">
              {isEditing
                ? 'Modifica los datos del usuario'
                : formData.role
                  ? roleConfig.description
                  : 'Selecciona el tipo de usuario que deseas crear'}
            </p>
          </div>
          {!isEditing && (
            <div className="hidden sm:flex items-center fluid-gap-2 bg-white/20 rounded-full px-4 py-1.5 text-sm font-medium">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 'select-role' ? 'bg-white text-blue-600' : 'bg-white/40'
                }`}
              >
                1
              </span>
              <span className="text-white/60">—</span>
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 'fill-form' ? 'bg-white text-blue-600' : 'bg-white/40'
                }`}
              >
                2
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de Error ── */}
      {error && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in-up">
          <div className="bg-white rounded-fluid-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-red-50 border-b border-red-200 fluid-p-5 flex items-start fluid-gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-red-800 fluid-text-lg">Error</h3>
                <p className="fluid-text-sm text-red-700 fluid-mt-1">{error}</p>
              </div>
            </div>
            <div className="fluid-p-5 flex justify-end bg-gray-50">
              <button
                type="button"
                onClick={() => setError(null)}
                className="fluid-px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-fluid-lg font-medium transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Éxito ── */}
      {success && !createdCredentials && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in-up">
          <div className="bg-white rounded-fluid-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-green-50 border-b border-green-200 fluid-p-5 flex items-start fluid-gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-green-800 fluid-text-lg">¡Listo!</h3>
                <p className="fluid-text-sm text-green-700 fluid-mt-1">{success}</p>
              </div>
            </div>
            <div className="fluid-p-5 flex justify-end bg-gray-50">
              <button
                type="button"
                onClick={() => navigate('/user-management')}
                className="fluid-px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-fluid-lg font-medium transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Credenciales creadas ── */}
      {createdCredentials && (
        <div className="fluid-mb-6 bg-amber-50 border border-amber-200 rounded-fluid-xl fluid-p-6">
          <div className="flex items-start fluid-gap-3 fluid-mb-4">
            <Key className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Credenciales de Acceso</p>
              <p className="fluid-text-sm text-amber-700 fluid-mt-1">
                Guarda esta información, la contraseña solo se muestra una vez
              </p>
            </div>
          </div>

          <div className="bg-white/50 rounded-lg fluid-p-4 fluid-space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="fluid-text-xs text-gray-500 uppercase font-medium">Usuario</p>
                <p className="font-mono text-lg font-bold text-gray-800">{createdCredentials.username}</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(createdCredentials.username, 'username')}
                className="fluid-p-2 hover:bg-white rounded-lg transition-colors"
                title="Copiar"
              >
                {copiedField === 'username' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="fluid-text-xs text-gray-500 uppercase font-medium">Contraseña Temporal</p>
                <p className="font-mono text-lg font-bold text-gray-800">
                  {showPassword ? createdCredentials.password : '••••••••'}
                </p>
              </div>
              <div className="flex items-center fluid-gap-1">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="fluid-p-2 hover:bg-white rounded-lg transition-colors"
                  title={showPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdCredentials.password, 'password')}
                  className="fluid-p-2 hover:bg-white rounded-lg transition-colors"
                  title="Copiar"
                >
                  {copiedField === 'password' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="fluid-mt-4 flex justify-end">
            <Link
              to="/user-management"
              className="inline-flex items-center fluid-gap-2 fluid-px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-fluid-lg font-medium transition-colors"
            >
              <CheckCircle className="fluid-icon-sm" />
              Entendido, volver a usuarios
            </Link>
          </div>
        </div>
      )}

      {/* ── Modal de similitud ── */}
      {showSimilarityWarning && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-fluid-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-200 fluid-p-5 flex items-start justify-between">
              <div className="flex items-start fluid-gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-amber-800 fluid-text-lg">Usuarios con nombre similar</h3>
                  <p className="fluid-text-sm text-amber-700 fluid-mt-1">
                    Se encontraron {similarUsers.length} usuario(s) con nombre similar. Verifica que no sea un duplicado.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSimilarityWarning(false)}
                className="fluid-p-1 hover:bg-amber-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-amber-600" />
              </button>
            </div>
            <div className="fluid-p-5 overflow-y-auto max-h-[50vh]">
              <div className="fluid-space-y-3">
                {similarUsers.map((u) => (
                  <div
                    key={u.id}
                    className={`border rounded-fluid-lg fluid-p-4 ${
                      u.match_level === 'exact'
                        ? 'border-red-300 bg-red-50'
                        : u.match_level === 'partial'
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{u.full_name}</p>
                        <div className="fluid-text-sm text-gray-600 fluid-mt-1 fluid-space-y-0.5">
                          {u.email && <p>Email: {u.email}</p>}
                          {u.curp && <p>CURP: {u.curp}</p>}
                          <p>Usuario: {u.username}</p>
                          <p>Rol: {u.role}</p>
                        </div>
                      </div>
                      <span
                        className={`fluid-text-xs font-medium fluid-px-2 py-1 rounded-full ${
                          u.match_level === 'exact'
                            ? 'bg-red-100 text-red-700'
                            : u.match_level === 'partial'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {u.match_level === 'exact'
                          ? 'Coincidencia exacta'
                          : u.match_level === 'partial'
                            ? 'Coincidencia parcial'
                            : 'Mismos apellidos'}
                      </span>
                    </div>
                    <p className="fluid-text-xs text-gray-500 fluid-mt-2">{u.match_description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-gray-200 fluid-p-5 flex items-center justify-end fluid-gap-3 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowSimilarityWarning(false)}
                className="fluid-px-5 py-2.5 border border-gray-300 text-gray-700 rounded-fluid-lg hover:bg-white font-medium transition-colors"
              >
                Cancelar y revisar
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateDespiteSimilarity}
                className="inline-flex items-center fluid-gap-2 fluid-px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-fluid-lg font-medium transition-colors"
              >
                <AlertTriangle className="fluid-icon-sm" />
                Crear de todas formas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           PASO 1 — Selección de tipo de usuario (tarjetas)
         ══════════════════════════════════════════════════════════════════════ */}
      {step === 'select-role' && !createdCredentials && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => {
            const cfg = ROLE_CONFIG[role.value] || ROLE_CONFIG.candidato;
            const CardIcon = cfg.icon;
            return (
              <button
                key={role.value}
                type="button"
                onClick={() => handleSelectRole(role.value)}
                className="group relative overflow-hidden bg-white border-2 border-gray-200 rounded-fluid-xl p-5 text-left hover:border-transparent hover:shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {/* Gradient overlay on hover */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                />
                <div className="relative z-10">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <CardIcon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 fluid-text-base">
                    {ROLE_LABELS[role.value] || role.label}
                  </h3>
                  <p className="fluid-text-sm text-gray-500 mt-1">{cfg.shortDesc}</p>
                </div>
                <ArrowRight className="absolute top-5 right-5 w-5 h-5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all duration-300" />
              </button>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           PASO 2 — Formulario con campos según el rol
         ══════════════════════════════════════════════════════════════════════ */}
      {step === 'fill-form' && !createdCredentials && (
        <div
          className={`transition-all duration-500 ${
            formVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Chip de rol + botón cambiar */}
          {!isEditing && (
            <div className="flex items-center fluid-gap-3 fluid-mb-5">
              <div
                className={`inline-flex items-center fluid-gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${roleConfig.gradient} text-white font-medium text-sm shadow-sm`}
              >
                <RoleIcon className="w-4 h-4" />
                {roleLabel}
              </div>
              <button
                type="button"
                onClick={handleChangeRole}
                className="inline-flex items-center fluid-gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Cambiar tipo
              </button>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-fluid-xl shadow-sm border-2 border-gray-200 overflow-hidden"
          >
            {/* ── Información personal ── */}
            <div className="fluid-p-6">
              <h2 className="flex items-center fluid-gap-2 font-semibold text-gray-800 fluid-text-lg fluid-mb-5">
                <User className="fluid-icon-sm text-gray-400" />
                Información personal
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-5">
                {/* Username (solo edición) */}
                {isEditing && (
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                      Nombre de usuario
                    </label>
                    <div className="w-full fluid-px-4 py-2.5 border border-gray-200 rounded-fluid-lg bg-gray-50 text-gray-600 font-mono">
                      {existingUsername || '—'}
                    </div>
                    <p className="fluid-text-xs text-gray-500 fluid-mt-1">Generado automáticamente</p>
                  </div>
                )}

                {/* Email */}
                {(needsEmail || isEmailOptional) && (
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                      Email{' '}
                      {needsEmail && !isEditing && <span className="text-red-500">*</span>}
                      {(isEmailOptional) && (
                        <span className="text-gray-400 text-xs ml-1">(opcional)</span>
                      )}
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="usuario@email.com"
                      className="w-full fluid-px-4 py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {isEmailOptional && (
                      <p className="fluid-text-xs text-amber-600 fluid-mt-1">
                        Sin email no podrá recibir insignia digital
                      </p>
                    )}
                  </div>
                )}

                {/* Nota contraseña auto */}
                {!isEditing && (
                  <div className="bg-blue-50 border border-blue-200 rounded-fluid-lg fluid-p-4 flex items-start fluid-gap-2">
                    <Key className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="fluid-text-sm text-blue-700">
                      Se generará una contraseña automática.
                    </p>
                  </div>
                )}

                {/* Nombre */}
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                    Nombre(s) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Juan"
                    disabled={curpLocked}
                    className={`w-full fluid-px-4 py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${curpLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                </div>

                {/* Primer apellido */}
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                    Primer Apellido <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="first_surname"
                    value={formData.first_surname}
                    onChange={handleChange}
                    placeholder="Pérez"
                    disabled={curpLocked}
                    className={`w-full fluid-px-4 py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${curpLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                </div>

                {/* Segundo apellido */}
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                    Segundo Apellido{' '}
                    {needsSecondSurname && !isEditing && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    name="second_surname"
                    value={formData.second_surname}
                    onChange={handleChange}
                    placeholder="García"
                    disabled={curpLocked}
                    className={`w-full fluid-px-4 py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${curpLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                </div>

                {/* Género */}
                {needsGender && (
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                      Género{' '}
                      {!isEditing && <span className="text-red-500">*</span>}
                    </label>
                    <StyledSelect
                      value={formData.gender}
                      onChange={(value) => setFormData((prev) => ({ ...prev, gender: value }))}
                      options={[
                        { value: 'M', label: 'Masculino' },
                        { value: 'F', label: 'Femenino' },
                        { value: 'O', label: 'Otro' },
                      ]}
                      placeholder="Seleccionar género..."
                      icon={User}
                      colorScheme="purple"
                    />
                  </div>
                )}

                {/* CURP */}
                {needsCurp && (
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                      CURP{' '}
                      {formData.role === 'responsable' && !isEditing && <span className="text-red-500">*</span>}
                      {(formData.role === 'candidato' || isEditing) && (
                        <span className="text-gray-400 text-xs ml-1">(opcional)</span>
                      )}
                      {isEditing && formData.curp && (
                        <CurpVerificationBadge
                          curp={formData.curp}
                          curpVerified={existingCurpVerified}
                          curpVerifiedAt={existingCurpVerifiedAt}
                          compact
                        />
                      )}
                    </label>
                    {curpLocked && (
                      <p className="fluid-text-xs text-green-600 fluid-mb-1 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        CURP verificada en RENAPO — campos bloqueados
                      </p>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="curp"
                        value={formData.curp}
                        onChange={(e) => {
                          handleChange(e);
                          // Limpiar resultado previo si cambia la CURP
                          setCurpValidationResult(null);
                        }}
                        placeholder="XXXX000000XXXXXX00"
                        maxLength={18}
                        disabled={curpLocked}
                        className={`flex-1 fluid-px-4 py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase ${curpLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      />
                      {!curpLocked && formData.curp.trim().length === 18 && !curpValidationResult?.valid && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setValidatingCurp(true);
                              setCurpValidationResult(null);
                              const result = await validateCurpRenapo(formData.curp.trim());
                              setCurpValidationResult(result);
                              if (result.valid && result.data) {
                                setFormData(prev => ({
                                  ...prev,
                                  name: result.data!.name || prev.name,
                                  first_surname: result.data!.first_surname || prev.first_surname,
                                  second_surname: result.data!.second_surname || prev.second_surname,
                                }));
                              }
                            } catch (err: any) {
                              setCurpValidationResult({
                                valid: false,
                                curp: formData.curp,
                                error: err?.response?.data?.error || 'Error al validar CURP',
                              });
                            } finally {
                              setValidatingCurp(false);
                            }
                          }}
                          disabled={validatingCurp}
                          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
                        >
                          <Shield className="w-4 h-4" />
                          Verificar
                        </button>
                      )}
                    </div>
                    {formData.role === 'responsable' && (
                      <p className="fluid-text-xs text-gray-500 fluid-mt-1">18 caracteres exactos — se valida contra RENAPO</p>
                    )}
                    {formData.role === 'candidato' && (
                      <p className="fluid-text-xs text-amber-600 fluid-mt-1">
                        Sin CURP no podrá recibir certificado CONOCER
                      </p>
                    )}
                    {curpValidationResult && (
                      <CurpValidationResultDisplay
                        result={curpValidationResult}
                        onRetry={() => {
                          setCurpValidationResult(null);
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Rol (solo en edición, solo admin) */}
                {isEditing && (
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                      Rol <span className="text-red-500">*</span>
                    </label>
                    <StyledSelect
                      value={formData.role}
                      onChange={(value) => setFormData((prev) => ({ ...prev, role: value }))}
                      options={roles.map((r) => ({ value: r.value, label: r.label }))}
                      placeholder="Seleccionar rol..."
                      icon={Shield}
                      colorScheme="indigo"
                      disabled={currentUser?.role !== 'admin'}
                      required
                    />
                    {currentUser?.role !== 'admin' && (
                      <p className="fluid-text-xs text-gray-500 fluid-mt-1">
                        Solo administradores pueden cambiar roles
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Configuración del responsable ── */}
            {formData.role === 'responsable' && (
              <div className="border-t border-blue-200 bg-blue-50/50 fluid-p-6">
                <h2 className="flex items-center fluid-gap-2 font-semibold text-blue-800 fluid-text-lg fluid-mb-5">
                  <Building2 className="fluid-icon-sm text-blue-500" />
                  Configuración del responsable
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-5">
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                      Fecha de Nacimiento{' '}
                      {!isEditing && <span className="text-red-500">*</span>}
                    </label>
                    <DatePickerInput
                      value={formData.date_of_birth ? new Date(formData.date_of_birth) : null}
                      onChange={(date) =>
                        setFormData((prev) => ({
                          ...prev,
                          date_of_birth: date ? date.toISOString().split('T')[0] : '',
                        }))
                      }
                      placeholder="Seleccionar fecha..."
                      colorScheme="green"
                      maxDate={new Date()}
                    />
                  </div>
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                      Plantel{' '}
                      {!isEditing && <span className="text-red-500">*</span>}
                    </label>
                    {loadingCampuses ? (
                      <div className="flex items-center fluid-gap-2 fluid-py-2 text-gray-500">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        Cargando planteles...
                      </div>
                    ) : (
                      <StyledSelect
                        value={formData.campus_id.toString()}
                        onChange={(value) =>
                          setFormData((prev) => ({ ...prev, campus_id: parseInt(value) || 0 }))
                        }
                        options={availableCampuses.map((c) => ({
                          value: c.id.toString(),
                          label: `${c.partner_name} - ${c.name} (${c.code})`,
                        }))}
                        placeholder="Seleccionar plantel..."
                        icon={Building2}
                        colorScheme="blue"
                        required
                      />
                    )}
                    {availableCampuses.length === 0 && !loadingCampuses && (
                      <p className="fluid-text-xs text-amber-600 fluid-mt-1">
                        No hay planteles disponibles. Cree primero un plantel.
                      </p>
                    )}
                  </div>
                  {/* ── Coordinador asignado ── */}
                  {currentUser?.role === 'coordinator' ? (
                    <div className="md:col-span-2">
                      <div className="flex items-center fluid-gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-fluid-lg">
                        <Shield className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                        <p className="fluid-text-sm text-indigo-700">
                          Este responsable quedará ligado a ti como coordinador.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                        Coordinador asignado <span className="text-red-500">*</span>
                      </label>
                      {loadingCoordinators ? (
                        <div className="flex items-center fluid-gap-2 fluid-py-2 text-gray-500">
                          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          Cargando coordinadores...
                        </div>
                      ) : (
                        <StyledSelect
                          value={formData.coordinator_id}
                          onChange={(value) =>
                            setFormData((prev) => ({ ...prev, coordinator_id: value }))
                          }
                          options={availableCoordinators.map((c) => ({
                            value: c.id,
                            label: `${c.full_name} (${c.email})`,
                          }))}
                          placeholder="Seleccionar coordinador..."
                          icon={Shield}
                          colorScheme="indigo"
                          required
                        />
                      )}
                      {availableCoordinators.length === 0 && !loadingCoordinators && (
                        <p className="fluid-text-xs text-amber-600 fluid-mt-1">
                          No hay coordinadores disponibles.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <p className="fluid-text-sm font-medium text-blue-800 fluid-mb-3">Permisos</p>
                    <div className="flex flex-wrap fluid-gap-4">
                      <label className="flex items-center fluid-gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="can_bulk_create_candidates"
                          checked={formData.can_bulk_create_candidates}
                          onChange={handleChange}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="fluid-text-sm text-blue-700">Altas masivas de candidatos</span>
                      </label>
                      <label className="flex items-center fluid-gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="can_manage_groups"
                          checked={formData.can_manage_groups}
                          onChange={handleChange}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="fluid-text-sm text-blue-700">Gestión de grupos</span>
                      </label>
                      <label className="flex items-center fluid-gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="can_view_reports"
                          checked={formData.can_view_reports}
                          onChange={handleChange}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="fluid-text-sm text-blue-700">Ver Reportes</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Asignación de partner ── */}
            {formData.role === 'responsable_partner' && (
              <div className="border-t border-violet-200 bg-violet-50/50 fluid-p-6">
                <h2 className="flex items-center fluid-gap-2 font-semibold text-violet-800 fluid-text-lg fluid-mb-5">
                  <Briefcase className="fluid-icon-sm text-violet-500" />
                  Asignación de partner
                </h2>
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                    Partner{' '}
                    {!isEditing && <span className="text-red-500">*</span>}
                  </label>
                  {loadingPartners ? (
                    <div className="flex items-center fluid-gap-2 fluid-py-2 text-gray-500">
                      <div className="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                      Cargando partners...
                    </div>
                  ) : (
                    <StyledSelect
                      value={formData.partner_id.toString()}
                      onChange={(value) =>
                        setFormData((prev) => ({ ...prev, partner_id: parseInt(value) || 0 }))
                      }
                      options={availablePartners.map((p) => ({
                        value: p.id.toString(),
                        label: `${p.name} — ${p.total_campuses} planteles`,
                      }))}
                      placeholder="Seleccionar partner..."
                      icon={Building2}
                      colorScheme="purple"
                      required
                    />
                  )}
                  {availablePartners.length === 0 && !loadingPartners && (
                    <p className="fluid-text-xs text-amber-600 fluid-mt-1">
                      No hay partners disponibles.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Asignación de partner y estado (responsable_estatal) ── */}
            {formData.role === 'responsable_estatal' && (
              <div className="border-t border-pink-200 bg-pink-50/50 fluid-p-6">
                <h2 className="flex items-center fluid-gap-2 font-semibold text-pink-800 fluid-text-lg fluid-mb-5">
                  <MapPin className="fluid-icon-sm text-pink-500" />
                  Asignación estatal
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-4">
                  {/* Partner */}
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                      Partner{' '}
                      {!isEditing && <span className="text-red-500">*</span>}
                    </label>
                    {loadingPartners ? (
                      <div className="flex items-center fluid-gap-2 fluid-py-2 text-gray-500">
                        <div className="w-4 h-4 border-2 border-pink-600 border-t-transparent rounded-full animate-spin" />
                        Cargando partners...
                      </div>
                    ) : (
                      <StyledSelect
                        value={formData.partner_id.toString()}
                        onChange={(value) =>
                          setFormData((prev) => ({ ...prev, partner_id: parseInt(value) || 0 }))
                        }
                        options={availablePartners.map((p) => ({
                          value: p.id.toString(),
                          label: `${p.name} — ${p.total_campuses} planteles`,
                        }))}
                        placeholder="Seleccionar partner..."
                        icon={Building2}
                        colorScheme="purple"
                        required
                      />
                    )}
                    {availablePartners.length === 0 && !loadingPartners && (
                      <p className="fluid-text-xs text-amber-600 fluid-mt-1">
                        No hay partners disponibles.
                      </p>
                    )}
                  </div>
                  {/* Estado */}
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                      Estado{' '}
                      {!isEditing && <span className="text-red-500">*</span>}
                    </label>
                    {loadingStates ? (
                      <div className="flex items-center fluid-gap-2 fluid-py-2 text-gray-500">
                        <div className="w-4 h-4 border-2 border-pink-600 border-t-transparent rounded-full animate-spin" />
                        Cargando estados...
                      </div>
                    ) : (
                      <StyledSelect
                        value={formData.assigned_state}
                        onChange={(value) =>
                          setFormData((prev) => ({ ...prev, assigned_state: value }))
                        }
                        options={availableStates.map((s) => ({
                          value: s,
                          label: s,
                        }))}
                        placeholder="Seleccionar estado..."
                        icon={MapPin}
                        colorScheme="purple"
                        required
                      />
                    )}
                    {availableStates.length === 0 && !loadingStates && (
                      <p className="fluid-text-xs text-amber-600 fluid-mt-1">
                        No hay estados disponibles. Asegúrese de que los planteles tengan estado asignado.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Usuario activo (solo edición) ── */}
            {isEditing && (
              <div className="border-t border-gray-200 fluid-p-6">
                <label className="flex items-center fluid-gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="fluid-text-sm font-medium text-gray-700">Usuario activo</span>
                </label>
                <p className="fluid-text-xs text-gray-500 fluid-mt-1 ml-8">
                  Los usuarios inactivos no pueden iniciar sesión
                </p>
              </div>
            )}

            {/* ── Barra de envío ── */}
            <div className="border-t border-gray-200 fluid-p-6 bg-gray-50/50 flex items-center justify-end fluid-gap-4">
              <Link
                to="/user-management"
                className="fluid-px-6 py-2.5 border border-gray-300 text-gray-700 rounded-fluid-lg hover:bg-white font-medium transition-colors"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={saving || checkingSimilarity}
                className={`inline-flex items-center fluid-gap-2 fluid-px-6 py-2.5 bg-gradient-to-r ${roleConfig.gradient} hover:shadow-lg text-white rounded-fluid-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saving || checkingSimilarity ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {checkingSimilarity ? 'Verificando...' : 'Guardando...'}
                  </>
                ) : (
                  <>
                    <Save className="fluid-icon-sm" />
                    {isEditing ? 'Guardar Cambios' : `Crear ${roleLabel}`}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
