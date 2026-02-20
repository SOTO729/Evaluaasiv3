/**
 * Detalle completo de una asignación (GroupExam)
 * Muestra: config plantel, config grupo, config examen, ECM, materiales, resumen de resultados
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  Settings,
  Shield,
  Zap,
  FileText,
  CreditCard,
  Calendar,
  DollarSign,
  Monitor,
  Lock,
  BookOpen,
  ChevronRight,

  Hash,
  User,
  Layers,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import {
  getGroupExamDetail,
  AssignmentDetailResponse,
} from '../../services/partnersService';

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function BoolBadge({ value, labelOn, labelOff }: { value: boolean; labelOn?: string; labelOff?: string }) {
  return value ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-lg">
      <CheckCircle2 className="w-3 h-3" />{labelOn || 'Sí'}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-400 text-xs font-medium rounded-lg">
      <XCircle className="w-3 h-3" />{labelOff || 'No'}
    </span>
  );
}

function ConfigRow({ icon: Icon, label, value, color = 'gray' }: { icon: React.ComponentType<any>; label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Icon className={`w-4 h-4 text-${color}-500`} />
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium text-gray-800">{value}</div>
    </div>
  );
}

export default function AssignmentDetailPage() {
  const { groupId, examId } = useParams();
  const [data, setData] = useState<AssignmentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [groupId, examId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getGroupExamDetail(Number(groupId), Number(examId));
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el detalle de la asignación');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando detalle de asignación..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <div>
            <p className="text-red-700 font-medium">{error}</p>
            <button onClick={loadData} className="text-red-600 underline text-sm mt-1">Reintentar</button>
          </div>
        </div>
      </div>
    );
  }

  const { assignment, assigned_by, ecm, exam, campus_config, group, members_summary, ecm_stats, has_custom_materials } = data;
  const eff = group.effective_config;

  const contentTypeLabels: Record<string, string> = {
    'questions_only': 'Solo Preguntas',
    'exercises_only': 'Solo Ejercicios',
    'mixed': 'Mixto (Preguntas + Ejercicios)',
  };

  const officeLabels: Record<string, string> = {
    'office_365': 'Microsoft 365',
    'office_2021': 'Office 2021',
    'office_2019': 'Office 2019',
    'office_2016': 'Office 2016',
  };

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up fluid-space-y-6">
      {/* Breadcrumb */}
      <PartnersBreadcrumb items={[
        { label: 'Planteles', path: '/partners' },
        { label: campus_config.name, path: `/partners/campuses/${campus_config.id}` },
        { label: group.name, path: `/partners/groups/${groupId}` },
        { label: exam?.name || 'Asignación' },
      ]} />

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
              {ecm?.logo_url ? (
                <img src={ecm.logo_url} alt={ecm.code} className="w-full h-full object-contain p-1" />
              ) : (
                <Award className="w-8 h-8" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{exam?.name || 'Examen'}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {ecm && (
                  <span className="px-3 py-1 bg-white/20 rounded-lg text-sm font-semibold backdrop-blur-sm">
                    {ecm.code}
                  </span>
                )}
                <span className="px-3 py-1 bg-white/10 rounded-lg text-sm backdrop-blur-sm">
                  {assignment.assignment_type === 'all' ? 'Todo el grupo' : `${members_summary.total} miembros seleccionados`}
                </span>
              </div>
              <p className="text-white/70 text-sm mt-2">
                Asignada el {formatDateTime(assignment.assigned_at)}
                {assigned_by && <> por <strong>{assigned_by.full_name}</strong></>}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to={`/partners/groups/${groupId}`}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 backdrop-blur-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Volver al Grupo
            </Link>
            <Link
              to={`/partners/groups/${groupId}/assignments/${examId}/edit-members?type=exam&name=${encodeURIComponent(exam?.name || 'Examen')}`}
              className="px-4 py-2 bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
            >
              <Users className="w-4 h-4" /> Ver Miembros
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">

        {/* ===== LEFT COLUMN ===== */}
        <div className="flex flex-col gap-6">

          {/* Configuración del Examen */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 rounded-lg">
                  <Settings className="w-4 h-4 text-indigo-600" />
                </div>
                Configuración del Examen
              </h2>
            </div>
            <div className="p-4 space-y-0.5">
              <ConfigRow icon={Clock} label="Tiempo límite" value={`${assignment.time_limit_minutes || exam?.duration_minutes || 0} min`} color="purple" />
              <ConfigRow icon={Target} label="Calificación mínima" value={`${assignment.passing_score ?? exam?.passing_score ?? 70}%`} color="green" />
              <ConfigRow icon={RefreshCw} label="Intentos permitidos" value={assignment.max_attempts || 1} color="amber" />
              <ConfigRow icon={AlertCircle} label="Desconexiones permitidas" value={assignment.max_disconnections || 3} color="red" />
              <ConfigRow icon={Layers} label="Tipo de contenido" value={contentTypeLabels[assignment.exam_content_type || 'questions_only'] || assignment.exam_content_type} color="blue" />
              {(assignment.exam_questions_count || 0) > 0 && (
                <ConfigRow icon={FileText} label="Preguntas de examen" value={assignment.exam_questions_count} color="blue" />
              )}
              {(assignment.exam_exercises_count || 0) > 0 && (
                <ConfigRow icon={Monitor} label="Ejercicios de examen" value={assignment.exam_exercises_count} color="blue" />
              )}
              {(assignment.simulator_questions_count || 0) > 0 && (
                <ConfigRow icon={FileText} label="Preguntas simulador" value={assignment.simulator_questions_count} color="violet" />
              )}
              {(assignment.simulator_exercises_count || 0) > 0 && (
                <ConfigRow icon={Monitor} label="Ejercicios simulador" value={assignment.simulator_exercises_count} color="violet" />
              )}
              <ConfigRow icon={Lock} label="Requiere PIN de seguridad" value={<BoolBadge value={assignment.require_security_pin || false} />} color="amber" />
              {assignment.require_security_pin && assignment.security_pin && (
                <ConfigRow icon={Hash} label="PIN de seguridad" value={
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{assignment.security_pin}</span>
                } color="amber" />
              )}
            </div>
          </div>

          {/* ECM Info */}
          {ecm && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-white">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <div className="p-1.5 bg-violet-100 rounded-lg">
                    <Shield className="w-4 h-4 text-violet-600" />
                  </div>
                  Estándar de Competencia (ECM)
                </h2>
              </div>
              <div className="p-5 flex-1">
                <div className="flex items-start gap-4">
                  {ecm.logo_url ? (
                    <img src={ecm.logo_url} alt={ecm.code} className="w-16 h-16 rounded-xl object-contain border border-gray-200 bg-white p-1" />
                  ) : (
                    <div className="w-16 h-16 bg-violet-100 rounded-xl flex items-center justify-center">
                      <Shield className="w-8 h-8 text-violet-500" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-violet-700 text-lg">{ecm.code}</p>
                    <p className="text-sm text-gray-700 mt-0.5">{ecm.name}</p>
                    {ecm.brand_name && (
                      <div className="flex items-center gap-2 mt-2">
                        {ecm.brand_logo_url && (
                          <img src={ecm.brand_logo_url} alt={ecm.brand_name} className="h-5 rounded" />
                        )}
                        <span className="text-xs text-gray-500">{ecm.brand_name}</span>
                      </div>
                    )}
                  </div>
                </div>
                {ecm_stats.total_assignments !== undefined && (
                  <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-violet-50 rounded-xl border border-violet-100">
                      <p className="text-2xl font-bold text-violet-700">{ecm_stats.total_assignments}</p>
                      <p className="text-xs text-violet-600 mt-1">Asignaciones</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-xl border border-green-100">
                      <p className="text-2xl font-bold text-green-700">{ecm_stats.active_count ?? 0}</p>
                      <p className="text-xs text-green-600 mt-1">Activas</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-xl border border-orange-100">
                      <p className="text-2xl font-bold text-orange-700">{ecm_stats.expired_count ?? 0}</p>
                      <p className="text-xs text-orange-600 mt-1">Expiradas</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-2xl font-bold text-blue-700">{ecm_stats.total_retakes ?? 0}</p>
                      <p className="text-xs text-blue-600 mt-1">Retomas</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vigencia */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 rounded-lg">
                  <Calendar className="w-4 h-4 text-purple-600" />
                </div>
                Vigencia de la Asignación
              </h2>
            </div>
            <div className="p-4 space-y-0.5">
              <ConfigRow icon={Calendar} label="Meses de vigencia" value={`${assignment.validity_months || 0} meses`} color="purple" />
              <ConfigRow icon={Calendar} label="Fecha de expiración" value={
                assignment.expires_at ? (
                  <span className={assignment.is_expired ? 'text-orange-600 font-semibold' : 'text-green-600'}>
                    {formatDate(assignment.expires_at)}
                    {assignment.is_expired && ' (Expirada)'}
                  </span>
                ) : '—'
              } color="purple" />
              {(assignment.extended_months || 0) > 0 && (
                <ConfigRow icon={RefreshCw} label="Meses extendidos" value={`+${assignment.extended_months} meses`} color="green" />
              )}
              <ConfigRow icon={Calendar} label="Asignada el" value={formatDateTime(assignment.assigned_at)} color="gray" />
            </div>
          </div>

        </div>

        {/* ===== RIGHT COLUMN ===== */}
        <div className="flex flex-col gap-6">

          {/* Configuración del Grupo (Efectiva) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-1">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  Configuración del Grupo
                </h2>
                {group.use_custom_config && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg">Personalizada</span>
                )}
              </div>
            </div>
            <div className="p-4 space-y-0.5">
              <ConfigRow icon={Monitor} label="Versión de Office" value={officeLabels[eff.office_version] || eff.office_version} color="blue" />
              <div className="pt-2 pb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3">Niveles de Certificación</p>
              </div>
              <ConfigRow icon={Award} label="Constancia de Evaluación" value={<BoolBadge value={eff.enable_tier_basic} />} color="amber" />
              <ConfigRow icon={Award} label="Certificado Eduit" value={<BoolBadge value={eff.enable_tier_standard} />} color="amber" />
              <ConfigRow icon={Shield} label="Certificado CONOCER" value={<BoolBadge value={eff.enable_tier_advanced} />} color="violet" />
              <ConfigRow icon={Zap} label="Insignia Digital" value={<BoolBadge value={eff.enable_digital_badge} />} color="yellow" />
              <div className="pt-2 pb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3">Funcionalidades</p>
              </div>
              <ConfigRow icon={FileText} label="Evaluaciones Parciales" value={<BoolBadge value={eff.enable_partial_evaluations} />} color="blue" />
              <ConfigRow icon={Calendar} label="Parciales Sin Agendar" value={<BoolBadge value={eff.enable_unscheduled_partials} />} color="blue" />
              <ConfigRow icon={Monitor} label="Máquinas Virtuales" value={<BoolBadge value={eff.enable_virtual_machines} />} color="blue" />
              <ConfigRow icon={CreditCard} label="Pagos en Línea" value={<BoolBadge value={eff.enable_online_payments} />} color="blue" />
              <ConfigRow icon={Award} label="Certificados Visibles" value={<BoolBadge value={eff.enable_candidate_certificates} />} color="emerald" />
              <ConfigRow icon={Calendar} label="Calendario de Sesiones" value={<BoolBadge value={eff.enable_session_calendar} />} color="cyan" />
              {eff.enable_session_calendar && (
                <ConfigRow icon={Calendar} label="Modo de Agenda" value={
                  eff.session_scheduling_mode === 'candidate_self' ? 'Candidato agenda' : 'Solo líder'
                } color="cyan" />
              )}
              <div className="pt-2 pb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3">Costos y Límites</p>
              </div>
              <ConfigRow icon={DollarSign} label="Costo de Certificación" value={`$${eff.certification_cost || 0}`} color="green" />
              <ConfigRow icon={DollarSign} label="Costo de Retoma" value={`$${eff.retake_cost || 0}`} color="green" />
              <ConfigRow icon={RefreshCw} label="Retomas Máximas" value={
                (eff.max_retakes === 0 || eff.max_retakes === undefined) ? '∞ Ilimitado' : eff.max_retakes
              } color="amber" />
            </div>
          </div>

          {/* Materiales de Estudio */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-white">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <div className="p-1.5 bg-teal-100 rounded-lg">
                  <BookOpen className="w-4 h-4 text-teal-600" />
                </div>
                Materiales de Estudio
                {has_custom_materials && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg">Personalizados</span>
                )}
              </h2>
            </div>
            <div className="p-4">
              {assignment.study_materials && assignment.study_materials.length > 0 ? (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {assignment.study_materials.map((mat) => (
                    <div key={mat.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-teal-50 hover:border-teal-200 transition-colors">
                      {mat.cover_image_url ? (
                        <img src={mat.cover_image_url} alt={mat.title} className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
                      ) : (
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-5 h-5 text-teal-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{mat.title}</p>
                        {mat.description && (
                          <p className="text-xs text-gray-500 truncate">{mat.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Sin materiales asignados</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Miembros asignados (si son seleccionados) */}
      {assignment.assignment_type === 'selected' && assignment.assigned_members && assignment.assigned_members.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-6">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-white">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <div className="p-1.5 bg-sky-100 rounded-lg">
                  <Users className="w-4 h-4 text-sky-600" />
                </div>
                Miembros Asignados
                <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-xs font-bold rounded-full">{assignment.assigned_members.length}</span>
              </h2>
              <Link
                to={`/partners/groups/${groupId}/assignments/${examId}/edit-members?type=exam&name=${encodeURIComponent(exam?.name || 'Examen')}`}
                className="text-sm text-sky-600 hover:text-sky-800 font-medium flex items-center gap-1"
              >
                Ver detalle completo <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
            {assignment.assigned_members.map((member) => (
              <div key={member.id} className="px-5 py-3 flex items-center gap-3 hover:bg-sky-50/50 transition-colors">
                <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-sky-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {member.user?.full_name || member.user?.name || `Usuario ${member.user_id}`}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{member.user?.email}</p>
                </div>
                {member.assignment_number && (
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-mono font-bold rounded-md flex-shrink-0">
                    {member.assignment_number}
                  </span>
                )}
                <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(member.assigned_at)}</span>
                {member.ecm_assignment_id && (
                  <Link
                    to={`/asignaciones-ecm/candidato/${member.ecm_assignment_id}`}
                    className="p-1 text-sky-500 hover:text-sky-700 hover:bg-sky-50 rounded transition-colors flex-shrink-0"
                    title="Ver detalle individual"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
