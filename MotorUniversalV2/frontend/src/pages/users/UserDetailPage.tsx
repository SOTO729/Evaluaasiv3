/**
 * Página de detalle de usuario
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getUser,
  toggleUserActive,
  changeUserPassword,
  ManagedUser,
  ROLE_LABELS,
  ROLE_COLORS,
} from '../../services/userManagementService';
import { useAuthStore } from '../../store/authStore';

export default function UserDetailPage() {
  const { userId } = useParams();
  const { user: currentUser } = useAuthStore();

  const [user, setUser] = useState<ManagedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando usuario..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Usuario no encontrado</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link
            to="/user-management"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a usuarios
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-4xl mx-auto animate-fade-in-up">
      <div className="mb-6 lg:mb-8">
        <Link
          to="/user-management"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a usuarios
        </Link>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 text-green-700">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-white/20 flex items-center justify-center text-2xl lg:text-3xl font-bold">
                {user.name?.[0] || 'U'}{user.first_surname?.[0] || ''}
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold">{user.full_name}</h1>
                <p className="text-blue-100">@{user.username}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    user.is_active 
                      ? 'bg-green-500/20 text-green-100' 
                      : 'bg-red-500/20 text-red-100'
                  }`}>
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20">
                    {ROLE_LABELS[user.role] || user.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/user-management/${user.id}/edit`}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit className="h-5 w-5" />
              </Link>
              {user.id !== currentUser?.id && (
                <button
                  onClick={handleToggleActive}
                  className={`p-2 rounded-lg transition-colors ${
                    user.is_active 
                      ? 'bg-white/10 hover:bg-red-500/30' 
                      : 'bg-white/10 hover:bg-green-500/30'
                  }`}
                  title={user.is_active ? 'Desactivar' : 'Activar'}
                >
                  <Power className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 lg:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{user.email}</p>
                {user.is_verified && (
                  <span className="text-xs text-green-600">✓ Verificado</span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Phone className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Teléfono</p>
                <p className="font-medium text-gray-900">{user.phone || 'No registrado'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">CURP</p>
                <p className="font-medium text-gray-900 font-mono">{user.curp || 'No registrado'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Shield className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Rol</p>
                <span className={`inline-flex px-2 py-1 rounded-full text-sm font-medium ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-800'}`}>
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </div>
            </div>

            {user.gender && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Género</p>
                  <p className="font-medium text-gray-900">
                    {user.gender === 'M' ? 'Masculino' : user.gender === 'F' ? 'Femenino' : 'Otro'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Información del sistema</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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

          <div className="mt-8 pt-6 border-t border-gray-200 flex flex-wrap gap-3">
            <Link
              to={`/user-management/${user.id}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Edit className="h-4 w-4" />
              Editar Usuario
            </Link>
            
            <button
              onClick={() => setShowPasswordModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors"
            >
              <Key className="h-4 w-4" />
              Cambiar Contraseña
            </button>

            {user.id !== currentUser?.id && (
              <button
                onClick={handleToggleActive}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  user.is_active
                    ? 'border border-red-300 text-red-700 hover:bg-red-50'
                    : 'border border-green-300 text-green-700 hover:bg-green-50'
                }`}
              >
                {user.is_active ? (
                  <>
                    <UserX className="h-4 w-4" />
                    Desactivar
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4" />
                    Activar
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-xl w-full max-w-md animate-fade-in-up">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Cambiar Contraseña</h3>
                <button
                  onClick={() => { setShowPasswordModal(false); setNewPassword(''); }}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Establecer nueva contraseña para <strong>{user.full_name}</strong>
              </p>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña"
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Mínimo 8 caracteres</p>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { setShowPasswordModal(false); setNewPassword(''); }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={!newPassword || newPassword.length < 8 || changingPassword}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
}
