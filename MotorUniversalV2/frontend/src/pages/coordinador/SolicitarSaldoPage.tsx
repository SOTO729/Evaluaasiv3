/**
 * Página de Solicitar Saldo - Coordinador
 * 
 * Formulario para solicitar SALDO de MÚLTIPLES planteles:
 * - Diseño fluid responsive para todas las pantallas
 * - Tabla filtrable y ordenable de planteles
 * - Expandir plantel para agregar líneas de solicitud
 * - Entrada en unidades con equivalente en pesos
 * - Color primario azul de la app
 * 
 * NOTA: Para solicitar becas, usar /coordinador/solicitar-beca
 */
import React, { useState, useEffect, useMemo } from 'react';
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
  MapPin,
  Calculator,
  AlertTriangle,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  X,
  Wallet,
  FileText,
  Check,
  Paperclip,
  Upload,
  File,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  createBalanceRequest,
  formatCurrency,
  uploadAttachment,
  validateFile,
  formatFileSize,
  Attachment,
} from '../../services/balanceService';
import {
  getAvailableCampuses,
  AvailableCampus,
} from '../../services/userManagementService';
import {
  getGroups,
  CandidateGroup,
} from '../../services/partnersService';

const DEFAULT_PRICE_PER_CERTIFICATION = 500;

interface RequestLine {
  id: string;
  type: 'saldo' | 'beca';
  campusId: number;
  campusName: string;
  campusPartner: string;
  groupId: number | null;
  groupName: string;
  units: number;
  pricePerUnit: number;
  hasDifferentPrice: boolean;
}

interface GroupsCache {
  [campusId: number]: {
    groups: CandidateGroup[];
    campusCertificationCost: number;
    loading: boolean;
  };
}

type SortColumn = 'partner' | 'state' | 'name' | 'price' | 'lines';
type SortDirection = 'asc' | 'desc';

