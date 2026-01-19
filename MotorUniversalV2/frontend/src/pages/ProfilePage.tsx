import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { authService } from '../services/authService'
import api from '../services/api'
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  CheckCircle2, 
  AlertCircle,
  Edit3,
  Save,
  X,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  IdCard
} from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  username: string
  name: string
  first_surname: string
  second_surname?: string
  full_name: string
  gender?: string
  role: string
  is_active: boolean
  is_verified: boolean
  created_at: string
  last_login?: string
  curp?: string
  phone?: string
  campus_id?: number
  subsystem_id?: number
  pending_email?: string
}

const ProfilePage = () => {
  const { updateUser } = useAuthStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Estados de edición
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    first_surname: '',
    second_surname: '',
    phone: '',
    gender: ''
  })
  
  // Estados para cambio de email
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [showEmailPassword, setShowEmailPassword] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  
  // Estados para cambio de contraseña
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      const userData = await authService.getCurrentUser()
      setProfile(userData as UserProfile)
      setEditData({
        name: userData.name || '',
        first_surname: userData.first_surname || '',
        second_surname: userData.second_surname || '',
        phone: userData.phone || '',
        gender: userData.gender || ''
      })
    } catch (err: any) {
      console.error('Error loading profile:', err)
      setError(err.response?.data?.error || 'Error al cargar el perfil')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!profile) return
    
    try {
      setSaving(true)
      setError(null)
      
      const response = await api.put(`/users/${profile.id}`, editData)
      
      setProfile(response.data.user)
      updateUser(response.data.user)
      setIsEditing(false)
      setSuccess('Perfil actualizado correctamente')
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Error updating profile:', err)
      setError(err.response?.data?.error || 'Error al actualizar el perfil')
    } finally {
      setSaving(false)
    }
  }

  const handleChangeEmail = async () => {
    if (!newEmail || !emailPassword) {
      setEmailError('Por favor ingresa el nuevo correo y tu contraseña')
      return
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      setEmailError('Por favor ingresa un correo electrónico válido')
      return
    }
    
    try {
      setEmailLoading(true)
      setEmailError(null)
      
      await api.post('/auth/request-email-change', {
        new_email: newEmail,
        password: emailPassword
      })
      
      setShowEmailModal(false)
      setNewEmail('')
      setEmailPassword('')
      setSuccess('Se ha enviado un correo de verificación a tu nueva dirección. Por favor revisa tu bandeja de entrada.')
      
      // Recargar perfil para mostrar email pendiente
      await loadProfile()
      
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      console.error('Error requesting email change:', err)
      setEmailError(err.response?.data?.error || 'Error al solicitar el cambio de correo')
    } finally {
      setEmailLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Por favor completa todos los campos')
      return
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden')
      return
    }
    
    if (newPassword.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    
    try {
      setPasswordLoading(true)
      setPasswordError(null)
      
      await authService.changePassword(currentPassword, newPassword)
      
      setShowPasswordModal(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Contraseña actualizada correctamente')
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Error changing password:', err)
      setPasswordError(err.response?.data?.error || 'Error al cambiar la contraseña')
    } finally {
      setPasswordLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { label: string; color: string }> = {
      admin: { label: 'Administrador', color: 'bg-red-100 text-red-700' },
      editor: { label: 'Editor', color: 'bg-blue-100 text-blue-700' },
      soporte: { label: 'Soporte', color: 'bg-purple-100 text-purple-700' },
      candidato: { label: 'Candidato', color: 'bg-green-100 text-green-700' },
      auxiliar: { label: 'Auxiliar', color: 'bg-amber-100 text-amber-700' }
    }
    return roles[role] || { label: role, color: 'bg-gray-100 text-gray-700' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        <p>{error}</p>
        <button 
          onClick={loadProfile}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const roleBadge = getRoleBadge(profile?.role || '')

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Mi Perfil</h1>
          <p className="text-sm text-gray-500">Administra tu información personal</p>
        </div>
        
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            Editar Perfil
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsEditing(false)
                setEditData({
                  name: profile?.name || '',
                  first_surname: profile?.first_surname || '',
                  second_surname: profile?.second_surname || '',
                  phone: profile?.phone || '',
                  gender: profile?.gender || ''
                })
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar
            </button>
          </div>
        )}
      </div>

      {/* Mensajes de éxito/error */}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Card Principal del Perfil */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 overflow-hidden">
        {/* Header con Avatar */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white text-2xl sm:text-3xl font-bold">
              {profile?.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'U'}
            </div>
            <div className="text-center sm:text-left text-white">
              <h2 className="text-xl sm:text-2xl font-bold">{profile?.full_name}</h2>
              <p className="text-blue-100 text-sm sm:text-base">@{profile?.username}</p>
              <div className="mt-2">
                <span className={`inline-block px-3 py-1 text-xs sm:text-sm font-medium rounded-full ${roleBadge.color}`}>
                  {roleBadge.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Información del Perfil */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Sección de Información Personal */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Información Personal
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-1">Nombre(s)</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                ) : (
                  <p className="text-sm sm:text-base text-gray-800">{profile?.name || '-'}</p>
                )}
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-1">Primer Apellido</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.first_surname}
                    onChange={(e) => setEditData({ ...editData, first_surname: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                ) : (
                  <p className="text-sm sm:text-base text-gray-800">{profile?.first_surname || '-'}</p>
                )}
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-1">Segundo Apellido</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.second_surname}
                    onChange={(e) => setEditData({ ...editData, second_surname: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                ) : (
                  <p className="text-sm sm:text-base text-gray-800">{profile?.second_surname || '-'}</p>
                )}
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-1">Género</label>
                {isEditing ? (
                  <select
                    value={editData.gender}
                    onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="M">Hombre</option>
                    <option value="F">Mujer</option>
                  </select>
                ) : (
                  <p className="text-sm sm:text-base text-gray-800">
                    {profile?.gender === 'M' ? 'Hombre' : profile?.gender === 'F' ? 'Mujer' : '-'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Sección de Contacto */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Información de Contacto
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-1">Correo Electrónico</label>
                <div className="flex items-center gap-2">
                  <p className="text-sm sm:text-base text-gray-800 flex-1">{profile?.email}</p>
                  {profile?.is_verified && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Verificado
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="mt-2 text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Cambiar correo electrónico
                </button>
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-1">Teléfono</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editData.phone}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    placeholder="10 dígitos"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                ) : (
                  <p className="text-sm sm:text-base text-gray-800">{profile?.phone || 'No registrado'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Sección de Identificación */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <IdCard className="w-5 h-5 text-blue-600" />
              Identificación
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-1">CURP</label>
                <p className="text-sm sm:text-base text-gray-800 font-mono">{profile?.curp || 'No registrado'}</p>
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-1">Usuario</label>
                <p className="text-sm sm:text-base text-gray-800">@{profile?.username}</p>
              </div>
            </div>
          </div>

          {/* Sección de Seguridad */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Seguridad
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors"
              >
                <Lock className="w-4 h-4" />
                Cambiar contraseña
              </button>
            </div>
          </div>

          {/* Sección de Información de Cuenta */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Información de la Cuenta
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-1">Fecha de registro</label>
                <p className="text-sm sm:text-base text-gray-800">
                  {profile?.created_at ? formatDate(profile.created_at) : '-'}
                </p>
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-1">Último acceso</label>
                <p className="text-sm sm:text-base text-gray-800">
                  {profile?.last_login ? formatDate(profile.last_login) : 'Primera sesión'}
                </p>
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-1">Estado de la cuenta</label>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  profile?.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {profile?.is_active ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      Activa
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3" />
                      Inactiva
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Cambio de Email */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-md p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Cambiar correo electrónico</h3>
              <button
                onClick={() => {
                  setShowEmailModal(false)
                  setNewEmail('')
                  setEmailPassword('')
                  setEmailError(null)
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Se enviará un correo de verificación a la nueva dirección. Tu correo actual permanecerá activo hasta que verifiques el nuevo.
            </p>
            
            {emailError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                <p className="text-sm text-red-700">{emailError}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nuevo@correo.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showEmailPassword ? 'text' : 'password'}
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="Confirma tu contraseña"
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmailPassword(!showEmailPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showEmailPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEmailModal(false)
                  setNewEmail('')
                  setEmailPassword('')
                  setEmailError(null)
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangeEmail}
                disabled={emailLoading}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {emailLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Enviar verificación'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cambio de Contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-md p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Cambiar contraseña</h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setPasswordError(null)
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                <p className="text-sm text-red-700">{passwordError}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setPasswordError(null)
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangePassword}
                disabled={passwordLoading}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {passwordLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Cambiar contraseña'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfilePage
