/**
 * Página de Listado de Estándares de Competencia (ECM)
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  getStandards,
  CompetencyStandard,
} from '../../services/standardsService';
import {
  ClipboardList,
  Plus,
  Search,
  FileText,
  Clock,
  Building2,
  XCircle,
  AlertCircle,
  CheckCircle2,
  Tag,
  ChevronRight,
  Award
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

// Componente de fila de estándar
const StandardRow = ({ 
  standard, 
  onView
}: { 
  standard: CompetencyStandard;
  onView: () => void;
}) => {
  const getLevelBadgeColor = (level?: number) => {
    if (!level) return 'bg-gray-100 text-gray-600';
    const colors: Record<number, string> = {
      1: 'bg-emerald-100 text-emerald-700',
      2: 'bg-blue-100 text-blue-700',
      3: 'bg-amber-100 text-amber-700',
      4: 'bg-orange-100 text-orange-700',
      5: 'bg-red-100 text-red-700',
    };
    return colors[level] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div 
      onClick={onView}
      className="bg-white border-2 border-gray-200 rounded-fluid-xl fluid-p-5 hover:border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
    >
      <div className="flex flex-col sm:flex-row sm:items-center fluid-gap-4">
        {/* Logo del estándar */}
        {standard.logo_url && (
          <div className="flex-shrink-0">
            <img
              src={standard.logo_url}
              alt={`Logo ${standard.code}`}
              className="w-14 h-14 object-contain rounded-fluid-lg border border-gray-200 bg-gray-50 p-1"
            />
          </div>
        )}
        
        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center fluid-gap-3 fluid-mb-2 flex-wrap">
            <span className="font-mono fluid-text-sm font-semibold text-blue-600 bg-blue-50 fluid-px-3 fluid-py-1 rounded-fluid-md">
              {standard.code}
            </span>
            {standard.level && (
              <span className={`fluid-text-xs font-medium fluid-px-3 fluid-py-1 rounded-fluid-md ${getLevelBadgeColor(standard.level)}`}>
                Nivel {standard.level}
              </span>
            )}
            {standard.is_active ? (
              <span className="inline-flex items-center fluid-gap-1 fluid-text-xs font-medium text-green-700 bg-green-50 fluid-px-3 fluid-py-1 rounded-fluid-md">
                <CheckCircle2 className="fluid-icon-xs" />
                Activo
              </span>
            ) : (
              <span className="inline-flex items-center fluid-gap-1 fluid-text-xs font-medium text-gray-600 bg-gray-100 fluid-px-3 fluid-py-1 rounded-fluid-md">
                <XCircle className="fluid-icon-xs" />
                Inactivo
              </span>
            )}
          </div>
          
          <h3 
            className="font-medium fluid-text-lg text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1"
            title={standard.name}
          >
            {standard.name}
          </h3>
          
          {/* Metadata */}
          <div className="flex flex-wrap items-center fluid-gap-5 fluid-mt-3 fluid-text-sm text-gray-500">
            {standard.sector && (
              <div className="flex items-center fluid-gap-1">
                <Building2 className="fluid-icon-xs" />
                <span>{standard.sector}</span>
              </div>
            )}
            {standard.certifying_body && (
              <div className="flex items-center fluid-gap-1">
                <Award className="fluid-icon-xs" />
                <span>{standard.certifying_body}</span>
              </div>
            )}
            <div className="flex items-center fluid-gap-1">
              <Clock className="fluid-icon-xs" />
              <span>{standard.validity_years} años</span>
            </div>
            <div className="flex items-center fluid-gap-1">
              <FileText className="fluid-icon-xs" />
              <span>{standard.exam_count || 0} exámenes</span>
            </div>
          </div>
        </div>

        {/* Indicador de acción - aparece al hover */}
        <div className="hidden sm:flex items-center fluid-gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0">
          <span className="fluid-text-sm text-blue-600 font-medium whitespace-nowrap">Ver detalle</span>
          <ChevronRight className="fluid-icon-sm text-blue-500" />
        </div>
      </div>
    </div>
  );
};

