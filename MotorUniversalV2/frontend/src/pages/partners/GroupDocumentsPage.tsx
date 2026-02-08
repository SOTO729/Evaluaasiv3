/**
 * Página de Documentos del Grupo
 * Certificados, insignias y reportes
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  Award,
  FileText,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import GroupCertificatesTab from './GroupCertificatesTab';
import {
  getGroup,
  getGroupMembers,
  getGroupExams,
  CandidateGroup,
} from '../../services/partnersService';

export default function GroupDocumentsPage() {
  const { groupId } = useParams();
  const location = useLocation();
  
  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [certifiedCount, setCertifiedCount] = useState(0);
  const [examsCount, setExamsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [groupId, location.key]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupData, membersData, examsData] = await Promise.all([
        getGroup(Number(groupId)),
        getGroupMembers(Number(groupId)),
        getGroupExams(Number(groupId)),
      ]);
      setGroup(groupData);
      setCertifiedCount(membersData.members?.filter((m: any) => m.certification_status === 'certified').length || 0);
      setExamsCount(examsData.assigned_exams?.length || 0);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los documentos');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando documentos..." />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700">{error || 'Error al cargar'}</p>
          <Link to={`/partners/groups/${groupId}`} className="ml-auto text-red-700 underline">Volver</Link>
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
          { label: group.name, path: `/partners/groups/${groupId}` },
          { label: 'Documentos' }
        ]} 
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <Link
              to={`/partners/groups/${groupId}`}
              className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors"
            >
              <ArrowLeft className="fluid-icon-lg" />
            </Link>
            <div>
              <p className="fluid-text-sm text-white/80 fluid-mb-1">
                {group.name}
              </p>
              <h1 className="fluid-text-2xl font-bold flex items-center fluid-gap-3">
                <Award className="fluid-icon-lg" />
                Documentos
              </h1>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 fluid-gap-4 fluid-mt-6">
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{certifiedCount}</p>
            <p className="fluid-text-xs text-white/70">Certificados Disponibles</p>
          </div>
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{examsCount}</p>
            <p className="fluid-text-xs text-white/70">Certificaciones</p>
          </div>
        </div>
      </div>

      {/* Contenido - Reutiliza GroupCertificatesTab */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
        <div className="flex items-center fluid-gap-3 fluid-mb-6">
          <div className="fluid-p-2 bg-emerald-100 rounded-fluid-lg">
            <FileText className="fluid-icon-base text-emerald-600" />
          </div>
          <div>
            <h2 className="fluid-text-lg font-bold text-gray-900">Gestión de Documentos</h2>
            <p className="fluid-text-sm text-gray-500">Certificados, insignias digitales y reportes de evaluación</p>
          </div>
        </div>
        
        <GroupCertificatesTab groupId={Number(groupId)} groupName={group.name} />
      </div>
    </div>
  );
}
