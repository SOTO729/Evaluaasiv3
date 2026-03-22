/**
 * Módulo de Reportes — Admin / Coordinador / Responsable
 *
 * Diseño:
 * 1. Selector de columnas: el usuario elige qué datos incluir en el reporte
 * 2. Filtros opcionales para acotar la población
 * 3. Vista previa: tabla con los 5 registros más recientes + indicador "..."
 * 4. Exportar a Excel con solo las columnas seleccionadas
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  FileSpreadsheet,
  BarChart3,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Minus,
  Eye,
  Columns3,
  Check,
  MoreHorizontal,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getReportFilters,
  getReports,
  exportReports,
  ReportFiltersData,
  ReportRow,
} from '../../services/partnersService';
import { useAuthStore } from '../../store/authStore';

interface Props {
  backPath?: string;
}

/* ───────── Catálogo de columnas disponibles (5 categorías) ───────── */

interface ColumnDef {
  key: string;
  label: string;
  group: string;          // Categoría: Usuario, Organización, Estándar, Resultado, Certificación
  defaultOn?: boolean;
  render?: (row: ReportRow) => React.ReactNode;
}

const GENDER_MAP: Record<string, string> = { M: 'Masculino', F: 'Femenino', O: 'Otro' };
const ROLE_MAP: Record<string, string> = { candidato: 'Candidato', responsable: 'Responsable' };
const STATUS_MAP: Record<string, string> = { active: 'Activo', inactive: 'Inactivo', completed: 'Completado', withdrawn: 'Retirado' };
const SOURCE_MAP: Record<string, string> = { bulk: 'Asignación masiva', selected: 'Selección individual' };

const ALL_COLUMNS: ColumnDef[] = [
  // ── Usuario ──
  { key: 'full_name', label: 'Nombre Completo', group: 'Usuario', defaultOn: true },
  { key: 'name', label: 'Nombre(s)', group: 'Usuario' },
  { key: 'first_surname', label: 'Apellido Paterno', group: 'Usuario' },
  { key: 'second_surname', label: 'Apellido Materno', group: 'Usuario' },
  { key: 'username', label: 'Usuario', group: 'Usuario', defaultOn: true },
  { key: 'email', label: 'Email', group: 'Usuario' },
  { key: 'curp', label: 'CURP', group: 'Usuario' },
  { key: 'gender', label: 'Género', group: 'Usuario', render: (r) => GENDER_MAP[r.gender || ''] || r.gender || '—' },
  { key: 'phone', label: 'Teléfono', group: 'Usuario' },
  { key: 'date_of_birth', label: 'Fecha de Nacimiento', group: 'Usuario' },
  { key: 'role', label: 'Tipo de usuario', group: 'Usuario', render: (r) => ROLE_MAP[r.role] || r.role },
  { key: 'is_active', label: 'Activo', group: 'Usuario', render: (r) => r.is_active ? 'Sí' : 'No' },
  { key: 'curp_verified', label: 'CURP Verificada', group: 'Usuario', render: (r) => r.curp_verified ? 'Sí' : 'No' },
  { key: 'last_login', label: 'Último Login', group: 'Usuario' },
  { key: 'created_at', label: 'Fecha de Registro', group: 'Usuario' },
  // ── Organización ──
  { key: 'partner_name', label: 'Partner', group: 'Organización', defaultOn: true },
  { key: 'campus_code', label: 'Clave Plantel', group: 'Organización' },
  { key: 'campus_name', label: 'Plantel', group: 'Organización', defaultOn: true },
  { key: 'campus_state', label: 'Estado (entidad)', group: 'Organización' },
  { key: 'campus_city', label: 'Ciudad', group: 'Organización' },
  { key: 'director_name', label: 'Director del Plantel', group: 'Organización' },
  { key: 'school_cycle', label: 'Ciclo Escolar', group: 'Organización' },
  { key: 'cycle_start_date', label: 'Inicio Ciclo', group: 'Organización' },
  { key: 'cycle_end_date', label: 'Fin Ciclo', group: 'Organización' },
  { key: 'group_name', label: 'Grupo', group: 'Organización', defaultOn: true },
  { key: 'member_status', label: 'Estado en Grupo', group: 'Organización', render: (r) => STATUS_MAP[r.member_status || ''] || r.member_status || '—' },
  { key: 'joined_at', label: 'Fecha de Ingreso al Grupo', group: 'Organización' },
  { key: 'max_retakes', label: 'Máx. Retomas', group: 'Organización' },
  { key: 'certification_cost', label: 'Costo Certificación', group: 'Organización' },
  // ── Estándar ──
  { key: 'standard_code', label: 'Estándar (Código)', group: 'Estándar', defaultOn: true },
  { key: 'standard_name', label: 'Estándar (Nombre)', group: 'Estándar' },
  { key: 'standard_level', label: 'Nivel del Estándar', group: 'Estándar' },
  { key: 'standard_sector', label: 'Sector del Estándar', group: 'Estándar' },
  { key: 'validity_years', label: 'Vigencia Estándar (años)', group: 'Estándar' },
  { key: 'brand_name', label: 'Marca / Producto', group: 'Estándar' },
  { key: 'assignment_number', label: 'No. Asignación', group: 'Estándar' },
  { key: 'assignment_source', label: 'Origen Asignación', group: 'Estándar', render: (r) => SOURCE_MAP[r.assignment_source || ''] || r.assignment_source || '—' },
  { key: 'exam_name', label: 'Examen', group: 'Estándar' },
  { key: 'assigned_at', label: 'Fecha de Asignación', group: 'Estándar' },
  // ── Resultado ──
  { key: 'score', label: 'Calificación (%)', group: 'Resultado', defaultOn: true },
  { key: 'result', label: 'Resultado', group: 'Resultado', defaultOn: true,
    render: (r) => r.result === 'Aprobado' ? (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3" />Certificado</span>
    ) : r.result === 'Reprobado' ? (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800"><XCircle className="w-3 h-3" />No cert.</span>
    ) : <span className="text-gray-400 text-[10px]">{r.result || '—'}</span>
  },
  { key: 'result_date', label: 'Fecha Evaluación', group: 'Resultado' },
  { key: 'duration_seconds', label: 'Duración (seg)', group: 'Resultado' },
  // ── Certificación ──
  { key: 'certificate_code', label: 'Código Certificado', group: 'Certificación' },
  { key: 'eduit_certificate_code', label: 'Código Certificado Eduit', group: 'Certificación' },
  { key: 'tramite_status', label: 'Trámite CONOCER', group: 'Certificación' },
  { key: 'expires_at', label: 'Vigencia', group: 'Certificación' },
];

