import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Clock, Calendar, X, AlertCircle, CheckCircle,
  Loader2, Users, Shuffle, Eye, UserPlus,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getResponsableGroups,
  getAvailableSlots,
  getVmSessions,
  createVmSession,
  cancelVmSession,
  getGroupCandidates,
  autoDistribute,
  bulkCreateSessions,
  type VmSlot,
  type VmSession,
  type ResponsableGroup,
  type GroupCandidate,
  type ProposalItem,
} from '../../services/vmSessionsService';

const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const OPERATING_HOURS = Array.from({ length: 12 }, (_, i) => i + 8);

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekOf(ref: Date): Date[] {
  const d = new Date(ref);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((day === 0 ? 7 : day) - 1));
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(mon); dd.setDate(mon.getDate() + i); return dd; });
}

function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const pad = (first.getDay() + 6) % 7;
  const days: (Date | null)[] = [];
  for (let i = 0; i < pad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

function isToday(d: Date) {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}
function sameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

type SlotMap = Record<string, VmSlot[]>;

export default function MiPlantelSesionesPage() {
  // Groups
  const [groups, setGroups] = useState<ResponsableGroup[]>([]);
  const [campusName, setCampusName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(true);

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Data
  const [weekSlots, setWeekSlots] = useState<SlotMap>({});
  const [sessions, setSessions] = useState<VmSession[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Candidates
  const [candidates, setCandidates] = useState<GroupCandidate[]>([]);

  // Booking (leader assigns)
  const [bookingSlot, setBookingSlot] = useState<{ slot: VmSlot; date: Date } | null>(null);
  const [bookingCandidateId, setBookingCandidateId] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Cancel
  const [cancelTarget, setCancelTarget] = useState<VmSession | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Auto-distribute
  const [proposal, setProposal] = useState<ProposalItem[] | null>(null);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const weekDays = useMemo(() => weekOf(currentDate), [currentDate]);
  const weekKey = useMemo(() => fmt(weekDays[0]), [weekDays]);
  const monthDays = useMemo(() => monthGrid(currentDate.getFullYear(), currentDate.getMonth()), [currentDate]);

  const selectedGroup = useMemo(() => groups.find(g => g.id === selectedGroupId) ?? null, [groups, selectedGroupId]);
  const isLeaderOnly = selectedGroup?.scheduling_mode === 'leader_only';

  // Init: load groups
  useEffect(() => {
    (async () => {
      try {
        const res = await getResponsableGroups();
        setGroups(res.groups);
        setCampusName(res.campus_name);
        if (res.groups.length > 0) setSelectedGroupId(res.groups[0].id);
      } catch { /* ignore */ }
      finally { setGroupsLoading(false); }
    })();
  }, []);

  // Load candidates when group changes
  useEffect(() => {
    if (!selectedGroupId) return;
    (async () => {
      try {
        const res = await getGroupCandidates(selectedGroupId);
        setCandidates(res.candidates);
      } catch { setCandidates([]); }
    })();
  }, [selectedGroupId]);

  // Load week slots
  const loadWeekSlots = useCallback(async () => {
    const days = weekOf(currentDate);
    setSlotsLoading(true);
    try {
      const results: SlotMap = {};
      for (const day of days) {
        const dateStr = fmt(day);
        const res = await getAvailableSlots({ date: dateStr });
        results[dateStr] = res.slots;
      }
      setWeekSlots(results);
    } catch { setWeekSlots({}); }
    finally { setSlotsLoading(false); }
  }, [currentDate, weekKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load group sessions
  const loadSessions = useCallback(async () => {
    if (!selectedGroupId) return;
    try {
      const days = weekOf(currentDate);
      const res = await getVmSessions({
        date_from: fmt(days[0]),
        date_to: fmt(days[6]),
        status: 'scheduled',
      });
      // Filter to this group's sessions
      setSessions(res.sessions.filter(s => s.group_id === selectedGroupId));
    } catch { setSessions([]); }
  }, [selectedGroupId, currentDate, weekKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadWeekSlots(); }, [loadWeekSlots]);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Navigate
  const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };
  const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };
  const goToday = () => { setCurrentDate(new Date()); setSelectedDate(new Date()); };
  const prevMonth = () => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); };
  const nextMonth = () => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); };

  // Slot/session helpers
  const getSlot = (day: Date, hour: number) => weekSlots[fmt(day)]?.find(s => s.hour === hour);
  const getGroupSession = (day: Date, hour: number) =>
    sessions.find(s => s.session_date === fmt(day) && s.start_hour === hour);

  // Book for candidate (leader_only)
  const handleAssign = async () => {
    if (!bookingSlot || !bookingCandidateId) return;
    setBookingLoading(true);
    setBookingError('');
    try {
      await createVmSession({
        session_date: fmt(bookingSlot.date),
        start_hour: bookingSlot.slot.hour,
        user_id: bookingCandidateId,
        notes: `Asignado por responsable`,
      });
      setBookingSlot(null);
      setBookingCandidateId('');
      showToast('success', 'Sesión asignada');
      loadWeekSlots();
      loadSessions();
      // Refresh candidates
      if (selectedGroupId) {
        const res = await getGroupCandidates(selectedGroupId);
        setCandidates(res.candidates);
      }
    } catch (err: any) {
      setBookingError(err?.response?.data?.error || 'Error al asignar');
    } finally { setBookingLoading(false); }
  };

  // Cancel session
  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await cancelVmSession(cancelTarget.id, cancelReason);
      setCancelTarget(null);
      setCancelReason('');
      showToast('success', 'Sesión cancelada');
      loadWeekSlots();
      loadSessions();
      if (selectedGroupId) {
        const res = await getGroupCandidates(selectedGroupId);
        setCandidates(res.candidates);
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Error al cancelar');
    } finally { setCancelLoading(false); }
  };

  // Auto-distribute
  const handleAutoDistribute = async () => {
    if (!selectedGroupId) return;
    setProposalLoading(true);
    try {
      const days = weekOf(currentDate);
      const res = await autoDistribute({
        group_id: selectedGroupId,
        date_from: fmt(days[0]),
        date_to: fmt(days[6]),
      });
      setProposal(res.proposal);
      if (res.proposal.length === 0) showToast('success', 'Todos los candidatos ya tienen sesión');
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Error al generar propuesta');
    } finally { setProposalLoading(false); }
  };

  // Accept proposal
  const handleAcceptProposal = async () => {
    if (!proposal || !selectedGroupId) return;
    const valid = proposal.filter(p => p.session_date && p.start_hour !== null);
    if (valid.length === 0) return;
    setBulkLoading(true);
    try {
      const res = await bulkCreateSessions({
        group_id: selectedGroupId,
        sessions: valid.map(p => ({
          user_id: p.user_id,
          session_date: p.session_date!,
          start_hour: p.start_hour!,
        })),
      });
      showToast('success', res.message);
      setProposal(null);
      loadWeekSlots();
      loadSessions();
      if (selectedGroupId) {
        const r = await getGroupCandidates(selectedGroupId);
        setCandidates(r.candidates);
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Error al crear sesiones');
    } finally { setBulkLoading(false); }
  };

  // Loading
  if (groupsLoading) return <div className="fluid-p-6 max-w-[2800px] mx-auto"><LoadingSpinner message="Cargando grupos..." /></div>;

  if (groups.length === 0) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
        <div className="bg-amber-50 border border-amber-200 rounded-fluid-2xl fluid-p-8 text-center max-w-lg mx-auto">
          <AlertCircle className="fluid-icon-xl text-amber-500 mx-auto fluid-mb-4" />
          <h3 className="fluid-text-lg font-bold text-amber-800 fluid-mb-2">Sin grupos habilitados</h3>
          <p className="fluid-text-sm text-amber-600">Ningún grupo de tu plantel tiene el calendario de sesiones habilitado.</p>
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
      <div className="bg-gradient-to-br from-teal-600 via-emerald-600 to-green-700 rounded-fluid-2xl fluid-p-6 text-white fluid-mb-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between fluid-gap-4">
          <div>
            <h1 className="fluid-text-2xl font-bold flex items-center fluid-gap-2">
              <Calendar className="fluid-icon-lg" />
              Sesiones — {campusName}
            </h1>
            <p className="fluid-text-sm text-white/70 fluid-mt-1">Gestiona las sesiones de tus grupos</p>
          </div>

          {/* Group selector */}
          <div className="flex items-center fluid-gap-3">
            <Users className="w-5 h-5 text-white/60" />
            <select
              value={selectedGroupId || ''}
              onChange={e => { setSelectedGroupId(Number(e.target.value)); setProposal(null); }}
              className="bg-white/15 text-white border border-white/20 rounded-fluid-lg fluid-px-4 fluid-py-2 fluid-text-sm backdrop-blur-sm focus:ring-2 focus:ring-white/30 focus:outline-none appearance-none cursor-pointer"
              style={{ minWidth: '220px' }}
            >
              {groups.map(g => (
                <option key={g.id} value={g.id} className="text-gray-800 bg-white">
                  {g.name} ({g.member_count} candidatos)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode badge + stats */}
        <div className="fluid-mt-4 fluid-pt-4 border-t border-white/10 flex flex-wrap items-center fluid-gap-4">
          <span className={`inline-flex items-center fluid-px-3 fluid-py-1 rounded-full fluid-text-xs font-semibold ${isLeaderOnly ? 'bg-amber-400/20 text-amber-100 border border-amber-400/30' : 'bg-blue-400/20 text-blue-100 border border-blue-400/30'}`}>
            {isLeaderOnly ? '🔒 Solo líder agenda' : '👤 Candidatos agendan'}
          </span>
          <div className="bg-white/10 rounded-fluid-xl fluid-py-2 fluid-px-4 text-center backdrop-blur-sm border border-white/5">
            <span className="fluid-text-lg font-bold">{sessions.length}</span>
            <span className="fluid-text-xs text-white/60 ml-2">Sesiones esta semana</span>
          </div>
          <div className="bg-white/10 rounded-fluid-xl fluid-py-2 fluid-px-4 text-center backdrop-blur-sm border border-white/5">
            <span className="fluid-text-lg font-bold">{candidates.filter(c => !c.has_scheduled_session).length}</span>
            <span className="fluid-text-xs text-white/60 ml-2">Sin sesión</span>
          </div>
          {isLeaderOnly && (
            <button
              onClick={handleAutoDistribute}
              disabled={proposalLoading}
              className="ml-auto flex items-center fluid-gap-2 bg-white/20 hover:bg-white/30 fluid-px-4 fluid-py-2 rounded-fluid-lg fluid-text-sm font-medium transition-colors disabled:opacity-50"
            >
              {proposalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
              Auto-distribuir
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 fluid-gap-6">
        {/* ── Left Sidebar ── */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm fluid-p-4 sticky top-4">
            {/* Mini calendar */}
            <div className="flex items-center justify-between fluid-mb-3">
              <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-fluid transition-colors"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
              <span className="fluid-text-sm font-semibold text-gray-800">{MONTHS_ES[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
              <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-fluid transition-colors"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="grid grid-cols-7 gap-0 mb-1">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0">
              {monthDays.map((day, idx) => {
                if (!day) return <div key={`p-${idx}`} className="h-7" />;
                const inWeek = weekDays.some(w => sameDay(w, day));
                const today = isToday(day);
                const sel = sameDay(day, selectedDate);
                return (
                  <button key={idx} onClick={() => { setSelectedDate(new Date(day)); setCurrentDate(new Date(day)); }}
                    className={`h-7 w-full flex items-center justify-center text-xs rounded-md transition-all ${sel ? 'bg-teal-600 text-white font-bold' : today ? 'bg-teal-100 text-teal-700 font-bold' : inWeek ? 'bg-teal-50 text-teal-800 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                  >{day.getDate()}</button>
                );
              })}
            </div>

            {/* Sessions this week */}
            <div className="fluid-mt-5 border-t border-gray-100 fluid-pt-4">
              <h4 className="fluid-text-xs font-semibold text-gray-500 uppercase fluid-mb-3 flex items-center fluid-gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Sesiones del grupo
              </h4>
              {sessions.length === 0 ? (
                <p className="fluid-text-xs text-gray-400 text-center fluid-py-3">Sin sesiones esta semana</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {sessions.map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-lg fluid-px-3 fluid-py-2 group">
                      <div className="min-w-0">
                        <p className="fluid-text-xs font-bold text-teal-800 truncate">{s.start_hour_label}</p>
                        <p className="text-[10px] text-teal-600">
                          {(() => { const d = new Date(s.session_date + 'T12:00:00'); return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}`; })()}
                        </p>
                        {s.user_name && (
                          <p className="text-[10px] text-gray-500 truncate mt-0.5">👤 {s.user_name}</p>
                        )}
                      </div>
                      {isLeaderOnly && (
                        <button onClick={() => setCancelTarget(s)} className="text-red-400 hover:text-red-600 p-0.5 opacity-0 group-hover:opacity-100 transition-all" title="Cancelar">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Candidates list */}
            {isLeaderOnly && candidates.length > 0 && (
              <div className="fluid-mt-5 border-t border-gray-100 fluid-pt-4">
                <h4 className="fluid-text-xs font-semibold text-gray-500 uppercase fluid-mb-3">Candidatos</h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {candidates.map(c => (
                    <div key={c.user_id} className={`flex items-center fluid-gap-2 fluid-px-2 fluid-py-1.5 rounded-lg fluid-text-xs ${c.has_scheduled_session ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'}`}>
                      {c.has_scheduled_session ? <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" /> : <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                      <span className="truncate">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Weekly Calendar Grid ── */}
        <div className="xl:col-span-3">
          <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Week nav */}
            <div className="flex items-center justify-between fluid-px-5 fluid-py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white">
              <button onClick={prevWeek} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
              <div className="flex items-center fluid-gap-3">
                <Calendar className="w-5 h-5 text-teal-200" />
                <span className="font-semibold fluid-text-base">
                  {weekDays[0].getDate()} {MONTHS_ES[weekDays[0].getMonth()].substring(0, 3)} — {weekDays[6].getDate()} {MONTHS_ES[weekDays[6].getMonth()].substring(0, 3)} {weekDays[6].getFullYear()}
                </span>
                <button onClick={goToday} className="bg-white/20 hover:bg-white/30 fluid-px-2.5 fluid-py-1 rounded-lg fluid-text-xs font-medium transition-colors">Hoy</button>
              </div>
              <button onClick={nextWeek} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[640px]">
                <thead>
                  <tr>
                    <th className="w-16 border-b border-r border-gray-200 bg-gray-50 fluid-p-2"><Clock className="w-4 h-4 text-gray-400 mx-auto" /></th>
                    {weekDays.map((day, i) => {
                      const today = isToday(day);
                      return (
                        <th key={i} className={`border-b border-r last:border-r-0 border-gray-200 fluid-px-2 fluid-py-3 text-center ${today ? 'bg-teal-50' : 'bg-gray-50'}`}>
                          <div className="fluid-text-xs font-medium text-gray-500 uppercase">{DAYS_SHORT[day.getDay()]}</div>
                          <div className={`fluid-text-lg font-bold mt-0.5 ${today ? 'bg-teal-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto' : 'text-gray-800'}`}>{day.getDate()}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {slotsLoading ? (
                    <tr><td colSpan={8} className="text-center fluid-py-20"><Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto" /><p className="fluid-text-sm text-gray-400 mt-2">Cargando...</p></td></tr>
                  ) : (
                    OPERATING_HOURS.map(hour => (
                      <tr key={hour} className="group/row">
                        <td className="border-b border-r border-gray-200 fluid-py-1 fluid-px-2 text-center bg-gray-50/50 align-top">
                          <span className="fluid-text-xs font-mono text-gray-400">{`${String(hour).padStart(2, '0')}:00`}</span>
                        </td>
                        {weekDays.map((day, di) => {
                          const slot = getSlot(day, hour);
                          const groupSes = getGroupSession(day, hour);
                          const isPast = slot?.is_past ?? false;
                          const globalCount = slot?.global_count ?? 0;
                          const remaining = slot?.remaining ?? 0;
                          const isFull = remaining === 0;
                          const todayCol = isToday(day);

                          if (groupSes) {
                            // This group has a session here
                            return (
                              <td key={di} className={`border-b border-r last:border-r-0 border-gray-200 h-12 relative ${todayCol ? 'bg-teal-50/30' : ''}`}>
                                <div
                                  className={`absolute inset-0.5 rounded-md flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isLeaderOnly ? 'bg-teal-500 hover:bg-teal-600' : 'bg-blue-400'} shadow-sm`}
                                  onClick={() => { if (isLeaderOnly) setCancelTarget(groupSes); }}
                                  title={isLeaderOnly ? `${groupSes.user_name || 'Candidato'} · Click para cancelar` : `${groupSes.user_name || 'Candidato'}`}
                                >
                                  <span className="text-[9px] text-white font-semibold truncate max-w-full px-1">{groupSes.user_name || 'Asignado'}</span>
                                  <span className="text-[8px] text-white/70">{globalCount}/{slot?.max_sessions ?? 4}</span>
                                </div>
                              </td>
                            );
                          }

                          if (isPast) {
                            return (
                              <td key={di} className="border-b border-r last:border-r-0 border-gray-200 h-12 bg-gray-50/50">
                                <div className="h-full flex items-center justify-center"><span className="text-[9px] text-gray-300">—</span></div>
                              </td>
                            );
                          }

                          if (isFull) {
                            return (
                              <td key={di} className={`border-b border-r last:border-r-0 border-gray-200 h-12 ${todayCol ? 'bg-teal-50/30' : ''}`}>
                                <div className="absolute inset-0.5 flex items-center justify-center relative">
                                  <span className="text-[9px] text-red-400 font-medium">{globalCount}/{slot?.max_sessions ?? 4}</span>
                                </div>
                              </td>
                            );
                          }

                          // Available slot
                          if (isLeaderOnly) {
                            return (
                              <td key={di} className={`border-b border-r last:border-r-0 border-gray-200 h-12 relative ${todayCol ? 'bg-teal-50/30' : ''}`}>
                                <button
                                  onClick={() => { setBookingSlot({ slot: slot!, date: day }); setBookingError(''); setBookingCandidateId(''); }}
                                  className="absolute inset-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 rounded-md flex flex-col items-center justify-center transition-all"
                                  title={`Asignar candidato · ${remaining} lugar(es)`}
                                >
                                  <UserPlus className="w-3 h-3 text-emerald-400" />
                                  <span className="text-[8px] text-emerald-500 mt-0.5">{globalCount}/{slot?.max_sessions ?? 4}</span>
                                </button>
                              </td>
                            );
                          }

                          // candidate_self mode — read only
                          return (
                            <td key={di} className={`border-b border-r last:border-r-0 border-gray-200 h-12 ${todayCol ? 'bg-teal-50/30' : ''}`}>
                              <div className="h-full flex items-center justify-center">
                                <span className="text-[8px] text-gray-400">{globalCount}/{slot?.max_sessions ?? 4}</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="fluid-px-5 fluid-py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap fluid-gap-4 fluid-text-xs text-gray-500">
              <span className="flex items-center fluid-gap-1.5"><span className="w-3 h-3 rounded bg-teal-500" /> Sesión del grupo</span>
              <span className="flex items-center fluid-gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Disponible</span>
              <span className="flex items-center fluid-gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Lleno (4/4)</span>
              <span className="flex items-center fluid-gap-1.5"><span className="w-3 h-3 rounded bg-gray-100" /> Pasado</span>
              {!isLeaderOnly && (
                <span className="ml-auto flex items-center fluid-gap-1"><Eye className="w-3.5 h-3.5" /> Solo lectura — los candidatos agendan sus sesiones</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: Assign candidate (leader_only) ── */}
      {bookingSlot && isLeaderOnly && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBookingSlot(null)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="fluid-p-6 border-b border-gray-100">
              <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-2"><UserPlus className="w-5 h-5 text-teal-600" />Asignar sesión</h3>
              <p className="fluid-text-sm text-gray-500 fluid-mt-1">
                {DAYS_SHORT[bookingSlot.date.getDay()]} {bookingSlot.date.getDate()} {MONTHS_ES[bookingSlot.date.getMonth()]} · {bookingSlot.slot.label}
              </p>
            </div>
            <div className="fluid-p-6 space-y-4">
              {bookingError && <div className="bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-3 fluid-text-sm text-red-700 flex items-center fluid-gap-2"><AlertCircle className="w-4 h-4" />{bookingError}</div>}
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Candidato</label>
                <select
                  value={bookingCandidateId}
                  onChange={e => setBookingCandidateId(e.target.value)}
                  className="w-full border border-gray-300 rounded-fluid-lg fluid-px-3 fluid-py-2 fluid-text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                >
                  <option value="">Seleccionar candidato...</option>
                  {candidates.filter(c => !c.has_scheduled_session).map(c => (
                    <option key={c.user_id} value={c.user_id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="fluid-p-6 border-t border-gray-100 flex justify-end fluid-gap-3">
              <button onClick={() => setBookingSlot(null)} className="fluid-px-4 fluid-py-2 fluid-text-sm text-gray-600 hover:bg-gray-100 rounded-fluid-lg transition-colors">Cancelar</button>
              <button onClick={handleAssign} disabled={!bookingCandidateId || bookingLoading} className="fluid-px-4 fluid-py-2 fluid-text-sm bg-teal-600 text-white rounded-fluid-lg hover:bg-teal-700 disabled:opacity-50 flex items-center fluid-gap-2 transition-colors">
                {bookingLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Cancel session ── */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCancelTarget(null)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="fluid-p-6 border-b border-gray-100">
              <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-2"><X className="w-5 h-5 text-red-500" />Cancelar sesión</h3>
              <p className="fluid-text-sm text-gray-500 fluid-mt-1">
                {cancelTarget.user_name && <span className="font-medium">{cancelTarget.user_name} · </span>}
                {cancelTarget.start_hour_label} · {cancelTarget.session_date}
              </p>
            </div>
            <div className="fluid-p-6">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Motivo (opcional)</label>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full border border-gray-300 rounded-fluid-lg fluid-px-3 fluid-py-2 fluid-text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                rows={2}
                placeholder="Motivo de cancelación..."
              />
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

      {/* ── Modal: Auto-distribute proposal ── */}
      {proposal && proposal.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setProposal(null)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="fluid-p-6 border-b border-gray-100">
              <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-2"><Shuffle className="w-5 h-5 text-teal-600" />Propuesta de distribución</h3>
              <p className="fluid-text-sm text-gray-500 fluid-mt-1">Revisa y acepta la asignación propuesta</p>
            </div>
            <div className="fluid-p-6 overflow-y-auto flex-1">
              <div className="space-y-2">
                {proposal.map((p, i) => (
                  <div key={i} className={`flex items-center justify-between fluid-px-4 fluid-py-3 rounded-fluid-lg border ${p.error ? 'bg-red-50 border-red-200' : 'bg-teal-50 border-teal-200'}`}>
                    <div>
                      <p className="fluid-text-sm font-medium text-gray-800">{p.user_name}</p>
                      {p.session_date && (
                        <p className="fluid-text-xs text-gray-500">
                          {(() => { const d = new Date(p.session_date + 'T12:00:00'); return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_ES[d.getMonth()].substring(0, 3)}`; })()}
                        </p>
                      )}
                    </div>
                    <span className={`fluid-text-sm font-semibold ${p.error ? 'text-red-600' : 'text-teal-700'}`}>
                      {p.hour_label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="fluid-p-6 border-t border-gray-100 flex items-center justify-between">
              <p className="fluid-text-xs text-gray-500">
                {proposal.filter(p => p.session_date).length} asignados · {proposal.filter(p => !p.session_date).length} sin horario
              </p>
              <div className="flex fluid-gap-3">
                <button onClick={() => setProposal(null)} className="fluid-px-4 fluid-py-2 fluid-text-sm text-gray-600 hover:bg-gray-100 rounded-fluid-lg transition-colors">Descartar</button>
                <button
                  onClick={handleAcceptProposal}
                  disabled={bulkLoading || proposal.every(p => !p.session_date)}
                  className="fluid-px-4 fluid-py-2 fluid-text-sm bg-teal-600 text-white rounded-fluid-lg hover:bg-teal-700 disabled:opacity-50 flex items-center fluid-gap-2 transition-colors"
                >
                  {bulkLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Aceptar y crear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
