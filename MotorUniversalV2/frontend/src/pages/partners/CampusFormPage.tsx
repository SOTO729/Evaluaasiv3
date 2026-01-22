/**
 * Formulario de Plantel (Campus)
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  MapPin,
  Save,
  ArrowLeft,
  AlertCircle,
  X,
  Building2,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getCampus,
  createCampus,
  updateCampus,
  getMexicanStates,
  getPartner,
} from '../../services/partnersService';

export default function CampusFormPage() {
  const { partnerId, campusId } = useParams();
  const navigate = useNavigate();
  const isEditing = !!campusId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mexicanStates, setMexicanStates] = useState<string[]>([]);
  const [partnerName, setPartnerName] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    state_name: '',
    city: '',
    address: '',
    postal_code: '',
    email: '',
    phone: '',
    director_name: '',
    director_email: '',
    director_phone: '',
    is_active: true,
  });

  useEffect(() => {
    loadInitialData();
  }, [partnerId, campusId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      const [states, partner] = await Promise.all([
        getMexicanStates(),
        getPartner(Number(partnerId)),
      ]);
      
      setMexicanStates(states);
      setPartnerName(partner.name);

      if (isEditing && campusId) {
        const campus = await getCampus(Number(campusId));
        setFormData({
          name: campus.name || '',
          code: campus.code || '',
          state_name: campus.state_name || '',
          city: campus.city || '',
          address: campus.address || '',
          postal_code: campus.postal_code || '',
          email: campus.email || '',
          phone: campus.phone || '',
          director_name: campus.director_name || '',
          director_email: campus.director_email || '',
          director_phone: campus.director_phone || '',
          is_active: campus.is_active,
        });
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
      setError('El nombre es requerido');
      return;
    }
    if (!formData.state_name) {
      setError('El estado es requerido');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEditing) {
        await updateCampus(Number(campusId), formData);
        navigate(`/partners/campuses/${campusId}`);
      } else {
        const result = await createCampus(Number(partnerId), formData);
        // Si se auto-creó el estado, mostrar mensaje especial
        if (result.state_auto_created) {
          navigate(`/partners/${partnerId}`, {
            state: {
              successMessage: `Plantel creado exitosamente. Se registró automáticamente la presencia en ${formData.state_name}.`,
            },
          });
        } else {
          navigate(`/partners/campuses/${result.campus.id}`);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar el plantel');
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-4 lg:gap-6 mb-6 lg:mb-8">
        <Link
          to={isEditing ? `/partners/campuses/${campusId}` : `/partners/${partnerId}`}
          className="p-2 lg:p-3 hover:bg-gray-100 rounded-lg lg:rounded-xl transition-colors"
        >
          <ArrowLeft className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-800 flex items-center gap-2 lg:gap-3">
            <MapPin className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 xl:h-10 xl:w-10 text-blue-600" />
            {isEditing ? 'Editar Plantel' : 'Nuevo Plantel'}
          </h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {partnerName}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 lg:p-5 bg-red-50 border border-red-200 rounded-lg lg:rounded-xl flex items-center gap-3 lg:gap-4">
          <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 text-red-600 flex-shrink-0" />
          <p className="text-sm lg:text-base text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-5 w-5 text-red-600" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-8">
        {/* Información básica */}
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6 xl:p-8">
          <h2 className="text-lg lg:text-xl xl:text-2xl font-semibold text-gray-800 mb-4 lg:mb-6">
            Información del Plantel
          </h2>
          
          <div className="grid md:grid-cols-2 gap-4 lg:gap-6">
            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg"
                placeholder="Nombre del plantel"
                required
              />
            </div>

            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Código
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg font-mono"
                placeholder="Código identificador"
              />
            </div>

            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Estado <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.state_name}
                onChange={(e) => setFormData({ ...formData, state_name: e.target.value })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg"
                required
              >
                <option value="">Seleccionar estado...</option>
                {mexicanStates.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Ciudad
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg"
                placeholder="Ciudad"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Dirección
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg"
                placeholder="Dirección completa"
              />
            </div>

            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Código Postal
              </label>
              <input
                type="text"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg"
                placeholder="12345"
                maxLength={5}
              />
            </div>

            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg"
                placeholder="plantel@ejemplo.com"
              />
            </div>

            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Teléfono
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg"
                placeholder="(55) 1234-5678"
              />
            </div>
          </div>
        </div>

        {/* Director */}
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6 xl:p-8">
          <h2 className="text-lg lg:text-xl xl:text-2xl font-semibold text-gray-800 mb-4 lg:mb-6">
            Director del Plantel
          </h2>
          
          <div className="grid md:grid-cols-2 gap-4 lg:gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Nombre del Director
              </label>
              <input
                type="text"
                value={formData.director_name}
                onChange={(e) => setFormData({ ...formData, director_name: e.target.value })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg"
                placeholder="Nombre completo"
              />
            </div>

            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Correo del Director
              </label>
              <input
                type="email"
                value={formData.director_email}
                onChange={(e) => setFormData({ ...formData, director_email: e.target.value })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg"
                placeholder="director@ejemplo.com"
              />
            </div>

            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Teléfono del Director
              </label>
              <input
                type="tel"
                value={formData.director_phone}
                onChange={(e) => setFormData({ ...formData, director_phone: e.target.value })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg"
                placeholder="(55) 1234-5678"
              />
            </div>
          </div>
        </div>

        {/* Estado */}
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6 xl:p-8">
          <label className="flex items-center gap-3 lg:gap-4 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm lg:text-base font-medium text-gray-700">Plantel activo</span>
          </label>
        </div>

        {/* Botones */}
        <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 lg:gap-3 px-6 lg:px-8 xl:px-10 py-3 lg:py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg lg:rounded-xl font-medium text-base lg:text-lg xl:text-xl transition-colors"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 lg:w-6 lg:h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 lg:h-6 lg:w-6" />
                {isEditing ? 'Guardar Cambios' : 'Crear Plantel'}
              </>
            )}
          </button>
          <Link
            to={isEditing ? `/partners/campuses/${campusId}` : `/partners/${partnerId}`}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 lg:gap-3 px-6 lg:px-8 xl:px-10 py-3 lg:py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg lg:rounded-xl font-medium text-base lg:text-lg xl:text-xl transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
