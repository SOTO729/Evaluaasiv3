/**
 * Página de detalle de usuario
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Users,
  ArrowLeft,
  Edit,
  Power,
  Key,
  Mail,
  Phone,
  Shield,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle,
  X,
  Eye,
  EyeOff,
  FileText,
  Trash2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Award,
  Clock,
  Hash,
  Calendar,
  Send,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getUser,
  toggleUserActive,
  changeUserPassword,
  generateTempPassword,
  getUserPassword,
  deleteUser,
  getUserGroupHistory,
  updateUser,
  getAvailableCoordinators,
  ManagedUser,
  GroupHistoryEntry,
  AvailableCoordinator,
  ROLE_LABELS,
  ROLE_COLORS,
} from '../../services/userManagementService';
import StyledSelect from '../../components/StyledSelect';
import { useAuthStore } from '../../store/authStore';
import CurpVerificationBadge from '../../components/users/CurpVerificationBadge';
import { sendSupportUserEmail } from '../../services/supportService';

// Roles sobre los que soporte solo puede VER (sin acciones excepto enviar contraseña por email)
const SOPORTE_READONLY_ROLES = ['coordinator', 'editor', 'editor_invitado', 'financiero', 'auxiliar', 'soporte'];

export default function UserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const [user, setUser] = useState<ManagedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Estados para generar contraseña temporal (solo admin)
  const [showGeneratedPasswordModal, setShowGeneratedPasswordModal] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [generatingPassword, setGeneratingPassword] = useState(false);
  const [showStoredPassword, setShowStoredPassword] = useState(false);  // Para ocultar/mostrar la contraseña
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [storedPasswordError, setStoredPasswordError] = useState<string | null>(null);

  // Estados para eliminar usuario (solo admin)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Estados para coordinador asignado (responsables)
  const [showCoordinatorChange, setShowCoordinatorChange] = useState(false);
  const [availableCoordinators, setAvailableCoordinators] = useState<AvailableCoordinator[]>([]);
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('');
  const [loadingCoordinators, setLoadingCoordinators] = useState(false);
  const [changingCoordinator, setChangingCoordinator] = useState(false);

  // Estados para historial de grupos
  const [groupHistory, setGroupHistory] = useState<GroupHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [expandedExams, setExpandedExams] = useState<Set<string>>(new Set());

  // Estado para enviar contraseña por correo
  const [sendingEmail, setSendingEmail] = useState(false);

  // Permisos de soporte
  const isSoporte = currentUser?.role === 'soporte';
  const isSoporteReadonly = isSoporte && user ? SOPORTE_READONLY_ROLES.includes(user.role) : false;

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const data = await getUser(userId!);
      setUser(data);
      if (data.role === 'candidato') {
        loadGroupHistory();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar usuario');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupHistory = async () => {
    if (!userId) return;
    try {
      setLoadingHistory(true);
      const data = await getUserGroupHistory(userId);
      setGroupHistory(data.groups);
      if (data.groups.length > 0) {
        setExpandedGroups(new Set([data.groups[0].group_id]));
      }
    } catch {
      // silently fail - section just won't show data
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleGroup = (groupId: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };

  const toggleExam = (key: string) => {
    setExpandedExams(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const handleToggleActive = async () => {
    if (!user) return;
    
    try {
      const result = await toggleUserActive(user.id);
      setUser(result.user);
      setSuccess(result.user.is_active ? 'Usuario activado' : 'Usuario desactivado');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cambiar estado');
    }
  };

  const handleChangePassword = async () => {
    if (!user || !newPassword) return;

    try {
      setChangingPassword(true);
      await changeUserPassword(user.id, newPassword);
      setShowPasswordModal(false);
      setNewPassword('');
      setSuccess('Contraseña actualizada correctamente');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cambiar contraseña');
    } finally {
      setChangingPassword(false);
    }
  };

  // Función para ver la contraseña actual del usuario (solo admin)
  const handleViewUserPassword = async () => {
    if (!user) return;

    try {
      setLoadingPassword(true);
      setStoredPasswordError(null);
      const result = await getUserPassword(user.id);
      setGeneratedPassword(result.password);
      setShowGeneratedPasswordModal(true);
      setShowStoredPassword(false);  // Iniciar oculta
    } catch (err: any) {
      // Si no hay contraseña almacenada, mostrar opción de generar
      setStoredPasswordError(err.response?.data?.error || 'No se puede recuperar la contraseña');
      setShowGeneratedPasswordModal(true);
      setGeneratedPassword(null);
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleGenerateTempPassword = async () => {
    if (!user) return;

    try {
      setGeneratingPassword(true);
      const result = await generateTempPassword(user.id);
      setGeneratedPassword(result.password);
      setStoredPasswordError(null);
      setShowStoredPassword(false);
      setSuccess('Nueva contraseña generada');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al generar contraseña');
    } finally {
      setGeneratingPassword(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;

    try {
      setDeleting(true);
      await deleteUser(user.id);
      setShowDeleteModal(false);
      navigate('/user-management', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar usuario');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleSendPasswordEmail = async () => {
    if (!user) return;
    const target = user.email || user.username;
    if (!target) {
      setError('Este usuario no tiene email ni username para enviar el correo');
      return;
    }
    try {
      setSendingEmail(true);
      await sendSupportUserEmail({ target, template: 'reenvio' });
      setSuccess(`Contraseña enviada por correo a ${user.email || user.username}`);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error al enviar el correo');
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando usuario..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fluid-p-6 max-w-4xl mx-auto">
        <div className="text-center fluid-py-12">
          <AlertCircle className="fluid-icon-xl text-red-500 mx-auto fluid-mb-4" />
          <h2 className="fluid-text-xl font-semibold text-gray-800 fluid-mb-2">Usuario no encontrado</h2>
          <p className="text-gray-600 fluid-mb-4">{error}</p>
          <Link
            to="/user-management"
            className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 text-white rounded-fluid-lg hover:bg-blue-700"
          >
            <ArrowLeft className="fluid-icon-sm" />
            Volver a usuarios
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-4xl mx-auto animate-fade-in-up">
      <div className="fluid-mb-6">
        <Link
          to="/user-management"
          className="inline-flex items-center fluid-gap-2 text-gray-600 hover:text-gray-800 fluid-mb-4 group"
        >
          <ArrowLeft className="fluid-icon-sm group-hover:-translate-x-1 transition-transform" />
          Volver a usuarios
        </Link>
      </div>

      {/* Modal de Error */}
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

      {/* Modal de Éxito */}
      {success && (
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
                onClick={() => setSuccess(null)}
                className="fluid-px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-fluid-lg font-medium transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-fluid-xl shadow-sm border-2 border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 fluid-px-6 fluid-py-8 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center fluid-gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center fluid-text-2xl font-bold">
                {user.name?.[0] || 'U'}{user.first_surname?.[0] || ''}
              </div>
              <div>
                <h1 className="fluid-text-xl font-bold">{user.full_name}</h1>
                <p className="text-blue-100">{user.username}</p>
                <div className="flex items-center fluid-gap-2 fluid-mt-2">
                  <span className={`fluid-px-3 fluid-py-1 rounded-full fluid-text-sm font-medium ${
                    user.is_active 
                      ? 'bg-green-500/20 text-green-100' 
                      : 'bg-red-500/20 text-red-100'
                  }`}>
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <span className="fluid-px-3 fluid-py-1 rounded-full fluid-text-sm font-medium bg-white/20">
                    {ROLE_LABELS[user.role] || user.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center fluid-gap-2">
              {!isSoporteReadonly && (
              <Link
                to={`/user-management/${user.id}/edit`}
                className="fluid-p-2 bg-white/10 hover:bg-white/20 rounded-fluid-lg transition-colors"
                title="Editar"
              >
                <Edit className="fluid-icon-sm" />
              </Link>
              )}
              {!isSoporteReadonly && user.id !== currentUser?.id && currentUser?.role !== 'developer' && (
                <button
                  onClick={handleToggleActive}
                  className={`fluid-p-2 rounded-fluid-lg transition-colors ${
                    user.is_active 
                      ? 'bg-white/10 hover:bg-red-500/30' 
                      : 'bg-white/10 hover:bg-green-500/30'
                  }`}
                  title={user.is_active ? 'Desactivar' : 'Activar'}
                >
                  <Power className="fluid-icon-sm" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="fluid-p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-6">
            <div className="flex items-start fluid-gap-3 p-4 bg-gray-50 rounded-fluid-xl hover:bg-blue-50 transition-colors">
              <div className="fluid-p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-fluid-xl shadow-sm">
                <Mail className="fluid-icon-sm text-white" />
              </div>
              <div>
                <p className="fluid-text-sm text-gray-500 font-medium">Email</p>
                <p className="font-medium text-gray-900">{user.email}</p>
                {user.is_verified && (
                  <span className="fluid-text-xs text-green-600 font-medium">Verificado</span>
                )}
              </div>
            </div>

            <div className="flex items-start fluid-gap-3 p-4 bg-gray-50 rounded-fluid-xl hover:bg-green-50 transition-colors">
              <div className="fluid-p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-fluid-xl shadow-sm">
                <Phone className="fluid-icon-sm text-white" />
              </div>
              <div>
                <p className="fluid-text-sm text-gray-500 font-medium">Teléfono</p>
                <p className="font-medium text-gray-900">{user.phone || 'No registrado'}</p>
              </div>
            </div>

            <div className="flex items-start fluid-gap-3 p-4 bg-gray-50 rounded-fluid-xl hover:bg-purple-50 transition-colors">
              <div className="fluid-p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-fluid-xl shadow-sm">
                <FileText className="fluid-icon-sm text-white" />
              </div>
              <div>
                <p className="fluid-text-sm text-gray-500 font-medium">CURP</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 font-mono">{user.curp || 'No registrado'}</p>
                  {user.curp && (
                    <CurpVerificationBadge
                      curp={user.curp}
                      curpVerified={user.curp_verified}
                      curpVerifiedAt={user.curp_verified_at}
                    />
                  )}
                </div>
                {user.curp_verified && user.curp_renapo_name && (
                  <div className="mt-2 text-xs text-gray-500 bg-green-50 rounded-lg px-3 py-2">
                    <p className="font-medium text-green-700 mb-1">Datos RENAPO</p>
                    <p>{user.curp_renapo_name} {user.curp_renapo_first_surname} {user.curp_renapo_second_surname}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start fluid-gap-3 p-4 bg-gray-50 rounded-fluid-xl hover:bg-amber-50 transition-colors">
              <div className="fluid-p-3 bg-gradient-to-br from-amber-500 to-amber-600 rounded-fluid-xl shadow-sm">
                <Shield className="fluid-icon-sm text-white" />
              </div>
              <div>
                <p className="fluid-text-sm text-gray-500 font-medium">Rol</p>
                <span className={`inline-flex fluid-px-2 fluid-py-1 rounded-full fluid-text-sm font-medium ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-800'}`}>
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </div>
            </div>

            {user.gender && (
              <div className="flex items-start fluid-gap-3 p-4 bg-gray-50 rounded-fluid-xl hover:bg-indigo-50 transition-colors">
                <div className="fluid-p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-fluid-xl shadow-sm">
                  <Users className="fluid-icon-sm text-white" />
                </div>
                <div>
                  <p className="fluid-text-sm text-gray-500 font-medium">Género</p>
                  <p className="font-medium text-gray-900">
                    {user.gender === 'M' ? 'Masculino' : user.gender === 'F' ? 'Femenino' : 'Otro'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="fluid-mt-8 fluid-pt-6 border-t border-gray-200">
            <h3 className="fluid-text-sm font-semibold text-gray-500 uppercase fluid-mb-4">Información del sistema</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-4 fluid-text-sm">
              <div>
                <p className="text-gray-500">Creado</p>
                <p className="font-medium text-gray-900">
                  {new Date(user.created_at).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Último acceso</p>
                <p className="font-medium text-gray-900">
                  {user.last_login ? new Date(user.last_login).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Nunca'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Coordinador asignado (solo responsables) ── */}
          {(user.role === 'responsable' || user.role === 'responsable_partner') && (
            <div className="fluid-mt-8 fluid-pt-6 border-t border-gray-200">
              <h3 className="fluid-text-sm font-semibold text-gray-500 uppercase fluid-mb-4 flex items-center fluid-gap-2">
                <Shield className="fluid-icon-sm text-indigo-500" />
                Coordinador Asignado
              </h3>
              
              {user.coordinator_name ? (
                <div className="flex items-center fluid-gap-3">
                  <div className="flex items-center fluid-gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    <span className="font-medium text-indigo-800">{user.coordinator_name}</span>
                  </div>
                  {['admin', 'developer', 'gerente', 'soporte'].includes(currentUser?.role || '') && (
                    <button
                      onClick={async () => {
                        setShowCoordinatorChange(true);
                        if (availableCoordinators.length === 0) {
                          setLoadingCoordinators(true);
                          try {
                            const result = await getAvailableCoordinators();
                            setAvailableCoordinators(result.coordinators);
                            if (user.coordinator_id) setSelectedCoordinatorId(user.coordinator_id);
                          } catch (err) {
                            console.error('Error loading coordinators:', err);
                          } finally {
                            setLoadingCoordinators(false);
                          }
                        } else {
                          if (user.coordinator_id) setSelectedCoordinatorId(user.coordinator_id);
                        }
                      }}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
                    >
                      Cambiar
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center fluid-gap-3">
                  <p className="text-gray-400 italic fluid-text-sm">Sin coordinador asignado</p>
                  {['admin', 'developer', 'gerente', 'soporte'].includes(currentUser?.role || '') && (
                    <button
                      onClick={async () => {
                        setShowCoordinatorChange(true);
                        if (availableCoordinators.length === 0) {
                          setLoadingCoordinators(true);
                          try {
                            const result = await getAvailableCoordinators();
                            setAvailableCoordinators(result.coordinators);
                          } catch (err) {
                            console.error('Error loading coordinators:', err);
                          } finally {
                            setLoadingCoordinators(false);
                          }
                        }
                      }}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
                    >
                      Asignar
                    </button>
                  )}
                </div>
              )}

              {showCoordinatorChange && (
                <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccionar coordinador
                  </label>
                  {loadingCoordinators ? (
                    <div className="flex items-center gap-2 py-2 text-gray-500">
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      Cargando coordinadores...
                    </div>
                  ) : (
                    <StyledSelect
                      value={selectedCoordinatorId}
                      onChange={(value) => setSelectedCoordinatorId(value)}
                      options={availableCoordinators.map((c) => ({
                        value: c.id,
                        label: `${c.full_name} (${c.email})`,
                      }))}
                      placeholder="Seleccionar coordinador..."
                      icon={Shield}
                      colorScheme="indigo"
                    />
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      disabled={changingCoordinator || !selectedCoordinatorId}
                      onClick={async () => {
                        setChangingCoordinator(true);
                        try {
                          await updateUser(user.id, { coordinator_id: selectedCoordinatorId });
                          const refreshed = await getUser(user.id);
                          setUser(refreshed);
                          setShowCoordinatorChange(false);
                          setSuccess('Coordinador actualizado correctamente');
                          setTimeout(() => setSuccess(null), 3000);
                        } catch (err: any) {
                          setError(err?.response?.data?.error || 'Error al cambiar coordinador');
                          setTimeout(() => setError(null), 4000);
                        } finally {
                          setChangingCoordinator(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      {changingCoordinator ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => setShowCoordinatorChange(false)}
                      className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Historial de Grupos (solo candidatos) ── */}
          {user.role === 'candidato' && (
            <div className="fluid-mt-8 fluid-pt-6 border-t border-gray-200">
              <h3 className="fluid-text-sm font-semibold text-gray-500 uppercase fluid-mb-4 flex items-center fluid-gap-2">
                <BookOpen className="fluid-icon-sm" />
                Historial de Grupos
              </h3>

              {loadingHistory ? (
                <div className="flex items-center justify-center fluid-py-8">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-3 text-gray-500 fluid-text-sm">Cargando historial...</span>
                </div>
              ) : groupHistory.length === 0 ? (
                <p className="text-gray-400 fluid-text-sm italic fluid-py-4">Este candidato no ha sido asignado a ningún grupo.</p>
              ) : (
                <div className="space-y-3">
                  {groupHistory.map(group => {
                    const isGroupExpanded = expandedGroups.has(group.group_id);
                    return (
                      <div key={group.group_id} className="border border-gray-200 rounded-fluid-xl overflow-hidden">
                        {/* Group header */}
                        <button
                          onClick={() => toggleGroup(group.group_id)}
                          className="w-full flex items-center justify-between fluid-px-4 fluid-py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                        >
                          <div className="flex items-center fluid-gap-3 min-w-0">
                            {isGroupExpanded ? <ChevronDown className="fluid-icon-sm text-gray-500 flex-shrink-0" /> : <ChevronRight className="fluid-icon-sm text-gray-500 flex-shrink-0" />}
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{group.group_name}</p>
                              <div className="flex flex-wrap items-center fluid-gap-2 fluid-text-xs text-gray-500">
                                {group.campus && <span>{group.campus.name}</span>}
                                {group.cycle && <span>• {group.cycle.name}</span>}
                                {group.joined_at && <span>• Ingreso: {new Date(group.joined_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center fluid-gap-2 flex-shrink-0 ml-2">
                            <span className={`fluid-px-2 fluid-py-0.5 rounded-full fluid-text-xs font-medium ${
                              group.membership_status === 'active' ? 'bg-green-100 text-green-700'
                              : group.membership_status === 'completed' ? 'bg-blue-100 text-blue-700'
                              : group.membership_status === 'withdrawn' ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-600'
                            }`}>
                              {group.membership_status === 'active' ? 'Activo' : group.membership_status === 'completed' ? 'Completado' : group.membership_status === 'withdrawn' ? 'Retirado' : 'Inactivo'}
                            </span>
                            <span className="fluid-text-xs text-gray-400">{group.exams.length} {group.exams.length === 1 ? 'examen' : 'exámenes'}</span>
                          </div>
                        </button>

                        {/* Group content - exams */}
                        {isGroupExpanded && (
                          <div className="fluid-px-4 fluid-py-3 space-y-3">
                            {group.exams.length === 0 ? (
                              <p className="text-gray-400 fluid-text-sm italic">Sin exámenes asignados en este grupo.</p>
                            ) : group.exams.map(exam => {
                              const examKey = `${group.group_id}-${exam.group_exam_id}`;
                              const isExamExpanded = expandedExams.has(examKey);
                              const bestResult = exam.results.find(r => r.status === 1 && r.result === 1) || exam.results.find(r => r.status === 1) || exam.results[0];
                              return (
                                <div key={exam.group_exam_id} className="border border-gray-100 rounded-fluid-lg overflow-hidden">
                                  {/* Exam header */}
                                  <button
                                    onClick={() => toggleExam(examKey)}
                                    className="w-full flex items-center justify-between fluid-px-3 fluid-py-2 hover:bg-blue-50/50 transition-colors text-left"
                                  >
                                    <div className="flex items-center fluid-gap-2 min-w-0">
                                      {isExamExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                                      <div className="min-w-0">
                                        <p className="font-medium text-gray-800 fluid-text-sm truncate">{exam.exam_name || `Examen #${exam.exam_id}`}</p>
                                        {exam.competency_standard && (
                                          <p className="fluid-text-xs text-gray-500">{exam.competency_standard.code} — {exam.competency_standard.name}</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center fluid-gap-2 flex-shrink-0 ml-2">
                                      {bestResult ? (
                                        <span className={`fluid-px-2 fluid-py-0.5 rounded-full fluid-text-xs font-medium ${
                                          bestResult.result === 1 ? 'bg-green-100 text-green-700' : bestResult.status === 1 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                          {bestResult.result === 1 ? `Aprobado (${bestResult.score}%)` : bestResult.status === 1 ? `Reprobado (${bestResult.score}%)` : 'En proceso'}
                                        </span>
                                      ) : (
                                        <span className="fluid-px-2 fluid-py-0.5 rounded-full fluid-text-xs font-medium bg-gray-100 text-gray-500">Sin intentos</span>
                                      )}
                                      <span className="fluid-text-xs text-gray-400">{exam.attempts_used}/{exam.max_attempts}</span>
                                    </div>
                                  </button>

                                  {/* Exam detail */}
                                  {isExamExpanded && (
                                    <div className="fluid-px-4 fluid-py-3 bg-gray-50/50 border-t border-gray-100 space-y-4">
                                      {/* Exam info row */}
                                      <div className="grid grid-cols-2 md:grid-cols-4 fluid-gap-3 fluid-text-xs">
                                        <div>
                                          <p className="text-gray-400">Asignado</p>
                                          <p className="font-medium text-gray-700">{exam.assigned_at ? new Date(exam.assigned_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                                        </div>
                                        <div>
                                          <p className="text-gray-400">Puntaje mínimo</p>
                                          <p className="font-medium text-gray-700">{exam.passing_score ?? '—'}%</p>
                                        </div>
                                        <div>
                                          <p className="text-gray-400">Intentos</p>
                                          <p className="font-medium text-gray-700">{exam.attempts_used} de {exam.max_attempts}</p>
                                        </div>
                                        <div>
                                          <p className="text-gray-400">Vigencia</p>
                                          <p className={`font-medium ${exam.is_expired ? 'text-red-600' : 'text-gray-700'}`}>
                                            {exam.expires_at ? (exam.is_expired ? 'Expirado' : new Date(exam.expires_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })) : 'Sin expiración'}
                                          </p>
                                        </div>
                                      </div>

                                      {/* ECM Assignment */}
                                      {exam.ecm_assignment && (
                                        <div className="bg-indigo-50 border border-indigo-200 rounded-fluid-lg fluid-p-3">
                                          <div className="flex items-center fluid-gap-2 fluid-mb-2">
                                            <Hash className="w-3.5 h-3.5 text-indigo-600" />
                                            <p className="font-semibold text-indigo-800 fluid-text-xs">Asignación ECM</p>
                                          </div>
                                          <div className="grid grid-cols-2 md:grid-cols-4 fluid-gap-3 fluid-text-xs">
                                            <div>
                                              <p className="text-indigo-400">No. Asignación</p>
                                              <Link
                                                to={`/asignaciones-ecm/candidato/${exam.ecm_assignment.id}`}
                                                className="inline-flex items-center fluid-gap-1 font-mono font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 rounded-md transition-colors group"
                                                title="Ver detalle de asignación"
                                              >
                                                {exam.ecm_assignment.assignment_number}
                                                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                              </Link>
                                            </div>
                                            <div>
                                              <p className="text-indigo-400">Estado trámite</p>
                                              <p className="font-medium text-indigo-700 capitalize">{exam.ecm_assignment.tramite_status}</p>
                                            </div>
                                            <div>
                                              <p className="text-indigo-400">Fecha asignación</p>
                                              <p className="font-medium text-indigo-700">{exam.ecm_assignment.assigned_at ? new Date(exam.ecm_assignment.assigned_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                                            </div>
                                            <div>
                                              <p className="text-indigo-400">Vigencia ECM</p>
                                              <p className={`font-medium ${exam.ecm_assignment.is_expired ? 'text-red-600' : 'text-indigo-700'}`}>
                                                {exam.ecm_assignment.expires_at ? (exam.ecm_assignment.is_expired ? 'Expirado' : new Date(exam.ecm_assignment.expires_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })) : 'Sin expiración'}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Results table */}
                                      {exam.results.length > 0 && (
                                        <div>
                                          <p className="font-semibold text-gray-600 fluid-text-xs fluid-mb-2 flex items-center fluid-gap-1">
                                            <Award className="w-3.5 h-3.5" /> Resultados ({exam.results.length})
                                          </p>
                                          <div className="overflow-x-auto">
                                            <table className="w-full fluid-text-xs">
                                              <thead>
                                                <tr className="border-b border-gray-200">
                                                  <th className="text-left fluid-py-1.5 fluid-px-2 text-gray-400 font-medium">#</th>
                                                  <th className="text-left fluid-py-1.5 fluid-px-2 text-gray-400 font-medium">Fecha</th>
                                                  <th className="text-center fluid-py-1.5 fluid-px-2 text-gray-400 font-medium">Puntaje</th>
                                                  <th className="text-center fluid-py-1.5 fluid-px-2 text-gray-400 font-medium">Resultado</th>
                                                  <th className="text-center fluid-py-1.5 fluid-px-2 text-gray-400 font-medium">Duración</th>
                                                  <th className="text-left fluid-py-1.5 fluid-px-2 text-gray-400 font-medium">Certificado</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {exam.results.map((r, idx) => (
                                                  <tr key={r.id} className="border-b border-gray-100 last:border-0">
                                                    <td className="fluid-py-1.5 fluid-px-2 text-gray-500">{exam.results.length - idx}</td>
                                                    <td className="fluid-py-1.5 fluid-px-2 text-gray-700">
                                                      <div className="flex items-center fluid-gap-1">
                                                        <Calendar className="w-3 h-3 text-gray-400" />
                                                        {r.start_date ? new Date(r.start_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                      </div>
                                                    </td>
                                                    <td className="fluid-py-1.5 fluid-px-2 text-center font-bold">{r.score}%</td>
                                                    <td className="fluid-py-1.5 fluid-px-2 text-center">
                                                      <span className={`fluid-px-2 fluid-py-0.5 rounded-full font-medium ${
                                                        r.status === 0 ? 'bg-yellow-100 text-yellow-700'
                                                        : r.result === 1 ? 'bg-green-100 text-green-700'
                                                        : r.status === 2 ? 'bg-orange-100 text-orange-700'
                                                        : 'bg-red-100 text-red-700'
                                                      }`}>
                                                        {r.status === 0 ? 'En proceso' : r.result === 1 ? 'Aprobado' : r.status === 2 ? 'Abandonado' : 'Reprobado'}
                                                      </span>
                                                    </td>
                                                    <td className="fluid-py-1.5 fluid-px-2 text-center text-gray-600">
                                                      <div className="flex items-center justify-center fluid-gap-1">
                                                        <Clock className="w-3 h-3 text-gray-400" />
                                                        {formatDuration(r.duration_seconds)}
                                                      </div>
                                                    </td>
                                                    <td className="fluid-py-1.5 fluid-px-2 text-gray-600 font-mono">
                                                      {r.certificate_code || r.eduit_certificate_code || '—'}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="fluid-mt-8 fluid-pt-6 border-t border-gray-200 flex flex-wrap fluid-gap-3">
            {/* Si soporte ve un rol readonly, solo mostrar "Enviar contraseña por correo" */}
            {isSoporteReadonly ? (
              <button
                onClick={handleSendPasswordEmail}
                disabled={sendingEmail}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-fluid-lg font-medium transition-colors disabled:opacity-50"
              >
                {sendingEmail ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="fluid-icon-sm" />
                    Enviar Contraseña por Correo
                  </>
                )}
              </button>
            ) : (
              <>
            <Link
              to={`/user-management/${user.id}/edit`}
              className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-lg font-medium transition-colors"
            >
              <Edit className="fluid-icon-sm" />
              Editar Usuario
            </Link>
            
            <button
              onClick={() => setShowPasswordModal(true)}
              className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-fluid-lg font-medium transition-colors"
            >
              <Key className="fluid-icon-sm" />
              Cambiar Contraseña
            </button>

            {(currentUser?.role === 'admin' || currentUser?.role === 'developer' || currentUser?.role === 'coordinator') && user.id !== currentUser?.id && (
              <button
                onClick={handleViewUserPassword}
                disabled={loadingPassword}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 border border-purple-300 text-purple-700 hover:bg-purple-50 rounded-fluid-lg font-medium transition-colors disabled:opacity-50"
              >
                {loadingPassword ? (
                  <>
                    <div className="w-4 h-4 border-2 border-purple-700 border-t-transparent rounded-full animate-spin" />
                    Cargando...
                  </>
                ) : (
                  <>
                    <Eye className="fluid-icon-sm" />
                    Ver Contraseña
                  </>
                )}
              </button>
            )}

            {user.id !== currentUser?.id && currentUser?.role !== 'developer' && (
              <button
                onClick={handleToggleActive}
                className={`inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-fluid-lg font-medium transition-colors ${
                  user.is_active
                    ? 'border border-red-300 text-red-700 hover:bg-red-50'
                    : 'border border-green-300 text-green-700 hover:bg-green-50'
                }`}
              >
                {user.is_active ? (
                  <>
                    <UserX className="fluid-icon-sm" />
                    Desactivar
                  </>
                ) : (
                  <>
                    <UserCheck className="fluid-icon-sm" />
                    Activar
                  </>
                )}
              </button>
            )}

            {/* Enviar contraseña por correo - Soporte sobre roles editables */}
            {isSoporte && !isSoporteReadonly && (
              <button
                onClick={handleSendPasswordEmail}
                disabled={sendingEmail}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-fluid-lg font-medium transition-colors disabled:opacity-50"
              >
                {sendingEmail ? (
                  <>
                    <div className="w-4 h-4 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="fluid-icon-sm" />
                    Enviar Contraseña por Correo
                  </>
                )}
              </button>
            )}

            {/* Botón Eliminar Usuario - Solo Admin */}
            {currentUser?.role === 'admin' && user.id !== currentUser?.id && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-red-600 hover:bg-red-700 text-white rounded-fluid-lg font-medium transition-colors"
              >
                <Trash2 className="fluid-icon-sm" />
                Eliminar Usuario
              </button>
            )}
              </>
            )}
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-xl shadow-xl w-full max-w-md animate-fade-in-up">
            <div className="fluid-p-6">
              <div className="flex items-center justify-between fluid-mb-4">
                <h3 className="fluid-text-lg font-semibold text-gray-900">Cambiar Contraseña</h3>
                <button
                  onClick={() => { setShowPasswordModal(false); setNewPassword(''); }}
                  className="fluid-p-2 text-gray-500 hover:text-gray-700 rounded-fluid-lg"
                >
                  <X className="fluid-icon-sm" />
                </button>
              </div>

              <p className="fluid-text-sm text-gray-600 fluid-mb-4">
                Establecer nueva contraseña para <strong>{user.full_name}</strong>
              </p>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña"
                  className="w-full fluid-px-4 py-2.5 fluid-pr-10 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="fluid-icon-sm" /> : <Eye className="fluid-icon-sm" />}
                </button>
              </div>
              <p className="fluid-text-xs text-gray-500 fluid-mt-1">Mínimo 8 caracteres</p>

              <div className="flex justify-end fluid-gap-3 fluid-mt-6">
                <button
                  onClick={() => { setShowPasswordModal(false); setNewPassword(''); }}
                  className="fluid-px-4 fluid-py-2 border border-gray-300 text-gray-700 rounded-fluid-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={!newPassword || newPassword.length < 8 || changingPassword}
                  className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changingPassword ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Cambiar Contraseña'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para mostrar contraseña (solo admin) */}
      {showGeneratedPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-xl shadow-xl w-full max-w-md animate-fade-in-up">
            <div className="fluid-p-6">
              <div className="flex items-center justify-between fluid-mb-4">
                <h3 className="fluid-text-lg font-semibold text-gray-900">
                  {generatedPassword ? 'Contraseña del Usuario' : 'Contraseña No Disponible'}
                </h3>
                <button
                  onClick={() => { 
                    setShowGeneratedPasswordModal(false); 
                    setGeneratedPassword(null); 
                    setStoredPasswordError(null);
                    setShowStoredPassword(false);
                  }}
                  className="fluid-p-2 text-gray-500 hover:text-gray-700 rounded-fluid-lg"
                >
                  <X className="fluid-icon-sm" />
                </button>
              </div>

              {generatedPassword ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-fluid-lg fluid-p-4 fluid-mb-4">
                    <p className="fluid-text-sm text-blue-800">
                      <strong>Nota:</strong> Esta es la contraseña actual del usuario. Manéjala con cuidado.
                    </p>
                  </div>

                  <p className="fluid-text-sm text-gray-600 fluid-mb-3">
                    Contraseña de <strong>{user.full_name}</strong>:
                  </p>

                  <div className="relative">
                    <input
                      type={showStoredPassword ? 'text' : 'password'}
                      value={generatedPassword}
                      readOnly
                      className="w-full fluid-px-4 py-3 bg-gray-100 border border-gray-300 rounded-fluid-lg font-mono fluid-text-lg text-center select-all fluid-pr-24"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center fluid-gap-1">
                      <button
                        onClick={() => setShowStoredPassword(!showStoredPassword)}
                        className="fluid-p-2 text-gray-500 hover:text-gray-700"
                        title={showStoredPassword ? 'Ocultar' : 'Mostrar'}
                      >
                        {showStoredPassword ? <EyeOff className="fluid-icon-sm" /> : <Eye className="fluid-icon-sm" />}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedPassword);
                          setSuccess('Contraseña copiada al portapapeles');
                        }}
                        className="fluid-px-2 fluid-py-1 bg-blue-600 text-white rounded-fluid text-sm hover:bg-blue-700"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-fluid-lg fluid-p-4 fluid-mb-4">
                    <p className="fluid-text-sm text-yellow-800">
                      {storedPasswordError || 'La contraseña de este usuario no está disponible porque fue creada antes del sistema de recuperación.'}
                    </p>
                  </div>

                  <p className="fluid-text-sm text-gray-600 fluid-mb-4">
                    Puedes generar una nueva contraseña temporal para <strong>{user.full_name}</strong>:
                  </p>

                  <button
                    onClick={() => {
                      handleGenerateTempPassword();
                    }}
                    disabled={generatingPassword}
                    className="w-full inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-fluid-lg font-medium disabled:opacity-50"
                  >
                    {generatingPassword ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Key className="fluid-icon-sm" />
                        Generar Nueva Contraseña
                      </>
                    )}
                  </button>
                </>
              )}

              <div className="flex justify-end fluid-mt-6">
                <button
                  onClick={() => { 
                    setShowGeneratedPasswordModal(false); 
                    setGeneratedPassword(null);
                    setStoredPasswordError(null);
                    setShowStoredPassword(false);
                  }}
                  className="fluid-px-4 fluid-py-2 bg-gray-600 text-white rounded-fluid-lg hover:bg-gray-700"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar usuario (solo admin) */}
      {showDeleteModal && user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-xl shadow-xl w-full max-w-md animate-fade-in-up">
            <div className="fluid-p-6">
              <div className="flex items-center justify-between fluid-mb-4">
                <h3 className="fluid-text-lg font-semibold text-red-600">Eliminar Usuario</h3>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="fluid-p-2 text-gray-500 hover:text-gray-700 rounded-fluid-lg"
                >
                  <X className="fluid-icon-sm" />
                </button>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-4 fluid-mb-4">
                <p className="fluid-text-sm text-red-800">
                  <strong>¡Advertencia!</strong> Esta acción es irreversible. Se eliminará permanentemente el usuario y todos sus datos asociados.
                </p>
              </div>

              <p className="fluid-text-sm text-gray-600 fluid-mb-4">
                ¿Estás seguro de que deseas eliminar al usuario <strong>{user.full_name}</strong> ({user.email})?
              </p>

              <div className="flex justify-end fluid-gap-3 fluid-mt-6">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="fluid-px-4 fluid-py-2 border border-gray-300 text-gray-700 rounded-fluid-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deleting}
                  className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-red-600 hover:bg-red-700 text-white rounded-fluid-lg font-medium disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="fluid-icon-sm" />
                      Sí, Eliminar
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
