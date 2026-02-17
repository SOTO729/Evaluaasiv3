/**
 * Componente de Certificados del Grupo
 * Muestra estadísticas y permite descargar certificados del grupo
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Award,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  Search,
  Shield,
  BadgeCheck,
  Sparkles,
  RefreshCw,
  Package,
  Trash2,
} from 'lucide-react';
import {
  getGroupCertificatesStats,
  downloadGroupCertificatesZip,
  generateGroupCertificates,
  clearGroupCertificatesUrls,
  GroupCertificatesStats,
  CandidateCertificateStats,
} from '../../services/partnersService';
import { useAuthStore } from '../../store/authStore';

interface GroupCertificatesTabProps {
  groupId: number;
  groupName: string;
}

type ViewMode = 'summary' | 'candidates';
type CertificateType = 'tier_basic' | 'tier_standard' | 'tier_advanced' | 'digital_badge';

// Información de cada tipo de certificado
const CERTIFICATE_TYPES = {
  tier_basic: {
    name: 'Constancia de Participación',
    description: 'Reporte de evaluación con calificación',
    icon: FileText,
    color: 'blue',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
  },
  tier_standard: {
    name: 'Certificado Eduit',
    description: 'Certificación oficial Eduit',
    icon: Award,
    color: 'purple',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-200',
  },
  tier_advanced: {
    name: 'Certificado CONOCER',
    description: 'Certificación oficial del gobierno',
    icon: Shield,
    color: 'emerald',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-200',
  },
  digital_badge: {
    name: 'Insignia Digital',
    description: 'Badge verificable en línea',
    icon: BadgeCheck,
    color: 'amber',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-200',
  },
};

export default function GroupCertificatesTab({ groupId, groupName }: GroupCertificatesTabProps) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'developer';

  const [stats, setStats] = useState<GroupCertificatesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCandidates, setExpandedCandidates] = useState<Set<string>>(new Set());
  
  const [downloading, setDownloading] = useState(false);
  const [generating, setGenerating] = useState<CertificateType | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  
  // Tipos seleccionados para descarga
  const [selectedTypes, setSelectedTypes] = useState<Set<CertificateType>>(new Set(['tier_basic', 'tier_standard']));
  
  // Candidatos seleccionados para descarga
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    loadStats();
  }, [groupId]);
  
  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getGroupCertificatesStats(groupId);
      setStats(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDownloadZip = async () => {
    if (selectedTypes.size === 0) {
      setError('Selecciona al menos un tipo de certificado');
      return;
    }
    
    try {
      setDownloading(true);
      setError(null);
      
      const types = Array.from(selectedTypes).filter(t => t !== 'digital_badge') as ('tier_basic' | 'tier_standard' | 'tier_advanced')[];
      if (types.length === 0) {
        setError('Las insignias digitales no se pueden descargar como PDF');
        setDownloading(false);
        return;
      }
      
      // Pasar candidatos seleccionados si hay alguno
      const userIds = selectedCandidates.size > 0 ? Array.from(selectedCandidates) : undefined;
      const blob = await downloadGroupCertificatesZip(groupId, types, userIds);
      
      // Descargar el archivo
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Certificados_${groupName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al descargar certificados');
    } finally {
      setDownloading(false);
    }
  };
  
  const handleGenerateCertificates = async (type: 'tier_basic' | 'tier_standard') => {
    try {
      setGenerating(type);
      setError(null);
      
      await generateGroupCertificates(groupId, type);
      
      // Recargar estadísticas después de generar
      await loadStats();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al generar certificados');
    } finally {
      setGenerating(null);
    }
  };
  
  const toggleCandidateExpanded = (userId: string) => {
    setExpandedCandidates(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };
  
  const toggleSelectedType = (type: CertificateType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };
  
  const toggleCandidateSelected = (userId: string) => {
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };
  
  const toggleSelectAllCandidates = () => {
    if (selectedCandidates.size === filteredCandidates.length) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(filteredCandidates.map(c => c.user_id)));
    }
  };
  
  const handleRegenerateCertificates = async () => {
    if (!confirm('¿Desea regenerar todos los PDFs de certificados? Esto reemplazará los existentes con las posiciones correctas y el código QR.')) {
      return;
    }
    
    try {
      setRegenerating(true);
      setError(null);
      
      // Limpiar URLs existentes para forzar regeneración
      await clearGroupCertificatesUrls(groupId, true, true);
      
      // Recargar estadísticas
      await loadStats();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al regenerar certificados');
    } finally {
      setRegenerating(false);
    }
  };
  
  // Filtrar candidatos por búsqueda
  const filteredCandidates = useMemo(() => {
    if (!stats) return [];
    
    return (stats.candidates ?? []).filter(c => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        c.full_name?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.curp?.toLowerCase().includes(query)
      );
    });
  }, [stats, searchQuery]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-3 text-gray-600">Cargando certificados...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700">{error}</p>
        <button
          onClick={loadStats}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }
  
  if (!stats) return null;
  
  const { config, summary } = stats;
  const enabledTypes = [
    config.enable_tier_basic && 'tier_basic',
    config.enable_tier_standard && 'tier_standard',
    config.enable_tier_advanced && 'tier_advanced',
    config.enable_digital_badge && 'digital_badge',
  ].filter(Boolean) as CertificateType[];
  
  return (
    <div className="space-y-6">
      {/* Header con acciones */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Certificados del Grupo</h2>
          <p className="text-sm text-gray-500 mt-1">
            {summary.total_exams_approved} exámenes aprobados por {stats.group.member_count} candidatos
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={loadStats}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          
          {isAdmin && (
          <button
            onClick={handleRegenerateCertificates}
            disabled={regenerating}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Regenerar todos los PDFs con posiciones correctas y QR"
          >
            {regenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Regenerando...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Regenerar PDFs</span>
              </>
            )}
          </button>
          )}
          
          <button
            onClick={handleDownloadZip}
            disabled={downloading || selectedTypes.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Descargando...</span>
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                <span>Descargar ZIP</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Tipos habilitados */}
      {enabledTypes.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-amber-800 font-medium">No hay tipos de certificado habilitados</p>
          <p className="text-amber-600 text-sm mt-1">
            Configura los tipos de certificado en la configuración del plantel o grupo.
          </p>
        </div>
      ) : (
        <>
          {/* Vista: Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setViewMode('summary')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'summary'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Por Tipo
            </button>
            <button
              onClick={() => setViewMode('candidates')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'candidates'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Por Candidato
            </button>
          </div>
          
          {/* Vista por Tipo */}
          {viewMode === 'summary' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Constancias */}
              {config.enable_tier_basic && (
                <CertificateTypeCard
                  type="tier_basic"
                  info={CERTIFICATE_TYPES.tier_basic}
                  ready={summary.tier_basic.ready}
                  pending={summary.tier_basic.pending}
                  total={summary.tier_basic.total}
                  selected={selectedTypes.has('tier_basic')}
                  onToggleSelect={() => toggleSelectedType('tier_basic')}
                  onGenerate={isAdmin ? () => handleGenerateCertificates('tier_basic') : undefined}
                  generating={generating === 'tier_basic'}
                />
              )}
              
              {/* Certificados Eduit */}
              {config.enable_tier_standard && (
                <CertificateTypeCard
                  type="tier_standard"
                  info={CERTIFICATE_TYPES.tier_standard}
                  ready={summary.tier_standard.ready}
                  pending={summary.tier_standard.pending}
                  total={summary.tier_standard.total}
                  selected={selectedTypes.has('tier_standard')}
                  onToggleSelect={() => toggleSelectedType('tier_standard')}
                  onGenerate={isAdmin ? () => handleGenerateCertificates('tier_standard') : undefined}
                  generating={generating === 'tier_standard'}
                />
              )}
              
              {/* CONOCER */}
              {config.enable_tier_advanced && (
                <CertificateTypeCard
                  type="tier_advanced"
                  info={CERTIFICATE_TYPES.tier_advanced}
                  ready={summary.tier_advanced.count}
                  total={summary.tier_advanced.count}
                  selected={selectedTypes.has('tier_advanced')}
                  onToggleSelect={() => toggleSelectedType('tier_advanced')}
                  isConocer
                />
              )}
              
              {/* Badge Digital */}
              {config.enable_digital_badge && (
                <CertificateTypeCard
                  type="digital_badge"
                  info={CERTIFICATE_TYPES.digital_badge}
                  ready={summary.digital_badge.count}
                  total={summary.digital_badge.count}
                  selected={selectedTypes.has('digital_badge')}
                  onToggleSelect={() => toggleSelectedType('digital_badge')}
                  isBadge
                />
              )}
            </div>
          )}
          
          {/* Vista por Candidato */}
          {viewMode === 'candidates' && (
            <div className="space-y-4">
              {/* Toolbar de selección */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAllCandidates}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      selectedCandidates.size === filteredCandidates.length && filteredCandidates.length > 0
                        ? 'bg-purple-600 border-purple-600'
                        : selectedCandidates.size > 0
                        ? 'bg-purple-300 border-purple-400'
                        : 'border-gray-400'
                    }`}>
                      {selectedCandidates.size > 0 && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <span>
                      {selectedCandidates.size === 0
                        ? 'Seleccionar todos'
                        : selectedCandidates.size === filteredCandidates.length
                        ? 'Deseleccionar todos'
                        : `${selectedCandidates.size} seleccionados`}
                    </span>
                  </button>
                  
                  {selectedCandidates.size > 0 && (
                    <span className="text-sm text-gray-500">
                      La descarga incluirá solo los candidatos seleccionados
                    </span>
                  )}
                </div>
                
                {/* Búsqueda */}
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
              
              {/* Lista de candidatos */}
              <div className="space-y-3">
                {filteredCandidates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No se encontraron candidatos</p>
                  </div>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <CandidateCard
                      key={candidate.user_id}
                      candidate={candidate}
                      config={config}
                      expanded={expandedCandidates.has(candidate.user_id)}
                      onToggleExpand={() => toggleCandidateExpanded(candidate.user_id)}
                      selected={selectedCandidates.has(candidate.user_id)}
                      onToggleSelect={() => toggleCandidateSelected(candidate.user_id)}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Componente de tarjeta de tipo de certificado
interface CertificateTypeCardProps {
  type: CertificateType;
  info: typeof CERTIFICATE_TYPES[CertificateType];
  ready: number;
  pending?: number;
  total: number;
  selected: boolean;
  onToggleSelect: () => void;
  onGenerate?: () => void;
  generating?: boolean;
  isConocer?: boolean;
  isBadge?: boolean;
}

function CertificateTypeCard({
  info,
  ready,
  pending = 0,
  total,
  selected,
  onToggleSelect,
  onGenerate,
  generating,
  isConocer,
  isBadge,
}: CertificateTypeCardProps) {
  const Icon = info.icon;
  const percentage = total > 0 ? Math.round((ready / total) * 100) : 0;
  
  return (
    <div className={`p-5 rounded-xl border-2 transition-all ${
      selected ? `${info.borderColor} ${info.bgColor}` : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${info.bgColor}`}>
            <Icon className={`w-6 h-6 ${info.textColor}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{info.name}</h3>
            <p className="text-sm text-gray-500">{info.description}</p>
          </div>
        </div>
        
        {/* Checkbox para incluir en descarga */}
        {!isBadge && (
          <button
            onClick={onToggleSelect}
            className={`p-1 rounded transition-colors ${
              selected ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'
            }`}
            title={selected ? 'Quitar de descarga' : 'Incluir en descarga'}
          >
            <CheckCircle2 className={`w-6 h-6 ${selected ? 'fill-purple-100' : ''}`} />
          </button>
        )}
      </div>
      
      {/* Stats */}
      <div className="space-y-3">
        {/* Barra de progreso */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${info.bgColor.replace('50', '500')} transition-all`}
            style={{ width: `${percentage}%`, backgroundColor: `var(--tw-${info.color}-500, #9333ea)` }}
          />
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-gray-700"><strong>{ready}</strong> listos</span>
            </span>
            {pending > 0 && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-gray-700"><strong>{pending}</strong> pendientes</span>
              </span>
            )}
          </div>
          <span className="text-gray-500 font-medium">{percentage}%</span>
        </div>
        
        {/* Botón generar */}
        {pending > 0 && onGenerate && !isConocer && !isBadge && (
          <button
            onClick={onGenerate}
            disabled={generating}
            className={`w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              generating
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : `${info.bgColor} ${info.textColor} hover:opacity-80`
            }`}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generar pendientes</span>
              </>
            )}
          </button>
        )}
        
        {isBadge && (
          <p className="text-xs text-gray-500 text-center mt-2">
            Las insignias son verificables en línea
          </p>
        )}
      </div>
    </div>
  );
}

