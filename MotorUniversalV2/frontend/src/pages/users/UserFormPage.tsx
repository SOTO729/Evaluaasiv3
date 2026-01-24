/**
 * Página para crear o editar usuarios
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Users,
  Save,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getUser,
  createUser,
  updateUser,
  getAvailableRoles,
  CreateUserData,
  UpdateUserData,
  RoleOption,
} from '../../services/userManagementService';
import { useAuthStore } from '../../store/authStore';

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
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    first_surname: '',
    second_surname: '',
    curp: '',
    role: 'candidato',
    phone: '',
    is_active: true,
    gender: '',
  });

  useEffect(() => {
    loadRoles();
    if (isEditing) {
      loadUser();
    }
  }, [userId]);

  const loadRoles = async () => {
    try {
      const data = await getAvailableRoles();
      setRoles(data.roles);
      if (data.roles.length === 1) {
        setFormData(prev => ({ ...prev, role: data.roles[0].value }));
      }
    } catch (err) {
      console.error('Error loading roles:', err);
    }
  };

  const loadUser = async () => {
    try {
      setLoading(true);
      const data = await getUser(userId!);
      setFormData({
        username: data.username || '',
        email: data.email || '',
        password: '',
        name: data.name || '',
        first_surname: data.first_surname || '',
        second_surname: data.second_surname || '',
        curp: data.curp || '',
        role: data.role || 'candidato',
        phone: data.phone || '',
        is_active: data.is_active ?? true,
        gender: data.gender || '',
      });
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

    if (!formData.username.trim()) {
      setError('El nombre de usuario es requerido');
      return;
    }
    if (!formData.email.trim()) {
      setError('El email es requerido');
      return;
    }
    if (!isEditing && !formData.password) {
      setError('La contraseña es requerida');
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

    try {
      setSaving(true);

      if (isEditing) {
        const updateData: UpdateUserData = {
          email: formData.email,
          name: formData.name,
          first_surname: formData.first_surname,
          second_surname: formData.second_surname || undefined,
          curp: formData.curp || undefined,
          phone: formData.phone || undefined,
          is_active: formData.is_active,
          gender: formData.gender || undefined,
        };

        if (currentUser?.role === 'admin') {
          updateData.role = formData.role;
        }

        await updateUser(userId!, updateData);
        setSuccess('Usuario actualizado correctamente');
        setTimeout(() => navigate('/user-management'), 1500);
      } else {
        const createData: CreateUserData = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          name: formData.name,
          first_surname: formData.first_surname,
          second_surname: formData.second_surname || undefined,
          role: formData.role,
          curp: formData.curp || undefined,
          phone: formData.phone || undefined,
          gender: formData.gender || undefined,
        };

        await createUser(createData);
        setSuccess('Usuario creado correctamente');
        setTimeout(() => navigate('/user-management'), 1500);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar usuario');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-12 3xl:p-14 4xl:p-16 max-w-[1920px] 3xl:max-w-[2400px] 4xl:max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando usuario..." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-12 3xl:p-14 4xl:p-16 max-w-4xl 3xl:max-w-[2400px] 4xl:max-w-[2800px] mx-auto animate-fade-in-up">
      <div className="mb-6 lg:mb-8">
        <Link
          to="/user-management"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a usuarios
        </Link>
        
        <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-bold text-gray-800 flex items-center gap-3">
          <Users className="h-6 w-6 lg:h-8 lg:w-8 xl:h-10 xl:w-10 2xl:h-12 2xl:w-12 text-blue-600" />
          {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
        </h1>
        <p className="text-sm lg:text-base text-gray-600 mt-1">
          {isEditing ? 'Modifica los datos del usuario' : 'Completa los datos para crear un nuevo usuario'}
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 text-green-700">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-6 lg:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de usuario <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              disabled={isEditing}
              placeholder="usuario123"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {isEditing && (
              <p className="text-xs text-gray-500 mt-1">El nombre de usuario no se puede cambiar</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="usuario@email.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
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
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol <span className="text-red-500">*</span>
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              disabled={isEditing && currentUser?.role !== 'admin'}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {roles.map(role => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            {isEditing && currentUser?.role !== 'admin' && (
              <p className="text-xs text-gray-500 mt-1">Solo administradores pueden cambiar roles</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre(s) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Juan"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Primer Apellido <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="first_surname"
              value={formData.first_surname}
              onChange={handleChange}
              placeholder="Pérez"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Segundo Apellido
            </label>
            <input
              type="text"
              name="second_surname"
              value={formData.second_surname}
              onChange={handleChange}
              placeholder="García"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CURP
            </label>
            <input
              type="text"
              name="curp"
              value={formData.curp}
              onChange={handleChange}
              placeholder="XXXX000000XXXXXX00"
              maxLength={18}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="5512345678"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Género
            </label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">No especificado</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
              <option value="O">Otro</option>
            </select>
          </div>

          {isEditing && (
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Usuario activo
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-8">
                Los usuarios inactivos no pueden iniciar sesión
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-gray-200">
          <Link
            to="/user-management"
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                {isEditing ? 'Guardar Cambios' : 'Crear Usuario'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
