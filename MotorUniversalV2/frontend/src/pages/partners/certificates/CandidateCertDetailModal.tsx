/**
 * CandidateCertDetailModal — Panel lateral (slide-over) que muestra el detalle
 * de certificación de un candidato: exámenes aprobados, ECAs asociadas, y
 * certificados CONOCER.
 */
import { useState, useEffect } from 'react';
import {
  X, Loader2, User, BookOpen, Award, Shield,
  FileText, CheckCircle2, Hash, Calendar,
  AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  getCandidateCertificationDetail,
  CandidateCertificationDetail,
  CertResultDetail,
} from '../../../services/partnersService';

interface CandidateCertDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: number;
  userId: string;
  userName: string;
}

export default function CandidateCertDetailModal({
  isOpen, onClose, groupId, userId, userName,
}: CandidateCertDetailModalProps) {
  const [data, setData] = useState<CandidateCertificationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && userId) {
      loadDetail();
    }
    return () => {
      setData(null);
      setError(null);
      setExpandedResults(new Set());
    };
  }, [isOpen, userId, groupId]);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const detail = await getCandidateCertificationDetail(groupId, userId);
      setData(detail);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar detalle');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (resultId: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(resultId)) next.delete(resultId);
      else next.add(resultId);
      return next;
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('es-MX', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 fluid-p-5 text-white flex-shrink-0">
          <div className="flex items-center justify-between fluid-mb-3">
            <h2 className="fluid-text-lg font-bold">Detalle de Certificación</h2>
            <button
              onClick={onClose}
              className="fluid-p-2 hover:bg-white/20 rounded-fluid-lg transition-colors"
            >
              <X className="fluid-icon" />
            </button>
          </div>
          <div className="flex items-center fluid-gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold">{userName}</p>
              {data && (
                <p className="fluid-text-xs text-white/70">
                  {data.candidate.email || 'Sin email'} • {data.candidate.curp || 'Sin CURP'}
                </p>
              )}
            </div>
          </div>

          {/* Summary badges */}
          {data && (
            <div className="flex fluid-gap-3 fluid-mt-4 flex-wrap">
              <span className="inline-flex items-center fluid-gap-1 px-2.5 py-1 bg-white/20 rounded-full text-xs font-medium">
                <BookOpen className="w-3 h-3" />{data.summary.exams_approved} exámenes
              </span>
              <span className="inline-flex items-center fluid-gap-1 px-2.5 py-1 bg-white/20 rounded-full text-xs font-medium">
                <Award className="w-3 h-3" />{data.summary.ecm_count} ECMs
              </span>
              {data.summary.conocer_count > 0 && (
                <span className="inline-flex items-center fluid-gap-1 px-2.5 py-1 bg-white/20 rounded-full text-xs font-medium">
                  <Shield className="w-3 h-3" />{data.summary.conocer_count} CONOCER
                </span>
              )}
              <span className="inline-flex items-center fluid-gap-1 px-2.5 py-1 bg-white/20 rounded-full text-xs font-medium">
                <FileText className="w-3 h-3" />{data.summary.reports_ready} reportes
              </span>
              <span className="inline-flex items-center fluid-gap-1 px-2.5 py-1 bg-white/20 rounded-full text-xs font-medium">
                <CheckCircle2 className="w-3 h-3" />{data.summary.certificates_ready} certificados
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto fluid-p-5">
          {loading && (
            <div className="flex items-center justify-center fluid-py-12">
              <Loader2 className="fluid-icon-lg animate-spin text-blue-500" />
              <span className="ml-3 text-gray-500">Cargando detalle...</span>
            </div>
          )}

          {error && (
            <div className="fluid-p-4 bg-red-50 border border-red-200 rounded-fluid-lg flex items-center fluid-gap-2 text-red-700">
              <AlertCircle className="fluid-icon flex-shrink-0" />
              <p className="fluid-text-sm">{error}</p>
            </div>
          )}

          {data && !loading && (
            <div className="space-y-6">
              {/* Exámenes aprobados */}
              <section>
                <h3 className="fluid-text-base font-bold text-gray-900 flex items-center fluid-gap-2 fluid-mb-3">
                  <BookOpen className="fluid-icon text-blue-600" />
                  Exámenes Aprobados ({data.results.length})
                </h3>

                {data.results.length === 0 ? (
                  <p className="fluid-text-sm text-gray-400 italic">No hay exámenes aprobados</p>
                ) : (
                  <div className="space-y-3">
                    {data.results.map(result => (
                      <ResultCard
                        key={result.result_id}
                        result={result}
                        expanded={expandedResults.has(result.result_id)}
                        onToggle={() => toggleExpand(result.result_id)}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Certificados CONOCER */}
              {data.conocer_certificates.length > 0 && (
                <section>
                  <h3 className="fluid-text-base font-bold text-gray-900 flex items-center fluid-gap-2 fluid-mb-3">
                    <Shield className="fluid-icon text-emerald-600" />
                    Certificados CONOCER ({data.conocer_certificates.length})
                  </h3>
                  <div className="space-y-3">
                    {data.conocer_certificates.map(cc => (
                      <div
                        key={cc.id}
                        className="bg-emerald-50 border border-emerald-200 rounded-fluid-lg fluid-p-4"
                      >
                        <div className="flex items-start justify-between fluid-mb-2">
                          <div>
                            <p className="font-medium text-emerald-900">{cc.standard_name}</p>
                            <p className="fluid-text-xs text-emerald-600 font-mono">{cc.standard_code}</p>
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 mr-1" />Certificado
                          </span>
                        </div>
                        <div className="flex items-center fluid-gap-4 fluid-text-xs text-emerald-700">
                          <span className="flex items-center fluid-gap-1">
                            <Hash className="w-3 h-3" />{cc.certificate_number}
                          </span>
                          <span className="flex items-center fluid-gap-1">
                            <Calendar className="w-3 h-3" />{formatDate(cc.issue_date)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 fluid-p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full fluid-py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-fluid-lg font-medium fluid-text-sm transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </>
  );
}

// ============ Sub-component: ResultCard ============

function ResultCard({
  result, expanded, onToggle, formatDate,
}: {
  result: CertResultDetail;
  expanded: boolean;
  onToggle: () => void;
  formatDate: (d: string | null) => string;
}) {
  const hasEcm = result.ecm_assignments.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-fluid-lg shadow-sm overflow-hidden">
      {/* Main row */}
      <button
        onClick={onToggle}
        className="w-full fluid-p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{result.exam_name}</p>
          <div className="flex items-center fluid-gap-3 mt-1 fluid-text-xs text-gray-500 flex-wrap">
            <span className="flex items-center fluid-gap-1">
              <Calendar className="w-3 h-3" />{formatDate(result.end_date)}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${
              result.score >= 80 ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {result.score}%
            </span>
            {result.has_report && (
              <span className="inline-flex items-center fluid-gap-1 text-blue-600">
                <FileText className="w-3 h-3" />Reporte
              </span>
            )}
            {result.has_certificate && (
              <span className="inline-flex items-center fluid-gap-1 text-purple-600">
                <Award className="w-3 h-3" />Certificado
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center fluid-gap-2 ml-3 flex-shrink-0">
          {hasEcm && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
              {result.ecm_assignments.length} ECM{result.ecm_assignments.length > 1 ? 's' : ''}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 fluid-p-4 bg-gray-50/50 space-y-3">
          {/* Codes */}
          <div className="grid grid-cols-2 fluid-gap-3 fluid-text-xs">
            {result.certificate_code && (
              <div>
                <span className="text-gray-400 block">Código Reporte</span>
                <span className="font-mono text-gray-700">{result.certificate_code}</span>
              </div>
            )}
            {result.eduit_certificate_code && (
              <div>
                <span className="text-gray-400 block">Código Certificado Eduit</span>
                <span className="font-mono text-gray-700">{result.eduit_certificate_code}</span>
              </div>
            )}
            {result.exam_code && (
              <div>
                <span className="text-gray-400 block">Código Examen</span>
                <span className="font-mono text-gray-700">{result.exam_code}</span>
              </div>
            )}
          </div>

          {/* ECA assignments */}
          {hasEcm && (
            <div>
              <p className="fluid-text-xs font-semibold text-gray-600 fluid-mb-2 flex items-center fluid-gap-1">
                <Shield className="w-3 h-3 text-indigo-500" />
                Asignaciones ECM
              </p>
              <div className="space-y-2">
                {result.ecm_assignments.map(eca => (
                  <div
                    key={eca.id}
                    className="bg-indigo-50 border border-indigo-100 rounded-fluid-lg fluid-p-3"
                  >
                    <p className="font-medium text-indigo-900 fluid-text-sm">{eca.ecm_name || 'ECM sin nombre'}</p>
                    <div className="flex items-center fluid-gap-3 mt-1 fluid-text-xs text-indigo-600 flex-wrap">
                      {eca.ecm_code && (
                        <span className="font-mono">{eca.ecm_code}</span>
                      )}
                      <span className="flex items-center fluid-gap-1">
                        <Hash className="w-3 h-3" />{eca.assignment_number}
                      </span>
                      <span className="flex items-center fluid-gap-1">
                        <Calendar className="w-3 h-3" />{formatDate(eca.assigned_at)}
                      </span>
                      {eca.group_name && (
                        <span className="text-indigo-400">Grupo: {eca.group_name}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasEcm && (
            <p className="fluid-text-xs text-gray-400 italic">Sin asignaciones ECM asociadas a este examen</p>
          )}
        </div>
      )}
    </div>
  );
}
