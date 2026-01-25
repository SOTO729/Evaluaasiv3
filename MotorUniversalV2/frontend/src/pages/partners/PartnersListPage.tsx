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
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center fluid-gap-5 mb-4 fluid-mb-6 fluid-mb-8">
        <div>
          <h1 className="fluid-text-3xl font-bold text-gray-800 flex items-center fluid-gap-2 fluid-gap-4">
            <Building2 className="fluid-icon-xl text-blue-600" />
            Partners
          </h1>
          <p className="text-sm fluid-text-lg fluid-text-xl text-gray-600 fluid-mt-1">
            Organizaciones y empresas asociadas
          </p>
        </div>
        <Link
          to="/partners/new"
          className="inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl font-medium fluid-text-base transition-colors w-full sm:w-auto"
        >
          <Plus className="fluid-icon-lg" />
          Nuevo Partner
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-fluid-xl shadow p-3 fluid-p-5 fluid-p-8 mb-4 fluid-mb-6 fluid-mb-8">
        <div className="flex flex-col sm:flex-row gap-3 fluid-gap-5">
          <div className="flex-1 relative">
            <Search className="absolute left-3 left-4 left-5 top-1/2 -translate-y-1/2 fluid-icon-lg text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, razón social o RFC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full fluid-pl-12 pr-4 fluid-pr-5 fluid-pr-6 py-2.5 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-lg"
            />
          </div>
          
          <label className="inline-flex items-center cursor-pointer bg-gray-50 fluid-px-5 fluid-py-2 rounded-fluid-xl border border-gray-200">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ms-3 fluid-text-base font-medium text-gray-700 whitespace-nowrap">
              Mostrar inactivos
            </span>
          </label>
          
          <button
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-700 text-white fluid-px-6 fluid-py-3 rounded-fluid-xl transition-colors w-full sm:w-auto flex items-center justify-center fluid-gap-2 font-medium fluid-text-lg"
          >
            <Search className="fluid-icon-sm" />
            Buscar
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="fluid-mb-5 fluid-p-5 bg-red-50 border border-red-200 rounded-fluid-xl flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600 flex-shrink-0" />
          <p className="fluid-text-base text-red-700">{error}</p>
          <button onClick={() => loadPartners()} className="ml-auto fluid-text-base text-red-700 underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Partners List */}
      {loading ? (
        <div className="bg-white rounded-fluid-xl shadow fluid-p-10">
          <LoadingSpinner message="Cargando partners..." />
        </div>
      ) : partners.length === 0 ? (
        <div className="bg-white rounded-fluid-xl shadow fluid-p-10 text-center">
          <Building2 className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-5" />
          <h3 className="fluid-text-xl font-medium text-gray-700 fluid-mb-2">
            {searchTerm ? 'No se encontraron partners' : 'No hay partners'}
          </h3>
          <p className="text-gray-500 fluid-text-base fluid-mb-5">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza creando un nuevo partner'}
          </p>
          {!searchTerm && (
            <Link
              to="/partners/new"
              className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl font-medium fluid-text-base transition-colors"
            >
              <Plus className="fluid-icon-lg" />
              Crear Partner
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col fluid-gap-3 flex flex-col fluid-gap-4">
          {/* Contador */}
          <div className="fluid-text-base text-gray-500 px-1">
            {totalPartners} partner{totalPartners !== 1 ? 's' : ''} encontrado{totalPartners !== 1 ? 's' : ''}
          </div>
          
          {/* Grid de Partners */}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6 fluid-gap-5">
            {partners.map((partner) => (
              <div
                key={partner.id}
                onClick={() => navigate(`/partners/${partner.id}`)}
                className="bg-white border-2 border-gray-200 rounded-fluid-2xl fluid-p-5 hover:border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
              >
                <div className="flex items-start justify-between fluid-mb-3">
                  <div className="flex items-center fluid-gap-3">
                    {partner.logo_url ? (
                      <img 
                        src={partner.logo_url} 
                        alt={partner.name}
                        className="w-14 h-14 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="h-6 w-6 h-7 w-7 h-8 w-8 text-blue-600" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold fluid-text-lg text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {partner.name}
                      </h3>
                      {partner.rfc && (
                        <p className="fluid-text-sm text-gray-500 font-mono">
                          {partner.rfc}
                        </p>
                      )}
                    </div>
                  </div>
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

                {/* Estados donde tiene presencia */}
                {partner.states && partner.states.length > 0 && (
                  <div className="flex items-center gap-2 fluid-mb-3">
                    <MapPin className="fluid-icon-sm text-gray-400 flex-shrink-0" />
                    <div className="flex flex-wrap fluid-gap-1">
                      {partner.states.slice(0, 3).map((state) => (
                        <span
                          key={state.id}
                          className="px-2 py-0.5 fluid-text-xs bg-gray-100 text-gray-600 rounded"
                        >
                          {state.state_name}
                        </span>
                      ))}
                      {partner.states.length > 3 && (
                        <span className="px-2 py-0.5 fluid-text-xs bg-blue-100 text-blue-600 rounded">
                          +{partner.states.length - 3} más
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Contacto */}
                <div className="space-y-1.5 flex flex-col fluid-gap-2 fluid-text-base text-gray-600 fluid-mb-3">
                  {partner.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="fluid-icon-sm text-gray-400" />
                      <span className="truncate">{partner.email}</span>
                    </div>
                  )}
                  {partner.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="fluid-icon-sm text-gray-400" />
                      <span>{partner.phone}</span>
                    </div>
                  )}
                  {partner.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="fluid-icon-sm text-gray-400" />
                      <span className="truncate">{partner.website}</span>
                    </div>
                  )}
                </div>

                {/* Estadísticas y acción */}
                <div className="flex items-center justify-between fluid-pt-3 border-t border-gray-100">
                  <span className="fluid-text-base text-gray-500">
                    {partner.campus_count || 0} plantel{partner.campus_count !== 1 ? 'es' : ''}
                  </span>
                  <div className="flex items-center gap-1 fluid-gap-2 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="fluid-text-xs font-medium">Ver detalle</span>
                    <ChevronRight className="fluid-icon-sm" />
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
