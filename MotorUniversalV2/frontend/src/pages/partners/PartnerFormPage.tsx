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
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando partner..." />
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-6xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center fluid-gap-5 fluid-mb-6">
        <Link
          to={isEditing ? `/partners/${partnerId}` : '/partners'}
          className="fluid-p-2 hover:bg-gray-100 rounded-fluid-xl transition-colors"
        >
          <ArrowLeft className="fluid-icon-lg text-gray-600" />
        </Link>
        <div>
          <h1 className="fluid-text-3xl font-bold text-gray-800 flex items-center fluid-gap-2">
            <Building2 className="fluid-icon-xl text-blue-600" />
            {isEditing ? 'Editar Partner' : 'Nuevo Partner'}
          </h1>
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
            Información del Partner
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
                placeholder="Nombre del partner"
                required
              />
            </div>

            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Razón Social
              </label>
              <input
                type="text"
                value={formData.legal_name}
                onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                placeholder="Razón social completa"
              />
            </div>

            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                RFC
              </label>
              <input
                type="text"
                value={formData.rfc}
                onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base font-mono"
                placeholder="RFC del partner"
                maxLength={13}
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
                placeholder="correo@ejemplo.com"
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

            <div>
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Sitio Web
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                placeholder="https://ejemplo.com"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                URL del Logo
              </label>
              <input
                type="url"
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                placeholder="https://ejemplo.com/logo.png"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block fluid-text-base font-medium text-gray-700 fluid-mb-2">
                Notas
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base resize-none"
                placeholder="Notas adicionales sobre el partner..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center fluid-gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="fluid-text-base font-medium text-gray-700">Partner activo</span>
              </label>
            </div>
          </div>
        </div>

        {/* Estados (solo en edición) */}
        {isEditing && (
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
            <h2 className="fluid-text-xl font-semibold text-gray-800 fluid-mb-5 flex items-center fluid-gap-2">
              <MapPin className="fluid-icon-lg text-emerald-600" />
              Presencia por Estado
            </h2>

            {/* Agregar estado */}
            <div className="flex fluid-gap-3 fluid-mb-5">
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="flex-1 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
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
                className="fluid-px-5 fluid-py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-fluid-xl font-medium fluid-text-base transition-colors flex items-center gap-2"
              >
                <Plus className="fluid-icon-lg" />
                Agregar
              </button>
            </div>

            {/* Lista de estados */}
            {partnerStates.length > 0 ? (
              <div className="flex flex-wrap fluid-gap-2">
                {partnerStates.map((presence) => (
                  <div
                    key={presence.id}
                    className="inline-flex items-center gap-2 fluid-px-3 fluid-py-2 bg-emerald-50 text-emerald-700 rounded-fluid-xl fluid-text-base"
                  >
                    <MapPin className="fluid-icon-sm" />
                    <span>{presence.state_name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveState(presence.id)}
                      className="p-0.5 hover:bg-emerald-200 rounded-full transition-colors"
                    >
                      <X className="fluid-icon-sm" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 fluid-text-base text-center py-4">
                No hay estados registrados. Agrega los estados donde el partner tiene presencia.
              </p>
            )}
          </div>
        )}

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
                {isEditing ? 'Guardar Cambios' : 'Crear Partner'}
              </>
            )}
          </button>
          <Link
            to={isEditing ? `/partners/${partnerId}` : '/partners'}
            className="flex-1 sm:flex-none inline-flex items-center justify-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-xl font-medium fluid-text-lg transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
