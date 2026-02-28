/**
 * Página de Listado de Marcas para Estándares de Competencia
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  getBrands,
  deleteBrand,
  Brand,
} from '../../services/standardsService';
import {
  Tag,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertCircle,
  Image,
  ArrowLeft,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

// Hook para debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Modal de confirmación
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, isLoading }: ConfirmModalProps) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-fluid-xl shadow-2xl max-w-md w-full fluid-p-6 animate-scale-in">
        <div className="flex items-center fluid-gap-3 fluid-mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="fluid-text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-gray-600 fluid-mb-6">{message}</p>
        <div className="flex justify-end fluid-gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="fluid-px-4 fluid-py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-lg font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="fluid-px-4 fluid-py-2 text-white bg-red-600 hover:bg-red-700 rounded-fluid-lg font-medium transition-colors flex items-center fluid-gap-2"
          >
            {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente de tarjeta de marca
const BrandCard = ({ 
  brand, 
  onEdit,
  onDelete,
  canManage,
}: { 
  brand: Brand;
  onEdit: () => void;
  onDelete: () => void;
  canManage: boolean;
}) => {
  return (
    <div className="bg-white border-2 border-gray-200 rounded-fluid-xl fluid-p-5 hover:border-blue-500 hover:shadow-xl transition-all duration-300 group">
      <div className="flex items-start fluid-gap-4">
        {/* Logo */}
        <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-fluid-lg flex items-center justify-center overflow-hidden border border-gray-200">
          {brand.logo_url ? (
            <img
              src={brand.logo_url}
              alt={`Logo ${brand.name}`}
              className="w-full h-full object-contain"
            />
          ) : (
            <Image className="w-8 h-8 text-gray-400" />
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center fluid-gap-2 fluid-mb-1">
            <h3 className="font-semibold fluid-text-lg text-gray-900 truncate">
              {brand.name}
            </h3>
          </div>
          
          {brand.description && (
            <p className="text-gray-600 fluid-text-sm line-clamp-2 fluid-mb-2">
              {brand.description}
            </p>
          )}
          
          <div className="flex items-center fluid-gap-4 text-gray-500 fluid-text-sm">
            {brand.standards_count !== undefined && (
              <span>{brand.standards_count} estándares</span>
            )}
          </div>
        </div>
        
        {/* Acciones */}
        {canManage && (
          <div className="flex fluid-gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-fluid-lg transition-colors"
              title="Editar marca"
            >
              <Edit className="w-5 h-5" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-red-600 hover:bg-red-50 rounded-fluid-lg transition-colors"
              title="Eliminar marca"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default function BrandsListPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; brand: Brand | null; isLoading: boolean }>({
    isOpen: false,
    brand: null,
    isLoading: false,
  });
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const isAdmin = user?.role === 'admin' || user?.role === 'developer';
  const isEditor = user?.role === 'editor' || user?.role === 'editor_invitado';
  const canManage = isAdmin || isEditor;

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      setLoading(true);
      const response = await getBrands({
        include_stats: true,
      });
      setBrands(response.brands);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar las marcas');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.brand) return;
    
    try {
      setDeleteModal(prev => ({ ...prev, isLoading: true }));
      await deleteBrand(deleteModal.brand.id);
      setBrands(prev => prev.filter(b => b.id !== deleteModal.brand!.id));
      setDeleteModal({ isOpen: false, brand: null, isLoading: false });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar la marca');
      setDeleteModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Filtrar marcas por término de búsqueda
  const filteredBrands = debouncedSearchTerm
    ? brands.filter(b => 
        b.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (b.description && b.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
      )
    : brands;

  return (
    <div className="fluid-p-6 max-w-[1920px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center fluid-gap-6 fluid-mb-8">
        <div>
          <div className="flex items-center fluid-gap-3 fluid-mb-2">
            <Link
              to="/standards"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="fluid-icon-md" />
            </Link>
            <h1 className="fluid-text-2xl font-bold text-gray-800 flex items-center fluid-gap-3">
              <Tag className="fluid-icon-lg text-blue-600" />
              Gestión de Marcas
            </h1>
          </div>
          <p className="fluid-text-base text-gray-600 fluid-ml-9">
            Administra las marcas para categorizar los estándares de competencia
          </p>
        </div>
        <div className="flex flex-wrap fluid-gap-3">
          {canManage && (
            <Link
              to="/standards/brands/new"
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-lg font-medium fluid-text-sm transition-colors shadow-lg shadow-blue-600/25"
            >
              <Plus className="fluid-icon-sm" />
              Nueva Marca
            </Link>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border-2 border-gray-200 rounded-fluid-xl fluid-p-4 fluid-mb-6">
        <div className="flex flex-col sm:flex-row fluid-gap-4">
          {/* Búsqueda */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
            <input
              type="text"
              placeholder="Buscar marcas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full fluid-pl-10 fluid-pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex justify-center items-center fluid-py-20">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto fluid-mb-3" />
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={loadBrands}
            className="fluid-mt-4 fluid-px-4 fluid-py-2 bg-red-600 text-white rounded-fluid-lg hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : filteredBrands.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-p-12 text-center">
          <Tag className="w-16 h-16 text-gray-300 mx-auto fluid-mb-4" />
          <h3 className="fluid-text-lg font-semibold text-gray-700 fluid-mb-2">
            {searchTerm ? 'No se encontraron marcas' : 'No hay marcas registradas'}
          </h3>
          <p className="text-gray-500 fluid-mb-6">
            {searchTerm 
              ? 'Intenta con otro término de búsqueda'
              : 'Crea la primera marca para categorizar tus estándares'}
          </p>
          {canManage && !searchTerm && (
            <Link
              to="/standards/brands/new"
              className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-2 bg-blue-600 text-white rounded-fluid-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="fluid-icon-sm" />
              Crear primera marca
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBrands.map((brand) => (
            <BrandCard
              key={brand.id}
              brand={brand}
              onEdit={() => navigate(`/standards/brands/${brand.id}/edit`)}
              onDelete={() => setDeleteModal({ isOpen: true, brand, isLoading: false })}
              canManage={canManage}
            />
          ))}
        </div>
      )}
      
      {/* Modal de confirmación de eliminación */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Eliminar marca"
        message={`¿Estás seguro de que deseas eliminar la marca "${deleteModal.brand?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal({ isOpen: false, brand: null, isLoading: false })}
        isLoading={deleteModal.isLoading}
      />
    </div>
  );
}
