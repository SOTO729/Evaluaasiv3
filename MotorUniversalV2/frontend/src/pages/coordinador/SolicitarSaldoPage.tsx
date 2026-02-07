/**
 * Página de Solicitar Saldo - Coordinador
 * 
 * Formulario mejorado para solicitar saldo y/o becas:
 * - Tabla filtrable de planteles (Partner, Estado, Plantel)
 * - Entrada en unidades con equivalente en pesos
 * - Permite solicitar saldo y beca en la misma solicitud
 * - Desglose antes de enviar
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  DollarSign,
  Gift,
  Building2,
  Send,
  AlertCircle,
  Loader2,
  Info,
  Search,
  ChevronRight,
  MapPin,
  Calculator,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  createBalanceRequest,
  formatCurrency,
} from '../../services/balanceService';
import {
  getAvailableCampuses,
  AvailableCampus,
} from '../../services/userManagementService';

// Precio por defecto si no hay plantel seleccionado
const DEFAULT_PRICE_PER_CERTIFICATION = 500;

export default function SolicitarSaldoPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select-campus' | 'configure' | 'review'>('select-campus');
  
  // Data
  const [campuses, setCampuses] = useState<AvailableCampus[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [partnerFilter, setPartnerFilter] = useState<string>('');
  const [stateFilter, setStateFilter] = useState<string>('');
  
  // Selección
  const [selectedCampus, setSelectedCampus] = useState<AvailableCampus | null>(null);
  
  // Solicitud - en unidades
  const [saldoUnits, setSaldoUnits] = useState<number>(0);
  const [becaUnits, setBecaUnits] = useState<number>(0);
  const [justification, setJustification] = useState('');

  useEffect(() => {
    loadCampuses();
  }, []);

  const loadCampuses = async () => {
    try {
      setLoading(true);
      const data = await getAvailableCampuses();
      setCampuses(data.campuses || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar planteles');
    } finally {
      setLoading(false);
    }
  };

  // Obtener lista única de partners y estados para filtros
  const uniquePartners = useMemo(() => {
    const partners = [...new Set(campuses.map(c => c.partner_name))];
    return partners.sort();
  }, [campuses]);

  const uniqueStates = useMemo(() => {
    const states = [...new Set(campuses.filter(c => c.state_name).map(c => c.state_name!))];
    return states.sort();
  }, [campuses]);

  // Filtrar planteles
  const filteredCampuses = useMemo(() => {
    return campuses.filter(campus => {
      const matchesSearch = searchTerm === '' || 
        campus.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        campus.partner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (campus.state_name && campus.state_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (campus.code && campus.code.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesPartner = partnerFilter === '' || campus.partner_name === partnerFilter;
      const matchesState = stateFilter === '' || campus.state_name === stateFilter;
      
      return matchesSearch && matchesPartner && matchesState;
    });
  }, [campuses, searchTerm, partnerFilter, stateFilter]);

  // Precio del plantel seleccionado
  const pricePerCertification = selectedCampus?.certification_cost || DEFAULT_PRICE_PER_CERTIFICATION;

  // Calcular montos
  const saldoAmount = saldoUnits * pricePerCertification;
  const becaAmount = becaUnits * pricePerCertification;
  const totalUnits = saldoUnits + becaUnits;
  const totalAmount = saldoAmount + becaAmount;

  const handleSelectCampus = (campus: AvailableCampus) => {
    setSelectedCampus(campus);
    setStep('configure');
  };

  const handleBackToSelect = () => {
    setStep('select-campus');
  };

  const handleGoToReview = () => {
    // Validaciones
    if (totalUnits <= 0) {
      setError('Debes solicitar al menos 1 unidad');
      return;
    }
    if (!justification.trim()) {
      setError('Ingresa una justificación');
      return;
    }

    setError(null);
    setStep('review');
  };

  const handleSubmit = async () => {
    if (!selectedCampus) return;

    try {
      setSubmitting(true);
      setError(null);

      // Si hay ambos tipos, enviamos dos solicitudes
      const promises = [];

      if (saldoUnits > 0) {
        promises.push(
          createBalanceRequest({
            request_type: 'saldo',
            amount_requested: saldoAmount,
            campus_id: selectedCampus.id,
            justification: justification.trim(),
          })
        );
      }

      if (becaUnits > 0) {
        promises.push(
          createBalanceRequest({
            request_type: 'beca',
            amount_requested: becaAmount,
            campus_id: selectedCampus.id,
            justification: justification.trim(),
          })
        );
      }

      await Promise.all(promises);

      navigate('/coordinador/mi-saldo', {
        state: { 
          message: `Solicitud${promises.length > 1 ? 'es' : ''} enviada${promises.length > 1 ? 's' : ''} exitosamente`, 
          type: 'success' 
        }
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al enviar solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/coordinador/mi-saldo"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-600" />
            Solicitar Saldo
          </h1>
          <p className="text-gray-600 mt-1">
            Solicita saldo y/o becas para tus planteles
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        <button 
          onClick={() => step !== 'select-campus' && setStep('select-campus')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            step === 'select-campus' 
              ? 'bg-green-100 text-green-700 font-medium' 
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <span className="w-6 h-6 rounded-full bg-green-600 text-white text-sm flex items-center justify-center">1</span>
          Seleccionar Plantel
        </button>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <button 
          onClick={() => step === 'review' && setStep('configure')}
          disabled={!selectedCampus}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            step === 'configure' 
              ? 'bg-green-100 text-green-700 font-medium' 
              : step === 'review' ? 'text-gray-500 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          <span className={`w-6 h-6 rounded-full text-sm flex items-center justify-center ${
            step === 'configure' || step === 'review' ? 'bg-green-600 text-white' : 'bg-gray-300 text-white'
          }`}>2</span>
          Configurar Solicitud
        </button>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
          step === 'review' 
            ? 'bg-green-100 text-green-700 font-medium' 
            : 'text-gray-300'
        }`}>
          <span className={`w-6 h-6 rounded-full text-sm flex items-center justify-center ${
            step === 'review' ? 'bg-green-600 text-white' : 'bg-gray-300 text-white'
          }`}>3</span>
          Revisar y Enviar
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Step 1: Select Campus */}
      {step === 'select-campus' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, código o ubicación..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
              
              {/* Partner Filter */}
              <div>
                <select
                  value={partnerFilter}
                  onChange={(e) => setPartnerFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Todos los Partners</option>
                  {uniquePartners.map(partner => (
                    <option key={partner} value={partner}>{partner}</option>
                  ))}
                </select>
              </div>
              
              {/* State Filter */}
              <div>
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Todos los Estados</option>
                  {uniqueStates.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Campus Table */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Partner</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Estado</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Plantel</th>
                    <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCampuses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                        <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No se encontraron planteles</p>
                        <p className="text-sm mt-1">Intenta con otros filtros</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCampuses.map((campus) => (
                      <tr 
                        key={campus.id} 
                        className={`hover:bg-gray-50 cursor-pointer ${
                          selectedCampus?.id === campus.id ? 'bg-green-50' : ''
                        }`}
                        onClick={() => handleSelectCampus(campus)}
                      >
                        <td className="px-6 py-4">
                          <span className="font-medium text-gray-800">{campus.partner_name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">{campus.state_name || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-800">{campus.name}</p>
                            {campus.code && (
                              <p className="text-xs text-gray-500">Código: {campus.code}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectCampus(campus);
                            }}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Seleccionar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination info */}
            <div className="px-6 py-3 bg-gray-50 border-t text-sm text-gray-600">
              Mostrando {filteredCampuses.length} de {campuses.length} planteles
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Configure Request */}
      {step === 'configure' && selectedCampus && (
        <div className="space-y-6">
          {/* Selected Campus Card */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Plantel Seleccionado</p>
                <p className="text-2xl font-bold mt-1">{selectedCampus.name}</p>
                <p className="text-green-100 mt-1">
                  {selectedCampus.partner_name} • {selectedCampus.state_name || 'Sin estado'}
                </p>
                <p className="text-green-100 mt-2 text-sm">
                  Costo por certificación: <span className="font-bold text-white">{formatCurrency(pricePerCertification)}</span>
                </p>
              </div>
              <button
                onClick={handleBackToSelect}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors"
              >
                Cambiar
              </button>
            </div>
          </div>

          {/* Units Input */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Saldo Units */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Saldo Regular</h3>
                  <p className="text-sm text-gray-500">Presupuesto estándar</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unidades (Certificaciones)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSaldoUnits(Math.max(0, saldoUnits - 1))}
                    className="w-12 h-12 rounded-lg border border-gray-300 hover:bg-gray-50 text-xl font-bold transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={saldoUnits === 0 ? '' : saldoUnits}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setSaldoUnits(val === '' ? 0 : parseInt(val, 10));
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '') setSaldoUnits(0);
                    }}
                    placeholder="0"
                    className="flex-1 text-center text-2xl font-bold py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => setSaldoUnits(saldoUnits + 1)}
                    className="w-12 h-12 rounded-lg border border-gray-300 hover:bg-gray-50 text-xl font-bold transition-colors"
                  >
                    +
                  </button>
                </div>
                <div className="mt-3 p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-700">Equivalente:</span>
                    <span className="font-bold text-green-800">{formatCurrency(saldoAmount)}</span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    {saldoUnits} × {formatCurrency(pricePerCertification)} por certificación
                  </p>
                </div>
              </div>
            </div>

            {/* Beca Units */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Gift className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Becas</h3>
                  <p className="text-sm text-gray-500">Certificaciones sin costo</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unidades (Certificaciones)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setBecaUnits(Math.max(0, becaUnits - 1))}
                    className="w-12 h-12 rounded-lg border border-gray-300 hover:bg-gray-50 text-xl font-bold transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={becaUnits === 0 ? '' : becaUnits}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setBecaUnits(val === '' ? 0 : parseInt(val, 10));
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '') setBecaUnits(0);
                    }}
                    placeholder="0"
                    className="flex-1 text-center text-2xl font-bold py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setBecaUnits(becaUnits + 1)}
                    className="w-12 h-12 rounded-lg border border-gray-300 hover:bg-gray-50 text-xl font-bold transition-colors"
                  >
                    +
                  </button>
                </div>
                <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-purple-700">Equivalente:</span>
                    <span className="font-bold text-purple-800">{formatCurrency(becaAmount)}</span>
                  </div>
                  <p className="text-xs text-purple-600 mt-1">
                    {becaUnits} × {formatCurrency(pricePerCertification)} por certificación
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Total Summary */}
          {totalUnits > 0 && (
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <Calculator className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <p className="text-blue-100">Total de la Solicitud</p>
                  <p className="text-3xl font-bold">{totalUnits} unidades = {formatCurrency(totalAmount)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Justification */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Justificación *
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={4}
              placeholder="Indica para qué se utilizará el saldo, quiénes serán los beneficiarios y cuál es el impacto esperado..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
              required
            />
            <p className="text-xs text-gray-500 mt-2">
              Campo obligatorio
            </p>
          </div>

          {/* Beca Info */}
          {becaUnits > 0 && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-purple-500 mt-0.5" />
              <div>
                <p className="font-medium text-purple-800">Solicitud incluye Becas</p>
                <p className="text-sm text-purple-700 mt-1">
                  Las becas son certificaciones sin costo que se otorgan a beneficiarios elegibles.
                  El proceso de aprobación puede tomar más tiempo.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleBackToSelect}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-center font-medium transition-colors"
            >
              Volver
            </button>
            <button
              onClick={handleGoToReview}
              disabled={totalUnits === 0}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-medium transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Revisar Solicitud
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && selectedCampus && (
        <div className="space-y-6">
          {/* Review Header */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white">
            <p className="text-green-100 text-sm mb-2">Revisa tu solicitud antes de enviar</p>
            <p className="text-2xl font-bold">Desglose de Solicitud</p>
          </div>

          {/* Campus Info */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-400" />
              Plantel Destino
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Partner</p>
                <p className="font-medium text-gray-800">{selectedCampus.partner_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estado</p>
                <p className="font-medium text-gray-800">{selectedCampus.state_name || 'No especificado'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Plantel</p>
                <p className="font-medium text-gray-800">{selectedCampus.name}</p>
                {selectedCampus.code && (
                  <p className="text-xs text-gray-500">Código: {selectedCampus.code}</p>
                )}
              </div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Concepto</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Unidades</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Precio Unitario</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {saldoUnits > 0 && (
                  <tr>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">Saldo Regular</p>
                          <p className="text-xs text-gray-500">Presupuesto estándar</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-gray-800">{saldoUnits}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {formatCurrency(pricePerCertification)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-green-600">{formatCurrency(saldoAmount)}</span>
                    </td>
                  </tr>
                )}
                {becaUnits > 0 && (
                  <tr>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Gift className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">Becas</p>
                          <p className="text-xs text-gray-500">Certificaciones becadas</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-gray-800">{becaUnits}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {formatCurrency(pricePerCertification)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-purple-600">{formatCurrency(becaAmount)}</span>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td className="px-6 py-4 font-semibold text-gray-800">Total</td>
                  <td className="px-6 py-4 text-center font-bold text-gray-800">
                    {totalUnits} unidades
                  </td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-xl font-bold text-gray-800">{formatCurrency(totalAmount)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Justification Preview */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-3">Justificación</h3>
            <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
              {justification}
            </p>
          </div>

          {/* Confirmation Notice */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">¿Todo está correcto?</p>
              <p className="text-sm text-blue-700 mt-1">
                Al enviar tu solicitud, será revisada por el equipo financiero y posteriormente 
                aprobada por gerencia. Recibirás notificaciones sobre el estado de tu solicitud.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => setStep('configure')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-center font-medium transition-colors"
            >
              Modificar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-medium transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Enviar Solicitud
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
