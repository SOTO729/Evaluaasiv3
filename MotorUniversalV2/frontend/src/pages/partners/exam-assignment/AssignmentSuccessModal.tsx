/**
 * Modal que muestra el detalle de todas las asignaciones realizadas
 * después de completar el paso 5 (revisión de costo y confirmación).
 * Soporta tanto asignaciones regulares (all/selected) como bulk.
 */
import { useState, useMemo } from 'react';
import {
  CheckCircle2, X, Search, ArrowUpDown, ArrowUp, ArrowDown,
  Users, AlertCircle, ArrowLeft,
} from 'lucide-react';
import type { NewAssignmentDetail, AlreadyAssignedCandidate } from '../../../services/partnersService';
import type { BulkExamAssignResult } from '../../../services/partnersService';

interface SortConfig {
  key: string;
  dir: 'asc' | 'desc';
}

// Unified row type for the table
interface AssignmentRow {
  user_name: string;
  email: string;
  curp: string;
  assignment_number: string;
  exam_name: string;
  group_name: string;
  status: 'new' | 'already' | 'skipped' | 'error';
  detail: string; // extra info (reason for skipped, error msg, date, etc.)
}

interface Props {
  open: boolean;
  onClose: () => void;
  examName: string;
  groupName: string;
  // Regular assignment data
  newAssignments?: NewAssignmentDetail[];
  alreadyAssigned?: AlreadyAssignedCandidate[];
  // Bulk assignment data
  bulkResult?: BulkExamAssignResult;
  // Navigate callback
  onNavigateToGroup: () => void;
}

