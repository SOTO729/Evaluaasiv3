/**
 * Página de lista de Materiales de Estudio
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, NavigateFunction } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { 
  getMaterials, 
  deleteMaterial, 
  StudyMaterial, 
  MaterialsResponse 
} from '../../services/studyContentService';
import { getMisMateriales } from '../../services/partnersService';
import { useAuthStore } from '../../store/authStore';
import { OptimizedImage } from '../../components/ui/OptimizedImage';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Eye, 
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Layers,
  FileText,
  Calendar,
  Clock
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

// Hook para debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Componente de tarjeta de material
interface MaterialCardProps {
  material: StudyMaterial;
  navigate: NavigateFunction;
  index?: number;
  showStatus?: boolean;
  isCandidate?: boolean;
}

const MaterialCard = ({ material, navigate, index = 0, showStatus = true, isCandidate = false }: MaterialCardProps) => (
  <div
    className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 group animate-stagger-in"
    style={{ animationDelay: `${index * 50}ms` }}
  >
    {/* Card Image - altura fija para consistencia */}
    <div 
      className="relative h-40 bg-gradient-to-br from-blue-500 to-blue-700 cursor-pointer"
      onClick={() => navigate(`/study-contents/${material.id}`)}
    >
      {material.image_url ? (
        <OptimizedImage
          src={material.image_url}
          alt={material.title}
          className="w-full h-full object-cover"
          fallbackIcon={<BookOpen className="fluid-icon-xl text-white/50" />}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <BookOpen className="fluid-icon-xl text-white/50" />
        </div>
      )}
      
      {/* Status Badge - Solo mostrar si showStatus es true */}
      {showStatus && (
        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              material.is_published
                ? 'bg-green-500 text-white'
                : 'bg-gray-800/70 text-white'
            }`}
          >
            {material.is_published ? (
              <>
                <Eye className="w-3 h-3" />
                Publicado
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3" />
                Borrador
              </>
            )}
          </span>
        </div>
      )}
    </div>

    {/* Card Content */}
    <div className="fluid-p-4">
      <h3 
        className="font-semibold text-gray-900 mb-2 fluid-text-base line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors"
        onClick={() => navigate(`/study-contents/${material.id}`)}
        title={material.title}
      >
        {material.title}
      </h3>
      {material.description && (
        <p 
          className="fluid-text-xs text-gray-500 line-clamp-2 mb-3"
          dangerouslySetInnerHTML={{ 
            __html: DOMPurify.sanitize(material.description, { ALLOWED_TAGS: [] }) 
          }}
        />
      )}
      
      {/* Card Footer */}
      <div className="flex items-center justify-between fluid-text-xs text-gray-400 pt-3 border-t">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" title="Sesiones">
            <Layers className="fluid-icon-xs" />
            <span>{material.sessions_count || 0}</span>
          </div>
          <div className="flex items-center gap-1" title="Temas">
            <FileText className="fluid-icon-xs" />
            <span>{material.topics_count || 0}</span>
          </div>
          {(material.estimated_time_minutes && material.estimated_time_minutes > 0) && (
            <div className="flex items-center gap-1" title="Tiempo estimado">
              <Clock className="fluid-icon-xs" />
              <span>{material.estimated_time_minutes} min</span>
            </div>
          )}
        </div>
        {!isCandidate && (
          <div className="flex items-center gap-1">
            <Calendar className="fluid-icon-xs" />
            <span>
              {new Date(material.created_at).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  </div>
);

const StudyContentsListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<StudyMaterial | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const draftsRef = useRef<HTMLDivElement>(null);
  
  const isCandidate = user?.role === 'candidato' || user?.role === 'responsable';
  const canCreate = user?.role === 'admin' || user?.role === 'editor';
  
  // Debounce del término de búsqueda (300ms)
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Scroll a borradores si viene el parámetro
  useEffect(() => {
    if (searchParams.get('scrollTo') === 'drafts' && !loading && draftsRef.current) {
      setTimeout(() => {
        const element = draftsRef.current;
        if (element) {
          const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
          const offsetPosition = elementPosition - 100;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
        searchParams.delete('scrollTo');
        setSearchParams(searchParams, { replace: true });
      }, 300);
    }
  }, [searchParams, loading, setSearchParams]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      if (isCandidate) {
        // Para candidatos y responsables, usar getMisMateriales que filtra por asignación
        const response = await getMisMateriales();
        const assignedMaterials = response.materials || [];
        // Filtrar por término de búsqueda si existe
        let filteredMaterials = assignedMaterials;
        if (debouncedSearchTerm) {
          const searchLower = debouncedSearchTerm.toLowerCase();
          filteredMaterials = assignedMaterials.filter((m: StudyMaterial) => 
            m.title.toLowerCase().includes(searchLower) || 
            (m.description && m.description.toLowerCase().includes(searchLower))
          );
        }
        // Paginar manualmente
        const pageSize = 10;
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedMaterials = filteredMaterials.slice(startIndex, endIndex);
        
        setMaterials(paginatedMaterials);
        setTotalPages(Math.ceil(filteredMaterials.length / pageSize) || 1);
        setTotal(filteredMaterials.length);
      } else {
        // Para admin y editor, usar getMaterials normal
        const response: MaterialsResponse = await getMaterials(currentPage, 10, debouncedSearchTerm, false);
        setMaterials(response.materials);
        setTotalPages(response.pages);
        setTotal(response.total);
      }
    } catch (error) {
      console.error('Error al cargar materiales:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset page when debounced search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    fetchMaterials();
  }, [currentPage, debouncedSearchTerm]);

  const handleDelete = async () => {
    if (!materialToDelete) return;
    try {
      await deleteMaterial(materialToDelete.id);
      setDeleteModalOpen(false);
      setMaterialToDelete(null);
      fetchMaterials();
    } catch (error) {
      console.error('Error al eliminar material:', error);
    }
  };

  // La función de eliminar se mantiene comentada por si se necesita en el futuro
  // const openDeleteModal = (material: StudyMaterial) => {
  //   setMaterialToDelete(material);
  //   setDeleteModalOpen(true);
  // };

  return (
    <div className="fluid-p-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center fluid-gap-4 fluid-mb-6">
        <div>
          <h1 className="fluid-text-3xl font-bold text-gray-800 flex items-center fluid-gap-3">
            <BookOpen className="fluid-icon-xl text-blue-600" />
            {isCandidate ? 'Materiales Disponibles' : 'Materiales de Estudio'}
          </h1>
          <p className="fluid-text-base text-gray-600 fluid-mt-2">
            {isCandidate 
              ? 'Explora los materiales de estudio disponibles' 
              : 'Materiales organizados por sesiones'}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => navigate('/study-contents/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white fluid-px-6 fluid-py-3 rounded-fluid-lg flex items-center justify-center fluid-gap-2 transition-colors w-full sm:w-auto fluid-text-base"
          >
            <Plus className="fluid-icon" />
            Nuevo Material
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-fluid-lg shadow fluid-p-5 fluid-mb-6">
        <div className="flex flex-col sm:flex-row fluid-gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon text-gray-400" />
            <input
              type="text"
              placeholder="Buscar materiales..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  fetchMaterials()
                }
              }}
              className="w-full pl-10 fluid-pr-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
            />
          </div>
          <button
            onClick={() => fetchMaterials()}
            className="bg-blue-600 hover:bg-blue-700 text-white fluid-px-8 fluid-py-3 rounded-fluid-lg transition-colors w-full sm:w-auto flex items-center justify-center fluid-gap-2 font-medium fluid-text-base"
          >
            <Search className="fluid-icon-sm" />
            Buscar
          </button>
        </div>
      </div>

      {/* Materials Grid */}
      {loading ? (
        <div className="bg-white rounded-fluid-lg shadow fluid-p-8">
          <LoadingSpinner message="Cargando materiales..." />
        </div>
      ) : materials.length === 0 ? (
        <div className="bg-white rounded-fluid-lg shadow fluid-p-8 text-center">
          <BookOpen className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-4" />
          <h3 className="fluid-text-lg font-medium text-gray-700 fluid-mb-2">
            {isCandidate ? 'No hay materiales disponibles' : 'No hay materiales'}
          </h3>
          <p className="text-gray-500 fluid-mb-4">
            {isCandidate 
              ? 'Aún no hay materiales de estudio publicados' 
              : 'Crea tu primer material de estudio'}
          </p>
          {canCreate && (
            <button
              onClick={() => navigate('/study-contents/create')}
              className="bg-blue-600 hover:bg-blue-700 text-white fluid-px-4 fluid-py-2 rounded-fluid-lg inline-flex items-center fluid-gap-2"
            >
              <Plus className="fluid-icon" />
              Crear Material
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Para candidatos: mostrar todos en una sola lista sin secciones */}
          {isCandidate ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-5 4xl:grid-cols-6 fluid-gap-6 fluid-mb-8">
              {materials.map((material, index) => (
                <MaterialCard 
                  key={material.id} 
                  material={material} 
                  navigate={navigate}
                  index={index}
                  showStatus={false}
                  isCandidate={true}
                />
              ))}
            </div>
          ) : (
            <>
              {/* Sección de Publicados */}
              {materials.filter(m => m.is_published).length > 0 && (
                <div className="fluid-mb-8">
                  <div className="flex items-center fluid-gap-2 fluid-mb-6">
                    <Eye className="fluid-icon text-green-600" />
                    <h2 className="fluid-text-lg font-semibold text-gray-800">Publicados</h2>
                    <span className="bg-green-100 text-green-700 fluid-text-sm font-medium fluid-px-2 fluid-py-1 rounded-full">
                      {materials.filter(m => m.is_published).length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-5 4xl:grid-cols-6 fluid-gap-6">
                    {materials.filter(m => m.is_published).map((material, index) => (
                      <MaterialCard 
                        key={material.id} 
                        material={material} 
                        navigate={navigate}
                        index={index}
                        showStatus={true}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Línea divisoria entre secciones */}
              {materials.filter(m => m.is_published).length > 0 && materials.filter(m => !m.is_published).length > 0 && (
                <div className="fluid-my-8">
                  <hr className="border-t-2 border-gray-300" />
                </div>
              )}

              {/* Sección de Borradores */}
              {materials.filter(m => !m.is_published).length > 0 && (
                <div ref={draftsRef} className="fluid-mb-10 scroll-mt-4">
                  <div className="flex items-center fluid-gap-2 fluid-mb-6">
                    <EyeOff className="fluid-icon text-gray-500" />
                    <h2 className="fluid-text-lg font-semibold text-gray-800">Borradores</h2>
                    <span className="bg-gray-100 text-gray-600 fluid-text-sm font-medium fluid-px-2 fluid-py-1 rounded-full">
                      {materials.filter(m => !m.is_published).length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-5 4xl:grid-cols-6 fluid-gap-6">
                    {materials.filter(m => !m.is_published).map((material, index) => (
                      <MaterialCard 
                        key={material.id} 
                        material={material} 
                        navigate={navigate}
                        index={index}
                        showStatus={true}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="fluid-mt-6 flex flex-col sm:flex-row items-center justify-between fluid-gap-3 bg-white rounded-fluid-lg shadow fluid-px-5 fluid-py-4">
              <p className="fluid-text-sm text-gray-600 order-2 sm:order-1">
                Mostrando {materials.length} de {total} materiales
              </p>
              <div className="flex items-center fluid-gap-2 order-1 sm:order-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="fluid-p-2 rounded-fluid-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100"
                >
                  <ChevronLeft className="fluid-icon-sm" />
                </button>
                <span className="fluid-px-3 fluid-py-1 fluid-text-sm min-w-[100px] text-center">
                  {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="fluid-p-2 rounded-fluid-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100"
                >
                  <ChevronRight className="fluid-icon-sm" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/50  flex items-center justify-center z-50 fluid-p-4" onClick={() => { setDeleteModalOpen(false); setMaterialToDelete(null); }}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl fluid-p-6 max-w-md w-full animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <h3 className="fluid-text-lg font-bold text-gray-900 fluid-mb-2">Eliminar Material</h3>
            <p className="text-gray-600 fluid-mb-4">
              ¿Estás seguro de que deseas eliminar el material "{materialToDelete?.title}"? 
              Esta acción también eliminará todas las sesiones y temas asociados.
            </p>
            <div className="flex justify-end fluid-gap-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setMaterialToDelete(null);
                }}
                className="fluid-px-4 fluid-py-2 border border-gray-300 rounded-fluid-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="fluid-px-4 fluid-py-2 bg-red-600 text-white rounded-fluid-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyContentsListPage;
