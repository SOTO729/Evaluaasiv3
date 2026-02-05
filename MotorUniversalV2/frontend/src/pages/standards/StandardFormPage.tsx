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
  getBrands,
  Brand,
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
  // Estado para marcas
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  
  // Estados para logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState<CreateStandardDTO>({
    code: '',
    name: '',
    description: '',
    sector: '',
    level: undefined,
    validity_years: 5,
    certifying_body: 'CONOCER',
    brand_id: undefined,
  });

  // Cargar marcas al montar el componente
  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      setLoadingBrands(true);
      const response = await getBrands({ active_only: true });
      setBrands(response.brands);
    } catch (err) {
      console.error('Error al cargar marcas:', err);
    } finally {
      setLoadingBrands(false);
    }
  };

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
    
    // Si está editando, subir inmediatamente. Si está creando, guardar para después
    if (isEditing && id) {
      handleLogoUpload(file);
    } else {
      // Guardar archivo para subir después de crear el estándar
      setPendingLogoFile(file);
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
        const newStandard = await createStandard(formData);
        
        // Si hay un logo pendiente, subirlo
        if (pendingLogoFile && newStandard.standard?.id) {
          try {
            await uploadStandardLogo(newStandard.standard.id, pendingLogoFile);
            setToast({ message: '¡Estándar de Competencia creado con logo exitosamente!', type: 'success' });
          } catch (logoErr) {
            console.error('Error al subir logo:', logoErr);
            setToast({ message: '¡Estándar creado! El logo no pudo subirse, puedes agregarlo editando el estándar.', type: 'success' });
          }
        } else {
          setToast({ message: '¡Estándar de Competencia creado exitosamente! Ya puedes crear exámenes basados en él.', type: 'success' });
        }
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
      
      <div className="fluid-p-6 max-w-[1920px] mx-auto">
        {/* Back button */}
        <div className="fluid-mb-4">
          <button
            onClick={() => navigate('/standards')}
            className="inline-flex items-center fluid-gap-2 fluid-text-sm text-gray-600 hover:text-primary-600 transition-colors group"
          >
            <svg className="fluid-icon-sm group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a estándares
          </button>
        </div>

        {/* Header con gradiente */}
        <div className="relative rounded-fluid-xl overflow-hidden fluid-mb-6 shadow-lg bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAzMHYySDE0di0yaDIyek0zNiAyNnYySDY0di0yaC0yeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
          <div className="relative fluid-px-8 fluid-py-10">
            <div className="flex items-center fluid-gap-4">
              <div className="w-16 h-16 rounded-fluid-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h1 className="fluid-text-3xl font-bold text-white">
                  {isEditing ? 'Editar Estándar de Competencia' : 'Nuevo Estándar de Competencia'}
                </h1>
                <p className="fluid-text-base text-white/80 fluid-mt-1">
                  {isEditing
                    ? 'Actualiza la información del estándar de competencia (ECM).'
                    : 'Define un nuevo ECM para crear exámenes y materiales de estudio basados en él.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="fluid-mb-6 bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-4 flex items-center fluid-gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="fluid-text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col fluid-gap-6">
          {/* Grid de dos columnas para los cards principales */}
          <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6">
            {/* Información General */}
            <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-100 fluid-p-6">
              <div className="flex items-center fluid-mb-6">
                <div className="w-10 h-10 rounded-fluid-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center fluid-mr-3 shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="fluid-text-lg font-semibold text-gray-900">Información General</h2>
              </div>
              
              <div className="flex flex-col fluid-gap-4">
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

                {/* Marca */}
                <div>
                  <label htmlFor="brand_id" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                    Marca
                  </label>
                  <select
                    name="brand_id"
                    id="brand_id"
                    value={formData.brand_id || ''}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : undefined;
                      setFormData({ ...formData, brand_id: value });
                    }}
                    className="input"
                    disabled={loadingBrands}
                  >
                    <option value="">-- Sin marca específica --</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-gray-500 fluid-text-xs fluid-mt-1">
                    Opcional. Indica si el ECM pertenece a una marca específica (Microsoft, Huawei, etc.)
                  </p>
                </div>

                {/* Descripción */}
                <div>
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
            <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-100 fluid-p-6">
              <div className="flex items-center fluid-mb-6">
                <div className="w-10 h-10 rounded-fluid-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center fluid-mr-3 shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <h2 className="fluid-text-lg font-semibold text-gray-900">Clasificación</h2>
              </div>
              
              <div className="flex flex-col fluid-gap-4">
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
          </div>

          {/* Segunda fila: Vigencia y Logo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6">

            {/* Vigencia y Certificación */}
            <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-100 fluid-p-6">
              <div className="flex items-center fluid-mb-6">
                <div className="w-10 h-10 rounded-fluid-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center fluid-mr-3 shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <h2 className="fluid-text-lg font-semibold text-gray-900">Vigencia y Certificación</h2>
              </div>
              
              <div className="flex flex-col fluid-gap-4">
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

            {/* Logo del Estándar */}
            <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-100 fluid-p-6">
              <div className="flex items-center fluid-mb-6">
                <div className="w-10 h-10 rounded-fluid-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center fluid-mr-3 shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="fluid-text-lg font-semibold text-gray-900">Logo del Estándar</h2>
                <span className="fluid-ml-2 fluid-text-xs text-gray-400">(opcional)</span>
              </div>
              <p className="text-gray-500 fluid-text-sm fluid-mb-4">
                {isEditing 
                  ? 'Sube un logo para identificar visualmente este estándar.'
                  : 'Selecciona un logo para este estándar. Se subirá al guardar.'}
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
                      {!isEditing && pendingLogoFile && (
                        <div className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                          Pendiente
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
                      {logoPreview ? 'Cambiar Logo' : 'Seleccionar Logo'}
                    </span>
                  </label>
                  
                  {/* Botón eliminar - solo visible si hay logo guardado (editando) */}
                  {isEditing && logoUrl && (
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
                  
                  {/* Botón quitar selección - solo visible si hay logo pendiente (creando) */}
                  {!isEditing && pendingLogoFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingLogoFile(null);
                        setLogoPreview(null);
                      }}
                      className="btn btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50 inline-flex items-center"
                    >
                      <svg className="fluid-icon-sm fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Quitar Logo
                    </button>
                  )}
                  
                  <p className="text-gray-500 fluid-text-xs">
                    Formatos: PNG, JPG, WebP. Máximo 5MB.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end fluid-gap-4 fluid-pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/standards')}
              className="fluid-px-6 fluid-py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-fluid-xl hover:bg-gray-50 transition-all duration-200 shadow-sm"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="fluid-px-8 fluid-py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-fluid-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 fluid-mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Guardando...
                </>
              ) : (
                <>
                  <svg className="fluid-icon-sm fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {isEditing ? 'Guardar Cambios' : 'Crear Estándar'}
                </>
              )}
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
