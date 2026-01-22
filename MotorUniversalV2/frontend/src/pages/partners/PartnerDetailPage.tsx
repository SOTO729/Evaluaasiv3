/**
 * Detalle de Partner con Planteles y Grupos
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  Building2,
  ArrowLeft,
  Edit,
  MapPin,
  Phone,
  Mail,
  Globe,
  Plus,
  ChevronRight,
  Trash2,
  Users,
  Layers,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getPartner,
  getCampuses,
  deleteCampus,
  Partner,
  Campus,
} from '../../services/partnersService';

export default function PartnerDetailPage() {
  const { partnerId } = useParams();
  const location = useLocation();
  
  const [partner, setPartner] = useState<Partner | null>(null);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string>('');

  useEffect(() => {
    // Verificar si hay mensaje de éxito del state de navegación
    if (location.state?.successMessage) {
      setSuccessMessage(location.state.successMessage);
      // Limpiar el state para que no se muestre de nuevo al recargar
      window.history.replaceState({}, document.title);
      // Auto-ocultar después de 5 segundos
      setTimeout(() => setSuccessMessage(null), 5000);
    }
    loadData();
  }, [partnerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [partnerData, campusesData] = await Promise.all([
        getPartner(Number(partnerId)),
        getCampuses(Number(partnerId), { active_only: false }),
      ]);
      setPartner(partnerData);
      setCampuses(campusesData.campuses);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el partner');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCampus = async (campusId: number) => {
    if (!confirm('¿Estás seguro de desactivar este plantel?')) return;
    
    try {
      await deleteCampus(campusId);
      setCampuses(campuses.map(c => 
        c.id === campusId ? { ...c, is_active: false } : c
      ));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al desactivar el plantel');
    }
  };
  
  // Filtrar planteles por estado
  const filteredCampuses = selectedState
    ? campuses.filter(c => c.state_name === selectedState)
    : campuses;

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando partner..." />
      </div>
    );
  }

  if (error || !partner) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg lg:rounded-xl p-4 lg:p-6 flex items-center gap-3 lg:gap-4">
          <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 text-red-600" />
          <p className="text-red-700 text-sm lg:text-base">{error || 'Partner no encontrado'}</p>
          <Link to="/partners" className="ml-auto text-red-700 underline text-sm lg:text-base">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto animate-fade-in-up">
      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 lg:mb-6 bg-green-50 border border-green-200 rounded-lg lg:rounded-xl p-4 lg:p-5 flex items-center gap-3 lg:gap-4 animate-fade-in-up">
          <CheckCircle2 className="h-5 w-5 lg:h-6 lg:w-6 text-green-600 flex-shrink-0" />
          <p className="text-green-700 text-sm lg:text-base flex-1">{successMessage}</p>
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1 hover:bg-green-100 rounded-lg transition-colors"
          >
            <XCircle className="h-5 w-5 text-green-600" />
          </button>
        </div>
      )}
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="flex items-center gap-4 lg:gap-6">
          <Link
            to="/partners"
            className="p-2 lg:p-3 hover:bg-gray-100 rounded-lg lg:rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7 text-gray-600" />
          </Link>
          <div className="flex items-center gap-3 lg:gap-4">
            {partner.logo_url ? (
              <img 
                src={partner.logo_url} 
                alt={partner.name}
                className="w-14 h-14 lg:w-16 lg:h-16 xl:w-20 xl:h-20 rounded-xl object-cover"
              />
            ) : (
              <div className="w-14 h-14 lg:w-16 lg:h-16 xl:w-20 xl:h-20 bg-blue-100 rounded-xl flex items-center justify-center">
                <Building2 className="h-7 w-7 lg:h-8 lg:w-8 xl:h-10 xl:w-10 text-blue-600" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 lg:gap-3">
                <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-800">
                  {partner.name}
                </h1>
                {partner.is_active ? (
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
              {partner.legal_name && (
                <p className="text-sm lg:text-base xl:text-lg text-gray-600 mt-0.5">
                  {partner.legal_name}
                </p>
              )}
            </div>
          </div>
        </div>
        
        <Link
          to={`/partners/${partnerId}/edit`}
          className="inline-flex items-center justify-center gap-2 lg:gap-3 px-4 lg:px-5 xl:px-6 py-2 lg:py-2.5 xl:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg lg:rounded-xl font-medium text-sm lg:text-base xl:text-lg transition-colors"
        >
          <Edit className="h-4 w-4 lg:h-5 lg:w-5" />
          Editar Partner
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Información del Partner */}
        <div className="lg:col-span-1 space-y-4 lg:space-y-6">
          {/* Datos de contacto */}
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6">
            <h2 className="text-lg lg:text-xl font-semibold text-gray-800 mb-4 lg:mb-5">
              Información de Contacto
            </h2>
            <div className="space-y-3 lg:space-y-4">
              {partner.rfc && (
                <div>
                  <p className="text-xs lg:text-sm text-gray-500">RFC</p>
                  <p className="text-sm lg:text-base font-mono text-gray-900">{partner.rfc}</p>
                </div>
              )}
              {partner.email && (
                <div className="flex items-center gap-2 lg:gap-3">
                  <Mail className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
                  <a href={`mailto:${partner.email}`} className="text-sm lg:text-base text-blue-600 hover:underline">
                    {partner.email}
                  </a>
                </div>
              )}
              {partner.phone && (
                <div className="flex items-center gap-2 lg:gap-3">
                  <Phone className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
                  <a href={`tel:${partner.phone}`} className="text-sm lg:text-base text-gray-900">
                    {partner.phone}
                  </a>
                </div>
              )}
              {partner.website && (
                <div className="flex items-center gap-2 lg:gap-3">
                  <Globe className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
                  <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-sm lg:text-base text-blue-600 hover:underline truncate">
                    {partner.website}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Estados con presencia */}
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6">
            <h2 className="text-lg lg:text-xl font-semibold text-gray-800 mb-4 lg:mb-5 flex items-center gap-2">
              <MapPin className="h-5 w-5 lg:h-6 lg:w-6 text-emerald-600" />
              Presencia por Estado
            </h2>
            {partner.states && partner.states.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {partner.states.map((state) => (
                  <button
                    key={state.id}
                    onClick={() => setSelectedState(selectedState === state.state_name ? '' : state.state_name)}
                    className={`px-3 py-1.5 rounded-lg text-sm lg:text-base font-medium transition-colors ${
                      selectedState === state.state_name
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {state.state_name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm lg:text-base">
                No hay estados registrados
              </p>
            )}
          </div>

          {/* Estadísticas */}
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6">
            <h2 className="text-lg lg:text-xl font-semibold text-gray-800 mb-4 lg:mb-5">
              Estadísticas
            </h2>
            <div className="space-y-3 lg:space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 lg:gap-3">
                  <MapPin className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600" />
                  <span className="text-sm lg:text-base text-gray-600">Planteles</span>
                </div>
                <span className="text-lg lg:text-xl font-semibold text-gray-900">
                  {campuses.filter(c => c.is_active).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 lg:gap-3">
                  <Layers className="h-4 w-4 lg:h-5 lg:w-5 text-amber-600" />
                  <span className="text-sm lg:text-base text-gray-600">Grupos</span>
                </div>
                <span className="text-lg lg:text-xl font-semibold text-gray-900">
                  {campuses.reduce((acc, c) => acc + (c.group_count || 0), 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 lg:gap-3">
                  <Users className="h-4 w-4 lg:h-5 lg:w-5 text-purple-600" />
                  <span className="text-sm lg:text-base text-gray-600">Estados</span>
                </div>
                <span className="text-lg lg:text-xl font-semibold text-gray-900">
                  {partner.states?.length || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Planteles */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <h2 className="text-lg lg:text-xl xl:text-2xl font-semibold text-gray-800 flex items-center gap-2 lg:gap-3">
                <MapPin className="h-5 w-5 lg:h-6 lg:w-6 text-blue-600" />
                Planteles
                {selectedState && (
                  <span className="text-sm lg:text-base font-normal text-gray-500">
                    en {selectedState}
                  </span>
                )}
              </h2>
              <Link
                to={`/partners/${partnerId}/campuses/new`}
                className="inline-flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm lg:text-base font-medium transition-colors"
              >
                <Plus className="h-4 w-4 lg:h-5 lg:w-5" />
                Nuevo Plantel
              </Link>
            </div>

            {filteredCampuses.length === 0 ? (
              <div className="text-center py-8 lg:py-12">
                <MapPin className="h-12 w-12 lg:h-16 lg:w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-sm lg:text-base mb-4">
                  {selectedState 
                    ? `No hay planteles en ${selectedState}` 
                    : 'No hay planteles registrados'}
                </p>
                <Link
                  to={`/partners/${partnerId}/campuses/new`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm lg:text-base font-medium transition-colors"
                >
                  <Plus className="h-4 w-4 lg:h-5 lg:w-5" />
                  Crear Plantel
                </Link>
              </div>
            ) : (
              <div className="space-y-3 lg:space-y-4">
                {filteredCampuses.map((campus) => (
                  <div
                    key={campus.id}
                    className={`border-2 rounded-xl p-4 lg:p-5 transition-all ${
                      campus.is_active 
                        ? 'border-gray-200 hover:border-blue-300 hover:shadow-md' 
                        : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 lg:gap-3 mb-2">
                          <h3 className="font-semibold text-base lg:text-lg text-gray-900">
                            {campus.name}
                          </h3>
                          {campus.code && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs lg:text-sm font-mono">
                              {campus.code}
                            </span>
                          )}
                          {!campus.is_active && (
                            <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs lg:text-sm">
                              Inactivo
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm lg:text-base text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span>{campus.state_name}</span>
                            {campus.city && <span>• {campus.city}</span>}
                          </div>
                          {campus.director_name && (
                            <div className="flex items-center gap-1.5">
                              <Users className="h-4 w-4 text-gray-400" />
                              <span>{campus.director_name}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5 text-sm lg:text-base">
                            <Layers className="h-4 w-4 text-amber-500" />
                            <span className="font-medium">{campus.group_count || 0}</span>
                            <span className="text-gray-500">grupos</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/partners/campuses/${campus.id}`}
                          className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                        >
                          <ChevronRight className="h-5 w-5 lg:h-6 lg:w-6" />
                        </Link>
                        {campus.is_active && (
                          <button
                            onClick={() => handleDeleteCampus(campus.id)}
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

      {/* Notas */}
      {partner.notes && (
        <div className="mt-6 lg:mt-8 bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-800 mb-3 lg:mb-4">Notas</h2>
          <p className="text-sm lg:text-base text-gray-600 whitespace-pre-wrap">{partner.notes}</p>
        </div>
      )}
    </div>
  );
}
