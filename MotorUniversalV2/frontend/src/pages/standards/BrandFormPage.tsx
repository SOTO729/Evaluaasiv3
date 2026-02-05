/**
 * Formulario para crear/editar Marcas
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  getBrand,
  createBrand,
  updateBrand,
  uploadBrandLogo,
  deleteBrandLogo,
} from '../../services/standardsService';
import {
  Tag,
  ArrowLeft,
  Save,
  Image,
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

// Componente Toast
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
          <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
        )}
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="fluid-ml-2 hover:opacity-80 transition-opacity"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

interface BrandFormData {
  name: string;
  description: string;
  display_order: number;
  is_active: boolean;
}

export default function BrandFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Estados de validación
  const [nameError, setNameError] = useState<string | null>(null);
  
  // Estados para logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState<BrandFormData>({
    name: '',
    description: '',
    display_order: 0,
    is_active: true,
  });

  useEffect(() => {
    if (isEditing) {
      loadBrand();
    }
  }, [id]);

  const loadBrand = async () => {
    try {
      setLoading(true);
      const response = await getBrand(Number(id));
      const brand = response.brand;
      setFormData({
        name: brand.name,
        description: brand.description || '',
        display_order: brand.display_order,
        is_active: brand.is_active,
      });
      if (brand.logo_url) {
        setLogoUrl(brand.logo_url);
        setLogoPreview(brand.logo_url);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar la marca');
    } finally {
      setLoading(false);
    }
  };

  // Validación del nombre
  const validateName = (value: string) => {
    if (!value.trim()) {
      setNameError('El nombre de la marca es requerido');
      return false;
    }
    if (value.length < 2) {
      setNameError('El nombre debe tener al menos 2 caracteres');
      return false;
    }
    setNameError(null);
    return true;
  };

  // Manejar cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'display_order') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Validar en tiempo real
    if (name === 'name') {
      validateName(value);
    }
  };

  // Manejar selección de logo
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
    } else {
      // Si es nuevo, guardar archivo pendiente
      setPendingLogoFile(file);
    }
  };
  
  // Subir logo
  const handleLogoUpload = async (file: File) => {
    if (!id) return;
    
    try {
      setUploadingLogo(true);
      const result = await uploadBrandLogo(Number(id), file);
      setLogoUrl(result.logo_url);
      setLogoPreview(result.logo_url);
      setToast({ message: 'Logo subido exitosamente', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || 'Error al subir logo', type: 'error' });
      setLogoPreview(logoUrl);
    } finally {
      setUploadingLogo(false);
    }
  };
  
  // Eliminar logo
  const handleLogoDelete = async () => {
    if (!isEditing || !id || !logoUrl) {
      // Si es nuevo, solo quitar preview
      setLogoPreview(null);
      setPendingLogoFile(null);
      return;
    }
    
    try {
      setUploadingLogo(true);
      await deleteBrandLogo(Number(id));
      setLogoUrl(null);
      setLogoPreview(null);
      setToast({ message: 'Logo eliminado exitosamente', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || 'Error al eliminar logo', type: 'error' });
    } finally {
      setUploadingLogo(false);
    }
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar
    const isNameValid = validateName(formData.name);
    
    if (!isNameValid) {
      setToast({ message: 'Por favor corrige los errores del formulario', type: 'error' });
      return;
    }
    
    try {
      setSaving(true);
      
      if (isEditing) {
        await updateBrand(Number(id), formData);
        setToast({ message: 'Marca actualizada exitosamente', type: 'success' });
      } else {
        const result = await createBrand({
          name: formData.name,
          description: formData.description || undefined,
          display_order: formData.display_order,
        });
        
        // Si hay logo pendiente, subirlo ahora
        if (pendingLogoFile && result.brand?.id) {
          try {
            await uploadBrandLogo(result.brand.id, pendingLogoFile);
          } catch (err) {
            console.error('Error al subir logo:', err);
          }
        }
        
        setToast({ message: 'Marca creada exitosamente', type: 'success' });
      }
      
      // Redirigir después de un breve delay
      setTimeout(() => {
        navigate('/standards/brands');
      }, 1000);
      
    } catch (err: any) {
      setToast({ 
        message: err.response?.data?.error || 'Error al guardar la marca', 
        type: 'error' 
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fluid-p-6">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-6 text-center max-w-lg mx-auto">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto fluid-mb-3" />
          <p className="text-red-700 font-medium">{error}</p>
          <Link
            to="/standards/brands"
            className="inline-flex items-center fluid-gap-2 fluid-mt-4 fluid-px-4 fluid-py-2 bg-gray-100 text-gray-700 rounded-fluid-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a marcas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-4xl mx-auto animate-fade-in-up">
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* Header */}
      <div className="flex items-center fluid-gap-4 fluid-mb-8">
        <Link
          to="/standards/brands"
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-fluid-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="fluid-text-2xl font-bold text-gray-800 flex items-center fluid-gap-3">
            <Tag className="fluid-icon-lg text-blue-600" />
            {isEditing ? 'Editar Marca' : 'Nueva Marca'}
          </h1>
          <p className="fluid-text-base text-gray-600 fluid-mt-1">
            {isEditing ? 'Modifica los datos de la marca' : 'Crea una nueva marca para categorizar estándares'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white border-2 border-gray-200 rounded-fluid-xl fluid-p-6 fluid-mb-6">
          {/* Logo */}
          <div className="fluid-mb-6">
            <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
              Logo de la marca
            </label>
            <p className="fluid-text-sm text-gray-500 fluid-mb-3">
              Se recomienda una imagen cuadrada. Se convertirá automáticamente a WebP.
            </p>
            
            <div className="flex items-start fluid-gap-4">
              {/* Preview */}
              <div className="w-32 h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-fluid-xl flex items-center justify-center overflow-hidden">
                {uploadingLogo ? (
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Preview logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center fluid-p-4">
                    <Image className="w-10 h-10 text-gray-400 mx-auto fluid-mb-2" />
                    <span className="fluid-text-xs text-gray-500">Sin logo</span>
                  </div>
                )}
              </div>
              
              {/* Botones */}
              <div className="flex flex-col fluid-gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleLogoSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 text-white rounded-fluid-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {logoPreview ? 'Cambiar logo' : 'Subir logo'}
                </button>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleLogoDelete}
                    disabled={uploadingLogo}
                    className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-red-100 text-red-700 rounded-fluid-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar logo
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Nombre */}
          <div className="fluid-mb-4">
            <label htmlFor="name" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
              Nombre de la marca *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              onBlur={() => validateName(formData.name)}
              placeholder="Ej: Microsoft, Huawei, Abierto"
              className={`w-full fluid-px-4 fluid-py-3 border rounded-fluid-lg focus:ring-2 focus:ring-blue-500 transition-colors ${
                nameError ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
              }`}
            />
            {nameError && (
              <p className="fluid-mt-1 fluid-text-sm text-red-600 flex items-center fluid-gap-1">
                <AlertCircle className="w-4 h-4" />
                {nameError}
              </p>
            )}
          </div>
          
          {/* Descripción */}
          <div className="fluid-mb-4">
            <label htmlFor="description" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
              Descripción
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Descripción opcional de la marca..."
              className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
            />
          </div>
          
          {/* Orden de visualización */}
          <div className="fluid-mb-4">
            <label htmlFor="display_order" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
              Orden de visualización
            </label>
            <input
              type="number"
              id="display_order"
              name="display_order"
              value={formData.display_order}
              onChange={handleChange}
              min="0"
              className="w-40 fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <p className="fluid-mt-1 fluid-text-sm text-gray-500">
              Las marcas se ordenan de menor a mayor
            </p>
          </div>
          
          {/* Estado activo (solo en edición) */}
          {isEditing && (
            <div className="fluid-mb-4">
              <label className="flex items-center fluid-gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">Marca activa</span>
              </label>
              <p className="fluid-text-sm text-gray-500 fluid-ml-8 fluid-mt-1">
                Las marcas inactivas no aparecen en los selectores
              </p>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end fluid-gap-3">
          <Link
            to="/standards/brands"
            className="fluid-px-6 fluid-py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-lg font-medium transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-blue-600 text-white rounded-fluid-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-600/25"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {isEditing ? 'Guardar cambios' : 'Crear marca'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
