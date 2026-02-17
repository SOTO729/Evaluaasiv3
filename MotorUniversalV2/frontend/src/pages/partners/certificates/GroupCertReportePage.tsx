/**
 * GroupCertReportePage – Reporte de Evaluación / Constancia de Participación (tier_basic)
 * Página independiente con tabla, selección y descarga completa.
 */
import { FileText } from 'lucide-react';
import CertificateTypePage from './CertificateTypePage';

export default function GroupCertReportePage() {
  return (
    <CertificateTypePage
      certType="tier_basic"
      title="Reporte de Evaluación"
      subtitle="Constancia de Participación — Generados automáticamente al aprobar el examen"
      icon={FileText}
      headerGradient="bg-gradient-to-r from-blue-600 to-blue-800"
      accentColor="blue"
      downloadEnabled={true}
      canGenerate={true}
    />
  );
}
