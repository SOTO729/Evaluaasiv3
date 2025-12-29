import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { examService } from '../../services/examService'
import { useAuthStore } from '../../store/authStore'
import LoadingSpinner from '../../components/LoadingSpinner'
import { 
  FileText, 
  Plus, 
  Eye, 
  EyeOff, 
  Edit2, 
  Trash2, 
  Clock, 
  HelpCircle,
  ClipboardList,
  Target,
  MoreVertical,
  Layers,
  Calendar
} from 'lucide-react'

// Componente de tarjeta de examen con nuevo diseño
const ExamCard = ({ 
  exam, 
  onEdit, 
  onDelete,
  activeMenu,
  setActiveMenu
}: { 
  exam: any;
  onEdit: (id: string) => void;
  onDelete: (exam: any) => void;
  activeMenu: string | null;
  setActiveMenu: (id: string | null) => void;
}) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 group">
      {/* Card Image */}
      <div 
        className="relative h-40 bg-gradient-to-br from-blue-600 to-blue-800 cursor-pointer"
        onClick={() => navigate(`/exams/${exam.id}/edit`)}
      >
        {exam.image_url ? (
          <img
            src={exam.image_url}
            alt={exam.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText className="h-16 w-16 text-white/50" />
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              exam.is_published
                ? 'bg-green-500 text-white'
                : 'bg-gray-800/70 text-white'
            }`}
          >
            {exam.is_published ? (
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

        {/* Version Badge */}
        <div className="absolute top-3 right-12">
          <span className="px-2 py-1 rounded-full text-xs font-mono bg-black/30 text-white">
            {exam.version}
          </span>
        </div>

        {/* Menu Button */}
        <div className="absolute top-3 right-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenu(activeMenu === exam.id ? null : exam.id);
            }}
            className="p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          
          {/* Dropdown Menu */}
          {activeMenu === exam.id && (
            <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border py-1 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(exam.id);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit2 className="h-4 w-4" />
                Editar
              </button>
              <hr className="my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(exam);
                  setActiveMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4">
        <h3 
          className="font-semibold text-gray-900 mb-2 line-clamp-1 cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => navigate(`/exams/${exam.id}/edit`)}
        >
          {exam.name}
        </h3>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Target className="h-3.5 w-3.5 text-green-500" />
            <span>{exam.passing_score}% aprobación</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-blue-500" />
            <span>{exam.duration_minutes || 0} min</span>
          </div>
          <div className="flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5 text-purple-500" />
            <span>{exam.total_questions} preguntas</span>
          </div>
          <div className="flex items-center gap-1">
            <ClipboardList className="h-3.5 w-3.5 text-amber-500" />
            <span>{exam.total_exercises} ejercicios</span>
          </div>
        </div>
        
        {/* Card Footer */}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t">
          <div className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" />
            <span>{exam.total_categories || 0} categorías</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {new Date(exam.created_at).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const ExamsListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore()
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<any>(null);
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examService.getExams(),
    staleTime: 30000,
  })

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    if (activeMenu !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenu]);

  const handleEdit = (id: string) => {
    navigate(`/exams/${id}/edit`);
  };

  const handleDelete = async () => {
    if (!examToDelete) return;
    try {
      await examService.deleteExam(examToDelete.id);
      setDeleteModalOpen(false);
      setExamToDelete(null);
      refetch();
    } catch (error) {
      console.error('Error al eliminar examen:', error);
    }
  };

  const openDeleteModal = (exam: any) => {
    setExamToDelete(exam);
    setDeleteModalOpen(true);
  };

  if (isLoading) return <LoadingSpinner message="Cargando exámenes..." fullScreen />
  if (error) return <div className="text-center py-12 text-red-600">Error al cargar exámenes</div>

  const canCreateExam = user?.role === 'admin' || user?.role === 'editor'

  // Separar exámenes publicados y borradores
  const publishedExams = data?.exams?.filter((exam: any) => exam.is_published) || []
  const draftExams = data?.exams?.filter((exam: any) => !exam.is_published) || []
  const hasExams = (data?.exams?.length || 0) > 0

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="h-7 w-7 text-blue-600" />
            Exámenes
          </h1>
          <p className="text-gray-600 mt-1">
            Gestiona los exámenes con sus categorías, preguntas y ejercicios
          </p>
        </div>
        {canCreateExam && (
          <Link 
            to="/exams/create" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Nuevo Examen
          </Link>
        )}
      </div>

      {hasExams ? (
        <>
          {/* Sección de Exámenes Publicados */}
          {publishedExams.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Publicados ({publishedExams.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {publishedExams.map((exam: any) => (
                  <ExamCard 
                    key={exam.id} 
                    exam={exam} 
                    onEdit={handleEdit}
                    onDelete={openDeleteModal}
                    activeMenu={activeMenu}
                    setActiveMenu={setActiveMenu}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sección de Borradores */}
          {draftExams.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Borradores ({draftExams.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {draftExams.map((exam: any) => (
                  <ExamCard 
                    key={exam.id} 
                    exam={exam}
                    onEdit={handleEdit}
                    onDelete={openDeleteModal}
                    activeMenu={activeMenu}
                    setActiveMenu={setActiveMenu}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No hay exámenes</h3>
          <p className="text-gray-500 mb-4">Crea tu primer examen para comenzar</p>
          {canCreateExam && (
            <Link 
              to="/exams/create" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Crear Examen
            </Link>
          )}
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar Examen</h3>
            <p className="text-gray-600 mb-4">
              ¿Estás seguro de que deseas eliminar el examen "{examToDelete?.name}"? 
              Esta acción también eliminará todas las categorías, preguntas y ejercicios asociados.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setExamToDelete(null);
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
  )
}

export default ExamsListPage
