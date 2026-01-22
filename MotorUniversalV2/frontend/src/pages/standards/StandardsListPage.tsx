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
      className="bg-white border-2 border-gray-200 rounded-xl lg:rounded-2xl p-4 sm:p-5 lg:p-6 xl:p-7 2xl:p-8 hover:border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 lg:gap-4 xl:gap-5 2xl:gap-6">
        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 lg:gap-3 xl:gap-4 mb-1 lg:mb-2 xl:mb-3 flex-wrap">
            <span className="font-mono text-sm lg:text-base xl:text-lg 2xl:text-xl font-semibold text-blue-600 bg-blue-50 px-2 lg:px-3 xl:px-4 py-0.5 lg:py-1 xl:py-1.5 rounded lg:rounded-lg">
              {standard.code}
            </span>
            {standard.level && (
              <span className={`text-xs lg:text-sm xl:text-base 2xl:text-lg font-medium px-2 lg:px-3 xl:px-4 py-0.5 lg:py-1 xl:py-1.5 rounded lg:rounded-lg ${getLevelBadgeColor(standard.level)}`}>
                Nivel {standard.level}
              </span>
            )}
            {standard.is_active ? (
              <span className="inline-flex items-center gap-1 lg:gap-1.5 xl:gap-2 text-xs lg:text-sm xl:text-base 2xl:text-lg font-medium text-green-700 bg-green-50 px-2 lg:px-3 xl:px-4 py-0.5 lg:py-1 xl:py-1.5 rounded lg:rounded-lg">
                <CheckCircle2 className="h-3 w-3 lg:h-4 lg:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6" />
                Activo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 lg:gap-1.5 xl:gap-2 text-xs lg:text-sm xl:text-base 2xl:text-lg font-medium text-gray-600 bg-gray-100 px-2 lg:px-3 xl:px-4 py-0.5 lg:py-1 xl:py-1.5 rounded lg:rounded-lg">
                <XCircle className="h-3 w-3 lg:h-4 lg:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6" />
                Inactivo
              </span>
            )}
          </div>
          
          <h3 
            className="font-medium text-base lg:text-lg xl:text-xl 2xl:text-2xl text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1"
            title={standard.name}
          >
            {standard.name}
          </h3>
          
          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-4 lg:gap-x-5 xl:gap-x-6 2xl:gap-x-8 gap-y-1 lg:gap-y-2 mt-2 lg:mt-3 xl:mt-4 text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-500">
            {standard.sector && (
              <div className="flex items-center gap-1 lg:gap-1.5 xl:gap-2">
                <Building2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6" />
                <span>{standard.sector}</span>
              </div>
            )}
            <div className="flex items-center gap-1 lg:gap-1.5 xl:gap-2">
              <Clock className="h-3.5 w-3.5 lg:h-4 lg:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6" />
              <span>{standard.validity_years} años</span>
            </div>
            <div className="flex items-center gap-1 lg:gap-1.5 xl:gap-2">
              <FileText className="h-3.5 w-3.5 lg:h-4 lg:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6" />
              <span>{standard.exam_count || 0} exámenes</span>
            </div>
          </div>
        </div>

        {/* Indicador de acción - aparece al hover */}
        <div className="hidden sm:flex items-center gap-1 lg:gap-2 xl:gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0">
          <span className="text-xs lg:text-sm xl:text-base 2xl:text-lg text-blue-600 font-medium whitespace-nowrap">Ver detalle</span>
          <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6 2xl:w-7 2xl:h-7 text-blue-500" />
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
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 lg:gap-6 xl:gap-8 mb-4 sm:mb-6 lg:mb-8 xl:mb-10 2xl:mb-12">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-bold text-gray-800 flex items-center gap-2 lg:gap-3 xl:gap-4">
            <ClipboardList className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 xl:h-10 xl:w-10 2xl:h-12 2xl:w-12 text-blue-600" />
            Estándares de Competencia
          </h1>
          <p className="text-sm sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl text-gray-600 mt-1 lg:mt-2 xl:mt-3">
            Gestiona los ECM del sistema CONOCER
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:gap-3 xl:gap-4">
          {isAdmin && (
            <Link
              to="/standards/deletion-requests"
              className="inline-flex items-center justify-center gap-2 lg:gap-3 px-4 lg:px-5 xl:px-6 2xl:px-8 py-2 lg:py-2.5 xl:py-3 2xl:py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg lg:rounded-xl font-medium text-sm lg:text-base xl:text-lg 2xl:text-xl transition-colors"
            >
              <ClipboardList className="h-4 w-4 lg:h-5 lg:w-5 xl:h-6 xl:w-6 2xl:h-7 2xl:w-7" />
              <span className="hidden sm:inline">Solicitudes</span>
            </Link>
          )}
          {canCreate && (
            <Link
              to="/standards/new"
              className="inline-flex items-center justify-center gap-2 lg:gap-3 px-4 lg:px-5 xl:px-6 2xl:px-8 py-2 lg:py-2.5 xl:py-3 2xl:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg lg:rounded-xl font-medium text-sm lg:text-base xl:text-lg 2xl:text-xl transition-colors w-full sm:w-auto"
            >
              <Plus className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7 2xl:h-8 2xl:w-8" />
              Nuevo Estándar
            </Link>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg lg:rounded-xl xl:rounded-2xl shadow p-3 sm:p-4 lg:p-5 xl:p-6 2xl:p-8 mb-4 sm:mb-6 lg:mb-8 xl:mb-10">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 lg:gap-5 xl:gap-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 lg:left-4 xl:left-5 top-1/2 -translate-y-1/2 h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7 2xl:h-8 2xl:w-8 text-gray-400" />
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
              className="w-full pl-10 lg:pl-12 xl:pl-14 2xl:pl-16 pr-4 lg:pr-5 xl:pr-6 py-2.5 sm:py-2 lg:py-3 xl:py-4 2xl:py-5 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg xl:text-xl 2xl:text-2xl"
            />
          </div>
          
          {/* Toggle de inactivos */}
          <label className="inline-flex items-center cursor-pointer bg-gray-50 px-4 lg:px-5 xl:px-6 2xl:px-8 py-2 lg:py-3 xl:py-4 rounded-lg lg:rounded-xl border border-gray-200">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative w-9 lg:w-11 xl:w-12 2xl:w-14 h-5 lg:h-6 xl:h-7 2xl:h-8 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] lg:after:top-[3px] xl:after:top-[4px] after:start-[2px] lg:after:start-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 lg:after:h-5 xl:after:h-5 2xl:after:h-6 after:w-4 lg:after:w-5 xl:after:w-5 2xl:after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ms-3 lg:ms-4 text-sm lg:text-base xl:text-lg 2xl:text-xl font-medium text-gray-700 whitespace-nowrap">
              Mostrar inactivos
            </span>
          </label>
          
          <button
            onClick={() => loadStandards()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 lg:px-8 xl:px-10 2xl:px-12 py-2.5 sm:py-2 lg:py-3 xl:py-4 2xl:py-5 rounded-lg lg:rounded-xl transition-colors w-full sm:w-auto flex items-center justify-center gap-2 lg:gap-3 font-medium text-base lg:text-lg xl:text-xl 2xl:text-2xl"
          >
            <Search className="h-4 w-4 lg:h-5 lg:w-5 xl:h-6 xl:w-6 2xl:h-7 2xl:w-7" />
            Buscar
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 lg:mb-6 xl:mb-8 p-4 lg:p-5 xl:p-6 2xl:p-8 bg-red-50 border border-red-200 rounded-lg lg:rounded-xl flex items-center gap-3 lg:gap-4 xl:gap-5">
          <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7 2xl:h-8 2xl:w-8 text-red-600 flex-shrink-0" />
          <p className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-red-700">{error}</p>
          <button 
            onClick={loadStandards}
            className="ml-auto text-sm lg:text-base xl:text-lg 2xl:text-xl text-red-700 underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Standards List */}
      {loading ? (
        <div className="bg-white rounded-lg lg:rounded-xl xl:rounded-2xl shadow p-8 lg:p-10 xl:p-12 2xl:p-16">
          <LoadingSpinner message="Cargando estándares..." />
        </div>
      ) : filteredStandards.length === 0 ? (
        <div className="bg-white rounded-lg lg:rounded-xl xl:rounded-2xl shadow p-8 lg:p-10 xl:p-12 2xl:p-16 text-center">
          <ClipboardList className="h-16 w-16 lg:h-20 lg:w-20 xl:h-24 xl:w-24 2xl:h-28 2xl:w-28 text-gray-300 mx-auto mb-4 lg:mb-6 xl:mb-8" />
          <h3 className="text-lg lg:text-xl xl:text-2xl 2xl:text-3xl font-medium text-gray-700 mb-2 lg:mb-3 xl:mb-4">
            {searchTerm ? 'No se encontraron estándares' : 'No hay estándares'}
          </h3>
          <p className="text-gray-500 text-base lg:text-lg xl:text-xl 2xl:text-2xl mb-4 lg:mb-6 xl:mb-8">
            {searchTerm 
              ? 'Intenta con otros términos de búsqueda' 
              : canCreate 
                ? 'Comienza creando un nuevo estándar de competencia' 
                : 'Aún no se han creado estándares'}
          </p>
          {canCreate && !searchTerm && (
            <Link
              to="/standards/new"
              className="inline-flex items-center gap-2 lg:gap-3 px-4 lg:px-6 xl:px-8 py-2 lg:py-3 xl:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg lg:rounded-xl font-medium text-sm lg:text-base xl:text-lg 2xl:text-xl transition-colors"
            >
              <Plus className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7" />
              Crear Estándar
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3 lg:space-y-4 xl:space-y-5 2xl:space-y-6">
          {/* Contador de resultados */}
          <div className="flex items-center justify-between text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-500 px-1 lg:px-2">
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
