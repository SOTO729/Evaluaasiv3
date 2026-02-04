/**
 * Detalle de Partner con Planteles - Diseño Mejorado con Fluid
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
  Clock,
  FileText,
  Hash,
  Info,
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
    if (location.state?.successMessage) {
      setSuccessMessage(location.state.successMessage);
      window.history.replaceState({}, document.title);
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
        <div className="bg-red-50 border border-red-200 rounded-fluid-2xl fluid-p-6 flex items-center fluid-gap-4">
          <AlertCircle className="fluid-icon-xl text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="fluid-text-lg font-semibold text-red-800">Error</p>
            <p className="fluid-text-base text-red-700">{error || 'Partner no encontrado'}</p>
          </div>
          <Link to="/partners" className="fluid-px-4 fluid-py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-fluid-xl fluid-text-base font-medium transition-colors">
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
        <div className="fluid-mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-fluid-2xl fluid-p-5 flex items-center fluid-gap-4 animate-fade-in-up shadow-sm">
          <div className="fluid-p-3 bg-green-100 rounded-fluid-xl">
            <CheckCircle2 className="fluid-icon-lg text-green-600" />
          </div>
          <p className="fluid-text-base text-green-800 flex-1 font-medium">{successMessage}</p>
          <button
            onClick={() => setSuccessMessage(null)}
            className="fluid-p-2 hover:bg-green-100 rounded-fluid-xl transition-colors"
          >
            <XCircle className="fluid-icon-base text-green-600" />
          </button>
        </div>
      )}
      
      {/* Header con Gradiente */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 shadow-lg">
        <div className="flex items-center fluid-gap-5 flex-wrap">
          <Link
            to="/partners"
            className="fluid-p-3 bg-white/20 hover:bg-white/30 rounded-fluid-xl transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="fluid-icon-lg text-white" />
          </Link>
          
          <div className="flex items-center fluid-gap-4 flex-1 min-w-0">
            {partner.logo_url ? (
              <img 
                src={partner.logo_url} 
                alt={partner.name}
                className="fluid-w-16 fluid-h-16 rounded-fluid-xl object-cover border-2 border-white/30 shadow-lg"
              />
            ) : (
              <div className="fluid-w-16 fluid-h-16 bg-white/20 rounded-fluid-xl flex items-center justify-center border-2 border-white/30">
                <Building2 className="fluid-icon-xl text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center fluid-gap-3 flex-wrap">
                <h1 className="fluid-text-3xl font-bold text-white truncate">
                  {partner.name}
                </h1>
                {partner.is_active ? (
                  <span className="inline-flex items-center fluid-gap-1 fluid-text-sm font-medium text-green-100 bg-green-500/30 fluid-px-3 fluid-py-1 rounded-full border border-green-400/50">
                    <CheckCircle2 className="fluid-icon-sm" />
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center fluid-gap-1 fluid-text-sm font-medium text-red-100 bg-red-500/30 fluid-px-3 fluid-py-1 rounded-full border border-red-400/50">
                    <XCircle className="fluid-icon-sm" />
                    Inactivo
                  </span>
                )}
              </div>
              {partner.legal_name && (
                <p className="fluid-text-base text-white/80 fluid-mt-1 truncate">
                  {partner.legal_name}
                </p>
              )}
            </div>
          </div>
          
          <Link
            to={`/partners/${partnerId}/edit`}
            className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-3 bg-white hover:bg-gray-100 text-blue-600 rounded-fluid-xl font-semibold fluid-text-base transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <Edit className="fluid-icon-base" />
            Editar Partner
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 fluid-gap-6">
        {/* Columna Izquierda - Información */}
        <div className="lg:col-span-1 flex flex-col fluid-gap-6">
          {/* Datos de contacto */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg hover:border-blue-200 transition-all duration-300">
            <h2 className="fluid-text-lg font-bold text-gray-800 fluid-mb-5 flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg">
                <Building2 className="fluid-icon-base text-blue-600" />
              </div>
              Información de Contacto
            </h2>
            <div className="fluid-space-y-4">
              {/* País */}
              <div className="flex items-center fluid-gap-3 fluid-p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-fluid-xl border border-blue-100">
                <Globe className="fluid-icon-base text-blue-500" />
                <div>
                  <p className="fluid-text-xs text-gray-500 font-medium uppercase tracking-wide">País</p>
                  <p className="fluid-text-base font-semibold text-gray-900">{partner.country || 'México'}</p>
                </div>
              </div>
              {partner.rfc && (
                <div className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 rounded-fluid-xl hover:bg-gray-100 transition-colors">
                  <Hash className="fluid-icon-base text-gray-400" />
                  <div>
                    <p className="fluid-text-xs text-gray-500 font-medium uppercase tracking-wide">{partner.country === 'México' ? 'RFC' : 'ID Fiscal'}</p>
                    <p className="fluid-text-base font-mono font-semibold text-gray-900">{partner.rfc}</p>
                  </div>
                </div>
              )}
              {partner.email && (
                <div className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 rounded-fluid-xl hover:bg-blue-50 transition-colors group">
                  <Mail className="fluid-icon-base text-gray-400 group-hover:text-blue-500 transition-colors" />
                  <a href={`mailto:${partner.email}`} className="fluid-text-base text-blue-600 hover:underline truncate">
                    {partner.email}
                  </a>
                </div>
              )}
              {partner.phone && (
                <div className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 rounded-fluid-xl hover:bg-green-50 transition-colors group">
                  <Phone className="fluid-icon-base text-gray-400 group-hover:text-green-500 transition-colors" />
                  <a href={`tel:${partner.phone}`} className="fluid-text-base text-gray-900 font-medium">
                    {partner.phone}
                  </a>
                </div>
              )}
              {partner.website && (
                <div className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 rounded-fluid-xl hover:bg-purple-50 transition-colors group">
                  <Globe className="fluid-icon-base text-gray-400 group-hover:text-purple-500 transition-colors" />
                  <a href={partner.website} target="_blank" rel="noopener noreferrer" className="fluid-text-base text-purple-600 hover:underline truncate">
                    {partner.website}
                  </a>
                </div>
              )}
              {partner.created_at && (
                <div className="flex items-center fluid-gap-3 fluid-p-3 border-t border-gray-100 fluid-mt-2">
                  <Clock className="fluid-icon-base text-gray-400" />
                  <div>
                    <p className="fluid-text-xs text-gray-500">Registrado</p>
                    <p className="fluid-text-sm text-gray-700">{new Date(partner.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Estados con presencia (solo para México - derivados de planteles) */}
          {(partner.country === 'México' || !partner.country) && (
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg hover:border-emerald-200 transition-all duration-300">
              <h2 className="fluid-text-lg font-bold text-gray-800 fluid-mb-4 flex items-center fluid-gap-3">
                <div className="fluid-p-2 bg-emerald-100 rounded-fluid-lg">
                  <MapPin className="fluid-icon-base text-emerald-600" />
                </div>
                Presencia por Estado
              </h2>
              <div className="flex items-start fluid-gap-2 fluid-mb-4 fluid-p-3 bg-blue-50 rounded-fluid-xl border border-blue-100">
                <Info className="fluid-icon-sm text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="fluid-text-xs text-blue-700">
                  Los estados se obtienen automáticamente de los planteles registrados en México.
                </p>
              </div>
              {partner.states && partner.states.length > 0 ? (
                <div className="flex flex-wrap fluid-gap-2">
                  {partner.states.map((state) => (
                    <button
                      key={state.state_name}
                      onClick={() => setSelectedState(selectedState === state.state_name ? '' : state.state_name)}
                      className={`fluid-px-4 fluid-py-2 rounded-fluid-xl fluid-text-sm font-semibold transition-all duration-300 ${
                        selectedState === state.state_name
                          ? 'bg-emerald-600 text-white shadow-lg scale-105'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      {state.state_name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center fluid-py-6">
                  <MapPin className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-2" />
                  <p className="fluid-text-base text-gray-500">Sin presencia en estados</p>
                  <p className="fluid-text-xs text-gray-400 fluid-mt-1">Agregue planteles para registrar presencia</p>
                </div>
              )}
            </div>
          )}

          {/* Estadísticas */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg hover:border-purple-200 transition-all duration-300">
            <h2 className="fluid-text-lg font-bold text-gray-800 fluid-mb-5 flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-purple-100 rounded-fluid-lg">
                <Layers className="fluid-icon-base text-purple-600" />
              </div>
              Estadísticas
            </h2>
            <div className="grid grid-cols-3 fluid-gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-fluid-xl fluid-p-4 text-center border border-blue-100 hover:shadow-md transition-all duration-200">
                <p className="fluid-text-3xl font-bold text-blue-700">{campuses.filter(c => c.is_active).length}</p>
                <p className="fluid-text-xs text-blue-600 font-medium fluid-mt-1">Planteles</p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-fluid-xl fluid-p-4 text-center border border-amber-100 hover:shadow-md transition-all duration-200">
                <p className="fluid-text-3xl font-bold text-amber-700">{campuses.reduce((acc, c) => acc + (c.group_count || 0), 0)}</p>
                <p className="fluid-text-xs text-amber-600 font-medium fluid-mt-1">Grupos</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-fluid-xl fluid-p-4 text-center border border-emerald-100 hover:shadow-md transition-all duration-200">
                <p className="fluid-text-3xl font-bold text-emerald-700">{partner.states?.length || 0}</p>
                <p className="fluid-text-xs text-emerald-600 font-medium fluid-mt-1">Estados</p>
              </div>
            </div>
          </div>

          {/* Notas */}
          {partner.notes && (
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg hover:border-amber-200 transition-all duration-300">
              <h2 className="fluid-text-lg font-bold text-gray-800 fluid-mb-4 flex items-center fluid-gap-3">
                <div className="fluid-p-2 bg-amber-100 rounded-fluid-lg">
                  <FileText className="fluid-icon-base text-amber-600" />
                </div>
                Notas
              </h2>
              <p className="fluid-text-base text-gray-600 whitespace-pre-wrap bg-amber-50/50 rounded-fluid-xl fluid-p-4 border border-amber-100">{partner.notes}</p>
            </div>
          )}
        </div>

        {/* Columna Derecha - Planteles */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300">
            <div className="fluid-p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
              <h2 className="fluid-text-xl font-bold text-gray-800 flex items-center fluid-gap-3">
                <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg">
                  <MapPin className="fluid-icon-base text-blue-600" />
                </div>
                Planteles
                {selectedState && (
                  <span className="fluid-text-base font-normal text-gray-500 fluid-ml-2">
                    en {selectedState}
                  </span>
                )}
                <span className="fluid-text-sm font-medium text-gray-400 bg-gray-100 fluid-px-2 fluid-py-1 rounded-full">
                  {filteredCampuses.length}
                </span>
              </h2>
              <Link
                to={`/partners/${partnerId}/campuses/new`}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl fluid-text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-md"
              >
                <Plus className="fluid-icon-sm" />
                Nuevo Plantel
              </Link>
            </div>

            {filteredCampuses.length === 0 ? (
              <div className="text-center fluid-py-16 fluid-px-6">
                <div className="fluid-w-20 fluid-h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto fluid-mb-5">
                  <MapPin className="fluid-icon-2xl text-gray-400" />
                </div>
                <p className="fluid-text-lg font-semibold text-gray-700 fluid-mb-2">
                  {selectedState 
                    ? `No hay planteles en ${selectedState}` 
                    : 'No hay planteles registrados'}
                </p>
                <p className="fluid-text-base text-gray-500 fluid-mb-6">
                  Crea tu primer plantel para comenzar
                </p>
                <Link
                  to={`/partners/${partnerId}/campuses/new`}
                  className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl fluid-text-base font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <Plus className="fluid-icon-base" />
                  Crear Plantel
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredCampuses.map((campus) => (
                  <div
                    key={campus.id}
                    className={`fluid-p-5 transition-all duration-300 hover:bg-gray-50 ${
                      !campus.is_active ? 'opacity-60 bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between fluid-gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center fluid-gap-3 fluid-mb-2 flex-wrap">
                          <h3 className="font-bold fluid-text-lg text-gray-900">
                            {campus.name}
                          </h3>
                          <span className="font-mono fluid-text-xs text-blue-700 bg-blue-50 fluid-px-2 fluid-py-1 rounded-full border border-blue-200 font-semibold">
                            {campus.code}
                          </span>
                          {campus.is_active ? (
                            <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-green-100 text-green-700 rounded-full fluid-text-xs font-semibold border border-green-200">
                              <CheckCircle2 className="fluid-icon-xs" />
                              Activo
                            </span>
                          ) : campus.activation_status === 'configuring' ? (
                            <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-amber-100 text-amber-700 rounded-full fluid-text-xs font-semibold border border-amber-200">
                              <AlertCircle className="fluid-icon-xs" />
                              Configurando
                            </span>
                          ) : (
                            <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-rose-100 text-rose-700 rounded-full fluid-text-xs font-semibold border border-rose-200">
                              <XCircle className="fluid-icon-xs" />
                              Pendiente
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center fluid-gap-4 fluid-text-sm text-gray-600">
                          <div className="flex items-center fluid-gap-2">
                            <MapPin className="fluid-icon-sm text-gray-400" />
                            <span className="font-medium">{campus.state_name}</span>
                            {campus.city && <span className="text-gray-400">• {campus.city}</span>}
                          </div>
                          {campus.director_name && (
                            <div className="flex items-center fluid-gap-2">
                              <Users className="fluid-icon-sm text-gray-400" />
                              <span>{campus.director_name}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center fluid-gap-4 fluid-mt-3">
                          <div className="flex items-center fluid-gap-2 fluid-px-3 fluid-py-1.5 bg-amber-50 rounded-fluid-lg border border-amber-100">
                            <Layers className="fluid-icon-sm text-amber-500" />
                            <span className="font-bold fluid-text-sm text-amber-700">{campus.group_count || 0}</span>
                            <span className="fluid-text-sm text-amber-600">grupos</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center fluid-gap-2">
                        <Link
                          to={`/partners/campuses/${campus.id}`}
                          className="fluid-p-3 hover:bg-blue-100 rounded-fluid-xl text-blue-600 transition-all duration-200 hover:scale-110"
                        >
                          <ChevronRight className="fluid-icon-lg" />
                        </Link>
                        {campus.is_active && (
                          <button
                            onClick={() => handleDeleteCampus(campus.id)}
                            className="fluid-p-3 hover:bg-red-100 rounded-fluid-xl text-gray-400 hover:text-red-500 transition-all duration-200"
                          >
                            <Trash2 className="fluid-icon-base" />
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
