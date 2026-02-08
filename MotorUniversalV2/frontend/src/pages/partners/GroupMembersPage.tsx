/**
 * Página de Candidatos del Grupo
 * Lista completa con filtros, búsqueda y gestión
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  X,
  UserPlus,
  UserMinus,
  ClipboardList,
  BookOpen,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Layers,
  AlertTriangle,
  Award,
  HelpCircle,
  Clock,
  FileText,
  Download,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import {
  getGroup,
  getGroupMembers,
  removeGroupMember,
  exportGroupMembersToExcel,
  CandidateGroup,
  GroupMember,
  EligibilitySummary,
} from '../../services/partnersService';

export default function GroupMembersPage() {
  const { groupId } = useParams();
  const location = useLocation();
  
  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [eligibilitySummary, setEligibilitySummary] = useState<EligibilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  
  // Filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'exam_and_material' | 'exam_only' | 'material_only' | 'none'>('all');
  const [eligibilityFilter, setEligibilityFilter] = useState<'all' | 'missing_curp' | 'missing_email' | 'fully_eligible'>('all');
  
  // Selección múltiple
  const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set());
  
  // Ordenamiento
  type SortField = 'name' | 'email' | 'curp' | 'joined_at' | 'status' | 'certification';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    loadData();
  }, [groupId, location.key]);

  useEffect(() => {
    setSelectedMembers(new Set());
  }, [searchQuery, assignmentFilter, eligibilityFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupData, membersData] = await Promise.all([
        getGroup(Number(groupId)),
        getGroupMembers(Number(groupId)),
      ]);
      setGroup(groupData);
      setMembers(membersData.members);
      setEligibilitySummary(membersData.eligibility_summary || null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los candidatos');
    } finally {
      setLoading(false);
    }
  };

  // Miembros filtrados y ordenados
  const filteredMembers = useMemo(() => {
    let filtered = members.filter(member => {
      if (assignmentFilter !== 'all' && member.assignment_status !== assignmentFilter) {
        return false;
      }
      
      if (eligibilityFilter !== 'all') {
        const hasCurp = member.eligibility?.has_curp ?? !!member.user?.curp;
        const hasEmail = member.eligibility?.has_email ?? !!member.user?.email;
        
        if (eligibilityFilter === 'missing_curp' && hasCurp) return false;
        if (eligibilityFilter === 'missing_email' && hasEmail) return false;
        if (eligibilityFilter === 'fully_eligible' && (!hasCurp || !hasEmail)) return false;
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const fullName = member.user?.full_name?.toLowerCase() || '';
        const email = member.user?.email?.toLowerCase() || '';
        const curp = member.user?.curp?.toLowerCase() || '';
        
        return fullName.includes(query) || email.includes(query) || curp.includes(query);
      }
      
      return true;
    });
    
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = (a.user?.full_name || '').localeCompare(b.user?.full_name || '', 'es');
          break;
        case 'email':
          comparison = (a.user?.email || '').localeCompare(b.user?.email || '', 'es');
          break;
        case 'curp':
          comparison = (a.user?.curp || '').localeCompare(b.user?.curp || '', 'es');
          break;
        case 'joined_at':
          comparison = new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
          break;
        case 'status':
          const statusOrder: Record<string, number> = { 'exam_and_material': 1, 'exam_only': 2, 'material_only': 3, 'none': 4 };
          comparison = (statusOrder[a.assignment_status || 'none'] || 4) - (statusOrder[b.assignment_status || 'none'] || 4);
          break;
        case 'certification':
          const certOrder: Record<string, number> = { 'certified': 1, 'in_progress': 2, 'failed': 3, 'pending': 4 };
          comparison = (certOrder[a.certification_status || 'pending'] || 4) - (certOrder[b.certification_status || 'pending'] || 4);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [members, searchQuery, assignmentFilter, eligibilityFilter, sortField, sortDirection]);
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400" />;
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-3.5 h-3.5 text-purple-600" />
      : <ChevronDown className="w-3.5 h-3.5 text-purple-600" />;
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm('¿Estás seguro de remover este candidato del grupo?')) return;
    
    try {
      await removeGroupMember(Number(groupId), memberId);
      setMembers(members.filter(m => m.id !== memberId));
      setSelectedMembers(prev => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al remover candidato');
    }
  };

  const handleSelectAll = () => {
    if (selectedMembers.size === filteredMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(filteredMembers.map(m => m.id)));
    }
  };

  const handleToggleSelect = (memberId: number) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const blob = await exportGroupMembersToExcel(Number(groupId));
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Candidatos_${group?.name?.replace(/\s+/g, '_') || 'Grupo'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al exportar');
    } finally {
      setExportingExcel(false);
    }
  };

  const stats = {
    total: members.length,
    certified: members.filter(m => m.certification_status === 'certified').length,
    inProgress: members.filter(m => m.certification_status === 'in_progress').length,
  };

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando candidatos..." />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700 fluid-text-base">{error || 'Error al cargar'}</p>
          <Link to={`/partners/groups/${groupId}`} className="ml-auto text-red-700 underline">Volver</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb 
        items={[
          { label: group.campus?.partner?.name || 'Partner', path: `/partners/${group.campus?.partner_id}` },
          { label: group.campus?.name || 'Plantel', path: `/partners/campuses/${group.campus_id}` },
          { label: group.name, path: `/partners/groups/${groupId}` },
          { label: 'Candidatos' }
        ]} 
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <Link
              to={`/partners/groups/${groupId}`}
              className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors"
            >
              <ArrowLeft className="fluid-icon-lg" />
            </Link>
            <div>
              <p className="fluid-text-sm text-white/80 fluid-mb-1">
                {group.name}
              </p>
              <h1 className="fluid-text-2xl font-bold flex items-center fluid-gap-3">
                <Users className="fluid-icon-lg" />
                Candidatos
              </h1>
            </div>
          </div>
          
          <div className="flex items-center fluid-gap-2">
            {members.length > 0 && (
              <button
                onClick={handleExportExcel}
                disabled={exportingExcel}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/10 hover:bg-white/20 text-white rounded-fluid-xl font-medium fluid-text-sm transition-all border border-white/20 disabled:opacity-50"
              >
                {exportingExcel ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Download className="fluid-icon-sm" />
                )}
                Exportar Excel
              </button>
            )}
            {group.is_active && (
              <Link
                to={`/partners/groups/${groupId}/assign-candidates`}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white hover:bg-gray-100 text-purple-600 rounded-fluid-xl font-medium fluid-text-sm transition-all shadow-lg"
              >
                <UserPlus className="fluid-icon-sm" />
                Agregar Candidatos
              </Link>
            )}
          </div>
        </div>

        {/* Stats en header */}
        <div className="grid grid-cols-3 fluid-gap-4 fluid-mt-6">
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{stats.total}</p>
            <p className="fluid-text-xs text-white/70">Total</p>
          </div>
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{stats.certified}</p>
            <p className="fluid-text-xs text-white/70">Certificados</p>
          </div>
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{stats.inProgress}</p>
            <p className="fluid-text-xs text-white/70">En Proceso</p>
          </div>
        </div>
      </div>

      {/* Panel de Elegibilidad */}
      {eligibilitySummary && eligibilitySummary.warnings.length > 0 && (
        <div className="fluid-mb-5 fluid-p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-fluid-xl border border-amber-200">
          <div className="flex items-start fluid-gap-3">
            <div className="fluid-p-2 bg-amber-100 rounded-fluid-lg">
              <AlertTriangle className="fluid-icon-base text-amber-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-amber-800 fluid-mb-2">
                Elegibilidad de Documentos
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 fluid-gap-2 fluid-mb-2">
                <div className="flex items-center fluid-gap-2 fluid-p-2 bg-white/60 rounded-fluid-lg">
                  <CheckCircle2 className="fluid-icon-sm text-emerald-600" />
                  <span className="fluid-text-sm text-gray-700">
                    <strong className="text-emerald-700">{eligibilitySummary.fully_eligible}</strong> completos
                  </span>
                </div>
                {eligibilitySummary.members_without_curp > 0 && (
                  <button
                    onClick={() => setEligibilityFilter('missing_curp')}
                    className="flex items-center fluid-gap-2 fluid-p-2 bg-white/60 rounded-fluid-lg hover:bg-amber-100 transition-colors text-left"
                  >
                    <AlertTriangle className="fluid-icon-sm text-amber-600" />
                    <span className="fluid-text-sm text-gray-700">
                      <strong className="text-amber-700">{eligibilitySummary.members_without_curp}</strong> sin CURP
                    </span>
                  </button>
                )}
                {eligibilitySummary.members_without_email > 0 && (
                  <button
                    onClick={() => setEligibilityFilter('missing_email')}
                    className="flex items-center fluid-gap-2 fluid-p-2 bg-white/60 rounded-fluid-lg hover:bg-amber-100 transition-colors text-left"
                  >
                    <AlertTriangle className="fluid-icon-sm text-amber-600" />
                    <span className="fluid-text-sm text-gray-700">
                      <strong className="text-amber-700">{eligibilitySummary.members_without_email}</strong> sin Email
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: Búsqueda, Filtros */}
      <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 fluid-mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
          <div className="flex flex-col sm:flex-row fluid-gap-3 flex-1">
            {/* Barra de búsqueda */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o CURP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Filtro por asignación */}
            <div className="relative">
              <select
                value={assignmentFilter}
                onChange={(e) => setAssignmentFilter(e.target.value as any)}
                className="appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm bg-white cursor-pointer"
              >
                <option value="all">Todas las asignaciones</option>
                <option value="exam_and_material">✓ Examen y Material</option>
                <option value="exam_only">✓ Solo Examen</option>
                <option value="material_only">✓ Solo Material</option>
                <option value="none">⚠ Sin asignación</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            
            {/* Filtro por elegibilidad */}
            <div className="relative">
              <select
                value={eligibilityFilter}
                onChange={(e) => setEligibilityFilter(e.target.value as any)}
                className="appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm bg-white cursor-pointer"
              >
                <option value="all">Elegibilidad</option>
                <option value="fully_eligible">✓ Datos completos</option>
                <option value="missing_curp">⚠ Sin CURP</option>
                <option value="missing_email">⚠ Sin Email</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Selección activa */}
          {selectedMembers.size > 0 && (
            <div className="flex items-center fluid-gap-2 bg-purple-50 px-3 py-2 rounded-lg border border-purple-200">
              <span className="text-sm font-medium text-purple-700">
                {selectedMembers.size} seleccionado{selectedMembers.size > 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setSelectedMembers(new Set())}
                className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Indicador de filtros */}
        {(searchQuery || assignmentFilter !== 'all' || eligibilityFilter !== 'all') && (
          <div className="flex items-center fluid-gap-2 fluid-mt-4 text-sm border-t border-gray-100 fluid-pt-3">
            <span className="text-gray-500">
              Mostrando {filteredMembers.length} de {members.length} candidatos
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setAssignmentFilter('all');
                setEligibilityFilter('all');
              }}
              className="text-purple-600 hover:text-purple-800 font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Lista de miembros */}
      {members.length === 0 ? (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 text-center fluid-py-12">
          <div className="w-20 h-20 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
            <Users className="w-10 h-10 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aún no hay candidatos</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            Agrega candidatos a este grupo para comenzar
          </p>
          {group.is_active && (
            <Link
              to={`/partners/groups/${groupId}/assign-candidates`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              Agregar Candidatos
            </Link>
          )}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 text-center fluid-py-8">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No se encontraron candidatos con los filtros aplicados</p>
        </div>
      ) : (
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header de tabla */}
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 hidden md:flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div className="w-10">
              <input
                type="checkbox"
                checked={selectedMembers.size === filteredMembers.length && filteredMembers.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
            </div>
            <button 
              onClick={() => handleSort('name')}
              className={`flex-1 flex items-center gap-1.5 hover:text-purple-600 ${sortField === 'name' ? 'text-purple-600' : ''}`}
            >
              Candidato <SortIcon field="name" />
            </button>
            <button 
              onClick={() => handleSort('email')}
              className={`w-48 flex items-center gap-1.5 hover:text-purple-600 ${sortField === 'email' ? 'text-purple-600' : ''}`}
            >
              Email <SortIcon field="email" />
            </button>
            <button 
              onClick={() => handleSort('status')}
              className={`w-32 flex items-center gap-1.5 hover:text-purple-600 ${sortField === 'status' ? 'text-purple-600' : ''}`}
            >
              Asignación <SortIcon field="status" />
            </button>
            <button 
              onClick={() => handleSort('certification')}
              className={`w-32 flex items-center gap-1.5 hover:text-purple-600 ${sortField === 'certification' ? 'text-purple-600' : ''}`}
            >
              Certificación <SortIcon field="certification" />
            </button>
            <div className="w-24 text-center">Elegibilidad</div>
            <div className="w-16 text-center">Acciones</div>
          </div>
          
          {/* Filas */}
          <div className="divide-y divide-gray-100">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className={`flex flex-col md:flex-row md:items-center px-4 py-3 hover:bg-purple-50/50 transition-colors ${
                  selectedMembers.has(member.id) ? 'bg-purple-50' : ''
                }`}
              >
                <div className="w-10 hidden md:block">
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(member.id)}
                    onChange={() => handleToggleSelect(member.id)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                
                <div className="flex-1 flex items-center fluid-gap-3 mb-2 md:mb-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {member.user?.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {member.user?.full_name || 'Usuario desconocido'}
                    </p>
                    <p className="text-xs text-gray-500 md:hidden truncate">
                      {member.user?.email}
                    </p>
                  </div>
                </div>
                
                <div className="w-48 hidden md:block">
                  <p className="text-sm text-gray-600 truncate" title={member.user?.email}>
                    {member.user?.email || '-'}
                  </p>
                </div>
                
                <div className="w-32 hidden md:block">
                  {member.assignment_status === 'exam_and_material' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <Layers className="w-3 h-3" />
                      Completo
                    </span>
                  )}
                  {member.assignment_status === 'exam_only' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      <FileText className="w-3 h-3" />
                      Examen
                    </span>
                  )}
                  {member.assignment_status === 'material_only' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      <BookOpen className="w-3 h-3" />
                      Material
                    </span>
                  )}
                  {(!member.assignment_status || member.assignment_status === 'none') && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                      <AlertTriangle className="w-3 h-3" />
                      Sin asignar
                    </span>
                  )}
                </div>
                
                <div className="w-32 hidden md:block">
                  {member.certification_status === 'certified' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      <Award className="w-3 h-3" />
                      Certificado
                    </span>
                  )}
                  {member.certification_status === 'in_progress' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                      <Clock className="w-3 h-3" />
                      En proceso
                    </span>
                  )}
                  {member.certification_status === 'failed' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                      <XCircle className="w-3 h-3" />
                      No aprobado
                    </span>
                  )}
                  {(!member.certification_status || member.certification_status === 'pending') && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                      <HelpCircle className="w-3 h-3" />
                      Pendiente
                    </span>
                  )}
                </div>
                
                <div className="w-24 hidden md:flex items-center justify-center gap-1">
                  <span 
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600"
                    title="Certificado Eduit: Disponible"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                  <span 
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      member.user?.curp ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                    }`}
                    title={member.user?.curp ? 'CONOCER: Disponible' : 'CONOCER: Requiere CURP'}
                  >
                    {member.user?.curp ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  </span>
                  <span 
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      member.user?.email ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                    }`}
                    title={member.user?.email ? 'Badge: Disponible' : 'Badge: Requiere Email'}
                  >
                    {member.user?.email ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  </span>
                </div>
                
                <div className="w-16 flex justify-center">
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-2 hover:bg-orange-100 rounded-lg text-orange-500 hover:text-orange-600 transition-colors"
                    title="Remover del grupo"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
