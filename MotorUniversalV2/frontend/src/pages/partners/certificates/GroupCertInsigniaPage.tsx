/**
 * GroupCertInsigniaPage – Insignia Digital (digital_badge)
 * Tabla de seguimiento + Generación batch + Descarga de insignias.
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BadgeCheck, Download, ExternalLink, Award } from 'lucide-react';
import CertificateTypePage from './CertificateTypePage';
import { badgeService, type IssuedBadge } from '../../../services/badgeService';

export default function GroupCertInsigniaPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [badges, setBadges] = useState<IssuedBadge[]>([]);
  const [loading, setLoading] = useState(true);

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
      />

      {/* Additional badges detail section */}
      {!loading && badges.length > 0 && (
        <div className="fluid-px-6 fluid-pb-6">
          <div className="bg-white rounded-fluid-2xl border border-gray-200 overflow-hidden">
            <div className="fluid-p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center fluid-gap-2">
                <Award className="fluid-icon-sm text-amber-600" />
                Insignias Emitidas ({badges.length})
              </h3>
            </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
