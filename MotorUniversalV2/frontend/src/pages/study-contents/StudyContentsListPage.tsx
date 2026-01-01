/**
 * Página de lista de Materiales de Estudio
 */
import { useState, useEffect } from 'react';
import { useNavigate, NavigateFunction } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { 
  getMaterials, 
  deleteMaterial, 
  StudyMaterial, 
  MaterialsResponse 
} from '../../services/studyContentService';
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
  Calendar
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

// Componente de tarjeta de material
interface MaterialCardProps {
  material: StudyMaterial;
  navigate: NavigateFunction;
}

const MaterialCard = ({ material, navigate }: MaterialCardProps) => (
  <div
    className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 group"
  >
    {/* Card Image */}
    <div 
      className="relative h-40 bg-gradient-to-br from-blue-500 to-blue-700 cursor-pointer"
      onClick={() => navigate(`/study-contents/${material.id}`)}
    >
      {material.image_url ? (
        <img
          src={material.image_url}
          alt={material.title}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <BookOpen className="h-16 w-16 text-white/50" />
        </div>
      )}
      
      {/* Status Badge */}
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
              <Eye className="h-3 w-3" />
              Publicado
            </>
          ) : (
            <>
              <EyeOff className="h-3 w-3" />
              Borrador
            </>
          )}
        </span>
      </div>
    </div>

    {/* Card Content */}
    <div className="p-4">
      <h3 
        className="font-semibold text-gray-900 mb-1 line-clamp-1 cursor-pointer hover:text-blue-600 transition-colors"
        onClick={() => navigate(`/study-contents/${material.id}`)}
      >
        {material.title}
      </h3>
      {material.description && (
        <p 
          className="text-sm text-gray-500 line-clamp-2 mb-3"
          dangerouslySetInnerHTML={{ 
            __html: DOMPurify.sanitize(material.description, { ALLOWED_TAGS: [] }) 
          }}
        />
      )}
      
      {/* Card Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" title="Sesiones">
            <Layers className="h-3.5 w-3.5" />
            <span>{material.sessions_count || 0}</span>
          </div>
          <div className="flex items-center gap-1" title="Temas">
            <FileText className="h-3.5 w-3.5" />
            <span>{material.topics_count || 0}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {new Date(material.created_at).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>
      </div>
    </div>
  </div>
);

const StudyContentsListPage = () => {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<StudyMaterial | null>(null);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const response: MaterialsResponse = await getMaterials(currentPage, 10, searchTerm);
      setMaterials(response.materials);
      setTotalPages(response.pages);
      setTotal(response.total);
    } catch (error) {
      console.error('Error al cargar materiales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [currentPage, searchTerm]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchMaterials();
  };

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
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-blue-600" />
            Materiales de Estudio
          </h1>
          <p className="text-gray-600 mt-1">
            Gestiona los materiales de estudio organizados por sesiones y temas
          </p>
        </div>
        <button
          onClick={() => navigate('/study-contents/create')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Nuevo Material
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar materiales..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Materials Grid */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8">
          <LoadingSpinner message="Cargando materiales..." />
        </div>
      ) : materials.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No hay materiales</h3>
          <p className="text-gray-500 mb-4">Crea tu primer material de estudio</p>
          <button
            onClick={() => navigate('/study-contents/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Crear Material
          </button>
        </div>
      ) : (
        <>
          {/* Sección de Publicados */}
          {materials.filter(m => m.is_published).length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-800">Publicados</h2>
                <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  {materials.filter(m => m.is_published).length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {materials.filter(m => m.is_published).map((material) => (
                  <MaterialCard 
                    key={material.id} 
                    material={material} 
                    navigate={navigate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sección de Borradores */}
          {materials.filter(m => !m.is_published).length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <EyeOff className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-800">Borradores</h2>
                <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                  {materials.filter(m => !m.is_published).length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {materials.filter(m => !m.is_published).map((material) => (
                  <MaterialCard 
                    key={material.id} 
                    material={material} 
                    navigate={navigate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between bg-white rounded-lg shadow px-6 py-4">
              <p className="text-sm text-gray-600">
                Mostrando {materials.length} de {total} materiales
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="px-3 py-1 text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar Material</h3>
            <p className="text-gray-600 mb-4">
              ¿Estás seguro de que deseas eliminar el material "{materialToDelete?.title}"? 
              Esta acción también eliminará todas las sesiones y temas asociados.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setMaterialToDelete(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
