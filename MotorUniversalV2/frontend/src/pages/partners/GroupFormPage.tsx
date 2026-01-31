/**
 * Formulario para Crear/Editar Grupo de Candidatos
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Layers,
  Building2,
  Calendar,
  Users,
  AlertCircle,
  FileText,
  GraduationCap,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getCampus,
  getGroup,
  createGroup,
  updateGroup,
  getSchoolCycles,
  Campus,
  SchoolCycle,
} from '../../services/partnersService';

export default function GroupFormPage() {
  const { campusId, groupId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = Boolean(groupId);
  
  // Obtener el ciclo desde la URL si viene desde un ciclo específico
  const defaultCycleId = searchParams.get('cycle');
  
  const [campus, setCampus] = useState<Partial<Campus> | null>(null);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
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
    school_cycle_id: defaultCycleId ? parseInt(defaultCycleId) : undefined as number | undefined,
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
        
        // Cargar ciclos del campus
        if (group.campus_id) {
          const cyclesData = await getSchoolCycles(group.campus_id, { active_only: true });
          setCycles(cyclesData.cycles);
        }
        
        setFormData({
          name: group.name,
          code: group.code || '',
          description: group.description || '',
          start_date: group.start_date ? group.start_date.split('T')[0] : '',
          end_date: group.end_date ? group.end_date.split('T')[0] : '',
          max_members: group.max_members || 30,
          is_active: group.is_active,
          school_cycle_id: group.school_cycle_id || undefined,
        });
      } else if (campusId) {
        const [campusData, cyclesData] = await Promise.all([
          getCampus(Number(campusId)),
          getSchoolCycles(Number(campusId), { active_only: true }),
        ]);
        setCampus(campusData);
        setCycles(cyclesData.cycles);
        
        // Si viene un ciclo por URL, usarlo
        if (defaultCycleId) {
          setFormData(prev => ({
            ...prev,
            school_cycle_id: parseInt(defaultCycleId),
          }));
        }
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
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando..." />
      </div>
    );
  }

  if (!campus && !isEditing) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700 fluid-text-base">Plantel no encontrado</p>
          <Link to="/partners" className="ml-auto text-red-700 underline fluid-text-base">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-6xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center fluid-gap-5 fluid-mb-6">
        <Link
          to={isEditing ? `/partners/groups/${groupId}` : `/partners/campuses/${campusId}`}
          className="fluid-p-2 hover:bg-gray-100 rounded-fluid-xl transition-colors"
        >
          <ArrowLeft className="fluid-icon-lg text-gray-600" />
        </Link>
        <div>
          {campus && (
            <div className="flex items-center gap-2 fluid-text-base text-gray-500 mb-1">
              <Building2 className="fluid-icon-sm" />
              <span>{campus.name}</span>
            </div>
          )}
          <h1 className="fluid-text-3xl font-bold text-gray-800">
            {isEditing ? 'Editar Grupo' : 'Nuevo Grupo'}
          </h1>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700 fluid-text-base">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col fluid-gap-6">
        {/* Información Básica */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
          <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-5 flex items-center fluid-gap-2">
            <Layers className="fluid-icon-lg text-amber-600" />
            Información del Grupo
          </h2>

          <div className="grid sm:grid-cols-2 fluid-gap-5">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Nombre del Grupo *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Grupo 2024-A"
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 fluid-text-base"
                required
              />
            </div>

            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Código (opcional)
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Ej: GRP-2024A"
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 fluid-text-base font-mono"
              />
            </div>

            {/* Ciclo Escolar */}
            {cycles.length > 0 && (
              <div>
                <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                  <GraduationCap className="inline h-4 w-4 mr-1" />
                  Ciclo Escolar
                </label>
                <select
                  value={formData.school_cycle_id || ''}
                  onChange={(e) => setFormData({ ...formData, school_cycle_id: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 fluid-text-base"
                >
                  <option value="">Sin ciclo asignado</option>
                  {cycles.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      {cycle.name} {cycle.is_current ? '(Actual)' : ''}
                    </option>
                  ))}
                </select>
                <p className="fluid-text-xs text-gray-500 mt-1">
                  Asigna este grupo a un ciclo escolar específico
                </p>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                <FileText className="inline h-4 w-4 mr-1" />
                Descripción (opcional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción del grupo, programa de estudio, etc."
                rows={3}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 fluid-text-base"
              />
            </div>
          </div>
        </div>

        {/* Fechas y Capacidad */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
          <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-5 flex items-center fluid-gap-2">
            <Calendar className="fluid-icon-lg text-blue-600" />
            Fechas y Capacidad
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 fluid-gap-5">
            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Fecha de Inicio
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 fluid-text-base"
              />
            </div>

            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Fecha de Fin
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                min={formData.start_date}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 fluid-text-base"
              />
            </div>

            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                <Users className="inline h-4 w-4 mr-1" />
                Máximo de Miembros
              </label>
              <input
                type="number"
                value={formData.max_members}
                onChange={(e) => setFormData({ ...formData, max_members: parseInt(e.target.value) || 30 })}
                min={1}
                max={500}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 fluid-text-base"
              />
            </div>
          </div>
        </div>

        {/* Estado */}
        {isEditing && (
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
            <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-5">
              Estado del Grupo
            </h2>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="fluid-icon-lg rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="fluid-text-base text-gray-700">
                Grupo activo
              </span>
            </label>
            <p className="fluid-text-xs text-gray-500 mt-2 fluid-ml-8">
              Los grupos inactivos no permiten agregar nuevos candidatos
            </p>
          </div>
        )}

        {/* Botones */}
        <div className="flex flex-col sm:flex-row fluid-gap-3 fluid-pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-fluid-2xl font-semibold fluid-text-base transition-colors"
          >
            {saving ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="fluid-icon-lg" />
                {isEditing ? 'Guardar Cambios' : 'Crear Grupo'}
              </>
            )}
          </button>
          
          <Link
            to={isEditing ? `/partners/groups/${groupId}` : `/partners/campuses/${campusId}`}
            className="sm:w-auto inline-flex items-center justify-center fluid-px-6 fluid-py-3 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-fluid-2xl font-semibold fluid-text-base transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
