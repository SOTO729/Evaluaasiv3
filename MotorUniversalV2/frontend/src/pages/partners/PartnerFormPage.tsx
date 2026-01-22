/**
 * Formulario de Partner (crear/editar)
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Building2,
  Save,
  ArrowLeft,
  AlertCircle,
  Plus,
  X,
  MapPin,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getPartner,
  createPartner,
  updatePartner,
  getMexicanStates,
  addPartnerState,
  removePartnerState,
  PartnerStatePresence,
} from '../../services/partnersService';

export default function PartnerFormPage() {
  const { partnerId } = useParams();
  const navigate = useNavigate();
  const isEditing = !!partnerId;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mexicanStates, setMexicanStates] = useState<string[]>([]);
  const [partnerStates, setPartnerStates] = useState<PartnerStatePresence[]>([]);
  const [selectedState, setSelectedState] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    legal_name: '',
    rfc: '',
    email: '',
    phone: '',
    website: '',
    logo_url: '',
    notes: '',
    is_active: true,
  });

  useEffect(() => {
    loadMexicanStates();
    if (isEditing) {
      loadPartner();
    }
  }, [partnerId]);

  const loadMexicanStates = async () => {
    try {
      const states = await getMexicanStates();
      setMexicanStates(states);
    } catch (err) {
      console.error('Error loading states:', err);
    }
  };

  const loadPartner = async () => {
    try {
      setLoading(true);
      const partner = await getPartner(Number(partnerId));
      setFormData({
        name: partner.name || '',
        legal_name: partner.legal_name || '',
        rfc: partner.rfc || '',
        email: partner.email || '',
        phone: partner.phone || '',
        website: partner.website || '',
        logo_url: partner.logo_url || '',
        notes: partner.notes || '',
        is_active: partner.is_active,
      });
      setPartnerStates(partner.states || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el partner');
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

    try {
      setSaving(true);
      setError(null);

      if (isEditing) {
        await updatePartner(Number(partnerId), formData);
      } else {
        const newPartner = await createPartner(formData);
        navigate(`/partners/${newPartner.id}`);
        return;
      }

      navigate(`/partners/${partnerId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar el partner');
    } finally {
      setSaving(false);
    }
  };

  const handleAddState = async () => {
    if (!selectedState || !isEditing) return;

    try {
      const presence = await addPartnerState(Number(partnerId), {
        state_name: selectedState,
      });
      setPartnerStates([...partnerStates, presence]);
      setSelectedState('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al agregar estado');
    }
  };

  const handleRemoveState = async (presenceId: number) => {
    if (!isEditing) return;

    try {
      await removePartnerState(Number(partnerId), presenceId);
      setPartnerStates(partnerStates.filter(s => s.id !== presenceId));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar estado');
    }
  };

  const availableStates = mexicanStates.filter(
    state => !partnerStates.some(ps => ps.state_name === state)
  );

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando partner..." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-4 lg:gap-6 mb-6 lg:mb-8">
        <Link
          to={isEditing ? `/partners/${partnerId}` : '/partners'}
          className="p-2 lg:p-3 hover:bg-gray-100 rounded-lg lg:rounded-xl transition-colors"
        >
          <ArrowLeft className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-800 flex items-center gap-2 lg:gap-3">
            <Building2 className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 xl:h-10 xl:w-10 text-blue-600" />
            {isEditing ? 'Editar Partner' : 'Nuevo Partner'}
          </h1>
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
            Información del Partner
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
                placeholder="Nombre del partner"
                required
              />
            </div>

            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Razón Social
              </label>
              <input
                type="text"
                value={formData.legal_name}
                onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg"
                placeholder="Razón social completa"
              />
            </div>

            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                RFC
              </label>
              <input
                type="text"
                value={formData.rfc}
                onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg font-mono"
                placeholder="RFC del partner"
                maxLength={13}
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
                placeholder="correo@ejemplo.com"
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

            <div>
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Sitio Web
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg"
                placeholder="https://ejemplo.com"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                URL del Logo
              </label>
              <input
                type="url"
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg"
                placeholder="https://ejemplo.com/logo.png"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm lg:text-base font-medium text-gray-700 mb-1.5 lg:mb-2">
                Notas
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg resize-none"
                placeholder="Notas adicionales sobre el partner..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-3 lg:gap-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm lg:text-base font-medium text-gray-700">Partner activo</span>
              </label>
            </div>
          </div>
        </div>

        {/* Estados (solo en edición) */}
        {isEditing && (
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6 xl:p-8">
            <h2 className="text-lg lg:text-xl xl:text-2xl font-semibold text-gray-800 mb-4 lg:mb-6 flex items-center gap-2 lg:gap-3">
              <MapPin className="h-5 w-5 lg:h-6 lg:w-6 text-emerald-600" />
              Presencia por Estado
            </h2>

            {/* Agregar estado */}
            <div className="flex gap-3 lg:gap-4 mb-4 lg:mb-6">
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="flex-1 px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base lg:text-lg"
              >
                <option value="">Seleccionar estado...</option>
                {availableStates.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddState}
                disabled={!selectedState}
                className="px-4 lg:px-6 py-2.5 lg:py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg lg:rounded-xl font-medium text-base lg:text-lg transition-colors flex items-center gap-2"
              >
                <Plus className="h-5 w-5 lg:h-6 lg:w-6" />
                Agregar
              </button>
            </div>

            {/* Lista de estados */}
            {partnerStates.length > 0 ? (
              <div className="flex flex-wrap gap-2 lg:gap-3">
                {partnerStates.map((presence) => (
                  <div
                    key={presence.id}
                    className="inline-flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-emerald-50 text-emerald-700 rounded-lg lg:rounded-xl text-sm lg:text-base"
                  >
                    <MapPin className="h-4 w-4 lg:h-5 lg:w-5" />
                    <span>{presence.state_name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveState(presence.id)}
                      className="p-0.5 hover:bg-emerald-200 rounded-full transition-colors"
                    >
                      <X className="h-4 w-4 lg:h-5 lg:w-5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm lg:text-base text-center py-4">
                No hay estados registrados. Agrega los estados donde el partner tiene presencia.
              </p>
            )}
          </div>
        )}

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
                {isEditing ? 'Guardar Cambios' : 'Crear Partner'}
              </>
            )}
          </button>
          <Link
            to={isEditing ? `/partners/${partnerId}` : '/partners'}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 lg:gap-3 px-6 lg:px-8 xl:px-10 py-3 lg:py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg lg:rounded-xl font-medium text-base lg:text-lg xl:text-xl transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
