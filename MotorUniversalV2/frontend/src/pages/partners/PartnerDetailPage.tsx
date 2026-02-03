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
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando partner..." />
      </div>
    );
  }

  if (error || !partner) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700 fluid-text-base">{error || 'Partner no encontrado'}</p>
          <Link to="/partners" className="ml-auto text-red-700 underline fluid-text-base">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Success Message */}
      {successMessage && (
        <div className="fluid-mb-5 bg-green-50 border border-green-200 rounded-fluid-xl fluid-p-4 flex items-center fluid-gap-3 animate-fade-in-up">
          <CheckCircle2 className="fluid-icon-lg text-green-600 flex-shrink-0" />
          <p className="text-green-700 fluid-text-base flex-1">{successMessage}</p>
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1 hover:bg-green-100 rounded-lg transition-colors"
          >
            <XCircle className="h-5 w-5 text-green-600" />
          </button>
        </div>
      )}
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-5 fluid-mb-6">
        <div className="flex items-center fluid-gap-5">
          <Link
            to="/partners"
            className="fluid-p-2 hover:bg-gray-100 rounded-fluid-xl transition-colors"
          >
            <ArrowLeft className="fluid-icon-lg text-gray-600" />
          </Link>
          <div className="flex items-center fluid-gap-3">
            {partner.logo_url ? (
              <img 
                src={partner.logo_url} 
                alt={partner.name}
                className="w-16 h-16 rounded-xl object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
                <Building2 className="fluid-icon-xl text-blue-600" />
              </div>
            )}
            <div>
              <div className="flex items-center fluid-gap-2">
                <h1 className="fluid-text-3xl font-bold text-gray-800">
                  {partner.name}
                </h1>
                {partner.is_active ? (
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
              {partner.legal_name && (
                <p className="fluid-text-base text-gray-600 mt-0.5">
                  {partner.legal_name}
                </p>
              )}
            </div>
          </div>
        </div>
        
        <Link
          to={`/partners/${partnerId}/edit`}
          className="inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl font-medium fluid-text-base transition-colors"
        >
          <Edit className="fluid-icon-sm" />
          Editar Partner
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 fluid-gap-6">
        {/* Información del Partner */}
        <div className="lg:col-span-1 flex flex-col fluid-gap-5">
          {/* Datos de contacto */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4">
              Información de Contacto
            </h2>
            <div className="flex flex-col fluid-gap-3">
              {partner.rfc && (
                <div>
                  <p className="fluid-text-xs text-gray-500">RFC</p>
                  <p className="fluid-text-base font-mono text-gray-900">{partner.rfc}</p>
                </div>
              )}
              {partner.email && (
                <div className="flex items-center fluid-gap-2">
                  <Mail className="fluid-icon-sm text-gray-400" />
                  <a href={`mailto:${partner.email}`} className="fluid-text-base text-blue-600 hover:underline">
                    {partner.email}
                  </a>
                </div>
              )}
              {partner.phone && (
                <div className="flex items-center fluid-gap-2">
                  <Phone className="fluid-icon-sm text-gray-400" />
                  <a href={`tel:${partner.phone}`} className="fluid-text-base text-gray-900">
                    {partner.phone}
                  </a>
                </div>
              )}
              {partner.website && (
                <div className="flex items-center fluid-gap-2">
                  <Globe className="fluid-icon-sm text-gray-400" />
                  <a href={partner.website} target="_blank" rel="noopener noreferrer" className="fluid-text-base text-blue-600 hover:underline truncate">
                    {partner.website}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Estados con presencia */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center gap-2">
              <MapPin className="fluid-icon-lg text-emerald-600" />
              Presencia por Estado
            </h2>
            {partner.states && partner.states.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {partner.states.map((state) => (
                  <button
                    key={state.id}
                    onClick={() => setSelectedState(selectedState === state.state_name ? '' : state.state_name)}
                    className={`px-3 py-1.5 rounded-lg fluid-text-base font-medium transition-colors ${
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
              <p className="text-gray-500 fluid-text-base">
                No hay estados registrados
              </p>
            )}
          </div>

          {/* Estadísticas */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4">
              Estadísticas
            </h2>
            <div className="flex flex-col fluid-gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center fluid-gap-2">
                  <MapPin className="fluid-icon-sm text-blue-600" />
                  <span className="fluid-text-base text-gray-600">Planteles</span>
                </div>
                <span className="fluid-text-lg font-semibold text-gray-900">
                  {campuses.filter(c => c.is_active).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center fluid-gap-2">
                  <Layers className="fluid-icon-sm text-amber-600" />
                  <span className="fluid-text-base text-gray-600">Grupos</span>
                </div>
                <span className="fluid-text-lg font-semibold text-gray-900">
                  {campuses.reduce((acc, c) => acc + (c.group_count || 0), 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center fluid-gap-2">
                  <Users className="fluid-icon-sm text-purple-600" />
                  <span className="fluid-text-base text-gray-600">Estados</span>
                </div>
                <span className="fluid-text-lg font-semibold text-gray-900">
                  {partner.states?.length || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Planteles */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <div className="flex items-center justify-between fluid-mb-5">
              <h2 className="fluid-text-xl font-semibold text-gray-800 flex items-center fluid-gap-2">
                <MapPin className="fluid-icon-lg text-blue-600" />
                Planteles
                {selectedState && (
                  <span className="fluid-text-base font-normal text-gray-500">
                    en {selectedState}
                  </span>
                )}
              </h2>
              <Link
                to={`/partners/${partnerId}/campuses/new`}
                className="inline-flex items-center gap-2 fluid-px-3 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg fluid-text-base font-medium transition-colors"
              >
                <Plus className="fluid-icon-sm" />
                Nuevo Plantel
              </Link>
            </div>

            {filteredCampuses.length === 0 ? (
              <div className="text-center fluid-py-10">
                <MapPin className="fluid-icon-2xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 fluid-text-base mb-4">
                  {selectedState 
                    ? `No hay planteles en ${selectedState}` 
                    : 'No hay planteles registrados'}
                </p>
                <Link
                  to={`/partners/${partnerId}/campuses/new`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg fluid-text-base font-medium transition-colors"
                >
                  <Plus className="fluid-icon-sm" />
                  Crear Plantel
                </Link>
              </div>
            ) : (
              <div className="flex flex-col fluid-gap-3">
                {filteredCampuses.map((campus) => (
                  <div
                    key={campus.id}
                    className={`border-2 rounded-xl fluid-p-4 transition-all ${
                      campus.is_active 
                        ? 'border-gray-200 hover:border-blue-300 hover:shadow-md' 
                        : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center fluid-gap-2 mb-2">
                          <h3 className="font-semibold fluid-text-base text-gray-900">
                            {campus.name}
                          </h3>
                          <span className="font-mono fluid-text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            {campus.code}
                          </span>
                          {campus.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full fluid-text-xs font-medium border border-green-200">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                              Activo
                            </span>
                          ) : campus.activation_status === 'configuring' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full fluid-text-xs font-medium border border-amber-200">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                              Configurando
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full fluid-text-xs font-medium border border-rose-200">
                              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                              Pendiente Activación
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 fluid-text-base text-gray-600">
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
                          <div className="flex items-center gap-1.5 fluid-text-base">
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
                          <ChevronRight className="fluid-icon-lg" />
                        </Link>
                        {campus.is_active && (
                          <button
                            onClick={() => handleDeleteCampus(campus.id)}
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

      {/* Notas */}
      {partner.notes && (
        <div className="fluid-mt-6 bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
          <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-3">Notas</h2>
          <p className="fluid-text-base text-gray-600 whitespace-pre-wrap">{partner.notes}</p>
        </div>
      )}
    </div>
  );
}
