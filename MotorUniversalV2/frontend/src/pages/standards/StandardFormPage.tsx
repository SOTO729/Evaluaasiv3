/**
 * Formulario para crear/editar Estándares de Competencia
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getStandard,
  createStandard,
  updateStandard,
  uploadStandardLogo,
  deleteStandardLogo,
  CreateStandardDTO,
} from '../../services/standardsService';

// Lista de sectores productivos CONOCER
const SECTORES_PRODUCTIVOS = [
  'Agricultura, cría y explotación de animales',
  'Aprovechamiento forestal',
  'Pesca y acuacultura',
  'Minería',
  'Generación y distribución de electricidad, gas y agua',
  'Construcción',
  'Industrias manufactureras',
  'Comercio',
  'Transportes, correos y almacenamiento',
  'Información en medios masivos',
  'Servicios financieros y de seguros',
  'Servicios inmobiliarios y de alquiler',
  'Servicios profesionales, científicos y técnicos',
  'Corporativos',
  'Servicios de apoyo a los negocios',
  'Servicios educativos',
  'Servicios de salud y de asistencia social',
  'Servicios de esparcimiento, culturales y deportivos',
  'Servicios de alojamiento y preparación de alimentos',
  'Otros servicios excepto actividades gubernamentales',
  'Actividades gubernamentales',
  'Tecnologías de la información',
  'Turismo',
  'Logística y cadena de suministro',
  'Energías renovables',
  'Automotriz',
  'Aeronáutica',
  'Biotecnología',
];

// Opciones de vigencia
const OPCIONES_VIGENCIA = [
  { value: 0, label: 'Sin vigencia (permanente)' },
  { value: 1, label: '1 año' },
  { value: 2, label: '2 años' },
  { value: 3, label: '3 años' },
  { value: 4, label: '4 años' },
  { value: 5, label: '5 años' },
  { value: 6, label: '6 años' },
  { value: 7, label: '7 años' },
  { value: 8, label: '8 años' },
  { value: 9, label: '9 años' },
  { value: 10, label: '10 años' },
];

// Opciones de centro evaluador
const CENTROS_EVALUADORES = ['CONOCER', 'EDUIT', 'EVALUAASI'];

// Componente de notificación toast
interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className={`flex items-center fluid-gap-3 fluid-px-6 fluid-py-4 rounded-fluid-lg shadow-lg ${
        type === 'success' 
          ? 'bg-green-600 text-white' 
          : 'bg-red-600 text-white'
      }`}>
        {type === 'success' ? (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="fluid-ml-2 hover:opacity-80 transition-opacity"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default function StandardFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Estados de validación por campo
  const [codeError, setCodeError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [sectorError, setSectorError] = useState<string | null>(null);
  const [levelError, setLevelError] = useState<string | null>(null);
  const [certifyingBodyError, setCertifyingBodyError] = useState<string | null>(null);
  
  // Estado para el modal de validación
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Estados para logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  const [formData, setFormData] = useState<CreateStandardDTO>({
    code: '',
    name: '',
    description: '',
    sector: '',
    level: undefined,
    validity_years: 5,
    certifying_body: 'CONOCER',
  });

  useEffect(() => {
    if (isEditing) {
      loadStandard();
    }
  }, [id]);

  const loadStandard = async () => {
    try {
      setLoading(true);
      const standard = await getStandard(Number(id));
      setFormData({
        code: standard.code,
        name: standard.name,
        description: standard.description || '',
        sector: standard.sector || '',
        level: standard.level,
        validity_years: standard.validity_years,
        certifying_body: standard.certifying_body,
      });
      // Cargar logo si existe
      if (standard.logo_url) {
        setLogoUrl(standard.logo_url);
        setLogoPreview(standard.logo_url);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el estándar');
    } finally {
      setLoading(false);
    }
  };

  // Funciones de validación
  const validateCode = (value: string) => {
    if (!value.trim()) {
      setCodeError('El código del estándar es requerido');
      return false;
    }
    if (value.length < 3) {
      setCodeError('El código debe tener al menos 3 caracteres');
      return false;
    }
    setCodeError(null);
    return true;
  };

  const validateName = (value: string) => {
    if (!value.trim()) {
      setNameError('El nombre del estándar es requerido');
      return false;
    }
    if (value.length < 5) {
      setNameError('El nombre debe tener al menos 5 caracteres');
      return false;
    }
    setNameError(null);
    return true;
  };

  const validateSector = (value: string) => {
    if (!value) {
      setSectorError('Debes seleccionar un sector productivo');
      return false;
    }
    setSectorError(null);
    return true;
  };

  const validateLevel = (value: number | undefined) => {
    if (!value) {
      setLevelError('Debes seleccionar un nivel de competencia');
      return false;
    }
    setLevelError(null);
    return true;
  };

  const validateCertifyingBody = (value: string) => {
    if (!value) {
      setCertifyingBodyError('Debes seleccionar un centro evaluador');
      return false;
    }
    setCertifyingBodyError(null);
    return true;
  };

  // Función para manejar selección de logo
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar tipo de archivo
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setToast({ message: 'Solo se permiten imágenes PNG, JPG o WebP', type: 'error' });
      return;
    }
    
    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'La imagen no debe superar 5MB', type: 'error' });
      return;
    }
    
    // Preview local
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    // Si está editando, subir inmediatamente
    if (isEditing && id) {
      handleLogoUpload(file);
    }
  };
  
  // Función para subir logo
  const handleLogoUpload = async (file: File) => {
    if (!id) return;
    
    try {
      setUploadingLogo(true);
      const result = await uploadStandardLogo(Number(id), file);
      setLogoUrl(result.logo_url);
      setLogoPreview(result.logo_url);
      setToast({ message: 'Logo subido exitosamente', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || 'Error al subir logo', type: 'error' });
      // Restaurar preview anterior si había
      setLogoPreview(logoUrl);
    } finally {
      setUploadingLogo(false);
    }
  };
  
  // Función para eliminar logo
  const handleLogoDelete = async () => {
    if (!id || !logoUrl) return;
    
    try {
      setUploadingLogo(true);
      await deleteStandardLogo(Number(id));
      setLogoUrl(null);
      setLogoPreview(null);
      setToast({ message: 'Logo eliminado', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || 'Error al eliminar logo', type: 'error' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Limpiar errores al modificar
    if (name === 'code' && value.trim()) setCodeError(null);
    if (name === 'name' && value.trim()) setNameError(null);
    if (name === 'sector' && value) setSectorError(null);
    if (name === 'level' && value) setLevelError(null);
    if (name === 'certifying_body' && value) setCertifyingBodyError(null);
    
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' || name === 'validity_years' || name === 'level'
        ? (value === '' ? undefined : Number(value))
        : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar todos los campos y recopilar errores
    const errors: string[] = [];
    
    if (!formData.code.trim()) {
      setCodeError('El código del estándar es requerido');
      errors.push('Código del Estándar');
    } else if (formData.code.length < 3) {
      setCodeError('El código debe tener al menos 3 caracteres');
      errors.push('Código del Estándar (mínimo 3 caracteres)');
    } else {
      setCodeError(null);
    }
    
    if (!formData.name.trim()) {
      setNameError('El nombre del estándar es requerido');
      errors.push('Nombre del Estándar');
    } else if (formData.name.length < 5) {
      setNameError('El nombre debe tener al menos 5 caracteres');
      errors.push('Nombre del Estándar (mínimo 5 caracteres)');
    } else {
      setNameError(null);
    }
    
    if (!formData.sector) {
      setSectorError('Debes seleccionar un sector productivo');
      errors.push('Sector Productivo');
    } else {
      setSectorError(null);
    }
    
    if (!formData.level) {
      setLevelError('Debes seleccionar un nivel de competencia');
      errors.push('Nivel de Competencia');
    } else {
      setLevelError(null);
    }
    
    if (!formData.certifying_body) {
      setCertifyingBodyError('Debes seleccionar un centro evaluador');
      errors.push('Centro Evaluador');
    } else {
      setCertifyingBodyError(null);
    }
    
    // Si hay errores, mostrar modal
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationModal(true);
      return;
    }
    
    setError(null);
    setSaving(true);

    try {
      if (isEditing) {
        await updateStandard(Number(id), formData);
        setToast({ message: '¡Estándar actualizado exitosamente!', type: 'success' });
        setTimeout(() => navigate('/standards'), 1500);
      } else {
        await createStandard(formData);
        setToast({ message: '¡Estándar de Competencia creado exitosamente! Ya puedes crear exámenes basados en él.', type: 'success' });
        setTimeout(() => navigate('/standards'), 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar el estándar');
      setToast({ message: err.response?.data?.error || 'Error al guardar el estándar', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <>
      {/* Toast de notificación */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      <div className="max-w-3xl mx-auto fluid-p-6">
        <div className="fluid-mb-8">
          <button
            onClick={() => navigate('/standards')}
            className="inline-flex items-center fluid-text-sm text-gray-500 hover:text-gray-700"
          >
            <svg className="fluid-mr-2 fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a estándares
          </button>
          <h1 className="fluid-mt-4 fluid-text-3xl font-bold text-gray-900">
            {isEditing ? 'Editar Estándar' : 'Nuevo Estándar de Competencia'}
          </h1>
          <p className="fluid-mt-1 fluid-text-sm text-gray-500">
            {isEditing
              ? 'Actualiza la información del estándar de competencia.'
              : 'Define un nuevo ECM para crear exámenes basados en él.'}
          </p>
        </div>

        {error && (
          <div className="fluid-mb-6 bg-red-50 border border-red-200 rounded-fluid-md fluid-p-4">
            <p className="fluid-text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col fluid-gap-6">
          {/* Información General */}
          <div className="card">
            <h2 className="fluid-text-xl font-semibold fluid-mb-4">Información General</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-4">
              {/* Código */}
              <div>
                <label htmlFor="code" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                  Código del Estándar <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="code"
                  id="code"
                  disabled={isEditing}
                  value={formData.code}
                  onChange={handleChange}
                  onBlur={(e) => validateCode(e.target.value)}
                  placeholder="Ej: EC0217"
                  className={`input ${codeError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} ${isEditing ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
                {codeError && (
                  <p className="text-red-600 fluid-text-xs fluid-mt-1 font-medium">{codeError}</p>
                )}
                {!codeError && formData.code.trim() && formData.code.length >= 3 && (
                  <p className="text-green-600 fluid-text-xs fluid-mt-1 font-medium">✓ Código válido</p>
                )}
                {!codeError && !formData.code.trim() && (
                  <p className="text-gray-500 fluid-text-xs fluid-mt-1">Código único del estándar (no se puede modificar después)</p>
                )}
              </div>

              {/* Nombre */}
              <div>
                <label htmlFor="name" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                  Nombre del Estándar <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={(e) => validateName(e.target.value)}
                  placeholder="Ej: Impartición de cursos de formación del capital humano"
                  className={`input ${nameError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
                {nameError && (
                  <p className="text-red-600 fluid-text-xs fluid-mt-1 font-medium">{nameError}</p>
                )}
                {!nameError && formData.name.trim() && formData.name.length >= 5 && (
                  <p className="text-green-600 fluid-text-xs fluid-mt-1 font-medium">✓ Nombre válido</p>
                )}
              </div>

              {/* Descripción - Ancho completo */}
              <div className="md:col-span-2">
                <label htmlFor="description" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                  Descripción
                </label>
                <textarea
                  name="description"
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe el propósito y alcance del estándar..."
                  className="input"
                />
                <p className="text-gray-500 fluid-text-xs fluid-mt-1">Opcional. Describe brevemente qué competencias evalúa este estándar.</p>
              </div>
            </div>
          </div>

          {/* Clasificación */}
          <div className="card">
            <h2 className="fluid-text-xl font-semibold fluid-mb-4">Clasificación</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-4">
              {/* Sector */}
              <div>
                <label htmlFor="sector" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                  Sector Productivo <span className="text-red-600">*</span>
                </label>
                <select
                  name="sector"
                  id="sector"
                  value={formData.sector}
                  onChange={handleChange}
                  onBlur={(e) => validateSector(e.target.value)}
                  className={`input ${sectorError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                >
                  <option value="">-- Selecciona un sector --</option>
                  {SECTORES_PRODUCTIVOS.map((sector) => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
                {sectorError && (
                  <p className="text-red-600 fluid-text-xs fluid-mt-1 font-medium">{sectorError}</p>
                )}
                {!sectorError && formData.sector && (
                  <p className="text-green-600 fluid-text-xs fluid-mt-1 font-medium">✓ Sector seleccionado</p>
                )}
              </div>

              {/* Nivel */}
              <div>
                <label htmlFor="level" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                  Nivel de Competencia <span className="text-red-600">*</span>
                </label>
                <select
                  name="level"
                  id="level"
                  value={formData.level || ''}
                  onChange={handleChange}
                  onBlur={() => validateLevel(formData.level)}
                  className={`input ${levelError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                >
                  <option value="">-- Selecciona un nivel --</option>
                  <option value="1">Nivel 1 - Competencias simples</option>
                  <option value="2">Nivel 2 - Competencias básicas</option>
                  <option value="3">Nivel 3 - Competencias intermedias</option>
                  <option value="4">Nivel 4 - Competencias avanzadas</option>
                  <option value="5">Nivel 5 - Competencias expertas</option>
                </select>
                {levelError && (
                  <p className="text-red-600 fluid-text-xs fluid-mt-1 font-medium">{levelError}</p>
                )}
                {!levelError && formData.level && (
                  <p className="text-green-600 fluid-text-xs fluid-mt-1 font-medium">✓ Nivel seleccionado</p>
                )}
              </div>
            </div>
          </div>

          {/* Vigencia y Certificación */}
          <div className="card">
            <h2 className="fluid-text-xl font-semibold fluid-mb-4">Vigencia y Certificación</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-4">
              {/* Años de vigencia */}
              <div>
                <label htmlFor="validity_years" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                  Vigencia del Certificado
                </label>
                <select
                  name="validity_years"
                  id="validity_years"
                  value={formData.validity_years ?? 5}
                  onChange={handleChange}
                  className="input"
                >
                  {OPCIONES_VIGENCIA.map((opcion) => (
                    <option key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </option>
                  ))}
                </select>
                <p className="text-gray-500 fluid-text-xs fluid-mt-1">Tiempo de validez del certificado una vez obtenido</p>
              </div>

              {/* Centro Evaluador */}
              <div>
                <label htmlFor="certifying_body" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                  Centro Evaluador <span className="text-red-600">*</span>
                </label>
                <select
                  name="certifying_body"
                  id="certifying_body"
                  value={formData.certifying_body}
                  onChange={handleChange}
                  onBlur={(e) => validateCertifyingBody(e.target.value)}
                  className={`input ${certifyingBodyError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                >
                  <option value="">-- Selecciona un centro --</option>
                  {CENTROS_EVALUADORES.map((centro) => (
                    <option key={centro} value={centro}>
                      {centro}
                    </option>
                  ))}
                </select>
                {certifyingBodyError && (
                  <p className="text-red-600 fluid-text-xs fluid-mt-1 font-medium">{certifyingBodyError}</p>
                )}
                {!certifyingBodyError && formData.certifying_body && (
                  <p className="text-green-600 fluid-text-xs fluid-mt-1 font-medium">✓ Centro seleccionado</p>
                )}
              </div>
            </div>
          </div>

          {/* Logo del Estándar - Solo visible al editar */}
          {isEditing && (
            <div className="card">
              <h2 className="fluid-text-xl font-semibold fluid-mb-4">Logo del Estándar</h2>
              <p className="text-gray-500 fluid-text-sm fluid-mb-4">
                Sube un logo para identificar visualmente este estándar. Se convertirá automáticamente a WebP para optimización.
              </p>
              
              <div className="flex items-start fluid-gap-6">
                {/* Preview del logo */}
                <div className="flex-shrink-0">
                  {logoPreview ? (
                    <div className="relative group">
                      <img
                        src={logoPreview}
                        alt="Logo del estándar"
                        className="w-32 h-32 object-contain rounded-fluid-lg border-2 border-gray-200 bg-gray-50"
                      />
                      {uploadingLogo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-fluid-lg">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-fluid-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Controles */}
                <div className="flex flex-col fluid-gap-3">
                  <label className="relative">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleLogoSelect}
                      disabled={uploadingLogo}
                      className="sr-only"
                    />
                    <span className={`btn btn-secondary cursor-pointer inline-flex items-center ${uploadingLogo ? 'opacity-50' : ''}`}>
                      <svg className="fluid-icon-sm fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      {logoPreview ? 'Cambiar Logo' : 'Subir Logo'}
                    </span>
                  </label>
                  
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={handleLogoDelete}
                      disabled={uploadingLogo}
                      className="btn btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50 inline-flex items-center"
                    >
                      <svg className="fluid-icon-sm fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar Logo
                    </button>
                  )}
                  
                  <p className="text-gray-500 fluid-text-xs">
                    Formatos: PNG, JPG, WebP. Máximo 5MB.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end fluid-gap-3 fluid-pt-4">
            <button
              type="button"
              onClick={() => navigate('/standards')}
              className="btn btn-secondary"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Estándar'}
            </button>
          </div>
        </form>
      </div>

      {/* Modal de Validación */}
      {showValidationModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4" 
          onClick={() => setShowValidationModal(false)}
        >
          <div 
            className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeSlideIn" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 fluid-px-6 fluid-py-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-10 h-10 rounded-fluid-xl bg-white/20 flex items-center justify-center fluid-mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="fluid-text-xl font-bold text-white">Campos Requeridos</h3>
              </div>
            </div>
            
            {/* Contenido del modal */}
            <div className="fluid-p-6">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-fluid-xl fluid-p-4 fluid-mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="fluid-ml-3">
                    <p className="fluid-text-sm text-amber-800 font-semibold">
                      Por favor completa los siguientes campos obligatorios:
                    </p>
                  </div>
                </div>
              </div>

              {/* Lista de campos faltantes */}
              <ul className="flex flex-col fluid-gap-2 fluid-mb-6">
                {validationErrors.map((error, index) => (
                  <li key={index} className="flex items-center text-gray-700">
                    <svg className="w-5 h-5 text-red-500 fluid-mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="fluid-text-sm">{error}</span>
                  </li>
                ))}
              </ul>

              {/* Botón para cerrar */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowValidationModal(false)}
                  className="fluid-px-6 fluid-py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-fluid-xl hover:from-amber-600 hover:to-orange-600 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
