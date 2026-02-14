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
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getUser,
  toggleUserActive,
  changeUserPassword,
  generateTempPassword,
  getUserPassword,
  deleteUser,
  ManagedUser,
  ROLE_LABELS,
  ROLE_COLORS,
} from '../../services/userManagementService';
import { useAuthStore } from '../../store/authStore';

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

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const data = await getUser(userId!);
      setUser(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!user) return;
    
    try {
      const result = await toggleUserActive(user.id);
      setUser(result.user);
      setSuccess(result.user.is_active ? 'Usuario activado' : 'Usuario desactivado');
      setTimeout(() => setSuccess(null), 3000);
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
      setTimeout(() => setSuccess(null), 3000);
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
      setTimeout(() => setSuccess(null), 3000);
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

      {error && (
        <div className="fluid-mb-6 bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-4 flex items-center fluid-gap-3 text-red-700">
          <AlertCircle className="fluid-icon-sm flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="fluid-icon-sm" />
          </button>
        </div>
      )}

      {success && (
        <div className="fluid-mb-6 bg-green-50 border border-green-200 rounded-fluid-lg fluid-p-4 flex items-center fluid-gap-3 text-green-700">
          <CheckCircle className="fluid-icon-sm flex-shrink-0" />
          {success}
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
                <p className="text-blue-100">@{user.username}</p>
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
              <Link
                to={`/user-management/${user.id}/edit`}
                className="fluid-p-2 bg-white/10 hover:bg-white/20 rounded-fluid-lg transition-colors"
                title="Editar"
              >
                <Edit className="fluid-icon-sm" />
              </Link>
              {user.id !== currentUser?.id && currentUser?.role !== 'developer' && (
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
                <p className="font-medium text-gray-900 font-mono">{user.curp || 'No registrado'}</p>
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

          <div className="fluid-mt-8 fluid-pt-6 border-t border-gray-200 flex flex-wrap fluid-gap-3">
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
                          setTimeout(() => setSuccess(null), 2000);
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
                      setShowGeneratedPasswordModal(false);
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
