/**
 * Página para crear o editar usuarios
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
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getUser,
  createUser,
  updateUser,
  getAvailableRoles,
  getAvailableCampuses,
  CreateUserData,
  UpdateUserData,
  RoleOption,
  AvailableCampus,
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
  const [existingUsername, setExistingUsername] = useState<string>('');
  
  // Estados para responsable
  const [availableCampuses, setAvailableCampuses] = useState<AvailableCampus[]>([]);
  const [loadingCampuses, setLoadingCampuses] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ username: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    first_surname: '',
    second_surname: '',
    curp: '',
    role: 'candidato',
    is_active: true,
    gender: '',
    // Campos adicionales para responsable
    date_of_birth: '',
    campus_id: 0,
    can_bulk_create_candidates: false,
    can_manage_groups: false,
  });

  useEffect(() => {
    loadRoles();
    if (isEditing) {
      loadUser();
    }
  }, [userId]);

  // Cargar campuses cuando se selecciona rol responsable
  useEffect(() => {
    if (formData.role === 'responsable' && !isEditing) {
      loadCampuses();
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
        date_of_birth: '',
        campus_id: 0,
        can_bulk_create_candidates: false,
        can_manage_groups: false,
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

    if (!formData.email.trim()) {
      setError('El email es requerido');
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
    
    // Para candidatos, todos los campos son obligatorios
    if (formData.role === 'candidato') {
      if (!formData.second_surname.trim()) {
        setError('El segundo apellido es requerido para candidatos');
        return;
      }
      if (!formData.curp.trim()) {
        setError('El CURP es requerido para candidatos');
        return;
      }
      if (formData.curp.trim().length !== 18) {
        setError('El CURP debe tener exactamente 18 caracteres');
        return;
      }
      if (!formData.gender) {
        setError('El género es requerido para candidatos');
        return;
      }
    }

    // Para responsables, campos adicionales son obligatorios
    if (formData.role === 'responsable') {
      if (!formData.second_surname.trim()) {
        setError('El segundo apellido es requerido para responsables');
        return;
      }
      if (!formData.curp.trim()) {
        setError('El CURP es requerido para responsables');
        return;
      }
      if (formData.curp.trim().length !== 18) {
        setError('El CURP debe tener exactamente 18 caracteres');
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

    try {
      setSaving(true);

      if (isEditing) {
        const updateData: UpdateUserData = {
          email: formData.email,
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

        await updateUser(userId!, updateData);
        setSuccess('Usuario actualizado correctamente');
        setTimeout(() => navigate('/user-management'), 1500);
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
        }

        const result = await createUser(createData);
        
        // Si es responsable, mostrar las credenciales temporales
        if (formData.role === 'responsable' && (result as any).temporary_password) {
          setCreatedCredentials({
            username: result.user.username,
            password: (result as any).temporary_password
          });
          setSuccess('Responsable creado exitosamente. Guarda las credenciales de acceso.');
        } else {
          setSuccess('Usuario creado correctamente');
          setTimeout(() => navigate('/user-management'), 1500);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar usuario');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando usuario..." />
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-4xl mx-auto animate-fade-in-up">
      <div className="fluid-mb-6">
        <Link
          to="/user-management"
          className="inline-flex items-center fluid-gap-2 text-gray-600 hover:text-gray-800 fluid-mb-4"
        >
          <ArrowLeft className="fluid-icon-sm" />
          Volver a usuarios
        </Link>
        
        <h1 className="fluid-text-2xl font-bold text-gray-800 flex items-center fluid-gap-3">
          <Users className="fluid-icon-lg text-blue-600" />
          {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
        </h1>
        <p className="fluid-text-sm text-gray-600 fluid-mt-1">
          {isEditing ? 'Modifica los datos del usuario' : 'Completa los datos para crear un nuevo usuario'}
        </p>
      </div>

      {error && (
        <div className="fluid-mb-6 bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-4 flex items-center fluid-gap-3 text-red-700">
          <AlertCircle className="fluid-icon-sm flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="fluid-mb-6 bg-green-50 border border-green-200 rounded-fluid-lg fluid-p-4 flex items-center fluid-gap-3 text-green-700">
          <CheckCircle className="fluid-icon-sm flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Mostrar credenciales del responsable creado */}
      {createdCredentials && (
        <div className="fluid-mb-6 bg-amber-50 border border-amber-200 rounded-fluid-xl fluid-p-6">
          <div className="flex items-start fluid-gap-3 fluid-mb-4">
            <Key className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Credenciales del Responsable</p>
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

      {!createdCredentials && (
      <form onSubmit={handleSubmit} className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-6">
          {/* Username solo se muestra al editar (es generado automáticamente) */}
          {isEditing && (
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                Nombre de usuario
              </label>
              <div className="w-full fluid-px-4 py-2.5 border border-gray-200 rounded-fluid-lg bg-gray-50 text-gray-600 font-mono">
                {existingUsername || '—'}
              </div>
              <p className="fluid-text-xs text-gray-500 fluid-mt-1">Generado automáticamente, no se puede cambiar</p>
            </div>
          )}

          <div>
            <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="usuario@email.com"
              className="w-full fluid-px-4 py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {!isEditing && (
            <div className="bg-blue-50 border border-blue-200 rounded-fluid-lg fluid-p-4">
              <p className="fluid-text-sm text-blue-700">
                <strong>Nota:</strong> Se generará una contraseña automática para este usuario.
              </p>
            </div>
          )}

          <div>
            <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
              Rol <span className="text-red-500">*</span>
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              disabled={isEditing && currentUser?.role !== 'admin'}
              className="w-full fluid-px-4 py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {roles.map(role => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            {isEditing && currentUser?.role !== 'admin' && (
              <p className="fluid-text-xs text-gray-500 fluid-mt-1">Solo administradores pueden cambiar roles</p>
            )}
          </div>

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
              className="w-full fluid-px-4 py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

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
              className="w-full fluid-px-4 py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
              Segundo Apellido {(formData.role === 'candidato' || formData.role === 'responsable') && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              name="second_surname"
              value={formData.second_surname}
              onChange={handleChange}
              placeholder="García"
              className="w-full fluid-px-4 py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {formData.role !== 'editor' && (
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                CURP {(formData.role === 'candidato' || formData.role === 'responsable') && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                name="curp"
                value={formData.curp}
                onChange={handleChange}
                placeholder="XXXX000000XXXXXX00"
                maxLength={18}
                className="w-full fluid-px-4 py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
              />
              {(formData.role === 'candidato' || formData.role === 'responsable') && (
                <p className="fluid-text-xs text-gray-500 fluid-mt-1">18 caracteres exactos</p>
              )}
            </div>
          )}

          <div>
            <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
              Género {(formData.role === 'candidato' || formData.role === 'responsable') && <span className="text-red-500">*</span>}
            </label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full fluid-px-4 py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccionar...</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
              <option value="O">Otro</option>
            </select>
          </div>

          {/* Campos adicionales para responsables */}
          {formData.role === 'responsable' && !isEditing && (
            <>
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                  Fecha de Nacimiento <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  className="w-full fluid-px-4 py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                  Plantel <span className="text-red-500">*</span>
                </label>
                {loadingCampuses ? (
                  <div className="flex items-center fluid-gap-2 fluid-py-2 text-gray-500">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Cargando planteles...
                  </div>
                ) : (
                  <select
                    name="campus_id"
                    value={formData.campus_id}
                    onChange={handleChange}
                    className="w-full fluid-px-4 py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={0}>Seleccionar plantel...</option>
                    {availableCampuses.map(campus => (
                      <option key={campus.id} value={campus.id}>
                        {campus.partner_name} - {campus.name} ({campus.code})
                      </option>
                    ))}
                  </select>
                )}
                {availableCampuses.length === 0 && !loadingCampuses && (
                  <p className="fluid-text-xs text-amber-600 fluid-mt-1">
                    No hay planteles disponibles para asignar. Cree primero un plantel.
                  </p>
                )}
              </div>

              <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-fluid-lg fluid-p-4">
                <p className="fluid-text-sm font-medium text-blue-800 fluid-mb-3 flex items-center fluid-gap-2">
                  <Building2 className="fluid-icon-sm" />
                  Permisos del Responsable
                </p>
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
                </div>
              </div>
            </>
          )}

          {isEditing && (
            <div className="md:col-span-2">
              <label className="flex items-center fluid-gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="fluid-text-sm font-medium text-gray-700">
                  Usuario activo
                </span>
              </label>
              <p className="fluid-text-xs text-gray-500 fluid-mt-1 ml-8">
                Los usuarios inactivos no pueden iniciar sesión
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end fluid-gap-4 fluid-mt-8 fluid-pt-6 border-t border-gray-200">
          <Link
            to="/user-management"
            className="fluid-px-6 py-2.5 border border-gray-300 text-gray-700 rounded-fluid-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center fluid-gap-2 fluid-px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="fluid-icon-sm" />
                {isEditing ? 'Guardar Cambios' : 'Crear Usuario'}
              </>
            )}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
