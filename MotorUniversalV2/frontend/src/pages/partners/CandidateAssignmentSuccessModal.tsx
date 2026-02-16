/**
 * Modal que muestra el resumen después de asignar candidatos a un grupo,
 * ya sea por búsqueda/selección individual o por carga masiva Excel.
 * Diseño consistente con AssignmentSuccessModal del flujo de exámenes.
 */
import { useState, useMemo } from 'react';
import {
  CheckCircle2, X, Search, ArrowUpDown, ArrowUp, ArrowDown,
  Users, AlertCircle, ArrowLeft, UserPlus, XCircle,
} from 'lucide-react';

interface CandidateRow {
  user_name: string;
  email: string;
  curp: string;
  status: 'added' | 'already' | 'error';
  detail: string;
}

interface SortConfig {
  key: string;
  dir: 'asc' | 'desc';
}

// For search & select flow
export interface AddedCandidateInfo {
  user_id: string;
  full_name: string;
  email: string;
  curp?: string;
}

// For bulk (Excel) flow
export interface BulkUploadResult {
  added: string[];
  errors: Array<{ identifier: string; error: string }>;
  total_processed: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  groupName: string;
  /** Search & select: info about added candidates */
  addedCandidates?: AddedCandidateInfo[];
  /** Search & select: errors */
  addErrors?: Array<{ user_id: string; error: string }>;
  /** Number of auto-assigned exams (search & select) */
  autoAssignedExams?: number;
  /** Bulk (Excel) result */
  bulkResult?: BulkUploadResult;
  /** Candidate info map (from Excel preview) for enriching bulk rows */
  candidateInfoMap?: Map<string, { full_name: string; email: string; curp?: string }>;
  /** Bulk by criteria result */
  criteriaResult?: { added: number; skipped: number; total_matched: number };
  /** Navigate back to group */
  onNavigateToGroup: () => void;
}