export default function AssignmentSuccessModal({
  open, onClose, examName, groupName,
  newAssignments, alreadyAssigned, bulkResult,
  onNavigateToGroup,
}: Props) {
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'assigned' | 'skipped' | 'errors'>('assigned');

  // Build unified rows from either regular or bulk results
  const allRows = useMemo((): AssignmentRow[] => {
    const rows: AssignmentRow[] = [];

    if (bulkResult) {
      // Bulk mode
      for (const a of bulkResult.results.assigned) {
        rows.push({
          user_name: a.user_name || a.username || '-',
          email: a.email || '-',
          curp: a.curp || '-',
          assignment_number: '-',
          exam_name: a.exam_name || examName,
          group_name: groupName,
          status: 'new',
          detail: `Fila ${a.row}`,
        });
      }
      for (const s of bulkResult.results.skipped) {
        rows.push({
          user_name: s.user_name || s.username || '-',
          email: s.email || '-',
          curp: s.curp || '-',
          assignment_number: '-',
          exam_name: examName,
          group_name: groupName,
          status: 'skipped',
          detail: s.reason,
        });
      }
      for (const e of bulkResult.results.errors) {
        rows.push({
          user_name: e.user_name || e.identifier || '-',
          email: '-',
          curp: '-',
          assignment_number: '-',
          exam_name: examName,
          group_name: groupName,
          status: 'error',
          detail: e.error,
        });
      }
    } else {
      // Regular mode
      if (newAssignments) {
        for (const a of newAssignments) {
          rows.push({
            user_name: a.user_name,
            email: a.user_email,
            curp: a.user_curp || '-',
            assignment_number: a.assignment_number,
            exam_name: a.exam_name,
            group_name: a.group_name,
            status: 'new',
            detail: a.assigned_at ? new Date(a.assigned_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
          });
        }
      }
      if (alreadyAssigned) {
        for (const a of alreadyAssigned) {
          rows.push({
            user_name: a.user_name,
            email: a.user_email,
            curp: a.user_curp || '-',
            assignment_number: a.assignment_number,
            exam_name: examName,
            group_name: a.original_group || groupName,
            status: 'already',
            detail: a.assigned_at ? new Date(a.assigned_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Asignación previa',
          });
        }
      }
    }

    return rows;
  }, [bulkResult, newAssignments, alreadyAssigned, examName, groupName]);

  // Filter rows by tab
  const tabFilteredRows = useMemo(() => {
    if (!bulkResult) return allRows; // Regular mode shows all
    switch (activeTab) {
      case 'assigned': return allRows.filter(r => r.status === 'new');
      case 'skipped': return allRows.filter(r => r.status === 'skipped');
      case 'errors': return allRows.filter(r => r.status === 'error');
      default: return allRows;
    }
  }, [allRows, activeTab, bulkResult]);

  // Search filter
  const filteredRows = useMemo(() => {
    if (!search) return tabFilteredRows;
    const q = search.toLowerCase();
    return tabFilteredRows.filter(r =>
      r.user_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.curp.toLowerCase().includes(q) ||
      r.assignment_number.toLowerCase().includes(q) ||
      r.exam_name.toLowerCase().includes(q) ||
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
      case 'new':
        return <span className="inline-flex items-center fluid-gap-1 px-2 py-0.5 rounded-full fluid-text-xs font-medium bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3" />Asignado</span>;
      case 'already':
        return <span className="inline-flex items-center fluid-gap-1 px-2 py-0.5 rounded-full fluid-text-xs font-medium bg-amber-100 text-amber-800"><AlertCircle className="w-3 h-3" />Ya existente</span>;
      case 'skipped':
        return <span className="inline-flex items-center fluid-gap-1 px-2 py-0.5 rounded-full fluid-text-xs font-medium bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3" />Omitido</span>;
      case 'error':
        return <span className="inline-flex items-center fluid-gap-1 px-2 py-0.5 rounded-full fluid-text-xs font-medium bg-red-100 text-red-800"><X className="w-3 h-3" />Error</span>;
      default:
        return null;
    }
  };

  // Summary counts
  const newCount = allRows.filter(r => r.status === 'new').length;
  const alreadyCount = allRows.filter(r => r.status === 'already').length;
  const skippedCount = allRows.filter(r => r.status === 'skipped').length;
  const errorCount = allRows.filter(r => r.status === 'error').length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-fluid-2xl shadow-2xl w-full max-w-[95vw] xl:max-w-7xl max-h-[90vh] flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 rounded-t-fluid-2xl fluid-p-5 text-white flex items-start justify-between flex-shrink-0">
          <div className="flex items-center fluid-gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="fluid-icon-lg" />
            </div>
            <div>
              <h2 className="fluid-text-xl font-bold">Asignación Completada</h2>
              <p className="fluid-text-sm text-white/80 mt-1">
                {examName} — {groupName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-fluid-xl transition-colors flex-shrink-0">
            <X className="fluid-icon-base" />
          </button>
        </div>

        {/* Summary cards */}
        <div className="fluid-px-5 fluid-py-4 border-b border-gray-200 flex-shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 fluid-gap-3">
            <div className="bg-green-50 border border-green-200 rounded-fluid-xl fluid-p-3 text-center">
              <p className="fluid-text-2xl font-bold text-green-700">{newCount}</p>
              <p className="fluid-text-xs text-green-600 font-medium">Nuevas asignaciones</p>
            </div>
            {!bulkResult && alreadyCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-fluid-xl fluid-p-3 text-center">
                <p className="fluid-text-2xl font-bold text-amber-700">{alreadyCount}</p>
                <p className="fluid-text-xs text-amber-600 font-medium">Ya asignados</p>
              </div>
            )}
            {bulkResult && skippedCount > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-fluid-xl fluid-p-3 text-center">
                <p className="fluid-text-2xl font-bold text-yellow-700">{skippedCount}</p>
                <p className="fluid-text-xs text-yellow-600 font-medium">Omitidos</p>
              </div>
            )}
            {bulkResult && errorCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-3 text-center">
                <p className="fluid-text-2xl font-bold text-red-700">{errorCount}</p>
                <p className="fluid-text-xs text-red-600 font-medium">Errores</p>
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-fluid-xl fluid-p-3 text-center">
              <p className="fluid-text-2xl font-bold text-blue-700">{allRows.length}</p>
              <p className="fluid-text-xs text-blue-600 font-medium">Total procesados</p>
            </div>
          </div>
        </div>

        {/* Tabs (bulk only) + Search */}
        <div className="fluid-px-5 fluid-pt-4 flex-shrink-0">
          {bulkResult && (
            <div className="flex fluid-gap-1 fluid-mb-3 bg-gray-100 rounded-fluid-xl p-1 w-fit">
              <button onClick={() => setActiveTab('assigned')}
                className={`fluid-px-4 fluid-py-2 rounded-fluid-lg fluid-text-sm font-medium transition-all ${activeTab === 'assigned' ? 'bg-white shadow-sm text-green-700' : 'text-gray-600 hover:text-gray-900'}`}>
                Asignados ({newCount})
              </button>
              {skippedCount > 0 && (
                <button onClick={() => setActiveTab('skipped')}
                  className={`fluid-px-4 fluid-py-2 rounded-fluid-lg fluid-text-sm font-medium transition-all ${activeTab === 'skipped' ? 'bg-white shadow-sm text-yellow-700' : 'text-gray-600 hover:text-gray-900'}`}>
                  Omitidos ({skippedCount})
                </button>
              )}
              {errorCount > 0 && (
                <button onClick={() => setActiveTab('errors')}
                  className={`fluid-px-4 fluid-py-2 rounded-fluid-lg fluid-text-sm font-medium transition-all ${activeTab === 'errors' ? 'bg-white shadow-sm text-red-700' : 'text-gray-600 hover:text-gray-900'}`}>
                  Errores ({errorCount})
                </button>
              )}
            </div>
          )}

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 fluid-icon-sm" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, CURP, Nº asignación..."
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
            <table className="w-full fluid-text-sm min-w-[800px]">
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
                  <th onClick={() => toggleSort('assignment_number')} className="text-left fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">
                    Nº Asignación<SortIcon column="assignment_number" />
                  </th>
                  <th onClick={() => toggleSort('exam_name')} className="text-left fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">
                    Examen<SortIcon column="exam_name" />
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
                    row.status === 'new' ? 'hover:bg-green-50/40' :
                    row.status === 'already' ? 'hover:bg-amber-50/40' :
                    row.status === 'skipped' ? 'hover:bg-yellow-50/40' :
                    'hover:bg-red-50/40'
                  }`}>
                    <td className="fluid-px-4 fluid-py-2.5 font-medium text-gray-900 whitespace-nowrap">{row.user_name}</td>
                    <td className="fluid-px-4 fluid-py-2.5 text-gray-600">{row.email}</td>
                    <td className="fluid-px-4 fluid-py-2.5 text-gray-500 font-mono text-xs">{row.curp}</td>
                    <td className="fluid-px-4 fluid-py-2.5">
                      {row.assignment_number !== '-' ? (
                        <span className="inline-block bg-blue-100 text-blue-800 font-mono font-semibold fluid-text-xs px-2 py-0.5 rounded-fluid-lg tracking-wider">
                          {row.assignment_number}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="fluid-px-4 fluid-py-2.5 text-gray-700">{row.exam_name}</td>
                    <td className="fluid-px-4 fluid-py-2.5 text-center"><StatusBadge status={row.status} /></td>
                    <td className="fluid-px-4 fluid-py-2.5 text-gray-500 fluid-text-xs max-w-[200px] truncate" title={row.detail}>{row.detail}</td>
                  </tr>
                ))}
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="fluid-px-4 fluid-py-8 text-center text-gray-400 fluid-text-sm">
                      {search ? 'Sin resultados para la búsqueda' : 'No hay registros'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="fluid-px-6 fluid-py-5 border-t-2 border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0 rounded-b-fluid-2xl">
          <p className="fluid-text-base text-gray-600 flex items-center fluid-gap-2 font-medium">
            <Users className="fluid-icon-base text-green-600" />
            {newCount} asignación(es) creada(s) exitosamente
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
