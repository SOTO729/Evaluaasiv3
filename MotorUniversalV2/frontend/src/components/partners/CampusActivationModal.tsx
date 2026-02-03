/**
 * Modal para Activación de Plantel - Paso 1: Crear Responsable
 */
import { useState } from 'react';
import { X, User, Mail, Shield, AlertCircle, CheckCircle2, Copy, Eye, EyeOff } from 'lucide-react';
import { CreateResponsableData, CampusResponsable, createCampusResponsable } from '../../services/partnersService';

interface CampusActivationModalProps {
  campusId: number;
  campusName: string;
  onClose: () => void;
  onSuccess: (responsable: CampusResponsable) => void;
}

export default function CampusActivationModal({
  campusId,
  campusName,
  onClose,
  onSuccess
}: CampusActivationModalProps) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Datos del responsable creado (después del éxito)
  const [createdResponsable, setCreatedResponsable] = useState<CampusResponsable | null>(null);
  
  // Formulario
  const [formData, setFormData] = useState<CreateResponsableData>({
    name: '',
    first_surname: '',
    second_surname: '',
    email: '',
    curp: '',
    gender: 'M',
    date_of_birth: '',
    can_bulk_create_candidates: false,
    can_manage_groups: false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      // Para CURP, convertir a mayúsculas
      const processedValue = name === 'curp' ? value.toUpperCase() : value;
      setFormData(prev => ({ ...prev, [name]: processedValue }));
    }
    
    // Limpiar error al escribir
    if (error) setError(null);
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'El nombre es requerido';
    if (!formData.first_surname.trim()) return 'El apellido paterno es requerido';
    if (!formData.second_surname.trim()) return 'El apellido materno es requerido';
    if (!formData.email.trim()) return 'El correo electrónico es requerido';
    if (!formData.curp.trim()) return 'El CURP es requerido';
    if (!formData.date_of_birth) return 'La fecha de nacimiento es requerida';
    
    // Validar formato de email
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(formData.email)) {
      return 'Formato de correo electrónico inválido';
    }
    
    // Validar formato de CURP
    const curpPattern = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$/;
    if (!curpPattern.test(formData.curp)) {
      return 'Formato de CURP inválido (18 caracteres)';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      const result = await createCampusResponsable(campusId, formData);
      
      setCreatedResponsable(result.responsable);
      setStep('success');
      
    } catch (err: any) {
      console.error('Error creating responsable:', err);
      setError(err.response?.data?.error || 'Error al crear el responsable');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleClose = () => {
    if (createdResponsable) {
      onSuccess(createdResponsable);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div>
            <h2 className="text-xl font-bold">Activación de Plantel</h2>
            <p className="text-blue-100 text-sm mt-1">
              {step === 'form' ? 'Paso 1: Crear Responsable del Plantel' : '¡Responsable creado exitosamente!'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          {step === 'form' ? (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Info del plantel */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Plantel:</span> {campusName}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  El responsable tendrá acceso para gestionar este plantel
                </p>
              </div>

              {/* Error message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Datos personales */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Datos Personales
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre(s) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ej: Juan Carlos"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Apellido Paterno <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="first_surname"
                      value={formData.first_surname}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ej: García"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Apellido Materno <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="second_surname"
                      value={formData.second_surname}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ej: López"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Género <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                      <option value="O">Otro</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de Nacimiento <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="date_of_birth"
                      value={formData.date_of_birth}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CURP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="curp"
                      value={formData.curp}
                      onChange={handleChange}
                      maxLength={18}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-mono"
                      placeholder="GARL850101HDFRRL09"
                    />
                    <p className="text-xs text-gray-500 mt-1">{formData.curp.length}/18 caracteres</p>
                  </div>
                </div>
              </div>

              {/* Datos de contacto */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Contacto
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Correo Electrónico <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="responsable@ejemplo.com"
                  />
                </div>
              </div>

              {/* Permisos */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Permisos del Responsable
                </h3>
                
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      name="can_bulk_create_candidates"
                      checked={formData.can_bulk_create_candidates}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                      <span className="font-medium text-gray-800">Altas masivas de candidatos</span>
                      <p className="text-sm text-gray-500">
                        Puede crear múltiples usuarios candidato a través de importación de archivos
                      </p>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      name="can_manage_groups"
                      checked={formData.can_manage_groups}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                      <span className="font-medium text-gray-800">Gestión de grupos</span>
                      <p className="text-sm text-gray-500">
                        Puede crear grupos de alumnos y asignar exámenes o materiales de estudio
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creando...
                    </>
                  ) : (
                    'Crear Responsable'
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Paso de éxito */
            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">¡Responsable Creado!</h3>
                <p className="text-gray-600 mt-2">
                  El responsable del plantel ha sido creado exitosamente
                </p>
              </div>

              {/* Credenciales */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Credenciales de acceso</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Guarda esta información, la contraseña solo se muestra una vez
                    </p>
                  </div>
                </div>

                <div className="space-y-3 bg-white/50 rounded-lg p-4">
                  {/* Usuario */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium">ID de Usuario</p>
                      <p className="font-mono text-lg font-bold text-gray-800">
                        {createdResponsable?.username}
                      </p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(createdResponsable?.username || '', 'username')}
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                      title="Copiar"
                    >
                      {copiedField === 'username' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </div>

                  {/* Email */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium">Correo</p>
                      <p className="font-medium text-gray-800">{createdResponsable?.email}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(createdResponsable?.email || '', 'email')}
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                      title="Copiar"
                    >
                      {copiedField === 'email' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </div>

                  {/* Contraseña */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium">Contraseña Temporal</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-bold text-gray-800">
                          {showPassword ? createdResponsable?.temporary_password : '••••••••••••'}
                        </p>
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1 hover:bg-white rounded transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4 text-gray-400" />
                          ) : (
                            <Eye className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(createdResponsable?.temporary_password || '', 'password')}
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                      title="Copiar"
                    >
                      {copiedField === 'password' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Resumen del responsable */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-medium text-gray-700 mb-3">Datos del Responsable</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Nombre completo</p>
                    <p className="font-medium">{createdResponsable?.full_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">CURP</p>
                    <p className="font-medium font-mono">{createdResponsable?.curp}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Altas masivas</p>
                    <p className="font-medium">
                      {createdResponsable?.can_bulk_create_candidates ? (
                        <span className="text-green-600">Habilitado</span>
                      ) : (
                        <span className="text-gray-500">Deshabilitado</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Gestión de grupos</p>
                    <p className="font-medium">
                      {createdResponsable?.can_manage_groups ? (
                        <span className="text-green-600">Habilitado</span>
                      ) : (
                        <span className="text-gray-500">Deshabilitado</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botón de cerrar */}
              <div className="flex justify-end pt-4 border-t">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
