/**
 * Lista de Partners - Diseño mejorado con gradientes y mejor UX
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Layers,
  TrendingUp,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getPartners, Partner } from '../../services/partnersService';

export default function PartnersListPage() {
  const navigate = useNavigate();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [totalPartners, setTotalPartners] = useState(0);

  useEffect(() => {
    loadPartners();
  }, [showInactive]);

  const loadPartners = async (search?: string) => {
    try {
      setLoading(true);
      const response = await getPartners({
        search: search || searchTerm,
        active_only: !showInactive,
        per_page: 100,
      });
      setPartners(response.partners);
      setTotalPartners(response.total);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los partners');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadPartners(searchTerm);
  };

  // Calcular estadísticas
  const activePartners = partners.filter(p => p.is_active).length;
  const totalCampuses = partners.reduce((acc, p) => acc + (p.campus_count || 0), 0);
  const totalStates = new Set(partners.flatMap(p => p.states?.map(s => s.state_name) || [])).size;

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center fluid-gap-5">
          <div className="flex items-center fluid-gap-4">
            <div className="fluid-p-3 bg-white/20 rounded-fluid-xl backdrop-blur-sm">
              <Building2 className="fluid-icon-xl text-white" />
            </div>
            <div>
              <h1 className="fluid-text-3xl font-bold text-white">
                Partners
              </h1>
              <p className="fluid-text-base text-white/80 fluid-mt-1">
                Organizaciones y empresas asociadas
              </p>
            </div>
          </div>
          <Link
            to="/partners/new"
            className="inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-3 bg-white hover:bg-gray-100 text-blue-600 rounded-fluid-xl font-semibold fluid-text-base transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <Plus className="fluid-icon-base" />
            Nuevo Partner
          </Link>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      {!loading && partners.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 fluid-gap-4 fluid-mb-6">
          <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 hover:shadow-md transition-all duration-300">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-2.5 bg-blue-100 rounded-fluid-lg">
                <Building2 className="fluid-icon-base text-blue-600" />
              </div>
              <div>
                <p className="fluid-text-2xl font-bold text-gray-900">{totalPartners}</p>
                <p className="fluid-text-xs text-gray-500 font-medium">Total Partners</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 hover:shadow-md transition-all duration-300">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-2.5 bg-green-100 rounded-fluid-lg">
                <CheckCircle2 className="fluid-icon-base text-green-600" />
              </div>
              <div>
                <p className="fluid-text-2xl font-bold text-gray-900">{activePartners}</p>
                <p className="fluid-text-xs text-gray-500 font-medium">Activos</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 hover:shadow-md transition-all duration-300">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-2.5 bg-amber-100 rounded-fluid-lg">
                <MapPin className="fluid-icon-base text-amber-600" />
              </div>
              <div>
                <p className="fluid-text-2xl font-bold text-gray-900">{totalCampuses}</p>
                <p className="fluid-text-xs text-gray-500 font-medium">Planteles</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 hover:shadow-md transition-all duration-300">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-2.5 bg-purple-100 rounded-fluid-lg">
                <TrendingUp className="fluid-icon-base text-purple-600" />
              </div>
              <div>
                <p className="fluid-text-2xl font-bold text-gray-900">{totalStates}</p>
                <p className="fluid-text-xs text-gray-500 font-medium">Estados</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Búsqueda y filtros */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5 fluid-mb-6">
        <div className="flex flex-col sm:flex-row fluid-gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 fluid-icon-base text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, razón social o RFC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full fluid-pl-12 fluid-pr-4 fluid-py-3 border border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all"
            />
          </div>
          
          <label className="inline-flex items-center cursor-pointer bg-gray-50 hover:bg-gray-100 fluid-px-4 fluid-py-2 rounded-fluid-xl border border-gray-200 transition-colors">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ms-3 fluid-text-sm font-medium text-gray-700 whitespace-nowrap">
              Mostrar inactivos
            </span>
          </label>
          
          <button
            onClick={handleSearch}
            className="inline-flex items-center justify-center fluid-gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white fluid-px-6 fluid-py-3 rounded-fluid-xl transition-all duration-300 font-semibold fluid-text-base shadow-md hover:shadow-lg"
          >
            <Search className="fluid-icon-sm" />
            Buscar
          </button>
        </div>
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="fluid-mb-6 fluid-p-4 bg-red-50 border border-red-200 rounded-fluid-xl flex items-center fluid-gap-3 animate-fade-in-up">
          <AlertCircle className="fluid-icon-lg text-red-600 flex-shrink-0" />
          <p className="fluid-text-base text-red-700 flex-1">{error}</p>
          <button onClick={() => loadPartners()} className="fluid-text-sm text-red-700 underline hover:no-underline font-medium">
            Reintentar
          </button>
        </div>
      )}

      {/* Lista de Partners */}
      {loading ? (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-10">
          <LoadingSpinner message="Cargando partners..." />
        </div>
      ) : partners.length === 0 ? (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-12 text-center">
          <div className="fluid-w-20 fluid-h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto fluid-mb-5">
            <Building2 className="fluid-icon-2xl text-gray-400" />
          </div>
          <h3 className="fluid-text-xl font-bold text-gray-800 fluid-mb-2">
            {searchTerm ? 'No se encontraron partners' : 'No hay partners registrados'}
          </h3>
          <p className="fluid-text-base text-gray-500 fluid-mb-6">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza creando tu primer partner'}
          </p>
          {!searchTerm && (
            <Link
              to="/partners/new"
              className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-fluid-xl font-semibold fluid-text-base transition-all duration-300 shadow-lg"
            >
              <Plus className="fluid-icon-base" />
              Crear Partner
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header de la lista */}
          <div className="fluid-p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
            <h2 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg">
                <Building2 className="fluid-icon-base text-blue-600" />
              </div>
              Lista de Partners
              <span className="fluid-text-sm font-medium text-gray-400 bg-gray-100 fluid-px-2 fluid-py-1 rounded-full">
                {totalPartners}
              </span>
            </h2>
          </div>
          
          {/* Container scrolleable */}
          <div className="max-h-[600px] overflow-y-auto">
            <div className="grid md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 fluid-gap-5 fluid-p-5">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  onClick={() => navigate(`/partners/${partner.id}`)}
                  className={`bg-white border-2 rounded-fluid-2xl fluid-p-5 cursor-pointer group transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                    partner.is_active 
                      ? 'border-gray-200 hover:border-blue-400' 
                      : 'border-gray-200 opacity-60 hover:opacity-80'
                  }`}
                >
                  {/* Cabecera con logo y nombre */}
                  <div className="flex items-start justify-between fluid-mb-4">
                    <div className="flex items-center fluid-gap-3 flex-1 min-w-0">
                      {partner.logo_url ? (
                        <img 
                          src={partner.logo_url} 
                          alt={partner.name}
                          className="w-12 h-12 rounded-fluid-lg object-cover flex-shrink-0 border border-gray-200"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-fluid-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="fluid-icon-lg text-blue-600" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold fluid-text-base text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                          {partner.name}
                        </h3>
                        {partner.rfc && (
                          <p className="fluid-text-xs text-gray-500 font-mono truncate">
                            {partner.rfc}
                          </p>
                        )}
                      </div>
                    </div>
                    {partner.is_active ? (
                      <span className="inline-flex items-center fluid-gap-1 fluid-text-xs font-semibold text-green-700 bg-green-50 fluid-px-2 fluid-py-1 rounded-full border border-green-200 flex-shrink-0">
                        <CheckCircle2 className="fluid-icon-xs" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center fluid-gap-1 fluid-text-xs font-semibold text-gray-600 bg-gray-100 fluid-px-2 fluid-py-1 rounded-full border border-gray-200 flex-shrink-0">
                        <XCircle className="fluid-icon-xs" />
                        Inactivo
                      </span>
                    )}
                  </div>

                  {/* Estados donde tiene presencia */}
                  {partner.states && partner.states.length > 0 && (
                    <div className="flex items-center fluid-gap-2 fluid-mb-3">
                      <MapPin className="fluid-icon-sm text-gray-400 flex-shrink-0" />
                      <div className="flex flex-wrap fluid-gap-1">
                        {partner.states.slice(0, 2).map((state) => (
                          <span
                            key={state.id}
                            className="fluid-px-2 fluid-py-0.5 fluid-text-xs bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 font-medium"
                          >
                            {state.state_name}
                          </span>
                        ))}
                        {partner.states.length > 2 && (
                          <span className="fluid-px-2 fluid-py-0.5 fluid-text-xs bg-blue-50 text-blue-600 rounded-full border border-blue-200 font-medium">
                            +{partner.states.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Información de contacto */}
                  <div className="fluid-space-y-2 fluid-text-sm text-gray-600 fluid-mb-4">
                    {partner.email && (
                      <div className="flex items-center fluid-gap-2">
                        <Mail className="fluid-icon-xs text-gray-400 flex-shrink-0" />
                        <span className="truncate">{partner.email}</span>
                      </div>
                    )}
                    {partner.phone && (
                      <div className="flex items-center fluid-gap-2">
                        <Phone className="fluid-icon-xs text-gray-400 flex-shrink-0" />
                        <span>{partner.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer con estadísticas y acción */}
                  <div className="flex items-center justify-between fluid-pt-3 border-t border-gray-100">
                    <div className="flex items-center fluid-gap-2">
                      <div className="flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-amber-50 rounded-full border border-amber-200">
                        <Layers className="fluid-icon-xs text-amber-500" />
                        <span className="font-bold fluid-text-xs text-amber-700">{partner.campus_count || 0}</span>
                      </div>
                      <span className="fluid-text-xs text-gray-500">planteles</span>
                    </div>
                    <div className="flex items-center fluid-gap-1 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="fluid-text-xs font-semibold">Ver detalle</span>
                      <ChevronRight className="fluid-icon-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
