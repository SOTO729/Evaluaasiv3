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
  ChevronRight
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
      className="bg-white border-2 border-gray-200 rounded-xl p-4 sm:p-5 hover:border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {standard.code}
            </span>
            {standard.level && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${getLevelBadgeColor(standard.level)}`}>
                Nivel {standard.level}
              </span>
            )}
            {standard.is_active ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
                <CheckCircle2 className="h-3 w-3" />
                Activo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                <XCircle className="h-3 w-3" />
                Inactivo
              </span>
            )}
          </div>
          
          <h3 
            className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1"
            title={standard.name}
          >
            {standard.name}
          </h3>
          
          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
            {standard.sector && (
              <div className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                <span>{standard.sector}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{standard.validity_years} años</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              <span>{standard.exam_count || 0} exámenes</span>
            </div>
          </div>
        </div>

        {/* Indicador de acción - aparece al hover */}
        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0">
          <span className="text-xs text-blue-600 font-medium whitespace-nowrap">Ver detalle</span>
          <ChevronRight className="w-4 h-4 text-blue-500" />
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
  const isEditor = user?.role === 'editor';
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
    <div className="p-4 sm:p-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600" />
            Estándares de Competencia
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Gestiona los ECM del sistema CONOCER
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Link
              to="/standards/deletion-requests"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors"
            >
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Solicitudes</span>
            </Link>
          )}
          {canCreate && (
            <Link
              to="/standards/new"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors w-full sm:w-auto"
            >
              <Plus className="h-5 w-5" />
              Nuevo Estándar
            </Link>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
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
              className="w-full pl-10 pr-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            />
          </div>
          
          {/* Toggle de inactivos */}
          <label className="inline-flex items-center cursor-pointer bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ms-3 text-sm font-medium text-gray-700 whitespace-nowrap">
              Mostrar inactivos
            </span>
          </label>
          
          <button
            onClick={() => loadStandards()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 sm:py-2 rounded-lg transition-colors w-full sm:w-auto flex items-center justify-center gap-2 font-medium"
          >
            <Search className="h-4 w-4" />
            Buscar
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button 
            onClick={loadStandards}
            className="ml-auto text-sm text-red-700 underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Standards List */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8">
          <LoadingSpinner message="Cargando estándares..." />
        </div>
      ) : filteredStandards.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <ClipboardList className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            {searchTerm ? 'No se encontraron estándares' : 'No hay estándares'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm 
              ? 'Intenta con otros términos de búsqueda' 
              : canCreate 
                ? 'Comienza creando un nuevo estándar de competencia' 
                : 'Aún no se han creado estándares'}
          </p>
          {canCreate && !searchTerm && (
            <Link
              to="/standards/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              <Plus className="h-5 w-5" />
              Crear Estándar
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Contador de resultados */}
          <div className="flex items-center justify-between text-sm text-gray-500 px-1">
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
