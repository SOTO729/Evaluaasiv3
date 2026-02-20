/**
 * Detalle individual de asignación por candidato (EcmCandidateAssignment)
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Award, User, AlertCircle, CheckCircle2, XCircle, Clock, Target,
  Shield, FileText, Calendar, DollarSign, BookOpen, BarChart3, Hash, Building2,
  Layers, RefreshCw, ExternalLink, Trophy, Play, Timer, Download,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import {
  getCandidateAssignmentDetail,
  CandidateAssignmentDetailResponse,
} from '../../services/partnersService';

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return '\u2014';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador', developer: 'Desarrollador', coordinator: 'Coordinador', candidate: 'Candidato',
};
const certTypeLabels: Record<string, string> = {
  reporte_evaluacion: 'Reporte de Evaluación', certificado_eduit: 'Certificado EduIT',
  insignia_digital: 'Insignia Digital', certificado_conocer: 'Certificado CONOCER',
};
const certTypeColors: Record<string, string> = {
  reporte_evaluacion: 'bg-blue-50 text-blue-700', certificado_eduit: 'bg-purple-50 text-purple-700',
  insignia_digital: 'bg-amber-50 text-amber-700', certificado_conocer: 'bg-green-50 text-green-700',
};

function ConfigRow({ icon: Icon, label, value, color = 'gray' }: {
  icon: React.ElementType; label: string; value: React.ReactNode; color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600', amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600', sky: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600', gray: 'bg-gray-50 text-gray-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  const cls = colorMap[color] || colorMap.gray;
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50/50">
      <div className={`p-1 rounded ${cls}`}><Icon className="w-3.5 h-3.5" /></div>
      <span className="text-xs text-gray-500 min-w-[130px]">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value ?? '\u2014'}</span>
    </div>
  );
}

export default function CandidateAssignmentDetailPage() {
  const { ecaId } = useParams<{ ecaId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CandidateAssignmentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ecaId) return;
    setLoading(true);
    getCandidateAssignmentDetail(Number(ecaId))
      .then(setData)
      .catch((e) => setError(e?.response?.data?.error || 'Error al cargar el detalle'))
      .finally(() => setLoading(false));
  }, [ecaId]);

  if (loading) return <LoadingSpinner />;
  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-600 font-medium">{error || 'Asignación no encontrada'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sky-600 hover:text-sky-800 text-sm font-medium">&larr; Volver</button>
      </div>
    );
  }

  const { assignment, user, ecm, exam, group_exam, group, campus, partner, assigned_by, results, retakes, material_progress, materials_detail, certificate_types } = data;
  const completedResults = results.filter(r => r.status === 1);
  const passedResults = completedResults.filter(r => r.result === 1);
  const bestScore = completedResults.length > 0 ? Math.max(...completedResults.map(r => r.score ?? 0)) : null;
  const maxAttempts = group_exam?.max_attempts || 1;
  const totalAllowed = maxAttempts + retakes.length;
  const attemptsUsed = completedResults.length;
  const maxRetakes = group_exam?.max_retakes ?? 0;

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      <PartnersBreadcrumb items={[
        ...(group ? [
          { label: 'Grupos', path: '/partners' },
          { label: group.name, path: `/partners/groups/${group.id}` },
        ] : [{ label: 'Asignaciones ECM', path: '/asignaciones-ecm' }]),
        { label: `Asignación ${assignment.assignment_number || '#' + assignment.id}` },
      ]} />

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <button onClick={() => navigate(-1)} className="mt-1 p-2 hover:bg-white/10 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-white/20 rounded-md text-xs font-mono font-bold">
                  {assignment.assignment_number || `#${assignment.id}`}
                </span>
                {assignment.is_expired ? (
                  <span className="px-2 py-0.5 bg-red-500/30 text-red-100 rounded-md text-xs font-bold">Expirada</span>
                ) : (
                  <span className="px-2 py-0.5 bg-green-500/30 text-green-100 rounded-md text-xs font-bold">Activa</span>
                )}
              </div>
              <h1 className="text-xl md:text-2xl font-bold">{user.full_name}</h1>
              <p className="text-white/80 text-sm mt-0.5">{user.email} {user.curp && `\u00b7 ${user.curp}`}</p>
              <div className="flex items-center gap-3 mt-2 text-sm text-white/70">
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{roleLabels[user.role] || user.role}</span>
                {ecm && <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" />{ecm.code}</span>}
                {exam && <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{exam.name}</span>}
              </div>
            </div>
          </div>
          {group && (
            <Link to={`/partners/groups/${group.id}`} className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors">
              <Building2 className="w-3.5 h-3.5" /> {group.name}
            </Link>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-6">
        <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><div className="p-1 bg-indigo-100 rounded"><Trophy className="w-3.5 h-3.5 text-indigo-600" /></div><span className="text-xs text-gray-500">Mejor Calif.</span></div>
          <p className={`text-xl font-bold ${bestScore !== null && bestScore >= (group_exam?.passing_score || exam?.passing_score || 70) ? 'text-green-600' : bestScore !== null ? 'text-red-600' : 'text-gray-400'}`}>
            {bestScore !== null ? `${bestScore}%` : '\u2014'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><div className="p-1 bg-blue-100 rounded"><Play className="w-3.5 h-3.5 text-blue-600" /></div><span className="text-xs text-gray-500">Intentos</span></div>
          <p className="text-xl font-bold text-gray-800">{attemptsUsed}<span className="text-sm text-gray-400">/{totalAllowed}</span></p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><div className="p-1 bg-amber-100 rounded"><RefreshCw className="w-3.5 h-3.5 text-amber-600" /></div><span className="text-xs text-gray-500">Retomas</span></div>
          <p className="text-xl font-bold text-gray-800">{retakes.length}<span className="text-sm text-gray-400">/{maxRetakes === 0 ? '∞' : maxRetakes}</span></p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><div className="p-1 bg-green-100 rounded"><DollarSign className="w-3.5 h-3.5 text-green-600" /></div><span className="text-xs text-gray-500">Costo Cert.</span></div>
          <p className="text-xl font-bold text-gray-800">${(assignment as any).certification_cost || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><div className="p-1 bg-purple-100 rounded"><BookOpen className="w-3.5 h-3.5 text-purple-600" /></div><span className="text-xs text-gray-500">Material</span></div>
          <p className="text-xl font-bold text-gray-800">{material_progress ? `${material_progress.percentage}%` : '\u2014'}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className={`p-1 rounded ${passedResults.length > 0 ? 'bg-green-100' : completedResults.length > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
              {passedResults.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : completedResults.length > 0 ? <XCircle className="w-3.5 h-3.5 text-red-600" /> : <Clock className="w-3.5 h-3.5 text-gray-500" />}
            </div>
            <span className="text-xs text-gray-500">Estado</span>
          </div>
          <p className={`text-sm font-bold ${passedResults.length > 0 ? 'text-green-600' : completedResults.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>
            {passedResults.length > 0 ? 'Aprobado' : completedResults.length > 0 ? 'Reprobado' : 'Pendiente'}
          </p>
        </div>
      </div>

      {/* Main content: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Datos del Candidato */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 rounded-lg"><User className="w-4 h-4 text-indigo-600" /></div>Datos del Candidato
              </h2>
            </div>
            <div className="p-4 space-y-0.5">
              <ConfigRow icon={User} label="Nombre completo" value={user.full_name} color="indigo" />
              <ConfigRow icon={FileText} label="Email" value={user.email} color="blue" />
              {user.curp && <ConfigRow icon={Hash} label="CURP" value={user.curp} color="purple" />}
              {user.username && <ConfigRow icon={Hash} label="Usuario" value={user.username} color="gray" />}
              <ConfigRow icon={Shield} label="Rol" value={roleLabels[user.role] || user.role} color="sky" />
            </div>
          </div>

          {/* Datos de la Asignación */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-white">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <div className="p-1.5 bg-sky-100 rounded-lg"><Award className="w-4 h-4 text-sky-600" /></div>Datos de la Asignación
              </h2>
            </div>
            <div className="p-4 space-y-0.5">
              <ConfigRow icon={Hash} label="N\u00ba Asignación" value={
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{assignment.assignment_number}</span>
              } color="indigo" />
              <ConfigRow icon={Layers} label="Fuente" value={assignment.assignment_source === 'bulk' ? 'Masiva (todo el grupo)' : 'Seleccionada'} color="blue" />
              <ConfigRow icon={Calendar} label="Fecha de asignación" value={formatDate(assignment.assigned_at)} color="sky" />
              <ConfigRow icon={DollarSign} label="Costo unitario" value={`$${assignment.unit_cost}`} color="green" />
              {assigned_by && <ConfigRow icon={User} label="Asignado por" value={`${assigned_by.name} (${assigned_by.email})`} color="gray" />}
            </div>
          </div>

          {/* Vigencia */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-white">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 rounded-lg"><Calendar className="w-4 h-4 text-amber-600" /></div>Vigencia
                {assignment.is_expired ? (
                  <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">Expirada</span>
                ) : assignment.expires_at ? (
                  <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">Vigente</span>
                ) : null}
              </h2>
            </div>
            <div className="p-4 space-y-0.5">
              <ConfigRow icon={Calendar} label="Meses de vigencia" value={assignment.validity_months ? `${assignment.validity_months} meses` : 'Sin vigencia'} color="amber" />
              <ConfigRow icon={Clock} label="Vence" value={formatDate(assignment.expires_at)} color={assignment.is_expired ? 'red' : 'green'} />
              {assignment.extended_months > 0 && <ConfigRow icon={RefreshCw} label="Meses extendidos" value={`+${assignment.extended_months} meses`} color="blue" />}
            </div>
          </div>

          {/* Historial de Resultados */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <div className="p-1.5 bg-green-100 rounded-lg"><BarChart3 className="w-4 h-4 text-green-600" /></div>Historial de Resultados
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">{results.length}</span>
              </h2>
            </div>
            {results.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-gray-300" />Aún no hay intentos registrados
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {results.map((r, idx) => {
                  const attemptNum = results.length - idx;
                  const passed = r.result === 1;
                  return (
                    <div key={r.id} className="px-5 py-3 hover:bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${passed ? 'bg-green-100 text-green-700' : r.status === 1 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                          {attemptNum}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-lg font-bold ${passed ? 'text-green-600' : r.status === 1 ? 'text-red-600' : 'text-gray-500'}`}>
                              {r.score !== null ? `${r.score}%` : '\u2014'}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${passed ? 'bg-green-100 text-green-700' : r.status === 1 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {passed ? 'Aprobado' : r.status === 1 ? 'Reprobado' : 'En progreso'}
                            </span>
                            {r.certificate_code && <span className="text-xs text-purple-600 font-mono bg-purple-50 px-1.5 py-0.5 rounded">{r.certificate_code}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            {r.start_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDateTime(r.start_date)}</span>}
                            {r.duration_seconds && <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> {formatDuration(r.duration_seconds)}</span>}
                          </div>
                        </div>
                      </div>
                      {(r.report_url || r.certificate_url) && (
                        <div className="flex gap-3 mt-2 ml-11">
                          {r.report_url && <a href={r.report_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><Download className="w-3 h-3" /> Reporte</a>}
                          {r.certificate_url && <a href={r.certificate_url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"><Download className="w-3 h-3" /> Certificado</a>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Progreso de Material de Estudio */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 rounded-lg"><BookOpen className="w-4 h-4 text-purple-600" /></div>Material de Estudio
              </h2>
            </div>
            {!material_progress && materials_detail.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />Sin materiales asignados
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {material_progress && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">Progreso Total</span>
                      <span className="text-sm font-bold text-purple-600">{material_progress.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full transition-all ${material_progress.percentage >= 100 ? 'bg-green-500' : material_progress.percentage >= 50 ? 'bg-purple-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(material_progress.percentage, 100)}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{material_progress.completed} / {material_progress.total} temas completados</p>
                  </div>
                )}
                {materials_detail.map(mat => (
                  <div key={mat.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 font-medium truncate">{mat.name}</span>
                      <span className="text-xs font-bold text-gray-600">{mat.topics_completed}/{mat.topics_total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`h-2 rounded-full ${mat.percentage >= 100 ? 'bg-green-500' : mat.percentage >= 50 ? 'bg-purple-400' : 'bg-amber-400'}`} style={{ width: `${Math.min(mat.percentage, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* ECM Info */}
          {ecm && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-white">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <div className="p-1.5 bg-violet-100 rounded-lg"><Shield className="w-4 h-4 text-violet-600" /></div>Estándar de Competencia (ECM)
                </h2>
              </div>
              <div className="p-4 space-y-0.5">
                <ConfigRow icon={Hash} label="Código" value={
                  <Link to={`/asignaciones-ecm/${ecm.id}`} className="text-sky-600 hover:text-sky-800 font-medium flex items-center gap-1">{ecm.code} <ExternalLink className="w-3 h-3" /></Link>
                } color="violet" />
                <ConfigRow icon={FileText} label="Nombre" value={ecm.name} color="purple" />
                {ecm.sector && <ConfigRow icon={Building2} label="Sector" value={ecm.sector} color="blue" />}
                {ecm.level && <ConfigRow icon={Layers} label="Nivel" value={ecm.level} color="sky" />}
                {ecm.certifying_body && <ConfigRow icon={Award} label="Organismo certificador" value={ecm.certifying_body} color="green" />}
              </div>
            </div>
          )}

          {/* Config del Examen */}
          {group_exam && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg"><FileText className="w-4 h-4 text-blue-600" /></div>Configuración de la Asignación
                </h2>
              </div>
              <div className="p-4 space-y-0.5">
                {exam && <ConfigRow icon={FileText} label="Examen" value={exam.name} color="blue" />}
                {exam?.version && <ConfigRow icon={Hash} label="Versión" value={exam.version} color="gray" />}
                <ConfigRow icon={Clock} label="Tiempo límite" value={group_exam.time_limit_minutes ? `${group_exam.time_limit_minutes} min` : 'Sin límite'} color="purple" />
                <ConfigRow icon={Target} label="Calificación mínima" value={`${group_exam.passing_score || exam?.passing_score || 70}%`} color="green" />
                <ConfigRow icon={Play} label="Intentos máximos" value={group_exam.max_attempts || 1} color="blue" />
                <ConfigRow icon={RefreshCw} label="Retomas máximas" value={group_exam.max_retakes === 0 ? '\u221e Ilimitado' : group_exam.max_retakes} color="amber" />
                <ConfigRow icon={Layers} label="Tipo de contenido" value={group_exam.content_type || 'standard'} color="sky" />
                <ConfigRow icon={Calendar} label="Fecha de asignación" value={formatDate(group_exam.assigned_at)} color="gray" />
                {group_exam.validity_months && <ConfigRow icon={Calendar} label="Vigencia (config)" value={`${group_exam.validity_months} meses`} color="amber" />}
              </div>
            </div>
          )}

          {/* Contexto organizacional */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <div className="p-1.5 bg-gray-100 rounded-lg"><Building2 className="w-4 h-4 text-gray-600" /></div>Contexto Organizacional
              </h2>
            </div>
            <div className="p-4 space-y-0.5">
              {group && (
                <ConfigRow icon={Layers} label="Grupo" value={
                  <Link to={`/partners/groups/${group.id}`} className="text-sky-600 hover:text-sky-800 font-medium flex items-center gap-1">
                    {group.name} {group.code && <span className="text-gray-400 text-xs">({group.code})</span>} <ExternalLink className="w-3 h-3" />
                  </Link>
                } color="sky" />
              )}
              {campus && (
                <ConfigRow icon={Building2} label="Plantel" value={
                  <Link to={`/partners/campuses/${campus.id}`} className="text-sky-600 hover:text-sky-800 font-medium flex items-center gap-1">{campus.name} <ExternalLink className="w-3 h-3" /></Link>
                } color="blue" />
              )}
              {campus?.state_name && <ConfigRow icon={Building2} label="Estado" value={campus.state_name} color="gray" />}
              {partner && (
                <ConfigRow icon={Building2} label="Partner" value={
                  <Link to={`/partners/${partner.id}`} className="text-sky-600 hover:text-sky-800 font-medium flex items-center gap-1">{partner.name} <ExternalLink className="w-3 h-3" /></Link>
                } color="purple" />
              )}
            </div>
          </div>

          {/* Certificados habilitados */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <div className="p-1.5 bg-green-100 rounded-lg"><Award className="w-4 h-4 text-green-600" /></div>Certificados Habilitados
              </h2>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {(certificate_types || []).map(ct => (
                <span key={ct} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${certTypeColors[ct] || 'bg-gray-50 text-gray-700'}`}>
                  <Award className="w-3.5 h-3.5" />{certTypeLabels[ct] || ct}
                </span>
              ))}
            </div>
          </div>

          {/* Historial de Retomas */}
          {retakes.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-white">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <div className="p-1.5 bg-amber-100 rounded-lg"><RefreshCw className="w-4 h-4 text-amber-600" /></div>Historial de Retomas
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">{retakes.length}</span>
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {retakes.map((rt, idx) => (
                  <div key={rt.id} className="px-5 py-3 flex items-center gap-3 hover:bg-amber-50/30">
                    <div className="w-8 h-8 bg-amber-50 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-amber-600">{retakes.length - idx}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${rt.status === 'active' ? 'bg-green-100 text-green-700' : rt.status === 'used' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                          {rt.status === 'active' ? 'Activa' : rt.status === 'used' ? 'Usada' : 'Expirada'}
                        </span>
                        <span className="text-xs text-gray-500">${rt.cost}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(rt.applied_at)}
                        {rt.applied_by && ` \u00b7 por ${rt.applied_by.name}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
