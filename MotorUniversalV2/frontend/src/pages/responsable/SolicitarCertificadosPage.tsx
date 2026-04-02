/**
 * Página de Solicitar Vouchers - Responsable de Plantel
 *
 * Formulario para que el responsable solicite vouchers:
 * - Número de vouchers necesarios
 * - Grupo (opcional)
 * - Justificación
 * - Documentos adjuntos (PDF, XLSX, DOC, DOCX, PNG, JPG, CSV, WEBP)
 * La solicitud se envía al coordinador del plantel.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Send,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Building2,
  Users,
  Paperclip,
  X,
  FileText,
  Upload,
  Ticket,
  Hash,
  MessageSquare,
  FolderOpen,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  createCertificateRequest,
  getMyCampusInfo,
  getCampusBalanceSummary,
  uploadAttachment,
  validateFile,
  formatFileSize,
  ALLOWED_FILE_EXTENSIONS,
  MyCampusInfo,
  Attachment,
} from '../../services/balanceService';

export default function SolicitarCertificadosPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedGroupId = searchParams.get('groupId') ? Number(searchParams.get('groupId')) : null;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [campusInfo, setCampusInfo] = useState<MyCampusInfo | null>(null);
  const [currentCerts, setCurrentCerts] = useState(0);

  const [units, setUnits] = useState(1);
  const [groupId, setGroupId] = useState<number | null>(preselectedGroupId);
  const [justification, setJustification] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const info = await getMyCampusInfo();
      setCampusInfo(info);

      // Calcular certificados disponibles actuales
      try {
        const balanceSummary = await getCampusBalanceSummary(info.campus.id);
        const cost = info.campus.certification_cost || 0;
        setCurrentCerts(cost > 0 ? Math.floor(balanceSummary.totals.current_balance / cost) : 0);
      } catch {
        setCurrentCerts(0);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar información del plantel');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const validation = validateFile(file);
        if (!validation.valid) {
          setError(`${file.name}: ${validation.error}`);
          continue;
        }

        const uploaded = await uploadAttachment(file);
        setAttachments(prev => [...prev, uploaded]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al subir archivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campusInfo || units <= 0 || !justification.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      await createCertificateRequest({
        campus_id: campusInfo.campus.id,
        group_id: groupId || undefined,
        units_requested: units,
        justification: justification.trim(),
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al enviar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-green-200 p-8 text-center animate-fadeInUp">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Solicitud enviada</h2>
            <p className="text-sm text-gray-600 mb-6">
              Tu solicitud de <strong>{units} voucher{units !== 1 ? 's' : ''}</strong> ha sido enviada al coordinador.
              Recibirás una notificación cuando sea procesada.
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                to="/mi-plantel/vouchers"
                className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium text-sm hover:bg-primary-700 transition-colors"
              >
                Ver mis vouchers
              </Link>
              <Link
                to="/mi-plantel"
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Volver a Mi Plantel
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-600 to-primary-500 rounded-2xl p-6 mb-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Solicitar Vouchers</h1>
            <p className="text-sm text-white/80">{campusInfo?.campus.name || 'Mi Plantel'}</p>
          </div>
        </div>
      </div>

      {/* Info bar */}
      {campusInfo && (
        <div className="flex items-center gap-4 bg-primary-50 border border-primary-200 rounded-xl p-4 mb-6">
          <div className="p-2.5 bg-primary-100 rounded-lg">
            <Award className="w-5 h-5 text-primary-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-primary-900">Vouchers disponibles actualmente</p>
            <p className="text-xs text-primary-600">Se descontarán al asignar exámenes a candidatos</p>
          </div>
          <span className="text-2xl font-bold text-primary-700">{currentCerts}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3 animate-fadeInUp">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cantidad + Grupo en grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Número de vouchers */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Hash className="w-4 h-4 text-primary-500" />
              Cantidad de vouchers <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setUnits(u => Math.max(1, u - 1))}
                className="w-10 h-10 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-xl font-bold transition-colors"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={9999}
                value={units}
                onChange={(e) => setUnits(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 py-2.5 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-xl font-bold text-center"
              />
              <button
                type="button"
                onClick={() => setUnits(u => Math.min(9999, u + 1))}
                className="w-10 h-10 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-xl font-bold transition-colors"
              >
                +
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">voucher{units !== 1 ? 's' : ''} solicitado{units !== 1 ? 's' : ''}</p>
          </div>

          {/* Grupo (opcional) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Users className="w-4 h-4 text-primary-500" />
              Grupo <span className="text-xs text-gray-400 font-normal">(opcional)</span>
            </label>
            {campusInfo && campusInfo.groups.length > 0 ? (
              <>
                <select
                  value={groupId || ''}
                  onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full py-2.5 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                >
                  <option value="">Plantel general</option>
                  {campusInfo.groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-2">Selecciona si son para un grupo específico</p>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2.5">
                <FolderOpen className="w-4 h-4" />
                Sin grupos disponibles
              </div>
            )}
          </div>
        </div>

        {/* Justificación */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
            <MessageSquare className="w-4 h-4 text-primary-500" />
            Justificación <span className="text-red-500">*</span>
          </label>
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={4}
            placeholder="Explica brevemente por qué necesitas estos vouchers..."
            className="w-full py-2.5 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm resize-none"
            maxLength={1000}
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-gray-400">Describe el motivo de tu solicitud</p>
            <p className="text-xs text-gray-400">{justification.length}/1000</p>
          </div>
        </div>

        {/* Documentos adjuntos */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
            <Paperclip className="w-4 h-4 text-primary-500" />
            Documentos adjuntos <span className="text-xs text-gray-400 font-normal">(opcional)</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_FILE_EXTENSIONS.map(ext => `.${ext}`).join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-colors text-sm text-gray-500 w-full justify-center"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</>
            ) : (
              <><Upload className="w-4 h-4" /> Seleccionar archivos</>
            )}
          </button>
          <p className="text-xs text-gray-400 mt-2">
            Formatos: {ALLOWED_FILE_EXTENSIONS.join(', ').toUpperCase()} — Máx. 10 MB por archivo
          </p>

          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                  <FileText className="w-4 h-4 text-primary-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{att.name}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(att.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="p-1 hover:bg-red-100 rounded-full transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumen + Botones */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary-500" />
            Resumen de la solicitud
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-primary-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-primary-700">{units}</p>
              <p className="text-xs text-primary-600">Solicitados</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{currentCerts}</p>
              <p className="text-xs text-gray-500">Disponibles</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{attachments.length}</p>
              <p className="text-xs text-gray-500">Adjuntos</p>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors rounded-xl hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || units <= 0 || !justification.trim()}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 font-semibold shadow-lg transition-all text-sm"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="w-4 h-4" /> Enviar solicitud</>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
