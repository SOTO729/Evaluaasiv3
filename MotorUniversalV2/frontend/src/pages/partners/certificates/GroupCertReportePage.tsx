/**
 * GroupCertReportePage – Reporte de Evaluación / Constancia de Participación (tier_basic)
 * Página independiente con tabla, selección y descarga completa.
 * Solo admin/developer pueden regenerar PDFs.
 */
import { FileText } from 'lucide-react';
import CertificateTypePage from './CertificateTypePage';
import { useAuthStore } from '../../../store/authStore';

export default function GroupCertReportePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'developer';

  return (
    <CertificateTypePage
      certType="tier_basic"
      title="Reporte de Evaluación"
      subtitle="Constancia de Participación — Generados automáticamente al aprobar el examen"
      icon={FileText}
      headerGradient="bg-gradient-to-r from-blue-600 to-blue-800"
      accentColor="blue"
      downloadEnabled={true}
      canGenerate={isAdmin}
    />
  );
}
