/**
 * Detalle de Plantel (Campus) con Grupos
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin,
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  Plus,
  ChevronRight,
  Trash2,
  Users,
  Layers,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getCampus,
  getGroups,
  deleteGroup,
  Campus,
  CandidateGroup,
} from '../../services/partnersService';

export default function CampusDetailPage() {
  const { campusId } = useParams();
  
  const [campus, setCampus] = useState<Campus | null>(null);
  const [groups, setGroups] = useState<CandidateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [campusId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [campusData, groupsData] = await Promise.all([
        getCampus(Number(campusId)),
        getGroups(Number(campusId), { active_only: false }),
      ]);
      setCampus(campusData);
      setGroups(groupsData.groups);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el plantel');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('¿Estás seguro de desactivar este grupo?')) return;
    
    try {
      await deleteGroup(groupId);
      setGroups(groups.map(g => 
        g.id === groupId ? { ...g, is_active: false } : g
      ));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al desactivar el grupo');
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-12 3xl:p-14 4xl:p-16 max-w-[1920px] 3xl:max-w-[2400px] 4xl:max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando plantel..." />
      </div>
    );
  }

  if (error || !campus) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-12 3xl:p-14 4xl:p-16 max-w-[1920px] 3xl:max-w-[2400px] 4xl:max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg lg:rounded-xl p-4 lg:p-6 flex items-center gap-3 lg:gap-4">
          <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 text-red-600" />
          <p className="text-red-700 text-sm lg:text-base">{error || 'Plantel no encontrado'}</p>
          <Link to="/partners" className="ml-auto text-red-700 underline text-sm lg:text-base">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-12 3xl:p-14 4xl:p-16 max-w-[1920px] 3xl:max-w-[2400px] 4xl:max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="flex items-center gap-4 lg:gap-6">
          <Link
            to={`/partners/${campus.partner_id}`}
            className="p-2 lg:p-3 hover:bg-gray-100 rounded-lg lg:rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2 lg:gap-3 text-sm lg:text-base text-gray-500 mb-1">
              <Building2 className="h-4 w-4 lg:h-5 lg:w-5" />
              <Link to={`/partners/${campus.partner_id}`} className="hover:text-blue-600 transition-colors">
                {campus.partner?.name}
              </Link>
            </div>
            <div className="flex items-center gap-2 lg:gap-3">
              <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-bold text-gray-800">
                {campus.name}
              </h1>
              {campus.code && (
                <span className="px-2 lg:px-3 py-0.5 lg:py-1 bg-gray-100 text-gray-600 rounded-lg text-sm lg:text-base font-mono">
                  {campus.code}
                </span>
              )}
              {campus.is_active ? (
                <span className="inline-flex items-center gap-1 text-xs lg:text-sm font-medium text-green-700 bg-green-50 px-2 lg:px-3 py-0.5 lg:py-1 rounded-full">
                  <CheckCircle2 className="h-3 w-3 lg:h-4 lg:w-4" />
                  Activo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs lg:text-sm font-medium text-gray-600 bg-gray-100 px-2 lg:px-3 py-0.5 lg:py-1 rounded-full">
                  <XCircle className="h-3 w-3 lg:h-4 lg:w-4" />
                  Inactivo
                </span>
              )}
            </div>
          </div>
        </div>
        
        <Link
          to={`/partners/campuses/${campusId}/edit`}
          className="inline-flex items-center justify-center gap-2 lg:gap-3 px-4 lg:px-5 xl:px-6 py-2 lg:py-2.5 xl:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg lg:rounded-xl font-medium text-sm lg:text-base xl:text-lg transition-colors"
        >
          <Edit className="h-4 w-4 lg:h-5 lg:w-5" />
          Editar Plantel
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Información del Campus */}
        <div className="lg:col-span-1 space-y-4 lg:space-y-6">
          {/* Ubicación */}
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6">
            <h2 className="text-lg lg:text-xl font-semibold text-gray-800 mb-4 lg:mb-5 flex items-center gap-2">
              <MapPin className="h-5 w-5 lg:h-6 lg:w-6 text-emerald-600" />
              Ubicación
            </h2>
            <div className="space-y-3 lg:space-y-4">
              <div>
                <p className="text-xs lg:text-sm text-gray-500">Estado</p>
                <p className="text-sm lg:text-base font-medium text-gray-900">{campus.state_name}</p>
              </div>
              {campus.city && (
                <div>
                  <p className="text-xs lg:text-sm text-gray-500">Ciudad</p>
                  <p className="text-sm lg:text-base text-gray-900">{campus.city}</p>
                </div>
              )}
              {campus.address && (
                <div>
                  <p className="text-xs lg:text-sm text-gray-500">Dirección</p>
                  <p className="text-sm lg:text-base text-gray-900">{campus.address}</p>
                </div>
              )}
              {campus.postal_code && (
                <div>
                  <p className="text-xs lg:text-sm text-gray-500">Código Postal</p>
                  <p className="text-sm lg:text-base text-gray-900">{campus.postal_code}</p>
                </div>
              )}
            </div>
          </div>

          {/* Contacto */}
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6">
            <h2 className="text-lg lg:text-xl font-semibold text-gray-800 mb-4 lg:mb-5">
              Contacto del Plantel
            </h2>
            <div className="space-y-3 lg:space-y-4">
              {campus.email && (
                <div className="flex items-center gap-2 lg:gap-3">
                  <Mail className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
                  <a href={`mailto:${campus.email}`} className="text-sm lg:text-base text-blue-600 hover:underline">
                    {campus.email}
                  </a>
                </div>
              )}
              {campus.phone && (
                <div className="flex items-center gap-2 lg:gap-3">
                  <Phone className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
                  <a href={`tel:${campus.phone}`} className="text-sm lg:text-base text-gray-900">
                    {campus.phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Director */}
          {campus.director_name && (
            <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6">
              <h2 className="text-lg lg:text-xl font-semibold text-gray-800 mb-4 lg:mb-5 flex items-center gap-2">
                <Users className="h-5 w-5 lg:h-6 lg:w-6 text-purple-600" />
                Director
              </h2>
              <div className="space-y-3 lg:space-y-4">
                <p className="text-sm lg:text-base font-medium text-gray-900">{campus.director_name}</p>
                {campus.director_email && (
                  <div className="flex items-center gap-2 lg:gap-3">
                    <Mail className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
                    <a href={`mailto:${campus.director_email}`} className="text-sm lg:text-base text-blue-600 hover:underline">
                      {campus.director_email}
                    </a>
                  </div>
                )}
                {campus.director_phone && (
                  <div className="flex items-center gap-2 lg:gap-3">
                    <Phone className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
                    <span className="text-sm lg:text-base text-gray-900">{campus.director_phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Estadísticas */}
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6">
            <h2 className="text-lg lg:text-xl font-semibold text-gray-800 mb-4 lg:mb-5">
              Estadísticas
            </h2>
            <div className="space-y-3 lg:space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 lg:gap-3">
                  <Layers className="h-4 w-4 lg:h-5 lg:w-5 text-amber-600" />
                  <span className="text-sm lg:text-base text-gray-600">Grupos activos</span>
                </div>
                <span className="text-lg lg:text-xl font-semibold text-gray-900">
                  {groups.filter(g => g.is_active).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 lg:gap-3">
                  <Users className="h-4 w-4 lg:h-5 lg:w-5 text-purple-600" />
                  <span className="text-sm lg:text-base text-gray-600">Total candidatos</span>
                </div>
                <span className="text-lg lg:text-xl font-semibold text-gray-900">
                  {groups.reduce((acc, g) => acc + (g.member_count || 0), 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grupos */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <h2 className="text-lg lg:text-xl xl:text-2xl font-semibold text-gray-800 flex items-center gap-2 lg:gap-3">
                <Layers className="h-5 w-5 lg:h-6 lg:w-6 text-amber-600" />
                Grupos
              </h2>
              <Link
                to={`/partners/campuses/${campusId}/groups/new`}
                className="inline-flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm lg:text-base font-medium transition-colors"
              >
                <Plus className="h-4 w-4 lg:h-5 lg:w-5" />
                Nuevo Grupo
              </Link>
            </div>

            {groups.length === 0 ? (
              <div className="text-center py-8 lg:py-12">
                <Layers className="h-12 w-12 lg:h-16 lg:w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-sm lg:text-base mb-4">
                  No hay grupos registrados en este plantel
                </p>
                <Link
                  to={`/partners/campuses/${campusId}/groups/new`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm lg:text-base font-medium transition-colors"
                >
                  <Plus className="h-4 w-4 lg:h-5 lg:w-5" />
                  Crear Grupo
                </Link>
              </div>
            ) : (
              <div className="space-y-3 lg:space-y-4">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className={`border-2 rounded-xl p-4 lg:p-5 transition-all ${
                      group.is_active 
                        ? 'border-gray-200 hover:border-amber-300 hover:shadow-md' 
                        : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 lg:gap-3 mb-2">
                          <h3 className="font-semibold text-base lg:text-lg text-gray-900">
                            {group.name}
                          </h3>
                          {group.code && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs lg:text-sm font-mono">
                              {group.code}
                            </span>
                          )}
                          {!group.is_active && (
                            <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs lg:text-sm">
                              Inactivo
                            </span>
                          )}
                        </div>
                        
                        {group.description && (
                          <p className="text-sm lg:text-base text-gray-600 mb-2 line-clamp-2">
                            {group.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm lg:text-base text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-purple-500" />
                            <span className="font-medium">{group.member_count || 0}</span>
                            <span className="text-gray-500">/ {group.max_members} miembros</span>
                          </div>
                          {group.start_date && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span>
                                {new Date(group.start_date).toLocaleDateString('es-MX')}
                                {group.end_date && ` - ${new Date(group.end_date).toLocaleDateString('es-MX')}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/partners/groups/${group.id}`}
                          className="p-2 hover:bg-amber-50 rounded-lg text-amber-600 transition-colors"
                        >
                          <ChevronRight className="h-5 w-5 lg:h-6 lg:w-6" />
                        </Link>
                        {group.is_active && (
                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4 lg:h-5 lg:w-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
