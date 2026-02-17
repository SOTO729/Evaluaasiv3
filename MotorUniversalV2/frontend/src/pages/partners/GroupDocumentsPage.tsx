/**
 * Página de Documentos del Grupo — Menú de Cards
 * 4 tarjetas que enlazan a sub-páginas por tipo de certificado.
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  Award,
  FileText,
  Shield,
  BadgeCheck,
  ChevronRight,
  Download,
  Eye,
  Users,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import {
  getGroup,
  getGroupCertificatesStats,
  CandidateGroup,
  GroupCertificatesStats,
} from '../../services/partnersService';

interface CertCard {
  key: string;
  route: string;
  title: string;
  subtitle: string;
  icon: typeof FileText;
  gradient: string;
  iconBg: string;
  iconColor: string;
  statLabel: string;
  getReady: (s: GroupCertificatesStats) => number;
  getPending: (s: GroupCertificatesStats) => number;
  downloadEnabled: boolean;
}

const CERT_CARDS: CertCard[] = [
  {
    key: 'tier_basic',
    route: 'reporte',
    title: 'Reporte de Evaluación',
    subtitle: 'Constancia de Participación',
    icon: FileText,
    gradient: 'from-blue-500 to-blue-700',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    statLabel: 'Reportes',
    getReady: s => s.summary.tier_basic?.ready || 0,
    getPending: s => s.summary.tier_basic?.pending || 0,
    downloadEnabled: true,
  },
  {
    key: 'tier_standard',
    route: 'eduit',
    title: 'Certificado Eduit',
    subtitle: 'Certificado oficial de Eduit',
    icon: Award,
    gradient: 'from-purple-500 to-purple-700',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    statLabel: 'Certificados',
    getReady: s => s.summary.tier_standard?.ready || 0,
    getPending: s => s.summary.tier_standard?.pending || 0,
    downloadEnabled: true,
  },
  {
    key: 'tier_advanced',
    route: 'conocer',
    title: 'Certificado CONOCER',
    subtitle: 'Certificación SEP-CONOCER',
    icon: Shield,
    gradient: 'from-emerald-500 to-emerald-700',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    statLabel: 'Certificados',
    getReady: s => s.summary.tier_advanced?.count || 0,
    getPending: () => 0,
    downloadEnabled: false,
  },
  {
    key: 'digital_badge',
    route: 'insignia',
    title: 'Insignia Digital',
    subtitle: 'Insignia digital verificable',
    icon: BadgeCheck,
    gradient: 'from-amber-500 to-amber-600',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    statLabel: 'Insignias',
    getReady: s => s.summary.digital_badge?.count || 0,
    getPending: () => 0,
    downloadEnabled: false,
  },
];

export default function GroupDocumentsPage() {
  const { groupId } = useParams();
  
  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [stats, setStats] = useState<GroupCertificatesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupData, statsData] = await Promise.all([
        getGroup(Number(groupId)),
        getGroupCertificatesStats(Number(groupId)),
      ]);
      setGroup(groupData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los documentos');
    } finally {
      setLoading(false);
    }
  };

  const totalCertified = stats?.candidates.filter(c => c.exams_approved > 0).length || 0;

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
              <p className="fluid-text-sm text-white/70 mt-1">
                Selecciona un tipo de documento para gestionar
              </p>
            </div>
          </div>

          <div className="flex items-center fluid-gap-4">
            <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center min-w-[120px]">
              <p className="fluid-text-2xl font-bold">{totalCertified}</p>
              <p className="fluid-text-xs text-white/70">Candidatos Certificados</p>
            </div>
            <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center min-w-[120px]">
              <p className="fluid-text-2xl font-bold">{stats?.candidates.length || 0}</p>
              <p className="fluid-text-xs text-white/70">Total Candidatos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-6">
        {CERT_CARDS.map(card => {
          const CardIcon = card.icon;
          const ready = stats ? card.getReady(stats) : 0;
          const pending = stats ? card.getPending(stats) : 0;
          const total = ready + pending;

          return (
            <Link
              key={card.key}
              to={`/partners/groups/${groupId}/documents/${card.route}`}
              className="group bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-300"
            >
              {/* Gradient top bar */}
              <div className={`h-2 bg-gradient-to-r ${card.gradient}`} />

              <div className="fluid-p-6">
                <div className="flex items-start justify-between fluid-mb-4">
                  <div className="flex items-center fluid-gap-4">
                    <div className={`${card.iconBg} fluid-p-3 rounded-fluid-xl`}>
                      <CardIcon className={`fluid-icon-lg ${card.iconColor}`} />
                    </div>
                    <div>
                      <h3 className="fluid-text-lg font-bold text-gray-900 group-hover:text-gray-700 transition-colors">
                        {card.title}
                      </h3>
                      <p className="fluid-text-sm text-gray-500">{card.subtitle}</p>
                    </div>
                  </div>
                  <ChevronRight className="fluid-icon text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                </div>

                {/* Stats row */}
                <div className="flex items-center fluid-gap-4 fluid-mt-4">
                  <div className="flex items-center fluid-gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="fluid-text-sm text-gray-600 font-medium">{total} {card.statLabel.toLowerCase()}</span>
                  </div>
                  {ready > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {ready} listos
                    </span>
                  )}
                  {pending > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      {pending} pendientes
                    </span>
                  )}
                </div>

                {/* Action hint */}
                <div className="flex items-center fluid-gap-2 fluid-mt-4 pt-4 border-t border-gray-100">
                  {card.downloadEnabled ? (
                    <>
                      <Download className="w-4 h-4 text-gray-400" />
                      <span className="fluid-text-xs text-gray-400">Descarga individual y masiva disponible</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 text-gray-400" />
                      <span className="fluid-text-xs text-gray-400">Solo visualización</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
