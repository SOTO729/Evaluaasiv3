/**
 * Detalle de Plantel (Campus) con Ciclos Escolares y Grupos
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin,
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  Plus,
  ChevronRight,
  ChevronDown,
  Trash2,
  Users,
  Layers,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
  GraduationCap,
  Clock,
  CalendarRange,
  BookOpen,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getCampus,
  getSchoolCycles,
  createSchoolCycle,
  deleteSchoolCycle,
  deleteGroup,
  getGroups,
  Campus,
  SchoolCycle,
  CandidateGroup,
} from '../../services/partnersService';

export default function CampusDetailPage() {
  const { campusId } = useParams();
  
  const [campus, setCampus] = useState<Campus | null>(null);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [legacyGroups, setLegacyGroups] = useState<CandidateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCycles, setExpandedCycles] = useState<Set<number>>(new Set());
  const [showNewCycleModal, setShowNewCycleModal] = useState(false);
  const [newCycleForm, setNewCycleForm] = useState({
    name: '',
    cycle_type: 'annual' as 'annual' | 'semester',
    start_date: '',
    end_date: '',
    is_current: false,
  });
  const [isCreatingCycle, setIsCreatingCycle] = useState(false);
  const [cyclesAvailable, setCyclesAvailable] = useState(true);

  useEffect(() => {
    loadData();
  }, [campusId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Primero cargar el campus
      const campusData = await getCampus(Number(campusId));
      setCampus(campusData);
      
      // Intentar cargar ciclos (puede fallar si el backend no tiene el endpoint)
      try {
        const cyclesData = await getSchoolCycles(Number(campusId), { active_only: false });
        setCycles(cyclesData.cycles);
        setCyclesAvailable(true);
        
        // Expandir el ciclo actual por defecto
        const currentCycle = cyclesData.cycles.find(c => c.is_current);
        if (currentCycle) {
          setExpandedCycles(new Set([currentCycle.id]));
        } else if (cyclesData.cycles.length > 0) {
          setExpandedCycles(new Set([cyclesData.cycles[0].id]));
        }
      } catch {
        // Si falla, mostrar grupos sin ciclos (compatibilidad hacia atrás)
        setCyclesAvailable(false);
        setCycles([]);
        // Cargar grupos directamente del campus
        try {
          const groupsData = await getGroups(Number(campusId));
          setLegacyGroups(groupsData.groups);
        } catch {
          // Si también falla, usar los grupos del campus si están disponibles
          setLegacyGroups(campusData.groups || []);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el plantel');
    } finally {
      setLoading(false);
    }
  };

  const toggleCycleExpanded = (cycleId: number) => {
    setExpandedCycles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cycleId)) {
        newSet.delete(cycleId);
      } else {
        newSet.add(cycleId);
      }
      return newSet;
    });
  };

  const handleCreateCycle = async () => {
    if (!newCycleForm.name || !newCycleForm.start_date || !newCycleForm.end_date) {
      return;
    }
    
    try {
      setIsCreatingCycle(true);
      const newCycle = await createSchoolCycle(Number(campusId), newCycleForm);
      setCycles(prev => [newCycle, ...prev]);
      setExpandedCycles(prev => new Set([...prev, newCycle.id]));
      setShowNewCycleModal(false);
      setNewCycleForm({
        name: '',
        cycle_type: 'annual',
        start_date: '',
        end_date: '',
        is_current: false,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear el ciclo escolar');
    } finally {
      setIsCreatingCycle(false);
    }
  };

  const handleDeleteCycle = async (cycleId: number) => {
    if (!confirm('¿Estás seguro de desactivar este ciclo escolar?')) return;
    
    try {
      await deleteSchoolCycle(cycleId);
      setCycles(prev => prev.map(c => 
        c.id === cycleId ? { ...c, is_active: false, is_current: false } : c
      ));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al desactivar el ciclo');
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('¿Estás seguro de desactivar este grupo?')) return;
    
    try {
      await deleteGroup(groupId);
      setCycles(prev => prev.map(c => ({
        ...c,
        groups: c.groups?.map(g => 
          g.id === groupId ? { ...g, is_active: false } : g
        )
      })));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al desactivar el grupo');
    }
  };

  // Obtener grupos sin ciclo asignado
  const orphanGroups = campus?.groups?.filter(g => !g.school_cycle_id) || [];

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando plantel..." />
      </div>
    );
  }

  if (error || !campus) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700 fluid-text-base">{error || 'Plantel no encontrado'}</p>
          <Link to="/partners" className="ml-auto text-red-700 underline fluid-text-base">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-5 fluid-mb-6">
        <div className="flex items-center fluid-gap-5">
          <Link
            to={`/partners/${campus.partner_id}`}
            className="fluid-p-2 hover:bg-gray-100 rounded-fluid-xl transition-colors"
          >
            <ArrowLeft className="fluid-icon-lg text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center fluid-gap-2 fluid-text-base text-gray-500 mb-1">
              <Building2 className="fluid-icon-sm" />
              <Link to={`/partners/${campus.partner_id}`} className="hover:text-blue-600 transition-colors">
                {campus.partner?.name}
              </Link>
            </div>
            <div className="flex items-center fluid-gap-2">
              <h1 className="fluid-text-3xl font-bold text-gray-800">
                {campus.name}
              </h1>
              {campus.code && (
                <span className="fluid-px-2 fluid-py-1 bg-gray-100 text-gray-600 rounded-lg fluid-text-base font-mono">
                  {campus.code}
                </span>
              )}
              {campus.is_active ? (
                <span className="inline-flex items-center gap-1 fluid-text-xs font-medium text-green-700 bg-green-50 fluid-px-2 fluid-py-1 rounded-full">
                  <CheckCircle2 className="fluid-icon-xs" />
                  Activo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 fluid-text-xs font-medium text-gray-600 bg-gray-100 fluid-px-2 fluid-py-1 rounded-full">
                  <XCircle className="fluid-icon-xs" />
                  Inactivo
                </span>
              )}
            </div>
          </div>
        </div>
        
        <Link
          to={`/partners/campuses/${campusId}/edit`}
          className="inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl font-medium fluid-text-base transition-colors"
        >
          <Edit className="fluid-icon-sm" />
          Editar Plantel
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 fluid-gap-6">
        {/* Información del Campus - Columna izquierda */}
        <div className="lg:col-span-1 flex flex-col fluid-gap-5">
          {/* Ubicación */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center gap-2">
              <MapPin className="fluid-icon-lg text-emerald-600" />
              Ubicación
            </h2>
            <div className="flex flex-col fluid-gap-3">
              <div>
                <p className="fluid-text-xs text-gray-500">Estado</p>
                <p className="fluid-text-base font-medium text-gray-900">{campus.state_name}</p>
              </div>
              {campus.city && (
                <div>
                  <p className="fluid-text-xs text-gray-500">Ciudad</p>
                  <p className="fluid-text-base text-gray-900">{campus.city}</p>
                </div>
              )}
              {campus.address && (
                <div>
                  <p className="fluid-text-xs text-gray-500">Dirección</p>
                  <p className="fluid-text-base text-gray-900">{campus.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Contacto */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4">
              Contacto
            </h2>
            <div className="flex flex-col fluid-gap-3">
              {campus.email && (
                <div className="flex items-center fluid-gap-2">
                  <Mail className="fluid-icon-sm text-gray-400" />
                  <a href={`mailto:${campus.email}`} className="fluid-text-base text-blue-600 hover:underline">
                    {campus.email}
                  </a>
                </div>
              )}
              {campus.phone && (
                <div className="flex items-center fluid-gap-2">
                  <Phone className="fluid-icon-sm text-gray-400" />
                  <span className="fluid-text-base text-gray-900">{campus.phone}</span>
                </div>
              )}
              {campus.director_name && (
                <div className="pt-2 border-t">
                  <p className="fluid-text-xs text-gray-500 mb-1">Director</p>
                  <p className="fluid-text-base font-medium text-gray-900">{campus.director_name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Estadísticas */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4">
              Resumen
            </h2>
            <div className="flex flex-col fluid-gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center fluid-gap-2">
                  <CalendarRange className="fluid-icon-sm text-blue-600" />
                  <span className="fluid-text-base text-gray-600">Ciclos escolares</span>
                </div>
                <span className="fluid-text-lg font-semibold text-gray-900">
                  {cycles.filter(c => c.is_active).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center fluid-gap-2">
                  <Layers className="fluid-icon-sm text-amber-600" />
                  <span className="fluid-text-base text-gray-600">Grupos totales</span>
                </div>
                <span className="fluid-text-lg font-semibold text-gray-900">
                  {cycles.reduce((acc, c) => acc + (c.groups?.length || 0), 0) + orphanGroups.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center fluid-gap-2">
                  <Users className="fluid-icon-sm text-purple-600" />
                  <span className="fluid-text-base text-gray-600">Candidatos totales</span>
                </div>
                <span className="fluid-text-lg font-semibold text-gray-900">
                  {cycles.reduce((acc, c) => acc + (c.groups?.reduce((a, g) => a + (g.member_count || 0), 0) || 0), 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Ciclos Escolares y Grupos - Columna derecha */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            {cyclesAvailable ? (
              <>
                <div className="flex items-center justify-between fluid-mb-5">
                  <h2 className="fluid-text-xl font-semibold text-gray-800 flex items-center fluid-gap-2">
                    <GraduationCap className="fluid-icon-lg text-blue-600" />
                    Ciclos Escolares
                  </h2>
                  <button
                    onClick={() => setShowNewCycleModal(true)}
                    className="inline-flex items-center gap-2 fluid-px-3 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg fluid-text-base font-medium transition-colors"
                  >
                    <Plus className="fluid-icon-sm" />
                    Nuevo Ciclo
                  </button>
                </div>

                {cycles.length === 0 && orphanGroups.length === 0 ? (
                  <div className="text-center fluid-py-10">
                    <GraduationCap className="fluid-icon-2xl text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 fluid-text-base mb-4">
                      No hay ciclos escolares registrados
                    </p>
                    <button
                      onClick={() => setShowNewCycleModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg fluid-text-base font-medium transition-colors"
                    >
                      <Plus className="fluid-icon-sm" />
                      Crear Primer Ciclo
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col fluid-gap-4">
                    {/* Ciclos escolares */}
                    {cycles.map((cycle) => (
                      <div
                        key={cycle.id}
                        className={`border-2 rounded-xl overflow-hidden transition-all ${
                      cycle.is_current
                        ? 'border-blue-300 bg-blue-50/30'
                        : cycle.is_active
                        ? 'border-gray-200'
                        : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    {/* Header del ciclo */}
                    <div
                      className={`flex items-center justify-between fluid-p-4 cursor-pointer ${
                        cycle.is_current ? 'bg-blue-50' : 'bg-gray-50'
                      }`}
                      onClick={() => toggleCycleExpanded(cycle.id)}
                    >
                      <div className="flex items-center fluid-gap-3">
                        <button className="p-1">
                          {expandedCycles.has(cycle.id) ? (
                            <ChevronDown className="fluid-icon-lg text-gray-500" />
                          ) : (
                            <ChevronRight className="fluid-icon-lg text-gray-500" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center fluid-gap-2">
                            <h3 className="font-semibold fluid-text-lg text-gray-900">
                              {cycle.name}
                            </h3>
                            <span className={`px-2 py-0.5 rounded fluid-text-xs font-medium ${
                              cycle.cycle_type === 'annual'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {cycle.cycle_type === 'annual' ? 'Anual' : 'Semestral'}
                            </span>
                            {cycle.is_current && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded fluid-text-xs font-medium">
                                Actual
                              </span>
                            )}
                            {!cycle.is_active && (
                              <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded fluid-text-xs">
                                Inactivo
                              </span>
                            )}
                          </div>
                          <div className="flex items-center fluid-gap-4 fluid-text-sm text-gray-600 mt-1">
                            <div className="flex items-center fluid-gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {new Date(cycle.start_date).toLocaleDateString('es-MX')} - {new Date(cycle.end_date).toLocaleDateString('es-MX')}
                              </span>
                            </div>
                            <div className="flex items-center fluid-gap-1">
                              <Layers className="w-4 h-4" />
                              <span>{cycle.groups?.length || 0} grupos</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center fluid-gap-2" onClick={e => e.stopPropagation()}>
                        <Link
                          to={`/partners/campuses/${campusId}/groups/new?cycle=${cycle.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg fluid-text-sm font-medium transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Grupo
                        </Link>
                        {cycle.is_active && (
                          <button
                            onClick={() => handleDeleteCycle(cycle.id)}
                            className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                          >
                            <Trash2 className="fluid-icon-sm" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Grupos del ciclo */}
                    {expandedCycles.has(cycle.id) && (
                      <div className="fluid-p-4 border-t">
                        {(!cycle.groups || cycle.groups.length === 0) ? (
                          <div className="text-center fluid-py-6 text-gray-500">
                            <Layers className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="fluid-text-sm">No hay grupos en este ciclo</p>
                            <Link
                              to={`/partners/campuses/${campusId}/groups/new?cycle=${cycle.id}`}
                              className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg fluid-text-sm font-medium transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                              Crear Grupo
                            </Link>
                          </div>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2">
                            {cycle.groups.map((group) => (
                              <GroupCard
                                key={group.id}
                                group={group}
                                onDelete={handleDeleteGroup}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Grupos sin ciclo asignado */}
                {orphanGroups.length > 0 && (
                  <div className="border-2 border-dashed border-amber-300 rounded-xl overflow-hidden bg-amber-50/30">
                    <div className="flex items-center justify-between fluid-p-4 bg-amber-50">
                      <div className="flex items-center fluid-gap-3">
                        <AlertCircle className="fluid-icon-lg text-amber-600" />
                        <div>
                          <h3 className="font-semibold fluid-text-lg text-gray-900">
                            Grupos sin ciclo asignado
                          </h3>
                          <p className="fluid-text-sm text-gray-600">
                            Estos grupos necesitan ser asignados a un ciclo escolar
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="fluid-p-4 border-t border-amber-200">
                      <div className="grid gap-3 md:grid-cols-2">
                        {orphanGroups.map((group) => (
                          <GroupCard
                            key={group.id}
                            group={group}
                            onDelete={handleDeleteGroup}
                            showCycleWarning
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
              </>
            ) : (
              /* Vista legacy: grupos sin ciclos (cuando el backend no soporta ciclos aún) */
              <>
                <div className="flex items-center justify-between fluid-mb-5">
                  <h2 className="fluid-text-xl font-semibold text-gray-800 flex items-center fluid-gap-2">
                    <Layers className="fluid-icon-lg text-amber-600" />
                    Grupos
                  </h2>
                  <Link
                    to={`/partners/campuses/${campusId}/groups/new`}
                    className="inline-flex items-center gap-2 fluid-px-3 fluid-py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg fluid-text-base font-medium transition-colors"
                  >
                    <Plus className="fluid-icon-sm" />
                    Nuevo Grupo
                  </Link>
                </div>

                {legacyGroups.length === 0 ? (
                  <div className="text-center fluid-py-10">
                    <Layers className="fluid-icon-2xl text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 fluid-text-base mb-4">
                      No hay grupos registrados en este plantel
                    </p>
                    <Link
                      to={`/partners/campuses/${campusId}/groups/new`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg fluid-text-base font-medium transition-colors"
                    >
                      <Plus className="fluid-icon-sm" />
                      Crear Primer Grupo
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {legacyGroups.filter(g => g.is_active).map((group) => (
                      <GroupCard
                        key={group.id}
                        group={group}
                        onDelete={handleDeleteGroup}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal para crear ciclo escolar */}
      {showNewCycleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="fluid-p-5 border-b">
              <h3 className="fluid-text-xl font-semibold text-gray-900 flex items-center gap-2">
                <CalendarRange className="fluid-icon-lg text-blue-600" />
                Nuevo Ciclo Escolar
              </h3>
            </div>
            
            <div className="fluid-p-5 space-y-4">
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 mb-1">
                  Nombre del ciclo *
                </label>
                <input
                  type="text"
                  value={newCycleForm.name}
                  onChange={(e) => setNewCycleForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: 2026-2027, Semestre 1 2026"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 mb-1">
                  Tipo de ciclo *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={newCycleForm.cycle_type === 'annual'}
                      onChange={() => setNewCycleForm(prev => ({ ...prev, cycle_type: 'annual' }))}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4 text-green-600" />
                      Anual
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={newCycleForm.cycle_type === 'semester'}
                      onChange={() => setNewCycleForm(prev => ({ ...prev, cycle_type: 'semester' }))}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-purple-600" />
                      Semestral
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 mb-1">
                    Fecha de inicio *
                  </label>
                  <input
                    type="date"
                    value={newCycleForm.start_date}
                    onChange={(e) => setNewCycleForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 mb-1">
                    Fecha de fin *
                  </label>
                  <input
                    type="date"
                    value={newCycleForm.end_date}
                    onChange={(e) => setNewCycleForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCycleForm.is_current}
                  onChange={(e) => setNewCycleForm(prev => ({ ...prev, is_current: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="fluid-text-sm text-gray-700">
                  Marcar como ciclo actual
                </span>
              </label>
            </div>

            <div className="fluid-p-5 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowNewCycleModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCycle}
                disabled={isCreatingCycle || !newCycleForm.name || !newCycleForm.start_date || !newCycleForm.end_date}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreatingCycle ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Crear Ciclo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para tarjeta de grupo
function GroupCard({ 
  group, 
  onDelete,
  showCycleWarning = false 
}: { 
  group: CandidateGroup; 
  onDelete: (id: number) => void;
  showCycleWarning?: boolean;
}) {
  return (
    <div
      className={`border rounded-lg fluid-p-3 transition-all ${
        group.is_active 
          ? 'border-gray-200 hover:border-amber-300 hover:shadow-md bg-white' 
          : 'border-gray-100 bg-gray-50 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center fluid-gap-2 mb-1">
            <h4 className="font-semibold fluid-text-sm text-gray-900 truncate">
              {group.name}
            </h4>
            {group.code && (
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded fluid-text-xs font-mono">
                {group.code}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 fluid-text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-purple-500" />
              <span>{group.member_count || 0}/{group.max_members}</span>
            </div>
            {showCycleWarning && (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Sin ciclo
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 ml-2">
          <Link
            to={`/partners/groups/${group.id}`}
            className="p-1.5 hover:bg-amber-50 rounded text-amber-600 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
          {group.is_active && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(group.id);
              }}
              className="p-1.5 hover:bg-red-50 rounded text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