export default function StandardsListPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [standards, setStandards] = useState<CompetencyStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const isAdmin = user?.role === 'admin';
  const isEditor = user?.role === 'editor' || user?.role === 'editor_invitado';
  const canCreate = isAdmin || isEditor;

  useEffect(() => {
    loadStandards();
  }, [showInactive]);

  const loadStandards = async () => {
    try {
      setLoading(true);
      const response = await getStandards({
        active_only: !showInactive,
        include_stats: true,
      });
      setStandards(response.standards);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los estándares');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar estándares por término de búsqueda (cliente)
  const filteredStandards = debouncedSearchTerm
    ? standards.filter(s => 
        s.code.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        s.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (s.sector && s.sector.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (s.certifying_body && s.certifying_body.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
      )
    : standards;

  return (
    <div className="fluid-p-6 max-w-[1920px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center fluid-gap-6 fluid-mb-8">
        <div>
          <h1 className="fluid-text-2xl font-bold text-gray-800 flex items-center fluid-gap-3">
            <ClipboardList className="fluid-icon-lg text-blue-600" />
            Estándares de Competencia
          </h1>
          <p className="fluid-text-base text-gray-600 fluid-mt-2">
            Gestiona los ECM del sistema CONOCER
          </p>
        </div>
        <div className="flex flex-wrap fluid-gap-3">
          {canCreate && (
            <Link
              to="/standards/brands"
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-lg font-medium fluid-text-sm transition-colors"
            >
              <Tag className="fluid-icon-sm" />
              <span className="hidden sm:inline">Marcas</span>
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/standards/deletion-requests"
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-lg font-medium fluid-text-sm transition-colors"
            >
              <ClipboardList className="fluid-icon-sm" />
              <span className="hidden sm:inline">Solicitudes</span>
            </Link>
          )}
          {canCreate && (
            <Link
              to="/standards/new"
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-lg font-medium fluid-text-sm transition-colors w-full sm:w-auto"
            >
              <Plus className="fluid-icon-sm" />
              Nuevo Estándar
            </Link>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-fluid-xl shadow fluid-p-5 fluid-mb-8">
        <div className="flex flex-col sm:flex-row fluid-gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por código, nombre o sector..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  loadStandards();
                }
              }}
              className="w-full fluid-pl-10 fluid-pr-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
            />
          </div>
          
          {/* Toggle de inactivos */}
          <label className="inline-flex items-center cursor-pointer bg-gray-50 fluid-px-5 fluid-py-2 rounded-fluid-lg border border-gray-200">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ms-3 fluid-text-sm font-medium text-gray-700 whitespace-nowrap">
              Mostrar inactivos
            </span>
          </label>
          
          <button
            onClick={() => loadStandards()}
            className="bg-blue-600 hover:bg-blue-700 text-white fluid-px-6 fluid-py-3 rounded-fluid-lg transition-colors w-full sm:w-auto flex items-center justify-center fluid-gap-2 font-medium fluid-text-base"
          >
            <Search className="fluid-icon-sm" />
            Buscar
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="fluid-mb-6 fluid-p-5 bg-red-50 border border-red-200 rounded-fluid-lg flex items-center fluid-gap-4">
          <AlertCircle className="fluid-icon-sm text-red-600 flex-shrink-0" />
          <p className="fluid-text-sm text-red-700">{error}</p>
          <button 
            onClick={loadStandards}
            className="ml-auto fluid-text-sm text-red-700 underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Standards List */}
      {loading ? (
        <div className="bg-white rounded-fluid-xl shadow fluid-p-10">
          <LoadingSpinner message="Cargando estándares..." />
        </div>
      ) : filteredStandards.length === 0 ? (
        <div className="bg-white rounded-fluid-xl shadow fluid-p-10 text-center">
          <ClipboardList className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-6" />
          <h3 className="fluid-text-xl font-medium text-gray-700 fluid-mb-3">
            {searchTerm ? 'No se encontraron estándares' : 'No hay estándares'}
          </h3>
          <p className="text-gray-500 fluid-text-base fluid-mb-6">
            {searchTerm 
              ? 'Intenta con otros términos de búsqueda' 
              : canCreate 
                ? 'Comienza creando un nuevo estándar de competencia' 
                : 'Aún no se han creado estándares'}
          </p>
          {canCreate && !searchTerm && (
            <Link
              to="/standards/new"
              className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-lg font-medium fluid-text-sm transition-colors"
            >
              <Plus className="fluid-icon-sm" />
              Crear Estándar
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col fluid-gap-4">
          {/* Contador de resultados */}
          <div className="flex items-center justify-between fluid-text-sm text-gray-500 fluid-px-2">
            <span>{filteredStandards.length} estándar{filteredStandards.length !== 1 ? 'es' : ''} encontrado{filteredStandards.length !== 1 ? 's' : ''}</span>
          </div>
          
          {/* Lista de estándares */}
          {filteredStandards.map((standard) => (
            <StandardRow
              key={standard.id}
              standard={standard}
              onView={() => navigate(`/standards/${standard.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
