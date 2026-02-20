/**
 * Dashboard de Grupo - Hub central
 * Métricas, flujo de asignación de examen en 4 pasos, y secciones del grupo
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Building2,
  Settings,
  Download,
  ClipboardList,
  Award,
  ChevronRight,
  UserPlus,
  AlertTriangle,
  Clock,
  Target,
  Sparkles,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Layers,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import {
  getGroup,
  getGroupMembers,
  getGroupExams,
  getGroupStudyMaterials,
  exportGroupMembersToExcel,
  CandidateGroup,
  GroupMember,
  GroupExamAssignment,
  GroupStudyMaterialAssignment,
  EligibilitySummary,
} from '../../services/partnersService';

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const justCreated = searchParams.get('created') === 'true';
  
  const [showSuccessModal, setShowSuccessModal] = useState(justCreated);
  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [assignedExams, setAssignedExams] = useState<GroupExamAssignment[]>([]);
  const [directMaterials, setDirectMaterials] = useState<GroupStudyMaterialAssignment[]>([]);
  const [eligibilitySummary, setEligibilitySummary] = useState<EligibilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    loadData();
  }, [groupId, location.key]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupData, membersData, examsData, materialsData] = await Promise.all([
        getGroup(Number(groupId)),
        getGroupMembers(Number(groupId)),
        getGroupExams(Number(groupId)),
        getGroupStudyMaterials(Number(groupId)).catch(() => ({ assigned_materials: [] })),
      ]);
      setGroup(groupData);
      setMembers(membersData.members);
      setEligibilitySummary(membersData.eligibility_summary || null);
      setAssignedExams(examsData.assigned_exams);
      setDirectMaterials(materialsData.assigned_materials || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el grupo');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const blob = await exportGroupMembersToExcel(Number(groupId));
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Reporte_${group?.name?.replace(/\s+/g, '_') || 'Grupo'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al exportar');
    } finally {
      setExportingExcel(false);
    }
  };

  const stats = {
    totalMembers: members.length,
    certified: members.filter(m => m.certification_status === 'certified').length,
    inProgress: members.filter(m => m.certification_status === 'in_progress').length,
    pending: members.filter(m => !m.certification_status || m.certification_status === 'pending').length,
    totalExams: assignedExams.length,
    totalMaterials: directMaterials.length + assignedExams.reduce((acc, e) => acc + (e.study_materials?.length || 0), 0),
    withWarnings: (eligibilitySummary?.members_without_curp || 0) + (eligibilitySummary?.members_without_email || 0),
  };

  const certRate = stats.totalMembers > 0 ? Math.round((stats.certified / stats.totalMembers) * 100) : 0;

  // Workflow contextual
  const getWorkflowStatus = () => {
    if (stats.totalMembers === 0) return { step: 0, color: 'purple' as const, message: 'Agrega miembros para comenzar', desc: 'El primer paso es agregar los miembros que participarán', btn: 'Agregar Miembros', link: `/partners/groups/${groupId}/assign-candidates` };
    if (stats.totalExams === 0) return { step: 1, color: 'blue' as const, message: 'Asigna una certificación', desc: `${stats.totalMembers} miembros listos. Asigna un examen para evaluarlos`, btn: 'Asignar Examen', link: `/partners/groups/${groupId}/assign-exam` };
    if (stats.certified > 0) return { step: 3, color: 'emerald' as const, message: `¡${stats.certified} certificados disponibles!`, desc: 'Descarga certificados e insignias digitales', btn: 'Ver Documentos', link: `/partners/groups/${groupId}/documents` };
    if (stats.inProgress > 0) return { step: 2, color: 'sky' as const, message: `${stats.inProgress} evaluaciones en curso`, desc: 'Los miembros están presentando sus exámenes', btn: 'Ver Progreso', link: `/partners/groups/${groupId}/members` };
    return { step: 2, color: 'amber' as const, message: 'Esperando evaluaciones', desc: 'Los miembros ya pueden presentar sus exámenes', btn: 'Ver Miembros', link: `/partners/groups/${groupId}/members` };
  };
  const wf = getWorkflowStatus();

  const colorMap = {
    purple: { bg: 'from-purple-50 to-indigo-50', border: 'border-purple-200', icon: 'bg-purple-100', text: 'text-purple-600', textDark: 'text-purple-800', btn: 'bg-purple-600 hover:bg-purple-700' },
    blue: { bg: 'from-blue-50 to-cyan-50', border: 'border-blue-200', icon: 'bg-blue-100', text: 'text-blue-600', textDark: 'text-blue-800', btn: 'bg-blue-600 hover:bg-blue-700' },
    amber: { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', icon: 'bg-amber-100', text: 'text-amber-600', textDark: 'text-amber-800', btn: 'bg-amber-600 hover:bg-amber-700' },
    emerald: { bg: 'from-emerald-50 to-green-50', border: 'border-emerald-200', icon: 'bg-emerald-100', text: 'text-emerald-600', textDark: 'text-emerald-800', btn: 'bg-emerald-600 hover:bg-emerald-700' },
    sky: { bg: 'from-sky-50 to-blue-50', border: 'border-sky-200', icon: 'bg-sky-100', text: 'text-sky-600', textDark: 'text-sky-800', btn: 'bg-sky-600 hover:bg-sky-700' },
  };
  const c = colorMap[wf.color];

  if (loading) return <div className="fluid-p-6 max-w-[2800px] mx-auto"><LoadingSpinner message="Cargando grupo..." /></div>;

  if (error || !group) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700 fluid-text-base">{error || 'Grupo no encontrado'}</p>
          <Link to="/partners" className="ml-auto text-red-700 underline fluid-text-base">Volver</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      <PartnersBreadcrumb items={[
        { label: group.campus?.partner?.name || 'Partner', path: `/partners/${group.campus?.partner_id}` },
        { label: group.campus?.name || 'Plantel', path: `/partners/campuses/${group.campus_id}` },
        { label: group.name },
      ]} />

      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
        
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <Link to={`/partners/campuses/${group.campus_id}`} className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors">
              <ArrowLeft className="fluid-icon-lg" />
            </Link>
            <div>
              <div className="flex items-center fluid-gap-2 fluid-text-sm text-white/80 fluid-mb-1">
                <Building2 className="fluid-icon-sm" />
                <span>{group.campus?.name}</span>
                {group.campus?.partner?.name && <><span>•</span><span>{group.campus.partner.name}</span></>}
              </div>
              <div className="flex items-center fluid-gap-3">
                <h1 className="fluid-text-2xl font-bold">{group.name}</h1>
                <span className={`inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-medium ${group.is_active ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'}`}>
                  {group.is_active ? <><CheckCircle2 className="fluid-icon-xs" />Activo</> : <><XCircle className="fluid-icon-xs" />Inactivo</>}
                </span>
              </div>
              {group.description && <p className="fluid-text-sm text-white/70 fluid-mt-1">{group.description}</p>}
            </div>
          </div>
          
          <div className="flex items-center fluid-gap-2">
            {members.length > 0 && (
              <button onClick={handleExportExcel} disabled={exportingExcel}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/10 hover:bg-white/20 text-white rounded-fluid-xl font-medium fluid-text-sm transition-all border border-white/20 disabled:opacity-50">
                {exportingExcel ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Download className="fluid-icon-sm" />}
                <span className="hidden sm:inline">Exportar</span>
              </button>
            )}
            <Link to={`/partners/groups/${groupId}/edit`}
              className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white hover:bg-gray-100 text-purple-600 rounded-fluid-xl font-medium fluid-text-sm transition-all shadow-lg">
              <Settings className="fluid-icon-sm" /><span className="hidden sm:inline">Configurar</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ===== MÉTRICAS RÁPIDAS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 fluid-gap-4 fluid-mb-6">
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-2.5 bg-purple-100 rounded-fluid-lg"><Users className="fluid-icon-base text-purple-600" /></div>
            <div>
              <p className="fluid-text-2xl font-bold text-gray-900">{stats.totalMembers}</p>
              <p className="fluid-text-xs text-gray-500">Miembros</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-2.5 bg-blue-100 rounded-fluid-lg"><ClipboardList className="fluid-icon-base text-blue-600" /></div>
            <div>
              <p className="fluid-text-2xl font-bold text-gray-900">{stats.totalExams}</p>
              <p className="fluid-text-xs text-gray-500">Certificaciones</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-2.5 bg-emerald-100 rounded-fluid-lg"><Award className="fluid-icon-base text-emerald-600" /></div>
            <div>
              <p className="fluid-text-2xl font-bold text-emerald-600">{stats.certified}</p>
              <p className="fluid-text-xs text-gray-500">Certificados</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-2.5 bg-sky-100 rounded-fluid-lg"><TrendingUp className="fluid-icon-base text-sky-600" /></div>
            <div>
              <p className="fluid-text-2xl font-bold text-sky-600">{certRate}%</p>
              <p className="fluid-text-xs text-gray-500">Tasa certificación</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== PRÓXIMO PASO CONTEXTUAL ===== */}
      {group.is_active && (
        <div className={`rounded-fluid-2xl fluid-p-5 fluid-mb-6 border-2 bg-gradient-to-r ${c.bg} ${c.border}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
            <div className="flex items-start fluid-gap-4">
              <div className={`fluid-p-3 rounded-fluid-xl ${c.icon}`}><Sparkles className={`fluid-icon-lg ${c.text}`} /></div>
              <div>
                <h3 className={`fluid-text-lg font-bold ${c.textDark}`}>{wf.message}</h3>
                <p className={`fluid-text-sm fluid-mt-1 ${c.text}`}>{wf.desc}</p>
              </div>
            </div>
            <Link to={wf.link}
              className={`inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-3 rounded-fluid-xl font-semibold fluid-text-sm shadow-lg transition-all whitespace-nowrap text-white ${c.btn}`}>
              {wf.btn}<ArrowRight className="fluid-icon-sm" />
            </Link>
          </div>
        </div>
      )}

      {/* ===== ALERTA ELEGIBILIDAD ===== */}
      {stats.withWarnings > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-fluid-xl fluid-p-4 fluid-mb-6">
          <div className="flex items-start fluid-gap-3">
            <AlertTriangle className="fluid-icon-lg text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-amber-800 fluid-text-sm fluid-mb-1">Datos incompletos</h4>
              <p className="fluid-text-sm text-amber-700">{eligibilitySummary?.members_without_curp || 0} sin CURP • {eligibilitySummary?.members_without_email || 0} sin email</p>
            </div>
            <Link to={`/partners/groups/${groupId}/members`} className="inline-flex items-center fluid-gap-1 fluid-text-sm text-amber-800 font-medium hover:underline whitespace-nowrap">
              Ver detalles <ChevronRight className="fluid-icon-xs" />
            </Link>
          </div>
        </div>
      )}

      {/* ===== SECCIONES DEL GRUPO — Grid horizontal ===== */}
      <div className="grid grid-cols-3 fluid-gap-4 fluid-mb-6">
        {/* Miembros */}
        <Link to={`/partners/groups/${groupId}/members`}
          className="block bg-white rounded-fluid-xl border border-gray-200 hover:shadow-lg hover:border-purple-300 transition-all duration-200 group">
          <div className="fluid-p-4">
            <div className="flex items-center fluid-gap-3 fluid-mb-3">
              <div className="fluid-p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-fluid-lg shadow group-hover:scale-110 transition-transform">
                <Users className="fluid-icon-sm text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="fluid-text-sm font-bold text-gray-900 group-hover:text-purple-700 transition-colors">Miembros</h3>
                <p className="fluid-text-xs text-gray-400">Gestionar integrantes</p>
              </div>
              <ChevronRight className="fluid-icon-sm text-gray-300 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </div>
            <div className="grid grid-cols-3 fluid-gap-1 fluid-pt-2 border-t border-gray-100">
              <div className="text-center"><p className="fluid-text-base font-bold text-gray-900">{stats.totalMembers}</p><p className="fluid-text-xs text-gray-400">Total</p></div>
              <div className="text-center"><p className="fluid-text-base font-bold text-emerald-600">{stats.certified}</p><p className="fluid-text-xs text-gray-400">Cert.</p></div>
              <div className="text-center"><p className="fluid-text-base font-bold text-sky-600">{stats.inProgress}</p><p className="fluid-text-xs text-gray-400">En curso</p></div>
            </div>
          </div>
        </Link>

        {/* Documentos */}
        <Link to={`/partners/groups/${groupId}/documents`}
          className="block bg-white rounded-fluid-xl border border-gray-200 hover:shadow-lg hover:border-emerald-300 transition-all duration-200 group">
          <div className="fluid-p-4">
            <div className="flex items-center fluid-gap-3 fluid-mb-3">
              <div className="fluid-p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-fluid-lg shadow group-hover:scale-110 transition-transform">
                <Award className="fluid-icon-sm text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="fluid-text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">Documentos</h3>
                <p className="fluid-text-xs text-gray-400">Certificados e insignias</p>
              </div>
              <ChevronRight className="fluid-icon-sm text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </div>
            <div className="grid grid-cols-2 fluid-gap-1 fluid-pt-2 border-t border-gray-100">
              <div className="text-center"><p className="fluid-text-base font-bold text-emerald-600">{stats.certified}</p><p className="fluid-text-xs text-gray-400">Listos</p></div>
              <div className="text-center"><p className="fluid-text-base font-bold text-gray-900">{stats.totalExams}</p><p className="fluid-text-xs text-gray-400">Cert.</p></div>
            </div>
          </div>
        </Link>

        {/* Analítica */}
        <Link to={`/partners/groups/${groupId}/analytics`}
          className="block bg-white rounded-fluid-xl border border-gray-200 hover:shadow-lg hover:border-indigo-300 transition-all duration-200 group">
          <div className="fluid-p-4">
            <div className="flex items-center fluid-gap-3 fluid-mb-3">
              <div className="fluid-p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-fluid-lg shadow group-hover:scale-110 transition-transform">
                <BarChart3 className="fluid-icon-sm text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="fluid-text-sm font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">Analítica</h3>
                <p className="fluid-text-xs text-gray-400">Dashboard del grupo</p>
              </div>
              <ChevronRight className="fluid-icon-sm text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </div>
            <div className="grid grid-cols-2 fluid-gap-1 fluid-pt-2 border-t border-gray-100">
              <div className="text-center"><p className="fluid-text-base font-bold text-indigo-600">{certRate}%</p><p className="fluid-text-xs text-gray-400">Tasa</p></div>
              <div className="text-center"><p className="fluid-text-base font-bold text-gray-900">{stats.totalMembers}</p><p className="fluid-text-xs text-gray-400">Miembros</p></div>
            </div>
          </div>
        </Link>
      </div>

      {/* ===== CERTIFICACIONES ACTIVAS (full width) ===== */}
      {assignedExams.length > 0 && (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden fluid-mb-6">
          <div className="fluid-px-6 fluid-py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center fluid-gap-3">
                <ClipboardList className="fluid-icon-base text-blue-600" />
                <h3 className="font-semibold text-gray-900">Certificaciones Activas</h3>
                <span className="fluid-px-2 fluid-py-0.5 bg-blue-100 text-blue-700 fluid-text-xs font-bold rounded-full">{assignedExams.length}</span>
              </div>
              {stats.totalMembers > 0 && group.is_active && (
                <Link to={`/partners/groups/${groupId}/assign-exam`}
                  className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-fluid-xl font-semibold fluid-text-sm transition-all shadow-sm hover:shadow-md">
                  <Layers className="fluid-icon-sm" />Asignar Nueva Certificación
                </Link>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
            {assignedExams.map((assignment) => (
              <Link key={assignment.id} to={`/partners/groups/${groupId}/assignments/${assignment.exam_id}/detail`}
                className="fluid-px-6 fluid-py-4 flex items-center justify-between hover:bg-blue-50/50 transition-colors block group">
                <div className="flex items-center fluid-gap-4 flex-1 min-w-0">
                  <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg flex-shrink-0">
                    <Award className="fluid-icon-base text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">{assignment.exam?.name}</p>
                    <div className="flex items-center fluid-gap-3 fluid-text-xs text-gray-500 fluid-mt-0.5">
                      <span className="inline-flex items-center fluid-gap-1"><Clock className="fluid-icon-xs" />{assignment.time_limit_minutes || assignment.exam?.duration_minutes || 0} min</span>
                      <span className="inline-flex items-center fluid-gap-1"><Target className="fluid-icon-xs" />{assignment.passing_score || assignment.exam?.passing_score || 70}%</span>
                      <span className="inline-flex items-center fluid-gap-1"><Users className="fluid-icon-xs" />{assignment.assignment_type === 'all' ? 'Todos' : `${assignment.assigned_members_count || 0}`}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center fluid-gap-2 flex-shrink-0">
                  {/* Vigencia badge */}
                  {assignment.expires_at && (
                    assignment.is_expired ? (
                      <span className="fluid-px-2 fluid-py-1 bg-orange-100 text-orange-700 fluid-text-xs font-bold rounded-fluid-lg inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expirada
                      </span>
                    ) : (
                      <span className="fluid-px-2 fluid-py-1 bg-green-100 text-green-700 fluid-text-xs font-medium rounded-fluid-lg inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Hasta {new Date(assignment.expires_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </span>
                    )
                  )}
                  {assignment.exam?.ecm?.code && (
                    <span className="fluid-px-2 fluid-py-1 bg-purple-100 text-purple-700 fluid-text-xs font-bold rounded-fluid-lg">
                      {assignment.exam.ecm.code}
                    </span>
                  )}
                  <ChevronRight className="fluid-icon-sm text-gray-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ===== ESTADO VACÍO ===== */}
      {members.length === 0 && assignedExams.length === 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-fluid-2xl border-2 border-dashed border-purple-200 fluid-p-12 text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto fluid-mb-4">
            <Users className="fluid-icon-2xl text-purple-500" />
          </div>
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-2">¡Grupo listo para comenzar!</h3>
          <p className="fluid-text-base text-gray-500 max-w-md mx-auto fluid-mb-6">El primer paso es agregar miembros al grupo para luego asignarles certificaciones</p>
          {group.is_active && (
            <Link to={`/partners/groups/${groupId}/assign-candidates`}
              className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-fluid-xl font-semibold transition-colors shadow-lg">
              <UserPlus className="fluid-icon-base" />Agregar Miembros
            </Link>
          )}
        </div>
      )}

      {/* ===== MODAL ÉXITO ===== */}
      {showSuccessModal && group && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 cursor-pointer bg-black/50"
          onClick={() => { setShowSuccessModal(false); searchParams.delete('created'); setSearchParams(searchParams, { replace: true }); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border-2 border-green-200 animate-[bounceIn_0.6s_ease-out] cursor-default" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-[scaleIn_0.4s_ease-out_0.2s_both]">
                <CheckCircle2 className="w-16 h-16 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-green-800 mb-3">¡Grupo creado exitosamente!</h3>
              <p className="text-green-700 mb-8">El grupo <span className="font-semibold">{group.name}</span> ha sido creado.</p>
              <button onClick={() => { setShowSuccessModal(false); searchParams.delete('created'); setSearchParams(searchParams, { replace: true }); }}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors">Aceptar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes scaleIn {
          0% { opacity: 0; transform: scale(0); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
