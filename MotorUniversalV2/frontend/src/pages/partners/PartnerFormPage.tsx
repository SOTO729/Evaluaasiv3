/**
 * Formulario de Partner (crear/editar) - Diseño Mejorado con Fluid
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
  Mail,
  Phone,
  Globe,
  FileText,
  Hash,
  Image,
  CheckCircle2,
  XCircle,
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
        setSuccessMessage('Partner actualizado exitosamente');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const newPartner = await createPartner(formData);
        navigate(`/partners/${newPartner.id}`);
        return;
      }
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
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Header con Gradiente */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 shadow-lg">
        <div className="flex items-center fluid-gap-5 flex-wrap">
          <Link
            to={isEditing ? `/partners/${partnerId}` : '/partners'}
            className="fluid-p-3 bg-white/20 hover:bg-white/30 rounded-fluid-xl transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="fluid-icon-lg text-white" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="fluid-text-3xl font-bold text-white flex items-center fluid-gap-3">
              <Building2 className="fluid-icon-xl" />
              {isEditing ? 'Editar Partner' : 'Nuevo Partner'}
            </h1>
            {isEditing && formData.name && (
              <p className="fluid-text-base text-white/80 fluid-mt-1">{formData.name}</p>
            )}
          </div>
          
          {/* Botón Guardar en Header */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-white hover:bg-gray-100 text-blue-600 rounded-fluid-xl font-bold fluid-text-base transition-all duration-300 hover:scale-105 shadow-lg disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="fluid-w-5 fluid-h-5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="fluid-icon-base" />
                {isEditing ? 'Guardar Cambios' : 'Crear Partner'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="fluid-mb-6 bg-red-50 border border-red-200 rounded-fluid-2xl fluid-p-5 flex items-center fluid-gap-4 animate-fade-in-up">
          <div className="fluid-p-3 bg-red-100 rounded-fluid-xl">
            <AlertCircle className="fluid-icon-lg text-red-600" />
          </div>
          <p className="fluid-text-base text-red-700 flex-1 font-medium">{error}</p>
          <button onClick={() => setError(null)} className="fluid-p-2 hover:bg-red-100 rounded-fluid-xl transition-colors">
            <X className="fluid-icon-base text-red-600" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="fluid-mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-fluid-2xl fluid-p-5 flex items-center fluid-gap-4 animate-fade-in-up shadow-sm">
          <div className="fluid-p-3 bg-green-100 rounded-fluid-xl">
            <CheckCircle2 className="fluid-icon-lg text-green-600" />
          </div>
          <p className="fluid-text-base text-green-800 flex-1 font-medium">{successMessage}</p>
          <button onClick={() => setSuccessMessage(null)} className="fluid-p-2 hover:bg-green-100 rounded-fluid-xl transition-colors">
            <XCircle className="fluid-icon-base text-green-600" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 fluid-gap-6">
        {/* Columna Principal - Información */}
        <div className="lg:col-span-2 flex flex-col fluid-gap-6">
          {/* Información básica */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300">
            <h2 className="fluid-text-lg font-bold text-gray-800 fluid-mb-6 flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg">
                <Building2 className="fluid-icon-base text-blue-600" />
              </div>
              Información del Partner
            </h2>
            
            <div className="grid md:grid-cols-2 fluid-gap-5">
              <div>
                <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all hover:border-blue-300"
                  placeholder="Nombre del partner"
                  required
                />
              </div>

              <div>
                <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2">
                  Razón Social
                </label>
                <input
                  type="text"
                  value={formData.legal_name}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all hover:border-blue-300"
                  placeholder="Razón social completa"
                />
              </div>

              <div>
                <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2 flex items-center fluid-gap-2">
                  <Hash className="fluid-icon-sm text-gray-400" />
                  RFC
                </label>
                <input
                  type="text"
                  value={formData.rfc}
                  onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base font-mono transition-all hover:border-blue-300"
                  placeholder="RFC del partner"
                  maxLength={13}
                />
              </div>

              <div>
                <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2 flex items-center fluid-gap-2">
                  <Mail className="fluid-icon-sm text-gray-400" />
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all hover:border-blue-300"
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div>
                <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2 flex items-center fluid-gap-2">
                  <Phone className="fluid-icon-sm text-gray-400" />
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all hover:border-blue-300"
                  placeholder="(55) 1234-5678"
                />
              </div>

              <div>
                <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2 flex items-center fluid-gap-2">
                  <Globe className="fluid-icon-sm text-gray-400" />
                  Sitio Web
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all hover:border-blue-300"
                  placeholder="https://ejemplo.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2 flex items-center fluid-gap-2">
                  <Image className="fluid-icon-sm text-gray-400" />
                  URL del Logo
                </label>
                <input
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all hover:border-blue-300"
                  placeholder="https://ejemplo.com/logo.png"
                />
                {formData.logo_url && (
                  <div className="fluid-mt-3 fluid-p-3 bg-gray-50 rounded-fluid-xl border border-gray-200">
                    <p className="fluid-text-xs text-gray-500 fluid-mb-2">Vista previa:</p>
                    <img 
                      src={formData.logo_url} 
                      alt="Logo preview" 
                      className="fluid-h-16 object-contain"
                      onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                    />
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2 flex items-center fluid-gap-2">
                  <FileText className="fluid-icon-sm text-gray-400" />
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base resize-none transition-all hover:border-blue-300"
                  placeholder="Notas adicionales sobre el partner..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Columna Lateral */}
        <div className="lg:col-span-1 flex flex-col fluid-gap-6">
          {/* Estado Activo */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300">
            <h2 className="fluid-text-lg font-bold text-gray-800 fluid-mb-5 flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-purple-100 rounded-fluid-lg">
                <CheckCircle2 className="fluid-icon-base text-purple-600" />
              </div>
              Estado
            </h2>
            
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              className={`w-full flex items-center justify-between fluid-p-4 rounded-fluid-xl transition-all duration-300 ${
                formData.is_active 
                  ? 'bg-green-100 border-2 border-green-400 text-green-800' 
                  : 'bg-gray-100 border-2 border-gray-300 text-gray-600'
              }`}
            >
              <div className="flex items-center fluid-gap-3">
                {formData.is_active ? (
                  <CheckCircle2 className="fluid-icon-lg text-green-600" />
                ) : (
                  <XCircle className="fluid-icon-lg text-gray-400" />
                )}
                <span className="font-bold fluid-text-base">
                  {formData.is_active ? 'Partner Activo' : 'Partner Inactivo'}
                </span>
              </div>
              <div className={`fluid-w-12 fluid-h-7 rounded-full transition-colors duration-300 relative ${
                formData.is_active ? 'bg-green-500' : 'bg-gray-300'
              }`}>
                <div className={`absolute top-1 fluid-w-5 fluid-h-5 bg-white rounded-full shadow transition-transform duration-300 ${
                  formData.is_active ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </div>
            </button>
          </div>

          {/* Estados (solo en edición) */}
          {isEditing && (
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300">
              <h2 className="fluid-text-lg font-bold text-gray-800 fluid-mb-5 flex items-center fluid-gap-3">
                <div className="fluid-p-2 bg-emerald-100 rounded-fluid-lg">
                  <MapPin className="fluid-icon-base text-emerald-600" />
                </div>
                Presencia por Estado
                <span className="fluid-text-sm font-medium text-gray-400 bg-gray-100 fluid-px-2 fluid-py-1 rounded-full">
                  {partnerStates.length}
                </span>
              </h2>

              {/* Agregar estado */}
              <div className="flex fluid-gap-3 fluid-mb-5">
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="flex-1 fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 fluid-text-base transition-all hover:border-emerald-300"
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
                  className="fluid-px-4 fluid-py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-fluid-xl font-bold fluid-text-sm transition-all duration-300 hover:scale-105 shadow-md disabled:shadow-none"
                >
                  <Plus className="fluid-icon-base" />
                </button>
              </div>

              {/* Lista de estados */}
              {partnerStates.length > 0 ? (
                <div className="flex flex-wrap fluid-gap-2 max-h-[250px] overflow-y-auto">
                  {partnerStates.map((presence) => (
                    <div
                      key={presence.id}
                      className="inline-flex items-center fluid-gap-2 fluid-px-3 fluid-py-2 bg-emerald-50 text-emerald-700 rounded-fluid-xl fluid-text-sm font-medium border border-emerald-200 hover:bg-emerald-100 transition-colors group"
                    >
                      <MapPin className="fluid-icon-sm" />
                      <span>{presence.state_name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveState(presence.id)}
                        className="fluid-p-1 hover:bg-emerald-200 rounded-full transition-colors opacity-60 group-hover:opacity-100"
                      >
                        <X className="fluid-icon-xs" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center fluid-py-6 bg-gray-50 rounded-fluid-xl border border-gray-100">
                  <MapPin className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-2" />
                  <p className="fluid-text-sm text-gray-500">No hay estados registrados</p>
                  <p className="fluid-text-xs text-gray-400 fluid-mt-1">Agrega los estados donde el partner tiene presencia</p>
                </div>
              )}
            </div>
          )}

          {/* Botones de Acción */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
            <div className="flex flex-col fluid-gap-3">
              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center fluid-gap-2 fluid-px-6 fluid-py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white rounded-fluid-xl font-bold fluid-text-base transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="fluid-w-5 fluid-h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="fluid-icon-base" />
                    {isEditing ? 'Guardar Cambios' : 'Crear Partner'}
                  </>
                )}
              </button>
              <Link
                to={isEditing ? `/partners/${partnerId}` : '/partners'}
                className="w-full inline-flex items-center justify-center fluid-gap-2 fluid-px-6 fluid-py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-xl font-bold fluid-text-base transition-all duration-300"
              >
                Cancelar
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