export default function SolicitarSaldoPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  
  const [campuses, setCampuses] = useState<AvailableCampus[]>([]);
  const [groupsCache, setGroupsCache] = useState<GroupsCache>({});
  
  const [searchTerm, setSearchTerm] = useState('');
  const [partnerFilter, setPartnerFilter] = useState<string>('');
  const [stateFilter, setStateFilter] = useState<string>('');
  
  const [sortColumn, setSortColumn] = useState<SortColumn>('partner');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  const [expandedCampusId, setExpandedCampusId] = useState<number | null>(null);
  const [requestLines, setRequestLines] = useState<RequestLine[]>([]);
  
  // Tipo fijo 'saldo' - para becas usar SolicitarBecaPage
  const newLineType: 'saldo' = 'saldo';
  const [newLineGroupId, setNewLineGroupId] = useState<number | null>(null);
  const [newLineUnits, setNewLineUnits] = useState<number>(0);
  
  const [justification, setJustification] = useState('');
  
  // Archivos adjuntos
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const loadGroups = async (campusId: number) => {
    if (groupsCache[campusId] && !groupsCache[campusId].loading) return;

    setGroupsCache(prev => ({
      ...prev,
      [campusId]: { groups: [], campusCertificationCost: DEFAULT_PRICE_PER_CERTIFICATION, loading: true }
    }));

    try {
      const data = await getGroups(campusId, { active_only: true, include_config: true });
      console.log('loadGroups response:', { campusId, groups: data.groups, firstGroup: data.groups?.[0] });
      setGroupsCache(prev => ({
        ...prev,
        [campusId]: {
          groups: data.groups || [],
          campusCertificationCost: data.campus_certification_cost || DEFAULT_PRICE_PER_CERTIFICATION,
          loading: false
        }
      }));
    } catch (err: any) {
      console.error('Error loading groups:', err);
      setGroupsCache(prev => ({
        ...prev,
        [campusId]: { groups: [], campusCertificationCost: DEFAULT_PRICE_PER_CERTIFICATION, loading: false }
      }));
    }
  };

  const uniquePartners = useMemo(() => {
    const partners = [...new Set(campuses.map(c => c.partner_name))];
    return partners.sort();
  }, [campuses]);

  const uniqueStates = useMemo(() => {
    const states = [...new Set(campuses.filter(c => c.state_name).map(c => c.state_name!))];
    return states.sort();
  }, [campuses]);

  const linesByCampus = useMemo(() => {
    const grouped: { [campusId: number]: RequestLine[] } = {};
    requestLines.forEach(line => {
      if (!grouped[line.campusId]) grouped[line.campusId] = [];
      grouped[line.campusId].push(line);
    });
    return grouped;
  }, [requestLines]);

  const linesCountByCampus = useMemo(() => {
    const counts: { [campusId: number]: number } = {};
    requestLines.forEach(line => {
      counts[line.campusId] = (counts[line.campusId] || 0) + 1;
    });
    return counts;
  }, [requestLines]);

  const filteredCampuses = useMemo(() => {
    const filtered = campuses.filter(campus => {
      const matchesSearch = searchTerm === '' || 
        campus.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        campus.partner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (campus.state_name && campus.state_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (campus.code && campus.code.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesPartner = partnerFilter === '' || campus.partner_name === partnerFilter;
      const matchesState = stateFilter === '' || campus.state_name === stateFilter;
      
      return matchesSearch && matchesPartner && matchesState;
    });

    return filtered.sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';

      switch (sortColumn) {
        case 'partner':
          aValue = a.partner_name.toLowerCase();
          bValue = b.partner_name.toLowerCase();
          break;
        case 'state':
          aValue = (a.state_name || '').toLowerCase();
          bValue = (b.state_name || '').toLowerCase();
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'price':
          aValue = a.certification_cost || DEFAULT_PRICE_PER_CERTIFICATION;
          bValue = b.certification_cost || DEFAULT_PRICE_PER_CERTIFICATION;
          break;
        case 'lines':
          aValue = linesCountByCampus[a.id] || 0;
          bValue = linesCountByCampus[b.id] || 0;
          break;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [campuses, searchTerm, partnerFilter, stateFilter, sortColumn, sortDirection, linesCountByCampus]);

  const totals = useMemo(() => {
    let totalUnits = 0, totalAmount = 0, saldoUnits = 0, saldoAmount = 0, becaUnits = 0, becaAmount = 0;

    requestLines.forEach(line => {
      const lineTotal = line.units * line.pricePerUnit;
      totalUnits += line.units;
      totalAmount += lineTotal;
      if (line.type === 'saldo') { saldoUnits += line.units; saldoAmount += lineTotal; }
      else { becaUnits += line.units; becaAmount += lineTotal; }
    });

    return { totalUnits, totalAmount, saldoUnits, saldoAmount, becaUnits, becaAmount };
  }, [requestLines]);

  const getGroupPrice = (campusId: number, groupId: number | null): number => {
    const campus = campuses.find(c => c.id === campusId);
    const baseCost = campus?.certification_cost || groupsCache[campusId]?.campusCertificationCost || DEFAULT_PRICE_PER_CERTIFICATION;
    if (groupId === null) return baseCost;
    const group = groupsCache[campusId]?.groups.find(g => g.id === groupId);
    console.log('getGroupPrice debug:', { campusId, groupId, group, effectiveConfig: group?.effective_config, baseCost });
    return group?.effective_config?.certification_cost ?? baseCost;
  };

  const getGroupName = (campusId: number, groupId: number | null): string => {
    if (groupId === null) return 'Plantel (todos los grupos)';
    const group = groupsCache[campusId]?.groups.find(g => g.id === groupId);
    return group?.name || 'Grupo';
  };

  const hasDifferentPrice = (campusId: number, groupId: number | null): boolean => {
    if (groupId === null) return false;
    const campus = campuses.find(c => c.id === campusId);
    const baseCost = campus?.certification_cost || groupsCache[campusId]?.campusCertificationCost || DEFAULT_PRICE_PER_CERTIFICATION;
    return getGroupPrice(campusId, groupId) !== baseCost;
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleExpandCampus = async (campusId: number) => {
    if (expandedCampusId === campusId) {
      setExpandedCampusId(null);
    } else {
      setExpandedCampusId(campusId);
      // newLineType siempre es 'saldo'
      setNewLineGroupId(null);
      setNewLineUnits(0);
      await loadGroups(campusId);
    }
  };

  const handleAddLine = (campus: AvailableCampus) => {
    if (newLineUnits <= 0) return;

    const price = getGroupPrice(campus.id, newLineGroupId);
    const newLine: RequestLine = {
      id: `${Date.now()}-${Math.random()}`,
      type: newLineType,
      campusId: campus.id,
      campusName: campus.name,
      campusPartner: campus.partner_name,
      groupId: newLineGroupId,
      groupName: getGroupName(campus.id, newLineGroupId),
      units: newLineUnits,
      pricePerUnit: price,
      hasDifferentPrice: hasDifferentPrice(campus.id, newLineGroupId),
    };

    setRequestLines([...requestLines, newLine]);
    setNewLineUnits(0);
    setNewLineGroupId(null);
  };

  const handleRemoveLine = (lineId: string) => {
    setRequestLines(requestLines.filter(l => l.id !== lineId));
  };

  const handleGoToReview = () => {
    if (requestLines.length === 0) {
      setError('Agrega al menos una línea de solicitud');
      return;
    }
    if (!justification.trim()) {
      setError('Ingresa una justificación');
      return;
    }
    setError(null);
    setShowReview(true);
  };

  // Manejo de archivos adjuntos
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);

    for (const file of Array.from(files)) {
      const validation = validateFile(file);
      if (!validation.valid) {
        setUploadError(validation.error || 'Archivo no válido');
        continue;
      }

      try {
        setUploadingFile(true);
        const attachment = await uploadAttachment(file);
        setAttachments(prev => [...prev, attachment]);
      } catch (err: any) {
        setUploadError(err.response?.data?.error || 'Error al subir archivo');
      } finally {
        setUploadingFile(false);
      }
    }

    // Reset input
    event.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-4 h-4 text-red-500" />;
      case 'xls':
      case 'xlsx':
        return <FileText className="w-4 h-4 text-primary-600" />;
      default:
        return <File className="w-4 h-4 text-blue-500" />;
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const promises = requestLines.map(line => 
        createBalanceRequest({
          request_type: line.type,
          amount_requested: line.units * line.pricePerUnit,
          campus_id: line.campusId,
          justification: justification.trim(),
          group_id: line.groupId || undefined,
          attachments: attachments,
        })
      );

      await Promise.all(promises);

      const uniqueCampusCount = new Set(requestLines.map(l => l.campusId)).size;

      navigate('/coordinador/mi-saldo', {
        state: { 
          message: `${requestLines.length} solicitud${requestLines.length > 1 ? 'es' : ''} enviada${requestLines.length > 1 ? 's' : ''} para ${uniqueCampusCount} plantel${uniqueCampusCount > 1 ? 'es' : ''}`, 
          type: 'success' 
        }
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al enviar solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  const getGroupOptions = (campusId: number) => {
    const campus = campuses.find(c => c.id === campusId);
    const baseCost = campus?.certification_cost || groupsCache[campusId]?.campusCertificationCost || DEFAULT_PRICE_PER_CERTIFICATION;
    const groups = groupsCache[campusId]?.groups || [];

    const options: { id: number | null; name: string; price: number; hasDifferentPrice: boolean }[] = [
      { id: null, name: 'Plantel (todos los grupos)', price: baseCost, hasDifferentPrice: false }
    ];
    
    groups.forEach(g => {
      const price = g.effective_config?.certification_cost ?? baseCost;
      options.push({ id: g.id, name: g.name, price, hasDifferentPrice: price !== baseCost });
    });
    
    return options;
  };

  const getGroupsWithDifferentPrice = (campusId: number) => {
    const campus = campuses.find(c => c.id === campusId);
    const baseCost = campus?.certification_cost || groupsCache[campusId]?.campusCertificationCost || DEFAULT_PRICE_PER_CERTIFICATION;
    const groups = groupsCache[campusId]?.groups || [];
    return groups.filter(g => (g.effective_config?.certification_cost ?? baseCost) !== baseCost);
  };

  // Componente para encabezado de columna ordenable
  const SortableHeader = ({ column, label, align = 'left' }: { column: SortColumn; label: string; align?: 'left' | 'right' | 'center' }) => (
    <th 
      className={`px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
      onClick={() => handleSort(column)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
        {label}
        {sortColumn === column ? (
          sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-primary-600" /> : <ChevronDown className="w-3.5 h-3.5 text-primary-600" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 text-gray-300" />
        )}
      </div>
    </th>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // ==================== STEPS CONFIG ====================
  const steps = [
    { id: 1, label: 'Seleccionar Planteles', icon: Building2, description: 'Elige planteles y agrega líneas' },
    { id: 2, label: 'Justificación', icon: FileText, description: 'Describe el uso del saldo' },
    { id: 3, label: 'Revisar y Enviar', icon: Send, description: 'Confirma y envía la solicitud' },
  ];

  const getCurrentStep = () => {
    if (showReview) return 3;
    if (justification.trim()) return 2;
    if (requestLines.length > 0) return 2;
    return 1;
  };

  const isStepCompleted = (stepId: number) => {
    if (stepId === 1) return requestLines.length > 0;
    if (stepId === 2) return justification.trim().length > 0 && requestLines.length > 0;
    if (stepId === 3) return false; // Nunca completado hasta enviar
    return false;
  };

  const currentStep = getCurrentStep();

  // Stepper Component
  const StepIndicator = () => (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 lg:p-5 mb-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = isStepCompleted(step.id);
          const isPast = step.id < currentStep;

          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className={`flex-shrink-0 w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-primary-500 text-white'
                      : isActive
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                      : isPast
                      ? 'bg-primary-100 text-primary-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 lg:w-6 lg:h-6" />
                  ) : (
                    <Icon className="w-5 h-5 lg:w-6 lg:h-6" />
                  )}
                </div>
                <div className="hidden sm:block min-w-0">
                  <p
                    className={`font-medium text-sm lg:text-base truncate ${
                      isActive ? 'text-primary-700' : isCompleted || isPast ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-gray-500 truncate hidden lg:block">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`hidden sm:block flex-shrink-0 w-8 lg:w-16 h-1 mx-2 lg:mx-4 rounded-full transition-all ${
                    step.id < currentStep || isCompleted ? 'bg-primary-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  // ==================== REVIEW PAGE ====================
  if (showReview) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 3xl:px-16 py-6 lg:py-8">
        <div className="max-w-[1800px] mx-auto">
          {/* Stepper */}
          <StepIndicator />

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => setShowReview(false)}
              className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                <div className="p-2.5 bg-primary-100 rounded-xl">
                  <FileText className="w-7 h-7 text-primary-600" />
                </div>
                Revisar Solicitud
              </h1>
              <p className="text-gray-500 mt-1 text-sm lg:text-base">
                Verifica los detalles antes de enviar tu solicitud
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Resumen Hero */}
            <div className="bg-gradient-to-br from-green-600 via-green-700 to-green-800 rounded-2xl p-6 lg:p-8 text-white shadow-xl shadow-green-200">
              <p className="text-green-200 text-sm font-medium mb-4">Resumen de tu solicitud</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <div className="bg-white/10  rounded-xl p-4">
                  <p className="text-green-200 text-xs uppercase tracking-wide">Planteles</p>
                  <p className="text-3xl lg:text-4xl font-bold mt-1">{new Set(requestLines.map(l => l.campusId)).size}</p>
                </div>
                <div className="bg-white/10  rounded-xl p-4">
                  <p className="text-green-200 text-xs uppercase tracking-wide">Líneas</p>
                  <p className="text-3xl lg:text-4xl font-bold mt-1">{requestLines.length}</p>
                </div>
                <div className="bg-white/10  rounded-xl p-4">
                  <p className="text-green-200 text-xs uppercase tracking-wide">Unidades</p>
                  <p className="text-3xl lg:text-4xl font-bold mt-1">{totals.totalUnits}</p>
                </div>
                <div className="bg-white/10  rounded-xl p-4">
                  <p className="text-green-200 text-xs uppercase tracking-wide">Total</p>
                  <p className="text-3xl lg:text-4xl font-bold mt-1">{formatCurrency(totals.totalAmount)}</p>
                </div>
              </div>
            </div>

            {/* Desglose por Campus */}
            <div className="grid gap-4">
              {Object.entries(linesByCampus).map(([campusIdStr, lines]) => {
                const campusId = parseInt(campusIdStr);
                const campus = campuses.find(c => c.id === campusId);
                const campusTotal = lines.reduce((sum, l) => sum + l.units * l.pricePerUnit, 0);
                const campusUnits = lines.reduce((sum, l) => sum + l.units, 0);

                return (
                  <div key={campusId} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 lg:p-5 bg-gradient-to-r from-gray-50 to-white border-b flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-100 rounded-lg">
                          <Building2 className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{campus?.name}</p>
                          <p className="text-sm text-gray-500">{campus?.partner_name} • {campus?.state_name || 'Sin estado'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">{campusUnits} unidades</p>
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(campusTotal)}</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50/50">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tipo</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Grupo</th>
                            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Unidades</th>
                            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Precio</th>
                            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {lines.map(line => (
                            <tr key={line.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className={`p-1.5 rounded-lg ${line.type === 'saldo' ? 'bg-emerald-100' : 'bg-purple-100'}`}>
                                    {line.type === 'saldo' ? (
                                      <DollarSign className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                      <Gift className="w-4 h-4 text-purple-600" />
                                    )}
                                  </div>
                                  <span className={`font-medium ${line.type === 'saldo' ? 'text-emerald-700' : 'text-purple-700'}`}>
                                    {line.type === 'saldo' ? 'Saldo' : 'Beca'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-700">{line.groupName}</span>
                                  {line.hasDifferentPrice && (
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="font-semibold text-gray-900">{line.units}</span>
                              </td>
                              <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(line.pricePerUnit)}</td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-semibold text-gray-900">{formatCurrency(line.units * line.pricePerUnit)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Justificación */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 lg:p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Justificación
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-xl border border-gray-100">
                {justification}
              </p>
            </div>

            {/* Archivos Adjuntos (si hay) */}
            {attachments.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 lg:p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Paperclip className="w-5 h-5 text-gray-400" />
                  Documentación Adjunta
                </h3>
                <div className="grid gap-2">
                  {attachments.map((att, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      {getFileIcon(att.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{att.name}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(att.size)}</p>
                      </div>
                      <a 
                        href={att.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Ver
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info */}
            <div className="p-4 lg:p-5 bg-primary-50 border border-gray-200 rounded-2xl flex items-start gap-3">
              <Info className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-primary-900">¿Todo está correcto?</p>
                <p className="text-sm text-primary-700 mt-1">
                  Se crearán {requestLines.length} solicitud{requestLines.length !== 1 ? 'es' : ''} (una por cada línea).
                  Cada solicitud será revisada por el equipo financiero.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowReview(false)}
                className="flex-1 px-6 py-3.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-all hover:border-gray-400"
              >
                Modificar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 text-white rounded-xl font-medium transition-all hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-200 hover:shadow-xl hover:shadow-primary-300"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Enviar Solicitud{requestLines.length !== 1 ? 'es' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== MAIN PAGE ====================
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 3xl:px-16 py-6 lg:py-8 max-w-[1920px] mx-auto">
      {/* Stepper */}
      <div className="animate-fadeInDown">
        <StepIndicator />
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6 lg:mb-8 animate-fadeInDown delay-100">
        <Link
          to="/coordinador/mi-saldo"
          className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2.5 bg-green-100 rounded-xl">
              <Wallet className="w-7 h-7 text-green-600" />
            </div>
            Solicitar Saldo
          </h1>
          <p className="text-gray-500 mt-1 text-sm lg:text-base">
            Solicita saldo para asignar certificaciones a tus alumnos
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-fadeInUp delay-200">
        {/* Columna izquierda: Tabla de planteles */}
        <div className="xl:col-span-3 space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 lg:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <div className="sm:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, código, partner..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 lg:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all text-sm lg:text-base"
                  />
                </div>
              </div>
              
              <select
                value={partnerFilter}
                onChange={(e) => setPartnerFilter(e.target.value)}
                className="w-full px-4 py-2.5 lg:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm lg:text-base bg-white"
              >
                <option value="">Todos los Partners</option>
                {uniquePartners.map(partner => (
                  <option key={partner} value={partner}>{partner}</option>
                ))}
              </select>
              
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full px-4 py-2.5 lg:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm lg:text-base bg-white"
              >
                <option value="">Todos los Estados</option>
                {uniqueStates.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Campus Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 350px)', minHeight: '400px' }}>
              <table className="w-full">
                <thead className="bg-primary-50/60 border-b border-primary-100 sticky top-0 z-10 ">
                  <tr>
                    <SortableHeader column="partner" label="Partner" />
                    <SortableHeader column="state" label="Estado" />
                    <SortableHeader column="name" label="Plantel" />
                    <SortableHeader column="price" label="Precio/Cert" align="right" />
                    <SortableHeader column="lines" label="Líneas" align="center" />
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCampuses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center">
                        <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500 font-medium">No se encontraron planteles</p>
                        <p className="text-sm text-gray-400 mt-1">Intenta con otros filtros de búsqueda</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCampuses.map((campus) => {
                      const isExpanded = expandedCampusId === campus.id;
                      const campusLinesCount = linesCountByCampus[campus.id] || 0;
                      const isLoading = groupsCache[campus.id]?.loading;
                      const baseCost = campus.certification_cost || groupsCache[campus.id]?.campusCertificationCost || DEFAULT_PRICE_PER_CERTIFICATION;
                      const groupsWithDiffPrice = getGroupsWithDifferentPrice(campus.id);

                      return (
                        <React.Fragment key={campus.id}>
                          <tr 
                            className={`cursor-pointer transition-all ${
                              isExpanded 
                                ? 'bg-green-50' 
                                : campusLinesCount > 0 
                                  ? 'bg-green-50/50 hover:bg-green-50' 
                                  : 'hover:bg-gray-50'
                            }`}
                            onClick={() => handleExpandCampus(campus.id)}
                          >
                            <td className="px-3 py-3">
                              <span className="font-medium text-gray-900 text-sm">{campus.partner_name}</span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                {campus.state_name || '-'}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-medium text-gray-900 text-sm">{campus.name}</p>
                              {campus.code && <p className="text-xs text-gray-500">{campus.code}</p>}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="text-sm font-semibold text-gray-900">{formatCurrency(baseCost)}</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              {campusLinesCount > 0 ? (
                                <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 bg-green-600 text-white text-xs font-bold rounded-full">
                                  {campusLinesCount}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleExpandCampus(campus.id); }}
                                className={`p-2 rounded-lg transition-all ${
                                  isExpanded 
                                    ? 'bg-green-600 text-white shadow-md' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-600'
                                }`}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="p-0">
                                <div className="px-4 py-4 bg-primary-50/50 border-t border-primary-100">
                                  {isLoading ? (
                                    <div className="py-6 text-center">
                                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-600" />
                                      <p className="text-sm text-gray-500 mt-2">Cargando grupos...</p>
                                    </div>
                                  ) : (
                                    <>
                                      {groupsWithDiffPrice.length > 0 && (
                                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                          <div className="flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                            <div>
                                              <p className="text-sm font-medium text-amber-800">Grupos con precio diferente:</p>
                                              <div className="flex flex-wrap gap-2 mt-2">
                                                {groupsWithDiffPrice.map(g => (
                                                  <span key={g.id} className="text-xs px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg font-medium">
                                                    {g.name}: {formatCurrency(g.effective_config?.certification_cost || 0)}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Grupo (opcional)</label>
                                          <select
                                            value={newLineGroupId ?? 'null'}
                                            onChange={(e) => setNewLineGroupId(e.target.value === 'null' ? null : parseInt(e.target.value))}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
                                          >
                                            {getGroupOptions(campus.id).map(opt => (
                                              <option key={opt.id ?? 'null'} value={opt.id ?? 'null'}>
                                                {opt.name} {opt.hasDifferentPrice ? `(${formatCurrency(opt.price)})` : ''}
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        <div>
                                          <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                            Unidades <span className="text-gray-400">({formatCurrency(getGroupPrice(campus.id, newLineGroupId))}/u)</span>
                                          </label>
                                          <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={newLineUnits === 0 ? '' : newLineUnits}
                                            onChange={(e) => {
                                              const val = e.target.value.replace(/[^0-9]/g, '');
                                              setNewLineUnits(val === '' ? 0 : parseInt(val, 10));
                                            }}
                                            placeholder="0"
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                          />
                                        </div>

                                        <div className="flex items-end">
                                          <button
                                            onClick={() => handleAddLine(campus)}
                                            disabled={newLineUnits <= 0}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all shadow-sm hover:shadow-md"
                                          >
                                            <Plus className="w-4 h-4" />
                                            Agregar
                                          </button>
                                        </div>
                                      </div>

                                      {newLineUnits > 0 && (
                                        <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-200 text-sm">
                                          <span className="text-gray-600">Vista previa: </span>
                                          <span className="font-medium">{newLineUnits} unidades × {formatCurrency(getGroupPrice(campus.id, newLineGroupId))} = </span>
                                          <span className="font-bold text-green-600">{formatCurrency(newLineUnits * getGroupPrice(campus.id, newLineGroupId))}</span>
                                        </div>
                                      )}

                                      {linesByCampus[campus.id]?.length > 0 && (
                                        <div className="mt-4 space-y-2">
                                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Líneas agregadas</p>
                                          {linesByCampus[campus.id].map(line => (
                                            <div key={line.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                                              <div className="flex items-center gap-3">
                                                <div className={`p-1.5 rounded-lg ${line.type === 'saldo' ? 'bg-emerald-100' : 'bg-purple-100'}`}>
                                                  {line.type === 'saldo' ? (
                                                    <DollarSign className="w-4 h-4 text-emerald-600" />
                                                  ) : (
                                                    <Gift className="w-4 h-4 text-purple-600" />
                                                  )}
                                                </div>
                                                <div>
                                                  <span className="text-sm font-medium text-gray-900">
                                                    {line.type === 'saldo' ? 'Saldo' : 'Beca'}
                                                  </span>
                                                  <span className="text-gray-400 mx-2">•</span>
                                                  <span className="text-sm text-gray-600">{line.groupName}</span>
                                                  {line.hasDifferentPrice && (
                                                    <AlertTriangle className="inline w-3.5 h-3.5 text-amber-500 ml-1.5" />
                                                  )}
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(line.units * line.pricePerUnit)}</p>
                                                  <p className="text-xs text-gray-500">{line.units}u × {formatCurrency(line.pricePerUnit)}</p>
                                                </div>
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); handleRemoveLine(line.id); }}
                                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                  <X className="w-4 h-4" />
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 bg-gray-50/80 border-t text-sm text-gray-600 flex items-center justify-between">
              <span>Mostrando {filteredCampuses.length} de {campuses.length} planteles</span>
              {requestLines.length > 0 && (
                <span className="text-primary-600 font-medium">{requestLines.length} líneas agregadas</span>
              )}
            </div>
          </div>
        </div>

        {/* Columna derecha: Resumen */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sticky top-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-primary-600" />
              Resumen
            </h3>

            {requestLines.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <DollarSign className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">Sin líneas agregadas</p>
                <p className="text-xs text-gray-400 mt-1">Expande un plantel para comenzar</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-green-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-green-700">{new Set(requestLines.map(l => l.campusId)).size}</p>
                    <p className="text-xs text-green-600 font-medium">Planteles</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-green-700">{requestLines.length}</p>
                    <p className="text-xs text-green-600 font-medium">Líneas</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {totals.saldoAmount > 0 && (
                    <div className="flex items-center justify-between py-2 px-3 bg-emerald-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-800">Saldo</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-700">{formatCurrency(totals.saldoAmount)}</p>
                        <p className="text-xs text-emerald-600">{totals.saldoUnits} unidades</p>
                      </div>
                    </div>
                  )}
                  {totals.becaAmount > 0 && (
                    <div className="flex items-center justify-between py-2 px-3 bg-purple-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-800">Becas</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-purple-700">{formatCurrency(totals.becaAmount)}</p>
                        <p className="text-xs text-purple-600">{totals.becaUnits} unidades</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="py-3 px-4 bg-gray-900 rounded-xl text-white mb-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total</span>
                    <div className="text-right">
                      <p className="text-xl font-bold">{formatCurrency(totals.totalAmount)}</p>
                      <p className="text-xs text-gray-400">{totals.totalUnits} unidades</p>
                    </div>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 mb-4">
                  {requestLines.map(line => (
                    <div key={line.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {line.type === 'saldo' ? (
                          <DollarSign className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <Gift className="w-3 h-3 text-purple-600 flex-shrink-0" />
                        )}
                        <span className="text-gray-600 truncate text-xs">{line.campusName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-xs">{line.units}u</span>
                        <button
                          onClick={() => handleRemoveLine(line.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Justificación <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    rows={3}
                    placeholder="Describe el uso del saldo..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none text-sm"
                    required
                  />

                  {/* Archivos Adjuntos */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Documentación <span className="text-gray-400">(opcional)</span>
                    </label>
                    
                    {/* Lista de archivos subidos */}
                    {attachments.length > 0 && (
                      <div className="mb-3 space-y-2">
                        {attachments.map((att, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                            {getFileIcon(att.type)}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-700 truncate">{att.name}</p>
                              <p className="text-xs text-gray-400">{formatFileSize(att.size)}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveAttachment(index)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Área de drop/select */}
                    <label className="relative cursor-pointer">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx"
                        onChange={handleFileSelect}
                        disabled={uploadingFile}
                        className="sr-only"
                      />
                      <div className={`flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-xl transition-colors ${
                        uploadingFile 
                          ? 'border-gray-200 bg-gray-50' 
                          : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50'
                      }`}>
                        {uploadingFile ? (
                          <>
                            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                            <span className="text-xs text-gray-500">Subiendo...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              Clic para adjuntar o arrastra archivos
                            </span>
                            <span className="text-xs text-gray-400">
                              PDF, imágenes, Excel (máx 10MB)
                            </span>
                          </>
                        )}
                      </div>
                    </label>

                    {uploadError && (
                      <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {uploadError}
                      </p>
                    )}
                  </div>

                  {totals.becaUnits > 0 && (
                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-purple-700">
                          Las becas requieren aprobación adicional.
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleGoToReview}
                    disabled={requestLines.length === 0 || !justification.trim()}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-200 hover:shadow-xl"
                  >
                    <Send className="w-5 h-5" />
                    Revisar y Enviar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
