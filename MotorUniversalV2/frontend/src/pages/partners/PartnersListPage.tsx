/**
 * Lista de Partners
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
  Globe,
  AlertCircle,
  CheckCircle2,
  XCircle,
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-12 3xl:p-14 4xl:p-16 max-w-[1920px] 3xl:max-w-[2400px] 4xl:max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8 xl:mb-10">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-bold text-gray-800 flex items-center gap-2 lg:gap-3 xl:gap-4">
            <Building2 className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 xl:h-10 xl:w-10 2xl:h-12 2xl:w-12 text-blue-600" />
            Partners
          </h1>
          <p className="text-sm sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl text-gray-600 mt-1 lg:mt-2">
            Organizaciones y empresas asociadas
          </p>
        </div>
        <Link
          to="/partners/new"
          className="inline-flex items-center justify-center gap-2 lg:gap-3 px-4 lg:px-5 xl:px-6 2xl:px-8 py-2 lg:py-2.5 xl:py-3 2xl:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg lg:rounded-xl font-medium text-sm lg:text-base xl:text-lg 2xl:text-xl transition-colors w-full sm:w-auto"
        >
          <Plus className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7" />
          Nuevo Partner
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg lg:rounded-xl xl:rounded-2xl shadow p-3 sm:p-4 lg:p-5 xl:p-6 2xl:p-8 mb-4 sm:mb-6 lg:mb-8 xl:mb-10">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 lg:gap-5 xl:gap-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 lg:left-4 xl:left-5 top-1/2 -translate-y-1/2 h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, razón social o RFC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 lg:pl-12 xl:pl-14 2xl:pl-16 pr-4 lg:pr-5 xl:pr-6 py-2.5 sm:py-2 lg:py-3 xl:py-4 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg xl:text-xl"
            />
          </div>
          
          <label className="inline-flex items-center cursor-pointer bg-gray-50 px-4 lg:px-5 xl:px-6 py-2 lg:py-3 rounded-lg lg:rounded-xl border border-gray-200">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative w-9 lg:w-11 h-5 lg:h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 lg:after:h-5 after:w-4 lg:after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ms-3 text-sm lg:text-base font-medium text-gray-700 whitespace-nowrap">
              Mostrar inactivos
            </span>
          </label>
          
          <button
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 lg:px-8 xl:px-10 py-2.5 lg:py-3 xl:py-4 rounded-lg lg:rounded-xl transition-colors w-full sm:w-auto flex items-center justify-center gap-2 lg:gap-3 font-medium text-base lg:text-lg xl:text-xl"
          >
            <Search className="h-4 w-4 lg:h-5 lg:w-5 xl:h-6 xl:w-6" />
            Buscar
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 lg:mb-6 p-4 lg:p-5 xl:p-6 bg-red-50 border border-red-200 rounded-lg lg:rounded-xl flex items-center gap-3 lg:gap-4">
          <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 text-red-600 flex-shrink-0" />
          <p className="text-sm lg:text-base text-red-700">{error}</p>
          <button onClick={() => loadPartners()} className="ml-auto text-sm lg:text-base text-red-700 underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Partners List */}
      {loading ? (
        <div className="bg-white rounded-lg lg:rounded-xl shadow p-8 lg:p-10 xl:p-12">
          <LoadingSpinner message="Cargando partners..." />
        </div>
      ) : partners.length === 0 ? (
        <div className="bg-white rounded-lg lg:rounded-xl shadow p-8 lg:p-10 xl:p-12 text-center">
          <Building2 className="h-16 w-16 lg:h-20 lg:w-20 xl:h-24 xl:w-24 text-gray-300 mx-auto mb-4 lg:mb-6" />
          <h3 className="text-lg lg:text-xl xl:text-2xl font-medium text-gray-700 mb-2 lg:mb-3">
            {searchTerm ? 'No se encontraron partners' : 'No hay partners'}
          </h3>
          <p className="text-gray-500 text-base lg:text-lg mb-4 lg:mb-6">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza creando un nuevo partner'}
          </p>
          {!searchTerm && (
            <Link
              to="/partners/new"
              className="inline-flex items-center gap-2 lg:gap-3 px-4 lg:px-6 py-2 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg lg:rounded-xl font-medium text-sm lg:text-base transition-colors"
            >
              <Plus className="h-5 w-5 lg:h-6 lg:w-6" />
              Crear Partner
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3 lg:space-y-4 xl:space-y-5">
          {/* Contador */}
          <div className="text-sm lg:text-base xl:text-lg text-gray-500 px-1">
            {totalPartners} partner{totalPartners !== 1 ? 's' : ''} encontrado{totalPartners !== 1 ? 's' : ''}
          </div>
          
          {/* Grid de Partners */}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6 gap-4 lg:gap-5 xl:gap-6 2xl:gap-8">
            {partners.map((partner) => (
              <div
                key={partner.id}
                onClick={() => navigate(`/partners/${partner.id}`)}
                className="bg-white border-2 border-gray-200 rounded-xl lg:rounded-2xl p-4 sm:p-5 lg:p-6 xl:p-7 hover:border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3 lg:mb-4">
                  <div className="flex items-center gap-3 lg:gap-4">
                    {partner.logo_url ? (
                      <img 
                        src={partner.logo_url} 
                        alt={partner.name}
                        className="w-12 h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="h-6 w-6 lg:h-7 lg:w-7 xl:h-8 xl:w-8 text-blue-600" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-base lg:text-lg xl:text-xl text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {partner.name}
                      </h3>
                      {partner.rfc && (
                        <p className="text-xs lg:text-sm xl:text-base text-gray-500 font-mono">
                          {partner.rfc}
                        </p>
                      )}
                    </div>
                  </div>
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

                {/* Estados donde tiene presencia */}
                {partner.states && partner.states.length > 0 && (
                  <div className="flex items-center gap-2 mb-3 lg:mb-4">
                    <MapPin className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400 flex-shrink-0" />
                    <div className="flex flex-wrap gap-1 lg:gap-1.5">
                      {partner.states.slice(0, 3).map((state) => (
                        <span
                          key={state.id}
                          className="px-2 py-0.5 text-xs lg:text-sm bg-gray-100 text-gray-600 rounded"
                        >
                          {state.state_name}
                        </span>
                      ))}
                      {partner.states.length > 3 && (
                        <span className="px-2 py-0.5 text-xs lg:text-sm bg-blue-100 text-blue-600 rounded">
                          +{partner.states.length - 3} más
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Contacto */}
                <div className="space-y-1.5 lg:space-y-2 text-sm lg:text-base text-gray-600 mb-3 lg:mb-4">
                  {partner.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
                      <span className="truncate">{partner.email}</span>
                    </div>
                  )}
                  {partner.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
                      <span>{partner.phone}</span>
                    </div>
                  )}
                  {partner.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
                      <span className="truncate">{partner.website}</span>
                    </div>
                  )}
                </div>

                {/* Estadísticas y acción */}
                <div className="flex items-center justify-between pt-3 lg:pt-4 border-t border-gray-100">
                  <span className="text-sm lg:text-base text-gray-500">
                    {partner.campus_count || 0} plantel{partner.campus_count !== 1 ? 'es' : ''}
                  </span>
                  <div className="flex items-center gap-1 lg:gap-2 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs lg:text-sm font-medium">Ver detalle</span>
                    <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
