/**
 * GroupCertInsigniaPage – Insignia Digital (digital_badge)
 * Tabla de seguimiento + Generación batch + Descarga de insignias.
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BadgeCheck, Download, ExternalLink, Award, FileSpreadsheet, Sparkles } from 'lucide-react';
import CertificateTypePage from './CertificateTypePage';
import { badgeService, type IssuedBadge } from '../../../services/badgeService';

export default function GroupCertInsigniaPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [badges, setBadges] = useState<IssuedBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueMessage, setIssueMessage] = useState<string | null>(null);

  const handleExportExcel = async () => {
    if (!groupId) return;
    setExporting(true);
    try {
      const blob = await badgeService.exportGroupBadgesToExcel(Number(groupId));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Insignias_grupo_${groupId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting badges:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleIssuePending = async () => {
    if (!groupId) return;
    setIssuing(true);
    setIssueMessage(null);
    try {
      const data = await badgeService.issuePendingGroupBadges(Number(groupId));
      setIssueMessage(data.message);
      // Reload badges
      const updated = await badgeService.getGroupBadges(Number(groupId));
      setBadges(updated.badges);
    } catch (err: any) {
      setIssueMessage(err.response?.data?.error || 'Error al emitir insignias');
    } finally {
      setIssuing(false);
    }
  };

  useEffect(() => {
    if (groupId) {
      badgeService.getGroupBadges(Number(groupId))
        .then(data => setBadges(data.badges))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [groupId]);

  return (
    <div>
      <CertificateTypePage
        certType="digital_badge"
        title="Insignias Digitales"
        subtitle={`Insignias digitales verificables Open Badges 3.0 — ${badges.length} emitida${badges.length !== 1 ? 's' : ''}`}
        icon={BadgeCheck}
        headerGradient="bg-gradient-to-r from-amber-500 to-amber-700"
        accentColor="amber"
        downloadEnabled={false}
        canGenerate={false}
        extraHeaderActions={
          <div className="flex items-center fluid-gap-3">
            <button
              onClick={handleIssuePending}
              disabled={issuing}
              className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 rounded-fluid-xl text-white font-medium fluid-text-sm transition-colors disabled:opacity-50"
            >
              {issuing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {issuing ? 'Emitiendo…' : 'Emitir Pendientes'}
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exporting || badges.length === 0}
              className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 rounded-fluid-xl text-white font-medium fluid-text-sm transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              {exporting ? 'Exportando…' : 'Exportar Excel'}
            </button>
          </div>
        }
      />

      {/* Badges detail section — always visible */}
      {!loading && (
        <div className="fluid-px-6 fluid-pb-6">
          {issueMessage && (
            <div className="fluid-mb-4 fluid-p-3 bg-green-50 border border-green-200 rounded-fluid-lg text-green-700 fluid-text-sm font-medium">
              {issueMessage}
            </div>
          )}
          <div className="bg-white rounded-fluid-2xl border border-gray-200 overflow-hidden">
            <div className="fluid-p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center fluid-gap-2">
                <Award className="fluid-icon-sm text-amber-600" />
                Insignias Emitidas ({badges.length})
              </h3>
            </div>

            {badges.length === 0 ? (
              <div className="fluid-p-8 text-center">
                <BadgeCheck className="fluid-icon-xl text-gray-200 mx-auto fluid-mb-3" />
                <p className="fluid-text-sm text-gray-500 font-medium">No hay insignias emitidas aún</p>
                <p className="fluid-text-xs text-gray-400 fluid-mt-1">Las insignias se emiten automáticamente cuando un candidato aprueba un examen vinculado a una plantilla activa</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {badges.map(badge => (
                  <div key={badge.id} className="fluid-p-4 flex items-center fluid-gap-4 hover:bg-gray-50 transition-colors">
                    {/* Mini badge image */}
                    <div className="w-12 h-12 rounded-fluid-lg bg-amber-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {badge.badge_image_url ? (
                        <img src={badge.badge_image_url} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <BadgeCheck className="fluid-icon-md text-amber-400" />
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{badge.candidate_name || 'Candidato'}</p>
                      <p className="fluid-text-xs text-gray-500">{badge.candidate_email}</p>
                      <p className="fluid-text-xs text-gray-400">
                        Código: {badge.badge_code} · {badge.template_name}
                      </p>
                    </div>
                    {/* Status */}
                    <span className={`fluid-px-2 fluid-py-1 fluid-text-xs font-medium rounded-full ${
                      badge.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {badge.status === 'active' ? 'Activa' : badge.status === 'expired' ? 'Expirada' : 'Revocada'}
                    </span>
                    {/* Actions */}
                    <div className="flex fluid-gap-1">
                      {badge.badge_image_url && (
                        <a
                          href={badge.badge_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="fluid-p-2 text-gray-400 hover:text-amber-600 rounded-fluid-lg hover:bg-amber-50 transition-colors"
                          title="Descargar insignia"
                        >
                          <Download className="fluid-icon-xs" />
                        </a>
                      )}
                      <a
                        href={badge.verify_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="fluid-p-2 text-gray-400 hover:text-blue-600 rounded-fluid-lg hover:bg-blue-50 transition-colors"
                        title="Verificar"
                      >
                        <ExternalLink className="fluid-icon-xs" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
