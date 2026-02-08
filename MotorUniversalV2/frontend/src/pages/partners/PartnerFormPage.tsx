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
  X,
  MapPin,
  Mail,
  Phone,
  Globe,
  FileText,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import {
  getPartner,
  createPartner,
  updatePartner,
  getCountries,
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
  const [partnerStates, setPartnerStates] = useState<PartnerStatePresence[]>([]);
  const [countries, setCountries] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    country: 'México',
    email: '',
    phone: '',
    website: '',
    notes: '',
    is_active: true,
  });

  useEffect(() => {
    loadCountries();
    if (isEditing) {
      loadPartner();
    }
  }, [partnerId]);

  const loadCountries = async () => {
    try {
      const countriesList = await getCountries();
      setCountries(countriesList);
    } catch (err) {
      console.error('Error loading countries:', err);
      // Fallback con países predeterminados
      setCountries(['México', 'Estados Unidos', 'Canadá', 'España', 'Argentina', 'Chile', 'Colombia', 'Otro']);
    }
  };

  const loadPartner = async () => {
    try {
      setLoading(true);
      const partner = await getPartner(Number(partnerId));
      setFormData({
        name: partner.name || '',
        country: partner.country || 'México',
        email: partner.email || '',
        phone: partner.phone || '',
        website: partner.website || '',
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

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando partner..." />
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb 
        items={isEditing 
          ? [
              { label: formData.name || 'Partner', path: `/partners/${partnerId}` },
              { label: 'Editar' }
            ]
          : [{ label: 'Nuevo Partner' }]
        } 
      />
      
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
                <label className="block fluid-text-sm font-bold text-gray-700 fluid-mb-2 flex items-center fluid-gap-2">
                  <Globe className="fluid-icon-sm text-gray-400" />
                  País
                </label>
                <select
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all hover:border-blue-300"
                >
                  {countries.map((country) => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
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

          {/* Estados (solo en edición y para México - derivados de los planteles) */}
          {isEditing && formData.country === 'México' && (
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300">
              <h2 className="fluid-text-lg font-bold text-gray-800 fluid-mb-4 flex items-center fluid-gap-3">
                <div className="fluid-p-2 bg-emerald-100 rounded-fluid-lg">
                  <MapPin className="fluid-icon-base text-emerald-600" />
                </div>
                Presencia por Estado
                <span className="fluid-text-sm font-medium text-gray-400 bg-gray-100 fluid-px-2 fluid-py-1 rounded-full">
                  {partnerStates.length}
                </span>
              </h2>

              {/* Nota informativa */}
              <div className="flex items-start fluid-gap-2 fluid-mb-4 fluid-p-3 bg-blue-50 rounded-fluid-xl border border-blue-100">
                <Info className="fluid-icon-sm text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="fluid-text-xs text-blue-700">
                  Los estados se obtienen automáticamente de los planteles registrados en México.
                </p>
              </div>

              {/* Lista de estados (solo lectura) */}
              {partnerStates.length > 0 ? (
                <div className="flex flex-wrap fluid-gap-2 max-h-[250px] overflow-y-auto">
                  {partnerStates.map((presence, index) => (
                    <div
                      key={presence.state_name || index}
                      className="inline-flex items-center fluid-gap-2 fluid-px-3 fluid-py-2 bg-emerald-50 text-emerald-700 rounded-fluid-xl fluid-text-sm font-medium border border-emerald-200"
                    >
                      <MapPin className="fluid-icon-sm" />
                      <span>{presence.state_name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center fluid-py-6 bg-gray-50 rounded-fluid-xl border border-gray-100">
                  <MapPin className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-2" />
                  <p className="fluid-text-sm text-gray-500">Sin presencia en estados</p>
                  <p className="fluid-text-xs text-gray-400 fluid-mt-1">Agregue planteles para registrar presencia automáticamente</p>
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
