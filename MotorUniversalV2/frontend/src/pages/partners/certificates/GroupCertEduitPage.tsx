/**
 * GroupCertEduitPage – Certificado Eduit (tier_standard)
 * Página independiente con tabla, selección y descarga completa.
 */
import { Award } from 'lucide-react';
import CertificateTypePage from './CertificateTypePage';

export default function GroupCertEduitPage() {
  return (
    <CertificateTypePage
      certType="tier_standard"
      title="Certificado Eduit"
      subtitle="Certificado oficial de Eduit — Generados automáticamente al aprobar el examen"
      icon={Award}
      headerGradient="bg-gradient-to-r from-purple-600 to-purple-800"
      accentColor="purple"
      downloadEnabled={true}
      canGenerate={true}
    />
  );
}
