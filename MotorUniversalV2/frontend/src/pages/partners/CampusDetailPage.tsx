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
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando plantel..." />
      </div>
    );
  }

  if (error || !campus) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700 fluid-text-base">{error || 'Plantel no encontrado'}</p>
          <Link to="/partners" className="ml-auto text-red-700 underline fluid-text-base">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-5 fluid-mb-6">
        <div className="flex items-center fluid-gap-5">
          <Link
            to={`/partners/${campus.partner_id}`}
            className="fluid-p-2 hover:bg-gray-100 rounded-fluid-xl transition-colors"
          >
            <ArrowLeft className="fluid-icon-lg text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center fluid-gap-2 fluid-text-base text-gray-500 mb-1">
              <Building2 className="fluid-icon-sm" />
              <Link to={`/partners/${campus.partner_id}`} className="hover:text-blue-600 transition-colors">
                {campus.partner?.name}
              </Link>
            </div>
            <div className="flex items-center fluid-gap-2">
              <h1 className="fluid-text-3xl font-bold text-gray-800">
                {campus.name}
              </h1>
              {campus.code && (
                <span className="fluid-px-2 fluid-py-1 bg-gray-100 text-gray-600 rounded-lg fluid-text-base font-mono">
                  {campus.code}
                </span>
              )}
              {campus.is_active ? (
                <span className="inline-flex items-center gap-1 fluid-text-xs font-medium text-green-700 bg-green-50 fluid-px-2 fluid-py-1 rounded-full">
                  <CheckCircle2 className="fluid-icon-xs" />
                  Activo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 fluid-text-xs font-medium text-gray-600 bg-gray-100 fluid-px-2 fluid-py-1 rounded-full">
                  <XCircle className="fluid-icon-xs" />
                  Inactivo
                </span>
              )}
            </div>
          </div>
        </div>
        
        <Link
          to={`/partners/campuses/${campusId}/edit`}
          className="inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl font-medium fluid-text-base transition-colors"
        >
          <Edit className="fluid-icon-sm" />
          Editar Plantel
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 fluid-gap-6">
        {/* Información del Campus */}
        <div className="lg:col-span-1 flex flex-col fluid-gap-5">
          {/* Ubicación */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center gap-2">
              <MapPin className="fluid-icon-lg text-emerald-600" />
              Ubicación
            </h2>
            <div className="flex flex-col fluid-gap-3">
              <div>
                <p className="fluid-text-xs text-gray-500">Estado</p>
                <p className="fluid-text-base font-medium text-gray-900">{campus.state_name}</p>
              </div>
              {campus.city && (
                <div>
                  <p className="fluid-text-xs text-gray-500">Ciudad</p>
                  <p className="fluid-text-base text-gray-900">{campus.city}</p>
                </div>
              )}
              {campus.address && (
                <div>
                  <p className="fluid-text-xs text-gray-500">Dirección</p>
                  <p className="fluid-text-base text-gray-900">{campus.address}</p>
                </div>
              )}
              {campus.postal_code && (
                <div>
                  <p className="fluid-text-xs text-gray-500">Código Postal</p>
                  <p className="fluid-text-base text-gray-900">{campus.postal_code}</p>
                </div>
              )}
            </div>
          </div>

          {/* Contacto */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4">
              Contacto del Plantel
            </h2>
            <div className="flex flex-col fluid-gap-3">
              {campus.email && (
                <div className="flex items-center fluid-gap-2">
                  <Mail className="fluid-icon-sm text-gray-400" />
                  <a href={`mailto:${campus.email}`} className="fluid-text-base text-blue-600 hover:underline">
                    {campus.email}
                  </a>
                </div>
              )}
              {campus.phone && (
                <div className="flex items-center fluid-gap-2">
                  <Phone className="fluid-icon-sm text-gray-400" />
                  <a href={`tel:${campus.phone}`} className="fluid-text-base text-gray-900">
                    {campus.phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Director */}
          {campus.director_name && (
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
              <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center gap-2">
                <Users className="fluid-icon-lg text-purple-600" />
                Director
              </h2>
              <div className="flex flex-col fluid-gap-3">
                <p className="fluid-text-base font-medium text-gray-900">{campus.director_name}</p>
                {campus.director_email && (
                  <div className="flex items-center fluid-gap-2">
                    <Mail className="fluid-icon-sm text-gray-400" />
                    <a href={`mailto:${campus.director_email}`} className="fluid-text-base text-blue-600 hover:underline">
                      {campus.director_email}
                    </a>
                  </div>
                )}
                {campus.director_phone && (
                  <div className="flex items-center fluid-gap-2">
                    <Phone className="fluid-icon-sm text-gray-400" />
                    <span className="fluid-text-base text-gray-900">{campus.director_phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Estadísticas */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4">
              Estadísticas
            </h2>
            <div className="flex flex-col fluid-gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center fluid-gap-2">
                  <Layers className="fluid-icon-sm text-amber-600" />
                  <span className="fluid-text-base text-gray-600">Grupos activos</span>
                </div>
                <span className="fluid-text-lg font-semibold text-gray-900">
                  {groups.filter(g => g.is_active).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center fluid-gap-2">
                  <Users className="fluid-icon-sm text-purple-600" />
                  <span className="fluid-text-base text-gray-600">Total candidatos</span>
                </div>
                <span className="fluid-text-lg font-semibold text-gray-900">
                  {groups.reduce((acc, g) => acc + (g.member_count || 0), 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grupos */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <div className="flex items-center justify-between fluid-mb-5">
              <h2 className="fluid-text-xl font-semibold text-gray-800 flex items-center fluid-gap-2">
                <Layers className="fluid-icon-lg text-amber-600" />
                Grupos
              </h2>
              <Link
                to={`/partners/campuses/${campusId}/groups/new`}
                className="inline-flex items-center gap-2 fluid-px-3 fluid-py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg fluid-text-base font-medium transition-colors"
              >
                <Plus className="fluid-icon-sm" />
                Nuevo Grupo
              </Link>
            </div>

            {groups.length === 0 ? (
              <div className="text-center fluid-py-10">
                <Layers className="fluid-icon-2xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 fluid-text-base mb-4">
                  No hay grupos registrados en este plantel
                </p>
                <Link
                  to={`/partners/campuses/${campusId}/groups/new`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg fluid-text-base font-medium transition-colors"
                >
                  <Plus className="fluid-icon-sm" />
                  Crear Grupo
                </Link>
              </div>
            ) : (
              <div className="flex flex-col fluid-gap-3">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className={`border-2 rounded-xl fluid-p-4 transition-all ${
                      group.is_active 
                        ? 'border-gray-200 hover:border-amber-300 hover:shadow-md' 
                        : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center fluid-gap-2 mb-2">
                          <h3 className="font-semibold fluid-text-base text-gray-900">
                            {group.name}
                          </h3>
                          {group.code && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded fluid-text-xs font-mono">
                              {group.code}
                            </span>
                          )}
                          {!group.is_active && (
                            <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded fluid-text-xs">
                              Inactivo
                            </span>
                          )}
                        </div>
                        
                        {group.description && (
                          <p className="fluid-text-base text-gray-600 mb-2 line-clamp-2">
                            {group.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 fluid-text-base text-gray-600">
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
                          <ChevronRight className="fluid-icon-lg" />
                        </Link>
                        {group.is_active && (
                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                          >
                            <Trash2 className="fluid-icon-sm" />
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
