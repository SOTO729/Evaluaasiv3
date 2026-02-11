import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { authService } from '../services/authService'
import api from '../services/api'
import { 
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
  IdCard,
  User,
  Clock,
  ChevronRight,
  Users,
  Building2,
  MapPin,
  GraduationCap,
} from 'lucide-react'

interface GroupInfo {
  group_id: number
  group_name: string
  group_code?: string
  campus_id?: number
  campus_name?: string
  state_name?: string
  city?: string
  school_cycle_id?: number
  school_cycle_name?: string
  joined_at?: string
}

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
  group_info?: GroupInfo | null
}

const ProfilePage = () => {
  const { updateUser } = useAuthStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    first_surname: '',
    second_surname: '',
    phone: '',
    gender: ''
  })
  
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [showEmailPassword, setShowEmailPassword] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  
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
      setSuccess('Se ha enviado un correo de verificación a tu nueva dirección.')
      
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
      admin: { label: 'Administrador', color: 'bg-red-500' },
      editor: { label: 'Editor', color: 'bg-blue-500' },
      editor_invitado: { label: 'Editor Invitado', color: 'bg-teal-500' },
      soporte: { label: 'Soporte', color: 'bg-purple-500' },
      candidato: { label: 'Candidato', color: 'bg-green-500' },
      auxiliar: { label: 'Auxiliar', color: 'bg-amber-500' }
    }
    return roles[role] || { label: role, color: 'bg-gray-500' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-2xl max-w-lg mx-auto mt-8">
        <p className="text-lg">{error}</p>
        <button 
          onClick={loadProfile}
          className="mt-3 text-base text-red-700 underline hover:no-underline"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const roleBadge = getRoleBadge(profile?.role || '')

  return (
    <div className="min-h-screen pb-8">
      {/* Estilos para gradiente animado */}
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animated-gradient-dark {
          background: linear-gradient(-45deg, #1e3a8a, #1e40af, #1d4ed8, #3730a3, #1e3a8a, #1e40af, #2563eb);
          background-size: 400% 400%;
          animation: gradientShift 30s ease infinite;
        }
      `}</style>

      {/* Contenedor principal con max-width para pantallas grandes */}
      <div className="max-w-5xl mx-auto fluid-px-6">
        
        {/* Hero Header */}
        <div className="animated-gradient-dark rounded-fluid-xl fluid-mb-6 overflow-hidden shadow-lg">
          <div className="fluid-p-8">
            <div className="flex flex-col sm:flex-row items-center fluid-gap-6">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 rounded-full bg-white/15  flex items-center justify-center text-white fluid-text-3xl font-bold border-2 border-white/30 shadow-xl">
                  {profile?.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'U'}
                </div>
                {profile?.is_verified && (
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-white/50 shadow-md">
                    <CheckCircle2 className="fluid-icon-sm text-white" />
                  </div>
                )}
              </div>
              
              {/* Info Principal */}
              <div className="text-center sm:text-left flex-1 min-w-0">
                <h1 className="fluid-text-3xl font-bold text-white fluid-mb-1 truncate">
                  {profile?.full_name}
                </h1>
                <p className="text-blue-200 fluid-text-base fluid-mb-3">@{profile?.username}</p>
                
                <div className="flex flex-wrap items-center justify-center sm:justify-start fluid-gap-2">
                  <span className={`fluid-px-3 fluid-py-1 fluid-text-xs font-semibold rounded-full text-white shadow-sm ${roleBadge.color}`}>
                    {roleBadge.label}
                  </span>
                  <span className={`fluid-px-3 fluid-py-1 fluid-text-xs font-medium rounded-full  ${
                    profile?.is_active ? 'bg-green-500/25 text-green-200 border border-green-400/30' : 'bg-red-500/25 text-red-200 border border-red-400/30'
                  }`}>
                    {profile?.is_active ? 'Cuenta Activa' : 'Cuenta Inactiva'}
                  </span>
                </div>
              </div>

              {/* Botones de acción */}
              {profile?.role !== 'editor' && profile?.role !== 'editor_invitado' && (
                <div className="flex fluid-gap-2 fluid-mt-2 sm:mt-0 flex-shrink-0">
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/15 hover:bg-white/25 text-white rounded-fluid-lg fluid-text-sm font-medium transition-all  border border-white/20 shadow-sm"
                    >
                      <Edit3 className="fluid-icon-sm" />
                      <span className="hidden sm:inline">Editar Perfil</span>
                      <span className="sm:hidden">Editar</span>
                    </button>
                  ) : (
                    <>
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
                        className="inline-flex items-center fluid-gap-1 fluid-px-4 fluid-py-2 bg-white/10 hover:bg-white/20 text-white rounded-fluid-lg fluid-text-sm font-medium transition-all"
                      >
                        <X className="fluid-icon-sm" />
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="inline-flex items-center fluid-gap-1 fluid-px-4 fluid-py-2 bg-green-500 hover:bg-green-600 text-white rounded-fluid-lg fluid-text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
                      >
                        {saving ? <Loader2 className="fluid-icon-sm animate-spin" /> : <Save className="fluid-icon-sm" />}
                        Guardar
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alertas */}
        {success && (
          <div className="fluid-mb-6 fluid-p-4 bg-green-50 border border-green-200 rounded-fluid-lg flex items-center fluid-gap-3 shadow-sm">
            <CheckCircle2 className="fluid-icon-sm text-green-600 flex-shrink-0" />
            <p className="fluid-text-sm text-green-700">{success}</p>
          </div>
        )}
        
        {error && (
          <div className="fluid-mb-6 fluid-p-4 bg-red-50 border border-red-200 rounded-fluid-lg flex items-center fluid-gap-3 shadow-sm">
            <AlertCircle className="fluid-icon-sm text-red-600 flex-shrink-0" />
            <p className="fluid-text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Contenido Principal - Grid responsivo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6">
          
          {/* Datos Personales */}
          <div className="bg-white rounded-fluid-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className="fluid-px-5 fluid-py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-transparent">
              <div className="flex items-center fluid-gap-3">
                <div className="w-9 h-9 rounded-fluid-md bg-blue-100 flex items-center justify-center">
                  <User className="fluid-icon-sm text-blue-600" />
                </div>
                <h2 className="fluid-text-base font-semibold text-gray-900">Datos Personales</h2>
              </div>
            </div>
            
            <div className="fluid-p-5 flex flex-col fluid-gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 fluid-gap-4">
                <div>
                  <label className="block fluid-text-xs font-medium text-gray-500 uppercase tracking-wide fluid-mb-1">Nombre(s)</label>
                  {isEditing ? (
                    <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="w-full fluid-px-3 fluid-py-2 border border-gray-200 rounded-fluid-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm bg-gray-50" />
                  ) : (
                    <p className="text-gray-900 fluid-text-sm font-medium">{profile?.name || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block fluid-text-xs font-medium text-gray-500 uppercase tracking-wide fluid-mb-1">Primer Apellido</label>
                  {isEditing ? (
                    <input type="text" value={editData.first_surname} onChange={(e) => setEditData({ ...editData, first_surname: e.target.value })}
                      className="w-full fluid-px-3 fluid-py-2 border border-gray-200 rounded-fluid-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm bg-gray-50" />
                  ) : (
                    <p className="text-gray-900 fluid-text-sm font-medium">{profile?.first_surname || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block fluid-text-xs font-medium text-gray-500 uppercase tracking-wide fluid-mb-1">Segundo Apellido</label>
                  {isEditing ? (
                    <input type="text" value={editData.second_surname} onChange={(e) => setEditData({ ...editData, second_surname: e.target.value })}
                      className="w-full fluid-px-3 fluid-py-2 border border-gray-200 rounded-fluid-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm bg-gray-50" />
                  ) : (
                    <p className="text-gray-900 fluid-text-sm font-medium">{profile?.second_surname || '-'}</p>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block fluid-text-xs font-medium text-gray-500 uppercase tracking-wide fluid-mb-1">Género</label>
                {isEditing ? (
                  <select value={editData.gender} onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                    className="w-full fluid-px-3 fluid-py-2 border border-gray-200 rounded-fluid-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm bg-gray-50">
                    <option value="">Seleccionar...</option>
                    <option value="M">Hombre</option>
                    <option value="F">Mujer</option>
                  </select>
                ) : (
                  <p className="text-gray-900 fluid-text-sm font-medium">
                    {profile?.gender === 'M' ? 'Hombre' : profile?.gender === 'F' ? 'Mujer' : '-'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Información de Contacto */}
          <div className="bg-white rounded-fluid-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className="fluid-px-5 fluid-py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-transparent">
              <div className="flex items-center fluid-gap-3">
                <div className="w-9 h-9 rounded-fluid-md bg-indigo-100 flex items-center justify-center">
                  <Mail className="fluid-icon-sm text-indigo-600" />
                </div>
                <h2 className="fluid-text-base font-semibold text-gray-900">Contacto</h2>
              </div>
            </div>
            
            <div className="fluid-p-5 flex flex-col fluid-gap-4">
              <div>
                <label className="block fluid-text-xs font-medium text-gray-500 uppercase tracking-wide fluid-mb-1">Correo Electrónico</label>
                <div className="flex items-center fluid-gap-2">
                  <p className="text-gray-900 fluid-text-sm font-medium break-all">{profile?.email}</p>
                  {profile?.is_verified && (
                    <CheckCircle2 className="fluid-icon-xs text-green-500 flex-shrink-0" />
                  )}
                </div>
                {profile?.role !== 'editor' && profile?.role !== 'editor_invitado' && (
                  <button onClick={() => setShowEmailModal(true)} className="fluid-mt-1 fluid-text-xs text-blue-600 hover:text-blue-700 font-medium">
                    Cambiar correo →
                  </button>
                )}
              </div>
              
              <div>
                <label className="block fluid-text-xs font-medium text-gray-500 uppercase tracking-wide fluid-mb-1">Usuario</label>
                <p className="text-gray-900 fluid-text-sm font-medium">@{profile?.username}</p>
              </div>
              
              {profile?.role !== 'editor' && profile?.role !== 'editor_invitado' && (
                <div>
                  <label className="block fluid-text-xs font-medium text-gray-500 uppercase tracking-wide fluid-mb-1">Teléfono</label>
                  {isEditing ? (
                    <input type="tel" value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} placeholder="10 dígitos"
                      className="w-full fluid-px-3 fluid-py-2 border border-gray-200 rounded-fluid-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm bg-gray-50" />
                  ) : (
                    <p className="text-gray-900 fluid-text-sm font-medium">{profile?.phone || 'No registrado'}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Identificación - Solo si no es editor/editor_invitado */}
          {profile?.role !== 'editor' && profile?.role !== 'editor_invitado' && (
            <div className="bg-white rounded-fluid-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              <div className="fluid-px-5 fluid-py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-transparent">
                <div className="flex items-center fluid-gap-3">
                  <div className="w-9 h-9 rounded-fluid-md bg-amber-100 flex items-center justify-center">
                    <IdCard className="fluid-icon-sm text-amber-600" />
                  </div>
                  <h2 className="fluid-text-base font-semibold text-gray-900">Identificación</h2>
                </div>
              </div>
              
              <div className="fluid-p-5">
                <label className="block fluid-text-xs font-medium text-gray-500 uppercase tracking-wide fluid-mb-1">CURP</label>
                <p className="text-gray-900 font-mono fluid-text-sm font-medium break-all tracking-wide">{profile?.curp || 'No registrado'}</p>
              </div>
            </div>
          )}

          {/* Seguridad y Cuenta */}
          <div className="bg-white rounded-fluid-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className="fluid-px-5 fluid-py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-transparent">
              <div className="flex items-center fluid-gap-3">
                <div className="w-9 h-9 rounded-fluid-md bg-emerald-100 flex items-center justify-center">
                  <Shield className="fluid-icon-sm text-emerald-600" />
                </div>
                <h2 className="fluid-text-base font-semibold text-gray-900">Seguridad y Cuenta</h2>
              </div>
            </div>
            
            <div className="fluid-p-5 flex flex-col fluid-gap-4">
              <button onClick={() => setShowPasswordModal(true)}
                className="w-full flex items-center justify-between fluid-px-4 fluid-py-3 bg-gray-50 hover:bg-gray-100 rounded-fluid-md transition-colors group border border-gray-200">
                <div className="flex items-center fluid-gap-3">
                  <Lock className="fluid-icon-sm text-gray-500" />
                  <span className="fluid-text-sm font-medium text-gray-700">Cambiar contraseña</span>
                </div>
                <ChevronRight className="fluid-icon-sm text-gray-400 group-hover:text-gray-600 transition-colors" />
              </button>
              
              <div className="fluid-pt-3 border-t border-gray-100 flex flex-col fluid-gap-2">
                <div className="flex items-center fluid-gap-2 fluid-text-xs text-gray-500">
                  <Calendar className="fluid-icon-xs" />
                  <span>Miembro desde: <span className="text-gray-700 font-medium">{profile?.created_at ? formatDate(profile.created_at) : '-'}</span></span>
                </div>
                <div className="flex items-center fluid-gap-2 fluid-text-xs text-gray-500">
                  <Clock className="fluid-icon-xs" />
                  <span>Último acceso: <span className="text-gray-700 font-medium">{profile?.last_login ? formatDate(profile.last_login) : 'Primera sesión'}</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* Información del Grupo - Solo para candidatos y responsables */}
          {(profile?.role === 'candidato' || profile?.role === 'responsable') && (
            <div className="bg-white rounded-fluid-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden lg:col-span-2">
              <div className="fluid-px-5 fluid-py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-transparent">
                <div className="flex items-center fluid-gap-3">
                  <div className="w-9 h-9 rounded-fluid-md bg-purple-100 flex items-center justify-center">
                    <GraduationCap className="fluid-icon-sm text-purple-600" />
                  </div>
                  <h2 className="fluid-text-base font-semibold text-gray-900">Información Académica</h2>
                </div>
              </div>
              
              {profile.group_info ? (
                <div className="fluid-p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 fluid-gap-5">
                    {/* Grupo */}
                    <div className="flex items-start fluid-gap-3">
                      <div className="w-9 h-9 rounded-fluid-md bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Users className="fluid-icon-sm text-purple-500" />
                      </div>
                      <div className="min-w-0">
                        <label className="block fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Grupo</label>
                        <p className="text-gray-900 fluid-text-sm font-semibold truncate">
                          {profile.group_info.group_name}
                        </p>
                        {profile.group_info.group_code && (
                          <p className="text-gray-500 fluid-text-xs">{profile.group_info.group_code}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Plantel */}
                    <div className="flex items-start fluid-gap-3">
                      <div className="w-9 h-9 rounded-fluid-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Building2 className="fluid-icon-sm text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <label className="block fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Plantel</label>
                        <p className="text-gray-900 fluid-text-sm font-semibold truncate">
                          {profile.group_info.campus_name || '-'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Estado */}
                    <div className="flex items-start fluid-gap-3">
                      <div className="w-9 h-9 rounded-fluid-md bg-green-50 flex items-center justify-center flex-shrink-0">
                        <MapPin className="fluid-icon-sm text-green-500" />
                      </div>
                      <div className="min-w-0">
                        <label className="block fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Ubicación</label>
                        <p className="text-gray-900 fluid-text-sm font-semibold truncate">
                          {profile.group_info.state_name || '-'}
                        </p>
                        {profile.group_info.city && (
                          <p className="text-gray-500 fluid-text-xs">{profile.group_info.city}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Ciclo Escolar */}
                    <div className="flex items-start fluid-gap-3">
                      <div className="w-9 h-9 rounded-fluid-md bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <Calendar className="fluid-icon-sm text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <label className="block fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Ciclo Escolar</label>
                        <p className="text-gray-900 fluid-text-sm font-semibold truncate">
                          {profile.group_info.school_cycle_name || '-'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Fecha de Ingreso */}
                    {profile.group_info.joined_at && (
                      <div className="flex items-start fluid-gap-3">
                        <div className="w-9 h-9 rounded-fluid-md bg-gray-50 flex items-center justify-center flex-shrink-0">
                          <Clock className="fluid-icon-sm text-gray-500" />
                        </div>
                        <div className="min-w-0">
                          <label className="block fluid-text-xs font-medium text-gray-500 uppercase tracking-wide">Ingreso al Grupo</label>
                          <p className="text-gray-900 fluid-text-sm font-semibold">
                            {formatDate(profile.group_info.joined_at)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="fluid-p-5 text-center">
                  <Users className="fluid-icon-xl text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 fluid-text-sm">No estás asignado a ningún grupo</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Cambiar Email */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50  flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="fluid-p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="fluid-text-lg font-semibold text-gray-900">Cambiar correo electrónico</h3>
              <button onClick={() => { setShowEmailModal(false); setNewEmail(''); setEmailPassword(''); setEmailError(null) }}
                className="fluid-p-2 hover:bg-gray-100 rounded-fluid-md transition-colors"><X className="fluid-icon-sm text-gray-500" /></button>
            </div>
            
            <div className="fluid-p-5">
              <p className="fluid-text-sm text-gray-600 fluid-mb-4">Se enviará un correo de verificación a la nueva dirección.</p>
              
              {emailError && (<div className="fluid-p-3 bg-red-50 border border-red-200 rounded-fluid-md fluid-mb-4"><p className="fluid-text-xs text-red-700">{emailError}</p></div>)}
              
              <div className="flex flex-col fluid-gap-4">
                <div>
                  <label className="block fluid-text-xs font-medium text-gray-700 fluid-mb-1">Nuevo correo electrónico</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="nuevo@correo.com"
                      className="w-full pl-10 fluid-pr-4 fluid-py-2 border border-gray-200 rounded-fluid-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm bg-gray-50" />
                  </div>
                </div>
                
                <div>
                  <label className="block fluid-text-xs font-medium text-gray-700 fluid-mb-1">Contraseña actual</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                    <input type={showEmailPassword ? 'text' : 'password'} value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Confirma tu contraseña"
                      className="w-full pl-10 pr-10 fluid-py-2 border border-gray-200 rounded-fluid-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm bg-gray-50" />
                    <button type="button" onClick={() => setShowEmailPassword(!showEmailPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showEmailPassword ? <EyeOff className="fluid-icon-sm" /> : <Eye className="fluid-icon-sm" />}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex fluid-gap-3 fluid-mt-5">
                <button onClick={() => { setShowEmailModal(false); setNewEmail(''); setEmailPassword(''); setEmailError(null) }}
                  className="flex-1 fluid-px-4 fluid-py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-md font-medium fluid-text-sm transition-colors">Cancelar</button>
                <button onClick={handleChangeEmail} disabled={emailLoading}
                  className="flex-1 fluid-px-4 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-md font-medium fluid-text-sm transition-colors disabled:opacity-50 flex items-center justify-center fluid-gap-2">
                  {emailLoading ? <Loader2 className="fluid-icon-sm animate-spin" /> : 'Enviar verificación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar Contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50  flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="fluid-p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="fluid-text-lg font-semibold text-gray-900">Cambiar contraseña</h3>
              <button onClick={() => { setShowPasswordModal(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(null) }}
                className="fluid-p-2 hover:bg-gray-100 rounded-fluid-md transition-colors"><X className="fluid-icon-sm text-gray-500" /></button>
            </div>
            
            <div className="fluid-p-5">
              {passwordError && (<div className="fluid-p-3 bg-red-50 border border-red-200 rounded-fluid-md fluid-mb-4"><p className="fluid-text-xs text-red-700">{passwordError}</p></div>)}
              
              <div className="flex flex-col fluid-gap-4">
                <div>
                  <label className="block fluid-text-xs font-medium text-gray-700 fluid-mb-1">Contraseña actual</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                    <input type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-10 pr-10 fluid-py-2 border border-gray-200 rounded-fluid-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm bg-gray-50" />
                    <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCurrentPassword ? <EyeOff className="fluid-icon-sm" /> : <Eye className="fluid-icon-sm" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block fluid-text-xs font-medium text-gray-700 fluid-mb-1">Nueva contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                    <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres"
                      className="w-full pl-10 pr-10 fluid-py-2 border border-gray-200 rounded-fluid-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm bg-gray-50" />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNewPassword ? <EyeOff className="fluid-icon-sm" /> : <Eye className="fluid-icon-sm" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block fluid-text-xs font-medium text-gray-700 fluid-mb-1">Confirmar nueva contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 fluid-pr-4 fluid-py-2 border border-gray-200 rounded-fluid-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm bg-gray-50" />
                  </div>
                </div>
              </div>
              
              <div className="flex fluid-gap-3 fluid-mt-5">
                <button onClick={() => { setShowPasswordModal(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(null) }}
                  className="flex-1 fluid-px-4 fluid-py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-md font-medium fluid-text-sm transition-colors">Cancelar</button>
                <button onClick={handleChangePassword} disabled={passwordLoading}
                  className="flex-1 fluid-px-4 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-md font-medium fluid-text-sm transition-colors disabled:opacity-50 flex items-center justify-center fluid-gap-2">
                  {passwordLoading ? <Loader2 className="fluid-icon-sm animate-spin" /> : 'Cambiar contraseña'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfilePage
