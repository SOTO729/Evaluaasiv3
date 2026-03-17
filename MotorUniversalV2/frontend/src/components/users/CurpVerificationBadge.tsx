/**
 * Badge que indica si la CURP de un usuario fue validada contra RENAPO.
 */
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface CurpVerificationBadgeProps {
  curp?: string;
  curpVerified?: boolean;
  curpVerifiedAt?: string;
  compact?: boolean;
}

const GENERIC_FOREIGN_CURPS = ['XEXX010101HNEXXXA4', 'XEXX010101MNEXXXA8'];

export default function CurpVerificationBadge({ 
  curp, curpVerified, curpVerifiedAt, compact = false 
}: CurpVerificationBadgeProps) {
  if (!curp) return null;

  const isForeignGeneric = GENERIC_FOREIGN_CURPS.includes(curp.toUpperCase());

  if (isForeignGeneric) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500" title="CURP genérico de extranjero">
        <Clock className="w-3.5 h-3.5" />
        {!compact && <span>Extranjero</span>}
      </span>
    );
  }

  if (curpVerified) {
    const dateStr = curpVerifiedAt
      ? new Date(curpVerifiedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';
    return (
      <span 
        className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full"
        title={`CURP verificada contra RENAPO${dateStr ? ` el ${dateStr}` : ''}`}
      >
        <CheckCircle className="w-3.5 h-3.5" />
        {!compact && <span>Verificada</span>}
      </span>
    );
  }

  return (
    <span 
      className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"
      title="CURP no validada contra RENAPO"
    >
      <AlertCircle className="w-3.5 h-3.5" />
      {!compact && <span>Sin verificar</span>}
    </span>
  );
}
