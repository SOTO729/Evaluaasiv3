/**
 * Formulario para Crear/Editar Grupo de Candidatos
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Layers,
  Building2,
  Calendar,
  Users,
  AlertCircle,
  FileText,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getCampus,
  getGroup,
  createGroup,
  updateGroup,
  Campus,
} from '../../services/partnersService';

export default function GroupFormPage() {
  const { campusId, groupId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(groupId);
  
  const [campus, setCampus] = useState<Partial<Campus> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    start_date: '',
    end_date: '',
    max_members: 30,
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, [campusId, groupId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (isEditing && groupId) {
        const group = await getGroup(Number(groupId));
        setCampus({
          id: group.campus_id,
          partner_id: group.campus?.partner_id || 0,
          name: group.campus?.name || '',
          state_name: group.campus?.state_name || '',
          is_active: true,
        });
        
        setFormData({
          name: group.name,
          code: group.code || '',
          description: group.description || '',
          start_date: group.start_date ? group.start_date.split('T')[0] : '',
          end_date: group.end_date ? group.end_date.split('T')[0] : '',
          max_members: group.max_members || 30,
          is_active: group.is_active,
        });
      } else if (campusId) {
        const campusData = await getCampus(Number(campusId));
        setCampus(campusData);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('El nombre del grupo es obligatorio');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      if (isEditing && groupId) {
        await updateGroup(Number(groupId), formData);
        navigate(`/partners/groups/${groupId}`);
      } else if (campusId) {
        const newGroup = await createGroup(Number(campusId), formData);
        navigate(`/partners/groups/${newGroup.id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar el grupo');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando..." />
      </div>
    );
  }

  if (!campus && !isEditing) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg lg:rounded-xl p-4 lg:p-6 flex items-center gap-3 lg:gap-4">
          <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 text-red-600" />
          <p className="text-red-700 text-sm lg:text-base">Plantel no encontrado</p>
          <Link to="/partners" className="ml-auto text-red-700 underline text-sm lg:text-base">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-4xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-4 lg:gap-6 mb-6 lg:mb-8">
        <Link
          to={isEditing ? `/partners/groups/${groupId}` : `/partners/campuses/${campusId}`}
          className="p-2 lg:p-3 hover:bg-gray-100 rounded-lg lg:rounded-xl transition-colors"
        >
          <ArrowLeft className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7 text-gray-600" />
        </Link>
        <div>
          {campus && (
            <div className="flex items-center gap-2 text-sm lg:text-base text-gray-500 mb-1">
              <Building2 className="h-4 w-4 lg:h-5 lg:w-5" />
              <span>{campus.name}</span>
            </div>
          )}
          <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-800">
            {isEditing ? 'Editar Grupo' : 'Nuevo Grupo'}
          </h1>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg lg:rounded-xl p-4 lg:p-5 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700 text-sm lg:text-base">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-8">
        {/* Información Básica */}
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6 xl:p-8">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-800 mb-4 lg:mb-6 flex items-center gap-2 lg:gap-3">
            <Layers className="h-5 w-5 lg:h-6 lg:w-6 text-amber-600" />
            Información del Grupo
          </h2>

          <div className="grid sm:grid-cols-2 gap-4 lg:gap-6">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Nombre del Grupo *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Grupo 2024-A"
                className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm lg:text-base"
                required
              />
            </div>

            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Código (opcional)
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Ej: GRP-2024A"
                className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm lg:text-base font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                <FileText className="inline h-4 w-4 mr-1" />
                Descripción (opcional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción del grupo, programa de estudio, etc."
                rows={3}
                className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm lg:text-base"
              />
            </div>
          </div>
        </div>

        {/* Fechas y Capacidad */}
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6 xl:p-8">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-800 mb-4 lg:mb-6 flex items-center gap-2 lg:gap-3">
            <Calendar className="h-5 w-5 lg:h-6 lg:w-6 text-blue-600" />
            Fechas y Capacidad
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Fecha de Inicio
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm lg:text-base"
              />
            </div>

            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Fecha de Fin
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                min={formData.start_date}
                className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm lg:text-base"
              />
            </div>

            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                <Users className="inline h-4 w-4 mr-1" />
                Máximo de Miembros
              </label>
              <input
                type="number"
                value={formData.max_members}
                onChange={(e) => setFormData({ ...formData, max_members: parseInt(e.target.value) || 30 })}
                min={1}
                max={500}
                className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm lg:text-base"
              />
            </div>
          </div>
        </div>

        {/* Estado */}
        {isEditing && (
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6 xl:p-8">
            <h2 className="text-lg lg:text-xl font-semibold text-gray-800 mb-4 lg:mb-6">
              Estado del Grupo
            </h2>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-5 w-5 lg:h-6 lg:w-6 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm lg:text-base text-gray-700">
                Grupo activo
              </span>
            </label>
            <p className="text-xs lg:text-sm text-gray-500 mt-2 ml-8 lg:ml-9">
              Los grupos inactivos no permiten agregar nuevos candidatos
            </p>
          </div>
        )}

        {/* Botones */}
        <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 lg:gap-3 px-6 lg:px-8 py-3 lg:py-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-xl lg:rounded-2xl font-semibold text-sm lg:text-base xl:text-lg transition-colors"
          >
            {saving ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 lg:h-6 lg:w-6" />
                {isEditing ? 'Guardar Cambios' : 'Crear Grupo'}
              </>
            )}
          </button>
          
          <Link
            to={isEditing ? `/partners/groups/${groupId}` : `/partners/campuses/${campusId}`}
            className="sm:w-auto inline-flex items-center justify-center px-6 lg:px-8 py-3 lg:py-4 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl lg:rounded-2xl font-semibold text-sm lg:text-base xl:text-lg transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
