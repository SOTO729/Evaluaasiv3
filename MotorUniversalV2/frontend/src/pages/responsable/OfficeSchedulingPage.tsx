import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar, AlertCircle, CheckCircle,
  Loader2, Users, Monitor, Plus, X, FileSpreadsheet, FileText, Presentation, Building2,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import {
  getResponsableGroups,
  getVmSessions,
  createVmSession,
  cancelVmSession,
  bulkCreateSessions,
  getGroupCandidates,
  type VmSession,
  type ResponsableGroup,
  type ResponsableSchoolCycle,
  type GroupCandidate,
} from '../../services/vmSessionsService';

const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const OFFICE_APPS = [
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet, color: 'emerald' },
  { value: 'word', label: 'Word', icon: FileText, color: 'blue' },
  { value: 'powerpoint', label: 'PowerPoint', icon: Presentation, color: 'orange' },
] as const;

const SESSION_TYPES = [
  { value: 'examen', label: 'Examen' },
  { value: 'simulador', label: 'Simulador' },
  { value: 'parcial', label: 'Parcial' },
] as const;

const LEVELS = [
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
] as const;

const PARCIAL_SESSIONS = Array.from({ length: 17 }, (_, i) => ({
  value: String(i + 1),
  label: `Sesión ${i + 1}`,
}));

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseIsoDate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getDateRange(fromIso: string, toIso: string): string[] {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to || from > to) return [];

  const result: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    result.push(fmt(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function weekOf(ref: Date): Date[] {
  const d = new Date(ref);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((day === 0 ? 7 : day) - 1));
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(mon); dd.setDate(mon.getDate() + i); return dd; });
}