/* Mapa de grupo visual → clave de categoría para el backend */
const GROUP_TO_CATEGORY: Record<string, string> = {
  'Usuario': 'usuario',
  'Organización': 'organizacion',
  'Estándar': 'estandar',
  'Resultado': 'resultado',
  'Certificación': 'certificacion',
};

const DEPTH_LABELS: Record<string, string> = {
  'usuario': '1 fila por usuario',
  'organizacion': '1 fila por usuario × membresía de grupo',
  'estandar': '1 fila por usuario × grupo × asignación de estándar',
  'resultado': '1 fila por usuario × grupo × asignación × intento de evaluación',
  'certificacion': '1 fila por usuario × grupo × asignación (con datos de certificado)',
};

const COLUMN_GROUPS = [...new Set(ALL_COLUMNS.map(c => c.group))];
const DEFAULT_SELECTED = ALL_COLUMNS.filter(c => c.defaultOn).map(c => c.key);

export default function ReportsPage({ backPath = '/partners' }: Props) {
  const { user } = useAuthStore();
  const isResponsable = user?.role === 'responsable';

  // Columnas visibles según rol (certification_cost solo para coordinadores)
  const visibleColumns = useMemo(() =>
    ALL_COLUMNS.filter(c => !(c.key === 'certification_cost' && isResponsable)),
    [isResponsable]
  );

  // ── Column selection ──
  const [selectedCols, setSelectedCols] = useState<string[]>(() => [...DEFAULT_SELECTED]);
  const [showOrder, setShowOrder] = useState(false);

  // ── Filters ──
  const [filtersData, setFiltersData] = useState<ReportFiltersData | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const [campusId, setCampusId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [standardId, setStandardId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // ── Preview data ──
  const [previewRows, setPreviewRows] = useState<ReportRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Load filter options
  useEffect(() => {
    (async () => {
      try {
        const data = await getReportFilters();
        setFiltersData(data);
      } catch { /* ignore */ } finally {
        setFiltersLoading(false);
      }
    })();
  }, []);

  // Cascading filter options
  const filteredCampuses = useMemo(() => {
    if (!filtersData) return [];
    if (partnerId) return filtersData.campuses.filter(c => c.partner_id === Number(partnerId));
    return filtersData.campuses;
  }, [filtersData, partnerId]);

  const filteredCycles = useMemo(() => {
    if (!filtersData) return [];
    if (campusId) return filtersData.school_cycles.filter(c => c.campus_id === Number(campusId));
    if (partnerId) {
      const ids = new Set(filteredCampuses.map(c => c.id));
      return filtersData.school_cycles.filter(c => ids.has(c.campus_id));
    }
    return filtersData.school_cycles;
  }, [filtersData, campusId, partnerId, filteredCampuses]);

  const filteredGroups = useMemo(() => {
    if (!filtersData) return [];
    let g = filtersData.groups;
    if (campusId) g = g.filter(x => x.campus_id === Number(campusId));
    else if (partnerId) {
      const ids = new Set(filteredCampuses.map(c => c.id));
      g = g.filter(x => ids.has(x.campus_id));
    }
    if (cycleId) g = g.filter(x => x.school_cycle_id === Number(cycleId));
    return g;
  }, [filtersData, campusId, partnerId, cycleId, filteredCampuses]);

  const activeCols = useMemo(() => {
    const colMap = new Map(visibleColumns.map(c => [c.key, c]));
    return selectedCols.map(k => colMap.get(k)).filter((c): c is ColumnDef => !!c);
  }, [selectedCols, visibleColumns]);

  // Derivar categorías activas desde las columnas seleccionadas
  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    cats.add('usuario');
    for (const col of visibleColumns) {
      if (selectedCols.includes(col.key) && GROUP_TO_CATEGORY[col.group]) {
        cats.add(GROUP_TO_CATEGORY[col.group]);
      }
    }
    return cats;
  }, [selectedCols, visibleColumns]);

  const hasUserCols = useMemo(() => {
    return visibleColumns.some(c => c.group === 'Usuario' && selectedCols.includes(c.key));
  }, [selectedCols, visibleColumns]);

  // Determinar el nivel de profundidad más alto
  const depthLabel = useMemo(() => {
    if (activeCategories.has('resultado')) return DEPTH_LABELS['resultado'];
    if (activeCategories.has('certificacion')) return DEPTH_LABELS['certificacion'];
    if (activeCategories.has('estandar')) return DEPTH_LABELS['estandar'];
    if (activeCategories.has('organizacion')) return DEPTH_LABELS['organizacion'];
    return DEPTH_LABELS['usuario'];
  }, [activeCategories]);

  const toggleCol = (key: string) => {
    setSelectedCols(prev => {
      const idx = prev.indexOf(key);
      if (idx >= 0) {
        // Prevent deselecting the last Usuario column
        const col = visibleColumns.find(c => c.key === key);
        if (col?.group === 'Usuario') {
          const otherUserSelected = visibleColumns.some(c => c.group === 'Usuario' && c.key !== key && prev.includes(c.key));
          if (!otherUserSelected) return prev;
        }
        return prev.filter((_, i) => i !== idx);
      }
      return [...prev, key];
    });
  };

  const toggleGroup = (group: string) => {
    const keys = visibleColumns.filter(c => c.group === group).map(c => c.key);
    const allSelected = keys.every(k => selectedCols.includes(k));
    setSelectedCols(prev => {
      if (allSelected && group === 'Usuario') {
        return prev.filter(k => !keys.includes(k) || k === 'full_name');
      }
      if (allSelected) {
        return prev.filter(k => !keys.includes(k));
      }
      const toAdd = keys.filter(k => !prev.includes(k));
      return [...prev, ...toAdd];
    });
  };

  const selectAll = () => setSelectedCols(visibleColumns.map(c => c.key));
  const selectNone = () => setSelectedCols(['full_name']);

  const moveCol = (index: number, direction: 'up' | 'down') => {
    setSelectedCols(prev => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const buildParams = useCallback(() => {
    const params: Record<string, string | number | undefined> = {};
    params.categories = Array.from(activeCategories).join(',');
    if (partnerId) params.partner_id = Number(partnerId);
    if (campusId) params.campus_id = Number(campusId);
    if (cycleId) params.school_cycle_id = Number(cycleId);
    if (groupId) params.group_id = Number(groupId);
    if (standardId) params.standard_id = Number(standardId);
    if (brandId) params.brand_id = Number(brandId);
    if (resultFilter) params.result = resultFilter;
    if (roleFilter) params.role = roleFilter;
    if (isActiveFilter) params.is_active = isActiveFilter;
    if (search) params.search = search;
    return params;
  }, [activeCategories, partnerId, campusId, cycleId, groupId, standardId, brandId, resultFilter, roleFilter, isActiveFilter, search]);

  const handleGenerate = useCallback(async () => {
    if (!hasUserCols) {
      setError('Selecciona al menos una columna de Usuario para el reporte.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const params = buildParams();
      params.page = 1;
      params.per_page = 5;
      const data = await getReports(params);
      setPreviewRows(data.rows);
      setTotalRows(data.total);
      setHasGenerated(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  }, [buildParams, hasUserCols]);

  const handleExport = async () => {
    if (!hasUserCols) { setError('Selecciona al menos una columna de Usuario.'); return; }
    try {
      setExporting(true);
      setError(null);
      const params = buildParams();
      const blob = await exportReports(params, selectedCols);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      setError('Error al exportar el reporte.');
    } finally {
      setExporting(false);
    }
  };

  const handleClearFilters = () => {
    setPartnerId(''); setCampusId(''); setCycleId(''); setGroupId('');
    setStandardId(''); setBrandId(''); setResultFilter('');
    setRoleFilter(''); setIsActiveFilter('');
    setSearchInput(''); setSearch('');
  };

  const getCellValue = (row: ReportRow, col: ColumnDef): React.ReactNode => {
    if (col.render) return col.render(row);
    const val = (row as any)[col.key];
    if (val === null || val === undefined || val === '') return <span className="text-gray-300">—</span>;
    if (typeof val === 'boolean') return val ? 'Sí' : 'No';
    return String(val);
  };

  const activeFilterCount = [partnerId, campusId, cycleId, groupId, standardId, brandId, resultFilter, roleFilter, isActiveFilter, search].filter(Boolean).length;

  if (filtersLoading) return <LoadingSpinner message="Cargando módulo de reportes..." />;

  return (
    <div className="space-y-4">
      {/* ══ Header ══ */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-fluid-2xl shadow-lg fluid-p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to={backPath} className="p-2 hover:bg-white/10 rounded-fluid-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="fluid-text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="fluid-icon-lg" /> Generador de Reportes
              </h1>
              <p className="fluid-text-sm text-white/80 mt-1">
                Elige las columnas que quieres incluir, previsualiza y exporta a Excel
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-white/20 fluid-px-3 fluid-py-1.5 rounded-fluid-lg fluid-text-sm font-medium">
              {selectedCols.length} columna{selectedCols.length !== 1 ? 's' : ''}
            </span>
            {hasGenerated && totalRows > 0 && (
              <span className="bg-white/20 fluid-px-3 fluid-py-1.5 rounded-fluid-lg fluid-text-sm font-medium">
                {totalRows.toLocaleString()} registro{totalRows !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ══ Step 1: Selector de Columnas ══ */}
      <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="fluid-px-5 fluid-py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Columns3 className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-gray-900 fluid-text-base">1. Selecciona las columnas del reporte</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={selectAll} className="fluid-text-xs text-indigo-600 hover:underline font-medium">Todas</button>
            <span className="text-gray-300">|</span>
            <button onClick={selectNone} className="fluid-text-xs text-gray-500 hover:underline font-medium">Ninguna</button>
          </div>
        </div>

        <div className="fluid-p-5 space-y-4">
          {COLUMN_GROUPS.map(group => {
            const cols = visibleColumns.filter(c => c.group === group);
            const allSel = cols.every(c => selectedCols.includes(c.key));
            const someSel = cols.some(c => selectedCols.includes(c.key));
            return (
              <div key={group}>
                <button
                  onClick={() => toggleGroup(group)}
                  className="flex items-center gap-2 mb-2 group"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${allSel ? 'bg-indigo-600 border-indigo-600' : someSel ? 'bg-indigo-200 border-indigo-400' : 'border-gray-300 group-hover:border-indigo-400'}`}>
                    {allSel && <Check className="w-3 h-3 text-white" />}
                    {someSel && !allSel && <Minus className="w-2.5 h-2.5 text-indigo-600" />}
                  </div>
                  <span className="font-semibold text-gray-700 fluid-text-sm">{group}</span>
                  <span className="text-[10px] text-gray-400">({cols.filter(c => selectedCols.includes(c.key)).length}/{cols.length})</span>
                </button>
                <div className="flex flex-wrap gap-2 ml-6">
                  {cols.map(col => {
                    const active = selectedCols.includes(col.key);
                    return (
                      <button
                        key={col.key}
                        onClick={() => toggleCol(col.key)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full fluid-text-xs font-medium border transition-all ${
                          active
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        }`}
                      >
                        {active && <Check className="w-3 h-3" />}
                        {col.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ Step 1b: Orden de Columnas (botones ↑↓) ══ */}
      {selectedCols.length > 1 && (
        <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowOrder(!showOrder)}
            className="w-full fluid-px-5 fluid-py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-indigo-600" />
              <h2 className="font-semibold text-gray-900 fluid-text-sm">Orden de columnas</h2>
              <span className="text-[10px] text-gray-400">Usa las flechas para reordenar</span>
            </div>
            {showOrder ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showOrder && (
            <div className="fluid-px-5 fluid-pb-4 border-t border-gray-100 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-80 overflow-y-auto">
                {selectedCols.map((key, idx) => {
                  const col = visibleColumns.find(c => c.key === key);
                  if (!col) return null;
                  return (
                    <div key={key} className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg shadow-sm">
                      <span className="text-gray-400 text-[10px] font-mono w-5 text-right">{idx + 1}</span>
                      <span className="text-xs text-gray-700 truncate flex-1 ml-1">{col.label}</span>
                      <button
                        onClick={() => moveCol(idx, 'up')}
                        disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed text-gray-500 hover:text-indigo-600"
                        aria-label={`Mover ${col.label} arriba`}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => moveCol(idx, 'down')}
                        disabled={idx === selectedCols.length - 1}
                        className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed text-gray-500 hover:text-indigo-600"
                        aria-label={`Mover ${col.label} abajo`}
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Step 2: Filtros (colapsable) ══ */}
      <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full fluid-px-5 fluid-py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-gray-900 fluid-text-base">2. Filtros opcionales</h2>
            {activeFilterCount > 0 && (
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{activeFilterCount} activo{activeFilterCount !== 1 ? 's' : ''}</span>
            )}
          </div>
          {showFilters ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {showFilters && (
          <div className="fluid-px-5 fluid-pb-5 space-y-3 border-t border-gray-100 pt-4">
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <div className="flex-1 min-w-[200px] max-w-md relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, email, CURP..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput); }}
                  onBlur={() => setSearch(searchInput)}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Partner */}
              {!isResponsable && filtersData && filtersData.partners.length > 0 && (
                <select value={partnerId} onChange={e => { setPartnerId(e.target.value); setCampusId(''); setCycleId(''); setGroupId(''); }} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[160px] focus:ring-2 focus:ring-indigo-500">
                  <option value="">Todos los partners</option>
                  {filtersData.partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}

              {/* Campus */}
              <select value={campusId} onChange={e => { setCampusId(e.target.value); setCycleId(''); setGroupId(''); }} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[160px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Todos los planteles</option>
                {filteredCampuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              {/* Cycle */}
              {filteredCycles.length > 0 && (
                <select value={cycleId} onChange={e => setCycleId(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[140px] focus:ring-2 focus:ring-indigo-500">
                  <option value="">Todos los ciclos</option>
                  {filteredCycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}

              {/* Group */}
              <select value={groupId} onChange={e => setGroupId(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[140px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Todos los grupos</option>
                {filteredGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* Standard */}
              <select value={standardId} onChange={e => setStandardId(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[200px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Todos los estándares</option>
                {filtersData?.standards.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </select>

              {/* Brand */}
              <select value={brandId} onChange={e => setBrandId(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[140px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Todas las marcas</option>
                {filtersData?.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              {/* Result */}
              <select value={resultFilter} onChange={e => setResultFilter(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[140px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Todos los resultados</option>
                <option value="approved">Aprobado (Certificado)</option>
                <option value="rejected">Reprobado (No certificado)</option>
              </select>

              {/* Role */}
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[130px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Tipo de usuario</option>
                <option value="candidato">Candidato</option>
                <option value="responsable">Responsable</option>
              </select>

              {/* Active */}
              <select value={isActiveFilter} onChange={e => setIsActiveFilter(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[110px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Estado</option>
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </div>

            {activeFilterCount > 0 && (
              <button onClick={handleClearFilters} className="inline-flex items-center gap-1.5 fluid-text-xs text-red-500 hover:text-red-700">
                <X className="w-3.5 h-3.5" /> Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* ══ Step 3: Actions ══ */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={loading || !hasUserCols}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-fluid-xl font-semibold fluid-text-sm shadow-md transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          Previsualizar Reporte
        </button>
        <button
          onClick={handleExport}
          disabled={exporting || !hasUserCols}
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-fluid-xl font-semibold fluid-text-sm shadow-md transition-all disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Descargar Excel
        </button>
        {!hasUserCols && (
          <p className="fluid-text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Selecciona al menos una columna de Usuario
          </p>
        )}
        {hasUserCols && depthLabel && (
          <p className="fluid-text-xs text-indigo-600 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> {depthLabel}
          </p>
        )}
      </div>

      {/* ══ Error ══ */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 fluid-text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ══ Preview Table ══ */}
      {!hasGenerated ? (
        <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm fluid-p-12 text-center">
          <FileSpreadsheet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="fluid-text-lg font-semibold text-gray-700 mb-2">Arma tu reporte</h3>
          <p className="fluid-text-sm text-gray-500 max-w-lg mx-auto">
            Selecciona las columnas que deseas incluir y presiona <strong>"Previsualizar Reporte"</strong> para ver
            cómo quedará. Luego descárgalo en Excel.
          </p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm fluid-p-8">
          <LoadingSpinner message="Generando vista previa..." />
        </div>
      ) : activeCols.length === 0 ? (
        <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm fluid-p-12 text-center">
          <Columns3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="fluid-text-lg font-semibold text-gray-700">Sin columnas seleccionadas</h3>
        </div>
      ) : (
        <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Summary */}
          <div className="fluid-px-5 fluid-py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div>
              <p className="fluid-text-sm text-gray-600">
                <strong>Vista previa</strong> — Mostrando <strong>{previewRows.length}</strong> de <strong>{totalRows.toLocaleString()}</strong> registro{totalRows !== 1 ? 's' : ''}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {activeCols.length} columna{activeCols.length !== 1 ? 's' : ''} seleccionada{activeCols.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-fluid-lg fluid-text-xs font-semibold transition-all disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Descargar Excel ({totalRows.toLocaleString()} filas)
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-indigo-50/80">
                <tr>
                  {activeCols.map(col => (
                    <th key={col.key} className="px-3 py-3 text-left text-[11px] font-bold text-indigo-700 uppercase tracking-wider whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewRows.map((row, idx) => (
                  <tr key={`${row.user_id}-${row.assignment_number}-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                    {activeCols.map(col => (
                      <td key={col.key} className="px-3 py-2.5 fluid-text-xs text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                        {getCellValue(row, col)}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* ── Indicador de que la tabla continúa ── */}
                {totalRows > previewRows.length && (
                  <tr>
                    {activeCols.map(col => (
                      <td key={col.key} className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <MoreHorizontal className="w-4 h-4 text-gray-300" />
                        </div>
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer with continuation indicator */}
          {totalRows > previewRows.length && (
            <div className="fluid-px-5 fluid-py-3 border-t border-gray-200 bg-gray-50/50 text-center">
              <p className="fluid-text-xs text-gray-500">
                <span className="font-medium text-gray-700">{(totalRows - previewRows.length).toLocaleString()}</span> registros más en el reporte completo.
                Descarga el Excel para ver todos los datos.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
