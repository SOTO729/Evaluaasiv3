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
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando..." />
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-6xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center fluid-gap-5 fluid-mb-6">
        <Link
          to={isEditing ? `/partners/campuses/${campusId}` : `/partners/${partnerId}`}
          className="fluid-p-2 hover:bg-gray-100 rounded-fluid-xl transition-colors"
        >
          <ArrowLeft className="fluid-icon-lg text-gray-600" />
        </Link>
        <div>
          <h1 className="fluid-text-3xl font-bold text-gray-800 flex items-center fluid-gap-2">
            <MapPin className="fluid-icon-xl text-blue-600" />
            {isEditing ? 'Editar Plantel' : 'Nuevo Plantel'}
          </h1>
          <p className="fluid-text-base text-gray-600 mt-1 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {partnerName}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 fluid-p-4 bg-red-50 border border-red-200 rounded-fluid-xl flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600 flex-shrink-0" />
          <p className="fluid-text-base text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-5 w-5 text-red-600" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col fluid-gap-6 flex flex-col fluid-gap-6">
        {/* Información básica */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
          <h2 className="fluid-text-xl font-semibold text-gray-800 fluid-mb-5">
            Información del Plantel
          </h2>
          
          <div className="grid md:grid-cols-2 fluid-gap-5">
            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                placeholder="Nombre del plantel"
                required
              />
            </div>

            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Código
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base font-mono"
                placeholder="Código identificador"
              />
            </div>

            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Estado <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.state_name}
                onChange={(e) => setFormData({ ...formData, state_name: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                required
              >
                <option value="">Seleccionar estado...</option>
                {mexicanStates.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Ciudad
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                placeholder="Ciudad"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Dirección
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                placeholder="Dirección completa"
              />
            </div>

            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Código Postal
              </label>
              <input
                type="text"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                placeholder="12345"
                maxLength={5}
              />
            </div>

            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                placeholder="plantel@ejemplo.com"
              />
            </div>

            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Teléfono
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                placeholder="(55) 1234-5678"
              />
            </div>
          </div>
        </div>

        {/* Director */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
          <h2 className="fluid-text-xl font-semibold text-gray-800 fluid-mb-5">
            Director del Plantel
          </h2>
          
          <div className="grid md:grid-cols-2 fluid-gap-5">
            <div className="md:col-span-2">
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Nombre del Director
              </label>
              <input
                type="text"
                value={formData.director_name}
                onChange={(e) => setFormData({ ...formData, director_name: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                placeholder="Nombre completo"
              />
            </div>

            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Correo del Director
              </label>
              <input
                type="email"
                value={formData.director_email}
                onChange={(e) => setFormData({ ...formData, director_email: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                placeholder="director@ejemplo.com"
              />
            </div>

            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Teléfono del Director
              </label>
              <input
                type="tel"
                value={formData.director_phone}
                onChange={(e) => setFormData({ ...formData, director_phone: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                placeholder="(55) 1234-5678"
              />
            </div>
          </div>
        </div>

        {/* Estado */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
          <label className="flex items-center fluid-gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="fluid-text-base font-medium text-gray-700">Plantel activo</span>
          </label>
        </div>

        {/* Botones */}
        <div className="flex flex-col sm:flex-row fluid-gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 sm:flex-none inline-flex items-center justify-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-fluid-xl font-medium fluid-text-lg transition-colors"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="fluid-icon-lg" />
                {isEditing ? 'Guardar Cambios' : 'Crear Plantel'}
              </>
            )}
          </button>
          <Link
            to={isEditing ? `/partners/campuses/${campusId}` : `/partners/${partnerId}`}
            className="flex-1 sm:flex-none inline-flex items-center justify-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-xl font-medium fluid-text-lg transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
