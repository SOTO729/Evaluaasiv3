/**
 * PurchasePreviewModal — Modal de vista previa de compra.
 * Muestra todo lo que incluye la certificación antes de pagar:
 * examen, materiales de estudio, configuración, costo.
 * Usa la paleta dinámica del campus (primary/secondary).
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  BookOpen,
  Clock,
  Target,
  Award,
  Gamepad2,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  FileText,
  Layers,
  CheckCircle,
  Sparkles,
  RefreshCw,
  Timer,
  Loader2,
} from 'lucide-react';
import { getPurchaseDetails, type PurchaseDetails } from '../../services/partnersService';
import { OptimizedImage } from '../ui/OptimizedImage';

interface PurchasePreviewModalProps {
  isOpen: boolean;
  groupExamId: number;
  onClose: () => void;
  onProceedToPayment: () => void;
}

export default function PurchasePreviewModal({
  isOpen,
  groupExamId,
  onClose,
  onProceedToPayment,
}: PurchasePreviewModalProps) {
  const { data, isLoading, error } = useQuery<PurchaseDetails>({
    queryKey: ['purchase-details', groupExamId],
    queryFn: () => getPurchaseDetails(groupExamId),
    enabled: isOpen && groupExamId > 0,
    staleTime: 60000,
  });

  if (!isOpen) return null;

  const contentTypeLabel: Record<string, string> = {
    questions_only: 'Preguntas teóricas',
    exercises_only: 'Ejercicios prácticos',
    mixed: 'Teoría + Práctica',
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-fadeInUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Loading ──────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        )}

        {/* ── Error ────────────────────────────────── */}
        {error && (
          <div className="p-8 text-center">
            <p className="text-red-600 mb-4">No se pudieron cargar los detalles.</p>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm">
              Cerrar
            </button>
          </div>
        )}

        {/* ── Content ──────────────────────────────── */}
        {data && (
          <>
            {/* Header con imagen/gradiente */}
            <div className="relative h-44 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 flex-shrink-0 overflow-hidden">
              {data.exam.image_url && (
                <OptimizedImage
                  src={data.exam.image_url}
                  alt={data.exam.name}
                  className="w-full h-full object-cover opacity-30"
                  fallbackIcon={null}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 p-5">
                {data.exam.ecm && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white/90 mb-2">
                    <ShieldCheck className="w-3 h-3" />
                    {data.exam.ecm.code}
                  </span>
                )}
                <h2 className="text-xl font-bold text-white leading-tight line-clamp-2">
                  {data.exam.name}
                </h2>
                {data.campus_name && (
                  <p className="text-white/70 text-xs mt-1">{data.campus_name}</p>
                )}
              </div>
            </div>

            {/* Body scrollable */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Precio destacado */}
              <div className="bg-gradient-to-r from-primary-50 to-primary-100/50 rounded-xl p-4 border border-primary-200/60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-primary-600 uppercase tracking-wide">
                      Certificación
                    </p>
                    <p className="text-3xl font-extrabold text-primary-700 mt-0.5">
                      ${data.certification_cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      <span className="text-sm font-normal text-primary-500 ml-1">MXN</span>
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-primary-500/10 flex items-center justify-center">
                    <Award className="w-7 h-7 text-primary-600" />
                  </div>
                </div>
              </div>

              {/* Qué incluye */}
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary-500" />
                  ¿Qué incluye tu compra?
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <FeatureCard
                    icon={<FileText className="w-4 h-4" />}
                    label="Examen de certificación"
                    detail={contentTypeLabel[data.exam_content_type] || 'Preguntas'}
                  />
                  <FeatureCard
                    icon={<RefreshCw className="w-4 h-4" />}
                    label={`${data.max_attempts} intento${data.max_attempts > 1 ? 's' : ''}`}
                    detail={data.max_attempts > 1 ? 'Para aprobar' : 'Oportunidad única'}
                  />
                  <FeatureCard
                    icon={<Timer className="w-4 h-4" />}
                    label={`${data.time_limit_minutes} minutos`}
                    detail="Duración del examen"
                  />
                  <FeatureCard
                    icon={<Target className="w-4 h-4" />}
                    label={`Mínimo ${data.exam.passing_score}%`}
                    detail="Para aprobar"
                  />
                  {data.exam.has_simulator_content && (
                    <FeatureCard
                      icon={<Gamepad2 className="w-4 h-4" />}
                      label="Simulador incluido"
                      detail="Práctica interactiva"
                    />
                  )}
                  {data.exam.total_questions > 0 && (
                    <FeatureCard
                      icon={<Layers className="w-4 h-4" />}
                      label={`${data.exam.total_questions} reactivos`}
                      detail="Banco de preguntas"
                    />
                  )}
                </div>
              </div>

              {/* Materiales de estudio incluidos */}
              {data.materials.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary-500" />
                    Material de estudio incluido
                  </h3>
                  <div className="space-y-2">
                    {data.materials.map((mat) => (
                      <div
                        key={mat.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-primary-200 transition-colors"
                      >
                        {mat.image_url ? (
                          <OptimizedImage
                            src={mat.image_url}
                            alt={mat.title}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                            fallbackIcon={<BookOpen className="w-5 h-5 text-gray-300" />}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <BookOpen className="w-5 h-5 text-primary-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 line-clamp-1">
                            {mat.title}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                            {mat.sessions_count > 0 && (
                              <span className="flex items-center gap-1">
                                <Layers className="w-3 h-3" />
                                {mat.sessions_count} unidad{mat.sessions_count > 1 ? 'es' : ''}
                              </span>
                            )}
                            {mat.estimated_time_minutes > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {mat.estimated_time_minutes} min
                              </span>
                            )}
                          </div>
                        </div>
                        <CheckCircle className="w-4 h-4 text-primary-400 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Retoma info */}
              {data.retake_cost > 0 && (
                <p className="text-xs text-gray-400 text-center">
                  Si no apruebas, puedes comprar una retoma por{' '}
                  <strong className="text-gray-600">
                    ${data.retake_cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                  </strong>
                </p>
              )}
            </div>

            {/* Footer fijo */}
            <div className="flex-shrink-0 p-5 pt-3 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={onProceedToPayment}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-xl font-semibold shadow-lg shadow-primary-600/20 transition-all text-sm"
              >
                <CreditCard className="w-5 h-5" />
                Comprar por ${data.certification_cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="w-full mt-2 px-4 py-2 text-gray-500 hover:text-gray-700 text-xs font-medium transition-colors"
              >
                Volver a mis exámenes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Helper component ────────────────────────────────────────── */
function FeatureCard({
  icon,
  label,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-xl border border-gray-100">
      <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0 text-primary-600">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-800 leading-tight">{label}</p>
        <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{detail}</p>
      </div>
    </div>
  );
}
