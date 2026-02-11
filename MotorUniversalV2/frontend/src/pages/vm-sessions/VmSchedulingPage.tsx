import { useState, useEffect, useCallback } from 'react';
import { Monitor, ChevronLeft, ChevronRight, Clock, Calendar, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
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
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

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

function isToday(d: Date): boolean {
  const today = new Date();
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

export default function VmSchedulingPage() {
  const { user } = useAuthStore();
  const isAdminOrCoord = user?.role === 'admin' || user?.role === 'coordinator';

  // Access
  const [access, setAccess] = useState<VmAccessInfo | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);

  // Navigation
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');

  // Data
  const [slots, setSlots] = useState<VmSlot[]>([]);
  const [mySessions, setMySessions] = useState<VmSession[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Booking
  const [bookingSlot, setBookingSlot] = useState<VmSlot | null>(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Cancel
  const [cancelSession, setCancelSession] = useState<VmSession | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const weekDays = getWeekDays(currentDate);
  const campusId = access?.campus_id;

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

  // Load slots for selected date
  const loadSlots = useCallback(async () => {
    if (!campusId && !isAdminOrCoord) return;
    const targetCampusId = campusId || 1; // Admin needs to select campus, default for now
    setSlotsLoading(true);
    try {
      const res = await getAvailableSlots({
        campus_id: targetCampusId,
        date: formatDateStr(selectedDate),
      });
      setSlots(res.slots);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [campusId, selectedDate, isAdminOrCoord]);

  // Load my sessions
  const loadMySessions = useCallback(async () => {
    try {
      const weekStart = formatDateStr(weekDays[0]);
      const weekEnd = formatDateStr(weekDays[6]);
      const res = await getVmSessions({
        campus_id: campusId || undefined,
        date_from: weekStart,
        date_to: weekEnd,
        status: 'scheduled',
      });
      setMySessions(res.sessions);
    } catch {
      setMySessions([]);
    }
  }, [campusId, weekDays]);

  useEffect(() => { loadSlots(); }, [loadSlots]);
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
        session_date: formatDateStr(selectedDate),
        start_hour: bookingSlot.hour,
        notes: bookingNotes || undefined,
        campus_id: isAdminOrCoord ? (campusId || 1) : undefined,
      });
      setBookingSlot(null);
      setBookingNotes('');
      showToast('success', 'Sesión agendada exitosamente');
      loadSlots();
      loadMySessions();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Error al agendar la sesión';
      setBookingError(msg);
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
      loadSlots();
      loadMySessions();
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Error al cancelar');
    } finally {
      setCancelLoading(false);
    }
  };

  // Navigate weeks
  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };
  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Get sessions for a specific date
  const getSessionsForDate = (d: Date) => {
    const dateStr = formatDateStr(d);
    return mySessions.filter(s => s.session_date === dateStr);
  };

  // Loading access
  if (accessLoading) {
    return (
      <div className="fluid-p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="fluid-icon-xl text-blue-600 animate-spin" />
      </div>
    );
  }

  // No access
  if (!access?.has_access) {
    return (
      <div className="fluid-p-6 animate-fade-in-up">
        <div className="bg-white rounded-fluid-2xl shadow-lg fluid-p-8 text-center max-w-lg mx-auto">
          <AlertCircle className="fluid-icon-xl text-amber-500 mx-auto fluid-mb-4" />
          <h2 className="fluid-text-xl font-bold text-gray-800 fluid-mb-2">Máquinas Virtuales No Disponibles</h2>
          <p className="fluid-text-base text-gray-600">
            El acceso a máquinas virtuales no está habilitado para tu grupo. Contacta a tu coordinador si necesitas acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 animate-fade-in-up">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center fluid-gap-2 fluid-px-5 fluid-py-3 rounded-fluid-lg shadow-lg animate-fadeSlideIn ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="fluid-icon" /> : <AlertCircle className="fluid-icon" />}
          <span className="fluid-text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center fluid-gap-4 fluid-mb-6">
        <div>
          <h1 className="fluid-text-3xl font-bold text-gray-800 flex items-center fluid-gap-3">
            <Monitor className="fluid-icon-xl text-blue-600" />
            Máquinas Virtuales
          </h1>
          <p className="fluid-text-base text-gray-600 fluid-mt-2">
            Agenda una sesión de práctica en una máquina virtual. Solo una sesión por hora y sin empalmes.
          </p>
        </div>
        <div className="flex items-center fluid-gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'week' ? 'day' : 'week')}
            className="bg-white border border-gray-300 text-gray-700 fluid-px-4 fluid-py-2 rounded-fluid-lg hover:bg-gray-50 transition-colors fluid-text-sm font-medium"
          >
            {viewMode === 'week' ? 'Vista Día' : 'Vista Semana'}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white rounded-fluid-xl shadow fluid-p-4 fluid-mb-6">
        <div className="flex items-center justify-between">
          <button onClick={prevWeek} className="p-2 hover:bg-gray-100 rounded-fluid-lg transition-colors">
            <ChevronLeft className="fluid-icon text-gray-600" />
          </button>
          <div className="flex items-center fluid-gap-4">
            <h2 className="fluid-text-lg font-semibold text-gray-800">
              {MONTHS_ES[weekDays[0].getMonth()]} {weekDays[0].getFullYear()}
              {weekDays[0].getMonth() !== weekDays[6].getMonth() && (
                <span> - {MONTHS_ES[weekDays[6].getMonth()]} {weekDays[6].getFullYear()}</span>
              )}
            </h2>
            <button
              onClick={goToday}
              className="bg-blue-100 text-blue-700 fluid-px-3 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium hover:bg-blue-200 transition-colors"
            >
              Hoy
            </button>
          </div>
          <button onClick={nextWeek} className="p-2 hover:bg-gray-100 rounded-fluid-lg transition-colors">
            <ChevronRight className="fluid-icon text-gray-600" />
          </button>
        </div>

        {/* Week days bar */}
        <div className="grid grid-cols-7 fluid-gap-2 fluid-mt-4">
          {weekDays.map((day, idx) => {
            const isSelected = formatDateStr(day) === formatDateStr(selectedDate);
            const isTodayDay = isToday(day);
            const daySessions = getSessionsForDate(day);
            const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(new Date(day))}
                className={`flex flex-col items-center fluid-py-3 fluid-px-2 rounded-fluid-lg transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : isTodayDay
                    ? 'bg-blue-50 text-blue-700 border-2 border-blue-300'
                    : isPast
                    ? 'bg-gray-50 text-gray-400'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span className={`fluid-text-xs font-medium ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                  {DAYS_ES[day.getDay()].substring(0, 3)}
                </span>
                <span className={`fluid-text-lg font-bold ${isSelected ? 'text-white' : ''}`}>
                  {day.getDate()}
                </span>
                {daySessions.length > 0 && (
                  <div className={`w-1.5 h-1.5 rounded-full fluid-mt-1 ${
                    isSelected ? 'bg-white' : 'bg-green-500'
                  }`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content: Slots + My Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 fluid-gap-6">
        {/* Slots del día seleccionado */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-fluid-xl shadow fluid-p-5">
            <div className="flex items-center justify-between fluid-mb-4">
              <h3 className="fluid-text-lg font-semibold text-gray-800 flex items-center fluid-gap-2">
                <Calendar className="fluid-icon text-blue-600" />
                {DAYS_ES[selectedDate.getDay()]} {selectedDate.getDate()} de {MONTHS_ES[selectedDate.getMonth()]}
              </h3>
              <span className={`fluid-text-sm font-medium fluid-px-3 fluid-py-1 rounded-full ${
                slots.filter(s => s.available).length > 0
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {slots.filter(s => s.available).length} disponibles
              </span>
            </div>

            {slotsLoading ? (
              <div className="flex items-center justify-center fluid-py-12">
                <Loader2 className="fluid-icon-lg text-blue-600 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 fluid-gap-3">
                {slots.map((slot) => {
                  // Check if this slot is MY session
                  const mySession = mySessions.find(
                    s => s.session_date === formatDateStr(selectedDate) && s.start_hour === slot.hour
                  );
                  const isMine = !!mySession;

                  return (
                    <button
                      key={slot.hour}
                      disabled={!slot.available && !isMine}
                      onClick={() => {
                        if (isMine && mySession) {
                          setCancelSession(mySession);
                        } else if (slot.available) {
                          setBookingSlot(slot);
                          setBookingError('');
                          setBookingNotes('');
                        }
                      }}
                      className={`relative flex flex-col items-center fluid-py-4 fluid-px-3 rounded-fluid-lg border-2 transition-all ${
                        isMine
                          ? 'border-green-400 bg-green-50 hover:bg-green-100 text-green-800 cursor-pointer'
                          : slot.available
                          ? 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-800 cursor-pointer hover:shadow-md'
                          : slot.is_past
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-red-200 bg-red-50 text-red-400 cursor-not-allowed'
                      }`}
                    >
                      <Clock className={`fluid-icon-sm fluid-mb-1 ${
                        isMine ? 'text-green-600' : slot.available ? 'text-blue-500' : 'text-gray-300'
                      }`} />
                      <span className="fluid-text-sm font-bold">{slot.label}</span>
                      <span className={`fluid-text-xs fluid-mt-1 font-medium ${
                        isMine
                          ? 'text-green-600'
                          : slot.available
                          ? 'text-blue-600'
                          : slot.is_past
                          ? 'text-gray-400'
                          : 'text-red-500'
                      }`}>
                        {isMine ? '✓ Tu sesión' : slot.available ? 'Disponible' : slot.is_past ? 'Pasado' : 'Ocupado'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {!slotsLoading && slots.length === 0 && (
              <div className="text-center fluid-py-12 text-gray-500">
                <Monitor className="fluid-icon-xl mx-auto fluid-mb-3 text-gray-300" />
                <p className="fluid-text-base">No hay horarios configurados para esta fecha</p>
              </div>
            )}
          </div>
        </div>

        {/* Mis sesiones de la semana */}
        <div>
          <div className="bg-white rounded-fluid-xl shadow fluid-p-5">
            <h3 className="fluid-text-lg font-semibold text-gray-800 flex items-center fluid-gap-2 fluid-mb-4">
              <Monitor className="fluid-icon text-green-600" />
              Mis Sesiones
            </h3>
            {mySessions.length === 0 ? (
              <div className="text-center fluid-py-8 text-gray-500">
                <Calendar className="fluid-icon-lg mx-auto fluid-mb-2 text-gray-300" />
                <p className="fluid-text-sm">No tienes sesiones esta semana</p>
                <p className="fluid-text-xs text-gray-400 fluid-mt-1">Selecciona un horario disponible para agendar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mySessions.map((session) => (
                  <div
                    key={session.id}
                    className="border border-gray-200 rounded-fluid-lg fluid-p-4 hover:border-green-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="fluid-text-sm font-bold text-gray-800">
                          {session.start_hour_label}
                        </p>
                        <p className="fluid-text-xs text-gray-500 fluid-mt-1">
                          {(() => {
                            const d = new Date(session.session_date + 'T12:00:00');
                            return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`;
                          })()}
                        </p>
                        {session.notes && (
                          <p className="fluid-text-xs text-gray-400 fluid-mt-1 italic">{session.notes}</p>
                        )}
                        {isAdminOrCoord && session.user_name && (
                          <p className="fluid-text-xs text-blue-600 fluid-mt-1 font-medium">
                            {session.user_name}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setCancelSession(session)}
                        className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-fluid transition-colors"
                        title="Cancelar sesión"
                      >
                        <X className="fluid-icon-sm" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leyenda */}
          <div className="bg-white rounded-fluid-xl shadow fluid-p-4 fluid-mt-4">
            <p className="fluid-text-xs font-semibold text-gray-500 uppercase fluid-mb-3">Leyenda</p>
            <div className="space-y-2">
              <div className="flex items-center fluid-gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="fluid-text-xs text-gray-600">Disponible</span>
              </div>
              <div className="flex items-center fluid-gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="fluid-text-xs text-gray-600">Tu sesión</span>
              </div>
              <div className="flex items-center fluid-gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <span className="fluid-text-xs text-gray-600">Ocupado</span>
              </div>
              <div className="flex items-center fluid-gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                <span className="fluid-text-xs text-gray-600">Hora pasada</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Confirmar Reserva */}
      {bookingSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-2xl shadow-2xl fluid-p-6 max-w-md w-full animate-fadeSlideIn">
            <div className="flex items-center justify-between fluid-mb-4">
              <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-2">
                <Monitor className="fluid-icon text-blue-600" />
                Agendar Sesión
              </h3>
              <button
                onClick={() => setBookingSlot(null)}
                className="p-1 hover:bg-gray-100 rounded-fluid-lg transition-colors"
              >
                <X className="fluid-icon text-gray-500" />
              </button>
            </div>

            <div className="bg-blue-50 rounded-fluid-lg fluid-p-4 fluid-mb-4">
              <p className="fluid-text-sm text-blue-800">
                <strong>Fecha:</strong> {DAYS_ES[selectedDate.getDay()]} {selectedDate.getDate()} de {MONTHS_ES[selectedDate.getMonth()]} de {selectedDate.getFullYear()}
              </p>
              <p className="fluid-text-sm text-blue-800 fluid-mt-1">
                <strong>Horario:</strong> {bookingSlot.label}
              </p>
            </div>

            <div className="fluid-mb-4">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                Notas (opcional)
              </label>
              <textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="Ej: Necesito practicar Excel avanzado"
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-sm resize-none"
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
                className="flex-1 fluid-py-3 bg-blue-600 text-white rounded-fluid-lg hover:bg-blue-700 transition-colors fluid-text-sm font-medium disabled:opacity-50 flex items-center justify-center fluid-gap-2"
              >
                {bookingLoading ? (
                  <Loader2 className="fluid-icon-sm animate-spin" />
                ) : (
                  <CheckCircle className="fluid-icon-sm" />
                )}
                {bookingLoading ? 'Agendando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancelar Sesión */}
      {cancelSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-2xl shadow-2xl fluid-p-6 max-w-md w-full animate-fadeSlideIn">
            <div className="flex items-center justify-between fluid-mb-4">
              <h3 className="fluid-text-lg font-bold text-gray-800 flex items-center fluid-gap-2">
                <AlertCircle className="fluid-icon text-red-500" />
                Cancelar Sesión
              </h3>
              <button
                onClick={() => setCancelSession(null)}
                className="p-1 hover:bg-gray-100 rounded-fluid-lg transition-colors"
              >
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
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                Motivo de cancelación (opcional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Motivo de cancelación"
                className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-red-500 focus:border-transparent fluid-text-sm resize-none"
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
                {cancelLoading ? (
                  <Loader2 className="fluid-icon-sm animate-spin" />
                ) : (
                  <X className="fluid-icon-sm" />
                )}
                {cancelLoading ? 'Cancelando...' : 'Cancelar Sesión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