function isToday(d: Date) {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

function hourLabel(start: number, end: number) {
  return `${String(start).padStart(2, '0')}:00 – ${String(end).padStart(2, '0')}:00`;
}

type SessionGroup = {
  key: string;
  session_date: string;
  start_hour: number;
  end_hour: number;
  session_type: string;
  office_app: string | null;
  level: string | null;
  parcial_units: string | null;
  is_local: boolean;
  status: string;
  sessions: VmSession[];
};

type SessionGroupFilter = {
  session_date: string;
  start_hour: number;
  end_hour: number;
  session_type: string;
  office_app: string | null;
  level: string | null;
  parcial_units: string | null;
};

export default function OfficeSchedulingPage() {
  const { user } = useAuthStore();
  const isCoordinator = user?.role === 'coordinator';

  // Groups
  const [groups, setGroups] = useState<ResponsableGroup[]>([]);
  const [campusName, setCampusName] = useState('');
  const [campusOptions, setCampusOptions] = useState<{ id: number; name: string }[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<number | null>(null);
  const [schoolCycles, setSchoolCycles] = useState<ResponsableSchoolCycle[]>([]);
  const [selectedSchoolCycleId, setSelectedSchoolCycleId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(true);

  // Calendar
  const [currentDate, setCurrentDate] = useState(new Date());

  // Sessions
  const [sessions, setSessions] = useState<VmSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Candidates
  const [candidates, setCandidates] = useState<GroupCandidate[]>([]);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    schedule_mode: 'single' as 'single' | 'range',
    session_type: 'examen' as string,
    office_app: 'excel' as string,
    level: '' as string,
    date: fmt(new Date()),
    date_to: fmt(new Date()),
    start_hour: 9,
    end_hour: 10,
    parcial_units: [] as string[],
    selectedCandidates: [] as string[],
    selectAll: false,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Cancel
  const [cancelTarget, setCancelTarget] = useState<VmSession | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Cancel batch (entire group block)
  const [cancelBatch, setCancelBatch] = useState<VmSession[] | null>(null);
  const [cancelBatchLoading, setCancelBatchLoading] = useState(false);

  // Group detail modal
  const [detailFilter, setDetailFilter] = useState<SessionGroupFilter | null>(null);
  const [detailSelectedCandidates, setDetailSelectedCandidates] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Selección múltiple de miembros agendados (para edición masiva)
  const [selectedAttendees, setSelectedAttendees] = useState<number[]>([]);

  // Limpiar selección al cerrar el modal de detalle
  useEffect(() => {
    if (!detailFilter) {
      setSelectedAttendees([]);
    }
  }, [detailFilter]);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const weekDays = useMemo(() => weekOf(currentDate), [currentDate]);
  const selectedGroup = useMemo(() => groups.find(g => g.id === selectedGroupId) ?? null, [groups, selectedGroupId]);
  const scheduleDatesPreview = useMemo(() => (
    createForm.schedule_mode === 'single'
      ? [createForm.date]
      : getDateRange(createForm.date, createForm.date_to)
  ), [createForm.schedule_mode, createForm.date, createForm.date_to]);
  const totalSessionsPreview = useMemo(
    () => createForm.selectedCandidates.length * scheduleDatesPreview.length,
    [createForm.selectedCandidates.length, scheduleDatesPreview.length]
  );

  useEffect(() => {
    let mounted = true;
    setGroupsLoading(true);

    (async () => {
      try {
        const res = await getResponsableGroups(
          isCoordinator ? (selectedCampusId || undefined) : undefined,
          selectedSchoolCycleId || undefined
        );
        if (!mounted) return;

        setGroups(res.groups);
        setCampusName(res.campus_name || '');
        setCampusOptions(res.campuses || []);
        setSchoolCycles(res.school_cycles || []);

        if (isCoordinator && !selectedCampusId && res.selected_campus_id) {
          setSelectedCampusId(res.selected_campus_id);
        }

        if (res.selected_school_cycle_id !== undefined) {
          setSelectedSchoolCycleId(res.selected_school_cycle_id ?? null);
        } else if ((res.school_cycles || []).length === 0) {
          setSelectedSchoolCycleId(null);
        }

        if (res.groups.length > 0) {
          setSelectedGroupId(prev => (
            prev && res.groups.some(g => g.id === prev)
              ? prev
              : res.groups[0].id
          ));
        } else {
          setSelectedGroupId(null);
        }
      } catch {
        if (!mounted) return;
        setGroups([]);
        setCampusName('');
        setSchoolCycles([]);
        setSelectedSchoolCycleId(null);
        setSelectedGroupId(null);
      } finally {
        if (mounted) setGroupsLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [isCoordinator, selectedCampusId, selectedSchoolCycleId]);

  useEffect(() => {
    if (!selectedGroupId) return;
    (async () => {
      try {
        const res = await getGroupCandidates(selectedGroupId);
        setCandidates(res.candidates);
      } catch { setCandidates([]); }
    })();
    // Reset level if current group doesn't allow avanzado
    const group = groups.find(g => g.id === selectedGroupId);
    if (group && group.office_exam_level !== 'avanzado') {
      setCreateForm(prev => ({ ...prev, level: prev.level === 'avanzado' ? 'intermedio' : prev.level }));
    }
  }, [selectedGroupId]);

  const loadSessions = useCallback(async () => {
    if (!selectedGroupId) {
      setSessions([]);
      return;
    }
    setSessionsLoading(true);
    try {
      const days = weekOf(currentDate);
      const res = await getVmSessions({
        date_from: fmt(days[0]),
        date_to: fmt(days[6]),
        status: 'all',
      });
      setSessions(res.sessions.filter(s => s.group_id === selectedGroupId && s.is_local));
    } catch { setSessions([]); }
    finally { setSessionsLoading(false); }
  }, [selectedGroupId, currentDate]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };
  const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };
  const goToday = () => setCurrentDate(new Date());

  // Group sessions by date + slot/app/type so each card is a group schedule block
  const sessionGroupsByDate = useMemo(() => {
    const map: Record<string, SessionGroup[]> = {};
    const byKey: Record<string, SessionGroup> = {};

    for (const s of sessions) {
      const endHour = s.end_hour ?? (s.start_hour + 1);
      const key = [
        s.session_date,
        s.start_hour,
        endHour,
        s.session_type,
        s.office_app || '',
        s.level || '',
        s.parcial_units || '',
        s.status,
      ].join('|');

      if (!byKey[key]) {
        byKey[key] = {
          key,
          session_date: s.session_date,
          start_hour: s.start_hour,
          end_hour: endHour,
          session_type: s.session_type,
          office_app: s.office_app,
          level: s.level,
          parcial_units: s.parcial_units,
          is_local: s.is_local,
          status: s.status,
          sessions: [],
        };
      }

      byKey[key].sessions.push(s);
    }

    Object.values(byKey).forEach(group => {
      if (!map[group.session_date]) map[group.session_date] = [];
      map[group.session_date].push(group);
    });

    Object.keys(map).forEach(dateKey => {
      map[dateKey].sort((a, b) => a.start_hour - b.start_hour || a.end_hour - b.end_hour);
    });

    return map;
  }, [sessions]);

  const activeDetailGroup = useMemo(() => {
    if (!detailFilter) return null;

    const matches = sessions.filter(s => {
      const endHour = s.end_hour ?? (s.start_hour + 1);
      return (
        s.session_date === detailFilter.session_date &&
        s.start_hour === detailFilter.start_hour &&
        endHour === detailFilter.end_hour &&
        s.session_type === detailFilter.session_type &&
        (s.office_app || null) === detailFilter.office_app &&
        (s.level || null) === detailFilter.level &&
        (s.parcial_units || null) === detailFilter.parcial_units &&
        s.status === 'scheduled'
      );
    });

    if (matches.length === 0) return null;

    return {
      key: 'active-detail',
      session_date: detailFilter.session_date,
      start_hour: detailFilter.start_hour,
      end_hour: detailFilter.end_hour,
      session_type: detailFilter.session_type,
      office_app: detailFilter.office_app,
      level: detailFilter.level,
      parcial_units: detailFilter.parcial_units,
      is_local: matches[0].is_local,
      status: 'scheduled',
      sessions: matches,
    } as SessionGroup;
  }, [detailFilter, sessions]);

  const candidatesAvailableForDetail = useMemo(() => {
    if (!activeDetailGroup) return [];
    const currentIds = new Set(activeDetailGroup.sessions.map(s => String(s.user_id)));
    return candidates.filter(c => !currentIds.has(String(c.user_id)));
  }, [activeDetailGroup, candidates]);

  // ── Create sessions ──
  const handleCreate = async () => {
    if (createForm.selectedCandidates.length === 0) {
      setCreateError('Selecciona al menos un candidato');
      return;
    }

    const targetDates = createForm.schedule_mode === 'single'
      ? [createForm.date]
      : getDateRange(createForm.date, createForm.date_to);

    if (targetDates.length === 0) {
      setCreateError('El rango de fechas no es válido');
      return;
    }

    if (targetDates.length > 31) {
      setCreateError('El rango máximo permitido es de 31 días');
      return;
    }

    setCreateLoading(true);
    setCreateError('');
    try {
      const parcial_units = createForm.session_type === 'parcial'
        ? createForm.parcial_units.join(',')
        : undefined;

      if (createForm.selectedCandidates.length === 1 && targetDates.length === 1) {
        await createVmSession({
          session_date: targetDates[0],
          start_hour: createForm.start_hour,
          end_hour: createForm.end_hour,
          session_type: createForm.session_type as 'examen' | 'simulador' | 'parcial',
          is_local: true,
          office_app: createForm.office_app,
          level: createForm.level || undefined,
          parcial_units,
          user_id: createForm.selectedCandidates[0],
          notes: `Office local: ${createForm.office_app} ${createForm.session_type}`,
        });
      } else {
        const sessionsPayload = createForm.selectedCandidates.flatMap(uid => (
          targetDates.map(sessionDate => ({
            user_id: uid,
            session_date: sessionDate,
            start_hour: createForm.start_hour,
            notes: `Office local: ${createForm.office_app} ${createForm.session_type}`,
          }))
        ));

        await bulkCreateSessions({
          group_id: selectedGroupId!,
          session_type: createForm.session_type as 'examen' | 'simulador' | 'parcial',
          is_local: true,
          end_hour: createForm.end_hour,
          office_app: createForm.office_app,
          level: createForm.level || undefined,
          parcial_units,
          sessions: sessionsPayload,
        });
      }
      showToast(
        'success',
        `${createForm.selectedCandidates.length * targetDates.length} sesión(es) creada(s)`
      );
      setShowCreateModal(false);
      setCreateForm(prev => ({ ...prev, selectedCandidates: [], selectAll: false }));
      loadSessions();
    } catch (err: any) {
      setCreateError(err?.response?.data?.error || 'Error al crear sesiones');
    } finally { setCreateLoading(false); }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await cancelVmSession(cancelTarget.id);
      setCancelTarget(null);
      showToast('success', 'Sesión cancelada');
      loadSessions();
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Error al cancelar');
    } finally { setCancelLoading(false); }
  };

  const handleCancelBatch = async () => {
    if (!cancelBatch || cancelBatch.length === 0) return;
    setCancelBatchLoading(true);
    try {
      const results = await Promise.allSettled(
        cancelBatch.map(s => cancelVmSession(s.id))
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      const ok = results.length - failed;
      setCancelBatch(null);
      setDetailFilter(null);
      if (failed === 0) {
        showToast('success', `Se quitaron ${ok} sesión(es) del grupo`);
      } else if (ok === 0) {
        showToast('error', `No se pudo quitar ninguna sesión (${failed} fallidas)`);
      } else {
        showToast('error', `Se quitaron ${ok}, ${failed} fallaron`);
      }
      loadSessions();
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Error al quitar sesiones');
    } finally { setCancelBatchLoading(false); }
  };

  const openGroupDetail = (g: SessionGroup) => {
    setDetailFilter({
      session_date: g.session_date,
      start_hour: g.start_hour,
      end_hour: g.end_hour,
      session_type: g.session_type,
      office_app: g.office_app,
      level: g.level,
      parcial_units: g.parcial_units,
    });
    setDetailSelectedCandidates([]);
    setDetailError('');
  };

  const toggleDetailCandidate = (uid: string) => {
    setDetailSelectedCandidates(prev => (
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    ));
  };

  const addCandidatesToDetail = async () => {
    if (!activeDetailGroup || detailSelectedCandidates.length === 0 || !selectedGroupId) {
      return;
    }

    setDetailLoading(true);
    setDetailError('');
    try {
      await bulkCreateSessions({
        group_id: selectedGroupId,
        session_type: activeDetailGroup.session_type as 'examen' | 'simulador' | 'parcial',
        is_local: activeDetailGroup.is_local,
        end_hour: activeDetailGroup.end_hour,
        office_app: activeDetailGroup.office_app || undefined,
        level: activeDetailGroup.level || undefined,
        parcial_units: activeDetailGroup.parcial_units || undefined,
        sessions: detailSelectedCandidates.map(uid => ({
          user_id: uid,
          session_date: activeDetailGroup.session_date,
          start_hour: activeDetailGroup.start_hour,
          notes: `Agregado a agenda de grupo ${selectedGroup?.name || ''}`,
        })),
      });

      setDetailSelectedCandidates([]);
      showToast('success', `Se agregaron ${detailSelectedCandidates.length} miembro(s) a la agenda`);
      loadSessions();
    } catch (err: any) {
      setDetailError(err?.response?.data?.error || 'Error al agregar miembros');
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleCandidate = (uid: string) => {
    setCreateForm(prev => {
      const sel = prev.selectedCandidates.includes(uid)
        ? prev.selectedCandidates.filter(id => id !== uid)
        : [...prev.selectedCandidates, uid];
      return { ...prev, selectedCandidates: sel, selectAll: sel.length === candidates.length };
    });
  };

  const toggleAll = () => {
    setCreateForm(prev => {
      if (prev.selectAll) return { ...prev, selectedCandidates: [], selectAll: false };
      return { ...prev, selectedCandidates: candidates.map(c => c.user_id), selectAll: true };
    });
  };

  const toggleParcialUnit = (unit: string) => {
    setCreateForm(prev => {
      const units = prev.parcial_units.includes(unit)
        ? prev.parcial_units.filter(u => u !== unit)
        : [...prev.parcial_units, unit];
      return { ...prev, parcial_units: units };
    });
  };

  const getAppIcon = (app: string) => {
    const found = OFFICE_APPS.find(a => a.value === app);
    if (!found) return <Monitor className="w-4 h-4" />;
    const Icon = found.icon;
    return <Icon className="w-4 h-4" />;
  };

  const getAppColor = (app: string) => {
    switch (app) {
      case 'excel': return 'emerald';
      case 'word': return 'blue';
      case 'powerpoint': return 'orange';
      default: return 'gray';
    }
  };

  if (groupsLoading) return <div className="fluid-p-6 max-w-[2800px] mx-auto"><LoadingSpinner message="Cargando grupos..." /></div>;

  if (groups.length === 0 && !isCoordinator) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
        <div className="bg-amber-50 border border-amber-200 rounded-fluid-2xl fluid-p-8 text-center max-w-lg mx-auto">
          <AlertCircle className="fluid-icon-xl text-amber-500 mx-auto fluid-mb-4" />
          <h3 className="fluid-text-lg font-bold text-amber-800 fluid-mb-2">Sin grupos habilitados</h3>
          <p className="fluid-text-sm text-amber-600">Ningún grupo de tu plantel tiene sesiones habilitadas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center fluid-gap-2 fluid-px-5 fluid-py-3 rounded-fluid-xl shadow-lg text-white fluid-text-sm font-medium animate-fade-in-up ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-500 rounded-fluid-2xl fluid-p-6 text-white fluid-mb-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between fluid-gap-4">
          <div>
            <h1 className="fluid-text-2xl font-bold flex items-center fluid-gap-2">
              <Monitor className="fluid-icon-lg" />
              Agenda Office Local — {campusName}
            </h1>
            <p className="fluid-text-sm text-white/70 fluid-mt-1">Programa evaluaciones de Office en equipos locales</p>
          </div>
          <div className="flex items-center fluid-gap-3 flex-wrap justify-end">
            {isCoordinator && campusOptions.length > 0 && (
              <>
                <Building2 className="w-5 h-5 text-white/60" />
                <select
                  value={selectedCampusId || ''}
                  onChange={e => {
                    setSelectedCampusId(Number(e.target.value));
                    setSelectedSchoolCycleId(null);
                  }}
                  className="bg-white/15 text-white border border-white/20 rounded-fluid-lg fluid-px-4 fluid-py-2 fluid-text-sm backdrop-blur-sm focus:ring-2 focus:ring-white/30 focus:outline-none appearance-none cursor-pointer"
                  style={{ minWidth: '220px' }}
                >
                  {campusOptions.map(c => (
                    <option key={c.id} value={c.id} className="text-gray-800 bg-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {schoolCycles.length > 0 && (
              <>
                <Calendar className="w-5 h-5 text-white/60" />
                <select
                  value={selectedSchoolCycleId || ''}
                  onChange={e => setSelectedSchoolCycleId(Number(e.target.value))}
                  className="bg-white/15 text-white border border-white/20 rounded-fluid-lg fluid-px-4 fluid-py-2 fluid-text-sm backdrop-blur-sm focus:ring-2 focus:ring-white/30 focus:outline-none appearance-none cursor-pointer"
                  style={{ minWidth: '220px' }}
                >
                  {schoolCycles.map(c => (
                    <option key={c.id} value={c.id} className="text-gray-800 bg-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <Users className="w-5 h-5 text-white/60" />
            <select
              value={selectedGroupId || ''}
              onChange={e => { setSelectedGroupId(Number(e.target.value)); }}
              disabled={groups.length === 0}
              className="bg-white/15 text-white border border-white/20 rounded-fluid-lg fluid-px-4 fluid-py-2 fluid-text-sm backdrop-blur-sm focus:ring-2 focus:ring-white/30 focus:outline-none appearance-none cursor-pointer"
              style={{ minWidth: '220px' }}
            >
              {groups.length === 0 && (
                <option value="" className="text-gray-800 bg-white">Sin grupos habilitados</option>
              )}
              {groups.map(g => (
                <option key={g.id} value={g.id} className="text-gray-800 bg-white">
                  {g.name} ({g.member_count})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="fluid-mt-4 fluid-pt-4 border-t border-white/10 flex flex-wrap items-center fluid-gap-4">
          <div className="bg-white/10 rounded-fluid-xl fluid-py-2 fluid-px-4 text-center backdrop-blur-sm border border-white/5">
            <span className="fluid-text-lg font-bold">{sessions.length}</span>
            <span className="fluid-text-xs text-white/60 ml-2">Sesiones esta semana</span>
          </div>
          <button
            onClick={() => { setShowCreateModal(true); setCreateError(''); }}
            disabled={groups.length === 0}
            className="ml-auto flex items-center fluid-gap-2 bg-white/20 hover:bg-white/30 fluid-px-4 fluid-py-2 rounded-fluid-lg fluid-text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Programar sesión
          </button>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-fluid-xl fluid-p-4 fluid-mb-6">
          <p className="fluid-text-sm text-amber-700">No hay grupos habilitados para el plantel seleccionado.</p>
        </div>
      )}

      {/* Week navigator */}
      <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm fluid-mb-6">
        <div className="flex items-center justify-between fluid-px-5 fluid-py-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-t-fluid-xl">
          <button onClick={prevWeek} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          <div className="flex items-center fluid-gap-3">
            <Calendar className="w-5 h-5 text-white/60" />
            <span className="font-semibold fluid-text-base">
              {weekDays[0].getDate()} {MONTHS_ES[weekDays[0].getMonth()].substring(0, 3)} — {weekDays[6].getDate()} {MONTHS_ES[weekDays[6].getMonth()].substring(0, 3)} {weekDays[6].getFullYear()}
            </span>
            <button onClick={goToday} className="bg-white/20 hover:bg-white/30 fluid-px-2.5 fluid-py-1 rounded-lg fluid-text-xs font-medium transition-colors">Hoy</button>
          </div>
          <button onClick={nextWeek} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button>
        </div>

        {sessionsLoading ? (
          <div className="fluid-p-12 text-center">
            <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="grid grid-cols-7 divide-x divide-gray-100">
            {weekDays.map((day, idx) => {
              const dateStr = fmt(day);
              const daySessions = sessionGroupsByDate[dateStr] || [];
              const today = isToday(day);
              return (
                <div key={idx} className={`min-h-[180px] ${today ? 'bg-teal-50/50' : ''}`}>
                  {/* Day header */}
                  <div className={`text-center fluid-py-2 border-b border-gray-100 ${today ? 'bg-teal-100' : 'bg-gray-50'}`}>
                    <div className="fluid-text-xs font-medium text-gray-500 uppercase">{DAYS_SHORT[day.getDay()]}</div>
                    <div className={`fluid-text-lg font-bold mt-0.5 ${today ? 'text-teal-700' : 'text-gray-800'}`}>{day.getDate()}</div>
                  </div>
                  {/* Group schedule blocks */}
                  <div className="fluid-p-2 space-y-1.5">
                    {daySessions.length === 0 && (
                      <p className="text-[10px] text-gray-300 text-center fluid-py-4">Sin sesiones</p>
                    )}
                    {daySessions.map((groupBlock: SessionGroup) => {
                      const color = getAppColor(groupBlock.office_app || 'gray');
                      const scheduledCount = groupBlock.sessions.filter((s: VmSession) => s.status === 'scheduled').length;
                      return (
                        <div
                          key={groupBlock.key}
                          className={`group relative rounded-lg fluid-p-2 border cursor-pointer transition-all hover:shadow-md
                            ${color === 'emerald' ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300' : ''}
                            ${color === 'blue' ? 'bg-blue-50 border-blue-200 hover:border-blue-300' : ''}
                            ${color === 'orange' ? 'bg-orange-50 border-orange-200 hover:border-orange-300' : ''}
                            ${color === 'gray' ? 'bg-gray-50 border-gray-200' : ''}
                            ${groupBlock.status === 'cancelled' ? 'opacity-50' : ''}
                          `}
                          onClick={() => {
                            if (groupBlock.status === 'scheduled') openGroupDetail(groupBlock);
                          }}
                        >
                          <div className="flex items-center fluid-gap-1 fluid-mb-1">
                            {getAppIcon(groupBlock.office_app || '')}
                            <span className="text-[10px] font-bold uppercase truncate">{groupBlock.office_app}</span>
                          </div>
                          <p className="text-[10px] font-semibold text-gray-700">{hourLabel(groupBlock.start_hour, groupBlock.end_hour)}</p>
                          <p className="text-[9px] text-gray-500">Grupo: {selectedGroup?.name}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[8px] text-gray-400 capitalize">{groupBlock.session_type}{groupBlock.level ? ` · ${groupBlock.level}` : ''}</span>
                            <span className="text-[9px] font-semibold text-gray-600">{scheduledCount} miembro(s)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="fluid-p-6 border-b border-gray-100">
              <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-2">
                <Monitor className="w-5 h-5 text-teal-600" />
                Programar sesión Office local
              </h3>
              <p className="fluid-text-sm text-gray-500 fluid-mt-1">Grupo: {selectedGroup?.name}</p>
            </div>

            <div className="fluid-p-6 space-y-5">
              {createError && (
                <div className="bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-3 fluid-text-sm text-red-700 flex items-center fluid-gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{createError}
                </div>
              )}

              {/* Tipo de evaluación */}
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Tipo de evaluación</label>
                <div className="flex fluid-gap-2">
                  {SESSION_TYPES.map(st => (
                    <button
                      key={st.value}
                      onClick={() => setCreateForm(prev => ({ ...prev, session_type: st.value, parcial_units: [] }))}
                      className={`fluid-px-4 fluid-py-2 rounded-fluid-lg fluid-text-sm font-medium border transition-colors ${
                        createForm.session_type === st.value
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* App de Office */}
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Aplicación</label>
                <div className="flex fluid-gap-2">
                  {OFFICE_APPS.map(app => {
                    const Icon = app.icon;
                    return (
                      <button
                        key={app.value}
                        onClick={() => setCreateForm(prev => ({ ...prev, office_app: app.value }))}
                        className={`flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-fluid-lg fluid-text-sm font-medium border transition-colors ${
                          createForm.office_app === app.value
                            ? `bg-${app.color}-600 text-white border-${app.color}-600`
                            : `bg-white text-gray-600 border-gray-300 hover:border-${app.color}-400`
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {app.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nivel (solo examen/simulador) */}
              {createForm.session_type !== 'parcial' && (
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Nivel</label>
                  <div className="flex fluid-gap-2">
                    {LEVELS.filter(l =>
                      selectedGroup?.office_exam_level === 'avanzado'
                        ? true
                        : l.value !== 'avanzado'
                    ).map(l => (
                      <button
                        key={l.value}
                        onClick={() => setCreateForm(prev => ({ ...prev, level: prev.level === l.value ? '' : l.value }))}
                        className={`fluid-px-4 fluid-py-2 rounded-fluid-lg fluid-text-sm font-medium border transition-colors ${
                          createForm.level === l.value
                            ? 'bg-gray-700 text-white border-gray-700'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                  {selectedGroup?.office_exam_level === 'intermedio' && (
                    <p className="fluid-text-xs text-amber-600 fluid-mt-1">
                      Este grupo solo permite exámenes de nivel intermedio
                    </p>
                  )}
                </div>
              )}

              {/* Sesiones parciales */}
              {createForm.session_type === 'parcial' && (
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                    Unidades de parcial
                    <span className="text-gray-400 font-normal ml-1">(selecciona las sesiones)</span>
                  </label>
                  <div className="flex flex-wrap fluid-gap-1.5">
                    {PARCIAL_SESSIONS.map(ps => (
                      <button
                        key={ps.value}
                        onClick={() => toggleParcialUnit(ps.value)}
                        className={`w-10 h-10 rounded-fluid-lg fluid-text-xs font-bold border transition-colors ${
                          createForm.parcial_units.includes(ps.value)
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
                        }`}
                      >
                        {ps.value}
                      </button>
                    ))}
                  </div>
                  {createForm.parcial_units.length > 0 && (
                    <p className="fluid-text-xs text-teal-600 fluid-mt-1">
                      Sesiones: {createForm.parcial_units.sort((a, b) => Number(a) - Number(b)).join(', ')}
                    </p>
                  )}
                </div>
              )}

              {/* Modalidad de fecha */}
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Programación</label>
                <div className="flex fluid-gap-2">
                  <button
                    onClick={() => setCreateForm(prev => ({ ...prev, schedule_mode: 'single', date_to: prev.date }))}
                    className={`fluid-px-4 fluid-py-2 rounded-fluid-lg fluid-text-sm font-medium border transition-colors ${
                      createForm.schedule_mode === 'single'
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
                    }`}
                  >
                    Fecha única
                  </button>
                  <button
                    onClick={() => setCreateForm(prev => ({ ...prev, schedule_mode: 'range', date_to: prev.date_to || prev.date }))}
                    className={`fluid-px-4 fluid-py-2 rounded-fluid-lg fluid-text-sm font-medium border transition-colors ${
                      createForm.schedule_mode === 'range'
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
                    }`}
                  >
                    Rango de fechas
                  </button>
                </div>
              </div>

              {/* Fecha y hora */}
              <div className={`grid fluid-gap-4 ${createForm.schedule_mode === 'range' ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                    {createForm.schedule_mode === 'range' ? 'Desde' : 'Fecha'}
                  </label>
                  <input
                    type="date"
                    value={createForm.date}
                    min={fmt(new Date())}
                    onChange={e => setCreateForm(prev => ({
                      ...prev,
                      date: e.target.value,
                      date_to: prev.date_to < e.target.value ? e.target.value : prev.date_to,
                    }))}
                    className="w-full border border-gray-300 rounded-fluid-lg fluid-px-3 fluid-py-2 fluid-text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>
                {createForm.schedule_mode === 'range' && (
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Hasta</label>
                    <input
                      type="date"
                      value={createForm.date_to}
                      min={createForm.date}
                      onChange={e => setCreateForm(prev => ({ ...prev, date_to: e.target.value }))}
                      className="w-full border border-gray-300 rounded-fluid-lg fluid-px-3 fluid-py-2 fluid-text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Hora inicio</label>
                  <select
                    value={createForm.start_hour}
                    onChange={e => {
                      const h = Number(e.target.value);
                      setCreateForm(prev => ({ ...prev, start_hour: h, end_hour: Math.max(prev.end_hour, h + 1) }));
                    }}
                    className="w-full border border-gray-300 rounded-fluid-lg fluid-px-3 fluid-py-2 fluid-text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  >
                    {Array.from({ length: 14 }, (_, i) => i + 7).map(h => (
                      <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Hora fin</label>
                  <select
                    value={createForm.end_hour}
                    onChange={e => setCreateForm(prev => ({ ...prev, end_hour: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-fluid-lg fluid-px-3 fluid-py-2 fluid-text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  >
                    {Array.from({ length: 14 }, (_, i) => i + 8).filter(h => h > createForm.start_hour).map(h => (
                      <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Candidatos */}
              <div>
                <div className="flex items-center justify-between fluid-mb-2">
                  <label className="fluid-text-sm font-medium text-gray-700">Candidatos</label>
                  <button onClick={toggleAll} className="fluid-text-xs text-teal-600 hover:text-teal-700 font-medium">
                    {createForm.selectAll ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-fluid-lg divide-y divide-gray-100">
                  {candidates.map(c => (
                    <label key={c.user_id} className="flex items-center fluid-gap-3 fluid-px-3 fluid-py-2 hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={createForm.selectedCandidates.includes(c.user_id)}
                        onChange={() => toggleCandidate(c.user_id)}
                        className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="fluid-text-sm text-gray-700">{c.name}</span>
                    </label>
                  ))}
                </div>
                {createForm.selectedCandidates.length > 0 && (
                  <p className="fluid-text-xs text-teal-600 fluid-mt-1">
                    {createForm.selectedCandidates.length} candidato(s) seleccionado(s)
                  </p>
                )}
              </div>
            </div>

            <div className="fluid-p-6 border-t border-gray-100 flex justify-end fluid-gap-3">
              <button onClick={() => setShowCreateModal(false)} className="fluid-px-4 fluid-py-2 fluid-text-sm text-gray-600 hover:bg-gray-100 rounded-fluid-lg transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={createLoading || createForm.selectedCandidates.length === 0}
                className="fluid-px-4 fluid-py-2 fluid-text-sm bg-teal-600 text-white rounded-fluid-lg hover:bg-teal-700 disabled:opacity-50 flex items-center fluid-gap-2 transition-colors"
              >
                {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Programar {totalSessionsPreview > 0 && `(${totalSessionsPreview} sesiones)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Group Detail Modal (edit members individually) ── */}
      {detailFilter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetailFilter(null)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="fluid-p-6 border-b border-gray-100">
              <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                Detalle de agenda del grupo
              </h3>
              {activeDetailGroup ? (
                <p className="fluid-text-sm text-gray-500 fluid-mt-1">
                  {selectedGroup?.name} · {activeDetailGroup.session_date} · {activeDetailGroup.start_hour}:00–{activeDetailGroup.end_hour}:00 · {activeDetailGroup.office_app} · {activeDetailGroup.session_type}
                </p>
              ) : (
                <p className="fluid-text-sm text-amber-600 fluid-mt-1">Esta agenda ya no tiene sesiones activas.</p>
              )}
            </div>

            <div className="fluid-p-6 space-y-5">
              {detailError && (
                <div className="bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-3 fluid-text-sm text-red-700 flex items-center fluid-gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{detailError}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between fluid-mb-2 flex-wrap fluid-gap-2">
                  <h4 className="fluid-text-sm font-semibold text-gray-700">
                    Miembros agendados
                    {selectedAttendees.length > 0 && (
                      <span className="fluid-ml-2 fluid-text-xs font-medium text-teal-600">
                        ({selectedAttendees.length} seleccionado{selectedAttendees.length === 1 ? '' : 's'})
                      </span>
                    )}
                  </h4>
                  <div className="flex items-center fluid-gap-2">
                    {activeDetailGroup && activeDetailGroup.sessions.length > 0 && (
                      <button
                        onClick={() => {
                          if (selectedAttendees.length === activeDetailGroup.sessions.length) {
                            setSelectedAttendees([]);
                          } else {
                            setSelectedAttendees(activeDetailGroup.sessions.map(s => s.id));
                          }
                        }}
                        className="fluid-px-3 fluid-py-1 text-xs rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                      >
                        {selectedAttendees.length === activeDetailGroup.sessions.length
                          ? 'Deseleccionar todos'
                          : 'Seleccionar todos'}
                      </button>
                    )}
                    {activeDetailGroup && selectedAttendees.length > 0 && (
                      <button
                        onClick={() => {
                          const ids = new Set(selectedAttendees);
                          const subset = activeDetailGroup.sessions.filter(s => ids.has(s.id));
                          if (subset.length > 0) setCancelBatch(subset);
                        }}
                        className="fluid-px-3 fluid-py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center fluid-gap-1"
                      >
                        <X className="w-3 h-3" />
                        Quitar seleccionados ({selectedAttendees.length})
                      </button>
                    )}
                    {activeDetailGroup && activeDetailGroup.sessions.length > 1 && selectedAttendees.length === 0 && (
                      <button
                        onClick={() => setCancelBatch(activeDetailGroup.sessions)}
                        className="fluid-px-3 fluid-py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center fluid-gap-1"
                      >
                        <X className="w-3 h-3" />
                        Quitar todos ({activeDetailGroup.sessions.length})
                      </button>
                    )}
                  </div>
                </div>
                {activeDetailGroup && activeDetailGroup.sessions.length > 0 ? (
                  <div className="border border-gray-200 rounded-fluid-lg divide-y divide-gray-100">
                    {activeDetailGroup.sessions.map(s => {
                      const checked = selectedAttendees.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center justify-between fluid-px-3 fluid-py-2 cursor-pointer transition-colors ${
                            checked ? 'bg-teal-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center fluid-gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAttendees(prev => [...prev, s.id]);
                                } else {
                                  setSelectedAttendees(prev => prev.filter(id => id !== s.id));
                                }
                              }}
                              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="fluid-text-sm text-gray-700 truncate">{(s as any).user_name || s.user?.name || s.user?.email || s.user_id}</p>
                              <p className="text-[11px] text-gray-400">Sesión #{s.id}</p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCancelTarget(s); }}
                            className="fluid-px-3 fluid-py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex-shrink-0"
                          >
                            Quitar
                          </button>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="fluid-text-sm text-gray-500">No hay miembros agendados.</p>
                )}
              </div>

              {activeDetailGroup && (
                <div>
                  <div className="flex items-center justify-between fluid-mb-2">
                    <h4 className="fluid-text-sm font-semibold text-gray-700">Agregar miembros</h4>
                    {candidatesAvailableForDetail.length > 0 && (
                      <button
                        onClick={() => {
                          if (detailSelectedCandidates.length === candidatesAvailableForDetail.length) {
                            setDetailSelectedCandidates([]);
                          } else {
                            setDetailSelectedCandidates(candidatesAvailableForDetail.map(c => c.user_id));
                          }
                        }}
                        className="fluid-text-xs text-teal-600 hover:text-teal-700 font-medium"
                      >
                        {detailSelectedCandidates.length === candidatesAvailableForDetail.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </button>
                    )}
                  </div>

                  {candidatesAvailableForDetail.length === 0 ? (
                    <p className="fluid-text-sm text-gray-500">Todos los miembros del grupo ya están en esta agenda.</p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-fluid-lg divide-y divide-gray-100">
                      {candidatesAvailableForDetail.map(c => (
                        <label key={c.user_id} className="flex items-center fluid-gap-3 fluid-px-3 fluid-py-2 hover:bg-gray-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={detailSelectedCandidates.includes(c.user_id)}
                            onChange={() => toggleDetailCandidate(c.user_id)}
                            className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="fluid-text-sm text-gray-700">{c.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="fluid-p-6 border-t border-gray-100 flex justify-end fluid-gap-3">
              <button onClick={() => setDetailFilter(null)} className="fluid-px-4 fluid-py-2 fluid-text-sm text-gray-600 hover:bg-gray-100 rounded-fluid-lg transition-colors">
                Cerrar
              </button>
              <button
                onClick={addCandidatesToDetail}
                disabled={!activeDetailGroup || detailLoading || detailSelectedCandidates.length === 0}
                className="fluid-px-4 fluid-py-2 fluid-text-sm bg-teal-600 text-white rounded-fluid-lg hover:bg-teal-700 disabled:opacity-50 flex items-center fluid-gap-2 transition-colors"
              >
                {detailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Agregar seleccionados {detailSelectedCandidates.length > 0 ? `(${detailSelectedCandidates.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Batch Modal (todo el grupo) ── */}
      {cancelBatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCancelBatch(null)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="fluid-p-6 border-b border-gray-100">
              <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-2">
                <X className="w-5 h-5 text-red-500" />
                Quitar sesión para todo el grupo
              </h3>
              <p className="fluid-text-sm text-gray-500 fluid-mt-1">
                Se cancelarán {cancelBatch.length} sesión(es) agendadas en este bloque.
              </p>
            </div>
            <div className="fluid-p-6">
              <p className="fluid-text-sm text-gray-600">Esta acción cancelará la sesión para todos los miembros agendados en este horario. ¿Deseas continuar?</p>
            </div>
            <div className="fluid-p-6 border-t border-gray-100 flex justify-end fluid-gap-3">
              <button onClick={() => setCancelBatch(null)} className="fluid-px-4 fluid-py-2 fluid-text-sm text-gray-600 hover:bg-gray-100 rounded-fluid-lg transition-colors">Volver</button>
              <button onClick={handleCancelBatch} disabled={cancelBatchLoading} className="fluid-px-4 fluid-py-2 fluid-text-sm bg-red-600 text-white rounded-fluid-lg hover:bg-red-700 disabled:opacity-50 flex items-center fluid-gap-2 transition-colors">
                {cancelBatchLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Quitar todas ({cancelBatch.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Modal ── */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCancelTarget(null)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="fluid-p-6 border-b border-gray-100">
              <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-2">
                <X className="w-5 h-5 text-red-500" />
                Cancelar sesión
              </h3>
              <p className="fluid-text-sm text-gray-500 fluid-mt-1">
                {cancelTarget.office_app} · {cancelTarget.session_date} · {cancelTarget.start_hour}:00
              </p>
            </div>
            <div className="fluid-p-6">
              <p className="fluid-text-sm text-gray-600">¿Estás seguro de que deseas cancelar esta sesión?</p>
            </div>
            <div className="fluid-p-6 border-t border-gray-100 flex justify-end fluid-gap-3">
              <button onClick={() => setCancelTarget(null)} className="fluid-px-4 fluid-py-2 fluid-text-sm text-gray-600 hover:bg-gray-100 rounded-fluid-lg transition-colors">Volver</button>
              <button onClick={handleCancel} disabled={cancelLoading} className="fluid-px-4 fluid-py-2 fluid-text-sm bg-red-600 text-white rounded-fluid-lg hover:bg-red-700 disabled:opacity-50 flex items-center fluid-gap-2 transition-colors">
                {cancelLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Cancelar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
