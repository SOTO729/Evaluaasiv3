/**
 * Dashboard de Grupo - Vista principal simplificada
 * Cards resumen con navegación a subpáginas dedicadas
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
  BookOpen,
  Award,
  ChevronRight,
  UserPlus,
  Plus,
  AlertTriangle,
  Clock,
  Target,
  FileText,
  MapPin,
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

  // Estadísticas calculadas
  const stats = {
    totalMembers: members.length,
    certified: members.filter(m => m.certification_status === 'certified').length,
    inProgress: members.filter(m => m.certification_status === 'in_progress').length,
    pending: members.filter(m => !m.certification_status || m.certification_status === 'pending').length,
    totalExams: assignedExams.length,
    totalMaterials: directMaterials.length + assignedExams.reduce((acc, e) => acc + (e.study_materials?.length || 0), 0),
    withWarnings: (eligibilitySummary?.members_without_curp || 0) + (eligibilitySummary?.members_without_email || 0),
  };

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando grupo..." />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700 fluid-text-base">{error || 'Grupo no encontrado'}</p>
          <Link to="/partners" className="ml-auto text-red-700 underline fluid-text-base">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb 
        items={[
          { label: group.campus?.partner?.name || 'Partner', path: `/partners/${group.campus?.partner_id}` },
          { label: group.campus?.name || 'Plantel', path: `/partners/campuses/${group.campus_id}` },
          { label: group.name }
        ]} 
      />

      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <Link
              to={`/partners/campuses/${group.campus_id}`}
              className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors"
            >
              <ArrowLeft className="fluid-icon-lg" />
            </Link>
            <div>
              <div className="flex items-center fluid-gap-2 fluid-text-sm text-white/80 fluid-mb-1">
                <Building2 className="fluid-icon-sm" />
                <span>{group.campus?.name}</span>
                {group.campus?.partner?.name && (
                  <>
                    <span>•</span>
                    <span>{group.campus.partner.name}</span>
                  </>
                )}
              </div>
              <div className="flex items-center fluid-gap-3">
                <h1 className="fluid-text-2xl font-bold">{group.name}</h1>
                {group.is_active ? (
                  <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-medium bg-white/20 text-white">
                    <CheckCircle2 className="fluid-icon-xs" />
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-medium bg-white/20 text-white/70">
                    <XCircle className="fluid-icon-xs" />
                    Inactivo
                  </span>
                )}
              </div>
              {group.description && (
                <p className="fluid-text-sm text-white/70 fluid-mt-1">{group.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center fluid-gap-2">
            {members.length > 0 && (
              <button
                onClick={handleExportExcel}
                disabled={exportingExcel}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/10 hover:bg-white/20 text-white rounded-fluid-xl font-medium fluid-text-sm transition-all border border-white/20 disabled:opacity-50"
              >
                {exportingExcel ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Download className="fluid-icon-sm" />
                )}
                <span className="hidden sm:inline">Exportar</span>
              </button>
            )}
            <Link
              to={`/partners/groups/${groupId}/edit`}
              className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white hover:bg-gray-100 text-purple-600 rounded-fluid-xl font-medium fluid-text-sm transition-all shadow-lg"
            >
              <Settings className="fluid-icon-sm" />
              <span className="hidden sm:inline">Configurar</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-4 fluid-mb-6">
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-3 bg-purple-100 rounded-fluid-lg">
              <Users className="fluid-icon-base text-purple-600" />
            </div>
            <div>
              <p className="fluid-text-2xl font-bold text-gray-900">{stats.totalMembers}</p>
              <p className="fluid-text-xs text-gray-500">Candidatos</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-3 bg-emerald-100 rounded-fluid-lg">
              <Award className="fluid-icon-base text-emerald-600" />
            </div>
            <div>
              <p className="fluid-text-2xl font-bold text-gray-900">{stats.certified}</p>
              <p className="fluid-text-xs text-gray-500">Certificados</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-3 bg-blue-100 rounded-fluid-lg">
              <ClipboardList className="fluid-icon-base text-blue-600" />
            </div>
            <div>
              <p className="fluid-text-2xl font-bold text-gray-900">{stats.totalExams}</p>
              <p className="fluid-text-xs text-gray-500">Certificaciones</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-3 bg-green-100 rounded-fluid-lg">
              <BookOpen className="fluid-icon-base text-green-600" />
            </div>
            <div>
              <p className="fluid-text-2xl font-bold text-gray-900">{stats.totalMaterials}</p>
              <p className="fluid-text-xs text-gray-500">Materiales</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de elegibilidad (solo si hay warnings) */}
      {stats.withWarnings > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-fluid-xl fluid-p-4 fluid-mb-6">
          <div className="flex items-start fluid-gap-3">
            <AlertTriangle className="fluid-icon-lg text-amber-600 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-amber-800 fluid-text-sm fluid-mb-1">
                Atención: Datos incompletos
              </h4>
              <p className="fluid-text-sm text-amber-700">
                {eligibilitySummary?.members_without_curp || 0} candidatos sin CURP • {eligibilitySummary?.members_without_email || 0} sin email
              </p>
              <Link
                to={`/partners/groups/${groupId}/members`}
                className="inline-flex items-center fluid-gap-1 fluid-text-sm text-amber-800 font-medium hover:underline fluid-mt-2"
              >
                Ver detalles <ChevronRight className="fluid-icon-xs" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Cards de navegación a secciones */}
      <div className="grid lg:grid-cols-3 fluid-gap-6">
        
        {/* Card: Candidatos */}
        <Link
          to={`/partners/groups/${groupId}/members`}
          className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-purple-300 transition-all duration-300 group overflow-hidden"
        >
          <div className="fluid-p-6">
            <div className="flex items-center justify-between fluid-mb-4">
              <div className="fluid-p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-fluid-xl shadow-lg group-hover:scale-110 transition-transform">
                <Users className="fluid-icon-lg text-white" />
              </div>
              <ChevronRight className="fluid-icon-lg text-gray-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
            </div>
            
            <h3 className="fluid-text-lg font-bold text-gray-900 fluid-mb-2 group-hover:text-purple-700 transition-colors">
              Candidatos
            </h3>
            <p className="fluid-text-sm text-gray-500 fluid-mb-4">
              Gestiona los miembros del grupo, asignaciones y elegibilidad
            </p>
            
            <div className="grid grid-cols-3 fluid-gap-2 fluid-pt-4 border-t border-gray-100">
              <div className="text-center">
                <p className="fluid-text-xl font-bold text-gray-900">{stats.totalMembers}</p>
                <p className="fluid-text-xs text-gray-500">Total</p>
              </div>
              <div className="text-center">
                <p className="fluid-text-xl font-bold text-emerald-600">{stats.certified}</p>
                <p className="fluid-text-xs text-gray-500">Certificados</p>
              </div>
              <div className="text-center">
                <p className="fluid-text-xl font-bold text-blue-600">{stats.inProgress}</p>
                <p className="fluid-text-xs text-gray-500">En proceso</p>
              </div>
            </div>
          </div>
          
          {/* Quick actions footer */}
          <div className="bg-gray-50 fluid-px-6 fluid-py-3 border-t border-gray-100">
            <div className="flex items-center fluid-gap-4">
              {group.is_active && (
                <span className="inline-flex items-center fluid-gap-1 fluid-text-xs text-purple-600 font-medium">
                  <UserPlus className="fluid-icon-xs" />
                  Agregar candidatos
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Card: Certificaciones */}
        <Link
          to={`/partners/groups/${groupId}/exams`}
          className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all duration-300 group overflow-hidden"
        >
          <div className="fluid-p-6">
            <div className="flex items-center justify-between fluid-mb-4">
              <div className="fluid-p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-fluid-xl shadow-lg group-hover:scale-110 transition-transform">
                <ClipboardList className="fluid-icon-lg text-white" />
              </div>
              <ChevronRight className="fluid-icon-lg text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </div>
            
            <h3 className="fluid-text-lg font-bold text-gray-900 fluid-mb-2 group-hover:text-blue-700 transition-colors">
              Certificaciones
            </h3>
            <p className="fluid-text-sm text-gray-500 fluid-mb-4">
              Exámenes, materiales de estudio y configuración de evaluaciones
            </p>
            
            <div className="grid grid-cols-2 fluid-gap-2 fluid-pt-4 border-t border-gray-100">
              <div className="text-center">
                <p className="fluid-text-xl font-bold text-gray-900">{stats.totalExams}</p>
                <p className="fluid-text-xs text-gray-500">Exámenes</p>
              </div>
              <div className="text-center">
                <p className="fluid-text-xl font-bold text-green-600">{stats.totalMaterials}</p>
                <p className="fluid-text-xs text-gray-500">Materiales</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 fluid-px-6 fluid-py-3 border-t border-gray-100">
            <div className="flex items-center fluid-gap-4">
              {members.length > 0 && (
                <span className="inline-flex items-center fluid-gap-1 fluid-text-xs text-blue-600 font-medium">
                  <Plus className="fluid-icon-xs" />
                  Asignar certificación
                </span>
              )}
              {members.length === 0 && (
                <span className="inline-flex items-center fluid-gap-1 fluid-text-xs text-gray-400">
                  Primero agrega candidatos
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Card: Documentos */}
        <Link
          to={`/partners/groups/${groupId}/documents`}
          className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-emerald-300 transition-all duration-300 group overflow-hidden"
        >
          <div className="fluid-p-6">
            <div className="flex items-center justify-between fluid-mb-4">
              <div className="fluid-p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-fluid-xl shadow-lg group-hover:scale-110 transition-transform">
                <Award className="fluid-icon-lg text-white" />
              </div>
              <ChevronRight className="fluid-icon-lg text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </div>
            
            <h3 className="fluid-text-lg font-bold text-gray-900 fluid-mb-2 group-hover:text-emerald-700 transition-colors">
              Documentos
            </h3>
            <p className="fluid-text-sm text-gray-500 fluid-mb-4">
              Certificados, insignias digitales y reportes de evaluación
            </p>
            
            <div className="grid grid-cols-2 fluid-gap-2 fluid-pt-4 border-t border-gray-100">
              <div className="text-center">
                <p className="fluid-text-xl font-bold text-emerald-600">{stats.certified}</p>
                <p className="fluid-text-xs text-gray-500">Disponibles</p>
              </div>
              <div className="text-center">
                <p className="fluid-text-xl font-bold text-gray-900">{stats.totalExams}</p>
                <p className="fluid-text-xs text-gray-500">Certificaciones</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 fluid-px-6 fluid-py-3 border-t border-gray-100">
            <div className="flex items-center fluid-gap-4">
              <span className="inline-flex items-center fluid-gap-1 fluid-text-xs text-emerald-600 font-medium">
                <FileText className="fluid-icon-xs" />
                Ver documentos
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Resumen de exámenes asignados (preview) */}
      {assignedExams.length > 0 && (
        <div className="fluid-mt-6 bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="fluid-px-6 fluid-py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center fluid-gap-3">
                <ClipboardList className="fluid-icon-base text-blue-600" />
                <h3 className="font-semibold text-gray-900">Certificaciones Activas</h3>
              </div>
              <Link
                to={`/partners/groups/${groupId}/exams`}
                className="fluid-text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center fluid-gap-1"
              >
                Ver todas <ChevronRight className="fluid-icon-xs" />
              </Link>
            </div>
          </div>
          
          <div className="divide-y divide-gray-100">
            {assignedExams.slice(0, 3).map((assignment) => (
              <div key={assignment.id} className="fluid-px-6 fluid-py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center fluid-gap-4">
                  <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg">
                    <Award className="fluid-icon-base text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{assignment.exam?.name}</p>
                    <div className="flex items-center fluid-gap-3 fluid-text-xs text-gray-500 fluid-mt-0.5">
                      <span className="inline-flex items-center fluid-gap-1">
                        <Clock className="fluid-icon-xs" />
                        {assignment.time_limit_minutes || assignment.exam?.duration_minutes || 0} min
                      </span>
                      <span className="inline-flex items-center fluid-gap-1">
                        <Target className="fluid-icon-xs" />
                        {assignment.passing_score || assignment.exam?.passing_score || 70}%
                      </span>
                      <span className="inline-flex items-center fluid-gap-1">
                        <Users className="fluid-icon-xs" />
                        {assignment.assignment_type === 'all' ? 'Todos' : `${assignment.assigned_members_count || 0} candidatos`}
                      </span>
                    </div>
                  </div>
                </div>
                {assignment.exam?.ecm?.code && (
                  <span className="fluid-px-2 fluid-py-1 bg-purple-100 text-purple-700 fluid-text-xs font-bold rounded-fluid-lg">
                    {assignment.exam.ecm.code}
                  </span>
                )}
              </div>
            ))}
          </div>
          
          {assignedExams.length > 3 && (
            <div className="fluid-px-6 fluid-py-3 bg-gray-50 border-t border-gray-100 text-center">
              <Link
                to={`/partners/groups/${groupId}/exams`}
                className="fluid-text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Ver {assignedExams.length - 3} certificaciones más
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Estado vacío si no hay nada */}
      {members.length === 0 && assignedExams.length === 0 && (
        <div className="fluid-mt-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-fluid-2xl border-2 border-dashed border-purple-200 fluid-p-12 text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto fluid-mb-4">
            <Users className="fluid-icon-2xl text-purple-500" />
          </div>
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-2">
            ¡Grupo listo para comenzar!
          </h3>
          <p className="fluid-text-base text-gray-500 max-w-md mx-auto fluid-mb-6">
            El primer paso es agregar candidatos al grupo para luego asignarles certificaciones
          </p>
          {group.is_active && (
            <Link
              to={`/partners/groups/${groupId}/assign-candidates`}
              className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-fluid-xl font-semibold transition-colors shadow-lg"
            >
              <UserPlus className="fluid-icon-base" />
              Agregar Candidatos
            </Link>
          )}
        </div>
      )}

      {/* Modal de éxito */}
      {showSuccessModal && group && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 p-4 cursor-pointer bg-black/50"
          onClick={() => {
            setShowSuccessModal(false);
            searchParams.delete('created');
            setSearchParams(searchParams, { replace: true });
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border-2 border-green-200 animate-[bounceIn_0.6s_ease-out] cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-[scaleIn_0.4s_ease-out_0.2s_both]">
                <CheckCircle2 className="w-16 h-16 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-green-800 mb-3">¡Grupo creado exitosamente!</h3>
              <p className="text-green-700 mb-8">
                El grupo <span className="font-semibold">{group.name}</span> ha sido creado.
              </p>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  searchParams.delete('created');
                  setSearchParams(searchParams, { replace: true });
                }}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors"
              >
                Aceptar
              </button>
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
