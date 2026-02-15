import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar, X, AlertCircle, CheckCircle, Loader2, Monitor } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import {
  checkVmAccess,
  getAvailableSlots,
  getVmSessions,
  createVmSession,
  cancelVmSession,
  type VmSlot,
  type VmSession,
  type VmAccessInfo,
} from '../../services/vmSessionsService';

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const OPERATING_HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8:00 - 19:00

function formatDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekDays(referenceDate: Date): Date[] {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day === 0 ? 7 : day) - 1));
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    days.push(dd);
  }
  return days;
}

function getMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Monday = 0
  const days: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

function isToday(d: Date): boolean {
  const today = new Date();
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

// Type for week slots data: { [dateStr]: VmSlot[] }
type WeekSlotsMap = Record<string, VmSlot[]>;

export default function VmSchedulingPage() {
  const { user } = useAuthStore();
  const isAdminOrCoord = user?.role === 'admin' || user?.role === 'coordinator';

  // Access
  const [access, setAccess] = useState<VmAccessInfo | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);

  // Navigation
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Data
  const [weekSlots, setWeekSlots] = useState<WeekSlotsMap>({});
  const [mySessions, setMySessions] = useState<VmSession[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Booking
  const [bookingSlot, setBookingSlot] = useState<{ slot: VmSlot; date: Date } | null>(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Cancel
  const [cancelSession, setCancelSession] = useState<VmSession | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const weekKey = useMemo(() => formatDateStr(weekDays[0]), [weekDays]);
  const campusId = access?.campus_id;
  const monthDays = useMemo(() => getMonthDays(currentDate.getFullYear(), currentDate.getMonth()), [currentDate]);

  // Check access
  useEffect(() => {
    (async () => {
      try {
        const info = await checkVmAccess();
        setAccess(info);
      } catch {
        setAccess({ has_access: false, role: '', scope: '' });
      } finally {
        setAccessLoading(false);
      }
    })();
  }, []);

  // Load week slots sequentially to avoid connection exhaustion
  const loadWeekSlots = useCallback(async () => {
    if (!campusId && !isAdminOrCoord) return;
    const targetCampusId = campusId || 1;
    const days = getWeekDays(currentDate);
    setSlotsLoading(true);
    try {
      const results: WeekSlotsMap = {};
      for (const day of days) {
        const dateStr = formatDateStr(day);
        const res = await getAvailableSlots({ campus_id: targetCampusId, date: dateStr });
        results[dateStr] = res.slots;
      }
      setWeekSlots(results);
    } catch {
      setWeekSlots({});
    } finally {
      setSlotsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId, weekKey, isAdminOrCoord]);

  // Load my sessions
  const loadMySessions = useCallback(async () => {
    try {
      const days = getWeekDays(currentDate);
      const res = await getVmSessions({
        campus_id: campusId || undefined,
        date_from: formatDateStr(days[0]),
        date_to: formatDateStr(days[6]),
        status: 'scheduled',
      });
      setMySessions(res.sessions);
    } catch {
      setMySessions([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId, weekKey]);

  useEffect(() => { loadWeekSlots(); }, [loadWeekSlots]);
  useEffect(() => { if (access?.has_access) loadMySessions(); }, [access, loadMySessions]);

  // Show toast
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Book slot
  const handleBook = async () => {
    if (!bookingSlot) return;
    setBookingLoading(true);
    setBookingError('');
    try {
      await createVmSession({
        session_date: formatDateStr(bookingSlot.date),
        start_hour: bookingSlot.slot.hour,
        notes: bookingNotes || undefined,
        campus_id: isAdminOrCoord ? (campusId || 1) : undefined,
      });
      setBookingSlot(null);
      setBookingNotes('');
      showToast('success', 'Sesión agendada exitosamente');
      loadWeekSlots();
      loadMySessions();
    } catch (err: any) {
      setBookingError(err?.response?.data?.error || 'Error al agendar la sesión');
    } finally {
      setBookingLoading(false);
    }
  };

  // Cancel session
  const handleCancel = async () => {
    if (!cancelSession) return;
    setCancelLoading(true);
    try {
      await cancelVmSession(cancelSession.id, cancelReason);
      setCancelSession(null);
      setCancelReason('');
      showToast('success', 'Sesión cancelada');
      loadWeekSlots();
      loadMySessions();
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Error al cancelar');
    } finally {
      setCancelLoading(false);
    }
  };

  // Navigate weeks
  const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };
  const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };
  const goToday = () => { setCurrentDate(new Date()); setSelectedDate(new Date()); };
  const prevMonth = () => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); };
  const nextMonth = () => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); };

  // Get slot for a specific day+hour from weekSlots
  const getSlotFor = (day: Date, hour: number): VmSlot | undefined => {
    const dateStr = formatDateStr(day);
    return weekSlots[dateStr]?.find(s => s.hour === hour);
  };

  // Get session for a specific day+hour
  const getSessionFor = (day: Date, hour: number): VmSession | undefined => {
    const dateStr = formatDateStr(day);
    return mySessions.find(s => s.session_date === dateStr && s.start_hour === hour);
  };

  // Loading
  if (accessLoading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando calendario..." />
      </div>
    );
  }

  // No access
  if (!access?.has_access) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
        <div className="bg-amber-50 border border-amber-200 rounded-fluid-2xl fluid-p-8 text-center max-w-lg mx-auto">
          <AlertCircle className="fluid-icon-xl text-amber-500 mx-auto fluid-mb-4" />
          <h2 className="fluid-text-xl font-bold text-amber-800 fluid-mb-2">Calendario No Disponible</h2>
          <p className="fluid-text-base text-amber-600">
            El calendario de sesiones no está habilitado para tu grupo. Contacta a tu coordinador si necesitas acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-fluid-full mx-auto animate-fade-in-up">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center fluid-gap-2 fluid-px-5 fluid-py-3 rounded-fluid-lg shadow-lg animate-fadeSlideIn ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="fluid-icon" /> : <AlertCircle className="fluid-icon" />}
          <span className="fluid-text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header con gradiente - estilo Partners */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-white/3 rounded-full" />
        
        <div className="relative">
          {/* Fila 1: Título + Leyenda */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between fluid-gap-4">
            {/* Título y descripción */}
            <div className="flex items-center fluid-gap-4">
              <div className="fluid-p-3 bg-white/15 rounded-fluid-2xl backdrop-blur-sm border border-white/10">
                <Monitor className="fluid-icon-xl text-white" />
              </div>
              <div>
                <h1 className="fluid-text-2xl font-bold tracking-tight">Calendario de Sesiones</h1>
                <p className="fluid-text-sm text-white/70 fluid-mt-1">
                  Agenda tus sesiones de práctica. Solo una sesión por hora y sin empalmes.
                </p>
              </div>
            </div>

            {/* Leyenda — alineada a la derecha, compacta */}
            <div className="flex items-center fluid-gap-3 bg-white/10 rounded-fluid-xl fluid-px-4 fluid-py-2.5 backdrop-blur-sm border border-white/10 flex-shrink-0">
              <div className="flex items-center fluid-gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-blue-300/80 border border-blue-200/40"></div>
                <span className="fluid-text-xs text-white/80">Disponible</span>
              </div>
              <div className="w-px h-3 bg-white/20"></div>
              <div className="flex items-center fluid-gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-green-400"></div>
                <span className="fluid-text-xs text-white/80">Tu sesión</span>
              </div>
              <div className="w-px h-3 bg-white/20"></div>
              <div className="flex items-center fluid-gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-red-300/80 border border-red-200/40"></div>
                <span className="fluid-text-xs text-white/80">Ocupado</span>
              </div>
              <div className="w-px h-3 bg-white/20"></div>
              <div className="flex items-center fluid-gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-white/20 border border-white/20"></div>
                <span className="fluid-text-xs text-white/80">Pasado</span>
              </div>
            </div>
          </div>

          {/* Fila 2: Stats — separada con línea sutil */}
          <div className="grid grid-cols-3 fluid-gap-4 fluid-mt-5 fluid-pt-5 border-t border-white/10">
            <div className="bg-white/10 rounded-fluid-xl fluid-py-3 fluid-px-4 text-center backdrop-blur-sm border border-white/5">
              <p className="fluid-text-2xl font-bold">{mySessions.length}</p>
              <p className="fluid-text-xs text-white/60 font-medium">Mis Sesiones</p>
            </div>
            <div className="bg-white/10 rounded-fluid-xl fluid-py-3 fluid-px-4 text-center backdrop-blur-sm border border-white/5">
              <p className="fluid-text-2xl font-bold">{Object.values(weekSlots).reduce((sum, slots) => sum + slots.filter(s => s.available).length, 0)}</p>
              <p className="fluid-text-xs text-white/60 font-medium">Disponibles</p>
            </div>
            <div className="bg-white/10 rounded-fluid-xl fluid-py-3 fluid-px-4 text-center backdrop-blur-sm border border-white/5">
              <p className="fluid-text-2xl font-bold">
                {weekDays[0].getDate()}-{weekDays[6].getDate()} {MONTHS_ES[weekDays[0].getMonth()].substring(0, 3)}
              </p>
              <p className="fluid-text-xs text-white/60 font-medium">Semana Actual</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 fluid-gap-6">
        {/* ========== MINI CALENDAR (left sidebar) ========== */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm fluid-p-4 sticky top-4">
            {/* Mini calendar header */}
            <div className="flex items-center justify-between fluid-mb-3">
              <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-fluid transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
              <span className="fluid-text-sm font-semibold text-gray-800">
                {MONTHS_ES[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-fluid transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 gap-0 mb-1">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-7 gap-0">
              {monthDays.map((day, idx) => {
                if (!day) return <div key={`pad-${idx}`} className="h-7" />;
                const isCurrentWeek = weekDays.some(wd => isSameDay(wd, day));
                const isTodayDay = isToday(day);
                const isSelected = isSameDay(day, selectedDate);

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedDate(new Date(day));
                      setCurrentDate(new Date(day));
                    }}
                    className={`h-7 w-full flex items-center justify-center text-xs rounded-md transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold'
                        : isTodayDay
                        ? 'bg-blue-100 text-blue-700 font-bold'
                        : isCurrentWeek
                        ? 'bg-blue-50 text-blue-800 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Mis sesiones esta semana */}
            <div className="fluid-mt-5 border-t border-gray-100 fluid-pt-4">
              <h4 className="fluid-text-xs font-semibold text-gray-500 uppercase fluid-mb-3 flex items-center fluid-gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Mis sesiones
              </h4>
              {mySessions.length === 0 ? (
                <p className="fluid-text-xs text-gray-400 text-center fluid-py-3">Sin sesiones esta semana</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {mySessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg fluid-px-3 fluid-py-2 group"
                    >
                      <div className="min-w-0">
                        <p className="fluid-text-xs font-bold text-green-800 truncate">
                          {session.start_hour_label}
                        </p>
                        <p className="text-[10px] text-green-600">
                          {(() => {
                            const d = new Date(session.session_date + 'T12:00:00');
                            return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}`;
                          })()}
                          {isAdminOrCoord && session.user_name && ` · ${session.user_name}`}
                        </p>
                      </div>
                      <button
                        onClick={() => setCancelSession(session)}
                        className="text-red-400 hover:text-red-600 p-0.5 opacity-0 group-hover:opacity-100 transition-all"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========== WEEKLY CALENDAR GRID ========== */}
        <div className="xl:col-span-3">
          <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Week navigation bar */}
            <div className="flex items-center justify-between fluid-px-5 fluid-py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              <button onClick={prevWeek} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center fluid-gap-3">
                <Calendar className="w-5 h-5 text-purple-200" />
                <span className="font-semibold fluid-text-base">
                  {weekDays[0].getDate()} {MONTHS_ES[weekDays[0].getMonth()].substring(0, 3)} — {weekDays[6].getDate()} {MONTHS_ES[weekDays[6].getMonth()].substring(0, 3)} {weekDays[6].getFullYear()}
                </span>
                <button
                  onClick={goToday}
                  className="bg-white/20 hover:bg-white/30 fluid-px-2.5 fluid-py-1 rounded-lg fluid-text-xs font-medium transition-colors"
                >
                  Hoy
                </button>
              </div>
              <button onClick={nextWeek} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Calendar table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[640px]">
                {/* Column headers: days */}
                <thead>
                  <tr>
                    <th className="w-16 border-b border-r border-gray-200 bg-gray-50 fluid-p-2">
                      <Clock className="w-4 h-4 text-gray-400 mx-auto" />
                    </th>
                    {weekDays.map((day, idx) => {
                      const isTodayDay = isToday(day);
                      return (
                        <th
                          key={idx}
                          className={`border-b border-r last:border-r-0 border-gray-200 fluid-px-2 fluid-py-3 text-center ${
                            isTodayDay ? 'bg-blue-50' : 'bg-gray-50'
                          }`}
                        >
                          <div className="fluid-text-xs font-medium text-gray-500 uppercase">
                            {DAYS_SHORT[day.getDay()]}
                          </div>
                          <div className={`fluid-text-lg font-bold mt-0.5 ${
                            isTodayDay
                              ? 'bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto'
                              : 'text-gray-800'
                          }`}>
                            {day.getDate()}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {slotsLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center fluid-py-20">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                        <p className="fluid-text-sm text-gray-400 mt-2">Cargando calendario...</p>
                      </td>
                    </tr>
                  ) : (
                    OPERATING_HOURS.map((hour) => (
                      <tr key={hour} className="group/row">
                        {/* Hour label */}
                        <td className="border-b border-r border-gray-200 fluid-py-1 fluid-px-2 text-center bg-gray-50/50 align-top">
                          <span className="fluid-text-xs font-mono text-gray-400">{`${hour.toString().padStart(2, '0')}:00`}</span>
                        </td>

                        {/* Day cells */}
                        {weekDays.map((day, dayIdx) => {
                          const slot = getSlotFor(day, hour);
                          const mySession = getSessionFor(day, hour);
                          const isMine = !!mySession;
                          const isAvailable = slot?.available ?? false;
                          const isPast = slot?.is_past ?? false;
                          const isOccupied = slot?.is_occupied ?? false;
                          const isTodayCol = isToday(day);

                          return (
                            <td
                              key={dayIdx}
                              className={`border-b border-r last:border-r-0 border-gray-200 h-11 relative transition-colors ${
                                isTodayCol ? 'bg-blue-50/30' : ''
                              }`}
                            >
                              {isMine ? (
                                // Mi sesión agendada
                                <button
                                  onClick={() => setCancelSession(mySession!)}
                                  className="absolute inset-0.5 bg-green-500 hover:bg-green-600 rounded-md flex items-center justify-center transition-all group/cell cursor-pointer shadow-sm"
                                  title={`Tu sesión · ${hour}:00 – ${hour + 1}:00 · Click para cancelar`}
                                >
                                  <div className="text-center">
                                    <CheckCircle className="w-3.5 h-3.5 text-white mx-auto" />
                                    <span className="text-[9px] text-white font-semibold block mt-0.5">
                                      Agendada
                                    </span>
                                  </div>
                                </button>
                              ) : isAvailable ? (
                                // Disponible
                                <button
                                  onClick={() => {
                                    setBookingSlot({ slot: slot!, date: day });
                                    setBookingError('');
                                    setBookingNotes('');
                                  }}
                                  className="absolute inset-0.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-400 rounded-md flex items-center justify-center transition-all cursor-pointer hover:shadow-sm group/cell"
                                  title={`Disponible · ${hour}:00 – ${hour + 1}:00 · Click para agendar`}
                                >
                                  <span className="text-[10px] text-blue-400 group-hover/cell:text-blue-600 font-medium transition-colors">
                                    +
                                  </span>
                                </button>
                              ) : isOccupied ? (
                                // Ocupado por otro
                                <div
                                  className="absolute inset-0.5 bg-red-50 border border-red-200 rounded-md flex items-center justify-center"
                                  title={`Ocupado · ${hour}:00 – ${hour + 1}:00`}
                                >
                                  <div className="w-2 h-2 bg-red-300 rounded-full"></div>
                                </div>
                              ) : isPast ? (
                                // Hora pasada
                                <div className="absolute inset-0.5 bg-gray-50 rounded-md">
                                  <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,rgba(0,0,0,0.03)_4px,rgba(0,0,0,0.03)_5px)] rounded-md"></div>
                                </div>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Confirmar Reserva */}
      {bookingSlot && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-2xl shadow-2xl fluid-p-6 max-w-md w-full animate-fadeSlideIn">
            <div className="flex items-center justify-between fluid-mb-4">
              <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-2">
                <Calendar className="fluid-icon text-blue-600" />
                Agendar Sesión
              </h3>
              <button onClick={() => setBookingSlot(null)} className="p-1 hover:bg-gray-100 rounded-fluid-lg transition-colors">
                <X className="fluid-icon text-gray-500" />
              </button>
            </div>

            <div className="bg-purple-50 border border-purple-100 rounded-fluid-lg fluid-p-4 fluid-mb-4">
              <p className="fluid-text-sm text-purple-800">
                <strong>Fecha:</strong> {DAYS_ES[bookingSlot.date.getDay()]} {bookingSlot.date.getDate()} de {MONTHS_ES[bookingSlot.date.getMonth()]} de {bookingSlot.date.getFullYear()}
              </p>
              <p className="fluid-text-sm text-purple-800 fluid-mt-1">
                <strong>Horario:</strong> {bookingSlot.slot.label}
              </p>
            </div>

            <div className="fluid-mb-4">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Notas (opcional)</label>
              <textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="Ej: Práctica de Excel avanzado"
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent fluid-text-sm resize-none"
                rows={3}
              />
            </div>

            {bookingError && (
              <div className="bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-3 fluid-mb-4 flex items-center fluid-gap-2">
                <AlertCircle className="fluid-icon-sm text-red-500 flex-shrink-0" />
                <p className="fluid-text-sm text-red-700">{bookingError}</p>
              </div>
            )}

            <div className="flex fluid-gap-3">
              <button
                onClick={() => setBookingSlot(null)}
                className="flex-1 fluid-py-3 border border-gray-300 text-gray-700 rounded-fluid-lg hover:bg-gray-50 transition-colors fluid-text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleBook}
                disabled={bookingLoading}
                className="flex-1 fluid-py-3 bg-purple-600 text-white rounded-fluid-lg hover:bg-purple-700 transition-colors fluid-text-sm font-medium disabled:opacity-50 flex items-center justify-center fluid-gap-2"
              >
                {bookingLoading ? <Loader2 className="fluid-icon-sm animate-spin" /> : <CheckCircle className="fluid-icon-sm" />}
                {bookingLoading ? 'Agendando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancelar Sesión */}
      {cancelSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-2xl shadow-2xl fluid-p-6 max-w-md w-full animate-fadeSlideIn">
            <div className="flex items-center justify-between fluid-mb-4">
              <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-2">
                <AlertCircle className="fluid-icon text-red-500" />
                Cancelar Sesión
              </h3>
              <button onClick={() => setCancelSession(null)} className="p-1 hover:bg-gray-100 rounded-fluid-lg transition-colors">
                <X className="fluid-icon text-gray-500" />
              </button>
            </div>

            <div className="bg-red-50 rounded-fluid-lg fluid-p-4 fluid-mb-4">
              <p className="fluid-text-sm text-red-800">
                <strong>Fecha:</strong> {cancelSession.session_date}
              </p>
              <p className="fluid-text-sm text-red-800 fluid-mt-1">
                <strong>Horario:</strong> {cancelSession.start_hour_label}
              </p>
            </div>

            <div className="fluid-mb-4">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Motivo de cancelación (opcional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Motivo de cancelación"
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent fluid-text-sm resize-none"
                rows={2}
              />
            </div>

            <div className="flex fluid-gap-3">
              <button
                onClick={() => setCancelSession(null)}
                className="flex-1 fluid-py-3 border border-gray-300 text-gray-700 rounded-fluid-lg hover:bg-gray-50 transition-colors fluid-text-sm font-medium"
              >
                Volver
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelLoading}
                className="flex-1 fluid-py-3 bg-red-600 text-white rounded-fluid-lg hover:bg-red-700 transition-colors fluid-text-sm font-medium disabled:opacity-50 flex items-center justify-center fluid-gap-2"
              >
                {cancelLoading ? <Loader2 className="fluid-icon-sm animate-spin" /> : <X className="fluid-icon-sm" />}
                {cancelLoading ? 'Cancelando...' : 'Cancelar Sesión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
