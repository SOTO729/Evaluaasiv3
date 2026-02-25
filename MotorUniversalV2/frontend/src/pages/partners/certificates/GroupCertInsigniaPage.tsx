/**
 * GroupCertInsigniaPage – Insignia Digital (digital_badge)
 * Tabla unificada de candidatos con info de insignias emitidas.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { BadgeCheck, FileSpreadsheet, Image as ImageIcon, Code, X } from 'lucide-react';
import CertificateTypePage, { type CandidateCertificateStats } from './CertificateTypePage';
import { badgeService, type IssuedBadge } from '../../../services/badgeService';

export default function GroupCertInsigniaPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [badges, setBadges] = useState<IssuedBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [issueMessage, setIssueMessage] = useState<string | null>(null);
  const issuedRef = useRef(false);

  // Modal state
  const [imageModal, setImageModal] = useState<{ url: string; name: string } | null>(null);
  const [jsonModal, setJsonModal] = useState<{ json: string; name: string } | null>(null);

  // Build lookup: user_id → IssuedBadge (with template_image_url)
  const badgeMap = useMemo(() => {
    const map = new Map<string, IssuedBadge & { template_image_url?: string }>();
    for (const b of badges) {
      map.set(b.user_id, b as any);
    }
    return map;
  }, [badges]);

  // Auto-issue pending badges on mount, then load all badges
  useEffect(() => {
    if (!groupId) return;
    const gid = Number(groupId);

    (async () => {
      try {
        if (!issuedRef.current) {
          issuedRef.current = true;
          try {
            const res = await badgeService.issuePendingGroupBadges(gid);
            if (res.issued > 0) {
              setIssueMessage(res.message);
            }
          } catch { /* silently ignore */ }
        }
        const data = await badgeService.getGroupBadges(gid);
        setBadges(data.badges);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

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

  // ── Custom table headers ──
  const renderHeaders = ({ handleSort, renderSortIcon }: {
    handleSort: (col: string) => void;
    renderSortIcon: (col: string) => React.ReactNode;
  }) => (
    <>
      <th
        onClick={() => handleSort('full_name')}
        className="text-left fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
      >
        Candidato{renderSortIcon('full_name')}
      </th>
      <th
        onClick={() => handleSort('email')}
        className="text-left fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap hidden md:table-cell"
      >
        Email{renderSortIcon('email')}
      </th>
      <th
        onClick={() => handleSort('curp')}
        className="text-left fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap hidden lg:table-cell"
      >
        CURP{renderSortIcon('curp')}
      </th>
      <th className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium whitespace-nowrap">
        Insignia
      </th>
      <th className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium whitespace-nowrap">
        Código
      </th>
      <th className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium whitespace-nowrap">
        Estado
      </th>
      <th className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium whitespace-nowrap">
        Acciones
      </th>
    </>
  );

  // ── Custom row renderer ──
  const renderRow = (c: CandidateCertificateStats) => {
    const badge = badgeMap.get(c.user_id);
    const imgUrl = badge ? ((badge as any).template_image_url || badge.badge_image_url) : null;

    return (
      <>
        {/* Candidato */}
        <td className="fluid-px-4 fluid-py-3">
          <div className="flex items-center fluid-gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-amber-700">
                {c.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{c.full_name}</p>
              <p className="fluid-text-xs text-gray-500 md:hidden truncate">{c.email || '-'}</p>
            </div>
          </div>
        </td>
        {/* Email */}
        <td className="fluid-px-4 fluid-py-3 text-gray-600 hidden md:table-cell">
          <span className="truncate block max-w-[200px]">{c.email || '-'}</span>
        </td>
        {/* CURP */}
        <td className="fluid-px-4 fluid-py-3 text-gray-500 font-mono text-xs hidden lg:table-cell">
          {c.curp || '-'}
        </td>
        {/* Mini badge image */}
        <td className="fluid-px-4 fluid-py-3 text-center">
          {imgUrl ? (
            <div className="w-10 h-10 mx-auto rounded-fluid-lg bg-amber-50 overflow-hidden">
              <img src={imgUrl} alt="" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 mx-auto rounded-fluid-lg bg-gray-100 flex items-center justify-center">
              <BadgeCheck className="w-5 h-5 text-gray-300" />
            </div>
          )}
        </td>
        {/* Badge code */}
        <td className="fluid-px-4 fluid-py-3 text-center">
          {badge ? (
            <span className="font-mono text-xs text-gray-600">{badge.badge_code}</span>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </td>
        {/* Status */}
        <td className="fluid-px-4 fluid-py-3 text-center">
          {badge ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              badge.status === 'active' ? 'bg-green-100 text-green-700' :
              badge.status === 'expired' ? 'bg-red-100 text-red-700' :
              badge.status === 'revoked' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {badge.status === 'active' ? 'Activa' : badge.status === 'expired' ? 'Expirada' : 'Revocada'}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
              Sin emitir
            </span>
          )}
        </td>
        {/* Actions */}
        <td className="fluid-px-4 fluid-py-3 text-center">
          {badge ? (
            <div className="flex items-center justify-center fluid-gap-1">
              {imgUrl && (
                <button
                  onClick={() => setImageModal({
                    url: imgUrl,
                    name: c.full_name || badge.badge_code,
                  })}
                  className="fluid-p-2 text-gray-400 hover:text-amber-600 rounded-fluid-lg hover:bg-amber-50 transition-colors"
                  title="Ver imagen"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              )}
              {badge.credential_json && (
                <button
                  onClick={() => {
                    try {
                      const formatted = JSON.stringify(JSON.parse(badge.credential_json!), null, 2);
                      setJsonModal({ json: formatted, name: c.full_name || badge.badge_code });
                    } catch {
                      setJsonModal({ json: badge.credential_json!, name: c.full_name || badge.badge_code });
                    }
                  }}
                  className="fluid-p-2 text-gray-400 hover:text-blue-600 rounded-fluid-lg hover:bg-blue-50 transition-colors"
                  title="Ver JSON"
                >
                  <Code className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </td>
      </>
    );
  };

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
        }
        customTableContent={{
          renderHeaders,
          renderRow,
          emptyColSpan: 7,
        }}
      />

      {/* Issue message */}
      {!loading && issueMessage && (
        <div className="fluid-px-6 fluid-pb-4">
          <div className="fluid-p-3 bg-green-50 border border-green-200 rounded-fluid-lg text-green-700 fluid-text-sm font-medium">
            {issueMessage}
          </div>
        </div>
      )}

      {/* Image Modal */}
      {imageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setImageModal(null)}>
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 text-sm">Insignia — {imageModal.name}</h3>
              <button onClick={() => setImageModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex items-center justify-center bg-gray-50">
              <img src={imageModal.url} alt={imageModal.name} className="max-h-[60vh] max-w-full object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}

      {/* JSON Modal */}
      {jsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setJsonModal(null)}>
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 text-sm">Credencial JSON-LD — {jsonModal.name}</h3>
              <button onClick={() => setJsonModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-auto">
              <pre className="text-xs font-mono text-gray-700 bg-gray-50 rounded-xl p-4 whitespace-pre-wrap break-words border border-gray-200">
                {jsonModal.json}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