// Componente de tarjeta de candidato
interface CandidateCardProps {
  candidate: CandidateCertificateStats;
  config: GroupCertificatesStats['config'];
  expanded: boolean;
  onToggleExpand: () => void;
  selected: boolean;
  onToggleSelect: () => void;
}

function CandidateCard({ candidate, config, expanded, onToggleExpand, selected, onToggleSelect }: CandidateCardProps) {
  const totalCerts = 
    (config.enable_tier_basic ? candidate.tier_basic_ready : 0) +
    (config.enable_tier_standard ? candidate.tier_standard_ready : 0) +
    (config.enable_tier_advanced ? candidate.tier_advanced_count : 0);
  
  const totalPending =
    (config.enable_tier_basic ? candidate.tier_basic_pending : 0) +
    (config.enable_tier_standard ? candidate.tier_standard_pending : 0);
  
  return (
    <div className={`border-2 rounded-xl overflow-hidden bg-white hover:shadow-sm transition-all ${
      selected ? 'border-purple-400 bg-purple-50/30' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div className="flex items-center p-4">
        {/* Checkbox de selección */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          className="mr-3 flex-shrink-0"
        >
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            selected ? 'bg-purple-600 border-purple-600' : 'border-gray-300 hover:border-purple-400'
          }`}>
            {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
          </div>
        </button>
        
        <button
          onClick={onToggleExpand}
          className="flex-1 flex items-center justify-between text-left hover:bg-gray-50/50 rounded-lg transition-colors -m-1 p-1"
        >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-purple-600">
              {candidate.full_name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">{candidate.full_name}</h4>
            <p className="text-sm text-gray-500">{candidate.email || candidate.curp || 'Sin datos'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {totalCerts > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {totalCerts}
              </span>
            )}
            {totalPending > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                <Clock className="w-3.5 h-3.5" />
                {totalPending}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>
      </div>
      
      {/* Contenido expandido */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
            {/* Exámenes aprobados */}
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{candidate.exams_approved}</p>
              <p className="text-xs text-gray-500">Exámenes aprobados</p>
            </div>
            
            {/* Constancias */}
            {config.enable_tier_basic && (
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{candidate.tier_basic_ready}</p>
                <p className="text-xs text-blue-600">Constancias</p>
                {candidate.tier_basic_pending > 0 && (
                  <p className="text-xs text-amber-600 mt-1">+{candidate.tier_basic_pending} pendientes</p>
                )}
              </div>
            )}
            
            {/* Certificados Eduit */}
            {config.enable_tier_standard && (
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{candidate.tier_standard_ready}</p>
                <p className="text-xs text-purple-600">Cert. Eduit</p>
                {candidate.tier_standard_pending > 0 && (
                  <p className="text-xs text-amber-600 mt-1">+{candidate.tier_standard_pending} pendientes</p>
                )}
              </div>
            )}
            
            {/* CONOCER */}
            {config.enable_tier_advanced && (
              <div className="text-center p-3 bg-emerald-50 rounded-lg">
                <p className="text-2xl font-bold text-emerald-600">{candidate.tier_advanced_count}</p>
                <p className="text-xs text-emerald-600">CONOCER</p>
              </div>
            )}
          </div>
          
          {/* Detalle de resultados */}
          {(candidate.results ?? []).length > 0 && (
            <div className="mt-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Detalle de exámenes:</h5>
              <div className="space-y-2">
                {(candidate.results ?? []).map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg"
                  >
                    <span className="text-gray-700">
                      Examen #{result.exam_id} - <strong>{result.score}%</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      {result.has_report && (
                        <span className="text-blue-600" title="Tiene reporte">
                          <FileText className="w-4 h-4" />
                        </span>
                      )}
                      {result.has_certificate && (
                        <span className="text-purple-600" title="Tiene certificado">
                          <Award className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Certificados CONOCER */}
          {(candidate.conocer_certificates ?? []).length > 0 && (
            <div className="mt-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Certificados CONOCER:</h5>
              <div className="space-y-2">
                {(candidate.conocer_certificates ?? []).map((cert) => (
                  <div
                    key={cert.id}
                    className="flex items-center justify-between text-sm p-2 bg-emerald-50 rounded-lg"
                  >
                    <div>
                      <span className="font-medium text-emerald-700">{cert.standard_code}</span>
                      <span className="text-gray-600 ml-2">{cert.certificate_number}</span>
                    </div>
                    <span className="text-gray-500 text-xs">
                      {cert.issue_date ? new Date(cert.issue_date).toLocaleDateString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