export default function CandidateAssignmentSuccessModal({
  open, onClose, groupName,
  addedCandidates, addErrors,
  autoAssignedExams,
  bulkResult, candidateInfoMap,
  criteriaResult,
  onNavigateToGroup,
}: Props) {
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'added' | 'errors'>('added');

  // Build unified rows
  const allRows = useMemo((): CandidateRow[] => {
    const rows: CandidateRow[] = [];

    if (criteriaResult) {
      // Criteria-based bulk: no individual detail, just summary
      return rows;
    }

    if (bulkResult) {
      // Excel bulk mode
      for (const userId of bulkResult.added) {
        const info = candidateInfoMap?.get(userId);
        rows.push({
          user_name: info?.full_name || userId,
          email: info?.email || '-',
          curp: info?.curp || '-',
          status: 'added',
          detail: 'Agregado exitosamente',
        });
      }
      for (const err of bulkResult.errors) {
        rows.push({
          user_name: err.identifier,
          email: '-',
          curp: '-',
          status: 'error',
          detail: err.error,
        });
      }
    } else if (addedCandidates) {
      // Search & select mode
      for (const c of addedCandidates) {
        rows.push({
          user_name: c.full_name,
          email: c.email || '-',
          curp: c.curp || '-',
          status: 'added',
          detail: 'Agregado exitosamente',
        });
      }
      if (addErrors) {
        for (const e of addErrors) {
          rows.push({
            user_name: e.user_id,
            email: '-',
            curp: '-',
            status: 'error',
            detail: e.error,
          });
        }
      }
    }

    return rows;
  }, [bulkResult, candidateInfoMap, addedCandidates, addErrors, criteriaResult]);

  // Tab filter
  const tabFilteredRows = useMemo(() => {
    if (activeTab === 'added') return allRows.filter(r => r.status === 'added');
    return allRows.filter(r => r.status === 'error');
  }, [allRows, activeTab]);

  // Search filter
  const filteredRows = useMemo(() => {
    if (!search) return tabFilteredRows;
    const q = search.toLowerCase();
    return tabFilteredRows.filter(r =>
      r.user_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.curp.toLowerCase().includes(q) ||
      r.detail.toLowerCase().includes(q)
    );
  }, [tabFilteredRows, search]);

  // Sort
  const sortedRows = useMemo(() => {
    if (!sortConfig) return filteredRows;
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      const aVal = (a as any)[sortConfig.key] || '';
      const bVal = (b as any)[sortConfig.key] || '';
      return sortConfig.dir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return sorted;
  }, [filteredRows, sortConfig]);

  const toggleSort = (key: string) => {
    setSortConfig(prev =>
      prev?.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="inline fluid-icon-xs ml-1 text-gray-400" />;
    return sortConfig.dir === 'asc' ? <ArrowUp className="inline fluid-icon-xs ml-1" /> : <ArrowDown className="inline fluid-icon-xs ml-1" />;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'added':
        return <span className="inline-flex items-center fluid-gap-1 px-2 py-0.5 rounded-full fluid-text-xs font-medium bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3" />Agregado</span>;
      case 'already':
        return <span className="inline-flex items-center fluid-gap-1 px-2 py-0.5 rounded-full fluid-text-xs font-medium bg-amber-100 text-amber-800"><AlertCircle className="w-3 h-3" />Ya miembro</span>;
      case 'error':
        return <span className="inline-flex items-center fluid-gap-1 px-2 py-0.5 rounded-full fluid-text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3" />Error</span>;
      default:
        return null;
    }
  };

  // Counts
  const addedCount = criteriaResult
    ? criteriaResult.added
    : allRows.filter(r => r.status === 'added').length;
  const errorCount = criteriaResult
    ? 0
    : allRows.filter(r => r.status === 'error').length;
  const skippedCount = criteriaResult?.skipped || 0;

  if (!open) return null;

  const isCriteriaOnly = !!criteriaResult;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={`relative bg-white rounded-fluid-2xl shadow-2xl w-full ${isCriteriaOnly ? 'max-w-xl' : 'max-w-[95vw] xl:max-w-6xl'} max-h-[90vh] flex flex-col animate-fade-in-up`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 rounded-t-fluid-2xl fluid-p-5 text-white flex items-start justify-between flex-shrink-0">
          <div className="flex items-center fluid-gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <UserPlus className="fluid-icon-lg" />
            </div>
            <div>
              <h2 className="fluid-text-xl font-bold">Candidatos Asignados</h2>
              <p className="fluid-text-sm text-white/80 mt-1">
                Grupo: {groupName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-fluid-xl transition-colors flex-shrink-0">
            <X className="fluid-icon-base" />
          </button>
        </div>

        {/* Summary cards */}
        <div className="fluid-px-5 fluid-py-4 border-b border-gray-200 flex-shrink-0">
          <div className={`grid ${isCriteriaOnly ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'} fluid-gap-3`}>
            <div className="bg-green-50 border border-green-200 rounded-fluid-xl fluid-p-3 text-center">
              <p className="fluid-text-2xl font-bold text-green-700">{addedCount}</p>
              <p className="fluid-text-xs text-green-600 font-medium">Candidatos agregados</p>
            </div>
            {autoAssignedExams && autoAssignedExams > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-fluid-xl fluid-p-3 text-center">
                <p className="fluid-text-2xl font-bold text-blue-700">{autoAssignedExams}</p>
                <p className="fluid-text-xs text-blue-600 font-medium">Certificaciones asignadas</p>
              </div>
            )}
            {skippedCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-fluid-xl fluid-p-3 text-center">
                <p className="fluid-text-2xl font-bold text-amber-700">{skippedCount}</p>
                <p className="fluid-text-xs text-amber-600 font-medium">Ya eran miembros</p>
              </div>
            )}
            {errorCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-3 text-center">
                <p className="fluid-text-2xl font-bold text-red-700">{errorCount}</p>
                <p className="fluid-text-xs text-red-600 font-medium">Errores</p>
              </div>
            )}
            {!isCriteriaOnly && (
              <div className="bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-p-3 text-center">
                <p className="fluid-text-2xl font-bold text-gray-700">{allRows.length}</p>
                <p className="fluid-text-xs text-gray-600 font-medium">Total procesados</p>
              </div>
            )}
          </div>
        </div>

        {/* Table section (only when there are rows to show) */}
        {!isCriteriaOnly && allRows.length > 0 && (
          <>
            {/* Tabs + Search */}
            <div className="fluid-px-5 fluid-pt-4 flex-shrink-0">
              {errorCount > 0 && (
                <div className="flex fluid-gap-1 fluid-mb-3 bg-gray-100 rounded-fluid-xl p-1 w-fit">
                  <button onClick={() => setActiveTab('added')}
                    className={`fluid-px-4 fluid-py-2 rounded-fluid-lg fluid-text-sm font-medium transition-all ${activeTab === 'added' ? 'bg-white shadow-sm text-green-700' : 'text-gray-600 hover:text-gray-900'}`}>
                    Agregados ({addedCount})
                  </button>
                  <button onClick={() => setActiveTab('errors')}
                    className={`fluid-px-4 fluid-py-2 rounded-fluid-lg fluid-text-sm font-medium transition-all ${activeTab === 'errors' ? 'bg-white shadow-sm text-red-700' : 'text-gray-600 hover:text-gray-900'}`}>
                    Errores ({errorCount})
                  </button>
                </div>
              )}

              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 fluid-icon-sm" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, email, CURP..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-10 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="fluid-icon-sm" />
                  </button>
                )}
              </div>
              <p className="fluid-text-xs text-gray-400 mt-2">
                {filteredRows.length === tabFilteredRows.length
                  ? `${tabFilteredRows.length} registro(s)`
                  : `${filteredRows.length} de ${tabFilteredRows.length} registro(s)`}
              </p>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto fluid-px-5 fluid-py-3">
              <div className="border border-gray-200 rounded-fluid-xl overflow-hidden">
                <table className="w-full fluid-text-sm min-w-[600px]">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th onClick={() => toggleSort('user_name')} className="text-left fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">
                        Candidato<SortIcon column="user_name" />
                      </th>
                      <th onClick={() => toggleSort('email')} className="text-left fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">
                        Email<SortIcon column="email" />
                      </th>
                      <th onClick={() => toggleSort('curp')} className="text-left fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">
                        CURP<SortIcon column="curp" />
                      </th>
                      <th onClick={() => toggleSort('status')} className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">
                        Estado<SortIcon column="status" />
                      </th>
                      <th onClick={() => toggleSort('detail')} className="text-left fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">
                        Detalle<SortIcon column="detail" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedRows.map((row, i) => (
                      <tr key={i} className={`transition-colors ${
                        row.status === 'added' ? 'hover:bg-green-50/40' :
                        row.status === 'already' ? 'hover:bg-amber-50/40' :
                        'hover:bg-red-50/40'
                      }`}>
                        <td className="fluid-px-4 fluid-py-2.5 font-medium text-gray-900 whitespace-nowrap">{row.user_name}</td>
                        <td className="fluid-px-4 fluid-py-2.5 text-gray-600">{row.email}</td>
                        <td className="fluid-px-4 fluid-py-2.5 text-gray-500 font-mono text-xs">{row.curp}</td>
                        <td className="fluid-px-4 fluid-py-2.5 text-center"><StatusBadge status={row.status} /></td>
                        <td className="fluid-px-4 fluid-py-2.5 text-gray-500 fluid-text-xs max-w-[250px] truncate" title={row.detail}>{row.detail}</td>
                      </tr>
                    ))}
                    {sortedRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="fluid-px-4 fluid-py-8 text-center text-gray-400 fluid-text-sm">
                          {search ? 'Sin resultados para la búsqueda' : 'No hay registros'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="fluid-px-6 fluid-py-5 border-t-2 border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0 rounded-b-fluid-2xl">
          <p className="fluid-text-base text-gray-600 flex items-center fluid-gap-2 font-medium">
            <Users className="fluid-icon-base text-green-600" />
            {addedCount} candidato(s) agregado(s) exitosamente
          </p>
          <button
            onClick={onNavigateToGroup}
            className="fluid-px-8 fluid-py-3 bg-blue-600 text-white rounded-fluid-xl hover:bg-blue-700 hover:shadow-xl flex items-center fluid-gap-3 font-semibold shadow-lg transition-all fluid-text-base"
          >
            <ArrowLeft className="fluid-icon-base" />
            Volver al Grupo
          </button>
        </div>
      </div>
    </div>
  );
}
