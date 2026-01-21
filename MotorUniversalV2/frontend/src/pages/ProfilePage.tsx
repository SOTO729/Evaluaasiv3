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
  ChevronRight
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
      <div className="max-w-5xl mx-auto px-4 lg:px-8">
        
        {/* Hero Header */}
        <div className="animated-gradient-dark rounded-2xl mb-6 overflow-hidden shadow-lg">
          <div className="px-6 py-6 lg:px-8 lg:py-8">
            <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white text-2xl sm:text-3xl lg:text-4xl font-bold border-2 border-white/30 shadow-xl">
                  {profile?.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'U'}
                </div>
                {profile?.is_verified && (
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-white/50 shadow-md">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                )}
              </div>
              
              {/* Info Principal */}
              <div className="text-center sm:text-left flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 truncate">
                  {profile?.full_name}
                </h1>
                <p className="text-blue-200 text-sm sm:text-base mb-3">@{profile?.username}</p>
                
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className={`px-3 py-1.5 text-xs font-semibold rounded-full text-white shadow-sm ${roleBadge.color}`}>
                    {roleBadge.label}
                  </span>
                  <span className={`px-3 py-1.5 text-xs font-medium rounded-full backdrop-blur-sm ${
                    profile?.is_active ? 'bg-green-500/25 text-green-200 border border-green-400/30' : 'bg-red-500/25 text-red-200 border border-red-400/30'
                  }`}>
                    {profile?.is_active ? 'Cuenta Activa' : 'Cuenta Inactiva'}
                  </span>
                </div>
              </div>

              {/* Botones de acción */}
              {profile?.role !== 'editor' && (
                <div className="flex gap-2 mt-2 sm:mt-0 flex-shrink-0">
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-sm font-medium transition-all backdrop-blur-sm border border-white/20 shadow-sm"
                    >
                      <Edit3 className="w-4 h-4" />
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
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-all"
                      >
                        <X className="w-4 h-4" />
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
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
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Contenido Principal - Grid responsivo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
          
          {/* Datos Personales */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <User className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">Datos Personales</h2>
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Nombre(s)</label>
                  {isEditing ? (
                    <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50" />
                  ) : (
                    <p className="text-gray-900 text-sm font-medium">{profile?.name || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Primer Apellido</label>
                  {isEditing ? (
                    <input type="text" value={editData.first_surname} onChange={(e) => setEditData({ ...editData, first_surname: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50" />
                  ) : (
                    <p className="text-gray-900 text-sm font-medium">{profile?.first_surname || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Segundo Apellido</label>
                  {isEditing ? (
                    <input type="text" value={editData.second_surname} onChange={(e) => setEditData({ ...editData, second_surname: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50" />
                  ) : (
                    <p className="text-gray-900 text-sm font-medium">{profile?.second_surname || '-'}</p>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Género</label>
                {isEditing ? (
                  <select value={editData.gender} onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50">
                    <option value="">Seleccionar...</option>
                    <option value="M">Hombre</option>
                    <option value="F">Mujer</option>
                  </select>
                ) : (
                  <p className="text-gray-900 text-sm font-medium">
                    {profile?.gender === 'M' ? 'Hombre' : profile?.gender === 'F' ? 'Mujer' : '-'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Información de Contacto */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Mail className="w-4.5 h-4.5 text-indigo-600" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">Contacto</h2>
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Correo Electrónico</label>
                <div className="flex items-center gap-2">
                  <p className="text-gray-900 text-sm font-medium break-all">{profile?.email}</p>
                  {profile?.is_verified && (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  )}
                </div>
                {profile?.role !== 'editor' && (
                  <button onClick={() => setShowEmailModal(true)} className="mt-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                    Cambiar correo →
                  </button>
                )}
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Usuario</label>
                <p className="text-gray-900 text-sm font-medium">@{profile?.username}</p>
              </div>
              
              {profile?.role !== 'editor' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Teléfono</label>
                  {isEditing ? (
                    <input type="tel" value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} placeholder="10 dígitos"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50" />
                  ) : (
                    <p className="text-gray-900 text-sm font-medium">{profile?.phone || 'No registrado'}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Identificación - Solo si no es editor */}
          {profile?.role !== 'editor' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <IdCard className="w-4.5 h-4.5 text-amber-600" />
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">Identificación</h2>
                </div>
              </div>
              
              <div className="p-5">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">CURP</label>
                <p className="text-gray-900 font-mono text-sm font-medium break-all tracking-wide">{profile?.curp || 'No registrado'}</p>
              </div>
            </div>
          )}

          {/* Seguridad y Cuenta */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Shield className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">Seguridad y Cuenta</h2>
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              <button onClick={() => setShowPasswordModal(true)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group border border-gray-200">
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Cambiar contraseña</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </button>
              
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <div className="flex items-center gap-2.5 text-xs text-gray-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Miembro desde: <span className="text-gray-700 font-medium">{profile?.created_at ? formatDate(profile.created_at) : '-'}</span></span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Último acceso: <span className="text-gray-700 font-medium">{profile?.last_login ? formatDate(profile.last_login) : 'Primera sesión'}</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Cambiar Email */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Cambiar correo electrónico</h3>
              <button onClick={() => { setShowEmailModal(false); setNewEmail(''); setEmailPassword(''); setEmailError(null) }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">Se enviará un correo de verificación a la nueva dirección.</p>
              
              {emailError && (<div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4"><p className="text-xs text-red-700">{emailError}</p></div>)}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Nuevo correo electrónico</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="nuevo@correo.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Contraseña actual</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showEmailPassword ? 'text' : 'password'} value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Confirma tu contraseña"
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50" />
                    <button type="button" onClick={() => setShowEmailPassword(!showEmailPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-5">
                <button onClick={() => { setShowEmailModal(false); setNewEmail(''); setEmailPassword(''); setEmailError(null) }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors">Cancelar</button>
                <button onClick={handleChangeEmail} disabled={emailLoading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {emailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar verificación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar Contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Cambiar contraseña</h3>
              <button onClick={() => { setShowPasswordModal(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(null) }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            
            <div className="p-5">
              {passwordError && (<div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4"><p className="text-xs text-red-700">{passwordError}</p></div>)}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Contraseña actual</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50" />
                    <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Nueva contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres"
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50" />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Confirmar nueva contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50" />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-5">
                <button onClick={() => { setShowPasswordModal(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(null) }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors">Cancelar</button>
                <button onClick={handleChangePassword} disabled={passwordLoading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cambiar contraseña'}
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
